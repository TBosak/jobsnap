import type { JobAdapter, JobPageExtract } from "./types";

export const workAtAStartupJobAdapter: JobAdapter = {
  canHandle(_doc, url) {
    return url.hostname === "www.workatastartup.com" && url.pathname.startsWith("/jobs/");
  },
  extract(doc): JobPageExtract | null {
    // Try JSON-LD structured data first (most reliable)
    const jsonLdScript = doc.querySelector('script[type="application/ld+json"]');
    if (jsonLdScript && jsonLdScript.textContent) {
      try {
        const jsonLd = JSON.parse(jsonLdScript.textContent);
        if (jsonLd["@type"] === "JobPosting") {
          const description = jsonLd.description || "";
          if (description.length > 200) {
            return {
              title: jsonLd.title || jsonLd.name,
              company: jsonLd.hiringOrganization?.name,
              text: description
            };
          }
        }
      } catch (e) {
        // JSON-LD parse error, fall through to DOM parsing
      }
    }

    // Fallback: Parse DOM structure
    let text = "";

    // Look for main content
    const mainContent = doc.querySelector("main") || doc.querySelector("article") || doc.body;

    if (mainContent) {
      // Get all text content from paragraphs, lists, and headings
      const textElements = mainContent.querySelectorAll("p, li, h2, h3, h4, h5, div");
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

    // Extract company name - look for logo links or company headings
    let company: string | undefined;
    const companyLogo = doc.querySelector(".small_logos, [class*='company'], [class*='logo']");
    if (companyLogo) {
      company = companyLogo.getAttribute("alt") || companyLogo.textContent?.trim();
    }

    // Fallback: look for company in h2 or nearby title
    if (!company) {
      const h2 = doc.querySelector("h2");
      if (h2) {
        company = h2.textContent?.trim();
      }
    }

    return {
      title,
      company,
      text
    };
  }
};
