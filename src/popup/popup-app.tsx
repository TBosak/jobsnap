import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import type { ProfileIndexItem } from "../ui-shared/messaging";
import { sendMessage } from "../ui-shared/runtime";
import { GradientHeader } from "./components/GradientHeader";
import { ProfileCard } from "./components/ProfileCard";
import { FloatingActionButton } from "./components/FloatingActionButton";
import type { ProfileRecord } from "../ui-shared/schema";

export function PopupApp() {
  const [profiles, setProfiles] = useState<ProfileIndexItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    try {
      const data = await sendMessage<ProfileIndexItem[]>({ type: "LIST_PROFILE_INDEX" });
      setProfiles(data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function makeActive(id: string) {
    await sendMessage({ type: "SET_ACTIVE_PROFILE", id });
    await refresh();
  }

  // Convert ProfileIndexItem to ProfileRecord for ProfileCard
  function toProfileRecord(item: ProfileIndexItem): ProfileRecord {
    return {
      id: item.id,
      name: item.name,
      resume: item.resume,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  return (
    <div className="min-w-80 max-w-96 bg-white rounded-xl shadow-xl overflow-hidden">
      <GradientHeader
        title="JobSnap"
        subtitle="Your profile, autofilled"
        action={
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="
              p-2 rounded-full
              bg-white/20 hover:bg-white/30
              transition-all duration-base
              backdrop-blur-sm
            "
            aria-label="Open settings"
          >
            <Settings className="h-5 w-5 text-slate-700" />
          </button>
        }
      />

      <div className="p-4">
        {error && (
          <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {profiles.length > 0 ? (
          <div className="space-y-3">
            {profiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={toProfileRecord(profile)}
                isActive={profile.isActive}
                onSelect={makeActive}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-slate-500 mb-2">No profiles yet</p>
            <button
              onClick={() => chrome.runtime.openOptionsPage()}
              className="
                text-sm font-medium text-peach
                hover:text-peach-dark
                transition-colors duration-base
              "
            >
              Import your resume to get started →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
