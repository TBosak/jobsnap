import type { JsonResume } from "../../ui-shared/schema";
import type { SectionBlock } from "../types";
import { extractBasics } from "./basics";
import { extractWork } from "./work";
import { extractEducation } from "./education";
import { extractSkills } from "./skills";
import { extractProjects } from "./projects";
import { extractCertificates } from "./certificates";
import { extractLanguages } from "./languages";

export async function buildResume(sections: SectionBlock[], rawText: string): Promise<JsonResume> {
  const sectionMap = Object.fromEntries(sections.map((section) => [section.id, section])) as Record<string, SectionBlock>;

  const basics = await extractBasics(sections, rawText);
  const work = extractWork(sectionMap.experience);
  const education = extractEducation(sectionMap.education);
  const skills = extractSkills(sectionMap.skills);
  const projects = extractProjects(sectionMap.projects);
  const certificates = extractCertificates(sectionMap.certificates);
  const languages = extractLanguages(sectionMap.languages);

  return {
    basics,
    work,
    education,
    skills,
    projects,
    certificates,
    languages
  };
}
