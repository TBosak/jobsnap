import type { JobAdapter, JobPageExtract } from "./types";

/**
 * Workable Job Adapter
 *
 * Workable (jobs.workable.com) uses JSON-LD structured data with schema.org JobPosting format.
 * This adapter extracts job information from the embedded JSON-LD script tag.
 *
 * URL Pattern: https://jobs.workable.com/view/{job-id}/{job-slug}
 */

interface WorkableJobPosting {
  "@context": string;
  "@type": "JobPosting";
  title: string;
  description: string;
  hiringOrganization: {
    "@type": "Organization";
    name: string;
  };
  jobLocation?: {
    "@type": "Place";
    address?: {
      "@type": "PostalAddress";
      addressLocality?: string;
      addressRegion?: string;
      addressCountry?: string;
    };
  };
  employmentType?: string;
  datePosted?: string;
  validThrough?: string;
  baseSalary?: {
    "@type": "MonetaryAmount";
    currency?: string;
    value?: {
      "@type": "QuantitativeValue";
      minValue?: number;
      maxValue?: number;
      unitText?: string;
    };
  };
}

function extractFromJsonLd(doc: Document): WorkableJobPosting | null {
  // Find JSON-LD script tag with JobPosting schema
  const scriptTags = doc.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');

  for (const script of scriptTags) {
    try {
      const data = JSON.parse(script.textContent || "");

      // Check if this is a JobPosting schema
      if (data["@type"] === "JobPosting" && data.title && data.description) {
        return data as WorkableJobPosting;
      }
    } catch (error) {
      // Skip invalid JSON
      continue;
    }
  }

  return null;
}

function stripHtmlTags(html: string): string {
  // Create a temporary DOM element to parse HTML
  const temp = document.createElement("div");
  temp.innerHTML = html;

  // Remove script and style elements
  temp.querySelectorAll("script, style").forEach(el => el.remove());

  // Extract text content, preferring innerText for better formatting
  let text = "";
  if (temp.innerText) {
    text = temp.innerText;
  } else if (temp.textContent) {
    text = temp.textContent;
  } else {
    // Fallback: manual extraction
    text = html.replace(/<[^>]*>/g, " ");
  }

  return text
    .trim()
    // Normalize multiple newlines to double newlines
    .replace(/\n{3,}/g, "\n\n")
    // Clean up excessive whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/\n /g, "\n");
}

function extractFromDom(doc: Document): { title?: string; company?: string; description?: string } {
  const result: { title?: string; company?: string; description?: string } = {};

  // Try to extract title from common selectors
  const titleSelectors = [
    'h1[data-ui="job-title"]',
    'h1.job-title',
    '[data-ui="job-title"]',
    'h1'
  ];

  for (const selector of titleSelectors) {
    const titleEl = doc.querySelector<HTMLElement>(selector);
    if (titleEl && titleEl.innerText.trim().length > 0) {
      result.title = titleEl.innerText.trim();
      break;
    }
  }

  // Try to extract company name
  const companySelectors = [
    '[data-ui="company-name"]',
    '.company-name',
    'meta[property="og:site_name"]',
    'meta[name="twitter:site"]'
  ];

  for (const selector of companySelectors) {
    if (selector.startsWith("meta")) {
      const metaEl = doc.querySelector<HTMLMetaElement>(selector);
      const content = metaEl?.getAttribute("content")?.replace(/^@/, "").trim();
      if (content && content.length > 0) {
        result.company = content;
        break;
      }
    } else {
      const companyEl = doc.querySelector<HTMLElement>(selector);
      if (companyEl && companyEl.innerText.trim().length > 0) {
        result.company = companyEl.innerText.trim();
        break;
      }
    }
  }

  // Try to extract description from common selectors
  const descriptionSelectors = [
    '[data-ui="job-description"]',
    '.job-description',
    '[data-ui="job-details"]',
    'main',
    'article'
  ];

  for (const selector of descriptionSelectors) {
    const descEl = doc.querySelector<HTMLElement>(selector);
    if (descEl) {
      const text = descEl.innerText?.trim() || "";
      if (text.length > 200) {
        result.description = text;
        break;
      }
    }
  }

  return result;
}

