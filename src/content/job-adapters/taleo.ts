import type { JobAdapter } from "./types";

interface TaleoJobPosting {
  "@type"?: string;
  title?: string;
  description?: string;
  hiringOrganization?: {
    name?: string;
    "@type"?: string;
  };
}

function extractFromJsonLd(doc: Document): { title?: string; company?: string; text: string } | null {
  // Look for JSON-LD JobPosting schema
  const jsonLdScripts = doc.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');

  for (const script of jsonLdScripts) {
    try {
      const data = JSON.parse(script.textContent || "") as TaleoJobPosting;

      // Check if this is a JobPosting schema
      if (data["@type"] === "JobPosting" && data.description) {
        const title = data.title || undefined;
        const company = data.hiringOrganization?.name || undefined;
        const description = data.description;

        // Return the HTML description from JSON-LD
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

function findDescription(doc: Document): HTMLElement | null {
  // Taleo uses specific class names and IDs for job descriptions
  const selectors = [
    "#requisitionDescriptionInterface",
    ".requisitionDescription",
    "#job-description",
    ".job-description",
    ".jobdescription",
    "#jobdescription",
    "[id*='requisitionDescription']",
    "[class*='requisitionDescription']",
    ".details",
    "#details"
  ];

  for (const selector of selectors) {
    const el = doc.querySelector<HTMLElement>(selector);
    if (el && el.innerText.trim().length > 200) {
      return el;
    }
  }

  // Fallback: look for main content area
  const main = doc.querySelector<HTMLElement>("main, #main, .main-content");
  if (main && main.innerText.trim().length > 200) {
    return main;
  }

  return null;
}

function findTitle(doc: Document): string | undefined {
  // Taleo job title selectors
  const titleSelectors = [
    "h1.jobtitle",
    "h1[id*='titleId']",
    ".jobtitle",
    "#job-title",
    ".job-title",
    "h1",
    "h2.jobtitle"
  ];

  for (const selector of titleSelectors) {
    const el = doc.querySelector<HTMLElement>(selector);
    if (el) {
      const title = el.innerText.trim();
      if (title && title.length > 0 && title.length < 200) {
        return title;
      }
    }
  }

  // Try getting from page title
  const pageTitle = doc.title;
  if (pageTitle) {
    // Taleo often formats as "Job Title | Company" or "Job Title - Company"
    const parts = pageTitle.split(/[|\-]/);
    if (parts.length > 0) {
      const title = parts[0].trim();
      if (title && !title.toLowerCase().includes('career') && !title.toLowerCase().includes('taleo')) {
        return title;
      }
    }
  }

  return undefined;
}

function findCompany(doc: Document, url: URL): string | undefined {
  // Try meta tags first
  const metaCompany = doc
    .querySelector<HTMLMetaElement>("meta[property='og:site_name'], meta[name='twitter:site']")
    ?.getAttribute("content")
    ?.replace(/^@/, "")
    ?.trim();
  if (metaCompany && !metaCompany.toLowerCase().includes('taleo')) {
    return metaCompany;
  }

  // Try common company name selectors
  const companySelectors = [
    ".company-name",
    "#company-name",
    ".company",
    "[class*='company-name']"
  ];

  for (const selector of companySelectors) {
    const el = doc.querySelector<HTMLElement>(selector);
    if (el) {
      const company = el.innerText.trim();
      if (company && company.length > 0 && !company.toLowerCase().includes('taleo')) {
        return company;
      }
    }
  }

  // Try extracting from page title
  const pageTitle = doc.title;
  if (pageTitle) {
    const parts = pageTitle.split(/[|\-]/);
    if (parts.length > 1) {
      const company = parts[parts.length - 1].trim();
      if (company && !company.toLowerCase().includes('career') && !company.toLowerCase().includes('taleo')) {
        return company;
      }
    }
  }

  // Try extracting from URL parameters
  const urlParams = new URLSearchParams(url.search);
  const orgParam = urlParams.get('org');
  if (orgParam) {
    return orgParam;
  }

  // Try extracting from subdomain
  const hostnameParts = url.hostname.split(".");
  if (hostnameParts.length >= 3) {
    const maybeCompany = hostnameParts[0];
    if (maybeCompany && maybeCompany !== "www" && maybeCompany !== "careers" && maybeCompany !== "jobs") {
      return maybeCompany;
    }
  }

  return undefined;
}

export const taleoJobAdapter: JobAdapter = {
  canHandle(_doc, url) {
    // Taleo URLs typically contain "taleo.net" in the hostname
    return url.hostname.includes("taleo.net");
  },
  extract(doc, url) {
    // Priority 1: Try to extract from JSON-LD schema (cleanest source)
    const jsonLdData = extractFromJsonLd(doc);
    if (jsonLdData && jsonLdData.text.length > 200) {
      return {
        title: jsonLdData.title || findTitle(doc),
        company: jsonLdData.company || findCompany(doc, url),
        text: jsonLdData.text
      };
    }

    // Priority 2: Fall back to DOM extraction
    const description = findDescription(doc);
    if (!description) {
      return null;
    }

    // Clone and remove unwanted elements
    const clone = description.cloneNode(true) as HTMLElement;

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

    const text = clone.innerHTML;
    if (!text.trim() || text.trim().length < 200) {
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
