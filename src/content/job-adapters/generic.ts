import type { JobAdapter, JobPageExtract } from "./types";

export const genericJobAdapter: JobAdapter = {
  canHandle(doc) {
    const possible = doc.querySelector("[data-job-description], .jobsearch-JobComponent-description, #jobDescriptionText");
    return Boolean(possible);
  },
  extract(doc, url): JobPageExtract | null {
    const selectors = [
      "[data-job-description]",
      ".jobsearch-JobComponent-description",
      "#jobDescriptionText",
      "article"
    ];
    for (const selector of selectors) {
      const el = doc.querySelector<HTMLElement>(selector);
      if (el && el.innerText.trim().length > 200) {
        return {
          title: doc.querySelector<HTMLElement>("h1")?.innerText?.trim() || url.pathname,
          company: doc.querySelector<HTMLElement>("[data-company-name], .icl-u-lg-mr--sm")?.innerText?.trim(),
          text: el.innerText.trim()
        };
      }
    }
    return null;
  }
};
