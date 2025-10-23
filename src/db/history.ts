import { nanoid } from "nanoid";
import { db } from "./db";
import type { JobFillEvent, JobFillMilestones, JobFillStatus } from "../ui-shared/types.history";

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  try {
    return nanoid();
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

interface AddHistoryPayload {
  host: string;
  url?: string;
  title?: string;
  company?: string;
  profileId?: string;
  collectionId?: string;
  jdItemId?: string;
  note?: string;
  status?: JobFillStatus;
  canonicalUrl?: string;
  signature?: string;
  descHash?: string;
  matchTier?: string;
  matchScore?: number;
}

export async function addHistory(payload: AddHistoryPayload): Promise<string> {
  // Check for duplicates within the same minute to avoid autofill+save creating two entries
  const oneMinuteAgo = Date.now() - 60 * 1000;

  const recentDuplicate = await db.job_history
    .where("host")
    .equals(payload.host)
    .filter(event => {
      // Only check entries from the last minute
      if (event.createdAt < oneMinuteAgo) return false;

      // Match by canonicalUrl if available (highest priority)
      if (payload.canonicalUrl && event.canonicalUrl === payload.canonicalUrl) {
        return true;
      }

      // Match by descHash if available (content-based match)
      if (payload.descHash && event.descHash === payload.descHash) {
        return true;
      }

      // Match by signature (title + company) - exact match
      if (payload.signature && event.signature === payload.signature) {
        return true;
      }

      // Fuzzy signature match: check if signatures contain the same words
      // This handles cases where title/company order differs
      if (payload.signature && event.signature) {
        const payloadWords = new Set(payload.signature.split(/[@\s]+/).filter(w => w.length > 2));
        const eventWords = new Set(event.signature.split(/[@\s]+/).filter(w => w.length > 2));

        // Check if there's significant overlap (at least 80% of words match)
        const intersection = new Set([...payloadWords].filter(w => eventWords.has(w)));
        const union = new Set([...payloadWords, ...eventWords]);
        const similarity = intersection.size / union.size;

        if (similarity >= 0.8) {
          return true;
        }
      }

      return false;
    })
    .first();

  if (recentDuplicate) {
    // Update the existing entry with any new information
    const updates: Partial<JobFillEvent> = {};

    if (payload.jdItemId && payload.jdItemId !== recentDuplicate.jdItemId) {
      updates.jdItemId = payload.jdItemId;
    }
    if (payload.collectionId && payload.collectionId !== recentDuplicate.collectionId) {
      updates.collectionId = payload.collectionId;
    }
    if (payload.matchTier && payload.matchTier !== recentDuplicate.matchTier) {
      updates.matchTier = payload.matchTier;
    }
    if (payload.matchScore != null && payload.matchScore !== recentDuplicate.matchScore) {
      updates.matchScore = payload.matchScore;
    }

    // Update title if the new one is better (has a company field separately)
    // This happens when autofill creates entry with "Company - Title" and then
    // save updates it with properly parsed title and company
    if (payload.title && payload.company && !recentDuplicate.company) {
      updates.title = payload.title;
      updates.company = payload.company;
    }

    if (Object.keys(updates).length > 0) {
      await db.job_history.update(recentDuplicate.id, updates);
    }

    return recentDuplicate.id;
  }

  // No duplicate found, create a new entry
  const id = makeId();
  const now = Date.now();
  const status = payload.status ?? "saved";
  const milestones = seedMilestones(status, now);

  const event: JobFillEvent = {
    id,
    createdAt: now,
    status,
    statusChangedAt: now,
    host: payload.host,
    url: payload.url,
    title: payload.title,
    company: payload.company,
    profileId: payload.profileId,
    collectionId: payload.collectionId,
    jdItemId: payload.jdItemId,
    canonicalUrl: payload.canonicalUrl,
    signature: payload.signature,
    descHash: payload.descHash,
    matchTier: payload.matchTier,
    matchScore: payload.matchScore,
    note: payload.note,
    milestones
  };
  await db.job_history.add(event);
  return id;
}

interface ListHistoryParams {
  q?: string;
  status?: JobFillStatus | "all";
  host?: string;
  limit?: number;
  offset?: number;
  from?: number;
  to?: number;
}

export async function listHistory(params: ListHistoryParams = {}): Promise<JobFillEvent[]> {
  const { q, status = "all", host, limit = 200, offset = 0, from, to } = params;
  let collection = db.job_history.orderBy("createdAt").reverse();

  if (status !== "all") {
    collection = collection.filter((item) => item.status === status);
  }

  if (host) {
    collection = collection.filter((item) => item.host === host);
  }

  if (from != null) {
    collection = collection.filter((item) => item.createdAt >= from);
  }

  if (to != null) {
    collection = collection.filter((item) => item.createdAt <= to);
  }

  let results = await collection.offset(offset).limit(limit).toArray();

  if (q) {
    const needle = q.toLowerCase();
    results = results.filter((item) => {
      return (
        item.title?.toLowerCase().includes(needle) ||
        item.company?.toLowerCase().includes(needle) ||
        item.host.toLowerCase().includes(needle)
      );
    });
  }

  return results;
}

export async function setHistoryStatus(id: string, status: JobFillStatus): Promise<void> {
  const event = await db.job_history.get(id);
  if (!event) return;

  const now = Date.now();
  const milestones = applyMilestone(event.milestones, status, now);
  await db.job_history.update(id, { status, statusChangedAt: now, milestones });
}

export async function setHistoryNote(id: string, note: string): Promise<void> {
  await db.job_history.update(id, { note });
}

export async function linkHistoryToJobDescription(
  id: string,
  jdItemId: string | null,
  match?: { tier?: string; score?: number; collectionId?: string | null }
): Promise<void> {
  const update: Partial<JobFillEvent> = {
    jdItemId: jdItemId ?? undefined,
    matchTier: match?.tier,
    matchScore: match?.score,
    collectionId: match?.collectionId ?? undefined
  };
  await db.job_history.update(id, update);
}

export async function removeHistory(id: string): Promise<void> {
  await db.job_history.delete(id);
}

export async function clearHistory(): Promise<void> {
  await db.job_history.clear();
}

function seedMilestones(status: JobFillStatus, at: number): JobFillMilestones {
  const milestones: JobFillMilestones = { savedAt: at };
  if (status !== "saved") {
    const key = milestoneKey(status);
    if (key) milestones[key] = at;
  }
  return milestones;
}

function applyMilestone(existing: JobFillMilestones | undefined, status: JobFillStatus, at: number): JobFillMilestones {
  const next: JobFillMilestones = { ...(existing ?? {}) };
  if (!next.savedAt) {
    next.savedAt = at;
  }
  const key = milestoneKey(status);
  if (key) {
    next[key] = at;
  }
  return next;
}

function milestoneKey(status: JobFillStatus): keyof JobFillMilestones | null {
  switch (status) {
    case "saved":
      return "savedAt";
    case "applied":
      return "appliedAt";
    case "interview":
      return "interviewAt";
    case "rejected":
      return "rejectedAt";
    case "offer":
      return "offerAt";
    default:
      return null;
  }
}
