import type { JobAdapter, JobPageExtract } from "./types";

/**
 * Job description indicator keywords with weights
 * Higher weight = stronger signal that this is a job description
 */
const JOB_KEYWORDS = {
  // Very strong signals (10 points)
  strong: [
    "responsibilities",
    "qualifications",
    "requirements",
    "what you'll do",
    "what you will do",
    "about the role",
    "job description",
    "key responsibilities"
  ],
  // Good signals (5 points)
  medium: [
    "skills",
    "benefits",
    "experience",
    "education",
    "required",
    "preferred",
    "minimum qualifications",
    "nice to have",
    "salary",
    "compensation",
    "work with",
    "you will",
    "you'll be"
  ],
  // Weak signals (2 points)
  weak: [
    "apply",
    "position",
    "role",
    "team",
    "company",
    "opportunity",
    "career",
    "join us",
    "we're looking for",
    "we are looking for"
  ]
};

const MINIMUM_SCORE = 10; // Minimum score to consider this a job description
const MINIMUM_LENGTH = 300; // Minimum text length in characters

/**
 * Scores page content to determine if it contains a job description
 * Returns score (0-100+) where higher = more likely to be a job description
 */
function scoreJobContent(text: string): number {
  if (!text || text.length < MINIMUM_LENGTH) return 0;

  const lowerText = text.toLowerCase();
  let score = 0;

  // Check for strong signals
  for (const keyword of JOB_KEYWORDS.strong) {
    if (lowerText.includes(keyword)) {
      score += 10;
    }
  }

  // Check for medium signals
  for (const keyword of JOB_KEYWORDS.medium) {
    if (lowerText.includes(keyword)) {
      score += 5;
    }
  }

  // Check for weak signals
  for (const keyword of JOB_KEYWORDS.weak) {
    if (lowerText.includes(keyword)) {
      score += 2;
    }
  }

  // Bonus for length (job descriptions are typically substantial)
  if (text.length > 1000) score += 5;
  if (text.length > 2000) score += 5;

  return score;
}

/**
 * Finds elements containing specific job description keywords
 * Returns elements sorted by specificity (most specific first)
 */
function findElementsWithKeywords(doc: Document): HTMLElement[] {
  const allKeywords = [
    ...JOB_KEYWORDS.strong,
    ...JOB_KEYWORDS.medium,
    ...JOB_KEYWORDS.weak
  ];

  const matchingElements = new Map<HTMLElement, number>(); // element -> specificity score

  // Search for elements containing keywords
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let textNode: Node | null;

  while ((textNode = walker.nextNode())) {
    const text = textNode.textContent?.toLowerCase() || "";
    if (!text.trim()) continue;

    // Check if this text node contains any keywords
    const hasKeyword = allKeywords.some(keyword => text.includes(keyword));
    if (!hasKeyword) continue;

    // Find the closest containing element with substantial content
    let element = textNode.parentElement;
    while (element) {
      const elementText = element.innerText?.trim() || "";

      // Stop at elements with substantial content that aren't too large
      if (elementText.length >= MINIMUM_LENGTH && elementText.length < 20000) {
        // Calculate specificity: lower child count = more specific
        const childDivs = element.querySelectorAll("div, section").length;
        const specificity = 1000 - Math.min(childDivs, 999); // Higher score = more specific

        // Update if this is a better (more specific) match
        const currentScore = matchingElements.get(element) || 0;
        if (specificity > currentScore) {
          matchingElements.set(element, specificity);
        }
        break;
      }

      element = element.parentElement;
      // Stop at body to avoid going too far up
      if (element === doc.body) break;
    }
  }

  // Sort by specificity (most specific first)
  return Array.from(matchingElements.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([element]) => element);
}

/**
 * Finds the best candidate element for job description content
 */
function findJobDescriptionElement(doc: Document): HTMLElement | null {
  // Priority 1: Known job description selectors
  const knownSelectors = [
    "[data-job-description]",
    ".jobsearch-JobComponent-description",
    "#jobDescriptionText",
    ".job-description",
    ".job_description",
    "[class*='job-description']",
    "[class*='jobDescription']",
    "[id*='job-description']",
    "[id*='jobDescription']"
  ];

  for (const selector of knownSelectors) {
    const el = doc.querySelector<HTMLElement>(selector);
    if (el && el.innerText.trim().length > MINIMUM_LENGTH) {
      const score = scoreJobContent(el.innerText);
      if (score >= MINIMUM_SCORE) {
        return el;
      }
    }
  }

  // Priority 2: Elements containing job description keywords (most specific first)
  const keywordElements = findElementsWithKeywords(doc);
  let bestCandidate: { element: HTMLElement; score: number } | null = null;

  for (const el of keywordElements) {
    const text = el.innerText.trim();
    const score = scoreJobContent(text);
    if (score >= MINIMUM_SCORE && (!bestCandidate || score > bestCandidate.score)) {
      bestCandidate = { element: el, score };
      // If we found a very high scoring element, use it immediately
      if (score >= 30) {
        return el;
      }
    }
  }

  if (bestCandidate) {
    return bestCandidate.element;
  }

  // Priority 3: Common structural elements (main, article, section)
  const structuralSelectors = ["main", "article", "[role='main']"];

  for (const selector of structuralSelectors) {
    const elements = doc.querySelectorAll<HTMLElement>(selector);
    for (const el of elements) {
      const text = el.innerText.trim();
      if (text.length >= MINIMUM_LENGTH) {
        const score = scoreJobContent(text);
        if (score >= MINIMUM_SCORE && (!bestCandidate || score > bestCandidate.score)) {
          bestCandidate = { element: el, score };
        }
      }
    }
  }

  return bestCandidate?.element || null;
}

export const genericJobAdapter: JobAdapter = {
  canHandle(doc) {
    // First check for known job description selectors (fast path)
    const knownElement = doc.querySelector(
      "[data-job-description], .jobsearch-JobComponent-description, #jobDescriptionText, .job-description, .job_description"
    );
    if (knownElement) return true;

    // Then do a more thorough content-based check
    const candidate = findJobDescriptionElement(doc);
    return candidate !== null;
  },

  extract(doc, url): JobPageExtract | null {
    const descriptionElement = findJobDescriptionElement(doc);
    if (!descriptionElement) return null;

    const text = descriptionElement.innerText.trim();
    if (!text || text.length < MINIMUM_LENGTH) return null;

    // Try to extract title from common patterns
    const title =
      doc.querySelector<HTMLElement>("h1.job-title, h1[class*='job'], h1[class*='position'], h1[data-job-title]")?.innerText?.trim() ||
      doc.querySelector<HTMLElement>("h1")?.innerText?.trim() ||
      doc.title.split("|")[0].trim() || // Many job sites use "Job Title | Company"
      url.pathname;

    // Try to extract company from common patterns
    const company =
      doc.querySelector<HTMLElement>("[data-company-name], .company-name, [class*='company']")?.innerText?.trim() ||
      doc.querySelector<HTMLElement>("meta[property='og:site_name']")?.getAttribute("content") ||
      undefined;

    return {
      title,
      company,
      text
    };
  }
};
