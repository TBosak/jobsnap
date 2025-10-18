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
  const selectors = [
    ".posting-description",
    "[data-qa='posting-description']",
    ".posting-contents",
    ".posting .content",
    ".posting .section-wrapper",
    "main",
    "article",
    "body"
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
      ".posting-headline h2, .posting-headline h1, [data-qa='posting-name'], [data-qa='job-title'], h1"
    )
    ?.innerText.trim();
  if (title && title.length > 0) {
    return title;
  }
  const metaTitle = doc.querySelector<HTMLMetaElement>("meta[property='og:title']")?.getAttribute("content")?.trim();
  return metaTitle || undefined;
}

export const leverJobAdapter: JobAdapter = {
  canHandle(_doc, url) {
    return url.hostname.endsWith(".lever.co");
  },
  extract(doc, url) {
    const description = findDescription(doc);
    if (!description) {
      return null;
    }

    const text = description.innerHTML || description.textContent || "";
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
