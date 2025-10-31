import { useState } from "react";
import { Users, Folder, Clock, FileText } from "lucide-react";
import "../ui-shared/mascot-animations.css";
import { Onboarding } from "./routes/Onboarding";
import { ProfilesList } from "./routes/ProfilesList";
import { CollectionsPanel } from "./routes/Collections";
import { HistoryPanel } from "./routes/History";
import { ResumeExport } from "./routes/ResumeExport";
import type { ProfileRecord } from "../ui-shared/schema";
import { sendMessage } from "../ui-shared/runtime";

const LOGO_URL = "/fullsize.png";

type View = "profiles" | "collections" | "history" | "export";

export function OptionsApp() {
  const [view, setView] = useState<View>("profiles");
  const [editingProfile, setEditingProfile] = useState<ProfileRecord | null>(null);
  const [importingToProfile, setImportingToProfile] = useState<ProfileRecord | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [profilesRefreshKey, setProfilesRefreshKey] = useState(0);

  async function handleEditProfile(id: string) {
    setEditError(null);
    setImportingToProfile(null); // Clear import mode
    try {
      const profile = await sendMessage<ProfileRecord>({ type: "GET_PROFILE", id });
      setEditingProfile(profile);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setEditError(`Unable to load profile: ${message}`);
    }
  }

  async function handleImportToProfile(id: string) {
    setEditError(null);
    setEditingProfile(null); // Clear edit mode
    try {
      const profile = await sendMessage<ProfileRecord>({ type: "GET_PROFILE", id });
      setImportingToProfile(profile);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setEditError(`Unable to load profile: ${message}`);
    }
  }

  function handleProfileSaved() {
    setProfilesRefreshKey((key) => key + 1);
    setEditingProfile(null);
    setImportingToProfile(null);
    setEditError(null);
  }

  function handleCancelEdit() {
    setEditingProfile(null);
    setImportingToProfile(null);
    setEditError(null);
  }

  function handleProfileRemoved(id: string) {
    if (editingProfile?.id === id) {
      setEditingProfile(null);
    }
    if (importingToProfile?.id === id) {
      setImportingToProfile(null);
    }
    setProfilesRefreshKey((key) => key + 1);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-peach/30 via-white to-mint/30 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6">
        <header className="rounded-xl border border-slate-100 bg-white/90 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img
                src={LOGO_URL}
                alt="JobSnap"
                className="h-[10em] mascot-hover mascot-clickable cursor-pointer"
                onClick={(e) => {
                  e.currentTarget.classList.add('mascot-spin');
                  setTimeout(() => e.currentTarget.classList.remove('mascot-spin'), 1000);
                }}
              />
              <div>
                <h1 className="text-3xl font-semibold tracking-tight drop-shadow-[0_2px_8px_rgba(181,231,221,0.4)]">
                  <span className="bg-gradient-to-r from-[#FFB5B5] via-[#D4C5F9] to-[#B5E7DD] bg-clip-text text-transparent drop-shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
                    JobSnap
                  </span>
                </h1>
                <p className="text-sm text-slate-500">
                  Your AI-powered career co-pilot that revolutionizes job hunting with intelligent autofill, skill gap analysis, and seamless application tracking.
                </p>
              </div>
            </div>
            {editError && <p className="rounded-full bg-red-50 px-4 py-2 text-sm font-medium text-red-600">{editError}</p>}
          </div>
        </header>
        <nav className="flex items-center gap-3">
          <NavButton icon={Users} label="Profiles" active={view === "profiles"} onClick={() => setView("profiles")} />
          <NavButton icon={Folder} label="Collections" active={view === "collections"} onClick={() => setView("collections")} />
          <NavButton icon={Clock} label="History" active={view === "history"} onClick={() => setView("history")} />
          <NavButton icon={FileText} label="Resumes" active={view === "export"} onClick={() => setView("export")} />
        </nav>
        <main className="rounded-2xl border border-peach/20 bg-white/95 p-5 shadow-lg backdrop-blur">
          {view === "profiles" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <section className="rounded-xl bg-white/60 p-6 shadow-md border border-slate-100 transition-all duration-base hover:shadow-lg">
                <Onboarding
                  onProfileSaved={handleProfileSaved}
                  initialProfile={editingProfile}
                  importingProfile={importingToProfile}
                  onEditCancel={handleCancelEdit}
                />
              </section>
              <section className="rounded-xl bg-white/60 p-6 shadow-md border border-slate-100 transition-all duration-base hover:shadow-lg">
                <ProfilesList
                  onEditProfile={handleEditProfile}
                  onImportToProfile={handleImportToProfile}
                  refreshKey={profilesRefreshKey}
                  onProfileRemoved={handleProfileRemoved}
                  importingProfileId={importingToProfile?.id ?? null}
                />
              </section>
            </div>
          )}
          {view === "export" && <ResumeExport />}
          {view === "collections" && <CollectionsPanel />}
          {view === "history" && <HistoryPanel />}
        </main>
      </div>
    </div>
  );
}

interface NavButtonProps {
  icon: typeof Users;
  label: string;
  active?: boolean;
  onClick: () => void;
}

function NavButton({ icon: Icon, label, active, onClick }: NavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-base focus:outline-none focus:ring-2 focus:ring-lavender/30 focus:ring-offset-1 hover:scale-105 active:scale-95 ${
        active
          ? "border-peach bg-white text-slate-800 shadow-glow-active"
          : "border-slate-200 bg-white text-slate-500 hover:border-mint hover:text-slate-700 hover:shadow-md"
      }`}
    >
      <Icon size={18} />
      {label}
    </button>
  );
}
