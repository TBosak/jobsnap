import type { PdfTextItems, PdfLine, PdfLines } from "./types";
import { BULLET_POINTS } from "./commonFeatures";

export function groupTextItemsIntoLines(textItems: PdfTextItems): PdfLines {
  const lines: PdfLines = [];
  let currentLine: PdfLine = [];

  for (const item of textItems) {
    if (item.hasEOL) {
      if (item.text.trim()) {
        currentLine.push({ ...item });
      }
      lines.push(currentLine);
      currentLine = [];
    } else if (item.text.trim()) {
      currentLine.push({ ...item });
    }
  }

  if (currentLine.length) {
    lines.push(currentLine);
  }

  const typicalCharWidth = getTypicalCharWidth(lines.flat());
  for (const line of lines) {
    for (let index = line.length - 1; index > 0; index--) {
      const current = line[index];
      const left = line[index - 1];
      const leftEndX = left.x + left.width;
      const distance = current.x - leftEndX;
      if (distance <= typicalCharWidth) {
        if (shouldAddSpace(left.text, current.text)) {
          left.text += " ";
        }
        left.text += current.text;
        const currentEndX = current.x + current.width;
        left.width = currentEndX - left.x;
        line.splice(index, 1);
      }
    }
  }

  return lines.filter((line) => line.length);
}

function shouldAddSpace(left: string, right: string): boolean {
  if (!left.length || !right.length) return false;
  const leftChar = left[left.length - 1];
  const rightChar = right[0];
  if ([":", ",", "|", ".", ...BULLET_POINTS].includes(leftChar) && rightChar !== " ") {
    return true;
  }
  if (leftChar !== " " && ["|", ...BULLET_POINTS].includes(rightChar)) {
    return true;
  }
  return false;
}

function getTypicalCharWidth(items: PdfTextItems): number {
  const filtered = items.filter((item) => item.text.trim() !== "");
  if (!filtered.length) {
    return 0;
  }

  const heightCount = new Map<number, number>();
  let commonHeight = filtered[0].height;
  let maxHeightCount = 0;

  const fontCount = new Map<string, number>();
  let commonFont = filtered[0].fontName;
  let maxFontCount = 0;

  for (const item of filtered) {
    const height = item.height;
    const fontName = item.fontName;
    const heightSeen = (heightCount.get(height) ?? 0) + 1;
    heightCount.set(height, heightSeen);
    if (heightSeen > maxHeightCount) {
      maxHeightCount = heightSeen;
      commonHeight = height;
    }

    const fontSeen = (fontCount.get(fontName) ?? 0) + item.text.length;
    fontCount.set(fontName, fontSeen);
    if (fontSeen > maxFontCount) {
      maxFontCount = fontSeen;
      commonFont = fontName;
    }
  }

  const commonItems = filtered.filter(
    (item) => item.height === commonHeight && item.fontName === commonFont
  );

  if (!commonItems.length) {
    return 0;
  }

  const { widthSum, charCount } = commonItems.reduce(
    (acc, item) => {
      acc.widthSum += item.width;
      acc.charCount += item.text.length;
      return acc;
    },
    { widthSum: 0, charCount: 0 }
  );

  return charCount ? widthSum / charCount : 0;
}
