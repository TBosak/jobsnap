import type { JobAdapter, JobPageExtract } from "./types";

export const adzunaJobAdapter: JobAdapter = {
  canHandle(_doc, url) {
    return url.hostname.includes("adzuna.com");
  },
  extract(doc): JobPageExtract | null {
    let text = "";

    // Try to find job description container
    const descriptionContainer =
      doc.querySelector('.job-description') ||
      doc.querySelector('[class*="description"]') ||
      doc.querySelector('article') ||
      doc.querySelector('main');

    if (descriptionContainer) {
      // Get all text content from paragraphs, lists, and headings
      const textElements = descriptionContainer.querySelectorAll("p, li, h2, h3, h4, div");
      const textParts: string[] = [];
      const seenText = new Set<string>();

      textElements.forEach((el) => {
        const txt = el.textContent?.trim();
        // Filter out very short text and duplicates
        if (txt && txt.length > 20 && !seenText.has(txt)) {
          seenText.add(txt);
          textParts.push(txt);
        }
      });

      text = textParts.join("\n\n");
    }

    if (!text || text.length < 200) {
      return null;
    }

    // Extract title from h1
    const title = doc.querySelector("h1")?.textContent?.trim();

    // Extract company name
    let company: string | undefined;
    const companyElement =
      doc.querySelector('.company-name') ||
      doc.querySelector('[class*="company"]') ||
      doc.querySelector('h2');

    if (companyElement) {
      company = companyElement.textContent?.trim();
    }

    // Try meta tags as fallback
    if (!company) {
      const metaCompany = doc.querySelector('meta[property="og:site_name"]');
      if (metaCompany instanceof HTMLMetaElement) {
        company = metaCompany.content;
      }
    }

    return {
      title,
      company,
      text
    };
  }
};
