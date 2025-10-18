import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { parseResume } from "../../parsing";
import { computeProfileSkills } from "../../analysis/skills";
import type {
  JsonResume,
  JsonResumeCertificate,
  JsonResumeEducation,
  JsonResumeLanguage,
  JsonResumeProject,
  JsonResumeSkill,
  JsonResumeWork,
  JsonResumeVolunteer,
  JsonResumeAward,
  JsonResumePublication,
  JsonResumeInterest,
  JsonResumeReference,
  ProfileRecord
} from "../../ui-shared/schema";
import { sendMessage } from "../../ui-shared/runtime";
import {
  Award,
  BookOpen,
  Braces,
  Briefcase,
  ClipboardList,
  Copy,
  FileJson,
  Globe,
  GraduationCap,
  Heart,
  Layers,
  Medal,
  Plus,
  Save,
  Sparkles,
  Trash2,
  User,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  onProfileSaved?: () => void;
  initialProfile?: ProfileRecord | null;
  onEditCancel?: () => void;
}

type TabId =
  | "basics"
  | "work"
  | "volunteer"
  | "education"
  | "skills"
  | "projects"
  | "awards"
  | "certificates"
  | "publications"
  | "languages"
  | "interests"
  | "references"
  | "raw";

const TABS: Array<{ id: TabId; label: string; icon: LucideIcon }> = [
  { id: "basics", label: "Basics", icon: User },
  { id: "work", label: "Experience", icon: Briefcase },
  { id: "volunteer", label: "Volunteer", icon: Users },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "skills", label: "Skills", icon: Sparkles },
  { id: "projects", label: "Projects", icon: Layers },
  { id: "awards", label: "Awards", icon: Medal },
  { id: "certificates", label: "Certificates", icon: Award },
  { id: "publications", label: "Publications", icon: BookOpen },
  { id: "languages", label: "Languages", icon: Globe },
  { id: "interests", label: "Interests", icon: Heart },
  { id: "references", label: "References", icon: ClipboardList },
  { id: "raw", label: "Raw", icon: Braces }
];

export function Onboarding({ onProfileSaved, initialProfile, onEditCancel }: Props) {
  const [status, setStatus] = useState<"idle" | "parsing" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string>("");
  const [resume, setResume] = useState<JsonResume | null>(null);
  const [profileName, setProfileName] = useState<string>("New Profile");
  const [parser, setParser] = useState<string>("unknown");
  const [activeTab, setActiveTab] = useState<TabId>("basics");
  const [rawDraft, setRawDraft] = useState<string>("");
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const previousProfileId = useRef<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">("idle");
  const DEFAULT_JSON_SAMPLE = `{
  "basics": {
    "name": "",
    "label": ""
  }
}`;
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonModalValue, setJsonModalValue] = useState(DEFAULT_JSON_SAMPLE);

  const isReady = status === "ready" && !!resume;

  const skillsList = useMemo(() => resume?.skills ?? [], [resume]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus("parsing");
    setError(null);
    try {
      const result = await parseResume(file);
      setResume(result.resume);
      setRawText(result.rawText);
      setRawDraft(JSON.stringify(result.resume, null, 2));
      setParser(result.meta.parser);
      if (result.resume.basics?.name) {
        setProfileName(result.resume.basics.name);
      }
      setActiveTab("basics");
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    setCopyStatus("idle");
  }, [rawDraft]);

  async function handleCopyRaw() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(rawDraft);
      } else {
        throw new Error("Clipboard API unavailable");
      }
      setCopyStatus("success");
    } catch (err) {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = rawDraft;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!successful) {
          throw new Error("Copy command failed");
        }
        setCopyStatus("success");
      } catch (fallbackError) {
        console.error("JobSnap copy failed", fallbackError);
        setCopyStatus("error");
      }
    } finally {
      setTimeout(() => setCopyStatus("idle"), 2000);
    }
  }

  const importJsonString = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      if (!isJsonResume(parsed)) {
        throw new Error("Invalid JSON Resume structure");
      }
      setResume(parsed);
      setRawDraft(JSON.stringify(parsed, null, 2));
      setRawText("");
      setParser("json-import");
      if (parsed.basics?.name) {
        setProfileName(parsed.basics.name);
      }
      setActiveTab("basics");
      setStatus("ready");
      setError(null);
      setShowJsonModal(false);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unable to import JSON Resume");
    }
  };

  const importJsonFile = async (file: File) => {
    try {
      const text = await file.text();
      importJsonString(text);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unable to import JSON Resume");
    }
  };


  function updateResume(updater: (current: JsonResume) => JsonResume) {
    setResume((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      setRawDraft(JSON.stringify(next, null, 2));
      return next;
    });
  }

  async function handleSave() {
    if (!resume) return;
    try {
      const timestamp = new Date().toISOString();
      const computedSkills = await computeProfileSkills(resume);
      await sendMessage({
        type: "UPSERT_PROFILE",
        profile: {
          id: currentProfileId ?? undefined,
          name: profileName,
          resume,
          updatedAt: timestamp,
          computedSkills,
          computedAt: timestamp
        }
      });
      onProfileSaved?.();
      resetState();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }

  function resetState() {
    setStatus("idle");
    setError(null);
    setRawText("");
    setResume(null);
    setProfileName("New Profile");
    setParser("unknown");
    setActiveTab("basics");
    setRawDraft("");
    setCurrentProfileId(null);
    previousProfileId.current = null;
  }

  useEffect(() => {
    if (initialProfile) {
      setStatus("ready");
      setError(null);
      setResume(initialProfile.resume);
      setProfileName(initialProfile.name);
      setParser("manual-edit");
      setRawDraft(JSON.stringify(initialProfile.resume, null, 2));
      setRawText("");
      setActiveTab("basics");
      setCurrentProfileId(initialProfile.id);
    } else if (previousProfileId.current) {
      resetState();
    }
    previousProfileId.current = initialProfile?.id ?? null;
  }, [initialProfile]);

  const isEditing = Boolean(currentProfileId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{isEditing ? "Edit profile" : "Import your resume"}</h2>
          <p className="text-sm text-slate-500">
            {isEditing
              ? "Update fields directly or drop a new resume to refresh this profile."
              : "Drop a PDF/DOCX or import a JSON Resume, review the parsed fields, and save your profile."}
          </p>
        </div>
        {isEditing && (
          <button
            className="text-sm font-semibold text-blue-600"
            type="button"
            onClick={() => {
              resetState();
              onEditCancel?.();
            }}
          >
            Exit editing
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex h-32 flex-1 min-w-[220px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100">
          <input
            type="file"
            accept=".pdf,.doc,.docx,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.type === "application/json" || file.name.toLowerCase().endsWith(".json")) {
                importJsonFile(file);
                event.target.value = "";
                return;
              }
              handleFileChange(event);
            }}
          />
          {status === "parsing" ? "Parsing resume…" : "Upload resume (PDF/DOCX/JSON)"}
        </label>
        <IconBadgeButton
          label="Paste JSON Resume"
          icon={<FileJson size={18} />}
          tone="accent"
          onClick={() => setShowJsonModal(true)}
        />
      </div>
      {isReady && resume && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-indigo-100 bg-indigo-50/70 p-3 text-xs text-indigo-600">
            <div className="flex flex-wrap items-center gap-3">
              <span className="uppercase">Parser: {parser}</span>
              <span className="rounded bg-white px-2 py-1">Fields captured: {Object.keys(resume).length}</span>
            </div>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Profile name</span>
            <input
              className="rounded border border-slate-200 px-3 py-2"
              value={profileName}
              onChange={(event) => setProfileName(event.currentTarget.value)}
            />
          </label>
          <div className="flex gap-4">
            <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
            <div className="flex-1 rounded border border-slate-200 p-4">
              {renderTabContent(
                activeTab,
                resume,
                rawText,
                rawDraft,
                setRawDraft,
                setError,
                updateResume,
                skillsList,
                handleCopyRaw,
                copyStatus
              )}
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            {isEditing && (
              <span className="text-xs text-slate-500">Saving will update this profile.</span>
            )}
            <IconBadgeButton
              label="Save profile"
              icon={<Save size={18} />}
              tone="accent"
              onClick={handleSave}
            />
          </div>
        </div>
      )}
      {status === "error" && error && <p className="text-sm text-red-600">{error}</p>}

      {showJsonModal && (
        <JsonImportDialog
          initialValue={jsonModalValue}
          onCancel={() => setShowJsonModal(false)}
          onSubmit={(value) => {
            setJsonModalValue(value);
            importJsonString(value);
          }}
        />
      )}
    </div>
  );
}

