import type { ProfileRecord } from "../../ui-shared/schema";
import type { FieldMap } from "../types";

interface RemixContext {
  state?: {
    loaderData?: Record<string, any>;
  };
}

interface QuestionField {
  name: string;
  type: string;
  values?: Array<{ value: number | string; label: string }>;
}

interface Question {
  required: boolean;
  label: string;
  description?: string | null;
  fields: QuestionField[];
}

export function greenhouseAdapter(profile: ProfileRecord): FieldMap[] {
  const basics = profile.resume.basics ?? {};
  const maps: FieldMap[] = [];

  const nameParts = splitName(basics.name ?? "");
  if (nameParts.first) {
    maps.push({ selector: "#first_name", value: nameParts.first });
  }
  if (nameParts.last) {
    maps.push({ selector: "#last_name", value: nameParts.last });
  }
  if (basics.email) {
    maps.push({ selector: "#email", value: basics.email });
  }
  if (basics.phone) {
    maps.push({ selector: "#phone", value: basics.phone });
  }

  const questions = readQuestions();
  applyLocationFields(maps, basics, questions);
  if (questions.length) {
    const linkedinField = findFieldByKeywords(questions, ["linkedin"]);
    if (linkedinField && isTextField(linkedinField)) {
      const url = pickProfileUrl(basics);
      if (url) {
        maps.push({ selector: selectorForField(linkedinField), value: url });
      }
    }

    const websiteField =
      findFieldByKeywords(questions, ["website"]) ??
      findFieldByKeywords(questions, ["portfolio"]) ??
      findFieldByKeywords(questions, ["personal", "site"]);
    if (websiteField && isTextField(websiteField)) {
      const site = firstNonPrimaryProfileUrl(basics);
      if (site) {
        maps.push({ selector: selectorForField(websiteField), value: site });
      }
    }

    const summarySource = basics.summary ?? deriveSummaryFromWork(profile);
    const summaryField = findFieldByKeywords(questions, ["looking", "next", "role"]);
    if (summaryField && isTextField(summaryField) && summarySource) {
      maps.push({ selector: selectorForField(summaryField), value: summarySource });
    }

    const referralSource = profile.notes ?? (profile.tags?.length ? profile.tags.join(", ") : undefined);
    const referralField = findFieldByKeywords(questions, ["how", "find"]);
    if (referralField && isTextField(referralField) && referralSource) {
      maps.push({ selector: selectorForField(referralField), value: referralSource });
    }

    const resumeTextField = findFieldByName(questions, "resume_text");
    if (resumeTextField && isTextField(resumeTextField) && summarySource) {
      maps.push({ selector: selectorForField(resumeTextField), value: summarySource });
    }

    const coverLetterField = findFieldByName(questions, "cover_letter_text");
    if (coverLetterField && isTextField(coverLetterField) && profile.notes) {
      maps.push({ selector: selectorForField(coverLetterField), value: profile.notes });
    }

    const visaField = findFieldByKeywords(questions, ["visa", "sponsor"]);
    const visaAnswer = visaField && deriveVisaAnswer(profile);
    if (visaField && isSelectField(visaField) && visaAnswer) {
      const option = matchOption(visaField, visaAnswer);
      if (option) {
        maps.push({ apply: () => scheduleSelect(visaField.name, option) });
      }
    }

    const startField = findFieldByKeywords(questions, ["start"], ["preferred", "availability"]);
    if (startField && isSelectField(startField)) {
      const option = derivePreferredStart(profile, startField);
      if (option) {
        maps.push({ apply: () => scheduleSelect(startField.name, option) });
      }
    }
  }

  const education = profile.resume.education?.[0];
  if (education) {
    if (education.institution) {
      maps.push({ selector: "#school--0", value: education.institution });
    }
    if (education.studyType) {
      maps.push({ selector: "#degree--0", value: education.studyType });
    }
    if (education.area) {
      maps.push({ selector: "#discipline--0", value: education.area });
    }

    const startParts = parseDateParts(education.startDate);
    if (startParts.month) {
      maps.push({ selector: "#start-month--0", value: startParts.month });
    }
    if (startParts.year) {
      maps.push({ selector: "#start-year--0", value: startParts.year });
    }

    const endParts = parseDateParts(education.endDate);
    if (endParts.month) {
      maps.push({ selector: "#end-month--0", value: endParts.month });
    }
    if (endParts.year) {
      maps.push({ selector: "#end-year--0", value: endParts.year });
    }
  }

  return maps;
}

