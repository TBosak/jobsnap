import type { JsonResumeWork } from "../../ui-shared/schema";
import type { SectionBlock } from "../types";
import {
  detectLocation,
  detectUrl,
  isBulletLine,
  matchDateRange,
  parseDate,
  splitHighlights
} from "../utils";
import type { FeatureSet } from "../featureScoring";
import { pickBestLine } from "../featureScoring";
import { divideSectionIntoSubsections } from "../subsections";

const JOB_TITLE_KEYWORDS = [
  "Accountant",
  "Administrator",
  "Advisor",
  "Agent",
  "Analyst",
  "Architect",
  "Assistant",
  "Associate",
  "Auditor",
  "Consultant",
  "Coordinator",
  "Designer",
  "Developer",
  "Director",
  "Engineer",
  "Intern",
  "Lead",
  "Manager",
  "Officer",
  "Operations",
  "Producer",
  "Recruiter",
  "Representative",
  "Researcher",
  "Sales",
  "Scientist",
  "Specialist",
  "Supervisor",
  "Teacher",
  "Technician",
  "Volunteer"
];

export function extractWork(section?: SectionBlock): JsonResumeWork[] {
  if (!section) {
    return [];
  }

  const subsections = section.rawLines && section.rawLines.length
    ? divideSectionIntoSubsections(section.rawLines).map((lines) =>
        lines
          .map((line) => line.map((item) => item.text).join(" ").trim())
          .filter(Boolean)
      )
    : splitSubsections(section.lines);
  const workEntries: JsonResumeWork[] = [];

  for (const lines of subsections) {
    const infoLines = lines.slice(0, 3);
    const infoText = infoLines.map((line) => line.trim()).filter(Boolean);

    const date = pickBestLine(infoText, DATE_FEATURES, { threshold: 3, preferCapture: true });
    const jobTitle = pickBestLine(infoText, JOB_TITLE_FEATURES, { threshold: 2 });
    const company = pickBestLine(infoText, createCompanyFeatures(jobTitle?.line, date?.line), {
      threshold: 1
    });

    const location = detectLocation(infoText.join(" ")) ?? detectLocation(lines.join(" "));
    const url = detectUrl(infoText.join(" ")) ?? detectUrl(lines.join(" "));

    const activities = gatherHighlights(lines.slice(infoLines.length));

    workEntries.push({
      name: company?.line ?? company?.capture,
      position: jobTitle?.line ?? jobTitle?.capture,
      startDate: date?.capture ? parseDate(date.capture) : parseDateFromLine(date?.line),
      endDate: parseEndDate(date?.line),
      location: location ?? undefined,
      url: url ?? undefined,
      summary: activities.summary,
      highlights: activities.highlights
    });
  }

  return workEntries.filter((entry) => entry.name || entry.position || entry.highlights?.length);
}

const DATE_FEATURES: FeatureSet[] = [
  {
    test: (line) => {
      const match = matchDateRange(line);
      return match ? match.raw : null;
    },
    score: 5,
    capture: true
  },
  { test: (line) => /(present|current)/i.test(line), score: 2 },
  { test: (line) => /\d{4}/.test(line), score: 1 }
];

const JOB_TITLE_FEATURES: FeatureSet[] = [
  { test: (line) => JOB_TITLE_KEYWORDS.some((keyword) => new RegExp(`\\b${keyword}\\b`, "i").test(line)), score: 4 },
  { test: (line) => /\d/.test(line), score: -3 },
  { test: (line) => line.split(/\s+/).length > 8, score: -2 }
];

function createCompanyFeatures(jobTitleLine?: string, dateLine?: string): FeatureSet[] {
  const features: FeatureSet[] = [
    { test: (line) => /[,]/.test(line), score: 2 },
    { test: (line) => /^[A-Z][A-Za-z0-9&.,'\s]+$/.test(line), score: 3 },
    { test: (line) => line.toLowerCase().includes("company"), score: 1 },
    { test: (line) => /\d/.test(line), score: -2 }
  ];
  if (jobTitleLine) {
    features.push({
      test: (line) => line.includes(jobTitleLine),
      score: -4
    });
  }
  if (dateLine) {
    features.push({
      test: (line) => line.includes(dateLine),
      score: -4
    });
  }
  return features;
}

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

    // Check for combined job title + company patterns like "Software EngineerVizient, Inc | Dec 2019 - Sep 2025"
    const splitLine = splitCombinedJobLine(line);
    if (splitLine.length > 1) {
      if (current.length) flush();
      current.push(...splitLine);
    } else {
      if (isPotentialHeader(line) && current.length) {
        flush();
      }
      current.push(line);
    }
  }
  flush();

  return subsections;
}

// Split lines like "Software EngineerVizient, Inc | Dec 2019 - Sep 2025" into separate components
function splitCombinedJobLine(line: string): string[] {
  // Pattern: JobTitle + Company + | + Date
  const combinedPattern = /^([A-Za-z\s]+?)([A-Z][A-Za-z\s,&.]+(?:\s+(?:Inc|Corp|Corporation|LLC|Ltd|Company|Group|Technologies|Solutions)\.?)?)\s*\|\s*(.+)$/;
  const match = line.match(combinedPattern);

  if (match) {
    const [, jobTitle, company, dateInfo] = match;
    return [
      jobTitle.trim(),
      company.trim(),
      dateInfo.trim()
    ].filter(Boolean);
  }

  // Pattern: JobTitle + Company (without |)
  const simplePattern = /^([A-Za-z\s]+?)([A-Z][A-Za-z\s,&.]+(?:\s+(?:Inc|Corp|Corporation|LLC|Ltd|Company|Group|Technologies|Solutions)\.?)?)$/;
  const simpleMatch = line.match(simplePattern);

  if (simpleMatch && JOB_TITLE_KEYWORDS.some(keyword => new RegExp(`\\b${keyword}\\b`, "i").test(simpleMatch[1]))) {
    const [, jobTitle, company] = simpleMatch;
    return [
      jobTitle.trim(),
      company.trim()
    ].filter(Boolean);
  }

  return [line];
}

function isPotentialHeader(line: string): boolean {
  if (line.length > 90) return false;
  return JOB_TITLE_KEYWORDS.some((keyword) => new RegExp(`\\b${keyword}\\b`, "i").test(line));
}

function gatherHighlights(lines: string[]): { summary?: string; highlights?: string[] } {
  if (!lines.length) {
    return {};
  }

  const bullets = splitHighlights(lines.filter((line) => isBulletLine(line)));
  const freeform = lines.filter((line) => !isBulletLine(line));

  return {
    summary: freeform[0]?.trim(),
    highlights: bullets.length ? bullets.slice(0, 8) : freeform.slice(1).map((line) => line.trim())
  };
}

function parseDateFromLine(line?: string): string | undefined {
  if (!line) return undefined;
  const range = matchDateRange(line);
  if (range) {
    return parseDate(range.startText);
  }
  return undefined;
}

function parseEndDate(line?: string): string | undefined {
  if (!line) return undefined;
  const range = matchDateRange(line);
  if (!range) return undefined;
  if (/present|current/i.test(range.endText)) {
    return undefined;
  }
  return parseDate(range.endText);
}
