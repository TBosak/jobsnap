import { ensurePdfjsWorker } from "./pdfjs";
import type { PdfTextItem, PdfTextItems } from "./types";

export interface PdfReadResult {
  items: PdfTextItems;
  pageCount: number;
}

export async function readPdf(buffer: ArrayBuffer): Promise<PdfReadResult> {
  await ensurePdfjsWorker();
  const pdfjs = await import("pdfjs-dist");

  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const textItems: PdfTextItems = [];

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
    const page = await pdf.getPage(pageIndex);
    const textContent = await page.getTextContent();

    // ensure fonts loaded so commonObjs has entries
    await page.getOperatorList();
    const commonObjs = page.commonObjs;

    for (const item of textContent.items) {
      const textItem = item as any;
      const fontName = extractFontName(textItem, commonObjs);
      const transform: number[] = textItem.transform ?? [];
      const x = transform[4] ?? 0;
      const y = transform[5] ?? 0;
      const text = normalizeText(textItem.str ?? "");
      const width = textItem.width ?? 0;
      const height = textItem.height ?? 0;
      const hasEOL = Boolean(textItem.hasEOL);

      textItems.push({
        text,
        x,
        y,
        width,
        height,
        fontName,
        hasEOL
      });
    }
  }

  const filtered = textItems.filter((item) => item.text.trim() !== "" || item.hasEOL);

  return {
    items: filtered,
    pageCount: pdf.numPages
  };
}

function extractFontName(item: any, commonObjs: any): string {
  const pdfFontName = item.fontName;
  if (pdfFontName) {
    const font = commonObjs?.get?.(pdfFontName);
    if (font?.name) {
      return String(font.name);
    }
  }
  return typeof pdfFontName === "string" ? pdfFontName : "";
}

function normalizeText(text: string): string {
  return text.replace(/-­‐/g, "-");
}
