export interface JDCollection {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  keywords?: JDKeyword[];
  keywordsUpdatedAt?: number;
  topTags?: string[];
}

export interface JDItemSource {
  host: string;
  url?: string;
  capturedAt: number;
}

export interface JDItem {
  id: string;
  collectionId: string;
  source: JDItemSource;
  title?: string;
  company?: string;
  text: string;
  tokens?: number;
  emb?: number[] | null;
  tags?: string[];
  skills?: string[];
  gaps?: Record<string, JDItemGap>;
  canonicalUrl?: string;
  normalizedTitle?: string;
  normalizedCompany?: string;
  signature?: string;
  descHash?: string;
}

export interface JDKeyword {
  term: string;
  score: number;
}

export interface JDItemGap {
  profileId: string;
  matched: string[];
  missing: string[];
  updatedAt: number;
}