function Tabs({ activeTab, onTabChange }: { activeTab: TabId; onTabChange: (tab: TabId) => void }) {
  return (
    <div className="flex w-16 flex-col gap-3">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === activeTab;
        const base = "flex h-11 w-11 items-center justify-center rounded-full border transition focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:ring-offset-1";
        const palette = isActive
          ? "border-indigo-500 bg-indigo-600 text-white shadow"
          : "border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-500";
        return (
          <button
            key={tab.id}
            type="button"
            title={tab.label}
            aria-label={tab.label}
            className={`${base} ${palette}`}
            onClick={() => onTabChange(tab.id)}
          >
            <Icon size={18} />
          </button>
        );
      })}
    </div>
  );
}

function renderTabContent(
  tab: TabId,
  resume: JsonResume,
  rawText: string,
  rawDraft: string,
  setRawDraft: (value: string) => void,
  setError: (value: string | null) => void,
  updateResume: (updater: (current: JsonResume) => JsonResume) => void,
  skillsList: JsonResumeSkill[],
  handleCopyRaw: () => void,
  copyStatus: "idle" | "success" | "error"
) {
  switch (tab) {
    case "basics":
      return <BasicsForm resume={resume} updateResume={updateResume} />;
    case "work":
      return <WorkForm resume={resume} updateResume={updateResume} />;
    case "volunteer":
      return <VolunteerForm resume={resume} updateResume={updateResume} />;
    case "education":
      return <EducationForm resume={resume} updateResume={updateResume} />;
    case "skills":
      return <SkillsForm skills={skillsList} updateResume={updateResume} />;
    case "projects":
      return <ProjectsForm resume={resume} updateResume={updateResume} />;
    case "awards":
      return <AwardsForm resume={resume} updateResume={updateResume} />;
    case "certificates":
      return <CertificatesForm resume={resume} updateResume={updateResume} />;
    case "publications":
      return <PublicationsForm resume={resume} updateResume={updateResume} />;
    case "languages":
      return <LanguagesForm resume={resume} updateResume={updateResume} />;
    case "interests":
      return <InterestsForm resume={resume} updateResume={updateResume} />;
    case "references":
      return <ReferencesForm resume={resume} updateResume={updateResume} />;
    case "raw":
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Parsed JSON Resume</span>
            <div className="flex items-center gap-2">
              <IconBadgeButton
                label="Copy JSON"
                icon={<Copy size={16} />}
                tone="neutral"
                onClick={handleCopyRaw}
              />
              {copyStatus === "success" && <span className="text-xs text-emerald-600">Copied!</span>}
              {copyStatus === "error" && <span className="text-xs text-red-600">Copy failed</span>}
            </div>
          </div>
          <textarea
            aria-label="Parsed JSON Resume"
            className="h-64 w-full rounded border border-slate-200 bg-slate-900/5 px-3 py-2 font-mono text-xs"
            value={rawDraft}
            onChange={(event) => setRawDraft(event.currentTarget.value)}
            onBlur={() => {
              try {
                const parsed = JSON.parse(rawDraft) as JsonResume;
                updateResume(() => parsed);
                setError(null);
              } catch (err) {
                setError("Invalid JSON – changes not applied");
              }
            }}
          />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Raw extracted text</span>
            <textarea className="h-40 rounded border border-slate-200 px-3 py-2 text-xs" value={rawText} readOnly />
          </label>
        </div>
      );
    default:
      return null;
  }
}

