import type { JobAdapter, JobPageExtract } from "./types";

function extractFromDocument(doc: Document): JobPageExtract | null {
  let text = "";

  // UltiPro uses various selectors for job description
  // Common patterns include: .job-description, .opportunity-description, #job-description
  const descriptionSelectors = [
    ".opportunity-description",
    ".job-description",
    "#job-description",
    "[data-bind*='description']",
    ".job-details",
    ".job-detail-description"
  ];

  let descriptionContainer: HTMLElement | null = null;
  for (const selector of descriptionSelectors) {
    descriptionContainer = doc.querySelector<HTMLElement>(selector);
    if (descriptionContainer) {
      break;
    }
  }

  // Fallback: look for main content area
  if (!descriptionContainer) {
    descriptionContainer = doc.querySelector<HTMLElement>("main") ||
                          doc.querySelector<HTMLElement>("[role='main']");
  }

  if (descriptionContainer) {
    // Clone and remove unwanted elements
    const clone = descriptionContainer.cloneNode(true) as HTMLElement;

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
      "nav",
      ".social-share",
      ".share-job"
    ];

    for (const selector of unwantedSelectors) {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    }

    text = clone.innerHTML.trim();
  }

  if (!text || text.length < 200) {
    return null;
  }

  // Extract title - UltiPro often uses h1 or specific classes
  let title: string | undefined;
  const titleSelectors = [
    ".opportunity-title",
    ".job-title",
    "h1.title",
    "h1",
    ".posting-title",
    "[data-bind*='title']"
  ];

  for (const selector of titleSelectors) {
    const titleElement = doc.querySelector<HTMLElement>(selector);
    if (titleElement) {
      const titleText = titleElement.innerText?.trim() || titleElement.textContent?.trim();
      if (titleText && titleText.length > 0 &&
          !titleText.toLowerCase().includes('career') &&
          !titleText.toLowerCase().includes('ultipro')) {
        title = titleText;
        break;
      }
    }
  }

  // Fallback: try page title
  if (!title) {
    const pageTitle = doc.title;
    if (pageTitle) {
      // UltiPro often formats as "Job Title | Company" or "Job Title - Company"
      const parts = pageTitle.split(/[|\-]/).map(p => p.trim());
      if (parts.length > 0) {
        const titleCandidate = parts[0];
        if (titleCandidate &&
            !titleCandidate.toLowerCase().includes('career') &&
            !titleCandidate.toLowerCase().includes('recruitment') &&
            !titleCandidate.toLowerCase().includes('ultipro')) {
          title = titleCandidate;
        }
      }
    }
  }

  // Extract company
  let company: string | undefined;

  const companySelectors = [
    ".company-name",
    ".employer-name",
    "[class*='company']",
    "[class*='employer']",
    ".organization-name",
    "[data-bind*='company']"
  ];

  for (const selector of companySelectors) {
    const el = doc.querySelector<HTMLElement>(selector);
    if (el) {
      const companyText = el.innerText?.trim() || el.textContent?.trim();
      if (companyText &&
          companyText.length > 0 &&
          !companyText.toLowerCase().includes('ultipro')) {
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
    if (metaCompany && !metaCompany.toLowerCase().includes('ultipro')) {
      company = metaCompany;
    }
  }

  // Try extracting from page title
  if (!company) {
    const pageTitle = doc.title;
    if (pageTitle) {
      const parts = pageTitle.split(/[|\-]/).map(p => p.trim());
      if (parts.length > 1) {
        const companyCandidate = parts[parts.length - 1];
        if (companyCandidate &&
            !companyCandidate.toLowerCase().includes('career') &&
            !companyCandidate.toLowerCase().includes('ultipro')) {
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

export const ultiproJobAdapter: JobAdapter = {
  canHandle(_doc, url) {
    return url.hostname.includes("ultipro.com") &&
           (url.pathname.includes("/JobBoard") ||
            url.pathname.includes("/OpportunityDetail") ||
            url.pathname.includes("/Opportunity"));
  },
  extract(doc, url): JobPageExtract | null {
    return extractFromDocument(doc);
  }
};
