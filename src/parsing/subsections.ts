import { BULLET_POINTS, isBoldItem } from "./commonFeatures";
import type { PdfLines, PdfLine } from "./types";

export function divideSectionIntoSubsections(lines: PdfLines): PdfLines[] {
  if (!lines.length) {
    return [];
  }

  const byLineGap = createIsLineNewSubsectionByLineGap(lines);
  let subsections = createSubsections(lines, byLineGap);

  if (subsections.length === 1) {
    const fallback = (line: PdfLine, previous: PdfLine) => {
      const first = line[0];
      const prev = previous[0];
      if (!first || !prev) return false;
      if (!isBoldItem(prev) && isBoldItem(first) && !BULLET_POINTS.includes(first.text)) {
        return true;
      }
      return false;
    };
    subsections = createSubsections(lines, fallback);
  }

  return subsections;
}

type SplitPredicate = (line: PdfLine, prevLine: PdfLine) => boolean;

function createIsLineNewSubsectionByLineGap(lines: PdfLines): SplitPredicate {
  const gaps: Record<number, number> = {};
  const ys = lines.map((line) => line[0]?.y ?? 0);
  let mostCommonGap = 0;
  let mostCommonCount = 0;

  for (let i = 1; i < ys.length; i++) {
    const gap = Math.round(ys[i - 1] - ys[i]);
    gaps[gap] = (gaps[gap] ?? 0) + 1;
    if (gaps[gap] > mostCommonCount) {
      mostCommonGap = gap;
      mostCommonCount = gaps[gap];
    }
  }

  const threshold = mostCommonGap * 1.4;

  return (line: PdfLine, prevLine: PdfLine) => {
    const prevY = prevLine[0]?.y ?? 0;
    const currentY = line[0]?.y ?? 0;
    return Math.round(prevY - currentY) > threshold;
  };
}

function createSubsections(lines: PdfLines, predicate: SplitPredicate): PdfLines[] {
  const groups: PdfLines[] = [];
  let current: PdfLine[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (index === 0) {
      current.push(line);
      continue;
    }
    if (predicate(line, lines[index - 1])) {
      groups.push(current);
      current = [];
    }
    current.push(line);
  }

  if (current.length) {
    groups.push(current);
  }

  return groups;
}
