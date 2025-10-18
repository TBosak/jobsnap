import type { PdfLines, SectionBlock, SectionId } from "./types";
import { groupLinesIntoSections } from "./groupLinesIntoSections";

const SECTION_PATTERNS: Array<{ id: SectionId; pattern: RegExp }> = [
  { id: "profile", pattern: /^(contact|profile|personal\s+info|contact\s+info)$/i },
  { id: "objective", pattern: /^(objective|career\s+objective)$/i },
  { id: "summary", pattern: /^(professional\s+)?summary$/i },
  { id: "summary", pattern: /^(about\s+me|profile\s+summary|career\s+summary|executive\s+summary)$/i },
  { id: "experience", pattern: /^(experience|employment|work\s+history|professional\s+experience|work\s+experience|career\s+history)$/i },
  { id: "education", pattern: /^(education|academics|educational\s+background|academic\s+background)$/i },
  { id: "skills", pattern: /^(skills|technologies|tech\s+skills|core\s+competencies|technical\s+skills|key\s+skills|competencies|expertise)$/i },
  { id: "projects", pattern: /^(projects|portfolio|key\s+projects|relevant\s+projects)$/i },
  { id: "certificates", pattern: /^(certifications?|licenses?|professional\s+certifications?|credentials)$/i },
  { id: "awards", pattern: /^(awards|honors?|achievements|recognition|accomplishments)$/i },
  { id: "volunteer", pattern: /^(volunteer|community|volunteer\s+work|community\s+service)$/i },
  { id: "languages", pattern: /^(languages?|language\s+skills)$/i }
];

const HEADING_STYLE = /^[A-Z][A-Z\s/&-]{2,}$/;

export function sectionize(rawText: string): SectionBlock[] {
  const lines = rawText
    .split(/\r?\n|\u2028|\u2029/)
    .map((line) => line.replace(/•|\u2022|\u25CF/g, "•").trim())
    .filter((line, index, arr) => !(line === "" && arr[index - 1] === ""));

  const sections: SectionBlock[] = [];

  let current: SectionBlock = {
    id: "profile",
    heading: "Profile",
    lines: []
  };

  for (const line of lines) {
    const heading = identifyHeading(line);
    if (heading) {
      if (current.lines.length) {
        sections.push(current);
      }
      current = {
        id: heading.id,
        heading: heading.label,
        lines: []
      };
      continue;
    }
    current.lines.push(line);
  }

  if (current.lines.length) {
    sections.push(current);
  }

  return mergeDuplicateSections(sections);
}

export function sectionizeFromPdfLines(lines: PdfLines): SectionBlock[] {
  const grouped = groupLinesIntoSections(lines);
  const sections: SectionBlock[] = [];

  for (const [heading, sectionLines] of Object.entries(grouped)) {
    const normalized = heading.trim();
    const mapped = identifyHeading(normalized) ?? { id: "other", label: titleCase(normalized) };
    const stringLines = sectionLines
      .map((line) => line.map((item) => item.text).join(" ").trim())
      .filter(Boolean);
    sections.push({
      id: mapped.id,
      heading: mapped.label,
      lines: stringLines,
      rawLines: sectionLines
    });
  }

  return mergeDuplicateSections(sections);
}

function identifyHeading(line: string): { id: SectionId; label: string } | null {
  const normalized = line.replace(/^[\d.\-\s]+/, "").trim();
  if (!normalized) {
    return null;
  }

  if (HEADING_STYLE.test(normalized) || isLikelyHeading(normalized)) {
    const candidate = matchPattern(normalized);
    if (candidate) {
      return candidate;
    }
    return { id: "other", label: titleCase(normalized) };
  }

  const candidate = matchPattern(normalized);
  if (candidate) {
    return candidate;
  }

  return null;
}

function isLikelyHeading(line: string): boolean {
  if (line.length > 50) {
    return false;
  }

  // Check for common ATS heading patterns
  if (line.length <= 3) {
    return false;
  }

  // All caps section headers
  const upperRatio = line.replace(/[^A-Z]/g, "").length / line.replace(/[^A-Za-z]/g, "").length || 0;
  if (upperRatio > 0.6) {
    return true;
  }

  // Title case section headers (common in ATS)
  const words = line.split(/\s+/);
  const titleCaseWords = words.filter(word =>
    word.length > 0 &&
    word[0] === word[0].toUpperCase() &&
    word.slice(1) === word.slice(1).toLowerCase()
  );

  if (words.length >= 2 && titleCaseWords.length >= words.length * 0.8) {
    return true;
  }

  // Bold or emphasized text patterns (converted to upper case by enhanced parser)
  if (line === line.toUpperCase() && line.length > 3 && line.length < 30) {
    return true;
  }

  // Common ATS formatting: underlined or special characters
  if (/^[A-Z\s]+:?$/.test(line) || /_{3,}/.test(line) || /={3,}/.test(line)) {
    return true;
  }

  // Standalone words that are likely section headers
  if (words.length === 1 && /^(SUMMARY|EXPERIENCE|EDUCATION|SKILLS|PROJECTS|CONTACT|PROFILE|OBJECTIVE|AWARDS|CERTIFICATIONS|LANGUAGES|VOLUNTEER)$/i.test(line)) {
    return true;
  }

  return false;
}

function matchPattern(line: string): { id: SectionId; label: string } | null {
  for (const entry of SECTION_PATTERNS) {
    if (entry.pattern.test(line)) {
      return { id: entry.id, label: titleCase(line) };
    }
  }
  return null;
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function mergeDuplicateSections(sections: SectionBlock[]): SectionBlock[] {
  const merged: SectionBlock[] = [];
  for (const section of sections) {
    const existing = merged.find((item) => item.id === section.id);
    if (existing) {
      existing.lines.push("", ...section.lines);
      if (section.rawLines && existing.rawLines) {
        existing.rawLines.push(...section.rawLines);
      } else if (section.rawLines) {
        existing.rawLines = [...section.rawLines];
      }
    } else {
      merged.push({ ...section });
    }
  }
  return merged;
}
