import { nanoid } from "nanoid";
import { db } from "./db";
import type { JDCollection, JDItem, JDKeyword } from "../ui-shared/types.jd";
import {
  buildJobSignature,
  canonicalizeJobUrl,
  hashJobDescription,
  normalizeJobTerm
} from "../ui-shared/jd-normalize";

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

export async function createCollection(name: string): Promise<string> {
  const id = makeId();
  const now = Date.now();
  const collection: JDCollection = {
    id,
    name,
    createdAt: now,
    updatedAt: now
  };
  await db.jd_collections.add(collection);
  return id;
}

export async function listCollections(): Promise<JDCollection[]> {
  return db.jd_collections.orderBy("updatedAt").reverse().toArray();
}

export async function renameCollection(id: string, name: string): Promise<void> {
  const now = Date.now();
  await db.jd_collections.update(id, { name, updatedAt: now });
}

export async function deleteCollection(id: string): Promise<void> {
  await db.transaction("rw", db.jd_items, db.jd_collections, async () => {
    await db.jd_items.where({ collectionId: id }).delete();
    await db.jd_collections.delete(id);
  });
}

export interface AddJDItemInput {
  source: JDItem["source"];
  title?: string;
  company?: string;
  text: string;
  tokens?: number;
  tags?: string[];
}

export async function addJDItem(collectionId: string, payload: AddJDItemInput): Promise<string> {
  const id = makeId();
  const now = Date.now();
  const canonicalUrl = payload.source.url ? canonicalizeJobUrl(payload.source.url) : undefined;
  const normalizedTitle = normalizeJobTerm(payload.title);
  const normalizedCompany = normalizeJobTerm(payload.company);
  const signature = buildJobSignature(payload.title, payload.company);
  const trimmedText = payload.text.trim();
  const descHash = trimmedText.length ? hashJobDescription(trimmedText.slice(0, 1200)) : undefined;
  const item: JDItem = {
    id,
    collectionId,
    source: payload.source,
    title: payload.title,
    company: payload.company,
    text: payload.text,
    tokens: payload.tokens,
    emb: null,
    tags: normalizeTags(payload.tags),
    skills: undefined,
    gaps: undefined,
    canonicalUrl,
    normalizedTitle,
    normalizedCompany,
    signature,
    descHash
  };

  await db.transaction("rw", db.jd_items, db.jd_collections, async () => {
    await db.jd_items.add(item);
    await db.jd_collections.update(collectionId, { updatedAt: now, keywords: undefined, keywordsUpdatedAt: undefined });
  });

  return id;
}

export async function listJDItems(collectionId: string): Promise<JDItem[]> {
  const index = db.jd_items.where({ collectionId });
  // Dexie cannot orderBy an expression, so we sort after fetching.
  const items = await index.toArray();
  return items.sort((a, b) => b.source.capturedAt - a.source.capturedAt);
}

export async function getJDItem(id: string): Promise<JDItem | undefined> {
  return await db.jd_items.get(id);
}

export async function removeJDItem(id: string): Promise<void> {
  const item = await db.jd_items.get(id);
  await db.jd_items.delete(id);
  if (item?.collectionId) {
    await db.jd_collections.update(item.collectionId, {
      keywords: undefined,
      keywordsUpdatedAt: undefined,
      updatedAt: Date.now()
    });
  }
}

export async function upsertItemEmbedding(id: string, emb: number[]): Promise<void> {
  await db.jd_items.update(id, { emb });
}

export async function updateCollectionKeywords(collectionId: string, keywords: JDKeyword[]): Promise<void> {
  await db.jd_collections.update(collectionId, {
    keywords,
    keywordsUpdatedAt: Date.now()
  });
}

export async function updateJDItemSkills(id: string, skills: string[]): Promise<void> {
  const normalized = Array.from(new Set(skills.map((skill) => skill.toLowerCase().trim()).filter(Boolean)));
  const item = await db.jd_items.get(id);
  if (!item) return;
  await db.transaction("rw", db.jd_items, db.jd_collections, async () => {
    await db.jd_items.update(id, { skills: normalized.length ? normalized : undefined });
    await db.jd_collections.update(item.collectionId, { updatedAt: Date.now() });
  });
}

export async function updateJDItemGap(
  id: string,
  payload: { profileId: string; matched: string[]; missing: string[] }
): Promise<void> {
  const item = await db.jd_items.get(id);
  if (!item) return;
  const { profileId, matched, missing } = payload;
  const normalizedMatched = Array.from(new Set(matched.map((skill) => skill.toLowerCase().trim()).filter(Boolean)));
  const normalizedMissing = Array.from(new Set(missing.map((skill) => skill.toLowerCase().trim()).filter(Boolean)));
  const nextGaps = { ...(item.gaps ?? {}) };
  nextGaps[profileId] = {
    profileId,
    matched: normalizedMatched,
    missing: normalizedMissing,
    updatedAt: Date.now()
  };
  await db.transaction("rw", db.jd_items, db.jd_collections, async () => {
    await db.jd_items.update(id, { gaps: nextGaps });
    await db.jd_collections.update(item.collectionId, { updatedAt: Date.now() });
  });
}

export async function updateJDItemTags(id: string, tags: string[]): Promise<void> {
  const normalized = normalizeTags(tags);
  const item = await db.jd_items.get(id);
  await db.transaction("rw", db.jd_items, db.jd_collections, async () => {
    await db.jd_items.update(id, { tags: normalized });
    if (item?.collectionId) {
      await db.jd_collections.update(item.collectionId, { updatedAt: Date.now() });
    }
  });
}

function normalizeTags(tags?: string[] | null): string[] | undefined {
  if (!tags || !tags.length) {
    return undefined;
  }
  const unique = Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
        .map((tag) => tag.toLowerCase())
    )
  );
  return unique.length ? unique : undefined;
}
