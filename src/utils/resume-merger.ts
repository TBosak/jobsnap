import type { JsonResume, WorkExperience, Education, Skill, Certificate } from "../ui-shared/schema";

/**
 * Resume data merging utilities
 *
 * Handles:
 * - Parsing and merging multiple resume files
 * - Fill-only imports that preserve existing data
 * - Smart conflict detection
 * - Array deduplication
 * - Multi-source conflict resolution
 */

export interface FillOptions {
  /** How to handle array fields: 'merge' adds unique items, 'skip' preserves existing */
  arrays: 'merge' | 'skip';
}

export interface MergeConflict {
  field: string;
  existingValue: unknown;
  importedValue: unknown;
  section: string;
}

export interface MergePreview {
  hasConflicts: boolean;
  conflicts: MergeConflict[];
  newFields: string[];
  preservedFields: string[];
  mergedData: JsonResume;
}

/**
 * Represents a value option from a specific source
 */
export interface ValueOption {
  value: unknown;
  source: string; // File name or "Current Profile"
  sourceIndex?: number; // Index in the files array
}

/**
 * Represents a conflict between multiple file sources
 */
export interface MultiSourceConflict {
  field: string;
  section: string;
  options: ValueOption[]; // All available values from different sources
}

/**
 * Result of analyzing multiple resumes for conflicts
 */
export interface MultiSourceAnalysis {
  hasConflicts: boolean;
  conflicts: MultiSourceConflict[];
  mergedData: JsonResume; // Merged data using first non-empty value
  fileNames: string[]; // Names of source files
}

/**
 * Merge multiple resume data objects into one
 * Used for multi-file upload when creating new profiles
 */
export function mergeResumeData(resumes: JsonResume[]): JsonResume {
  if (resumes.length === 0) {
    return { basics: {} };
  }

  if (resumes.length === 1) {
    return resumes[0];
  }

  const merged: JsonResume = {
    basics: {},
    work: [],
    education: [],
    skills: [],
    certificates: [],
    projects: [],
    publications: [],
    languages: [],
    interests: [],
    awards: [],
    volunteer: [],
    references: []
  };

  // Merge basics - first non-empty value wins
  for (const resume of resumes) {
    if (resume.basics) {
      merged.basics = {
        name: merged.basics?.name || resume.basics.name,
        label: merged.basics?.label || resume.basics.label,
        image: merged.basics?.image || resume.basics.image,
        email: merged.basics?.email || resume.basics.email,
        phone: merged.basics?.phone || resume.basics.phone,
        url: merged.basics?.url || resume.basics.url,
        summary: merged.basics?.summary || resume.basics.summary,
        location: merged.basics?.location || resume.basics.location,
        profiles: [...(merged.basics?.profiles || []), ...(resume.basics.profiles || [])]
      };
    }
  }

  // Deduplicate profiles
  if (merged.basics?.profiles) {
    merged.basics.profiles = deduplicateProfiles(merged.basics.profiles);
  }

  // Merge arrays - combine and deduplicate
  for (const resume of resumes) {
    if (resume.work) {
      merged.work = [...(merged.work || []), ...resume.work];
    }
    if (resume.education) {
      merged.education = [...(merged.education || []), ...resume.education];
    }
    if (resume.skills) {
      merged.skills = [...(merged.skills || []), ...resume.skills];
    }
    if (resume.certificates) {
      merged.certificates = [...(merged.certificates || []), ...resume.certificates];
    }
    if (resume.projects) {
      merged.projects = [...(merged.projects || []), ...resume.projects];
    }
    if (resume.publications) {
      merged.publications = [...(merged.publications || []), ...resume.publications];
    }
    if (resume.languages) {
      merged.languages = [...(merged.languages || []), ...resume.languages];
    }
    if (resume.interests) {
      merged.interests = [...(merged.interests || []), ...resume.interests];
    }
    if (resume.awards) {
      merged.awards = [...(merged.awards || []), ...resume.awards];
    }
    if (resume.volunteer) {
      merged.volunteer = [...(merged.volunteer || []), ...resume.volunteer];
    }
    if (resume.references) {
      merged.references = [...(merged.references || []), ...resume.references];
    }
  }

  // Deduplicate all arrays
  merged.work = deduplicateWork(merged.work || []);
  merged.education = deduplicateEducation(merged.education || []);
  merged.skills = deduplicateSkills(merged.skills || []);
  merged.certificates = deduplicateCertificates(merged.certificates || []);
  merged.projects = deduplicateProjects(merged.projects || []);

  return merged;
}

/**
 * Fill only empty fields in existing profile
 * Used for importing data into existing profiles
 */
