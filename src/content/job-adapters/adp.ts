import type { JobAdapter, JobPageExtract } from "./types";

function extractFromDocument(doc: Document): JobPageExtract | null {
  let text = "";

  // ADP uses .job-description-data for the actual job description content
  const descriptionContainer = doc.querySelector<HTMLElement>(".job-description-data");

  if (descriptionContainer) {
    // The content is deeply nested in multiple divs, so we need to dig down
    // to find the actual content div with id="isPasted" or the innermost content
    let contentDiv = descriptionContainer.querySelector<HTMLElement>("#isPasted");

    if (!contentDiv) {
      // If no #isPasted, try to find the deepest div with actual content
      contentDiv = descriptionContainer;
    }

    // Clone and remove unwanted elements
    const clone = contentDiv.cloneNode(true) as HTMLElement;

    const unwantedSelectors = [
      "script",
      "style",
      "noscript",
      "iframe",
      "button",
      "form",
      "input",
      ".apply-button",
      "[class*='button']",
      "[class*='apply']",
      "footer",
      "nav"
    ];

    for (const selector of unwantedSelectors) {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    }

    text = clone.innerHTML.trim();
  }

  if (!text || text.length < 200) {
    return null;
  }

  // Extract title - ADP uses h2.job-description-title
  let title: string | undefined;
  const titleElement = doc.querySelector<HTMLElement>("h2.job-description-title");

  if (titleElement) {
    const titleText = titleElement.innerText?.trim() || titleElement.textContent?.trim();
    if (titleText && titleText.length > 0) {
      title = titleText;
    }
  }

  // Try .job-description-title without h2 restriction
  if (!title) {
    const altTitleElement = doc.querySelector<HTMLElement>(".job-description-title");
    if (altTitleElement) {
      const titleText = altTitleElement.innerText?.trim() || altTitleElement.textContent?.trim();
      if (titleText && titleText.length > 0) {
        title = titleText;
      }
    }
  }

  // Last resort: Try getting from page title if not found
  if (!title) {
    const pageTitle = doc.title;
    if (pageTitle) {
      // ADP often formats as "Job Title | Company" or "Job Title - Company"
      const parts = pageTitle.split(/[|\-]/);
      if (parts.length > 0) {
        const titleCandidate = parts[0].trim();
        if (titleCandidate && !titleCandidate.toLowerCase().includes('career') &&
            !titleCandidate.toLowerCase().includes('recruitment') &&
            !titleCandidate.toLowerCase().includes('adp')) {
          title = titleCandidate;
        }
      }
    }
  }

  // Extract company
  let company: string | undefined;

  const companySelectors = [
    ".company-name",
    "[class*='company-name']",
    "[class*='companyName']",
    ".employer-name",
    "[class*='employer']"
  ];

  for (const selector of companySelectors) {
    const el = doc.querySelector<HTMLElement>(selector);
    if (el) {
      const companyText = el.innerText.trim();
      if (companyText && companyText.length > 0 && !companyText.toLowerCase().includes('adp')) {
        company = companyText;
        break;
      }
    }
  }

  // Try meta tags
  if (!company) {
    const metaCompany = doc
      .querySelector<HTMLMetaElement>("meta[property='og:site_name'], meta[name='twitter:site']")
      ?.getAttribute("content")
      ?.replace(/^@/, "")
      ?.trim();
    if (metaCompany && !metaCompany.toLowerCase().includes('adp')) {
      company = metaCompany;
    }
  }

  // Try extracting from page title
  if (!company) {
    const pageTitle = doc.title;
    if (pageTitle) {
      const parts = pageTitle.split(/[|\-]/);
      if (parts.length > 1) {
        const companyCandidate = parts[parts.length - 1].trim();
        if (companyCandidate && !companyCandidate.toLowerCase().includes('career') &&
            !companyCandidate.toLowerCase().includes('adp')) {
          company = companyCandidate;
        }
      }
    }
  }

  return {
    title,
    company,
    text
  };
}

export const adpJobAdapter: JobAdapter = {
  canHandle(_doc, url) {
    return url.hostname.includes("adp.com") &&
           (url.pathname.includes("/recruitment") || url.pathname.includes("/jobs"));
  },
  extract(doc, url): JobPageExtract | null {
    return extractFromDocument(doc);
  }
};
