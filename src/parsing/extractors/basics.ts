import type { JsonResumeBasics, JsonResumeBasicsProfile } from "../../ui-shared/schema";
import type { SectionBlock } from "../types";
import { detectLocation, detectUrl, tokenize } from "../utils";
import type { FeatureSet } from "../featureScoring";
import { pickBestLine, penalizeMatch } from "../featureScoring";
import { SemanticEntityExtractor } from "../semanticExtraction";

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}/;

// Enhanced patterns for ATS-formatted contact info
const ATS_CONTACT_PATTERNS = {
  email: /(?:email|e-mail):\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
  phone: /(?:phone|tel|mobile|cell):\s*((?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?|\d{3})[-.\s]?\d{3}[-.\s]?\d{4})/i,
  location: /(?:location|address|city|residence):\s*([^|\n]+)/i,
  linkedin: /(?:linkedin|LinkedIn):\s*((?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+)/i
};

const SOCIAL_PATTERNS: Record<string, RegExp> = {
  linkedin: /linkedin\.com\/in\/([\w-]+)/i,
  github: /github\.com\/([\w-]+)/i,
  twitter: /twitter\.com\/([\w-]+)/i,
  dribbble: /dribbble\.com\/([\w-]+)/i,
  behance: /behance\.net\/([\w-]+)/i
};

const TITLE_HINT = /(engineer|developer|designer|manager|consultant|analyst|specialist)/i;

export async function extractBasics(sections: SectionBlock[], rawText: string): Promise<JsonResumeBasics> {
  const profileSection = sections.find((section) => section.id === "profile");
  const summarySection =
    sections.find((section) => section.id === "summary") ??
    sections.find((section) => section.id === "objective");

  // Get broader candidate lines for ATS resumes where contact info is scattered
  const candidateLines = gatherAllContactLines(profileSection, rawText);

  const email = pickBestLine(candidateLines, EMAIL_FEATURE_SETS, { threshold: 3, preferCapture: true });
  const phone = pickBestLine(candidateLines, PHONE_FEATURE_SETS, { threshold: 3, preferCapture: true });
  const locationMatch = pickBestLine(candidateLines, LOCATION_FEATURE_SETS, { threshold: 3, preferCapture: true });
  const urlMatch = pickBestLine(candidateLines, URL_FEATURE_SETS, { threshold: 3, preferCapture: true });

  const nameFeatures = buildNameFeatureSets({
    emailLine: email?.line,
    phoneLine: phone?.line,
    locationLine: locationMatch?.line,
    urlLine: urlMatch?.line
  });

  // Enhanced name detection that searches the entire resume text for strong name candidates
  let name = pickBestLine(candidateLines, nameFeatures, {
    threshold: 3,
    disallow: (line) => line.includes("@") || /[\d@]/.test(line) ||
                      /^(SKILLS|EDUCATION|EXPERIENCE|WORK|CONTACT|PROFILE|SUMMARY|OBJECTIVE)$/i.test(line.trim())
  });

  // Validate heuristically detected name with transformers.js
  if (name && !(await validateNameCandidate(name.line))) {
    console.warn(`Heuristic name "${name.line}" failed semantic validation, trying fallbacks`);
    name = null;
  }

  // Fallback 1: Pattern-based search in full text
  if (!name) {
    const patternName = findNameInFullText(rawText, email?.line, phone?.line);
    if (patternName && await validateNameCandidate(patternName.line)) {
      name = patternName;
    }
  }

  // Fallback 2: Use semantic analysis only if heuristics completely fail
  if (!name) {
    name = await findNameSemantically(rawText);
  }

  const label = inferLabel(candidateLines, name?.line, email?.line, phone?.line);
  const location = normalizeLocation(locationMatch?.capture ?? locationMatch?.line);
  const profiles = inferProfiles(candidateLines);
  const url = urlMatch?.capture ?? detectUrl(candidateLines.join(" ")) ?? findFirstLink(candidateLines);
  const summary = summarySection ? summarySection.lines.join(" ") : undefined;

  return {
    name: name?.line ?? name?.capture,
    label,
    email: email?.capture ?? email?.line,
    phone: phone?.capture ?? phone?.line,
    url: url ?? undefined,
    summary,
    location,
    profiles: profiles.length ? profiles : undefined
  };
}

function inferLabel(
  lines: string[],
  nameLine?: string,
  emailLine?: string,
  phoneLine?: string
): string | undefined {
  for (const line of lines.slice(0, 6)) {
    if (!line.trim()) continue;
    if (nameLine && line.includes(nameLine)) continue;
    if (emailLine && line.includes(emailLine)) continue;
    if (phoneLine && line.includes(phoneLine)) continue;
    if (TITLE_HINT.test(line)) {
      return sentenceCase(line);
    }
  }
  return undefined;
}

function inferProfiles(lines: string[]): JsonResumeBasicsProfile[] {
  const profiles: JsonResumeBasicsProfile[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    for (const [network, pattern] of Object.entries(SOCIAL_PATTERNS)) {
      const match = line.match(pattern);
      if (match) {
        const username = match[1];
        const url = match[0].startsWith("http") ? match[0] : `https://${match[0]}`;
        if (!seen.has(url)) {
          profiles.push({ network, username, url });
          seen.add(url);
        }
      }
    }

    if (/mailto:/i.test(line)) {
      const emailMatch = line.match(EMAIL_REGEX);
      if (emailMatch && !seen.has(emailMatch[0])) {
        profiles.push({ network: "email", url: emailMatch[0] });
        seen.add(emailMatch[0]);
      }
    }
  }

  return profiles;
}

function gatherTopLines(profileSection: SectionBlock | undefined, rawText: string): string[] {
  const baseLines = profileSection?.lines ?? [];
  const cleaned = baseLines.map((line) => line.trim()).filter(Boolean);
  if (cleaned.length >= 5) {
    return cleaned;
  }

  const fromRaw = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);

  const seen = new Set<string>();
  for (const line of cleaned) {
    seen.add(line);
  }

  for (const line of fromRaw) {
    if (!seen.has(line)) {
      cleaned.push(line);
      seen.add(line);
    }
  }

  return cleaned;
}

