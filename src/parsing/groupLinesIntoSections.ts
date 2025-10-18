import type { PdfLines, PdfLine } from "./types";
import {
  hasLetterAndIsAllUppercase,
  hasOnlyLettersSpacesAmpersands,
  isBoldItem
} from "./commonFeatures";

const SECTION_TITLE_PRIMARY_KEYWORDS = [
  "experience",
  "education",
  "project",
  "skill"
];
const SECTION_TITLE_SECONDARY_KEYWORDS = [
  "job",
  "course",
  "extracurricular",
  "objective",
  "summary",
  "award",
  "honor"
];
const SECTION_TITLE_KEYWORDS = [
  ...SECTION_TITLE_PRIMARY_KEYWORDS,
  ...SECTION_TITLE_SECONDARY_KEYWORDS
];

const PROFILE_SECTION = "profile";

export function groupLinesIntoSections(lines: PdfLines): Record<string, PdfLines> {
  const sections: Record<string, PdfLines> = {};
  let currentSection = PROFILE_SECTION;
  let sectionLines: PdfLines = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (isSectionTitle(line, index)) {
      sections[currentSection] = [...sectionLines];
      const heading = (line[0]?.text ?? PROFILE_SECTION).trim().toLowerCase();
      currentSection = heading;
      sectionLines = [];
    } else {
      sectionLines.push(line);
    }
  }

  if (sectionLines.length) {
    sections[currentSection] = [...sectionLines];
  }

  return sections;
}

function isSectionTitle(line: PdfLine, index: number): boolean {
  if (index < 2) return false;
  if (!line.length) return false;
  if (line.length > 1) return false;

  const item = line[0];
  const text = item.text.trim();
  if (!text) {
    return false;
  }

  if (isBoldItem(item) && hasLetterAndIsAllUppercase(item.text)) {
    return true;
  }

  const words = text.split(" ").filter((token) => token !== "&");
  const startsWithCapital = /[A-Z]/.test(text[0] ?? "");

  if (
    words.length <= 2 &&
    hasOnlyLettersSpacesAmpersands(text) &&
    startsWithCapital &&
    SECTION_TITLE_KEYWORDS.some((keyword) => text.toLowerCase().includes(keyword))
  ) {
    return true;
  }

  return false;
}

