import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Trash2, StickyNote, Download, ChevronDown, ChevronUp } from "lucide-react";
import { sendMessage } from "../../ui-shared/runtime";
import type { JobFillEvent, JobFillStatus } from "../../ui-shared/types.history";
import type { HistoryListParams } from "../../ui-shared/messaging";
import { listProfiles } from "../utils/profiles";
import { HistoryTimeline, type TimelineGranularity } from "./HistoryTimeline";

export const STATUS_ORDER: JobFillStatus[] = ["saved", "applied", "interview", "rejected", "offer"];

export const STATUS_COLORS: Record<JobFillStatus, string> = {
  saved: "#64748b",
  applied: "#1d9a6c",
  interview: "#0ea5e9",
  rejected: "#ef4444",
  offer: "#f59e0b"
};

export function statusLabel(status: JobFillStatus) {
  switch (status) {
    case "applied":
      return "Applied";
    case "interview":
      return "Interview";
    case "offer":
      return "Offer";
    case "rejected":
      return "Rejected";
    case "saved":
    default:
      return "Saved";
  }
}

type DateRange = { from?: number; to?: number };

interface FilterState {
  q: string;
  status: JobFillStatus | "all";
  host: string;
}

export function HistoryPanel() {
  const [entries, setEntries] = useState<JobFillEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ q: "", status: "all", host: "" });
  const [error, setError] = useState<string | null>(null);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [dateRange, setDateRange] = useState<DateRange>({});
  const [viewMode, setViewMode] = useState<"list" | "timeline">("list");
  const [timelineGranularity, setTimelineGranularity] = useState<TimelineGranularity>("week");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [jobDescriptions, setJobDescriptions] = useState<Record<string, string>>({});

  useEffect(() => {
    listProfiles().then(setProfilesMap).catch(() => setProfilesMap({}));
    loadEntries();
  }, []);

  const hosts = useMemo(() => {
    const set = new Set(entries.map((entry) => entry.host));
    return Array.from(set).sort();
  }, [entries]);

  const STATUS_OPTIONS = STATUS_ORDER;

  async function loadEntries(params?: HistoryListParams) {
    setLoading(true);
    try {
      const requestParams = params ?? buildParams(filters, dateRange, currentLimitOverride());
      const data = await sendMessage<JobFillEvent[]>({ type: "HISTORY_LIST", params: requestParams });
      const normalized = (data ?? []).map((entry) =>
        entry.status === ("pending" as JobFillStatus)
          ? { ...entry, status: "saved" as JobFillStatus }
          : entry
      );
      setEntries(normalized);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function applyFilters(next: Partial<FilterState>) {
    const nextState = { ...filters, ...next };
    setFilters(nextState);
    loadEntries(buildParams(nextState, dateRange, currentLimitOverride()));
  }

  async function handleStatusToggle(id: string, status: JobFillStatus) {
    await sendMessage({ type: "HISTORY_SET_STATUS", id, status });
    loadEntries(buildParams(filters, dateRange, currentLimitOverride()));
  }

  async function handleNote(id: string, note: string | undefined) {
    const value = window.prompt("Add note", note ?? "");
    if (value == null) return;
    await sendMessage({ type: "HISTORY_SET_NOTE", id, note: value });
    loadEntries(buildParams(filters, dateRange, currentLimitOverride()));
  }

  async function handleRemove(id: string) {
    if (!window.confirm("Remove this history item?")) return;
    await sendMessage({ type: "HISTORY_REMOVE", id });
    loadEntries(buildParams(filters, dateRange, currentLimitOverride()));
  }

  async function toggleRowExpansion(entryId: string, jdItemId: string | undefined) {
    const isExpanded = expandedRows.has(entryId);

    if (isExpanded) {
      // Collapse
      const newExpanded = new Set(expandedRows);
      newExpanded.delete(entryId);
      setExpandedRows(newExpanded);
    } else {
      // Expand - fetch job description if we haven't already
      if (jdItemId && !jobDescriptions[jdItemId]) {
        try {
          const item = await sendMessage<any>({ type: "JD_GET_ITEM", id: jdItemId });
          if (item?.text) {
            setJobDescriptions(prev => ({ ...prev, [jdItemId]: item.text }));
          }
        } catch (error) {
          console.error("Failed to load job description:", error);
        }
      }
      const newExpanded = new Set(expandedRows);
      newExpanded.add(entryId);
      setExpandedRows(newExpanded);
    }
  }

  async function handleClear() {
    if (!window.confirm("Clear entire history?")) return;
    await sendMessage({ type: "HISTORY_CLEAR" });
    setDateRange({});
    loadEntries(buildParams(filters, {}, currentLimitOverride()));
  }

  async function handleExportCSV() {
    try {
      const data = await fetchHistoryForExport();
      const csv = historyToCSV(data, profilesMap);
      downloadBlob(csv, "jobsnap-history.csv", "text/csv;charset=utf-8");
    } catch (error) {
      console.error("JobSnap history export CSV failed", error);
    }
  }

  async function handleExportJSON() {
    try {
      const data = await fetchHistoryForExport();
      const json = JSON.stringify({ version: 1, items: data }, null, 2);
      downloadBlob(json, "jobsnap-history.json", "application/json");
    } catch (error) {
      console.error("JobSnap history export JSON failed", error);
    }
  }

  function currentLimitOverride(): Partial<HistoryListParams> | undefined {
    return viewMode === "timeline" ? { limit: 1000 } : undefined;
  }

  function handleViewModeChange(mode: "list" | "timeline") {
    if (mode === viewMode) return;
    setViewMode(mode);
    const overrides = mode === "timeline" ? { limit: 1000 } : undefined;
    loadEntries(buildParams(filters, dateRange, overrides));
  }

  function handleTimelineRange(range: { from: number; to: number } | null) {
    if (!range) {
      const cleared: DateRange = {};
      setDateRange(cleared);
      loadEntries(buildParams(filters, cleared, currentLimitOverride()));
      return;
    }
    const nextRange: DateRange = { from: range.from, to: range.to };
    setDateRange(nextRange);
    loadEntries(buildParams(filters, nextRange, currentLimitOverride()));
  }

  function handleGranularityChange(value: TimelineGranularity) {
    setTimelineGranularity(value);
  }

  function buildParams(filterState: FilterState, range: DateRange, overrides?: Partial<HistoryListParams>): HistoryListParams {
    const base: HistoryListParams = {
      q: filterState.q || undefined,
      status: filterState.status,
      host: filterState.host || undefined,
      from: range.from,
      to: range.to,
      limit: overrides?.limit,
      offset: overrides?.offset
    };
    return overrides ? { ...base, ...overrides } : base;
  }

  async function fetchHistoryForExport(): Promise<JobFillEvent[]> {
    const params = buildParams(filters, dateRange, { limit: 100000, offset: 0 });
    return sendMessage<JobFillEvent[]>({ type: "HISTORY_LIST", params });
  }

  const hasDateRange = dateRange.from != null || dateRange.to != null;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Autofill History</h2>
          {hasDateRange && <p className="text-xs text-slate-500">Range: {formatDateRange(dateRange)}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => handleViewModeChange("list")}
              className={`rounded-full px-3 py-1 transition-all ${
                viewMode === "list" ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md shadow-indigo-200" : "hover:bg-indigo-100/50"
              }`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange("timeline")}
              className={`rounded-full px-3 py-1 transition-all ${
                viewMode === "timeline" ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md shadow-indigo-200" : "hover:bg-indigo-100/50"
              }`}
            >
              Timeline
            </button>
          </div>
          <button
            className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-600 transition-all hover:bg-gradient-to-br hover:from-indigo-50 hover:to-purple-50 hover:shadow-sm hover:shadow-indigo-100"
            onClick={handleExportCSV}
          >
            <Download size={14} />
            <span>CSV</span>
          </button>
          <button
            className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-600 transition-all hover:bg-gradient-to-br hover:from-indigo-50 hover:to-purple-50 hover:shadow-sm hover:shadow-indigo-100"
            onClick={handleExportJSON}
          >
            <Download size={14} />
            <span>JSON</span>
          </button>
          <button
            className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 transition-all hover:bg-red-50 hover:shadow-sm hover:shadow-red-100"
            onClick={handleClear}
          >
            <Trash2 size={14} />
            <span>Clear</span>
          </button>
        </div>
      </header>
      <div className="grid gap-3 md:grid-cols-3">
        <input
          className="rounded border border-slate-200 px-3 py-2 text-sm"
          placeholder="Search title, company, host"
          value={filters.q}
          onChange={(event) => applyFilters({ q: event.currentTarget.value })}
        />
        <select
          className="rounded border border-slate-200 px-3 py-2 text-sm"
          value={filters.status}
          onChange={(event) => applyFilters({ status: event.currentTarget.value as FilterState["status"] })}
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-slate-200 px-3 py-2 text-sm"
          value={filters.host}
          onChange={(event) => applyFilters({ host: event.currentTarget.value })}
        >
          <option value="">All hosts</option>
          {hosts.map((host) => (
            <option key={host} value={host}>
              {host}
            </option>
          ))}
        </select>
      </div>
      {hasDateRange && (
        <div className="flex items-center gap-2 rounded-full border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 px-3 py-1 text-xs text-indigo-700 shadow-sm shadow-indigo-100">
          <span>Filtered range: {formatDateRange(dateRange)}</span>
          <button type="button" className="font-semibold underline transition hover:text-purple-700" onClick={() => handleTimelineRange(null)}>
            Clear
          </button>
        </div>
      )}
      {viewMode === "list" ? (
        <div className="overflow-hidden rounded border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="w-8 px-3 py-2"></th>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Company</th>
              <th className="px-3 py-2 text-left">Host</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Profile</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {entries.map((entry) => {
              const isExpanded = expandedRows.has(entry.id);
              const hasJobDescription = !!entry.jdItemId;
              const jobDescText = entry.jdItemId ? jobDescriptions[entry.jdItemId] : undefined;

              return (
                <>
                  <tr key={entry.id}>
                    <td className="px-3 py-2">
                      {hasJobDescription ? (
                        <button
                          type="button"
                          onClick={() => toggleRowExpansion(entry.id, entry.jdItemId)}
                          className="text-slate-400 hover:text-slate-600"
                          title={isExpanded ? "Collapse job description" : "Expand job description"}
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-700">
                      {entry.url ? (
                        <a className="text-indigo-600 hover:underline" href={entry.url} target="_blank" rel="noreferrer">
                          {entry.title ?? entry.host}
                        </a>
                      ) : (
                        entry.title ?? entry.host
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{entry.company ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{entry.host}</td>
                    <td className="px-3 py-2 text-slate-500">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2 text-slate-500">{entry.profileId ? profilesMap[entry.profileId] ?? entry.profileId : "—"}</td>
                    <td className="px-3 py-2 text-slate-500">
                      <select
                        className="rounded border border-slate-200 px-2 py-1 text-xs"
                        value={entry.status}
                        onChange={(event) =>
                          handleStatusToggle(entry.id, event.currentTarget.value as JobFillStatus)
                        }
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {statusLabel(status)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      <div className="flex items-center gap-2">
                        <RowIconButton
                          label={entry.note ? "Edit note" : "Add note"}
                          icon={<StickyNote size={14} />}
                          onClick={() => handleNote(entry.id, entry.note)}
                        />
                        <RowIconButton
                          label="Remove"
                          icon={<Trash2 size={14} />}
                          tone="danger"
                          onClick={() => handleRemove(entry.id)}
                        />
                      </div>
                    </td>
                  </tr>
                  {isExpanded && jobDescText && (
                    <tr key={`${entry.id}-expanded`}>
                      <td colSpan={8} className="bg-slate-50 px-3 py-4">
                        <div className="max-h-60 overflow-y-auto rounded border border-slate-200 bg-white p-3 text-sm text-slate-700">
                          <div className="mb-2 font-semibold text-slate-900">Job Description</div>
                          <div className="whitespace-pre-wrap">{jobDescText}</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {!entries.length && !loading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500">
                  No history yet.
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      ) : (
        <HistoryTimeline
          events={entries}
          granularity={timelineGranularity}
          onGranularityChange={handleGranularityChange}
          onRangeSelected={handleTimelineRange}
          selectedRange={hasDateRange && dateRange.from != null && dateRange.to != null ? { from: dateRange.from, to: dateRange.to } : undefined}
        />
      )}
      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

interface RowIconButtonProps {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  tone?: "neutral" | "danger";
}

function RowIconButton({ label, icon, onClick, tone = "neutral" }: RowIconButtonProps) {
  const palette = {
    neutral: "border-slate-200 bg-white text-slate-600 hover:bg-gradient-to-br hover:from-indigo-50/50 hover:to-purple-50/50 hover:border-indigo-200 hover:text-indigo-600",
    danger: "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:shadow-sm hover:shadow-red-100"
  } as const;

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs transition-all focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1 ${
        palette[tone]
      }`}
    >
      {icon}
    </button>
  );
}

function formatDateRange(range: DateRange): string {
  const formatter = (value: number) => new Date(value).toLocaleDateString();
  const { from, to } = range;
  if (from != null && to != null) {
    return `${formatter(from)} – ${formatter(to)}`;
  }
  if (from != null) {
    return `From ${formatter(from)}`;
  }
  if (to != null) {
    return `Until ${formatter(to)}`;
  }
  return "";
}

function historyToCSV(events: JobFillEvent[], profilesMap: Record<string, string>): string {
  const headers = [
    "createdAt",
    "status",
    "statusChangedAt",
    "title",
    "company",
    "host",
    "url",
    "profile",
    "note"
  ];
  const rows = events.map((event) => {
    const profile = event.profileId ? profilesMap[event.profileId] ?? event.profileId : "";
    return [
      new Date(event.createdAt).toISOString(),
      event.status,
      new Date(event.statusChangedAt ?? event.createdAt).toISOString(),
      event.title ?? "",
      event.company ?? "",
      event.host,
      event.url ?? "",
      profile,
      event.note ?? ""
    ];
  });

  const all = [headers, ...rows];
  const csv = all
    .map((columns) => columns.map((value) => csvEscape(value)).join(","))
    .join("\n");
  return `\ufeff${csv}`;
}

function csvEscape(value: string): string {
  if (value === undefined || value === null) return "";
  const needsQuotes = value.includes(",") || value.includes("\n") || value.includes("\"");
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function downloadBlob(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
