import type { JobAdapter, JobPageExtract } from "./types";

export const linkedInJobsAdapter: JobAdapter = {
  canHandle(_doc, url) {
    return /linkedin\.com$/.test(url.hostname) && /jobs/.test(url.pathname);
  },
  extract(doc): JobPageExtract | null {
    const description = doc.querySelector<HTMLElement>(".jobs-description__content") ||
      doc.querySelector<HTMLElement>("article[data-test-job-description]");
    if (!description) return null;
    const title = doc.querySelector<HTMLElement>(".top-card-layout__title")?.innerText?.trim() ||
      doc.querySelector<HTMLElement>("h1")?.innerText?.trim();
    const company = doc.querySelector<HTMLElement>(".topcard__flavor");
    const text = description.innerText?.trim();
    if (!text) return null;
    return {
      title,
      company: company?.innerText?.trim(),
      text
    };
  }
};
