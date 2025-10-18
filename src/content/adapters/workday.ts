import type { JsonResumeBasics, JsonResumeWork, ProfileRecord } from "../../ui-shared/schema";
import type { FieldMap } from "../types";
import type { JsonResumeEducation } from "../../ui-shared/schema";

export function workdayAdapter(profile: ProfileRecord): FieldMap[] {
  const basics = profile.resume.basics ?? {};
  const maps: FieldMap[] = [];

  const nameParts = splitName(basics.name ?? "");

  pushValue(maps, "#name--legalName--firstName", nameParts.first);
  pushValue(maps, "#name--legalName--lastName", nameParts.last);

  const location = basics.location ?? {};
  pushValue(maps, "input[name='addressLine1']", location.address);
  pushValue(maps, "#address--city", location.city);
  pushValue(maps, "#address--postalCode", location.postalCode);

  pushValue(maps, "#phoneNumber--phoneNumber", basics.phone);

  maps.push({ apply: () => fillStateAndCountry(location) });
  maps.push({ apply: () => fillWorkExperience(profile.resume.work ?? []) });
  maps.push({ apply: () => fillEducation(profile.resume.education ?? []) });

  return dedupeMaps(maps);
}

function pushValue(maps: FieldMap[], selector: string, value?: string | null) {
  const trimmed = value?.toString().trim();
  if (trimmed) {
    maps.push({ selector, value: trimmed });
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

function fillStateAndCountry(location: JsonResumeBasics["location"]) {
  if (!location) return;

  const state = location.region?.trim();
  if (state) {
    applyComboButtonValue("#address--countryRegion", state);
  }

  const country = location.countryCode?.trim();
  if (country) {
    applyComboButtonValue("#country--country", country);
  }
}

function applyComboButtonValue(buttonSelector: string, displayValue: string) {
  const button = document.querySelector<HTMLButtonElement>(buttonSelector);
  if (!button) return;

  button.value = displayValue;
  if (!button.hasAttribute("data-original-text")) {
    button.setAttribute("data-original-text", button.textContent ?? "");
  }
  button.textContent = displayValue;
  button.dispatchEvent(new Event("change", { bubbles: true }));

  const hiddenInput = button.parentElement?.querySelector<HTMLInputElement>("input[type='text']");
  if (hiddenInput) {
    setInputValue(hiddenInput, displayValue);
  }
}

function fillWorkExperience(workEntries: JsonResumeWork[]) {
  if (!workEntries.length) return;

  const jobTitleInputs = document.querySelectorAll<HTMLInputElement>("[data-automation-id='formField-jobTitle'] input");
  const companyInputs = document.querySelectorAll<HTMLInputElement>("[data-automation-id='formField-companyName'] input");
  const locationInputs = document.querySelectorAll<HTMLInputElement>("[data-automation-id='formField-location'] input");
  const currentlyHereInputs = document.querySelectorAll<HTMLInputElement>("input[name='currentlyWorkHere']");
  const summaryTextareas = document.querySelectorAll<HTMLTextAreaElement>("[data-automation-id='formField-roleDescription'] textarea");
  const startMonthInputs = document.querySelectorAll<HTMLInputElement>("input[id$='--startDate-dateSectionMonth-input']");
  const startYearInputs = document.querySelectorAll<HTMLInputElement>("input[id$='--startDate-dateSectionYear-input']");
  const endMonthInputs = document.querySelectorAll<HTMLInputElement>("input[id$='--endDate-dateSectionMonth-input']");
  const endYearInputs = document.querySelectorAll<HTMLInputElement>("input[id$='--endDate-dateSectionYear-input']");

  workEntries.forEach((entry, index) => {
    const titleInput = jobTitleInputs[index];
    if (titleInput) {
      setInputValue(titleInput, entry.position ?? "");
    }

    const companyInput = companyInputs[index];
    if (companyInput) {
      setInputValue(companyInput, entry.name ?? "");
    }

    const locationInput = locationInputs[index];
    if (locationInput) {
      setInputValue(locationInput, entry.location ?? "");
    }

    const summaryTextarea = summaryTextareas[index];
    if (summaryTextarea) {
      const value = entry.summary ?? (entry.highlights ? entry.highlights.join("\n") : "");
      setTextareaValue(summaryTextarea, value);
    }

    const startMonthInput = startMonthInputs[index];
    const startYearInput = startYearInputs[index];
    const startParts = parseYearMonth(entry.startDate);
    if (startMonthInput && startParts.month) {
      setInputValue(startMonthInput, startParts.month);
    }
    if (startYearInput && startParts.year) {
      setInputValue(startYearInput, startParts.year);
    }

    const endMonthInput = endMonthInputs[index];
    const endYearInput = endYearInputs[index];
    const isCurrent = isCurrentRole(entry);
    const endParts = parseYearMonth(entry.endDate);

    const checkbox = currentlyHereInputs[index];
    if (checkbox) {
      setCheckbox(checkbox, isCurrent);
    }

    if (!isCurrent) {
      if (endMonthInput && endParts.month) {
        setInputValue(endMonthInput, endParts.month);
      }
      if (endYearInput && endParts.year) {
        setInputValue(endYearInput, endParts.year);
      }
    }
  });
}

function fillEducation(educationEntries: JsonResumeEducation[]) {
  if (!educationEntries.length) return;

  const schoolInputs = document.querySelectorAll<HTMLInputElement>("[data-automation-id='formField-schoolName'] input");
  const degreeButtons = document.querySelectorAll<HTMLButtonElement>("[data-automation-id='formField-degree'] button");
  const degreeHiddenInputs = document.querySelectorAll<HTMLInputElement>("[data-automation-id='formField-degree'] input[type='text']");
  const fieldInputs = document.querySelectorAll<HTMLInputElement>("[data-automation-id='formField-fieldOfStudy'] input[type='text']");
  const gpaInputs = document.querySelectorAll<HTMLInputElement>("[data-automation-id='formField-gradeAverage'] input");
  const startYearInputs = document.querySelectorAll<HTMLInputElement>("input[id$='--firstYearAttended-dateSectionYear-input']");
  const endYearInputs = document.querySelectorAll<HTMLInputElement>("input[id$='--lastYearAttended-dateSectionYear-input']");

  educationEntries.forEach((entry, index) => {
    const schoolInput = schoolInputs[index];
    if (schoolInput) {
      setInputValue(schoolInput, entry.institution ?? "");
    }

    const degreeButton = degreeButtons[index];
    if (degreeButton && entry.studyType) {
      degreeButton.textContent = entry.studyType;
      degreeButton.value = entry.studyType;
      degreeButton.dispatchEvent(new Event("click", { bubbles: true }));
      degreeButton.dispatchEvent(new Event("change", { bubbles: true }));
      const hidden = degreeHiddenInputs[index];
      if (hidden) {
        setInputValue(hidden, entry.studyType);
      }
    }

    const fieldInput = fieldInputs[index];
    if (fieldInput && entry.area) {
      setInputValue(fieldInput, entry.area);
    }

    const gpaInput = gpaInputs[index];
    if (gpaInput && entry.score) {
      setInputValue(gpaInput, entry.score);
    }

    const startYearInput = startYearInputs[index];
    if (startYearInput && entry.startDate) {
      const { year } = parseYearMonth(entry.startDate);
      if (year) setInputValue(startYearInput, year);
    }

    const endYearInput = endYearInputs[index];
    if (endYearInput && entry.endDate && !/present/i.test(entry.endDate)) {
      const { year } = parseYearMonth(entry.endDate);
      if (year) setInputValue(endYearInput, year);
    }
  });
}

function parseYearMonth(raw?: string): { month?: string; year?: string } {
  if (!raw) return {};
  const value = raw.trim();
  if (!value || /present/i.test(value)) {
    return {};
  }

  const isoMatch = value.match(/^(\d{4})(?:[-/](\d{1,2}))?/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2] ? isoMatch[2].padStart(2, "0") : undefined;
    return { month, year };
  }

  const monthNames = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec"
  ];

  const monthNameMatch = value.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i);
  const yearMatch = value.match(/(\d{4})/);

  const monthIndex = monthNameMatch ? monthNames.indexOf(monthNameMatch[1].slice(0, 3).toLowerCase()) : -1;
  const month = monthIndex >= 0 ? String(monthIndex + 1).padStart(2, "0") : undefined;
  const year = yearMatch ? yearMatch[1] : undefined;

  return { month, year };
}

function isCurrentRole(entry: JsonResumeWork): boolean {
  if (!entry) return false;
  if (!entry.endDate) return true;
  return /present/i.test(entry.endDate);
}

function setInputValue(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function setTextareaValue(textarea: HTMLTextAreaElement, value?: string) {
  if (!value) return;
  textarea.value = value;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
}

function setCheckbox(input: HTMLInputElement, checked: boolean) {
  input.checked = checked;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function dedupeMaps(maps: FieldMap[]): FieldMap[] {
  const seen = new Set<string>();
  const result: FieldMap[] = [];
  for (const map of maps) {
    if (!map.selector) {
      result.push(map);
      continue;
    }
    const key = `${map.selector}::${map.value ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(map);
  }
  return result;
}
