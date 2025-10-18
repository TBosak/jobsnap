import type { ProfileRecord } from "../../ui-shared/schema";
import type { FieldMap } from "../types";

const NAME_SELECTORS = {
  full: [
    "input[name='name']",
    "input[name='fullName']",
    "input[name*='full_name' i]",
    "input[name*='fullname' i]",
    "input[id*='full_name' i]",
    "input[placeholder*='full name' i]"
  ],
  first: [
    "input[name='firstName']",
    "input[name*='first_name' i]",
    "input[name*='given_name' i]",
    "input[id*='first' i]",
    "input[placeholder*='first name' i]"
  ],
  last: [
    "input[name='lastName']",
    "input[name*='last_name' i]",
    "input[name*='family_name' i]",
    "input[name*='surname' i]",
    "input[id*='last' i]",
    "input[placeholder*='last name' i]"
  ]
};

const CONTACT_SELECTORS = {
  email: [
    "input[type='email']",
    "input[name='email']",
    "input[name*='email' i]",
    "input[id*='email' i]",
    "input[placeholder*='email' i]"
  ],
  phone: [
    "input[type='tel']",
    "input[inputmode='tel']",
    "input[name*='phone' i]",
    "input[name*='mobile' i]",
    "input[id*='phone' i]",
    "input[placeholder*='phone' i]"
  ],
  headline: [
    "input[name*='headline' i]",
    "input[name*='title' i]",
    "input[id*='headline' i]",
    "textarea[name*='headline' i]",
    "input[placeholder*='headline' i]"
  ],
  summary: [
    "textarea[name*='summary' i]",
    "textarea[name*='cover' i]",
    "textarea[id*='summary' i]",
    "textarea[placeholder*='summary' i]",
    "textarea[placeholder*='cover letter' i]"
  ]
};

const LOCATION_SELECTORS = {
  address: [
    "input[name='address']",
    "input[name*='address_line1' i]",
    "input[id*='address' i]",
    "textarea[name*='address' i]"
  ],
  city: [
    "input[name='city']",
    "input[name*='city' i]",
    "input[id*='city' i]",
    "input[placeholder*='city' i]"
  ],
  region: [
    "input[name*='state' i]",
    "input[name*='province' i]",
    "input[name*='region' i]"
  ],
  postal: [
    "input[name*='postal' i]",
    "input[name*='zip' i]",
    "input[id*='postal' i]",
    "input[placeholder*='postal' i]",
    "input[placeholder*='zip' i]"
  ],
  country: [
    "input[name*='country' i]",
    "input[id*='country' i]",
    "input[placeholder*='country' i]"
  ]
};

const PROFILE_INPUTS = {
  linkedin: [
    "input[name*='linkedin' i]",
    "input[id*='linkedin' i]",
    "input[placeholder*='linkedin' i]"
  ],
  github: [
    "input[name*='github' i]",
    "input[id*='github' i]",
    "input[placeholder*='github' i]"
  ],
  twitter: [
    "input[name*='twitter' i]",
    "input[name*='x.com' i]",
    "input[id*='twitter' i]"
  ],
  website: [
    "input[name*='website' i]",
    "input[name*='portfolio' i]",
    "input[name*='site' i]",
    "input[name*='url' i]",
    "input[id*='website' i]",
    "input[placeholder*='website' i]"
  ]
};

export function genericAdapter(profile: ProfileRecord): FieldMap[] {
  const basics = profile.resume.basics ?? {};
  const maps: FieldMap[] = [];

  const { first, last } = splitName(basics.name ?? "");
  pushSelectors(maps, NAME_SELECTORS.full, basics.name);
  pushSelectors(maps, NAME_SELECTORS.first, first);
  pushSelectors(maps, NAME_SELECTORS.last, last);
  pushSelectors(maps, CONTACT_SELECTORS.email, basics.email);
  pushSelectors(maps, CONTACT_SELECTORS.phone, basics.phone);
  pushSelectors(maps, CONTACT_SELECTORS.headline, basics.label);
  pushSelectors(maps, CONTACT_SELECTORS.summary, basics.summary);

  const location = basics.location ?? {};
  pushSelectors(maps, LOCATION_SELECTORS.address, location.address);
  pushSelectors(maps, LOCATION_SELECTORS.city, location.city);
  pushSelectors(maps, LOCATION_SELECTORS.region, location.region);
  pushSelectors(maps, LOCATION_SELECTORS.postal, location.postalCode);
  pushSelectors(maps, LOCATION_SELECTORS.country, location.countryCode);

  const usedUrls = collectUsedUrls([]);
  const linkedin = pickProfileUrl(basics, ["linkedin"]);
  if (linkedin) usedUrls.add(linkedin);
  pushSelectors(maps, PROFILE_INPUTS.linkedin, linkedin);

  const github = pickProfileUrl(basics, ["github"]);
  if (github) usedUrls.add(github);
  pushSelectors(maps, PROFILE_INPUTS.github, github);

  const twitter = pickProfileUrl(basics, ["twitter", "x"]);
  if (twitter) usedUrls.add(twitter);
  pushSelectors(maps, PROFILE_INPUTS.twitter, twitter);

  const website = pickProfileUrl(basics, ["portfolio", "personal", "site", "website", "blog"]) ?? basics.url;
  if (website) usedUrls.add(website);
  pushSelectors(maps, PROFILE_INPUTS.website, website);

  const other = pickAnyOtherUrl(basics, usedUrls);
  pushSelectors(maps, PROFILE_INPUTS.website, other);

  return dedupeMaps(maps);
}

function pushSelectors(maps: FieldMap[], selectors: string[], value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return;
  selectors.forEach((selector) => maps.push({ selector, value: trimmed }));
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

function pickProfileUrl(
  basics: ProfileRecord["resume"]["basics"] = {},
  keywords: string[]
): string | undefined {
  const profiles = basics.profiles ?? [];
  const lowered = keywords.map((k) => k.toLowerCase());
  for (const profile of profiles) {
    const network = profile.network?.toLowerCase() ?? "";
    if (lowered.some((kw) => network.includes(kw))) {
      if (profile.url) return profile.url.trim();
    }
  }
  if (basics.url && lowered.some((kw) => basics.url!.toLowerCase().includes(kw))) {
    return basics.url.trim();
  }
  return undefined;
}

function pickAnyOtherUrl(
  basics: ProfileRecord["resume"]["basics"] = {},
  used: Set<string>
): string | undefined {
  const profiles = basics.profiles ?? [];
  for (const profile of profiles) {
    const url = profile.url?.trim();
    if (url && !used.has(url)) {
      return url;
    }
  }
  if (basics.url && !used.has(basics.url)) {
    return basics.url.trim();
  }
  return undefined;
}

function collectUsedUrls(initial: Array<string | undefined>): Set<string> {
  const set = new Set<string>();
  initial.forEach((value) => {
    const trimmed = value?.trim();
    if (trimmed) set.add(trimmed);
  });
  return set;
}

function dedupeMaps(maps: FieldMap[]): FieldMap[] {
  const seen = new Set<string>();
  const result: FieldMap[] = [];
  for (const map of maps) {
    if (!map.selector) continue;
    const key = `${map.selector}::${map.value ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(map);
  }
  return result;
}
