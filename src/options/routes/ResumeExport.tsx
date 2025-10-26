import { useState, useEffect, useRef } from "react";
import { FileText, Download, Loader2, CheckCircle2, Upload, Trash2, HelpCircle, X } from "lucide-react";
import { getActiveProfileId, getProfile } from "../../storage/profiles";
import { generateResume, downloadBlob, getAvailableTemplates, uploadCustomTemplate, deleteCustomTemplate, type ResumeTemplate } from "../../utils/resume-exporter";
import type { ProfileRecord } from "../../ui-shared/schema";

export function ResumeExport() {
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('/resumes/default.docx');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDisplayName, setUploadDisplayName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadActiveProfile();
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const available = await getAvailableTemplates();
      setTemplates(available);
      if (available.length > 0) {
        setSelectedTemplate(available[0].path);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadDisplayName(file.name.replace('.docx', ''));
    }
  }

  async function handleUploadTemplate() {
    if (!uploadFile) {
      setError('Please select a file to upload');
      return;
    }

    try {
      setError(null);
      setIsUploading(true);

      await uploadCustomTemplate(uploadFile, uploadDisplayName);

      // Reload templates
      await loadTemplates();

      // Clear upload state
      setUploadFile(null);
      setUploadDisplayName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload template');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteTemplate(templateName: string) {
    if (!confirm(`Delete template "${templateName}"?`)) {
      return;
    }

    try {
      setError(null);
      await deleteCustomTemplate(templateName);

      // Reload templates
      await loadTemplates();

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    }
  }

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

      // Generate the resume DOCX with selected template
      const blob = await generateResume(profile, selectedTemplate);

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
          Generate professional resumes from your profile data using customizable templates.
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
                {profile.resume.basics?.label || "No title specified"}
              </p>
              <div className="text-sm text-slate-500 space-y-1">
                {profile.resume.basics?.email && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Email:</span>
                    <span>{profile.resume.basics.email}</span>
                  </div>
                )}
                {profile.resume.basics?.phone && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Phone:</span>
                    <span>{profile.resume.basics.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Template Selection */}
          {templates.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Resume Template
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="
                  w-full rounded-lg border-2 border-peach/30 bg-white
                  px-4 py-2.5 text-sm text-slate-700
                  focus:border-peach focus:ring-2 focus:ring-peach/20 focus:outline-none
                  transition-all duration-base
                "
              >
                {templates.map(template => (
                  <option key={template.path} value={template.path}>
                    {template.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Export Button */}
          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={handleExport}
              disabled={isGenerating || !profile}
              className="
                w-full inline-flex items-center justify-center gap-2
                rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600
                px-6 py-3 text-sm font-semibold text-white
                shadow-md shadow-indigo-200
                transition-all duration-base
                hover:shadow-lg hover:shadow-indigo-300 hover:from-blue-700 hover:to-indigo-700 hover:scale-105
                active:scale-95
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
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

      {/* Upload Custom Template */}
      <div className="rounded-xl bg-white/60 border border-slate-100 p-6 shadow-md space-y-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-gradient-to-br from-lavender/20 to-peach/20 border border-lavender/30">
            <Upload className="text-slate-700" size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-800 mb-1">
                  Upload Custom Template
                </h3>
                <p className="text-sm text-slate-600">
                  Upload your own DOCX template to use for resume generation
                </p>
              </div>
              <button
                onClick={() => setShowHelpModal(true)}
                className="
                  p-2 rounded-lg text-slate-500
                  hover:bg-indigo-50 hover:text-indigo-600
                  transition-all duration-base
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/20
                "
                title="How to create templates"
              >
                <HelpCircle size={20} />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {/* File Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Template File (.docx)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              onChange={handleFileChange}
              className="
                block w-full text-sm text-slate-600
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-gradient-to-r file:from-peach/10 file:to-mint/10
                file:text-slate-700
                hover:file:bg-gradient-to-r hover:file:from-peach/20 hover:file:to-mint/20
                file:cursor-pointer
                cursor-pointer
              "
            />
          </div>

          {/* Display Name Input */}
          {uploadFile && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Template Name
              </label>
              <input
                type="text"
                value={uploadDisplayName}
                onChange={(e) => setUploadDisplayName(e.target.value)}
                placeholder="My Custom Template"
                className="
                  w-full rounded-lg border-2 border-peach/30 bg-white
                  px-4 py-2.5 text-sm text-slate-700
                  focus:border-peach focus:ring-2 focus:ring-peach/20 focus:outline-none
                  transition-all duration-base
                "
              />
            </div>
          )}

          {/* Upload Button */}
          {uploadFile && (
            <button
              onClick={handleUploadTemplate}
              disabled={isUploading || !uploadDisplayName}
              className="
                w-full inline-flex items-center justify-center gap-2
                rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600
                px-6 py-2.5 text-sm font-semibold text-white
                shadow-md shadow-indigo-200
                transition-all duration-base
                hover:shadow-lg hover:shadow-indigo-300 hover:from-blue-700 hover:to-indigo-700 hover:scale-105
                active:scale-95
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:scale-100
              "
            >
              {isUploading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={18} />
                  Upload Template
                </>
              )}
            </button>
          )}
        </div>

        {/* Custom Templates List */}
        {templates.some(t => !t.builtin) && (
          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">
              Your Custom Templates
            </h4>
            <div className="space-y-2">
              {templates
                .filter(t => !t.builtin)
                .map(template => (
                  <div
                    key={template.name}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100"
                  >
                    <span className="text-sm font-medium text-slate-700">
                      {template.displayName}
                    </span>
                    <button
                      onClick={() => handleDeleteTemplate(template.name)}
                      className="
                        p-2 rounded-lg text-slate-500
                        hover:bg-red-50 hover:text-red-600
                        transition-all duration-base
                        focus:outline-none focus:ring-2 focus:ring-red-500/20
                      "
                      title="Delete template"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="rounded-xl bg-blue-50/50 border border-blue-100 p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">
          About Resume Templates
        </h4>
        <ul className="text-sm text-blue-800 space-y-1.5 list-disc list-inside">
          <li>Choose from built-in templates or upload your own custom designs</li>
          <li>All templates populate automatically with your profile data</li>
          <li>Generated DOCX files are fully editable in Word or Google Docs</li>
          <li>Templates support skills, work experience, education, and certifications</li>
          <li>Flexible date formatting: use {'{'}startMonthName{'}'} (January), {'{'}startMonthShort{'}'} (Jan), or {'{'}startMonth{'}'} (01)</li>
          <li>For current positions: {'{'}endDate{'}'} shows "Present", while date components are empty for custom formatting</li>
        </ul>
      </div>

      {/* Template Help Modal */}
      {showHelpModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowHelpModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Creating Custom Resume Templates
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Learn how to design your own templates with flexible formatting
                </p>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="
                  p-2 rounded-lg text-slate-500
                  hover:bg-white hover:text-slate-700
                  transition-all duration-base
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/20
                "
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-88px)] p-6 space-y-6">
              {/* Quick Start */}
              <section>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Quick Start</h3>
                <ol className="space-y-2 text-sm text-slate-700">
                  <li className="flex gap-3">
                    <span className="font-semibold text-indigo-600 min-w-[1.5rem]">1.</span>
                    <span>Create a new Word document (.docx) with your desired layout</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-semibold text-indigo-600 min-w-[1.5rem]">2.</span>
                    <span>Use placeholder syntax like <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">{'{'}name{'}'}</code> for simple values</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-semibold text-indigo-600 min-w-[1.5rem]">3.</span>
                    <span>Use loops like <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">{'{'}#work{'}'}...{'{/'}work{'}'}</code> for repeating sections</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-semibold text-indigo-600 min-w-[1.5rem]">4.</span>
                    <span>Save and upload your template using the form above</span>
                  </li>
                </ol>
              </section>

              {/* Basic Fields */}
              <section>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Basic Fields</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <code className="text-indigo-600">{'{'}name{'}'}</code>
                    <p className="text-xs text-slate-600 mt-1">Full name</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <code className="text-indigo-600">{'{'}email{'}'}</code>
                    <p className="text-xs text-slate-600 mt-1">Email address</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <code className="text-indigo-600">{'{'}phone{'}'}</code>
                    <p className="text-xs text-slate-600 mt-1">Phone number</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <code className="text-indigo-600">{'{'}website{'}'}</code>
                    <p className="text-xs text-slate-600 mt-1">Personal website</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <code className="text-indigo-600">{'{'}linkedin{'}'}</code>
                    <p className="text-xs text-slate-600 mt-1">LinkedIn profile URL</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <code className="text-indigo-600">{'{'}summary{'}'}</code>
                    <p className="text-xs text-slate-600 mt-1">Professional summary</p>
                  </div>
                </div>
              </section>

              {/* Skills */}
              <section>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Skills</h3>
                <div className="space-y-3">
                  <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                    <p className="font-medium text-slate-900 mb-2">Option 1: By Index</p>
                    <code className="text-sm text-indigo-700 block">
                      {'{'}skill1{'}'}, {'{'}skill2{'}'}, {'{'}skill3{'}'}
                    </code>
                    <p className="text-xs text-slate-600 mt-2">
                      Use <code className="bg-white px-1 py-0.5 rounded">{'{'}skill1{'}'}</code> through <code className="bg-white px-1 py-0.5 rounded">{'{'}skill18{'}'}</code> for fixed positions
                    </p>
                  </div>
                  <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                    <p className="font-medium text-slate-900 mb-2">Option 2: Loop (Recommended)</p>
                    <code className="text-sm text-indigo-700 block">
                      {'{'}#skills{'}'}{'{'}name{'}'}, {'{/'}skills{'}'}
                    </code>
                    <p className="text-xs text-slate-600 mt-2">
                      Automatically includes all skills regardless of count
                    </p>
                  </div>
                </div>
              </section>

              {/* Date Formatting */}
              <section>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Date Formatting</h3>
                <p className="text-sm text-slate-600 mb-3">
                  All dates are broken into components for flexible formatting:
                </p>
                <div className="space-y-2 text-sm">
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <code className="text-purple-700">{'{'}startMonthName{'}'} {'{'}startYear{'}'} - {'{'}endMonthName{'}'} {'{'}endYear{'}'}</code>
                    <p className="text-xs text-slate-600 mt-1">→ September 2019 - January 2025</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <code className="text-purple-700">{'{'}startMonthShort{'}'} {'{'}startYear{'}'} - {'{'}endMonthShort{'}'} {'{'}endYear{'}'}</code>
                    <p className="text-xs text-slate-600 mt-1">→ Sep 2019 - Jan 2025</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <code className="text-purple-700">{'{'}startMonth{'}'}/{'{'}startYear{'}'} - {'{'}endMonth{'}'}/{'{'}endYear{'}'}</code>
                    <p className="text-xs text-slate-600 mt-1">→ 09/2019 - 01/2025</p>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-900">
                    <strong>Current positions:</strong> When endDate is "Present", all end date components ({'{'}endYear{'}'}, {'{'}endMonthShort{'}'}, etc.) are empty. Use <code className="px-1 py-0.5 bg-white rounded">{'{'}endDate{'}'}</code> to display "Present".
                  </p>
                </div>
              </section>

              {/* Work Experience Example */}
              <section>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Work Experience Example</h3>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono">
{`{#work}
{position} at {company}
{location}
{startMonthShort} {startYear} - {endDate}

{summary}

{/work}`}
                  </pre>
                  <p className="text-xs text-slate-600 mt-3">
                    <strong>Note:</strong> Using <code className="px-1 py-0.5 bg-white rounded">{'{'}endDate{'}'}</code> handles both past jobs (shows formatted date) and current jobs (shows "Present")
                  </p>
                </div>
              </section>

              {/* Full Documentation */}
              <section className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">
                  Need More Details?
                </h3>
                <p className="text-sm text-blue-800">
                  For complete documentation including education, certificates, conditionals, and advanced examples, see the{' '}
                  <a
                    href="https://github.com/yourusername/jobsnap/blob/main/public/resumes/TEMPLATE_GUIDE.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-blue-900 font-medium"
                  >
                    Template Guide
                  </a>
                  {' '}on GitHub.
                </p>
              </section>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowHelpModal(false)}
                className="
                  w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600
                  px-6 py-3 text-sm font-semibold text-white
                  shadow-md shadow-indigo-200
                  transition-all duration-base
                  hover:shadow-lg hover:shadow-indigo-300 hover:from-blue-700 hover:to-indigo-700
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                "
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
