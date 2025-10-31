import type { JobPageExtract } from "./types";
import type { JobAdapter } from "./types";
import { linkedInJobsAdapter } from "./linkedin";
import { leverJobAdapter } from "./lever";
import { greenhouseJobAdapter } from "./greenhouse";
import { workdayJobAdapter } from "./workday";
import { ycombinatorJobAdapter } from "./ycombinator";
import { workAtAStartupJobAdapter } from "./workatastartup";
import { adzunaJobAdapter } from "./adzuna";
import { oracleJobAdapter } from "./oracle";
import { magnitJobAdapter } from "./magnit";
import { taleoJobAdapter } from "./taleo";
import { adpJobAdapter } from "./adp";
import { ultiproJobAdapter } from "./ultipro";
import { breezyJobAdapter } from "./breezy";
import { workableJobAdapter } from "./workable";
import { genericJobAdapter } from "./generic";

const ADAPTERS: JobAdapter[] = [
  linkedInJobsAdapter,
  leverJobAdapter,
  greenhouseJobAdapter,
  workdayJobAdapter,
  oracleJobAdapter,
  ycombinatorJobAdapter,
  workAtAStartupJobAdapter,
  adzunaJobAdapter,
  magnitJobAdapter,
  taleoJobAdapter,
  adpJobAdapter,
  ultiproJobAdapter,
  breezyJobAdapter,
  workableJobAdapter,
  genericJobAdapter
];

export async function extractJobPosting(doc: Document, url: URL): Promise<JobPageExtract | null> {
  for (const adapter of ADAPTERS) {
    try {
      if (adapter.canHandle(doc, url)) {
        const extract = await adapter.extract(doc, url);
        if (extract && extract.text && extract.text.trim().length > 200) {
          return extract;
        }
      }
    } catch (error) {
      console.warn("JobSnap adapter error", error);
    }
  }
  return null;
}