export const workableJobAdapter: JobAdapter = {
  canHandle(doc: Document, url: URL): boolean {
    // Match jobs.workable.com domain
    if (url.hostname === "jobs.workable.com") {
      return true;
    }

    // Also check for Workable-specific elements in the DOM
    const hasWorkableElements =
      doc.querySelector('script[src*="workable"]') !== null ||
      doc.querySelector('[data-ui="job-title"]') !== null ||
      doc.querySelector('[data-ui="job-description"]') !== null;

    return hasWorkableElements;
  },

  extract(doc: Document, url: URL): JobPageExtract | null {
    console.log("[Workable] Starting extraction for:", url.href);

    // Priority 1: Try to extract from JSON-LD structured data
    const jsonLdData = extractFromJsonLd(doc);

    if (jsonLdData) {
      console.log("[Workable] Found JSON-LD data:", {
        hasTitle: !!jsonLdData.title,
        hasDescription: !!jsonLdData.description,
        descriptionLength: jsonLdData.description?.length || 0,
        hasHTML: jsonLdData.description?.includes("<") || false
      });

      const title = jsonLdData.title;
      const company = jsonLdData.hiringOrganization?.name;

      // Description in JSON-LD may contain HTML, strip it
      let description = jsonLdData.description || "";
      if (description.includes("<")) {
        console.log("[Workable] Stripping HTML from description");
        description = stripHtmlTags(description);
        console.log("[Workable] Description after stripping HTML:", {
          length: description.length,
          preview: description.substring(0, 100)
        });
      }

      // Add employment type and location if available
      const metadata: string[] = [];

      if (jsonLdData.employmentType) {
        metadata.push(`Employment Type: ${jsonLdData.employmentType}`);
      }

      if (jsonLdData.jobLocation?.address) {
        const address = jsonLdData.jobLocation.address;
        const locationParts: string[] = [];

        if (address.addressLocality) locationParts.push(address.addressLocality);
        if (address.addressRegion) locationParts.push(address.addressRegion);
        if (address.addressCountry) locationParts.push(address.addressCountry);

        if (locationParts.length > 0) {
          metadata.push(`Location: ${locationParts.join(", ")}`);
        }
      }

      if (jsonLdData.baseSalary?.value) {
        const salary = jsonLdData.baseSalary.value;
        const currency = jsonLdData.baseSalary.currency || "USD";
        if (salary.minValue && salary.maxValue) {
          metadata.push(`Salary Range: ${currency} ${salary.minValue.toLocaleString()} - ${salary.maxValue.toLocaleString()} ${salary.unitText || "per year"}`);
        }
      }

      // Combine description with metadata
      const fullText = metadata.length > 0
        ? `${description}\n\n---\n\n${metadata.join("\n")}`
        : description;

      console.log("[Workable] Final text length:", fullText.trim().length);

      if (fullText.trim().length > 200) {
        console.log("[Workable] Returning job extract:", {
          title,
          company,
          textLength: fullText.length
        });
        return {
          title,
          company,
          text: fullText
        };
      } else {
        console.log("[Workable] Description too short (< 200 chars), falling back to DOM");
      }
    } else {
      console.log("[Workable] No JSON-LD data found, falling back to DOM");
    }

    // Priority 2: Fallback to DOM extraction
    const domData = extractFromDom(doc);

    if (domData.description && domData.description.length > 200) {
      return {
        title: domData.title,
        company: domData.company,
        text: domData.description
      };
    }

    // Priority 3: Try to extract all text from body as last resort
    const bodyText = doc.body?.innerText?.trim() || "";
    if (bodyText.length > 500) {
      return {
        title: domData.title || doc.title,
        company: domData.company,
        text: bodyText
      };
    }

    return null;
  }
};
