export type JobFillStatus = "saved" | "applied" | "interview" | "rejected" | "offer";

export interface JobFillMilestones {
  savedAt?: number;
  appliedAt?: number;
  interviewAt?: number;
  rejectedAt?: number;
  offerAt?: number;
}

export interface JobFillEvent {
  id: string;
  createdAt: number;
  status: JobFillStatus;
  statusChangedAt: number;
  host: string;
  url?: string;
  title?: string;
  company?: string;
  profileId?: string;
  collectionId?: string;
  jdItemId?: string;
  canonicalUrl?: string;
  signature?: string;
  descHash?: string;
  matchTier?: string;
  matchScore?: number;
  note?: string;
  milestones?: JobFillMilestones;
}
