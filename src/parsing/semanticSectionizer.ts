import { embedTexts } from "../analysis/embeddings";
import type { SectionBlock, SectionId } from "./types";

// Reference embeddings for each section type - covering ALL industries
const SECTION_REFERENCES = {
  experience: [
    "Worked as software engineer at Google",
    "Registered nurse at Memorial Hospital",
    "Senior accountant at Deloitte",
    "Marketing manager for consumer products",
    "Elementary school teacher for 5 years",
    "Sales representative for pharmaceutical company",
    "Project manager at construction firm",
    "Financial advisor at investment bank",
    "Graphic designer for advertising agency",
    "Operations manager at manufacturing plant",
    "Human resources coordinator",
    "Customer service representative",
    "Professional experience and employment history"
  ],
  education: [
    "Bachelor of Science in Computer Science",
    "Master of Business Administration",
    "Bachelor of Arts in English Literature",
    "Associate Degree in Nursing",
    "Doctor of Medicine from Harvard",
    "Bachelor of Education in Elementary Teaching",
    "Master of Fine Arts in Graphic Design",
    "Bachelor of Science in Accounting",
    "Certificate in Project Management",
    "High school diploma and trade school",
    "Educational background and academic qualifications"
  ],
  skills: [
    "Programming languages: Python, JavaScript",
    "Patient care and medical procedures",
    "Financial analysis and accounting",
    "Marketing strategy and brand management",
    "Classroom management and curriculum",
    "Sales techniques and customer relations",
    "Project planning and team leadership",
    "Graphic design and Adobe Creative Suite",
    "Communication and presentation skills",
    "Problem solving and critical thinking",
    "Microsoft Office and data analysis",
    "Technical skills and professional competencies"
  ],
  projects: [
    "Built a web application using React",
    "Implemented new patient care protocols",
    "Led cost reduction initiative saving $100K",
    "Developed marketing campaign increasing sales",
    "Created educational curriculum for students",
    "Managed construction project worth $2M",
    "Designed branding materials for startup",
    "Organized community fundraising event",
    "Personal projects and portfolio work",
    "Professional accomplishments and initiatives"
  ],
  certificates: [
    "AWS Certified Solutions Architect",
    "Registered Nurse (RN) License",
    "Certified Public Accountant (CPA)",
    "Project Management Professional (PMP)",
    "Google Analytics Certified",
    "First Aid and CPR Certification",
    "Real Estate License",
    "Teaching Credential and Education License",
    "Microsoft Office Specialist",
    "Industry certifications and professional licenses"
  ]
};

export async function classifySectionSemantically(text: string): Promise<{
  sectionId: SectionId;
  confidence: number;
}> {
  if (text.trim().length < 20) {
    return { sectionId: "other", confidence: 0 };
  }

  // Get embedding for the text block
  const [textEmbedding] = await embedTexts([text]);

  let bestMatch: { sectionId: SectionId; confidence: number } = {
    sectionId: "other",
    confidence: 0
  };

  // Compare against reference embeddings for each section type
  for (const [sectionId, references] of Object.entries(SECTION_REFERENCES)) {
    const referenceEmbeddings = await embedTexts(references);

    // Calculate average similarity to all reference texts
    const similarities = referenceEmbeddings.map(refEmb =>
      cosineSimilarity(textEmbedding, refEmb)
    );

    const avgSimilarity = similarities.reduce((a, b) => a + b) / similarities.length;

    if (avgSimilarity > bestMatch.confidence) {
      bestMatch = {
        sectionId: sectionId as SectionId,
        confidence: avgSimilarity
      };
    }
  }

  return bestMatch;
}

// Validate that heuristically detected section content actually matches the assigned type
async function validateSectionClassification(text: string, assignedSectionId: SectionId): Promise<{
  confidence: number;
  isValid: boolean;
}> {
  if (text.trim().length < 20) {
    return { confidence: 0, isValid: false };
  }

  // Get references for the specific section type that was assigned
  const references = SECTION_REFERENCES[assignedSectionId as keyof typeof SECTION_REFERENCES];
  if (!references) {
    return { confidence: 0, isValid: false };
  }

  // Get embeddings for the text and the reference patterns for this section type
  const [textEmbedding, referenceEmbeddings] = await Promise.all([
    embedTexts([text]),
    embedTexts(references)
  ]);

  // Calculate similarity to the assigned section type
  const similarities = referenceEmbeddings.map(refEmb =>
    cosineSimilarity(textEmbedding[0], refEmb)
  );

  const avgSimilarity = similarities.reduce((a, b) => a + b) / similarities.length;
  const maxSimilarity = Math.max(...similarities);

  // Use both average and max similarity to determine confidence
  // Higher weight on max similarity to catch strong matches
  const confidence = (avgSimilarity * 0.3) + (maxSimilarity * 0.7);

  return {
    confidence,
    isValid: confidence > 0.6
  };
}

export async function enhanceSectionDetection(sections: SectionBlock[]): Promise<SectionBlock[]> {
  const enhancedSections: SectionBlock[] = [];

  for (const section of sections) {
    if (section.id === "other") {
      // Fallback: Use semantic analysis for unidentified sections
      const text = section.lines.join(' ');
      const semantic = await classifySectionSemantically(text);

      if (semantic.confidence > 0.7 && semantic.sectionId !== "other") {
        enhancedSections.push({
          ...section,
          id: semantic.sectionId,
          heading: formatSectionHeading(semantic.sectionId)
        });
      } else {
        enhancedSections.push(section);
      }
    } else {
      // Validate heuristically detected sections with transformers.js
      const text = section.lines.join(' ');
      const validation = await validateSectionClassification(text, section.id);

      if (validation.confidence < 0.6) {
        // Low confidence in heuristic classification, try semantic analysis
        const semantic = await classifySectionSemantically(text);

        if (semantic.confidence > 0.7 && semantic.sectionId !== "other") {
          enhancedSections.push({
            ...section,
            id: semantic.sectionId,
            heading: formatSectionHeading(semantic.sectionId)
          });
        } else {
          // Keep original if semantic analysis also fails
          enhancedSections.push(section);
        }
      } else {
        // Keep heuristically detected sections with high validation confidence
        enhancedSections.push(section);
      }
    }
  }

  return enhancedSections;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB) || 1;
  return dot / denominator;
}

function formatSectionHeading(sectionId: SectionId): string {
  const headings: Record<SectionId, string> = {
    profile: "Profile",
    objective: "Objective",
    summary: "Professional Summary",
    experience: "Professional Experience",
    education: "Education",
    skills: "Skills",
    projects: "Projects",
    certificates: "Certifications",
    awards: "Awards",
    volunteer: "Volunteer Experience",
    languages: "Languages",
    other: "Other"
  };

  return headings[sectionId] || "Other";
}