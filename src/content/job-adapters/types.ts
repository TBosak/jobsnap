export interface JobPageExtract {
  title?: string;
  company?: string;
  text: string;
}

export interface JobAdapter {
  canHandle(doc: Document, url: URL): boolean;
  extract(doc: Document, url: URL): JobPageExtract | null | Promise<JobPageExtract | null>;
}
