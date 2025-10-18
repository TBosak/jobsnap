import type { JobAdapter, JobPageExtract } from "./types";

export const ycombinatorJobAdapter: JobAdapter = {
  canHandle(_doc, url) {
    return url.hostname === "www.ycombinator.com" && url.pathname.includes("/jobs/");
  },
  extract(doc): JobPageExtract | null {
    // Try to find job description content
    // YC job pages have minimal class structure, rely on semantic HTML
    let text = "";

    // Look for main content area - typically within main tag or primary article
    const mainContent = doc.querySelector("main") || doc.querySelector("article") || doc.body;

    if (mainContent) {
      // Get all text content from paragraphs, lists, and headings
      const textElements = mainContent.querySelectorAll("p, li, h2, h3, h4, h5");
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

    // Extract title from h1
    const title = doc.querySelector("h1")?.textContent?.trim();

    // Extract company name from link pattern or breadcrumb
    let company: string | undefined;
    const companyLink = doc.querySelector('a[href*="/companies/"]');
    if (companyLink) {
      company = companyLink.textContent?.trim();
    }

    // Fallback: look for company name in URL
    if (!company) {
      const companyMatch = doc.location.pathname.match(/\/companies\/([^/]+)/);
      if (companyMatch) {
        company = companyMatch[1];
      }
    }

    return {
      title,
      company,
      text
    };
  }
};
