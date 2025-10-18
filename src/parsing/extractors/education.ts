import type { JsonResumeEducation } from "../../ui-shared/schema";
import type { SectionBlock } from "../types";
import { parseDateRange, splitHighlights } from "../utils";
import { divideSectionIntoSubsections } from "../subsections";
import type { FeatureSet } from "../featureScoring";
import { pickBestLine } from "../featureScoring";

const SCHOOL_KEYWORDS = ["College", "University", "Institute", "School", "Academy", "Magnet"];
const DEGREE_KEYWORDS = ["Associate", "Bachelor", "Master", "Doctor", "PhD", "Ph.", "MBA", "BSc", "MSc"];
const GPA_REGEX = /[0-4]\.\d{1,2}/;

export function extractEducation(section?: SectionBlock): JsonResumeEducation[] {
  if (!section) {
    return [];
  }

  const entries: JsonResumeEducation[] = [];
  const subsections = section.rawLines && section.rawLines.length
    ? divideSectionIntoSubsections(section.rawLines).map((lines) =>
        lines
          .map((line) => line.map((item) => item.text).join(" ").trim())
          .filter(Boolean)
      )
    : splitSubsections(section.lines);

  for (const lines of subsections) {
    const infoLines = lines.slice(0, 3);
    const infoText = infoLines.map((line) => line.trim()).filter(Boolean);

    const school = pickBestLine(infoText, SCHOOL_FEATURES, { threshold: 3 });
    const degree = pickBestLine(infoText, DEGREE_FEATURES, { threshold: 3 });
    const gpa = pickBestLine(infoText, GPA_FEATURES, { threshold: 3, preferCapture: true });
    const { startDate, endDate } = parseDateRange(infoText.join(" "));

    const descriptionLines = lines.slice(infoLines.length);
    const descriptions = splitHighlights(descriptionLines).map((d) => d.trim());

    entries.push({
      institution: school?.line ?? school?.capture,
      studyType: degree?.line ?? degree?.capture,
      area: extractArea(infoText),
      startDate,
      endDate,
      score: gpa?.capture ?? gpa?.line,
      courses: descriptions.length ? descriptions : undefined
    });
  }

  return entries.filter((entry) => entry.institution || entry.studyType || entry.area);
}

const SCHOOL_FEATURES: FeatureSet[] = [
  { test: (line) => SCHOOL_KEYWORDS.some((keyword) => line.includes(keyword)), score: 4 },
  { test: (line) => DEGREE_KEYWORDS.some((keyword) => line.includes(keyword)), score: -3 },
  { test: (line) => /\d/.test(line), score: -2 }
];

const DEGREE_FEATURES: FeatureSet[] = [
  { test: (line) => DEGREE_KEYWORDS.some((keyword) => line.includes(keyword)), score: 4 },
  { test: (line) => SCHOOL_KEYWORDS.some((keyword) => line.includes(keyword)), score: -3 },
  { test: (line) => /\d/.test(line), score: -2 }
];

const GPA_FEATURES: FeatureSet[] = [
  { test: (line) => line.match(GPA_REGEX) ?? null, score: 4, capture: true },
  { test: (line) => line.toLowerCase().includes("gpa"), score: 2 },
  { test: (line) => /letter/i.test(line), score: 1 },
  { test: (line) => /[,;]/.test(line), score: -2 }
];

function splitSubsections(lines: string[]): string[][] {
  const subsections: string[][] = [];
  let current: string[] = [];

  const flush = () => {
    if (!current.length) return;
    subsections.push(current.slice());
    current = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (isLikelyHeader(line) && current.length) {
      flush();
    }
    current.push(line);
  }
  flush();
  return subsections;
}

function isLikelyHeader(line: string): boolean {
  if (line.length > 80) return false;
  return /[,]/.test(line) || DEGREE_KEYWORDS.some((keyword) => line.includes(keyword));
}

function extractArea(lines: string[]): string | undefined {
  for (const line of lines) {
    if (/\b(in|of)\b/i.test(line) && DEGREE_KEYWORDS.some((keyword) => line.includes(keyword))) {
      return line;
    }
  }
  return undefined;
}
