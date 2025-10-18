let setupPromise: Promise<void> | null = null;

export function ensurePdfjsWorker(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (!setupPromise) {
    setupPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker?worker&url");
      if (pdfjs.GlobalWorkerOptions) {
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default ?? worker;
      }
    })();
  }
  return setupPromise;
}
