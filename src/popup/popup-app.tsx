import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import type { ProfileIndexItem } from "../ui-shared/messaging";
import { sendMessage } from "../ui-shared/runtime";
import { ProfileCard } from "./components/ProfileCard";
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
    <div className="min-w-80 max-w-96 bg-white rounded-xl shadow-xl overflow-hidden relative">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold bg-gradient-to-r from-peach to-mint bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(255,180,180,0.3)]">
          JobSnap
        </h1>

        {/* Floating Settings Button */}
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="
            p-2.5 rounded-full
            bg-white border-2 border-peach/30
            shadow-md
            transition-all duration-base
            hover:scale-110 hover:shadow-lg hover:border-peach/50 hover:shadow-peach/20
            active:scale-95
            focus:outline-none focus:ring-2 focus:ring-peach/50 focus:ring-offset-2
            group
          "
          aria-label="Open settings"
        >
          <Settings className="h-5 w-5 text-slate-700 transition-transform duration-500 group-hover:rotate-90" />
        </button>
      </div>

      <div className="p-4 pt-2">
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
