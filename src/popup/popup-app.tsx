import { useEffect, useState } from "react";
import type { ProfileIndexItem } from "../ui-shared/messaging";
import { sendMessage } from "../ui-shared/runtime";

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

  return (
    <div className="min-w-72 max-w-96 p-4 text-slate-900">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">JobSnap</h1>
        <button
          className="rounded-full bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          Manage
        </button>
      </header>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <ul className="space-y-2">
        {profiles.map((profile) => (
          <li key={profile.id} className="rounded border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{profile.name}</span>
              {profile.isActive ? (
                <span className="text-xs font-semibold uppercase text-blue-600">Active</span>
              ) : (
                <button
                  className="text-xs font-semibold uppercase text-blue-600"
                  onClick={() => makeActive(profile.id)}
                >
                  Set active
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">Updated {new Date(profile.updatedAt).toLocaleString()}</p>
          </li>
        ))}
        {!profiles.length && <p className="text-sm text-slate-500">No profiles yet. Import your resume from the options page.</p>}
      </ul>
    </div>
  );
}
