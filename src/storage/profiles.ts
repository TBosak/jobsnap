import { ProfileRecord } from "../ui-shared/schema";
import type { ProfileIndexItem, ProfilePayload } from "../ui-shared/messaging";
import { db } from "../db/db";
import { calculateCompleteness } from "../ui-shared/utils/profile-completeness";

const ACTIVE_PROFILE_KEY = "jobsnap.activeProfile";

async function readProfiles(): Promise<ProfileRecord[]> {
  return await db.profiles.toArray();
}

async function readActiveProfileId(): Promise<string | undefined> {
  const result = await chrome.storage.sync.get(ACTIVE_PROFILE_KEY);
  return result[ACTIVE_PROFILE_KEY] as string | undefined;
}

async function writeActiveProfileId(id: string | undefined): Promise<void> {
  if (id) {
    await chrome.storage.sync.set({ [ACTIVE_PROFILE_KEY]: id });
  } else {
    await chrome.storage.sync.remove(ACTIVE_PROFILE_KEY);
  }
}

export async function listProfileIndex(): Promise<ProfileIndexItem[]> {
  const [profiles, activeId] = await Promise.all([readProfiles(), readActiveProfileId()]);
  return profiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    updatedAt: profile.updatedAt,
    createdAt: profile.createdAt || profile.updatedAt,
    isActive: profile.id === activeId,
    resume: profile.resume,
    completeness: calculateCompleteness(profile)
  }));
}

export async function getProfile(id: string): Promise<ProfileRecord | undefined> {
  const profiles = await readProfiles();
  return profiles.find((record) => record.id === id);
}

export async function getActiveProfileId(): Promise<string | undefined> {
  return readActiveProfileId();
}

export async function setActiveProfile(id: string): Promise<void> {
  const profiles = await readProfiles();
  const exists = profiles.some((profile) => profile.id === id);
  if (!exists) {
    throw new Error("ACTIVE_PROFILE_NOT_FOUND");
  }
  await writeActiveProfileId(id);
}

export async function upsertProfile(payload: ProfilePayload): Promise<void> {
  const id = ensureProfileId(payload.id);
  const now = new Date().toISOString();

  const existing = await db.profiles.get(id);
  const nextRecord: ProfileRecord = {
    id,
    name: payload.name,
    createdAt: existing?.createdAt ?? payload.updatedAt ?? now,
    updatedAt: now,
    resume: payload.resume,
    notes: undefined,
    tags: undefined,
    computedSkills: payload.computedSkills ?? existing?.computedSkills,
    computedAt: payload.computedAt ?? existing?.computedAt ?? now
  };

  await db.profiles.put(nextRecord);

  const activeId = await readActiveProfileId();
  if (!activeId) {
    await writeActiveProfileId(nextRecord.id);
  }
}

export async function deleteProfile(id: string): Promise<void> {
  await db.profiles.delete(id);
  const activeId = await readActiveProfileId();
  if (activeId === id) {
    const profiles = await readProfiles();
    await writeActiveProfileId(profiles[0]?.id);
  }
}

export async function setProfileComputedSkills(id: string, skills: string[], computedAt: string): Promise<void> {
  const profile = await db.profiles.get(id);
  if (!profile) return;

  await db.profiles.update(id, {
    computedSkills: Array.from(new Set(skills.map((skill) => skill.toLowerCase().trim()).filter(Boolean))),
    computedAt
  });
}

function ensureProfileId(id: string | undefined): string {
  if (id) return id;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}
