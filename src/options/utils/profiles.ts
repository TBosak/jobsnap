import { sendMessage } from "../../ui-shared/runtime";
import type { ProfileIndexItem } from "../../ui-shared/messaging";

export async function listProfiles(): Promise<Record<string, string>> {
  try {
    const profiles = await sendMessage<ProfileIndexItem[]>({ type: "LIST_PROFILE_INDEX" });
    const map: Record<string, string> = {};
    (profiles ?? []).forEach((profile) => {
      map[profile.id] = profile.name;
    });
    return map;
  } catch {
    return {};
  }
}