function applyLocationFields(maps: FieldMap[], basics: NonNullable<ProfileRecord["resume"]["basics"]>, questions: Question[]) {
  const location = basics.location;
  if (!location) return;

  if (location.city) {
    const cityField = findFieldByKeywords(questions, ["city"]);
    if (cityField && isTextField(cityField)) {
      maps.push({ selector: selectorForField(cityField), value: location.city });
    } else if (document.getElementById("city")) {
      maps.push({ selector: "#city", value: location.city });
    }
  }

  const regionValue = location.region || location.subregion || location.province;
  if (regionValue) {
    const regionField =
      findFieldByKeywords(questions, ["state"]) ??
      findFieldByKeywords(questions, ["province"]) ??
      findFieldByKeywords(questions, ["region"]);
    if (regionField && isTextField(regionField)) {
      maps.push({ selector: selectorForField(regionField), value: regionValue });
    } else if (
      regionField && isSelectField(regionField)
    ) {
      const option = matchOption(regionField, regionValue);
      if (option) {
        maps.push({ apply: () => scheduleSelect(regionField.name, option) });
      }
    } else if (document.getElementById("state")) {
      maps.push({ selector: "#state", value: regionValue });
    }
  }

  if (location.postalCode) {
    const postalField =
      findFieldByKeywords(questions, ["postal"]) ??
      findFieldByKeywords(questions, ["zip"]);
    if (postalField && isTextField(postalField)) {
      maps.push({ selector: selectorForField(postalField), value: location.postalCode });
    } else if (document.getElementById("postal_code")) {
      maps.push({ selector: "#postal_code", value: location.postalCode });
    }
  }

  const countryName = countryNameFromCode(location.countryCode) ?? location.countryCode ?? location.countryName;
  if (countryName) {
    const countryField = findFieldByKeywords(questions, ["country"]);
    if (countryField && isSelectField(countryField)) {
      const option = matchOption(countryField, countryName);
      if (option) {
        maps.push({ apply: () => scheduleSelect(countryField.name, option) });
      }
    } else if (countryField && isTextField(countryField)) {
      maps.push({ selector: selectorForField(countryField), value: countryName });
    } else if (document.getElementById("country")) {
      maps.push({ selector: "#country", value: countryName });
    }
  }
}

function splitName(fullName: string): { first?: string; last?: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return {};
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { first: parts[0] };
  }
  return {
    first: parts[0],
    last: parts.slice(1).join(" ")
  };
}

function readQuestions(): Question[] {
  if (typeof window === "undefined") {
    return [];
  }
  const remix = (window as any).__remixContext as RemixContext | undefined;
  const loaderData = remix?.state?.loaderData ?? {};
  const routeData = loaderData["routes/$url_token_.jobs_.$job_post_id"];
  const questions = Array.isArray(routeData?.jobPost?.questions) ? routeData.jobPost.questions : [];
  if (questions.length) {
    return questions;
  }
  return readQuestionsFromDom();
}

function readQuestionsFromDom(): Question[] {
  const labels = Array.from(document.querySelectorAll<HTMLLabelElement>(".application--questions label[for]"));
  const results: Question[] = [];
  const seen = new Set<string>();

  for (const label of labels) {
    const fieldId = label.getAttribute("for");
    if (!fieldId || seen.has(fieldId)) continue;
    const element = document.getElementById(fieldId) as HTMLElement | null;
    if (!element) continue;

    const tag = element.tagName.toLowerCase();
    let type: string;
    if (tag === "textarea") {
      type = "textarea";
    } else if (tag === "select") {
      type = "multi_value_single_select";
    } else {
      const role = element.getAttribute("role");
      type = role === "combobox" ? "multi_value_single_select" : "input_text";
    }

    const required = element.getAttribute("aria-required") === "true" || label.textContent?.includes("*") || false;

    results.push({
      required,
      label: label.textContent ?? "",
      fields: [
        {
          name: fieldId,
          type
        }
      ]
    });

    seen.add(fieldId);
  }

  return results;
}

