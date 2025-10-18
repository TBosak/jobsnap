import type { JsonResumeSkill } from "../../ui-shared/schema";
import type { SectionBlock } from "../types";
import { tokenize } from "../utils";

export function extractSkills(section?: SectionBlock): JsonResumeSkill[] {
  if (!section) {
    return [];
  }
  const tokens = new Set<string>();
  for (const line of section.lines) {
    for (const token of tokenize(line)) {
      if (token.length) {
        tokens.add(normalizeSkill(token));
      }
    }
  }
  return Array.from(tokens).map((name) => ({ name }));
}

function normalizeSkill(value: string): string {
  return value.replace(/^[\d.\-]+/, "").trim();
}
