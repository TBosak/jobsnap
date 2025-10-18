import { ensurePdfjsWorker } from "./pdfjs";
import type { OcrParseResult } from "./types";

interface OcrOptions {
  lang?: string;
}

export async function parsePdfWithOcr(file: File, options: OcrOptions = {}): Promise<OcrParseResult> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("OCR requires a DOM environment");
  }

  await ensurePdfjsWorker();
  const pdfjs = await import("pdfjs-dist");
  const { createWorker } = await import("tesseract.js");

  const buffer = await file.arrayBuffer();
  const pdfDocument = await pdfjs.getDocument({ data: buffer }).promise;
  const lang = options.lang ?? "eng";

  const workerPaths = resolveWorkerPaths();
  const workerConfig = {
    ...workerPaths,
    workerBlobURL: false,
    logger: () => undefined
  };
  const worker = await createWorker(lang, undefined, workerConfig as any);

  const anyWorker = worker as any;
  if (typeof anyWorker.load === "function") {
    await anyWorker.load();
  }
  if (typeof anyWorker.loadLanguage === "function") {
    await anyWorker.loadLanguage(lang);
  }
  if (typeof anyWorker.initialize === "function") {
    await anyWorker.initialize(lang);
  } else if (typeof anyWorker.reinitialize === "function") {
    await anyWorker.reinitialize(lang);
  }

  try {
    const pageTexts: string[] = [];
    for (let pageIndex = 1; pageIndex <= pdfDocument.numPages; pageIndex++) {
      const page = await pdfDocument.getPage(pageIndex);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = window.document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Failed to acquire 2d context for OCR rendering");
      }
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const renderTask = page.render({ canvasContext: context, viewport });
      await renderTask.promise;

      const { data } = await worker.recognize(canvas);
      pageTexts.push(data.text.trim());
    }

    const text = pageTexts.join("\n\n");
    return {
      text,
      meta: {
        parser: "ocr",
        pageCount: pdfDocument.numPages
      }
    };
  } finally {
    pdfDocument.destroy();
    await worker.terminate();
  }
}

function resolveWorkerPaths() {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    const getURL = chrome.runtime.getURL.bind(chrome.runtime);
    return {
      workerPath: getURL("tesseract/worker.min.js"),
      corePath: getURL("tesseract/tesseract-core.wasm.js"),
      langPath: getURL("tesseract/")
    };
  }
  return {};
}
