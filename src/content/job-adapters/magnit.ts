import type { JobAdapter } from "./types";

interface TalentNetStructuredJob {
  "@type"?: string;
  description?: string;
  title?: string;
  name?: string;
  hiringOrganization?: {
    name?: string;
  };
}

function readStructuredJob(doc: Document) {
  const nodes = Array.from(doc.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'));
  for (const node of nodes) {
    const raw = node.textContent?.trim();
    if (!raw) continue;
    try {
      const payload = JSON.parse(raw) as TalentNetStructuredJob | TalentNetStructuredJob[];
      const candidate = Array.isArray(payload)
        ? payload.find((item) => item?.["@type"]?.toLowerCase() === "jobposting")
        : payload;
      if (candidate && (candidate.description || candidate.title)) {
        return candidate;
      }
    } catch (error) {
      console.warn("JobSnap magnit JSON parse failed", error);
    }
  }
  return null;
}

function findDescription(doc: Document): HTMLElement | null {
  const selectors = [
    "[data-testid='job-description']",
    ".job-description",
    ".job-details",
    "[class*='description']",
    "[class*='details']",
    "main",
    "article",
    "#app"
  ];

  for (const selector of selectors) {
    const el = doc.querySelector<HTMLElement>(selector);
    if (!el) continue;
    const html = el.innerHTML.trim();
    const textLength = el.innerText?.trim().length ?? 0;
    if (html.length > 200 || textLength > 200) {
      return el;
    }
  }
  return null;
}

function findTitle(doc: Document): string | undefined {
  const title = doc
    .querySelector<HTMLElement>(
      "[data-testid='job-title'], h1, .job-title, .position-title, [class*='title']"
    )
    ?.innerText.trim();
  if (title && title.length > 0) {
    return title;
  }
  const metaTitle = doc.querySelector<HTMLMetaElement>("meta[property='og:title']")?.getAttribute("content")?.trim();
  return metaTitle || undefined;
}

function findCompany(doc: Document, url: URL): string | undefined {
  // Try to extract from URL subdomain (e.g., magnit-airbnb.talentnet.community)
  const hostname = url.hostname;
  const parts = hostname.split(".");
  if (parts.length >= 3 && parts[0].includes("-")) {
    // Extract company from subdomain pattern like "magnit-airbnb"
    const subdomain = parts[0];
    const companyParts = subdomain.split("-");
    if (companyParts.length >= 2) {
      // Return the second part (e.g., "airbnb" from "magnit-airbnb")
      const company = companyParts[1];
      if (company && company !== "jobs" && company !== "apply") {
        return company.charAt(0).toUpperCase() + company.slice(1);
      }
    }
  }

  // Try to find company in DOM
  const companyEl = doc
    .querySelector<HTMLElement>(
      "[data-testid='company-name'], .company-name, [class*='company'], [class*='employer']"
    )
    ?.innerText.trim();
  if (companyEl) {
    return companyEl;
  }

  // Try meta tags
  const metaCompany = doc
    .querySelector<HTMLMetaElement>("meta[property='og:site_name'], meta[name='twitter:site']")
    ?.getAttribute("content")
    ?.replace(/^@/, "")
    ?.trim();
  if (metaCompany) {
    return metaCompany;
  }

  return undefined;
}

export const magnitJobAdapter: JobAdapter = {
  canHandle(_doc, url) {
    return url.hostname.endsWith(".talentnet.community") ||
           url.hostname.includes("magnit");
  },
  extract(doc, url) {
    const structured = readStructuredJob(doc);
    if (structured?.description) {
      return {
        title: structured.title || findTitle(doc),
        company: structured.hiringOrganization?.name || structured.name || findCompany(doc, url),
        text: structured.description
      };
    }

    const description = findDescription(doc);
    if (!description) {
      return null;
    }

    const text = description.innerHTML || description.textContent || "";
    if (!text.trim()) {
      return null;
    }

    const title = findTitle(doc);
    const company = findCompany(doc, url);

    return {
      title,
      company,
      text
    };
  }
};