function pickProfileUrl(basics: NonNullable<ProfileRecord["resume"]["basics"]>) {
  const byNetworkPriority = ["linkedin", "github", "portfolio", "personal"];
  if (basics?.profiles?.length) {
    const prioritized = [...basics.profiles].sort((a, b) => {
      const aIndex = indexForNetwork(a.network, byNetworkPriority);
      const bIndex = indexForNetwork(b.network, byNetworkPriority);
      return aIndex - bIndex;
    });
    const preferred = prioritized.find((profile) => profile.url);
    if (preferred?.url) {
      return preferred.url;
    }
  }
  return basics?.url;
}

function indexForNetwork(network: string | undefined, priority: string[]): number {
  if (!network) return Number.MAX_SAFE_INTEGER;
  const lower = network.toLowerCase();
  const index = priority.findIndex((item) => lower.includes(item));
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function findFieldByKeywords(questions: Question[], keywords: string[], additionalKeywords: string[] = []): QuestionField | undefined {
  const primary = keywords.map((keyword) => keyword.toLowerCase());
  const secondary = additionalKeywords.map((keyword) => keyword.toLowerCase());
  for (const question of questions) {
    const label = question.label?.toLowerCase() ?? "";
    const matchesPrimary = primary.every((keyword) => label.includes(keyword));
    const matchesSecondary = secondary.length ? secondary.some((keyword) => label.includes(keyword)) : true;
    if (matchesPrimary && matchesSecondary) {
      const field = question.fields?.[0];
      if (field?.name) {
        return field;
      }
    }
  }
  return undefined;
}

function isTextField(field: QuestionField | undefined): field is QuestionField {
  if (!field) return false;
  return field.type === "input_text" || field.type === "textarea";
}

function isSelectField(field: QuestionField | undefined): field is QuestionField {
  return field?.type === "multi_value_single_select";
}

function selectorForField(field: QuestionField): string {
  return `#${field.name}`;
}

function firstNonPrimaryProfileUrl(basics: NonNullable<ProfileRecord["resume"]["basics"]>) {
  if (!basics?.profiles?.length) {
    return basics?.url && !/linkedin/i.test(basics.url) ? basics.url : undefined;
  }
  const fallback = basics.profiles.find((profile) => profile.url && !/linkedin/i.test(profile.network ?? ""));
  if (fallback?.url) {
    return fallback.url;
  }
  if (basics.url && !/linkedin/i.test(basics.url)) {
    return basics.url;
  }
  const secondary = basics.profiles.find((profile) => profile.url);
  return secondary?.url ?? undefined;
}

function findFieldByName(questions: Question[], name: string): QuestionField | undefined {
  for (const question of questions) {
    for (const field of question.fields ?? []) {
      if (field.name === name) {
        return field;
      }
    }
  }
  return undefined;
}

function deriveSummaryFromWork(profile: ProfileRecord): string | undefined {
  const work = profile.resume.work;
  if (!work || !work.length) {
    return undefined;
  }
  const primary = work[0];
  return primary.summary ?? primary.highlights?.join("\n");
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

function parseDateParts(input?: string): { month?: string; year?: string } {
  if (!input) return {};
  const trimmed = input.trim();
  if (!trimmed || /present|current/i.test(trimmed)) {
    return {};
  }

  let month: string | undefined;
  let year: string | undefined;

  const isoMatch = trimmed.match(/^(\d{4})(?:-(\d{1,2}))/);
  if (isoMatch) {
    year = isoMatch[1];
    if (isoMatch[2]) {
      const index = parseInt(isoMatch[2], 10) - 1;
      if (index >= 0 && index < MONTH_NAMES.length) {
        month = MONTH_NAMES[index];
      }
    }
  } else {
    const yearMatch = trimmed.match(/(19|20)\d{2}/);
    if (yearMatch) {
      year = yearMatch[0];
    }
    const monthMatch = MONTH_NAMES.find((name) => trimmed.toLowerCase().includes(name.toLowerCase()));
    if (monthMatch) {
      month = monthMatch;
    }
  }

  return { month, year };
}

function matchOption(field: QuestionField, answer: string): { value: number | string; label: string } | undefined {
  if (!field.values?.length) {
    return undefined;
  }
  const normalized = normalize(answer);
  return (
    field.values.find((opt) => normalize(opt.label) === normalized) ??
    field.values.find((opt) => normalize(opt.label).includes(normalized)) ??
    field.values.find((opt) => normalized.includes(normalize(opt.label)))
  );
}

function normalize(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
}

const REGION_DISPLAY =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames !== "undefined"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

function countryNameFromCode(code: string | undefined | null): string | undefined {
  if (!code) return undefined;
  const trimmed = code.trim();
  if (!trimmed) return undefined;
  if (trimmed.length === 2 && REGION_DISPLAY) {
    return REGION_DISPLAY.of(trimmed.toUpperCase()) ?? trimmed;
  }
  return trimmed;
}

function scheduleSelect(fieldName: string, option: { value: number | string; label: string }): void {
  const attempt = (remaining = 8) => {
    const input = document.getElementById(fieldName) as HTMLInputElement | null;
    if (!input) {
      if (remaining > 0) {
        window.setTimeout(() => attempt(remaining - 1), 200);
      }
      return;
    }

    let hidden = document.querySelector<HTMLInputElement>(`input[name="${fieldName}"]`);
    if (!hidden) {
      hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.name = fieldName;
      input.insertAdjacentElement("afterend", hidden);
    }

    hidden.value = String(option.value);
    hidden.dispatchEvent(new Event("input", { bubbles: true }));
    hidden.dispatchEvent(new Event("change", { bubbles: true }));

    input.value = option.label;
    input.setAttribute("data-value", String(option.value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    const container = input.closest<HTMLElement>(".select");
    if (container) {
      const placeholder = container.querySelector<HTMLElement>(".select__placeholder");
      if (placeholder) {
        placeholder.textContent = option.label;
      }
      const displayValue = container.querySelector<HTMLElement>(".select__single-value");
      if (displayValue) {
        displayValue.textContent = option.label;
      }
      const inputContainer = container.querySelector<HTMLElement>(".select__input-container");
      if (inputContainer) {
        inputContainer.setAttribute("data-value", String(option.value));
      }
    }
  };

  attempt();
}

function deriveVisaAnswer(profile: ProfileRecord): string | undefined {
  const sources = [...(profile.tags ?? []), profile.notes ?? ""];
  for (const entry of sources) {
    const lower = entry.toLowerCase();
    if (!lower.includes("visa") && !lower.includes("sponsor")) {
      continue;
    }
    if (lower.includes("no")) {
      return "No";
    }
    if (lower.includes("yes")) {
      return "Yes";
    }
  }
  return undefined;
}

function derivePreferredStart(profile: ProfileRecord, field: QuestionField): { value: number | string; label: string } | undefined {
  if (!field.values?.length) {
    return undefined;
  }

  const sources = [...(profile.tags ?? []), profile.notes ?? ""];
  for (const text of sources) {
    const monthYear = extractMonthYear(text);
    if (!monthYear) continue;
    const match = matchOption(field, monthYear);
    if (match) {
      return match;
    }
  }

  return undefined;
}

function extractMonthYear(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const monthRegex = /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})/i;
  const isoRegex = /(20\d{2})[-/](\d{1,2})/;
  const monthMatch = text.match(monthRegex);
  if (monthMatch) {
    return `${capitalize(monthMatch[1])} ${monthMatch[2]}`;
  }
  const isoMatch = text.match(isoRegex);
  if (isoMatch) {
    const year = isoMatch[1];
    const monthIndex = parseInt(isoMatch[2], 10) - 1;
    if (monthIndex >= 0 && monthIndex < MONTH_NAMES.length) {
      return `${MONTH_NAMES[monthIndex]} ${year}`;
    }
  }
  return undefined;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
