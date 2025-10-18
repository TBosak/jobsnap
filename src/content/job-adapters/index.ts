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
  genericJobAdapter
];

export function extractJobPosting(doc: Document, url: URL): JobPageExtract | null {
  for (const adapter of ADAPTERS) {
    try {
      if (adapter.canHandle(doc, url)) {
        const extract = adapter.extract(doc, url);
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