export function fillEmptyFields(
  existing: JsonResume,
  imported: JsonResume,
  options: FillOptions = { arrays: 'merge' }
): JsonResume {
  const result: JsonResume = JSON.parse(JSON.stringify(existing)); // Deep clone

  // Fill basic fields only if empty
  if (imported.basics) {
    if (!result.basics) result.basics = {};

    result.basics.name = result.basics.name || imported.basics.name;
    result.basics.label = result.basics.label || imported.basics.label;
    result.basics.image = result.basics.image || imported.basics.image;
    result.basics.email = result.basics.email || imported.basics.email;
    result.basics.phone = result.basics.phone || imported.basics.phone;
    result.basics.url = result.basics.url || imported.basics.url;
    result.basics.summary = result.basics.summary || imported.basics.summary;
    result.basics.location = result.basics.location || imported.basics.location;

    // Merge profiles
    if (imported.basics.profiles) {
      result.basics.profiles = deduplicateProfiles([
        ...(result.basics.profiles || []),
        ...imported.basics.profiles
      ]);
    }
  }

  // Handle arrays based on options
  if (options.arrays === 'merge') {
    // Merge unique items
    result.work = deduplicateWork([
      ...(result.work || []),
      ...(imported.work || [])
    ]);

    result.education = deduplicateEducation([
      ...(result.education || []),
      ...(imported.education || [])
    ]);

    result.skills = deduplicateSkills([
      ...(result.skills || []),
      ...(imported.skills || [])
    ]);

    result.certificates = deduplicateCertificates([
      ...(result.certificates || []),
      ...(imported.certificates || [])
    ]);

    result.projects = deduplicateProjects([
      ...(result.projects || []),
      ...(imported.projects || [])
    ]);

    result.publications = [...(result.publications || []), ...(imported.publications || [])];
    result.languages = [...(result.languages || []), ...(imported.languages || [])];
    result.interests = [...(result.interests || []), ...(imported.interests || [])];
    result.awards = [...(result.awards || []), ...(imported.awards || [])];
    result.volunteer = [...(result.volunteer || []), ...(imported.volunteer || [])];
    result.references = [...(result.references || []), ...(imported.references || [])];
  } else {
    // Skip arrays if existing has any items
    result.work = result.work?.length ? result.work : imported.work;
    result.education = result.education?.length ? result.education : imported.education;
    result.skills = result.skills?.length ? result.skills : imported.skills;
    result.certificates = result.certificates?.length ? result.certificates : imported.certificates;
    result.projects = result.projects?.length ? result.projects : imported.projects;
    result.publications = result.publications?.length ? result.publications : imported.publications;
    result.languages = result.languages?.length ? result.languages : imported.languages;
    result.interests = result.interests?.length ? result.interests : imported.interests;
    result.awards = result.awards?.length ? result.awards : imported.awards;
    result.volunteer = result.volunteer?.length ? result.volunteer : imported.volunteer;
    result.references = result.references?.length ? result.references : imported.references;
  }

  return result;
}

/**
 * Analyze merge to detect conflicts and preview changes
 */
export function analyzeMerge(
  existing: JsonResume,
  imported: JsonResume,
  options: FillOptions = { arrays: 'merge' }
): MergePreview {
  const conflicts: MergeConflict[] = [];
  const newFields: string[] = [];
  const preservedFields: string[] = [];

  // Check basic fields for conflicts
  if (imported.basics) {
    const checkBasicField = (field: keyof typeof imported.basics, section: string) => {
      const existingVal = existing.basics?.[field];
      const importedVal = imported.basics?.[field];

      if (importedVal && existingVal && existingVal !== importedVal) {
        conflicts.push({
          field,
          existingValue: existingVal,
          importedValue: importedVal,
          section
        });
        preservedFields.push(`basics.${field}`);
      } else if (importedVal && !existingVal) {
        newFields.push(`basics.${field}`);
      } else if (existingVal) {
        preservedFields.push(`basics.${field}`);
      }
    };

    checkBasicField('name', 'Basic Information');
    checkBasicField('email', 'Basic Information');
    checkBasicField('phone', 'Basic Information');
    checkBasicField('url', 'Basic Information');
    checkBasicField('summary', 'Professional Summary');
  }

  // Count new items in arrays
  if (options.arrays === 'merge') {
    const existingWorkKeys = new Set((existing.work || []).map(workKey));
    const newWork = (imported.work || []).filter(job => !existingWorkKeys.has(workKey(job)));
    if (newWork.length > 0) {
      newFields.push(`${newWork.length} new work experience entries`);
    }

    const existingSkillKeys = new Set((existing.skills || []).map(s => s.name?.toLowerCase()));
    const newSkills = (imported.skills || []).filter(s => !existingSkillKeys.has(s.name?.toLowerCase()));
    if (newSkills.length > 0) {
      newFields.push(`${newSkills.length} new skills`);
    }

    const existingEduKeys = new Set((existing.education || []).map(eduKey));
    const newEdu = (imported.education || []).filter(edu => !existingEduKeys.has(eduKey(edu)));
    if (newEdu.length > 0) {
      newFields.push(`${newEdu.length} new education entries`);
    }
  }

  const mergedData = fillEmptyFields(existing, imported, options);

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    newFields,
    preservedFields,
    mergedData
  };
}

// Deduplication functions

