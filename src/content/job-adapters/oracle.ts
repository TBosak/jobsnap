import type { JobAdapter, JobPageExtract } from "./types";

export const oracleJobAdapter: JobAdapter = {
  canHandle(_doc, url) {
    return url.hostname.includes("oraclecloud.com") &&
           url.pathname.includes("/CandidateExperience/");
  },
  extract(doc): JobPageExtract | null {
    let text = "";

    // Oracle Cloud uses specific class patterns for job details
    const descriptionContainer =
      doc.querySelector('.job-details__description') ||
      doc.querySelector('.job-description') ||
      doc.querySelector('[class*="description"]') ||
      doc.querySelector('main') ||
      doc.querySelector('[role="main"]');

    if (descriptionContainer) {
      text = descriptionContainer.textContent?.trim() || "";
    }

    // Fallback: get all paragraphs and lists from main content
    if (!text || text.length < 200) {
      const mainContent = doc.querySelector("main") || doc.body;
      const textElements = mainContent.querySelectorAll("p, li, h2, h3, h4, div");
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
      // Try to get from meta description as fallback
      const metaDesc = doc.querySelector('meta[property="og:description"]');
      if (metaDesc instanceof HTMLMetaElement) {
        text = metaDesc.content || "";
      }
    }

    if (!text || text.length < 200) {
      return null;
    }

    // Extract title
    const title =
      doc.querySelector('.job-details__title')?.textContent?.trim() ||
      doc.querySelector('.heading.job-details__title')?.textContent?.trim() ||
      doc.querySelector('h1')?.textContent?.trim() ||
      doc.querySelector('h2')?.textContent?.trim();

    // Extract company name
    let company: string | undefined;

    // Try to get from page title or meta tags
    const pageTitle = doc.querySelector('title')?.textContent?.trim();
    if (pageTitle && pageTitle !== "Oracle" && pageTitle !== "Career Opportunities") {
      company = pageTitle;
    }

    if (!company) {
      const metaSite = doc.querySelector('meta[property="og:site_name"]');
      if (metaSite instanceof HTMLMetaElement) {
        company = metaSite.content;
      }
    }

    // Try company-specific selectors
    if (!company) {
      const companyElement =
        doc.querySelector('.company-name') ||
        doc.querySelector('[class*="company"]');

      if (companyElement) {
        company = companyElement.textContent?.trim();
      }
    }

    return {
      title,
      company,
      text
    };
  }
};
