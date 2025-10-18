import type { ProfileRecord } from "../../ui-shared/schema";
import type { FieldMap } from "../types";

export function linkedinAdapter(profile: ProfileRecord): FieldMap[] {
  const basics = profile.resume.basics ?? {};
  const work = profile.resume.work?.[0];

  const maps: FieldMap[] = [];
  if (basics.name) {
    maps.push({ selector: "input[name='firstName']", value: basics.name.split(" ")[0] });
    const parts = basics.name.split(" ");
    if (parts.length > 1) {
      maps.push({ selector: "input[name='lastName']", value: parts.slice(1).join(" ") });
    }
  }
  if (basics.email) {
    maps.push({ selector: "input[name='emailAddress']", value: basics.email });
  }
  if (basics.phone) {
    maps.push({ selector: "input[name='phoneNumber']", value: basics.phone });
  }
  if (work?.position) {
    maps.push({ selector: "input[name='positionTitle']", value: work.position });
  }
  if (work?.name) {
    maps.push({ selector: "input[name='companyName']", value: work.name });
  }
  return maps;
}
