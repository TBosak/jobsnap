import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Download,
  FileText,
  Trash2,
  Sparkles,
  Clipboard,
  ClipboardList,
  ExternalLink,
  Tag,
  Brain,
  ListPlus,
  Loader2
} from "lucide-react";
import { sendMessage } from "../../ui-shared/runtime";
import type { JDCollection, JDItem, JDKeyword } from "../../ui-shared/types.jd";
import type { ProfileIndexItem } from "../../ui-shared/messaging";
import type { ProfileRecord } from "../../ui-shared/schema";
import { extractKeywords } from "../../analysis/keywords";
import { computeSkillGap, computeProfileSkills, formatSkill } from "../../analysis/skills";

type KeywordStatus = "missing" | "matched" | "neutral";

interface SkillGapKeyword {
  term: string;
  score: number;
  status: KeywordStatus;
}

interface SkillGapResult {
  profileId: string;
  analyzedAt: number;
  matched: string[];
  missing: string[];
  keywords: SkillGapKeyword[];
}

export function CollectionsPanel() {
  const [collections, setCollections] = useState<JDCollection[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [items, setItems] = useState<JDItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [keywords, setKeywords] = useState<JDKeyword[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingCollections, setAnalyzingCollections] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [hostFilter, setHostFilter] = useState<string>("");
  const [profiles, setProfiles] = useState<ProfileIndexItem[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [gapResult, setGapResult] = useState<SkillGapResult | null>(null);
  const [gapLoading, setGapLoading] = useState(false);
  const [gapError, setGapError] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);

  useEffect(() => {
    refreshCollections();
  }, []);

  useEffect(() => {
    sendMessage<ProfileIndexItem[]>({ type: "LIST_PROFILE_INDEX" })
      .then((data) => {
        const list = data ?? [];
        setProfiles(list);
        if (!selectedProfileId && list.length) {
          const active = list.find((profile) => profile.isActive);
          setSelectedProfileId(active?.id ?? list[0].id);
        }
      })
      .catch(() => {
        setProfiles([]);
      });
  }, []);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    if (selected) {
      refreshItems(selected);
    } else {
      setItems([]);
      setKeywords([]);
    }
  }, [selected]);

  useEffect(() => {
    // Update local analyzing state based on persistent collection state
    setAnalyzing(selected ? analyzingCollections.has(selected) : false);
  }, [selected, analyzingCollections]);

  const currentCollection = useMemo(
    () => collections.find((col) => col.id === selected) ?? null,
    [collections, selected]
  );

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    for (const item of items) {
      (item.tags ?? []).forEach((tag) => tags.add(tag));
    }
    return Array.from(tags).sort();
  }, [items]);

  const availableHosts = useMemo(() => {
    const hosts = new Set<string>();
    for (const item of items) {
      hosts.add(item.source.host);
    }
    return Array.from(hosts).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      if (needle) {
        const haystack = [item.title, item.company, item.source.host]
          .filter(Boolean)
          .map((value) => value!.toLowerCase())
          .join(" ");
        if (!haystack.includes(needle)) {
          return false;
        }
      }
      if (hostFilter && item.source.host !== hostFilter) {
        return false;
      }
      if (tagFilter.length) {
        const tags = new Set(item.tags ?? []);
        const hasAll = tagFilter.every((tag) => tags.has(tag));
        if (!hasAll) {
          return false;
        }
      }
      return true;
    });
  }, [items, searchTerm, tagFilter, hostFilter]);

  useEffect(() => {
    setTagFilter((prev) => prev.filter((tag) => availableTags.includes(tag)));
  }, [availableTags]);

  useEffect(() => {
    if (hostFilter && !availableHosts.includes(hostFilter)) {
      setHostFilter("");
    }
  }, [availableHosts, hostFilter]);

  async function refreshCollections() {
    try {
      const data = await sendMessage<JDCollection[]>({ type: "JD_LIST_COLLECTIONS" });
      const list = data ?? [];
      setCollections(list);

      if (!list.length) {
        selectedRef.current = null;
        setSelected(null);
        setItems([]);
        setKeywords([]);
        return;
      }

      let nextSelected = selectedRef.current;
      if (!nextSelected || !list.some((col) => col.id === nextSelected)) {
        nextSelected = list[0].id;
      }

      selectedRef.current = nextSelected;
      setSelected(nextSelected);

      const active = list.find((col) => col.id === nextSelected);
      setKeywords(active?.keywords ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function refreshItems(collectionId: string) {
    setLoading(true);
    try {
      const data = await sendMessage<JDItem[]>({ type: "JD_LIST_ITEMS", collectionId });
      if (selectedRef.current === collectionId) {
        const list = data ?? [];
        setItems(list);
        syncTopTags(collectionId, list);
        setError(null);
      }
    } catch (err) {
      if (selectedRef.current === collectionId) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (selectedRef.current === collectionId) {
        setLoading(false);
      }
    }
  }

  function handleSelectCollection(id: string) {
    const found = collections.find((col) => col.id === id);
    selectedRef.current = id;
    setSelected(id);
    setKeywords(found?.keywords ?? []);
    setItems([]);
    setError(null);
    setSearchTerm("");
    setTagFilter([]);
    setHostFilter("");
    setGapResult(null);
    setGapError(null);
  }

  async function handleCreateCollection() {
    const name = window.prompt("Collection name", "New collection");
    if (!name) return;
    await sendMessage({ type: "JD_CREATE_COLLECTION", name });
    refreshCollections();
  }

  async function handleRenameCollection(id: string) {
    const current = collections.find((col) => col.id === id);
    const name = window.prompt("Rename collection", current?.name ?? "");
    if (!name) return;
    await sendMessage({ type: "JD_RENAME_COLLECTION", id, name });
    refreshCollections();
  }

  async function handleDeleteCollection(id: string) {
    if (!window.confirm("Delete this collection and all saved jobs?")) return;
    await sendMessage({ type: "JD_DELETE_COLLECTION", id });
    if (selected === id) setSelected(null);
    refreshCollections();
  }

  async function handleExportJSON(id: string) {
    const collection = collections.find((col) => col.id === id);
    if (!collection) return;
    const data = await sendMessage<JDItem[]>({ type: "JD_LIST_ITEMS", collectionId: id });
    const payload = JSON.stringify({ collection, items: data ?? [] }, null, 2);
    downloadBlob(payload, `${sanitizeFileName(collection.name)}.json`, "application/json");
  }

  async function handleExportText(id: string) {
    const collection = collections.find((col) => col.id === id);
    if (!collection) return;
    const data = await sendMessage<JDItem[]>({ type: "JD_LIST_ITEMS", collectionId: id });
    const lines = (data ?? []).map((item) => {
      const header = `=== ${item.title ?? "Untitled"} — ${item.company ?? ""} — ${item.source.url ?? ""} ===`;
      return `${header}\n${item.text}`;
    });
    downloadBlob(lines.join("\n\n"), `${sanitizeFileName(collection.name)}.txt`, "text/plain");
  }

  async function handleExtractKeywords() {
    if (!items.length || !currentCollection) return;

    const targetId = currentCollection.id;

    // Add to persistent analyzing state
    setAnalyzingCollections(prev => new Set([...prev, targetId]));
    setAnalyzing(true);
    setError(null);

    try {
      const terms = await extractKeywords(items.map((item) => item.text));
      await sendMessage<void>({ type: "JD_SET_KEYWORDS", collectionId: targetId, keywords: terms });
      setCollections((prev) =>
        prev.map((collection) =>
          collection.id === targetId
            ? { ...collection, keywords: terms, keywordsUpdatedAt: Date.now() }
            : collection
        )
      );
      if (selectedRef.current === targetId) {
        setKeywords(terms);
        setGapResult(null);
        setGapError(null);
      }
    } catch (err) {
      if (selectedRef.current === targetId) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      // Remove from persistent analyzing state
      setAnalyzingCollections(prev => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });

      // Update local state if still on this collection
      if (selectedRef.current === targetId) {
        setAnalyzing(false);
      }
    }
  }

  function syncTopTags(collectionId: string, list: JDItem[]) {
    const summary = topTagsFor(list);
    setCollections((prev) =>
      prev.map((collection) =>
        collection.id === collectionId ? { ...collection, topTags: summary } : collection
      )
    );
  }

  function handleToggleTagFilter(tag: string) {
    setTagFilter((prev) => (prev.includes(tag) ? prev.filter((value) => value !== tag) : [...prev, tag]));
  }

  async function handleEditTags(item: JDItem) {
    const current = (item.tags ?? []).join(", ");
    const value = window.prompt("Tags (comma separated)", current);
    if (value == null) return;
    const next = value
      .split(",")
      .map((raw) => raw.trim().toLowerCase())
      .filter((tag) => tag.length > 0);
    await sendMessage({ type: "JD_UPDATE_ITEM_TAGS", id: item.id, tags: next });
    const updatedItems = items.map((row) => (row.id === item.id ? { ...row, tags: next } : row));
    setItems(updatedItems);
    if (selectedRef.current) {
      syncTopTags(selectedRef.current, updatedItems);
    }
  }

  async function handleAnalyzeSkills() {
    if (!selectedProfileId) {
      setGapError("Select a profile to analyze against.");
      return;
    }
    if (!keywords.length) {
      setGapError("Extract keywords for this collection first.");
      return;
    }
    setGapLoading(true);
    setGapError(null);
    setGapResult(null);
    try {
      const profile = await sendMessage<ProfileRecord>({ type: "GET_PROFILE", id: selectedProfileId });
      if (!profile) {
        throw new Error("Profile not found");
      }

      let profileSkills = profile.computedSkills ?? [];
      if (!profileSkills.length) {
        profileSkills = await computeProfileSkills(profile.resume);
        await sendMessage({
          type: "PROFILE_SET_COMPUTED_SKILLS",
          id: profile.id,
          skills: profileSkills,
          computedAt: new Date().toISOString()
        });
      }

      const normalizedKeywords = Array.from(new Set(keywords.map((keyword) => keyword.term.toLowerCase())));
      const gap = computeSkillGap(profileSkills, normalizedKeywords, profile.resume);
      const matchedSet = new Set(gap.matched);
      const missingSet = new Set(gap.missing);

      const keywordSummaries: SkillGapKeyword[] = keywords.map((keyword) => {
        const normalized = keyword.term.toLowerCase();
        let status: KeywordStatus = "neutral";
        if (missingSet.has(normalized)) {
          status = "missing";
        } else if (matchedSet.has(normalized)) {
          status = "matched";
        }
        return {
          term: keyword.term,
          score: keyword.score,
          status
        };
      });

      setGapResult({
        profileId: profile.id,
        analyzedAt: Date.now(),
        matched: gap.matched,
        missing: gap.missing,
        keywords: keywordSummaries
      });
    } catch (error) {
      console.error("JobSnap skill analysis failed", error);
      setGapError(error instanceof Error ? error.message : String(error));
    } finally {
      setGapLoading(false);
    }
  }

  async function handleAddSkillsToProfile() {
    if (!gapResult || !selectedProfileId) {
      setGapError("Run the analysis before adding skills.");
      return;
    }
    if (!gapResult.missing.length) {
      setGapError("No missing skills to add.");
      return;
    }
    setGapLoading(true);
    setGapError(null);
    try {
      const profile = await sendMessage<ProfileRecord>({ type: "GET_PROFILE", id: selectedProfileId });
      if (!profile) {
        throw new Error("Profile not found");
      }
      const missing = gapResult.missing;
      const resumeCopy: ProfileRecord["resume"] = typeof structuredClone === "function"
        ? structuredClone(profile.resume)
        : JSON.parse(JSON.stringify(profile.resume));

      const skillsSection = [...(resumeCopy.skills ?? [])];
      if (!skillsSection.length) {
        skillsSection.push({ name: "Skills", keywords: [] });
      }
      const firstEntry = { ...skillsSection[0] };
      const keywords = new Set((firstEntry.keywords ?? []).map((skill) => formatSkill(skill.toLowerCase())));
      missing.forEach((skill) => keywords.add(formatSkill(skill)));
      firstEntry.keywords = Array.from(keywords).sort();
      if (!firstEntry.name) {
        firstEntry.name = "Skills";
      }
      skillsSection[0] = firstEntry;
      resumeCopy.skills = skillsSection;

      const updatedComputedSkills = await computeProfileSkills(resumeCopy);
      const timestamp = new Date().toISOString();

      await sendMessage({
        type: "UPSERT_PROFILE",
        profile: {
          id: profile.id,
          name: profile.name,
          resume: resumeCopy,
          updatedAt: timestamp,
          computedSkills: updatedComputedSkills,
          computedAt: timestamp
        }
      });

      setGapResult(null);
      setGapError(null);
    } catch (error) {
      console.error("JobSnap profile skill update failed", error);
      setGapError(error instanceof Error ? error.message : String(error));
    } finally {
      setGapLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Job Collections</h2>
          <IconButton label="New collection" icon={<Plus size={16} />} tone="accent" onClick={handleCreateCollection} />
        </div>
        <div className="space-y-2">
          {collections.map((collection) => (
            <button
              key={collection.id}
              onClick={() => handleSelectCollection(collection.id)}
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-all ${
                collection.id === selected
                  ? "border-indigo-400 bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-700 shadow-md shadow-indigo-100"
                  : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:shadow-sm hover:shadow-indigo-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{collection.name}</span>
                  {analyzingCollections.has(collection.id) && (
                    <Loader2 size={12} className="animate-spin text-indigo-500" />
                  )}
                </div>
                <span className="text-xs text-slate-400">{itemsCountLabel(collection.id)}</span>
              </div>
              <div className="text-xs text-slate-400">
                {new Date(collection.updatedAt).toLocaleString()}
              </div>
              {collection.topTags && collection.topTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {collection.topTags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
          {!collections.length && <p className="text-sm text-slate-500">No collections yet.</p>}
        </div>
      </aside>
      <section className="space-y-4">
        {currentCollection ? (
          <div className="space-y-4">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">{currentCollection.name}</h3>
                <p className="text-xs text-slate-500">
                  {filteredItems.length} visible / {items.length} total
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <IconButton
                  label="Rename collection"
                  icon={<Pencil size={16} />}
                  onClick={() => handleRenameCollection(currentCollection.id)}
                />
                <IconButton
                  label="Export JSON"
                  icon={<Download size={16} />}
                  onClick={() => handleExportJSON(currentCollection.id)}
                />
                <IconButton
                  label="Export text"
                  icon={<FileText size={16} />}
                  onClick={() => handleExportText(currentCollection.id)}
                />
                <IconButton
                  label="Delete collection"
                  icon={<Trash2 size={16} />}
                  tone="danger"
                  onClick={() => handleDeleteCollection(currentCollection.id)}
                />
              </div>
            </header>
            <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <input
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm md:max-w-xs"
                  placeholder="Search title, company, host"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.currentTarget.value)}
                />
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                  <select
                    className="rounded border border-slate-200 px-3 py-2 text-sm md:w-44"
                    value={hostFilter}
                    onChange={(event) => setHostFilter(event.currentTarget.value)}
                  >
                    <option value="">All hosts</option>
                    {availableHosts.map((host) => (
                      <option key={host} value={host}>
                        {host}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {availableTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => {
                    const active = tagFilter.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleToggleTagFilter(tag)}
                        className={`rounded-full px-2 py-1 text-xs font-semibold transition-all ${
                          active
                            ? "bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 shadow-sm shadow-indigo-100"
                            : "bg-white text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        #{tag}
                      </button>
                    );
                  })}
                  {tagFilter.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTagFilter([])}
                      className="rounded-full px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
                    >
                      Clear tags
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="overflow-hidden rounded border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Title</th>
                    <th className="px-3 py-2 text-left">Company</th>
                    <th className="px-3 py-2 text-left">Tags</th>
                    <th className="px-3 py-2 text-left">Captured</th>
                    <th className="px-3 py-2 text-left">Link</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-medium text-slate-700">{item.title ?? "Untitled"}</td>
                      <td className="px-3 py-2 text-slate-500">{item.company ?? ""}</td>
                      <td className="px-3 py-2 text-slate-500">
                        {item.tags && item.tags.length ? (
                          <div className="flex flex-wrap gap-1">
                            {item.tags.map((tag) => (
                              <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-500">{new Date(item.source.capturedAt).toLocaleString()}</td>
                      <td className="px-3 py-2 text-slate-500">
                        {item.source.url ? (
                          <IconButton
                            label="Open job link"
                            icon={<ExternalLink size={14} />}
                            onClick={() => window.open(item.source.url, "_blank", "noopener,noreferrer")}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-500">
                        <div className="flex items-center gap-2">
                          <IconButton
                            label="Edit tags"
                            icon={<Tag size={14} />}
                            onClick={() => handleEditTags(item)}
                          />
                          <IconButton
                            label="Remove item"
                            icon={<Trash2 size={14} />}
                            tone="danger"
                            onClick={async () => {
                              if (!window.confirm("Remove this saved job?")) return;
                              await sendMessage({ type: "JD_REMOVE_ITEM", id: item.id });
                              refreshItems(currentCollection.id);
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!items.length && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                        No job descriptions saved yet.
                      </td>
                    </tr>
                  )}
                  {items.length > 0 && !filteredItems.length && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                        No items match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="space-y-3">
              <IconButton
                label={analyzing ? "Extracting keywords..." : "Extract keywords"}
                icon={analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                tone="accent"
                disabled={!items.length || analyzing}
                onClick={handleExtractKeywords}
                showLabel
              />
              {keywords.length > 0 && (
                <div className="rounded border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                    <span>Keywords</span>
                    <div className="flex items-center gap-2">
                      <IconButton
                        label="Copy CSV"
                        icon={<ClipboardList size={14} />}
                        onClick={() => copyToClipboard(keywords.map((k) => `${k.term},${k.score.toFixed(3)}`).join("\n"))}
                      />
                      <IconButton
                        label="Copy list"
                        icon={<Clipboard size={14} />}
                        onClick={() => copyToClipboard(keywords.map((k) => k.term).join("\n"))}
                      />
                    </div>
                  </div>
                  <ul className="divide-y divide-slate-200 text-sm">
                    {keywords.map((keyword) => (
                      <li key={keyword.term} className="flex items-center justify-between px-3 py-2">
                        <span className="font-medium text-slate-700">{keyword.term}</span>
                        <span className="text-xs text-slate-500">{keyword.score.toFixed(3)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <section className="space-y-3 rounded border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">Skill Gap Analysis</h4>
                  <p className="text-xs text-slate-500">Compare the selected jobs against a profile.</p>
                </div>
                <button
                  type="button"
                  onClick={handleAnalyzeSkills}
                  disabled={gapLoading || !selectedProfileId || !keywords.length}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1 ${
                    gapLoading || !selectedProfileId || !keywords.length
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                      : "border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-600 hover:from-indigo-100 hover:to-purple-100 hover:shadow-md hover:shadow-indigo-100"
                  }`}
                >
                  <Brain size={14} />
                  <span>{gapLoading ? "Analyzing…" : "Analyze"}</span>
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-slate-500">Profile</label>
                  <select
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                    value={selectedProfileId ?? ""}
                    onChange={(event) => {
                      setSelectedProfileId(event.currentTarget.value || null);
                      setGapResult(null);
                      setGapError(null);
                    }}
                  >
                    <option value="">Select profile</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                        {profile.isActive ? " (Active)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {gapError && <p className="text-xs text-red-600">{gapError}</p>}
              {gapLoading && <p className="text-xs text-slate-500">Analyzing skills…</p>}
              {gapResult && (
                <div className="space-y-3 rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
                    <span className="text-emerald-700">Matched: {gapResult.matched.length}</span>
                    <span className="text-rose-700">Missing: {gapResult.missing.length}</span>
                  </div>
                  <div className="space-y-2">
                    <SkillChipList title="Missing keywords" skills={gapResult.missing} variant="missing" />
                    <SkillChipList title="Matched keywords" skills={gapResult.matched} variant="matched" />
                  </div>
                  <div className="overflow-hidden rounded border border-slate-200 bg-white">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-50 uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Keyword</th>
                          <th className="px-3 py-2 text-left">Score</th>
                          <th className="px-3 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {gapResult.keywords.map((keyword) => (
                          <tr key={keyword.term}>
                            <td className="px-3 py-2 font-medium text-slate-700">{keyword.term}</td>
                            <td className="px-3 py-2 text-slate-500">{keyword.score.toFixed(3)}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  keyword.status === "missing"
                                    ? "bg-rose-100 text-rose-700"
                                    : keyword.status === "matched"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {keyword.status === "missing"
                                  ? "Missing"
                                  : keyword.status === "matched"
                                  ? "Matched"
                                  : "Neutral"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Maybe we implement something like this later */}
                  {/* <button
                    type="button"
                    onClick={handleAddSkillsToProfile}
                    disabled={gapLoading || !gapResult.missing.length}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:ring-offset-1 ${
                      gapLoading || !gapResult.missing.length
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    <ListPlus size={14} />
                    <span>Add missing to profile</span>
                  </button> */}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="rounded border border-dashed border-slate-200 px-6 py-16 text-center text-sm text-slate-500">
            Select a collection to view saved jobs.
          </div>
        )}
        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>
    </div>
  );

  function itemsCountLabel(collectionId: string) {
    if (!selected || selected !== collectionId) return "";
    return `${items.length}`;
  }
}

function topTagsFor(list: JDItem[]): string[] {
  const count = new Map<string, number>();
  for (const item of list) {
    for (const tag of item.tags ?? []) {
      count.set(tag, (count.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(count.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([tag]) => tag);
}

interface SkillChipListProps {
  title: string;
  skills: string[];
  variant: "missing" | "matched";
}

function SkillChipList({ title, skills, variant }: SkillChipListProps) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-semibold uppercase text-slate-500">{title}</span>
      <div className="flex flex-wrap gap-1">
        {skills.length ? (
          skills.map((skill) => (
            <span
              key={skill}
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                variant === "missing" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {formatSkill(skill)}
            </span>
          ))
        ) : (
          <span className="text-xs text-slate-500">None</span>
        )}
      </div>
    </div>
  );
}

interface IconButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  tone?: "accent" | "danger" | "neutral";
  disabled?: boolean;
  showLabel?: boolean;
}

function IconButton({ label, icon, onClick, tone = "neutral", disabled = false, showLabel = false }: IconButtonProps) {
  const palette = {
    accent: "border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-600 hover:from-indigo-100 hover:to-purple-100 hover:shadow-md hover:shadow-indigo-100",
    danger: "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:shadow-md hover:shadow-red-100",
    neutral: "border-slate-200 bg-white text-slate-500 hover:bg-gradient-to-br hover:from-indigo-50/50 hover:to-purple-50/50 hover:border-indigo-200 hover:text-indigo-600"
  } as const;

  const baseClasses = showLabel
    ? "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm"
    : "inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm";

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      className={`${baseClasses} transition-all focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1 ${
        palette[tone]
      } ${disabled ? "pointer-events-none opacity-50" : ""}`}
      onClick={onClick}
    >
      {icon}
      {showLabel ? <span className="font-semibold">{label}</span> : <span className="sr-only">{label}</span>}
    </button>
  );
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

function sanitizeFileName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.warn("Clipboard copy failed", error);
  }
}
