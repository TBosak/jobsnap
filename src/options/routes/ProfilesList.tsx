import type { ReactNode } from "react";
import { useEffect, useState, useMemo } from "react";
import { Download, Pencil, Star, Trash2, Linkedin, Loader2, Search, X } from "lucide-react";
import type { ProfileIndexItem } from "../../ui-shared/messaging";
import type { ProfileRecord } from "../../ui-shared/schema";
import { sendMessage } from "../../ui-shared/runtime";

interface Props {
  onEditProfile?: (id: string) => void;
  refreshKey?: number;
  onProfileRemoved?: (id: string) => void;
}

export function ProfilesList({ onEditProfile, refreshKey = 0, onProfileRemoved }: Props) {
  const [profiles, setProfiles] = useState<ProfileIndexItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLinkedInWarning, setShowLinkedInWarning] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (refreshKey === 0) return;
    refresh();
  }, [refreshKey]);

  async function refresh() {
    try {
      const data = await sendMessage<ProfileIndexItem[]>({ type: "LIST_PROFILE_INDEX" });
      setProfiles(data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function exportProfile(id: string, name: string) {
    try {
      setError(null);
      const profile = await sendMessage<ProfileRecord>({ type: "GET_PROFILE", id });
      if (!profile) {
        throw new Error("Profile not found");
      }
      const payload = JSON.stringify(profile.resume, null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = toFileName(name);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to export profile");
    }
  }

  async function removeProfile(id: string) {
    try {
      setError(null);
      await sendMessage({ type: "DELETE_PROFILE", id });
      refresh();
      onProfileRemoved?.(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove profile");
    }
  }

  async function checkLinkedInTabAndImport() {
    try {
      // Check if there's a LinkedIn profile tab open
      const tabs = await chrome.tabs.query({});
      const hasLinkedInProfile = tabs.some(tab =>
        tab.url?.includes('linkedin.com/in/')
      );

      if (!hasLinkedInProfile) {
        // Show warning modal if no LinkedIn profile tab is open
        setShowLinkedInWarning(true);
        return;
      }

      // Proceed with import if LinkedIn profile is open
      await importFromLinkedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function importFromLinkedIn() {
    try {
      setError(null);
      setIsImporting(true);

      // Send a message to the background script to handle LinkedIn import
      const result = await sendMessage<any>({ type: "IMPORT_FROM_LINKEDIN" });

      if (!result) {
        setError("Could not extract profile data from LinkedIn. Please ensure you're on a LinkedIn profile page and try again.");
        return;
      }

      // Refresh the profiles list
      await refresh();

    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImporting(false);
    }
  }

  // Filter profiles based on search query
  const filteredProfiles = useMemo(() => {
    if (!searchQuery.trim()) return profiles;
    const query = searchQuery.toLowerCase();
    return profiles.filter((profile) =>
      profile.name.toLowerCase().includes(query)
    );
  }, [profiles, searchQuery]);

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Profiles
          </h2>
          <button
            type="button"
            onClick={checkLinkedInTabAndImport}
            disabled={isImporting}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:shadow-lg hover:shadow-indigo-300 hover:from-blue-700 hover:to-indigo-700 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:scale-100"
          >
            {isImporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Linkedin size={16} />
                Import from LinkedIn
              </>
            )}
          </button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search profiles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Clear search"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {filteredProfiles.length === 0 && searchQuery && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search size={48} className="text-slate-300 mb-3" />
          <h3 className="text-base font-semibold text-slate-700 mb-1">No profiles found</h3>
          <p className="text-sm text-slate-500">Try adjusting your search query</p>
        </div>
      )}

      {filteredProfiles.length === 0 && !searchQuery && profiles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 p-4 mb-4">
            <Star size={32} className="text-indigo-600" />
          </div>
          <h3 className="text-base font-semibold text-slate-700 mb-2">No profiles yet</h3>
          <p className="text-sm text-slate-500 mb-4">Get started by creating your first profile or importing from LinkedIn</p>
        </div>
      )}

      <ul className="space-y-3">
        {filteredProfiles.map((profile) => (
          <li key={profile.id} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-lg hover:shadow-indigo-100 hover:border-indigo-300">
            {/* Gradient accent bar */}
            <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-indigo-500 to-purple-500 opacity-0 transition-opacity group-hover:opacity-100" />

            {/* Subtle gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/50 via-purple-50/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

            <div className="relative flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-slate-800 truncate">{profile.name}</p>
                  {profile.isActive && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      <Star size={12} fill="currentColor" />
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">Updated {new Date(profile.updatedAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <IconButton
                  label={profile.isActive ? "Active profile" : "Set active"}
                  tone={profile.isActive ? "primary" : "muted"}
                  onClick={() =>
                    sendMessage({ type: "SET_ACTIVE_PROFILE", id: profile.id })
                      .then(refresh)
                      .catch((err) =>
                        setError(err instanceof Error ? err.message : String(err))
                      )
                  }
                  icon={
                    <Star
                      size={16}
                      className={profile.isActive ? "text-indigo-600" : "text-slate-400"}
                      fill={profile.isActive ? "currentColor" : "none"}
                    />
                  }
                />
                <IconButton
                  label="Export resume JSON"
                  tone="neutral"
                  onClick={() => exportProfile(profile.id, profile.name)}
                  icon={<Download className="text-slate-500" size={16} />}
                />
                <IconButton
                  label="Edit profile"
                  tone="neutral"
                  onClick={() => onEditProfile?.(profile.id)}
                  icon={<Pencil className="text-slate-500" size={16} />}
                />
                <IconButton
                  label="Remove profile"
                  tone="danger"
                  onClick={() => removeProfile(profile.id)}
                  icon={<Trash2 className="text-red-500" size={16} />}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* LinkedIn Warning Modal */}
      {showLinkedInWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md mx-4 border-2 border-peach/30">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">
                  LinkedIn Profile Not Detected
                </h3>
                <p className="text-sm text-slate-600 mb-3">
                  No LinkedIn profile page is currently open in your browser. Import functionality will be limited without an active LinkedIn profile tab.
                </p>
                <p className="text-sm text-slate-600">
                  For best results, open your LinkedIn profile page (linkedin.com/in/your-profile) in a tab before importing.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLinkedInWarning(false)}
                className="px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-700 font-medium text-sm transition-all hover:bg-slate-50 hover:border-slate-300 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLinkedInWarning(false);
                  importFromLinkedIn();
                }}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium text-sm shadow-md transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface IconButtonProps {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  tone: "primary" | "muted" | "neutral" | "danger";
}

function IconButton({ label, icon, onClick, tone }: IconButtonProps) {
  const base = "inline-flex items-center justify-center rounded-full border p-2 transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 hover:scale-110 active:scale-95";
  const palette = {
    primary: "border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-600 hover:from-indigo-100 hover:to-purple-100 hover:border-indigo-400 hover:shadow-md hover:shadow-indigo-100 focus:ring-indigo-500",
    muted: "border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-500 focus:ring-slate-400",
    neutral: "border-slate-200 bg-white text-slate-500 hover:bg-gradient-to-br hover:from-indigo-50/50 hover:to-purple-50/50 hover:border-indigo-200 hover:text-indigo-600 focus:ring-indigo-400",
    danger: "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 hover:shadow-md hover:shadow-red-100 focus:ring-red-500"
  } as const;

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`${base} ${palette[tone]}`}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

function toFileName(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `resume-${normalized || "profile"}.json`;
}
