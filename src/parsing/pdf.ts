import { ensurePdfjsWorker } from "./pdfjs";
import { readPdf } from "./readPdf";
import { groupTextItemsIntoLines } from "./groupTextItemsIntoLines";
import type { PdfParseResult } from "./types";

export async function parsePdf(buffer: ArrayBuffer): Promise<PdfParseResult> {
  const fromPdfParse = await tryPdfParse(buffer);
  if (fromPdfParse) {
    return fromPdfParse;
  }

  await ensurePdfjsWorker();
  const { items, pageCount } = await readPdf(buffer);
  const lines = groupTextItemsIntoLines(items);
  const text = lines
    .map((line) => line.map((item) => item.text).join(" ").trim())
    .filter(Boolean)
    .join("\n");

  return {
    text,
    lines,
    meta: {
      parser: "pdfjs",
      pageCount,
      charCount: text.length
    }
  };
}

async function tryPdfParse(buffer: ArrayBuffer): Promise<PdfParseResult | null> {
  if (typeof window !== "undefined") {
    return null;
  }

  try {
    const dynamicImport = Function("return import('pdf-parse')") as () => Promise<typeof import("pdf-parse")>;
    const pdfParseModule = await dynamicImport();
    const pdfParse = pdfParseModule.default ?? (pdfParseModule as unknown as (data: ArrayBuffer | Uint8Array) => Promise<any>);
    const BufferCtor = (globalThis as any).Buffer;
    if (!BufferCtor || typeof BufferCtor.from !== "function") {
      throw new Error("Buffer is not available in this environment");
    }
    const result = await pdfParse(BufferCtor.from(buffer));
    const text = (result.text ?? "").trim();
    return {
      text,
      meta: {
        parser: "pdf-parse",
        pageCount: result.numpages ?? 0,
        charCount: text.length
      }
    };
  } catch (error) {
    console.warn("pdf-parse failed, falling back to pdfjs-dist", error);
    return null;
  }
}
