import type { PdfTextItem } from "./types";

export const BULLET_POINTS = [
  "⋅",
  "∙",
  "🞄",
  "•",
  "⦁",
  "⚫︎",
  "●",
  "⬤",
  "⚬",
  "○"
];

export function hasLetter(text: string): boolean {
  return /[a-zA-Z]/.test(text);
}

export function hasNumber(text: string): boolean {
  return /\d/.test(text);
}

export function hasComma(text: string): boolean {
  return text.includes(",");
}

export function hasOnlyLettersSpacesAmpersands(text: string): boolean {
  return /^[A-Za-z\s&]+$/.test(text);
}

export function hasLetterAndIsAllUppercase(text: string): boolean {
  return hasLetter(text) && text.toUpperCase() === text;
}

export function isBoldItem(item?: PdfTextItem | null): boolean {
  if (!item?.fontName) {
    return false;
  }
  return item.fontName.toLowerCase().includes("bold");
}

export function splitBulletPoints(lines: string[]): string[] {
  const firstBulletIndex = findFirstBulletIndex(lines);
  if (firstBulletIndex === undefined) {
    return lines.map((line) => line.trim()).filter(Boolean);
  }

  let joined = lines.slice(firstBulletIndex).join(" ");
  const bullet = mostCommonBullet(joined);
  const first = joined.indexOf(bullet);
  if (first !== -1) {
    joined = joined.slice(first);
  }

  return joined
    .split(bullet)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function mostCommonBullet(text: string): string {
  const counts = new Map<string, number>();
  for (const bullet of BULLET_POINTS) {
    counts.set(bullet, 0);
  }
  let top = BULLET_POINTS[0];
  let max = 0;
  for (const char of text) {
    if (counts.has(char)) {
      const next = (counts.get(char) ?? 0) + 1;
      counts.set(char, next);
      if (next > max) {
        max = next;
        top = char;
      }
    }
  }
  return top;
}

function findFirstBulletIndex(lines: string[]): number | undefined {
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line) continue;
    if (BULLET_POINTS.some((bullet) => line.startsWith(bullet))) {
      return index;
    }
  }
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (BULLET_POINTS.some((bullet) => line.includes(bullet))) {
      return index;
    }
  }
  return undefined;
}
