import type { JsonResume } from "./schema";
import type { JDCollection, JDItem } from "./types.jd";
import type { JobFillEvent, JobFillStatus } from "./types.history";

export type Msg =
  | { type: "GET_ACTIVE_PROFILE" }
  | { type: "SET_ACTIVE_PROFILE"; id: string }
  | { type: "GET_PROFILE"; id: string }
  | { type: "LIST_PROFILE_INDEX" }
  | { type: "UPSERT_PROFILE"; profile: ProfilePayload }
  | { type: "CREATE_PROFILE"; name: string; resume: JsonResume }
  | { type: "DELETE_PROFILE"; id: string }
  | { type: "IMPORT_FROM_LINKEDIN" }
  | { type: "JD_CREATE_COLLECTION"; name: string }
  | { type: "JD_LIST_COLLECTIONS" }
  | { type: "JD_RENAME_COLLECTION"; id: string; name: string }
  | { type: "JD_DELETE_COLLECTION"; id: string }
  | { type: "JD_ADD_ITEM"; payload: JDAddItemPayload }
  | { type: "JD_LIST_ITEMS"; collectionId: string }
  | { type: "JD_GET_ITEM"; id: string }
  | { type: "JD_LIST_BY_HOST"; host: string }
  | { type: "JD_REMOVE_ITEM"; id: string }
  | { type: "JD_UPSERT_EMBEDDING"; id: string; emb: number[] }
  | { type: "JD_UPDATE_ITEM_TAGS"; id: string; tags: string[] }
  | { type: "JD_SET_ITEM_SKILLS"; id: string; skills: string[] }
  | { type: "JD_SET_ITEM_GAP"; id: string; profileId: string; matched: string[]; missing: string[] }
  | { type: "JD_SET_KEYWORDS"; collectionId: string; keywords: JDKeyword[] }
  | { type: "PROFILE_SET_COMPUTED_SKILLS"; id: string; skills: string[]; computedAt: string }
  | { type: "HISTORY_LOG_AUTOFILL"; payload: HistoryLogPayload }
  | { type: "HISTORY_LIST"; params?: HistoryListParams }
  | { type: "HISTORY_SET_STATUS"; id: string; status: JobFillStatus }
  | { type: "HISTORY_SET_NOTE"; id: string; note: string }
  | { type: "HISTORY_LINK_JD"; historyId: string; jdItemId: string | null }
  | { type: "HISTORY_REMOVE"; id: string }
  | { type: "HISTORY_CLEAR" };

export type Reply<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export interface ProfileIndexItem {
  id: string;
  name: string;
  updatedAt: string;
  isActive: boolean;
  resume: JsonResume;
  createdAt: string;
  completeness?: number;
}

export interface ProfilePayload {
  id?: string;
  name: string;
  resume: JsonResume;
  updatedAt: string;
  computedSkills?: string[];
  computedAt?: string;
}

export interface JDAddItemPayload {
  collectionId: string;
  source: JDItem["source"];
  title?: string;
  company?: string;
  text: string;
  tokens?: number;
  tags?: string[];
}

export interface HistoryLogPayload {
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

export interface HistoryListParams {
  q?: string;
  status?: JobFillStatus | "all";
  host?: string;
  limit?: number;
  offset?: number;
  from?: number;
  to?: number;
}

export type JDCollectionsReply = JDCollection[];
export type JDItemsReply = JDItem[];
export type HistoryListReply = JobFillEvent[];