// Enhanced version that looks deeper for ATS resumes with scattered contact info
function gatherAllContactLines(profileSection: SectionBlock | undefined, rawText: string): string[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // Look for contact information patterns throughout the resume
  const contactLines: string[] = [];
  const seen = new Set<string>();

  // PRIORITY 1: Add first 30 lines in document order (most contact info is at top)
  const topLines = lines.slice(0, 30);
  for (const line of topLines) {
    if (!seen.has(line)) {
      contactLines.push(line);
      seen.add(line);
    }
  }

  // PRIORITY 2: Add profile section lines if not already included
  if (profileSection) {
    for (const line of profileSection.lines) {
      const trimmed = line.trim();
      if (trimmed && !seen.has(trimmed)) {
        contactLines.push(trimmed);
        seen.add(trimmed);
      }
    }
  }

  // PRIORITY 3: Search for contact-like patterns in the rest of the document
  for (const line of lines.slice(30)) {
    if (seen.has(line)) continue;

    // Look for email, phone, URL, or name-like patterns
    if (EMAIL_REGEX.test(line) ||
        PHONE_REGEX.test(line) ||
        /https?:\/\//.test(line) ||
        /^[A-Z][a-z]+ [A-Z]\. [A-Z][a-z]+$/.test(line) || // "Timothy M. Barani" pattern
        Object.values(ATS_CONTACT_PATTERNS).some(pattern => pattern.test(line))) {
      contactLines.push(line);
      seen.add(line);
    }
  }

  return contactLines;
}

// Find name candidates throughout the full text when initial detection fails
function findNameInFullText(rawText: string, emailLine?: string, phoneLine?: string): { line: string } | null {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // Strong name patterns for ATS resumes
  const strongNamePatterns = [
    /^[A-Z][a-z]+ [A-Z]\. [A-Z][a-z]+$/, // "Timothy M. Barani"
    /^[A-Z][a-z]+ [A-Z][a-z]+$/, // "John Smith"
    /^[A-Z][A-Z]+ [A-Z]\. [A-Z][A-Z]+$/, // "TIMOTHY M. BARANI"
  ];

  for (const line of lines) {
    // Skip section headers and contact info
    if (/^(SKILLS|EDUCATION|EXPERIENCE|WORK|CONTACT|PROFILE|SUMMARY|OBJECTIVE|EMAIL|PHONE|LINKEDIN|WEBSITE)$/i.test(line.trim())) {
      continue;
    }

    if (emailLine && line.includes(emailLine)) continue;
    if (phoneLine && line.includes(phoneLine)) continue;
    if (line.includes("@") || /\d{3}/.test(line)) continue;

    for (const pattern of strongNamePatterns) {
      if (pattern.test(line)) {
        return { line };
      }
    }
  }

  return null;
}

// Validate that a candidate string is actually a person's name using semantic similarity
async function validateNameCandidate(candidate: string): Promise<boolean> {
  try {
    // Quick reject obvious non-names
    if (!candidate || candidate.length < 2 || candidate.length > 50) {
      return false;
    }

    // Reject section headers and common non-name patterns
    const nonNamePatterns = [
      /^(SKILLS|EDUCATION|EXPERIENCE|WORK|CONTACT|PROFILE|SUMMARY|OBJECTIVE|PHONE|EMAIL|LINKEDIN|WEBSITE)$/i,
      /^\d+/, // Starts with numbers
      /@/, // Contains email
      /https?:\/\//, // Contains URL
      /^[A-Z]{3,}$/ // All caps (likely section header)
    ];

    for (const pattern of nonNamePatterns) {
      if (pattern.test(candidate)) {
        return false;
      }
    }

    // Use semantic similarity to validate against known name patterns
    const names = await SemanticEntityExtractor.extractNames(candidate);
    return names.length > 0 && names.includes(candidate);
  } catch (error) {
    console.warn("Name validation failed:", error);
    // If semantic validation fails, use basic heuristics
    return /^[A-Z][a-z]+ [A-Z]/.test(candidate) && candidate.split(' ').length <= 4;
  }
}