function deduplicateWork(work: WorkExperience[]): WorkExperience[] {
  const seen = new Set<string>();
  return work.filter(job => {
    const key = workKey(job);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function workKey(job: WorkExperience): string {
  return `${job.name}-${job.position}-${job.startDate}`.toLowerCase();
}

function deduplicateEducation(education: Education[]): Education[] {
  const seen = new Set<string>();
  return education.filter(edu => {
    const key = eduKey(edu);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function eduKey(edu: Education): string {
  return `${edu.institution}-${edu.studyType}-${edu.area}`.toLowerCase();
}

function deduplicateSkills(skills: Skill[]): Skill[] {
  const seen = new Set<string>();
  return skills.filter(skill => {
    const key = skill.name?.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deduplicateCertificates(certificates: Certificate[]): Certificate[] {
  const seen = new Set<string>();
  return certificates.filter(cert => {
    const key = `${cert.name}-${cert.issuer}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deduplicateProjects(projects: any[]): any[] {
  const seen = new Set<string>();
  return projects.filter(project => {
    const key = `${project.name}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deduplicateProfiles(profiles: any[]): any[] {
  const seen = new Set<string>();
  return profiles.filter(profile => {
    const key = `${profile.network}-${profile.username}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Analyze multiple resumes and detect conflicts between them
 * Returns all conflicting values so user can choose
 */
export function analyzeMultiSourceResumes(
  resumes: JsonResume[],
  fileNames: string[]
): MultiSourceAnalysis {
  if (resumes.length === 0) {
    return {
      hasConflicts: false,
      conflicts: [],
      mergedData: { basics: {} },
      fileNames: []
    };
  }

  if (resumes.length === 1) {
    return {
      hasConflicts: false,
      conflicts: [],
      mergedData: resumes[0],
      fileNames: [fileNames[0] || 'Resume']
    };
  }

  const conflicts: MultiSourceConflict[] = [];

  // Check each basic field for conflicts
  const basicFields: Array<keyof JsonResume['basics']> = [
    'name',
    'label',
    'email',
    'phone',
    'url',
    'summary',
    'image'
  ];

  for (const field of basicFields) {
    const options: ValueOption[] = [];
    const uniqueValues = new Set<string>();

    resumes.forEach((resume, index) => {
      let value = resume.basics?.[field];

      // Handle case where value might be stringified JSON
      if (value && typeof value === 'string') {
        value = value.trim();

        // Try to detect and parse stringified JSON key-value pairs
        // e.g., '"url": "https://example.com"' or '"url": "https://example.com",' -> 'https://example.com'
        const jsonMatch = value.match(/^"[^"]+"\s*:\s*"([^"]+)"\s*,?$/);
        if (jsonMatch) {
          value = jsonMatch[1];
        } else {
          // Try to parse if it looks like JSON
          const jsonObjectMatch = value.match(/^\{.*\}$/);
          if (jsonObjectMatch) {
            try {
              const parsed = JSON.parse(value);
              if (parsed && typeof parsed === 'object' && field in parsed) {
                value = parsed[field];
              }
            } catch {
              // Not valid JSON, keep original value
            }
          }
        }

        if (value && value.trim()) {
          const normalized = value.trim().toLowerCase();
          if (!uniqueValues.has(normalized)) {
            uniqueValues.add(normalized);
            options.push({
              value: value.trim(),
              source: fileNames[index] || `File ${index + 1}`,
              sourceIndex: index
            });
          }
        }
      }
    });

    // Only create conflict if there are 2+ distinct values
    if (options.length > 1) {
      conflicts.push({
        field: String(field),
        section: 'Basic Information',
        options
      });
    }
  }

  // Merge the resumes using existing logic
  const mergedData = mergeResumeData(resumes);

  // Sanitize all basic fields in merged data
  if (mergedData.basics) {
    for (const field of basicFields) {
      const value = mergedData.basics[field];
      if (value && typeof value === 'string') {
        let sanitized = value.trim();

        // Extract from JSON key-value pair format
        const jsonMatch = sanitized.match(/^"[^"]+"\s*:\s*"([^"]+)"\s*,?$/);
        if (jsonMatch) {
          (mergedData.basics as any)[field] = jsonMatch[1];
        }
      }
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    mergedData,
    fileNames
  };
}

/**
 * Apply user selections to resolve conflicts
 */
export function applyConflictResolutions(
  mergedData: JsonResume,
  conflicts: MultiSourceConflict[],
  selections: Record<string, unknown>
): JsonResume {
  const result: JsonResume = JSON.parse(JSON.stringify(mergedData));

  conflicts.forEach(conflict => {
    let selectedValue = selections[conflict.field];

    // Sanitize the selected value
    if (selectedValue && typeof selectedValue === 'string') {
      let sanitized = selectedValue.trim();

      // Extract from JSON key-value pair format
      const jsonMatch = sanitized.match(/^"[^"]+"\s*:\s*"([^"]+)"\s*,?$/);
      if (jsonMatch) {
        sanitized = jsonMatch[1];
      }

      selectedValue = sanitized;
    }

    if (selectedValue !== undefined && result.basics) {
      (result.basics as any)[conflict.field] = selectedValue;
    }
  });

  return result;
}
