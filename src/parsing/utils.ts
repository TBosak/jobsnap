import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

const DATE_PATTERNS = [
  "MMM YYYY",
  "MMMM YYYY",
  "MMM, YYYY",
  "MMMM, YYYY",
  "YYYY",
  "MM/YYYY",
  "YYYY-MM"
];

const LOCATION_REGEX = /([A-Z][A-Za-z'.\s]+,\s*[A-Z]{2})(?:\s*\d{5})?/;
const URL_REGEX = /(https?:\/\/[^\s)]+)/i;
const DATE_RANGE_REGEX = /((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|\d{1,2}[\/.-]\d{2,4}|\d{4})[\s.,/-]*\d{0,4})\s*(?:to|[-–—])\s*(present|current|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|\d{1,2}[\/.-]\d{2,4}|\d{4}))?/i;

export function parseDate(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const normalized = input.replace(/present|current/i, new Date().getFullYear().toString());
  for (const pattern of DATE_PATTERNS) {
    const parsed = dayjs(normalized, pattern, true);
    if (parsed.isValid()) {
      return parsed.format("YYYY-MM");
    }
  }
  return undefined;
}

export function parseDateRange(text: string): { startDate?: string; endDate?: string } {
  const match = matchDateRange(text);
  if (!match) {
    return {};
  }
  return {
    startDate: parseDate(match.startText),
    endDate: parseDate(match.endText)
  };
}

export function tokenize(line: string): string[] {
  return line
    .split(/[,;•]/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function detectLocation(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const match = text.match(LOCATION_REGEX);
  return match ? match[0].trim() : undefined;
}

export function detectUrl(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const match = text.match(URL_REGEX);
  return match ? match[0] : undefined;
}

export function isBulletLine(line: string): boolean {
  return /^\s*([-*•]|\d+\.)/.test(line.trim());
}

export function splitHighlights(block: string[]): string[] {
  return block
    .flatMap((line) =>
      line
        .split(/•/)
        .map((entry) => entry.replace(/^[-*•\d.\s]+/, "").trim())
        .filter(Boolean)
    )
    .filter(Boolean);
}

export interface DateRangeMatch {
  raw: string;
  startText: string;
  endText: string;
  index: number;
  length: number;
}

export function matchDateRange(text: string): DateRangeMatch | null {
  const result = DATE_RANGE_REGEX.exec(text);
  if (!result) {
    return null;
  }
  const raw = result[0];
  const startText = result[1] ?? "";
  const endText = result[2] ?? "present";
  const index = result.index ?? text.indexOf(raw);
  return {
    raw,
    startText,
    endText,
    index,
    length: raw.length
  };
}

export function removeSubstring(text: string, start: number, length: number): string {
  return (text.slice(0, start) + text.slice(start + length)).trim();
}