function BasicsForm({ resume, updateResume }: { resume: JsonResume; updateResume: (fn: (current: JsonResume) => JsonResume) => void }) {
  const basics = resume.basics ?? {};
  const location = basics.location ?? {};
  const profiles = basics.profiles ?? [];

  function handleChange(field: keyof typeof basics, value: string) {
    updateResume((current) => ({
      ...current,
      basics: {
        ...(current.basics ?? {}),
        [field]: value
      }
    }));
  }

  function handleLocation(field: keyof typeof location, value: string) {
    updateResume((current) => ({
      ...current,
      basics: {
        ...(current.basics ?? {}),
        location: {
          ...(current.basics?.location ?? {}),
          [field]: value
        }
      }
    }));
  }

  function handleProfileChange(index: number, field: "network" | "username" | "url", value: string) {
    updateResume((current) => {
      const list = [...(current.basics?.profiles ?? [])];
      list[index] = { ...list[index], [field]: value };
      return {
        ...current,
        basics: {
          ...(current.basics ?? {}),
          profiles: list
        }
      };
    });
  }

  function addProfile() {
    updateResume((current) => ({
      ...current,
      basics: {
        ...(current.basics ?? {}),
        profiles: [...(current.basics?.profiles ?? []), { network: "", url: "" }]
      }
    }));
  }

  function removeProfile(index: number) {
    updateResume((current) => {
      const next = (current.basics?.profiles ?? []).filter((_, idx) => idx !== index);
      return {
        ...current,
        basics: {
          ...(current.basics ?? {}),
          profiles: next.length ? next : undefined
        }
      };
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Full name">
        <input
          value={basics.name ?? ""}
          onChange={(event) => handleChange("name", event.currentTarget.value)}
          className="w-full rounded border border-slate-200 px-3 py-2"
        />
      </Field>
      <Field label="Headline / Title">
        <input
          value={basics.label ?? ""}
          onChange={(event) => handleChange("label", event.currentTarget.value)}
          className="w-full rounded border border-slate-200 px-3 py-2"
        />
      </Field>
      <Field label="Email">
        <input
          value={basics.email ?? ""}
          onChange={(event) => handleChange("email", event.currentTarget.value)}
          className="w-full rounded border border-slate-200 px-3 py-2"
        />
      </Field>
      <Field label="Phone">
        <input
          value={basics.phone ?? ""}
          onChange={(event) => handleChange("phone", event.currentTarget.value)}
          className="w-full rounded border border-slate-200 px-3 py-2"
        />
      </Field>
      <Field label="Website">
        <input
          value={basics.url ?? ""}
          onChange={(event) => handleChange("url", event.currentTarget.value)}
          className="w-full rounded border border-slate-200 px-3 py-2"
        />
      </Field>
      <Field label="Image / Avatar URL">
        <input
          value={basics.image ?? ""}
          onChange={(event) => handleChange("image", event.currentTarget.value)}
          className="w-full rounded border border-slate-200 px-3 py-2"
        />
      </Field>
      <Field label="Summary" className="md:col-span-2">
        <textarea
          value={basics.summary ?? ""}
          onChange={(event) => handleChange("summary", event.currentTarget.value)}
          className="h-32 w-full rounded border border-slate-200 px-3 py-2"
        />
      </Field>

      <div className="md:col-span-2">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Location</h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Address">
            <input
              value={location.address ?? ""}
              onChange={(event) => handleLocation("address", event.currentTarget.value)}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <Field label="City">
            <input
              value={location.city ?? ""}
              onChange={(event) => handleLocation("city", event.currentTarget.value)}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <Field label="Region / State">
            <input
              value={location.region ?? ""}
              onChange={(event) => handleLocation("region", event.currentTarget.value)}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <Field label="Postal code">
            <input
              value={location.postalCode ?? ""}
              onChange={(event) => handleLocation("postalCode", event.currentTarget.value)}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <Field label="Country code">
            <input
              value={location.countryCode ?? ""}
              onChange={(event) => handleLocation("countryCode", event.currentTarget.value)}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
        </div>
      </div>

      <div className="md:col-span-2">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Profiles & links</h3>
          <IconBadgeButton label="Add profile link" icon={<Plus size={16} />} tone="accent" onClick={addProfile} />
        </div>
        <div className="space-y-3">
          {profiles.map((profile, index) => (
            <div key={index} className="rounded border border-slate-200 p-3">
              <div className="mb-2 flex justify-end">
                <IconBadgeButton
                  label="Remove profile link"
                  icon={<Trash2 size={15} />}
                  tone="danger"
                  onClick={() => removeProfile(index)}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Network">
                  <input
                    value={profile.network ?? ""}
                    onChange={(event) => handleProfileChange(index, "network", event.currentTarget.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2"
                  />
                </Field>
                <Field label="Username">
                  <input
                    value={profile.username ?? ""}
                    onChange={(event) => handleProfileChange(index, "username", event.currentTarget.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2"
                  />
                </Field>
                <Field label="URL">
                  <input
                    value={profile.url ?? ""}
                    onChange={(event) => handleProfileChange(index, "url", event.currentTarget.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2"
                  />
                </Field>
              </div>
            </div>
          ))}
          {!profiles.length && <p className="text-sm text-slate-500">No social profiles detected. Add links you want to keep handy.</p>}
        </div>
      </div>
    </div>
  );
}

function WorkForm({ resume, updateResume }: { resume: JsonResume; updateResume: (fn: (current: JsonResume) => JsonResume) => void }) {
  const work = resume.work ?? [];

  function updateWork(index: number, updater: (item: JsonResumeWork) => JsonResumeWork) {
    updateResume((current) => {
      const next = [...(current.work ?? [])];
      const existing = next[index] ?? ({} as JsonResumeWork);
      next[index] = updater(existing);
      return { ...current, work: next };
    });
  }

  function removeWork(index: number) {
    updateResume((current) => {
      const next = (current.work ?? []).filter((_, idx) => idx !== index);
      return { ...current, work: next.length ? next : undefined };
    });
  }

  function addWork() {
    updateResume((current) => ({
      ...current,
      work: [
        ...(current.work ?? []),
        {
          name: "",
          position: "",
          startDate: "",
          endDate: "",
          summary: "",
          highlights: []
        }
      ]
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Experience</h3>
        <IconBadgeButton label="Add role" icon={<Plus size={16} />} tone="accent" onClick={addWork} />
      </div>
      {work.map((item, index) => (
        <div key={index} className="space-y-3 rounded border border-slate-200 p-4">
          <div className="flex justify-end">
            <IconBadgeButton
              label="Remove role"
              icon={<Trash2 size={15} />}
              tone="danger"
              onClick={() => removeWork(index)}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Company">
              <input
                value={item.name ?? ""}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  updateWork(index, (current) => ({ ...current, name: value }));
                }}
                className="w-full rounded border border-slate-200 px-3 py-2"
              />
            </Field>
            <Field label="Role / Title">
              <input
                value={item.position ?? ""}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  updateWork(index, (current) => ({ ...current, position: value }));
                }}
                className="w-full rounded border border-slate-200 px-3 py-2"
              />
            </Field>
            <Field label="Location">
              <input
                value={item.location ?? ""}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  updateWork(index, (current) => ({ ...current, location: value }));
                }}
                className="w-full rounded border border-slate-200 px-3 py-2"
              />
            </Field>
            <Field label="Company URL">
              <input
                value={item.url ?? ""}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  updateWork(index, (current) => ({ ...current, url: value }));
                }}
                className="w-full rounded border border-slate-200 px-3 py-2"
              />
            </Field>
          <DateRangeField
            startLabel="Start date"
            endLabel="End date"
            startValue={item.startDate ?? ""}
            endValue={item.endDate ?? ""}
            allowOngoing
            onChange={(range) =>
              updateWork(index, (current) => ({ ...current, startDate: range.start, endDate: range.end }))
            }
          />
          </div>
          <Field label="Summary">
            <textarea
              value={item.summary ?? ""}
              onChange={(event) => {
                const value = event.currentTarget.value;
                updateWork(index, (current) => ({ ...current, summary: value }));
              }}
              className="h-24 w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <Field label="Highlights (one per line)">
            <textarea
              value={(item.highlights ?? []).join("\n")}
              onChange={(event) => {
                const value = event.currentTarget.value;
                updateWork(index, (current) => ({
                  ...current,
                  highlights: value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                }));
              }}
              className="h-32 w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
        </div>
      ))}
      {!work.length && <p className="text-sm text-slate-500">No experience detected yet. Add your roles to build the autofill profile.</p>}
    </div>
  );
}

function EducationForm({ resume, updateResume }: { resume: JsonResume; updateResume: (fn: (current: JsonResume) => JsonResume) => void }) {
  const education = resume.education ?? [];

  function updateEducation(index: number, updater: (item: JsonResumeEducation) => JsonResumeEducation) {
    updateResume((current) => {
      const next = [...(current.education ?? [])];
      next[index] = updater(next[index] ?? ({} as JsonResumeEducation));
      return { ...current, education: next };
    });
  }

  function removeEducation(index: number) {
    updateResume((current) => {
      const next = (current.education ?? []).filter((_, idx) => idx !== index);
      return { ...current, education: next.length ? next : undefined };
    });
  }

  function addEducation() {
    updateResume((current) => ({
      ...current,
      education: [
        ...(current.education ?? []),
        {
          institution: "",
          area: "",
          studyType: "",
          startDate: "",
          endDate: "",
          score: "",
          courses: [],
          url: ""
        }
      ]
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Education</h3>
        <IconBadgeButton label="Add education" icon={<Plus size={16} />} tone="accent" onClick={addEducation} />
      </div>
      {education.map((item, index) => (
        <div key={index} className="space-y-3 rounded border border-slate-200 p-4">
          <div className="flex justify-end">
            <IconBadgeButton
              label="Remove education entry"
              icon={<Trash2 size={15} />}
              tone="danger"
              onClick={() => removeEducation(index)}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Institution">
              <input
                value={item.institution ?? ""}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  updateEducation(index, (current) => ({ ...current, institution: value }));
                }}
                className="w-full rounded border border-slate-200 px-3 py-2"
              />
            </Field>
            <Field label="Degree / Study type">
              <input
                value={item.studyType ?? ""}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  updateEducation(index, (current) => ({ ...current, studyType: value }));
                }}
                className="w-full rounded border border-slate-200 px-3 py-2"
              />
            </Field>
            <Field label="Field / Major">
              <input
                value={item.area ?? ""}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  updateEducation(index, (current) => ({ ...current, area: value }));
                }}
                className="w-full rounded border border-slate-200 px-3 py-2"
              />
            </Field>
            <Field label="Institution URL">
              <input
                value={item.url ?? ""}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  updateEducation(index, (current) => ({ ...current, url: value }));
                }}
                className="w-full rounded border border-slate-200 px-3 py-2"
              />
            </Field>
            <Field label="GPA / Score">
              <input
                value={item.score ?? ""}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  updateEducation(index, (current) => ({ ...current, score: value }));
                }}
                className="w-full rounded border border-slate-200 px-3 py-2"
              />
            </Field>
            <DateRangeField
              startLabel="Start date"
              endLabel="End date"
              startValue={item.startDate ?? ""}
              endValue={item.endDate ?? ""}
              allowOngoing
              onChange={(range) =>
                updateEducation(index, (current) => ({ ...current, startDate: range.start, endDate: range.end }))
              }
            />
          </div>
          <Field label="Key courses (comma separated)">
            <input
              value={(item.courses ?? []).join(", ")}
              onChange={(event) => {
                const value = event.currentTarget.value;
                updateEducation(index, (current) => ({
                  ...current,
                  courses: value
                    .split(/,/) // split on commas
                    .map((token) => token.trim())
                    .filter(Boolean)
                }));
              }}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
        </div>
      ))}
      {!education.length && <p className="text-sm text-slate-500">Add schools to populate education fields during autofill.</p>}
    </div>
  );
}

