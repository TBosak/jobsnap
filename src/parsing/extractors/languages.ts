import type { JsonResumeLanguage } from "../../ui-shared/schema";
import type { SectionBlock } from "../types";
import { tokenize } from "../utils";

export function extractLanguages(section?: SectionBlock): JsonResumeLanguage[] {
  if (!section) {
    return [];
  }

  const languages = new Map<string, string | undefined>();

  for (const line of section.lines) {
    const tokens = tokenize(line);
    for (const token of tokens) {
      const [language, rest] = token.split(/[-:()]/);
      const name = language.trim();
      if (!name) continue;
      const fluency = rest ? rest.trim() : inferFluency(token);
      if (!languages.has(name)) {
        languages.set(name, fluency);
      }
    }
  }

  return Array.from(languages.entries()).map(([language, fluency]) => ({
    language,
    fluency: fluency || undefined
  }));
}

function inferFluency(token: string): string | undefined {
  if (/native/i.test(token)) return "Native";
  if (/fluent/i.test(token)) return "Fluent";
  if (/professional/i.test(token)) return "Professional";
  if (/conversational|intermediate/i.test(token)) return "Intermediate";
  if (/basic|elementary/i.test(token)) return "Basic";
  return undefined;
}
