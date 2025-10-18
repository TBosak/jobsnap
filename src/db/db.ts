import Dexie, { Table } from "dexie";
import type { JDCollection, JDItem } from "../ui-shared/types.jd";
import type { JobFillEvent } from "../ui-shared/types.history";
import type { ProfileRecord } from "../ui-shared/schema";
import {
  buildJobSignature,
  canonicalizeJobUrl,
  hashJobDescription,
  normalizeJobTerm
} from "../ui-shared/jd-normalize";

export class JobSnapDB extends Dexie {
  jd_collections!: Table<JDCollection, string>;
  jd_items!: Table<JDItem, string>;
  job_history!: Table<JobFillEvent, string>;
  profiles!: Table<ProfileRecord, string>;

  constructor() {
    super("jobsnap");

    this.version(1).stores({
      jd_collections: "id, name, updatedAt",
      jd_items: "id, collectionId, source.host, source.capturedAt"
    });

    this.version(2)
      .stores({
        jd_collections: "id, name, updatedAt",
        jd_items: "id, collectionId, source.host, source.capturedAt",
        job_history: "id, createdAt, status, host"
      })
      .upgrade(() => {
        // no-op upgrade: existing stores handled by Dexie
      });

    this.version(3)
      .stores({
        jd_collections: "id, name, updatedAt",
        jd_items: "id, collectionId, source.host, source.capturedAt",
        job_history: "id, createdAt, status, host, statusChangedAt"
      })
      .upgrade(async (trans) => {
        const history = trans.table("job_history");
        await history.toCollection().modify((event) => {
          if (!event.statusChangedAt) {
            event.statusChangedAt = event.createdAt ?? Date.now();
          }
          if (!event.milestones || typeof event.milestones !== "object") {
            event.milestones = { savedAt: event.createdAt ?? Date.now() };
          } else if (!event.milestones.savedAt) {
            event.milestones.savedAt = event.createdAt ?? Date.now();
          }
        });
      });

    this.version(4)
      .stores({
        jd_collections: "id, name, updatedAt",
        jd_items: "id, collectionId, category, source.host, source.capturedAt",
        job_history: "id, createdAt, status, host, statusChangedAt"
      })
      .upgrade(async (trans) => {
        const items = trans.table("jd_items");
        await items.toCollection().modify((item) => {
          if (Array.isArray(item.tags)) {
            const normalized = Array.from(
              new Set(
                item.tags
                  .map((tag: unknown) => (typeof tag === "string" ? tag.trim().toLowerCase() : ""))
                  .filter((tag: string) => tag.length > 0)
              )
            );
            item.tags = normalized.length ? normalized : undefined;
          } else {
            item.tags = undefined;
          }

          if (typeof item.category === "string") {
            const trimmed = item.category.trim();
            item.category = trimmed.length ? trimmed : null;
          } else if (item.category != null) {
            item.category = null;
          }
        });
      });

    this.version(5)
      .stores({
        jd_collections: "id, name, updatedAt",
        jd_items: "id, collectionId, category, source.host, source.capturedAt",
        job_history: "id, createdAt, status, host, statusChangedAt"
      })
      .upgrade(async (trans) => {
        const items = trans.table("jd_items");
        await items.toCollection().modify((item) => {
          if (!Array.isArray(item.skills) || !item.skills.length) {
            item.skills = undefined;
          } else {
            item.skills = Array.from(new Set(item.skills.map((skill: unknown) =>
              typeof skill === "string" ? skill.toLowerCase().trim() : ""
            ).filter((skill: string) => skill.length > 0)));
          }
          if (!item.gaps || typeof item.gaps !== "object") {
            item.gaps = undefined;
          }
        });
      });

    this.version(6)
      .stores({
        jd_collections: "id, name, updatedAt",
        jd_items: "id, collectionId, source.host, source.capturedAt",
        job_history: "id, createdAt, status, host, statusChangedAt"
      })
      .upgrade(async (trans) => {
        const items = trans.table("jd_items");
        await items.toCollection().modify((item) => {
          if ("category" in item) {
            delete (item as Record<string, unknown>).category;
          }
        });
      });

    this.version(7)
      .stores({
        jd_collections: "id, name, updatedAt",
        jd_items: "id, collectionId, source.host, source.capturedAt",
        job_history: "id, createdAt, status, host, statusChangedAt"
      })
      .upgrade(async (trans) => {
        const items = trans.table("jd_items");
        await items.toCollection().modify((item: JDItem & Record<string, any>) => {
          const sourceUrl = item.source?.url;
          if (sourceUrl) {
            item.canonicalUrl = canonicalizeJobUrl(sourceUrl);
          } else {
            delete item.canonicalUrl;
          }

          item.normalizedTitle = normalizeJobTerm(item.title) ?? undefined;
          item.normalizedCompany = normalizeJobTerm(item.company) ?? undefined;
          item.signature = buildJobSignature(item.title, item.company);

          if (typeof item.text === "string") {
            const trimmed = item.text.trim();
            item.descHash = trimmed.length ? hashJobDescription(trimmed.slice(0, 1200)) : undefined;
          } else {
            delete item.descHash;
          }
        });
      });

    this.version(8)
      .stores({
        jd_collections: "id, name, updatedAt",
        jd_items: "id, collectionId, source.host, source.capturedAt",
        job_history: "id, createdAt, status, host, statusChangedAt",
        profiles: "id, name, updatedAt"
      })
      .upgrade(async () => {
        // Migrate profiles from chrome.storage.sync to IndexedDB
        try {
          const PROFILE_KEY = "jobsnap.profiles";
          const result = await chrome.storage.sync.get(PROFILE_KEY);
          const oldProfiles = (result[PROFILE_KEY] as ProfileRecord[] | undefined) ?? [];

          if (oldProfiles.length > 0) {
            await this.profiles.bulkPut(oldProfiles);
            console.log(`Migrated ${oldProfiles.length} profiles to IndexedDB`);
          }
        } catch (error) {
          console.warn('Failed to migrate profiles from chrome.storage:', error);
        }
      });
  }
}

export const db = new JobSnapDB();