function SkillsForm({ skills, updateResume }: { skills: JsonResumeSkill[]; updateResume: (fn: (current: JsonResume) => JsonResume) => void }) {
  function updateSkill(index: number, updater: (skill: JsonResumeSkill) => JsonResumeSkill) {
    updateResume((current) => {
      const next = [...(current.skills ?? [])];
      next[index] = updater(next[index] ?? ({ name: "" } as JsonResumeSkill));
      return { ...current, skills: next };
    });
  }

  function removeSkill(index: number) {
    updateResume((current) => {
      const next = (current.skills ?? []).filter((_, idx) => idx !== index);
      return { ...current, skills: next.length ? next : undefined };
    });
  }

  function addSkill() {
    updateResume((current) => ({
      ...current,
      skills: [...(current.skills ?? []), { name: "", keywords: [] }]
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Skills</h3>
        <IconBadgeButton label="Add skill" icon={<Plus size={16} />} tone="accent" onClick={addSkill} />
      </div>
      {skills.map((skill, index) => (
        <div key={index} className="space-y-3 rounded border border-slate-200 p-4">
          <div className="flex justify-end">
            <IconBadgeButton
              label="Remove skill"
              icon={<Trash2 size={15} />}
              tone="danger"
              onClick={() => removeSkill(index)}
            />
          </div>
          <Field label="Skill name">
            <input
              value={skill.name}
              onChange={(event) => {
                const value = event.currentTarget.value;
                updateSkill(index, (current) => ({ ...current, name: value }));
              }}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <Field label="Level (optional)">
            <input
              value={skill.level ?? ""}
              onChange={(event) => {
                const value = event.currentTarget.value;
                updateSkill(index, (current) => ({ ...current, level: value }));
              }}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <Field label="Keywords (comma separated)">
            <input
              value={(skill.keywords ?? []).join(", ")}
              onChange={(event) => {
                const value = event.currentTarget.value;
                updateSkill(index, (current) => ({
                  ...current,
                  keywords: value
                    .split(/,/) // comma separated
                    .map((token) => token.trim())
                    .filter(Boolean)
                }));
              }}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
        </div>
      ))}
      {!skills.length && <p className="text-sm text-slate-500">No skills captured. Add your core competencies for autofill scoring.</p>}
    </div>
  );
}

function ProjectsForm({ resume, updateResume }: { resume: JsonResume; updateResume: (fn: (current: JsonResume) => JsonResume) => void }) {
  const projects = resume.projects ?? [];

  function updateProject(index: number, updater: (project: JsonResumeProject) => JsonResumeProject) {
    updateResume((current) => {
      const next = [...(current.projects ?? [])];
      next[index] = updater(next[index] ?? ({ name: "" } as JsonResumeProject));
      return { ...current, projects: next };
    });
  }

  function removeProject(index: number) {
    updateResume((current) => {
      const next = (current.projects ?? []).filter((_, idx) => idx !== index);
      return { ...current, projects: next.length ? next : undefined };
    });
  }

  function addProject() {
    updateResume((current) => ({
      ...current,
      projects: [
        ...(current.projects ?? []),
        { name: "", description: "", url: "", startDate: "", endDate: "", highlights: [] }
      ]
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Projects</h3>
        <IconBadgeButton label="Add project" icon={<Plus size={16} />} tone="accent" onClick={addProject} />
      </div>
      {projects.map((project, index) => (
        <div key={index} className="space-y-3 rounded border border-slate-200 p-4">
          <div className="flex justify-end">
            <IconBadgeButton
              label="Remove project"
              icon={<Trash2 size={15} />}
              tone="danger"
              onClick={() => removeProject(index)}
            />
          </div>
          <Field label="Project name">
            <input
              value={project.name}
              onChange={(event) => {
                const value = event.currentTarget.value;
                updateProject(index, (current) => ({ ...current, name: value }));
              }}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <DateRangeField
            startLabel="Start date"
            endLabel="End date"
            startValue={project.startDate ?? ""}
            endValue={project.endDate ?? ""}
            allowOngoing
            onChange={(range) =>
              updateProject(index, (current) => ({ ...current, startDate: range.start, endDate: range.end }))
            }
          />
          <Field label="Description">
            <textarea
              value={project.description ?? ""}
              onChange={(event) => {
                const value = event.currentTarget.value;
                updateProject(index, (current) => ({ ...current, description: value }));
              }}
              className="h-24 w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <Field label="URL">
            <input
              value={project.url ?? ""}
              onChange={(event) => {
                const value = event.currentTarget.value;
                updateProject(index, (current) => ({ ...current, url: value }));
              }}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <Field label="Highlights (one per line)">
            <textarea
              value={(project.highlights ?? []).join("\n")}
              onChange={(event) => {
                const value = event.currentTarget.value;
                updateProject(index, (current) => ({
                  ...current,
                  highlights: value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                }));
              }}
              className="h-28 w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
        </div>
      ))}
      {!projects.length && <p className="text-sm text-slate-500">Add portfolio work or key initiatives to autofill project sections.</p>}
    </div>
  );
}

function CertificatesForm({ resume, updateResume }: { resume: JsonResume; updateResume: (fn: (current: JsonResume) => JsonResume) => void }) {
  const certificates = resume.certificates ?? [];

  function updateCertificate(index: number, updater: (cert: JsonResumeCertificate) => JsonResumeCertificate) {
    updateResume((current) => {
      const next = [...(current.certificates ?? [])];
      next[index] = updater(next[index] ?? ({ name: "" } as JsonResumeCertificate));
      return { ...current, certificates: next };
    });
  }

  function removeCertificate(index: number) {
    updateResume((current) => {
      const next = (current.certificates ?? []).filter((_, idx) => idx !== index);
      return { ...current, certificates: next.length ? next : undefined };
    });
  }

  function addCertificate() {
    updateResume((current) => ({
      ...current,
      certificates: [...(current.certificates ?? []), { name: "", issuer: "", date: "", url: "" }]
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Certificates</h3>
        <IconBadgeButton
          label="Add certificate"
          icon={<Plus size={16} />}
          tone="accent"
          onClick={addCertificate}
        />
      </div>
      {certificates.map((certificate, index) => (
        <div key={index} className="space-y-3 rounded border border-slate-200 p-4">
          <div className="flex justify-end">
            <IconBadgeButton
              label="Remove certificate"
              icon={<Trash2 size={15} />}
              tone="danger"
              onClick={() => removeCertificate(index)}
            />
          </div>
          <Field label="Certificate name">
            <input
              value={certificate.name}
              onChange={(event) => {
                const value = event.currentTarget.value;
                updateCertificate(index, (current) => ({ ...current, name: value }));
              }}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <Field label="Issuer">
            <input
              value={certificate.issuer ?? ""}
              onChange={(event) => {
                const value = event.currentTarget.value;
                updateCertificate(index, (current) => ({ ...current, issuer: value }));
              }}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Date (YYYY-MM)">
              <input
                value={certificate.date ?? ""}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  updateCertificate(index, (current) => ({ ...current, date: value }));
                }}
                className="w-full rounded border border-slate-200 px-3 py-2"
              />
            </Field>
            <Field label="URL">
              <input
                value={certificate.url ?? ""}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  updateCertificate(index, (current) => ({ ...current, url: value }));
                }}
                className="w-full rounded border border-slate-200 px-3 py-2"
              />
            </Field>
          </div>
        </div>
      ))}
      {!certificates.length && <p className="text-sm text-slate-500">Add certifications or licenses you want to autofill.</p>}
    </div>
  );
}

function LanguagesForm({ resume, updateResume }: { resume: JsonResume; updateResume: (fn: (current: JsonResume) => JsonResume) => void }) {
  const languages = resume.languages ?? [];

  function updateLanguage(index: number, updater: (language: JsonResumeLanguage) => JsonResumeLanguage) {
    updateResume((current) => {
      const next = [...(current.languages ?? [])];
      next[index] = updater(next[index] ?? ({ language: "" } as JsonResumeLanguage));
      return { ...current, languages: next };
    });
  }

  function removeLanguage(index: number) {
    updateResume((current) => {
      const next = (current.languages ?? []).filter((_, idx) => idx !== index);
      return { ...current, languages: next.length ? next : undefined };
    });
  }

  function addLanguage() {
    updateResume((current) => ({
      ...current,
      languages: [...(current.languages ?? []), { language: "", fluency: "" }]
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Languages</h3>
        <IconBadgeButton label="Add language" icon={<Plus size={16} />} tone="accent" onClick={addLanguage} />
      </div>
      {languages.map((item, index) => (
        <div key={index} className="space-y-3 rounded border border-slate-200 p-4">
          <div className="flex justify-end">
            <IconBadgeButton
              label="Remove language"
              icon={<Trash2 size={15} />}
              tone="danger"
              onClick={() => removeLanguage(index)}
            />
          </div>
          <Field label="Language">
            <input
              value={item.language}
              onChange={(event) => {
                const value = event.currentTarget.value;
                updateLanguage(index, (current) => ({ ...current, language: value }));
              }}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <Field label="Fluency">
            <input
              value={item.fluency ?? ""}
              onChange={(event) => {
                const value = event.currentTarget.value;
                updateLanguage(index, (current) => ({ ...current, fluency: value }));
              }}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
        </div>
      ))}
      {!languages.length && <p className="text-sm text-slate-500">Capture languages and fluency to auto-complete language fields.</p>}
    </div>
  );
}

function VolunteerForm({ resume, updateResume }: { resume: JsonResume; updateResume: (fn: (current: JsonResume) => JsonResume) => void }) {
  const volunteer = resume.volunteer ?? [];

  function updateVolunteer(index: number, updater: (item: JsonResumeVolunteer) => JsonResumeVolunteer) {
    updateResume((current) => {
      const next = [...(current.volunteer ?? [])];
      next[index] = updater(next[index] ?? ({ organization: "" } as JsonResumeVolunteer));
      return { ...current, volunteer: next };
    });
  }

  function removeVolunteer(index: number) {
    updateResume((current) => {
      const next = (current.volunteer ?? []).filter((_, idx) => idx !== index);
      return { ...current, volunteer: next.length ? next : undefined };
    });
  }

  function addVolunteer() {
    updateResume((current) => ({
      ...current,
      volunteer: [
        ...(current.volunteer ?? []),
        { organization: "", position: "", url: "", startDate: "", endDate: "", summary: "", highlights: [] }
      ]
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Volunteer</h3>
        <IconBadgeButton label="Add volunteer experience" icon={<Plus size={16} />} tone="accent" onClick={addVolunteer} />
      </div>
      {volunteer.map((item, index) => (
        <div key={index} className="space-y-3 rounded border border-slate-200 p-4">
          <div className="flex justify-end">
            <IconBadgeButton
              label="Remove volunteer experience"
              icon={<Trash2 size={15} />}
              tone="danger"
              onClick={() => removeVolunteer(index)}
            />
          </div>
          <Field label="Organization">
            <input
              value={item.organization ?? ""}
              onChange={(event) => updateVolunteer(index, (current) => ({ ...current, organization: event.currentTarget.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <Field label="Role / Position">
            <input
              value={item.position ?? ""}
              onChange={(event) => updateVolunteer(index, (current) => ({ ...current, position: event.currentTarget.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <Field label="Organization URL">
            <input
              value={item.url ?? ""}
              onChange={(event) => updateVolunteer(index, (current) => ({ ...current, url: event.currentTarget.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <DateRangeField
            startLabel="Start date"
            endLabel="End date"
            startValue={item.startDate ?? ""}
            endValue={item.endDate ?? ""}
            allowOngoing
            onChange={(range) =>
              updateVolunteer(index, (current) => ({ ...current, startDate: range.start, endDate: range.end }))
            }
          />
          <Field label="Summary">
            <textarea
              value={item.summary ?? ""}
              onChange={(event) => updateVolunteer(index, (current) => ({ ...current, summary: event.currentTarget.value }))}
              className="h-24 w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <Field label="Highlights (one per line)">
            <textarea
              value={(item.highlights ?? []).join("\n")}
              onChange={(event) =>
                updateVolunteer(index, (current) => ({
                  ...current,
                  highlights: event.currentTarget.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                }))
              }
              className="h-24 w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
        </div>
      ))}
      {!volunteer.length && <p className="text-sm text-slate-500">Document volunteer work to showcase community impact.</p>}
    </div>
  );
}

function AwardsForm({ resume, updateResume }: { resume: JsonResume; updateResume: (fn: (current: JsonResume) => JsonResume) => void }) {
  const awards = resume.awards ?? [];

  function updateAward(index: number, updater: (award: JsonResumeAward) => JsonResumeAward) {
    updateResume((current) => {
      const next = [...(current.awards ?? [])];
      next[index] = updater(next[index] ?? ({ title: "" } as JsonResumeAward));
      return { ...current, awards: next };
    });
  }

  function removeAward(index: number) {
    updateResume((current) => {
      const next = (current.awards ?? []).filter((_, idx) => idx !== index);
      return { ...current, awards: next.length ? next : undefined };
    });
  }

  function addAward() {
    updateResume((current) => ({
      ...current,
      awards: [...(current.awards ?? []), { title: "", awarder: "", date: "", summary: "" }]
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Awards</h3>
        <IconBadgeButton label="Add award" icon={<Plus size={16} />} tone="accent" onClick={addAward} />
      </div>
      {awards.map((award, index) => (
        <div key={index} className="space-y-3 rounded border border-slate-200 p-4">
          <div className="flex justify-end">
            <IconBadgeButton
              label="Remove award"
              icon={<Trash2 size={15} />}
              tone="danger"
              onClick={() => removeAward(index)}
            />
          </div>
          <Field label="Title">
            <input
              value={award.title}
              onChange={(event) => updateAward(index, (current) => ({ ...current, title: event.currentTarget.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <Field label="Awarder">
            <input
              value={award.awarder ?? ""}
              onChange={(event) => updateAward(index, (current) => ({ ...current, awarder: event.currentTarget.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <Field label="Date (YYYY-MM-DD)">
            <input
              value={award.date ?? ""}
              onChange={(event) => updateAward(index, (current) => ({ ...current, date: event.currentTarget.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <Field label="Summary">
            <textarea
              value={award.summary ?? ""}
              onChange={(event) => updateAward(index, (current) => ({ ...current, summary: event.currentTarget.value }))}
              className="h-24 w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
        </div>
      ))}
      {!awards.length && <p className="text-sm text-slate-500">Capture key recognitions and awards.</p>}
    </div>
  );
}

function PublicationsForm({ resume, updateResume }: { resume: JsonResume; updateResume: (fn: (current: JsonResume) => JsonResume) => void }) {
  const publications = resume.publications ?? [];

  function updatePublication(index: number, updater: (publication: JsonResumePublication) => JsonResumePublication) {
    updateResume((current) => {
      const next = [...(current.publications ?? [])];
      next[index] = updater(next[index] ?? ({ name: "" } as JsonResumePublication));
      return { ...current, publications: next };
    });
  }

  function removePublication(index: number) {
    updateResume((current) => {
      const next = (current.publications ?? []).filter((_, idx) => idx !== index);
      return { ...current, publications: next.length ? next : undefined };
    });
  }

  function addPublication() {
    updateResume((current) => ({
      ...current,
      publications: [...(current.publications ?? []), { name: "", publisher: "", releaseDate: "", url: "", summary: "" }]
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Publications</h3>
        <IconBadgeButton label="Add publication" icon={<Plus size={16} />} tone="accent" onClick={addPublication} />
      </div>
      {publications.map((publication, index) => (
        <div key={index} className="space-y-3 rounded border border-slate-200 p-4">
          <div className="flex justify-end">
            <IconBadgeButton
              label="Remove publication"
              icon={<Trash2 size={15} />}
              tone="danger"
              onClick={() => removePublication(index)}
            />
          </div>
          <Field label="Title">
            <input
              value={publication.name}
              onChange={(event) => updatePublication(index, (current) => ({ ...current, name: event.currentTarget.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <Field label="Publisher">
            <input
              value={publication.publisher ?? ""}
              onChange={(event) => updatePublication(index, (current) => ({ ...current, publisher: event.currentTarget.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <Field label="Release date (YYYY-MM-DD)">
            <input
              value={publication.releaseDate ?? ""}
              onChange={(event) => updatePublication(index, (current) => ({ ...current, releaseDate: event.currentTarget.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <Field label="URL">
            <input
              value={publication.url ?? ""}
              onChange={(event) => updatePublication(index, (current) => ({ ...current, url: event.currentTarget.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <Field label="Summary">
            <textarea
              value={publication.summary ?? ""}
              onChange={(event) => updatePublication(index, (current) => ({ ...current, summary: event.currentTarget.value }))}
              className="h-24 w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
        </div>
      ))}
      {!publications.length && <p className="text-sm text-slate-500">Showcase published work or research.</p>}
    </div>
  );
}

function InterestsForm({ resume, updateResume }: { resume: JsonResume; updateResume: (fn: (current: JsonResume) => JsonResume) => void }) {
  const interests = resume.interests ?? [];

  function updateInterest(index: number, updater: (interest: JsonResumeInterest) => JsonResumeInterest) {
    updateResume((current) => {
      const next = [...(current.interests ?? [])];
      next[index] = updater(next[index] ?? ({ name: "" } as JsonResumeInterest));
      return { ...current, interests: next };
    });
  }

  function removeInterest(index: number) {
    updateResume((current) => {
      const next = (current.interests ?? []).filter((_, idx) => idx !== index);
      return { ...current, interests: next.length ? next : undefined };
    });
  }

  function addInterest() {
    updateResume((current) => ({
      ...current,
      interests: [...(current.interests ?? []), { name: "", keywords: [] }]
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Interests</h3>
        <IconBadgeButton label="Add interest" icon={<Plus size={16} />} tone="accent" onClick={addInterest} />
      </div>
      {interests.map((interest, index) => (
        <div key={index} className="space-y-3 rounded border border-slate-200 p-4">
          <div className="flex justify-end">
            <IconBadgeButton
              label="Remove interest"
              icon={<Trash2 size={15} />}
              tone="danger"
              onClick={() => removeInterest(index)}
            />
          </div>
          <Field label="Interest name">
            <input
              value={interest.name}
              onChange={(event) => updateInterest(index, (current) => ({ ...current, name: event.currentTarget.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <Field label="Keywords (comma separated)">
            <input
              value={(interest.keywords ?? []).join(", ")}
              onChange={(event) =>
                updateInterest(index, (current) => ({
                  ...current,
                  keywords: event.currentTarget.value
                    .split(/,/) // comma separated
                    .map((token) => token.trim())
                    .filter(Boolean)
                }))
              }
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
        </div>
      ))}
      {!interests.length && <p className="text-sm text-slate-500">Highlight personal interests to show personality.</p>}
    </div>
  );
}

function ReferencesForm({ resume, updateResume }: { resume: JsonResume; updateResume: (fn: (current: JsonResume) => JsonResume) => void }) {
  const references = resume.references ?? [];

  function updateReference(index: number, updater: (reference: JsonResumeReference) => JsonResumeReference) {
    updateResume((current) => {
      const next = [...(current.references ?? [])];
      next[index] = updater(next[index] ?? ({ name: "" } as JsonResumeReference));
      return { ...current, references: next };
    });
  }

  function removeReference(index: number) {
    updateResume((current) => {
      const next = (current.references ?? []).filter((_, idx) => idx !== index);
      return { ...current, references: next.length ? next : undefined };
    });
  }

  function addReference() {
    updateResume((current) => ({
      ...current,
      references: [...(current.references ?? []), { name: "", reference: "" }]
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">References</h3>
        <IconBadgeButton label="Add reference" icon={<Plus size={16} />} tone="accent" onClick={addReference} />
      </div>
      {references.map((reference, index) => (
        <div key={index} className="space-y-3 rounded border border-slate-200 p-4">
          <div className="flex justify-end">
            <IconBadgeButton
              label="Remove reference"
              icon={<Trash2 size={15} />}
              tone="danger"
              onClick={() => removeReference(index)}
            />
          </div>
          <Field label="Name">
            <input
              value={reference.name}
              onChange={(event) => updateReference(index, (current) => ({ ...current, name: event.currentTarget.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
          <Field label="Reference details">
            <textarea
              value={reference.reference ?? ""}
              onChange={(event) => updateReference(index, (current) => ({ ...current, reference: event.currentTarget.value }))}
              className="h-24 w-full rounded border border-slate-200 px-3 py-2"
            />
          </Field>
        </div>
      ))}
      {!references.length && <p className="text-sm text-slate-500">Collect references to back up experience.</p>}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className ?? ""}`}>
      <span className="font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

interface IconBadgeButtonProps {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  tone?: "accent" | "danger" | "neutral";
}

function IconBadgeButton({ label, icon, onClick, tone = "neutral" }: IconBadgeButtonProps) {
  const palette = {
    accent: "border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100",
    danger: "border-red-200 bg-red-50 text-red-600 hover:bg-red-100",
    neutral: "border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
  } as const;

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:ring-offset-1 ${palette[tone]}`}
      onClick={onClick}
    >
      {icon}
      <span className="sr-only">{label}</span>
    </button>
  );
}

function isJsonResume(value: unknown): value is JsonResume {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    "basics" in record ||
    "work" in record ||
    "education" in record ||
    "skills" in record ||
    "projects" in record ||
    "languages" in record
  );
}

interface DateRangeFieldProps {
  startLabel: string;
  endLabel: string;
  startValue: string;
  endValue: string;
  onChange: (range: { start: string; end: string }) => void;
  allowOngoing?: boolean;
}

function DateRangeField({ startLabel, endLabel, startValue, endValue, onChange, allowOngoing = false }: DateRangeFieldProps) {
  const normalizedStart = startValue ?? "";
  const normalizedEnd = endValue ?? "";
  const ongoing = allowOngoing && /present/i.test(normalizedEnd);
  const startMonth = toMonthInputValue(normalizedStart);
  const endMonth = toMonthInputValue(normalizedEnd);
  const sanitizedStart = startMonth || normalizedStart;
  const sanitizedEnd = endMonth || normalizedEnd;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">{startLabel}</span>
        <input
          type="month"
          value={startMonth}
          onChange={(event) =>
            onChange({ start: event.currentTarget.value, end: ongoing ? "Present" : sanitizedEnd })
          }
          className="rounded border border-slate-200 px-3 py-2"
        />
      </label>
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{endLabel}</span>
          <input
            type="month"
            value={ongoing ? "" : endMonth}
            onChange={(event) => onChange({ start: sanitizedStart, end: event.currentTarget.value })}
            className="rounded border border-slate-200 px-3 py-2 disabled:bg-slate-100"
            disabled={ongoing}
          />
        </label>
        {allowOngoing && (
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={ongoing}
              onChange={(event) =>
                onChange({ start: sanitizedStart, end: event.currentTarget.checked ? "Present" : "" })
              }
            />
            <span>Currently ongoing</span>
          </label>
        )}
      </div>
    </div>
  );
}

function toMonthInputValue(value: string): string {
  if (!value) return "";
  if (/present/i.test(value)) return "";
  const isoMatch = value.match(/^(\d{4})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}`;
  }
  const isoDayMatch = value.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (isoDayMatch) {
    return `${isoDayMatch[1]}-${isoDayMatch[2]}`;
  }
  return "";
}

interface JsonImportDialogProps {
  initialValue: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

function JsonImportDialog({ initialValue, onSubmit, onCancel }: JsonImportDialogProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-[2147483646] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-slate-900">Paste JSON Resume</h2>
          <p className="text-sm text-slate-500">Paste a JSON Resume payload below. We’ll validate and load it into the editor.</p>
        </div>
        <textarea
          className="h-64 w-full rounded border border-slate-200 bg-slate-900/5 px-3 py-2 font-mono text-xs"
          value={value}
          onChange={(event) => {
            setValue(event.currentTarget.value);
            setError(null);
          }}
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700"
            onClick={() => {
              try {
                const parsed = JSON.parse(value);
                if (!isJsonResume(parsed)) {
                  throw new Error("JSON does not match the JSON Resume schema");
                }
                onSubmit(value);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Invalid JSON");
              }
            }}
          >
            Import JSON
          </button>
        </div>
      </div>
    </div>
  );
}
