import { extractKeywords } from "./keywords";
import { embedTexts } from "./embeddings";
import { CANONICAL_SKILLS, SKILL_ALIASES } from "./skills.dictionary";
import type { JsonResume } from "../ui-shared/schema";
import type { JDItem } from "../ui-shared/types.jd";

const normalizationCache = new Map<string, string>();
let canonicalEmbeddings: Promise<number[][]> | null = null;

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getCanonicalEmbeddings(): Promise<number[][]> {
  if (!canonicalEmbeddings) {
    canonicalEmbeddings = embedTexts(CANONICAL_SKILLS);
  }
  return canonicalEmbeddings;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB) || 1;
  return dot / denominator;
}

function applyAliases(skill: string): string | null {
  if (SKILL_ALIASES[skill]) {
    return SKILL_ALIASES[skill];
  }
  if (CANONICAL_SKILLS.includes(skill)) {
    return skill;
  }
  return null;
}

export async function normalizeSkills(candidates: string[]): Promise<string[]> {
  const canonicalMatches = new Set<string>();
  const pending: string[] = [];

  candidates.forEach((candidate) => {
    const normalized = normalizeToken(candidate);
    if (!normalized) return;
    const alias = applyAliases(normalized);
    if (alias) {
      canonicalMatches.add(alias);
      normalizationCache.set(normalized, alias);
      return;
    }
    if (normalizationCache.has(normalized)) {
      const cached = normalizationCache.get(normalized);
      if (cached) {
        canonicalMatches.add(cached);
      }
      return;
    }
    pending.push(normalized);
  });

  if (pending.length) {
    const [pendingEmbeddings, canonical] = await Promise.all([embedTexts(pending), getCanonicalEmbeddings()]);
    pending.forEach((term, index) => {
      const vector = pendingEmbeddings[index];
      let bestMatch = "";
      let bestScore = -Infinity;
      CANONICAL_SKILLS.forEach((skill, idx) => {
        const score = cosineSimilarity(vector, canonical[idx]);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = skill;
        }
      });
      if (bestScore >= 0.7) {
        canonicalMatches.add(bestMatch);
        normalizationCache.set(term, bestMatch);
      } else {
        normalizationCache.set(term, term);
        canonicalMatches.add(term);
      }
    });
  }

  return Array.from(canonicalMatches).sort();
}

function collectResumeTextSections(resume: JsonResume): string[] {
  const sections: string[] = [];
  // Note: summary is handled separately in computeProfileSkills, so we don't include it here
  (resume.work ?? []).forEach((job) => {
    if (job.summary) sections.push(job.summary);
    (job.highlights ?? []).forEach((highlight) => sections.push(highlight));
  });
  (resume.projects ?? []).forEach((project) => {
    if (project.description) sections.push(project.description);
    (project.highlights ?? []).forEach((highlight) => sections.push(highlight));
  });
  (resume.certificates ?? []).forEach((cert) => {
    if (cert.name) sections.push(cert.name);
  });
  (resume.awards ?? []).forEach((award) => {
    if (award.summary) sections.push(award.summary);
  });
  (resume.languages ?? []).forEach((lang) => {
    sections.push(lang.language);
    if (lang.fluency) sections.push(lang.fluency);
  });
  return sections;
}

export async function computeProfileSkills(resume: JsonResume): Promise<string[]> {
  const candidates = new Set<string>();

  // 1. Collect explicit skills from skills section
  (resume.skills ?? []).forEach((skill) => {
    if (skill.name) candidates.add(skill.name);
    (skill.keywords ?? []).forEach((keyword) => candidates.add(keyword));
  });

  // 2. Extract keywords from summary separately (higher priority)
  if (resume.basics?.summary) {
    try {
      const summaryKeywords = await extractKeywords([resume.basics.summary], 20);
      summaryKeywords.forEach(({ term }) => candidates.add(term));
    } catch (error) {
      console.warn("JobSnap summary keyword extraction failed", error);
    }
  }

  // 3. Extract keywords from other text sections (work, projects, etc.)
  const textSections = collectResumeTextSections(resume);
  if (textSections.length) {
    try {
      const keywords = await extractKeywords(textSections, 40);
      keywords.forEach(({ term }) => candidates.add(term));
    } catch (error) {
      console.warn("JobSnap profile keyword extraction failed", error);
    }
  }

  const normalized = await normalizeSkills(Array.from(candidates));
  return normalized;
}

