import type { JobAdapter } from "./types";

function pickCompany(doc: Document, url: URL): string | undefined {
  const headlineCompany = doc
    .querySelector<HTMLElement>(
      ".posting-headline [data-qa='company-name'], .posting-headline .company, .posting-headline [data-company]"
    )
    ?.innerText.trim();
  if (headlineCompany) {
    return headlineCompany;
  }

  const metaCompany = doc
    .querySelector<HTMLMetaElement>("meta[property='og:site_name'], meta[name='twitter:site']")
    ?.getAttribute("content")
    ?.replace(/^@/, "")
    ?.trim();
  if (metaCompany && metaCompany.length > 0) {
    return metaCompany;
  }

  const titleSuffix = doc.title?.split(" at ")?.[1]?.trim();
  if (titleSuffix) {
    return titleSuffix;
  }

  const hostParts = url.hostname.split(".");
  if (hostParts.length >= 3) {
    const maybeCompany = hostParts.slice(0, -2).pop();
    if (maybeCompany && maybeCompany !== "jobs" && maybeCompany !== "apply") {
      return maybeCompany;
    }
  }

  return undefined;
}

function findDescription(doc: Document): HTMLElement | null {
  // Priority 1: Most specific Lever selectors
  const specificSelectors = [
    ".posting-description",
    "[data-qa='posting-description']",
    ".posting-contents",
    ".content.description"
  ];

  for (const selector of specificSelectors) {
    const el = doc.querySelector<HTMLElement>(selector);
    if (!el) continue;
    const textLength = el.innerText?.trim().length ?? 0;
    if (textLength > 200) {
      return el;
    }
  }

  // Priority 2: Look for .posting container, but exclude header/footer
  const posting = doc.querySelector<HTMLElement>(".posting");
  if (posting) {
    // Clone to avoid modifying the DOM
    const clone = posting.cloneNode(true) as HTMLElement;

    // Remove known non-description elements
    const excludeSelectors = [
      ".posting-header",
      ".posting-headline",
      ".posting-categories",
      ".posting-apply",
      "footer",
      "nav",
      ".apply-button",
      '[class*="button"]',
      '[class*="apply"]'
    ];

    for (const exclude of excludeSelectors) {
      clone.querySelectorAll(exclude).forEach(el => el.remove());
    }

    const textLength = clone.innerText?.trim().length ?? 0;
    if (textLength > 200) {
      return clone;
    }
  }

  // Priority 3: Look for .section-wrapper within .posting
  const sectionWrapper = doc.querySelector<HTMLElement>(".posting .section-wrapper");
  if (sectionWrapper) {
    const textLength = sectionWrapper.innerText?.trim().length ?? 0;
    if (textLength > 200) {
      return sectionWrapper;
    }
  }

  // Priority 4: Fallback to content-focused structural elements
  const structuralSelectors = ["main", "article"];
  for (const selector of structuralSelectors) {
    const el = doc.querySelector<HTMLElement>(selector);
    if (!el) continue;

    // Clone and clean
    const clone = el.cloneNode(true) as HTMLElement;

    // Remove navigation, headers, footers, apply buttons
    const toRemove = [
      "nav", "header", "footer",
      '[class*="header"]',
      '[class*="nav"]',
      '[class*="footer"]',
      '[class*="apply"]',
      '[class*="button"]'
    ];

    for (const remove of toRemove) {
      clone.querySelectorAll(remove).forEach(el => el.remove());
    }

    const textLength = clone.innerText?.trim().length ?? 0;
    if (textLength > 200) {
      return clone;
    }
  }

  return null;
}

function findTitle(doc: Document): string | undefined {
  const title = doc
    .querySelector<HTMLElement>(
      ".posting-headline h2, .posting-headline h1, [data-qa='posting-name'], [data-qa='job-title'], h1"
    )
    ?.innerText.trim();
  if (title && title.length > 0) {
    return title;
  }
  const metaTitle = doc.querySelector<HTMLMetaElement>("meta[property='og:title']")?.getAttribute("content")?.trim();
  return metaTitle || undefined;
}

function extractFromJsonLd(doc: Document): { title?: string; company?: string; text: string } | null {
  // Look for JSON-LD JobPosting schema
  const jsonLdScripts = doc.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');

  for (const script of jsonLdScripts) {
    try {
      const data = JSON.parse(script.textContent || "");

      // Check if this is a JobPosting schema
      if (data["@type"] === "JobPosting" && data.description) {
        const title = data.title || undefined;
        const company = data.hiringOrganization?.name || undefined;
        const description = data.description;

        // The description in JSON-LD is often HTML-encoded or contains escaped characters
        // Clean it up by decoding HTML entities and normalizing whitespace
        return {
          title,
          company,
          text: description
        };
      }
    } catch (error) {
      // Invalid JSON, skip this script tag
      continue;
    }
  }

  return null;
}

export const leverJobAdapter: JobAdapter = {
  canHandle(_doc, url) {
    return url.hostname.endsWith(".lever.co");
  },
  extract(doc, url) {
    // Priority 1: Try to extract from JSON-LD schema (cleanest source)
    const jsonLdData = extractFromJsonLd(doc);
    if (jsonLdData && jsonLdData.text.length > 200) {
      return {
        title: jsonLdData.title || findTitle(doc),
        company: jsonLdData.company || pickCompany(doc, url),
        text: jsonLdData.text
      };
    }

    // Priority 2: Fall back to DOM extraction
    const description = findDescription(doc);
    if (!description) {
      return null;
    }

    // Clone and remove unwanted elements before extracting text
    const clone = description.cloneNode(true) as HTMLElement;

    // Remove scripts, styles, and other non-content elements
    const unwantedSelectors = [
      "script",
      "style",
      "noscript",
      "iframe",
      "footer",
      "nav",
      ".posting-apply",
      ".apply-button",
      '[class*="footer"]',
      '[class*="apply"]',
      '[class*="powered-by"]',
      '[class*="jobs-powered"]',
      '[id*="ga"]',
      '[id*="analytics"]',
      "button",
      "form",
      "link"
    ];

    for (const selector of unwantedSelectors) {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    }

    const text = clone.innerHTML || clone.textContent || "";
    if (!text.trim()) {
      return null;
    }

    const title = findTitle(doc);
    const company = pickCompany(doc, url);

    return {
      title,
      company,
      text
    };
  }
};
