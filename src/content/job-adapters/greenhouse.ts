import type { JobAdapter } from "./types";

interface GreenhouseStructuredJob {
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
      const payload = JSON.parse(raw) as GreenhouseStructuredJob | GreenhouseStructuredJob[];
      const candidate = Array.isArray(payload)
        ? payload.find((item) => item?.["@type"]?.toLowerCase() === "jobposting")
        : payload;
      if (candidate && (candidate.description || candidate.title)) {
        return candidate;
      }
    } catch (error) {
      console.warn("JobSnap greenhouse JSON parse failed", error);
    }
  }
  return null;
}

function findDescription(doc: Document): HTMLElement | null {
  const selectors = [
    ".job__description.body",
    ".job__description",
    "#content [data-qa='posting-description']",
    "#content .opening .content",
    "#content .section-wrapper",
    "#content",
    "[data-qa='job-description']",
    "article"
  ];

  for (const selector of selectors) {
    const el = doc.querySelector<HTMLElement>(selector);
    if (el && el.innerHTML.trim().length > 200) {
      return el;
    }
  }
  return null;
}

function findTitle(doc: Document): string | undefined {
  const title = doc
    .querySelector<HTMLElement>(
      ".job__title h1, h1.section-header, #content h1, .posting-headline h1, .opening h1, [data-qa='posting-name'], [data-qa='job-title']"
    )
    ?.innerText.trim();
  return title || undefined;
}

function findCompany(doc: Document, url: URL): string | undefined {
  const headline = doc
    .querySelector<HTMLElement>('.company-name, [data-qa="company-name"], .job__company')
    ?.innerText.trim();
  if (headline) {
    return headline;
  }

  // Try extracting from logo alt text
  const logoAlt = doc
    .querySelector<HTMLImageElement>('.logo img, .image-container img')
    ?.alt?.trim();
  if (logoAlt && logoAlt.toLowerCase().includes('logo')) {
    const company = logoAlt.replace(/\s*logo\s*/i, '').trim();
    if (company) {
      return company;
    }
  }

  const metaCompany = doc
    .querySelector<HTMLMetaElement>("meta[property='og:site_name'], meta[name='twitter:site']")
    ?.getAttribute("content")
    ?.replace(/^@/, "")
    ?.trim();
  if (metaCompany) {
    return metaCompany;
  }

  const hostnameParts = url.hostname.split(".");
  if (hostnameParts.length >= 3) {
    const maybeCompany = hostnameParts.slice(0, -2).pop();
    if (maybeCompany && maybeCompany !== "boards" && maybeCompany !== "job-boards") {
      return maybeCompany;
    }
  }

  return undefined;
}

export const greenhouseJobAdapter: JobAdapter = {
  canHandle(_doc, url) {
    return url.hostname.endsWith(".greenhouse.io");
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

    const text = description.innerHTML;
    const title = findTitle(doc);
    const company = findCompany(doc, url);

    return {
      title,
      company,
      text
    };
  }
};