export async function computeJobSkills(item: JDItem): Promise<string[]> {
  try {
    const keywords = await extractKeywords([item.text], 40);
    const candidates = keywords.map((keyword) => keyword.term);
    return normalizeSkills(candidates);
  } catch (error) {
    console.warn("JobSnap job skill extraction failed", error);
    return [];
  }
}

export function computeSkillGap(profileSkills: string[], jobSkills: string[], resume?: JsonResume) {
  const profileSet = new Set(profileSkills.map((skill) => skill.toLowerCase()));
  const jobSet = new Set(jobSkills.map((skill) => skill.toLowerCase()));

  const matched: string[] = [];
  const missing: string[] = [];

  // Extract degrees from resume education if available
  const userDegrees = resume ? extractDegreesFromEducation(resume) : new Set<string>();

  jobSet.forEach((skill) => {
    const skillLower = skill.toLowerCase();

    // Check if this is a degree requirement
    if (isDegreeRequirement(skill)) {
      // Check against user's education
      if (hasDegreeMatch(skill, userDegrees)) {
        matched.push(skill);
      } else {
        missing.push(skill);
      }
    } else {
      // Regular skill matching
      if (profileSet.has(skillLower)) {
        matched.push(skill);
      } else {
        missing.push(skill);
      }
    }
  });

  matched.sort();
  missing.sort();
  return { matched, missing };
}

function isDegreeRequirement(skill: string): boolean {
  const degreePattern = /\b(bachelor'?s?|master'?s?|phd|doctorate|mba|associate'?s?)\s*(degree)?/i;
  return degreePattern.test(skill);
}

function extractDegreesFromEducation(resume: JsonResume): Set<string> {
  const degrees = new Set<string>();

  (resume.education ?? []).forEach((edu) => {
    const studyType = edu.studyType?.toLowerCase() || '';
    const area = edu.area?.toLowerCase() || '';
    const combined = `${studyType} ${area}`.toLowerCase();

    // Map various degree formats to standard names
    if (/associate|aa|as/i.test(combined)) {
      degrees.add("associate's degree");
    }
    if (/bachelor|ba|bs|bsc/i.test(combined)) {
      degrees.add("bachelor's degree");
    }
    if (/master|ma|ms|msc/i.test(combined)) {
      degrees.add("master's degree");
    }
    if (/mba/i.test(combined)) {
      degrees.add("mba");
    }
    if (/phd|ph\.d|doctorate/i.test(combined)) {
      degrees.add("phd");
    }
  });

  return degrees;
}

function hasDegreeMatch(requirement: string, userDegrees: Set<string>): boolean {
  const reqLower = requirement.toLowerCase();

  // Define degree hierarchy (higher degrees satisfy lower requirements)
  const degreeHierarchy = {
    "associate's degree": 1,
    "bachelor's degree": 2,
    "master's degree": 3,
    "mba": 3,
    "phd": 4
  };

  // Determine what degree is required
  let requiredLevel = 0;
  let requiredDegree = '';

  for (const [degree, level] of Object.entries(degreeHierarchy)) {
    // Normalize both the degree name and requirement for comparison
    const normalizedDegree = degree.replace(/'/g, "");
    const normalizedReq = reqLower.replace(/'/g, "");
    if (normalizedReq.includes(normalizedDegree.replace(" degree", ""))) {
      requiredLevel = level;
      requiredDegree = degree;
      break;
    }
  }

  if (requiredLevel === 0) return false;

  // Check if user has this degree or a higher one
  for (const userDegree of userDegrees) {
    const userLevel = degreeHierarchy[userDegree as keyof typeof degreeHierarchy] || 0;
    if (userLevel >= requiredLevel) {
      return true;
    }
  }

  return false;
}

export function unionSkills(items: string[][]): string[] {
  const set = new Set<string>();
  items.forEach((list) => list.forEach((skill) => set.add(skill)));
  return Array.from(set).sort();
}

export function formatSkill(skill: string): string {
  return skill
    .split(/\s+/)
    .map((token) => (token.length <= 3 ? token.toUpperCase() : token.charAt(0).toUpperCase() + token.slice(1)))
    .join(" ");
}
