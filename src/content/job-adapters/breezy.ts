import type { JobAdapter, JobPageExtract } from "./types";

function extractFromDocument(doc: Document): JobPageExtract | null {
  let text = "";

  // Breezy.hr uses .job-description > .description for the actual content
  const descriptionContainer = doc.querySelector<HTMLElement>(".job-description > .description");

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
      ".share"
    ];

    for (const selector of unwantedSelectors) {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    }

    text = clone.innerHTML.trim();
  }

  if (!text || text.length < 200) {
    return null;
  }

  // Extract title - Breezy.hr uses .position-header > h1
  let title: string | undefined;
  const titleElement = doc.querySelector<HTMLElement>(".position-header > h1");

  if (titleElement) {
    const titleText = titleElement.innerText?.trim() || titleElement.textContent?.trim();
    if (titleText && titleText.length > 0) {
      title = titleText;
    }
  }

  // Fallback: try page title
  if (!title) {
    const pageTitle = doc.title;
    if (pageTitle) {
      // Breezy formats as "Job Title at Company"
      const parts = pageTitle.split(" at ");
      if (parts.length > 0) {
        const titleCandidate = parts[0].trim();
        if (titleCandidate &&
            !titleCandidate.toLowerCase().includes('career') &&
            !titleCandidate.toLowerCase().includes('breezy')) {
          title = titleCandidate;
        }
      }
    }
  }

  // Extract company - Breezy.hr uses .company-name
  let company: string | undefined;
  const companyElement = doc.querySelector<HTMLElement>(".company-name");

  if (companyElement) {
    // The company name is in the <span> after the back arrow
    const companySpan = companyElement.querySelector<HTMLElement>("span");
    if (companySpan) {
      const companyText = companySpan.innerText?.trim() || companySpan.textContent?.trim();
      if (companyText && companyText.length > 0) {
        company = companyText;
      }
    }
  }

  // Fallback: try meta tags
  if (!company) {
    const metaCompany = doc
      .querySelector<HTMLMetaElement>("meta[name='twitter:data2']")
      ?.getAttribute("content")
      ?.trim();
    if (metaCompany && !metaCompany.toLowerCase().includes('breezy')) {
      company = metaCompany;
    }
  }

  // Fallback: try extracting from page title
  if (!company) {
    const pageTitle = doc.title;
    if (pageTitle) {
      // Breezy formats as "Job Title at Company"
      const parts = pageTitle.split(" at ");
      if (parts.length > 1) {
        const companyCandidate = parts[1].trim();
        if (companyCandidate &&
            !companyCandidate.toLowerCase().includes('career') &&
            !companyCandidate.toLowerCase().includes('breezy')) {
          company = companyCandidate;
        }
      }
    }
  }

  // Last resort: extract company from URL subdomain (e.g., synergetics.breezy.hr -> Synergetics)
  if (!company) {
    const hostParts = doc.location.hostname.split('.');
    if (hostParts.length > 0 && hostParts[0] !== 'www') {
      const subdomain = hostParts[0];
      // Capitalize first letter
      company = subdomain.charAt(0).toUpperCase() + subdomain.slice(1);
    }
  }

  return {
    title,
    company,
    text
  };
}

export const breezyJobAdapter: JobAdapter = {
  canHandle(_doc, url) {
    return url.hostname.includes("breezy.hr") &&
           url.pathname.includes("/p/");
  },
  extract(doc, url): JobPageExtract | null {
    return extractFromDocument(doc);
  }
};
