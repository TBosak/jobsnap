export interface PdfTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
  hasEOL: boolean;
}

export type PdfTextItems = PdfTextItem[];
export type PdfLine = PdfTextItem[];
export type PdfLines = PdfLine[];

export interface PdfParseResult {
  text: string;
  lines?: PdfLines;
  meta: {
    parser: "pdf-parse" | "pdfjs";
    pageCount: number;
    charCount: number;
  };
}

export interface OcrParseResult {
  text: string;
  meta: {
    parser: "ocr";
    pageCount: number;
  };
}

export interface DocxParseResult {
  text: string;
  meta: {
    parser: "docx";
    charCount: number;
  };
}

export interface FallbackParseResult {
  text: string;
  meta: {
    parser: "unknown";
    charCount: number;
  };
}

export type RawParseResult = PdfParseResult | OcrParseResult | DocxParseResult | FallbackParseResult;

export type SectionId =
  | "profile"
  | "summary"
  | "objective"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certificates"
  | "awards"
  | "volunteer"
  | "languages"
  | "other";

export interface SectionBlock {
  id: SectionId;
  heading: string;
  lines: string[];
  rawLines?: PdfLines;
}