// Semantic fallback for name detection when all heuristics fail
async function findNameSemantically(rawText: string): Promise<{ line: string } | null> {
  try {
    const names = await SemanticEntityExtractor.extractNames(rawText);
    if (names.length > 0) {
      // Return the first (highest confidence) name found
      return { line: names[0] };
    }
  } catch (error) {
    console.warn("Semantic name extraction failed:", error);
  }
  return null;
}

const EMAIL_FEATURE_SETS: FeatureSet[] = [
  {
    test: (line) => line.match(EMAIL_REGEX), // Return match array for proper capture
    score: 6,
    capture: true
  },
  { test: (line) => line.includes(" "), score: -2 }
];

const PHONE_FEATURE_SETS: FeatureSet[] = [
  {
    test: (line) => line.match(PHONE_REGEX), // Return match array for proper capture
    score: 6,
    capture: true
  },
  // Strongly reward common phone separators (well-formatted numbers)
  { test: (line) => /\(\d{3}\)|\d{3}-\d{3}-\d{4}|\d{3}\.\d{3}\.\d{4}|\+\d[\s.-]/.test(line), score: 4 },
  // Penalize very long digit sequences (likely IDs, certification numbers, etc.)
  { test: (line) => /\d{12,}/.test(line), score: -10 }, // 12+ consecutive digits (strong penalty)
  { test: (line) => /\d{11}/.test(line) && !/[-.()\s]/.test(line), score: -6 }, // 11 consecutive digits with no separators in line
  { test: (line) => line.includes("@"), score: -2 },
  { test: (line) => /certification|license|training|course|program|certificate|credential|id\b/i.test(line), score: -5 } // Penalize certification/training lines
];

const LOCATION_FEATURE_SETS: FeatureSet[] = [
  { test: (line) => detectLocation(line), score: 5, capture: true },
  { test: (line) => line.includes(","), score: 2 },
  { test: (line) => /@|http/i.test(line), score: -3 },
  { test: (line) => /\.(NET|com|org|edu|gov)\b|www\./i.test(line), score: -5 }, // Penalize web/tech domains
  { test: (line) => /skills|technologies|languages|frameworks|tools/i.test(line), score: -4 } // Penalize skills section content
];

const URL_FEATURE_SETS: FeatureSet[] = [
  { test: (line) => /https?:\/\//i.test(line), score: 5, capture: true },
  { test: (line) => /www\.[^\s]+/i.test(line), score: 3, capture: true },
  { test: (line) => /(linkedin|github|portfolio|resume)/i.test(line), score: 2 },
  { test: (line) => line.includes("@"), score: -3 }
];

function buildNameFeatureSets(params: {
  emailLine?: string;
  phoneLine?: string;
  locationLine?: string;
  urlLine?: string;
}): FeatureSet[] {
  const { emailLine, phoneLine, locationLine, urlLine } = params;
  const features: FeatureSet[] = [
    { test: (line) => /^[A-Za-z][A-Za-z\s.'-]{1,60}$/.test(line), score: 4 },
    { test: (line) => line.split(/\s+/).length <= 4, score: 2 },
    { test: (line) => line.toLowerCase().includes("objective"), score: -3 },
    { test: (line) => /\d/.test(line), score: -4 },
    { test: (line) => line.includes(","), score: -4 }
  ];

  if (emailLine) features.push(penalizeMatch(emailLine, -5));
  if (phoneLine) features.push(penalizeMatch(phoneLine, -5));
  if (locationLine) features.push(penalizeMatch(locationLine, -4));
  if (urlLine) features.push(penalizeMatch(urlLine, -4));

  return features;
}

function normalizeLocation(line?: string): JsonResumeBasics["location"] | undefined {
  if (!line) return undefined;
  if (/remote/i.test(line)) {
    return { city: "Remote" };
  }
  const detected = detectLocation(line);
  if (detected) {
    const [city, regionPart] = detected.split(",").map((part) => part.trim());
    return {
      city,
      region: regionPart,
      countryCode: undefined
    };
  }
  return undefined;
}

function findFirstLink(lines: string[]): string | undefined {
  for (const line of lines) {
    const tokens = tokenize(line);
    for (const token of tokens) {
      if (token.startsWith("http")) {
        return token;
      }
    }
  }
  return undefined;
}

function sentenceCase(value: string): string {
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
