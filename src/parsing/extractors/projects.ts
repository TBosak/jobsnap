import type { JsonResumeProject } from "../../ui-shared/schema";
import type { SectionBlock } from "../types";
import { detectUrl, isBulletLine, splitHighlights } from "../utils";
import type { FeatureSet } from "../featureScoring";
import { pickBestLine, penalizeMatch } from "../featureScoring";

export function extractProjects(section?: SectionBlock): JsonResumeProject[] {
  if (!section) {
    return [];
  }

  const projects: JsonResumeProject[] = [];
  const subsections = splitSubsections(section.lines);

  for (const lines of subsections) {
    const infoLines = lines.slice(0, 3);
    const infoText = infoLines.map((line) => line.trim()).filter(Boolean);

    const name = pickBestLine(infoText, buildProjectFeatureSets(), { threshold: 1 });
    const url = detectUrl(lines.join(" "));

    const bulletHighlights = splitHighlights(lines.filter((line) => isBulletLine(line))).slice(0, 6);
    const fallbackDescription = lines
      .map((line) => line.trim())
      .find((line) => line && !isBulletLine(line) && line !== name?.line);

    projects.push({
      name: name?.line ?? name?.capture ?? "",
      description: bulletHighlights[0] ?? fallbackDescription,
      highlights: bulletHighlights.length ? bulletHighlights : undefined,
      url: url ?? undefined
    });
  }

  return projects.filter((project) => project.name || project.description || project.highlights?.length);
}

function buildProjectFeatureSets(): FeatureSet[] {
  return [
    { test: (line) => /^[A-Z]/.test(line), score: 2 },
    { test: (line) => line.length <= 60, score: 1 },
    { test: (line) => /project|app|system|platform|tool/i.test(line), score: 2 },
    { test: (line) => /\d/.test(line), score: -2 }
  ];
}

function splitSubsections(lines: string[]): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];
  const flush = () => {
    if (!current.length) return;
    groups.push(current.slice());
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
  return groups;
}

function isLikelyHeader(line: string): boolean {
  if (line.length > 80) return false;
  return /project|app|tool|system|platform/i.test(line);
}
