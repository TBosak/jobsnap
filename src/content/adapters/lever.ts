import type { JsonResumeBasics, JsonResumeBasicsProfile, ProfileRecord } from "../../ui-shared/schema";
import type { FieldMap } from "../types";

const LOCATION_SEPARATOR = ", ";

export function leverAdapter(profile: ProfileRecord): FieldMap[] {
  const basics = profile.resume.basics ?? {};
  const maps: FieldMap[] = [];

  if (basics.name) {
    maps.push({ selector: "input[name='name']", value: basics.name });
  }

  if (basics.email) {
    maps.push({ selector: "input[name='email']", value: basics.email });
  }

  if (basics.phone) {
    maps.push({ selector: "input[name='phone']", value: basics.phone });
  }

  const topWork = profile.resume.work?.[0];
  if (topWork?.name) {
    maps.push({ selector: "input[name='org']", value: topWork.name });
  }

  const locationText = formatLocation(basics.location);
  if (locationText) {
    maps.push({ selector: "input[name='location']", value: locationText });
    maps.push({ selector: "input[name='selectedLocation']", value: locationText });
  }

  const usedUrls = new Set<string>();

  const linkedIn = pickProfileUrl(basics, ["linkedin"]);
  if (linkedIn) {
    usedUrls.add(linkedIn);
    maps.push({ selector: "input[name='urls[LinkedIn]']", value: linkedIn });
  }

  const github = pickProfileUrl(basics, ["github"]);
  if (github) {
    usedUrls.add(github);
    maps.push({ selector: "input[name='urls[GitHub]']", value: github });
  }

  const twitter = pickProfileUrl(basics, ["twitter", "x.com"]);
  if (twitter) {
    usedUrls.add(twitter);
    maps.push({ selector: "input[name='urls[Twitter]']", value: twitter });
  }

  const portfolio =
    pickProfileUrl(basics, ["portfolio", "personal", "site", "blog"]) ??
    (basics.url && !usedUrls.has(basics.url) ? basics.url : undefined);
  if (portfolio) {
    usedUrls.add(portfolio);
    maps.push({ selector: "input[name='urls[Portfolio]']", value: portfolio });
  }

  const other = pickAnyOtherUrl(basics, usedUrls);
  if (other) {
    usedUrls.add(other);
    maps.push({ selector: "input[name='urls[Other]']", value: other });
  }

  const coverLetter = profile.notes ?? basics.summary ?? deriveWorkSummary(profile);
  if (coverLetter) {
    maps.push({ selector: "textarea[name='comments']", value: coverLetter });
  }

  return maps;
}

function formatLocation(location: JsonResumeBasics["location"]): string | undefined {
  if (!location) return undefined;
  const parts = [location.city, location.region, location.countryCode, location.postalCode]
    .map((part) => part?.trim())
    .filter(Boolean) as string[];
  if (!parts.length) {
    return undefined;
  }
  return parts.join(LOCATION_SEPARATOR);
}

function pickProfileUrl(
  basics: JsonResumeBasics & { profiles?: JsonResumeBasicsProfile[] },
  targets: string[]
): string | undefined {
  const profiles = basics?.profiles ?? [];
  const loweredTargets = targets.map((item) => item.toLowerCase());
  for (const profile of profiles) {
    const network = profile.network?.toLowerCase() ?? "";
    if (loweredTargets.some((target) => network.includes(target))) {
      if (profile.url) {
        return profile.url;
      }
    }
  }

  if (basics?.url && loweredTargets.some((target) => basics.url?.toLowerCase().includes(target))) {
    return basics.url;
  }

  return undefined;
}

function pickAnyOtherUrl(
  basics: JsonResumeBasics & { profiles?: JsonResumeBasicsProfile[] },
  used: Set<string>
): string | undefined {
  const profiles = basics?.profiles ?? [];
  for (const profile of profiles) {
    const url = profile.url?.trim();
    if (url && !used.has(url)) {
      return url;
    }
  }
  if (basics?.url && !used.has(basics.url)) {
    return basics.url;
  }
  return undefined;
}

function deriveWorkSummary(profile: ProfileRecord): string | undefined {
  const firstRole = profile.resume.work?.[0];
  if (!firstRole) {
    return undefined;
  }
  if (firstRole.summary) {
    return firstRole.summary;
  }
  if (firstRole.highlights?.length) {
    return firstRole.highlights.join("\n");
  }
  return undefined;
}
