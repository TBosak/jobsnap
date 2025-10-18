import type { JsonResumeBasics, JsonResumeWork, JsonResumeEducation, ProfileRecord } from "../../ui-shared/schema";
import type { FieldMap } from "../types";

export function oracleAdapter(profile: ProfileRecord): FieldMap[] {
  const basics = profile.resume.basics ?? {};
  const maps: FieldMap[] = [];

  // Name fields
  const nameParts = splitName(basics.name ?? "");
  pushValue(maps, "input[name='firstName']", nameParts.first);
  pushValue(maps, "input[name='lastName']", nameParts.last);
  pushValue(maps, "input[name='middleNames']", nameParts.middle);
  pushValue(maps, "input[name='knownAs']", nameParts.first); // Preferred name defaults to first name

  // Contact fields
  pushValue(maps, "input[name='email']", basics.email);
  pushValue(maps, "input[type='tel']", basics.phone);

  // Address fields
  const location = basics.location ?? {};
  pushValue(maps, "input[name='addressLine1']", location.address);
  pushValue(maps, "input[name='addressLine2']", location.address2);
  pushValue(maps, "input[name='postalCode']", location.postalCode);
  pushValue(maps, "input[name='city']", location.city);
  pushValue(maps, "input[name='region2']", location.region); // State
  pushValue(maps, "input[name='country']", location.countryCode);

  // Links - Oracle uses specific link inputs
  const linkedInUrl = getProfileUrl(basics, ["linkedin"]);
  if (linkedInUrl) {
    pushValue(maps, "input[name='siteLink-1']", linkedInUrl);
  }

  // Work experience and education - Oracle uses "Add" buttons, so we can't pre-fill
  // these directly without clicking. We'll skip for now.

  return dedupeMaps(maps);
}

function pushValue(maps: FieldMap[], selector: string, value?: string | null) {
  const trimmed = value?.toString().trim();
  if (trimmed) {
    maps.push({ selector, value: trimmed });
  }
}

function splitName(fullName: string): { first?: string; last?: string; middle?: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return {};

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { first: parts[0] };
  }
  if (parts.length === 2) {
    return { first: parts[0], last: parts[1] };
  }

  // 3+ parts: first, middle(s), last
  return {
    first: parts[0],
    middle: parts.slice(1, -1).join(" "),
    last: parts[parts.length - 1]
  };
}

function getProfileUrl(basics: JsonResumeBasics, keywords: string[]): string | undefined {
  const profiles = basics.profiles ?? [];
  const lowerKeywords = keywords.map(k => k.toLowerCase());

  for (const profile of profiles) {
    const network = profile.network?.toLowerCase() ?? "";
    if (lowerKeywords.some(kw => network.includes(kw)) && profile.url) {
      return profile.url.trim();
    }
  }

  if (basics.url && lowerKeywords.some(kw => basics.url?.toLowerCase().includes(kw))) {
    return basics.url.trim();
  }

  return undefined;
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
