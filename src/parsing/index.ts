import type { JsonResume } from "../ui-shared/schema";
import { buildResume } from "./extractors";
import { parseDocx } from "./docx";
import { parsePdf } from "./pdf";
import { parsePdfWithOcr } from "./pdf_ocr";
import { sectionize, sectionizeFromPdfLines } from "./sectionizer";
import { enhanceSectionDetection } from "./semanticSectionizer";
import type { RawParseResult, PdfParseResult } from "./types";

export interface ParseResult {
  resume: JsonResume;
  rawText: string;
  meta: {
    parser: RawParseResult["meta"]["parser"];
    semanticEnhanced?: boolean;
  };
}

const MIN_TEXT_LENGTH_FOR_PDF = 600;
const NON_ASCII_RATIO_THRESHOLD = 0.2;

export async function parseResume(file: File): Promise<ParseResult> {
  const extension = getExtension(file.name);
  let raw: RawParseResult;

  if (extension === "pdf") {
    raw = await parsePdf(await file.arrayBuffer());
    if (needsOcr(raw.text)) {
      const ocrResult = await parsePdfWithOcr(file);
      raw = ocrResult;
    }
  } else if (extension === "docx" || extension === "doc") {
    raw = await parseDocx(await file.arrayBuffer());
  } else {
    const textDecoder = new TextDecoder();
    const fallbackText = textDecoder.decode(await file.arrayBuffer());
    raw = {
      text: fallbackText,
      meta: {
        parser: "unknown",
        charCount: fallbackText.length
      }
    } as RawParseResult;
  }

  const sections = hasPdfLines(raw) ? sectionizeFromPdfLines(raw.lines ?? []) : sectionize(raw.text);

  // Enhance section detection with semantic analysis (optional, async)
  let enhancedSections = sections;
  let semanticEnhanced = false;

  try {
    // Only use semantic enhancement if we have enough content
    if (raw.text.length > 500) {
      enhancedSections = await enhanceSectionDetection(sections);
      semanticEnhanced = true;
    }
  } catch (error) {
    console.warn("Semantic section enhancement failed, using traditional parsing:", error);
    // Fall back to traditional sections
  }

  const resume = await buildResume(enhancedSections, raw.text);

  return {
    resume,
    rawText: raw.text,
    meta: {
      parser: raw.meta.parser,
      semanticEnhanced
    }
  };
}

function getExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function hasPdfLines(raw: RawParseResult): raw is PdfParseResult {
  return !!(raw as PdfParseResult).lines?.length;
}

export function needsOcr(text: string): boolean {
  if (text.length === 0) {
    return true;
  }
  if (text.length < MIN_TEXT_LENGTH_FOR_PDF) {
    return true;
  }
  const nonAscii = text.split("").filter((char) => char.charCodeAt(0) > 126).length;
  const ratio = nonAscii / text.length;
  return ratio > NON_ASCII_RATIO_THRESHOLD;
}
