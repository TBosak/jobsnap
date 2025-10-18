import type { JsonResumeCertificate } from "../../ui-shared/schema";
import type { SectionBlock } from "../types";
import { detectUrl, parseDate, splitHighlights } from "../utils";

const ISSUER_HINT = /(issued|provider|organization)/i;

export function extractCertificates(section?: SectionBlock): JsonResumeCertificate[] {
  if (!section) {
    return [];
  }

  const entries: JsonResumeCertificate[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (!buffer.length) return;
    const lines = buffer.slice();
    buffer = [];

    const header = lines[0] ?? "";
    const description = lines.slice(1).join(" \n ");
    const url = detectUrl(description) ?? detectUrl(header);
    const issuerLine = lines.find((line) => ISSUER_HINT.test(line));
    const dateLine = lines.find((line) => /\d{4}/.test(line));

    entries.push({
      name: header.trim(),
      issuer: issuerLine ? issuerLine.replace(ISSUER_HINT, "").replace(/[:.-]/, "").trim() : undefined,
      date: parseDate(dateLine),
      url: url ?? undefined
    });
  };

  for (const line of section.lines) {
    if (!line.trim()) {
      flush();
      continue;
    }
    buffer.push(line);
  }
  flush();

  return entries.filter((entry) => entry.name);
}
