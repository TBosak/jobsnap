import { useState, useEffect } from "react";
import { FileText, Download, Loader2, CheckCircle2 } from "lucide-react";
import { getActiveProfileId, getProfile } from "../../storage/profiles";
import { generateResume, downloadBlob } from "../../utils/resume-exporter";
import type { ProfileRecord } from "../../ui-shared/schema";

export function ResumeExport() {
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadActiveProfile();
  }, []);

  async function loadActiveProfile() {
    try {
      const activeId = await getActiveProfileId();
      if (activeId) {
        const activeProfile = await getProfile(activeId);
        if (activeProfile) {
          setProfile(activeProfile);
        } else {
          setError("No active profile found. Please select or create a profile first.");
        }
      } else {
        setError("No active profile found. Please select or create a profile first.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    }
  }

  async function handleExport() {
    if (!profile) {
      setError("No profile available to export");
      return;
    }

    try {
      setError(null);
      setSuccess(false);
      setIsGenerating(true);

      // Generate the resume DOCX
      const blob = await generateResume(profile);

      // Create filename from profile name
      const filename = `${profile.name.replace(/\s+/g, '_')}_Resume.docx`;

      // Download the file
      downloadBlob(blob, filename);

      setSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export resume");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-2">
        <h2 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Export Resume
        </h2>
        <p className="text-sm text-slate-600">
          Generate an ATS-optimized resume from your profile data in DOCX format.
        </p>
      </header>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 flex items-center gap-3">
          <CheckCircle2 className="text-green-600" size={20} />
          <p className="text-sm text-green-700 font-medium">
            Resume exported successfully!
          </p>
        </div>
      )}

      {/* Profile Info Card */}
      {profile && (
        <div className="rounded-xl bg-white/60 border border-slate-100 p-6 shadow-md space-y-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-gradient-to-br from-peach/20 to-mint/20 border border-peach/30">
              <FileText className="text-slate-700" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-slate-800 mb-1">
                {profile.name}
              </h3>
              <p className="text-sm text-slate-600 mb-2">
                {profile.title || "No title specified"}
              </p>
              <div className="text-sm text-slate-500 space-y-1">
                {profile.email && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Email:</span>
                    <span>{profile.email}</span>
                  </div>
                )}
                {profile.phone && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Phone:</span>
                    <span>{profile.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Export Button */}
          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={handleExport}
              disabled={isGenerating || !profile}
              className="
                w-full inline-flex items-center justify-center gap-2
                rounded-lg bg-gradient-to-r from-peach to-mint
                px-6 py-3 text-sm font-semibold text-white
                shadow-md shadow-peach/20
                transition-all duration-base
                hover:shadow-lg hover:shadow-peach/30 hover:scale-105
                active:scale-95
                focus:outline-none focus:ring-2 focus:ring-peach/50 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:scale-100
              "
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Generating Resume...
                </>
              ) : (
                <>
                  <Download size={18} />
                  Export as DOCX
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="rounded-xl bg-blue-50/50 border border-blue-100 p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">
          About ATS-Optimized Resumes
        </h4>
        <ul className="text-sm text-blue-800 space-y-1.5 list-disc list-inside">
          <li>Uses clean, standard formatting that ATS systems can parse easily</li>
          <li>Includes all your profile data in a structured format</li>
          <li>Compatible with Word, Google Docs, and most applicant tracking systems</li>
          <li>Ready to customize further or use as-is for job applications</li>
        </ul>
      </div>
    </div>
  );
}
