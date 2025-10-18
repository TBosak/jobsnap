import type { JobAdapter, JobPageExtract } from "./types";

export const workdayJobAdapter: JobAdapter = {
  canHandle(_doc, url) {
    return url.hostname.includes("myworkdayjobs.com") || url.hostname.includes("workday.com");
  },
  extract(doc): JobPageExtract | null {
    // Workday uses data-automation-id attributes extensively
    let text = "";

    // Try to find job description using Workday's data attributes
    const descriptionContainer =
      doc.querySelector('[data-automation-id="jobPostingDescription"]') ||
      doc.querySelector('[data-automation-id="job-description"]') ||
      doc.querySelector('.job-description') ||
      doc.querySelector('[role="main"]');

    if (descriptionContainer) {
      text = descriptionContainer.textContent?.trim() || "";
    }

    // Fallback: get all paragraphs and lists from main content
    if (!text || text.length < 200) {
      const mainContent = doc.querySelector("main") || doc.body;
      const textElements = mainContent.querySelectorAll("p, li, h2, h3, h4");
      const textParts: string[] = [];

      textElements.forEach((el) => {
        const txt = el.textContent?.trim();
        if (txt && txt.length > 0) {
          textParts.push(txt);
        }
      });

      text = textParts.join("\n\n");
    }

    if (!text || text.length < 200) {
      return null;
    }

    // Extract title
    const title =
      doc.querySelector('[data-automation-id="jobPostingHeader"]')?.textContent?.trim() ||
      doc.querySelector('h1')?.textContent?.trim() ||
      doc.querySelector('h2')?.textContent?.trim();

    // Extract company name - Workday sites are usually company-specific
    let company: string | undefined;
    const companyElement =
      doc.querySelector('[data-automation-id="company"]') ||
      doc.querySelector('.company-name') ||
      doc.querySelector('meta[property="og:site_name"]');

    if (companyElement) {
      company = companyElement instanceof HTMLMetaElement
        ? companyElement.content
        : companyElement.textContent?.trim();
    }

    // Fallback: extract from URL hostname
    if (!company) {
      const hostMatch = doc.location.hostname.match(/^([^.]+)\./);
      if (hostMatch && hostMatch[1] !== 'www') {
        company = hostMatch[1];
      }
    }

    return {
      title,
      company,
      text
    };
  }
};
