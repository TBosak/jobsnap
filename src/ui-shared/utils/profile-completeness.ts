import type { ProfileRecord, JsonResume } from '../schema';

/**
 * Calculate profile completeness percentage (0-100)
 *
 * Counts filled fields across all resume sections:
 * - Basics: name, email, phone, location, summary (5 fields)
 * - Arrays: work, education, skills, projects, certificates, publications,
 *           languages, awards, volunteer, references, interests (11 fields)
 *
 * Total possible: 16 fields
 */
export function calculateCompleteness(profile: ProfileRecord): number {
  const resume = profile.resume;
  let filled = 0;
  const total = 16;

  // Basics (5 fields)
  if (resume.basics?.name) filled++;
  if (resume.basics?.email) filled++;
  if (resume.basics?.phone) filled++;
  if (resume.basics?.location?.address) filled++;
  if (resume.basics?.summary) filled++;

  // Arrays (11 fields) - count non-empty arrays
  if (resume.work && resume.work.length > 0) filled++;
  if (resume.education && resume.education.length > 0) filled++;
  if (resume.skills && resume.skills.length > 0) filled++;
  if (resume.projects && resume.projects.length > 0) filled++;
  if (resume.certificates && resume.certificates.length > 0) filled++;
  if (resume.publications && resume.publications.length > 0) filled++;
  if (resume.languages && resume.languages.length > 0) filled++;
  if (resume.awards && resume.awards.length > 0) filled++;
  if (resume.volunteer && resume.volunteer.length > 0) filled++;
  if (resume.references && resume.references.length > 0) filled++;
  if (resume.interests && resume.interests.length > 0) filled++;

  return Math.round((filled / total) * 100);
}
