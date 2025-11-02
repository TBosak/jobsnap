import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type { ProfileRecord } from "../ui-shared/schema";

/**
 * Resume template processor and DOCX generator using docxtemplater
 *
 * This module handles:
 * - Loading resume templates (built-in from manifest or user-uploaded)
 * - Populating templates with profile data using docxtemplater
 * - Managing custom template uploads and storage
 * - Generating downloadable DOCX files
 *
 * Template syntax:
 * - Simple values: {name}, {email}, {phone}, {website}, {linkedin}, {title}, {summary}
 * - Loops: {#work}...{/work}, {#skills}{name}{/skills}, {#education}...{/education}
 * - Conditionals: {#linkedin}{linkedin}{/linkedin}
 * - Skills by index: {skill1}, {skill2}, {skill3}, ... {skill18}
 *
 * Work experience loop:
 *   {#work}
 *     {company}, {position}, {location}
 *     {startMonthShort} {startYear} - {endDate}
 *     Date components: startYear, startMonth (01-12), startMonthName (January), startMonthShort (Jan), startDay
 *     Date components: endYear, endMonth, endMonthName, endMonthShort, endDay (empty for current positions)
 *     Note: For current positions (endDate = "Present" or empty), all end date components are empty strings
 *     Use {endDate} to display "Present" for current positions
 *   {/work}
 *
 * Education loop:
 *   {#education}
 *     {degree} in {area}, {institution}
 *     {startMonthShort} {startYear} - {endMonthShort} {endYear}
 *     Date components: same as work experience
 *   {/education}
 *
 * Certificates loop:
 *   {#certificates}
 *     {name} - {issuer}
 *     {monthName} {year}
 *     Date components: year, month, monthName, monthShort, day
 *   {/certificates}
 */

export interface ResumeTemplate {
  name: string;
  displayName: string;
  path: string;
  description?: string;
  builtin?: boolean;
}

interface TemplateManifest {
  version: string;
  templates: ResumeTemplate[];
}

interface DateComponents {
  original: string;
  year?: string;
  month?: string;
  monthName?: string;
  monthShort?: string;
  day?: string;
}

/**
 * Parse a date string and return components for template use
 * Supports formats: YYYY-MM-DD, YYYY-MM, YYYY, MM/DD/YYYY, etc.
 */
function parseDateComponents(dateStr: string | undefined): DateComponents {
  if (!dateStr) {
    return { original: '' };
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthShort = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const result: DateComponents = { original: dateStr };

  // Try to parse as Date
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    result.year = date.getFullYear().toString();
    result.month = (date.getMonth() + 1).toString().padStart(2, '0');
    result.monthName = monthNames[date.getMonth()];
    result.monthShort = monthShort[date.getMonth()];
    result.day = date.getDate().toString().padStart(2, '0');
    return result;
  }

  // Manual parsing for common formats
  // YYYY-MM-DD or YYYY-MM
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (isoMatch) {
    result.year = isoMatch[1];
    result.month = isoMatch[2];
    const monthIndex = parseInt(isoMatch[2], 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      result.monthName = monthNames[monthIndex];
      result.monthShort = monthShort[monthIndex];
    }
    if (isoMatch[3]) {
      result.day = isoMatch[3];
    }
    return result;
  }

  // MM/DD/YYYY
  const usMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    result.month = usMatch[1].padStart(2, '0');
    result.day = usMatch[2].padStart(2, '0');
    result.year = usMatch[3];
    const monthIndex = parseInt(usMatch[1], 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      result.monthName = monthNames[monthIndex];
      result.monthShort = monthShort[monthIndex];
    }
    return result;
  }

  // Just year (YYYY)
  const yearMatch = dateStr.match(/^(\d{4})$/);
  if (yearMatch) {
    result.year = yearMatch[1];
    return result;
  }

  return result;
}

/**
 * Get list of available resume templates
 * Reads from resumes.json and merges with user-uploaded templates from Chrome storage
 */
export async function getAvailableTemplates(): Promise<ResumeTemplate[]> {
  const allTemplates: ResumeTemplate[] = [];

  // Load built-in templates from manifest
  try {
    const response = await fetch('/resumes/resumes.json');
    if (response.ok) {
      const manifest: TemplateManifest = await response.json();
      allTemplates.push(...manifest.templates);
    }
  } catch (error) {
    console.warn('Failed to load template manifest:', error);
  }

  // Load user-uploaded templates from Chrome storage
  try {
    const result = await chrome.storage.local.get('customTemplates');
    if (result.customTemplates && Array.isArray(result.customTemplates)) {
      allTemplates.push(...result.customTemplates);
    }
  } catch (error) {
    console.warn('Failed to load custom templates:', error);
  }

  // Verify each template exists (for built-in templates only)
  const verified: ResumeTemplate[] = [];
  for (const template of allTemplates) {
    if (template.builtin) {
      try {
        const response = await fetch(template.path, { method: 'HEAD' });
        if (response.ok) {
          verified.push(template);
        }
      } catch (error) {
        console.warn(`Template ${template.name} not found at ${template.path}`);
      }
    } else {
      // User templates are stored as data URLs, always include them
      verified.push(template);
    }
  }

  return verified;
}

/**
 * Upload a custom template and save to Chrome storage
 * @param file - The DOCX file to upload
 * @param displayName - User-friendly name for the template
 */
export async function uploadCustomTemplate(file: File, displayName: string): Promise<void> {
  if (!file.name.endsWith('.docx')) {
    throw new Error('Only .docx files are supported');
  }

  // Convert file to data URL for storage
  const arrayBuffer = await file.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: file.type });
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

  // Create template entry
  const newTemplate: ResumeTemplate = {
    name: file.name.replace('.docx', ''),
    displayName: displayName || file.name.replace('.docx', ''),
    path: dataUrl,
    builtin: false
  };

  // Load existing custom templates
  const result = await chrome.storage.local.get('customTemplates');
  const customTemplates: ResumeTemplate[] = result.customTemplates || [];

  // Add new template
  customTemplates.push(newTemplate);

  // Save back to storage
  await chrome.storage.local.set({ customTemplates });
}

/**
 * Delete a custom template from Chrome storage
 * @param templateName - The name of the template to delete
 */
export async function deleteCustomTemplate(templateName: string): Promise<void> {
  const result = await chrome.storage.local.get('customTemplates');
  const customTemplates: ResumeTemplate[] = result.customTemplates || [];

  // Filter out the template
  const filtered = customTemplates.filter(t => t.name !== templateName);

  // Save back to storage
  await chrome.storage.local.set({ customTemplates: filtered });
}

/**
 * Generate resume DOCX from profile data using docxtemplater
 * @param profile - The profile data to use
 * @param templatePath - Optional path to template file (defaults to /resumes/default.docx)
 */
export async function generateResume(
  profile: ProfileRecord,
  templatePath: string = '/resumes/default.docx'
): Promise<Blob> {
  try {
    // Load the template file
    const response = await fetch(templatePath);
    if (!response.ok) {
      throw new Error(`Failed to load resume template from ${templatePath}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    // Load into PizZip
    const zip = new PizZip(arrayBuffer);

    // Create docxtemplater instance
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Extract data from JSON Resume format
    const basics = profile.resume.basics || {};
    const work = profile.resume.work || [];
    const skillsList = profile.resume.skills || [];
    const education = profile.resume.education || [];
    const certificates = profile.resume.certificates || [];

    // Prepare template data
    const skillsArray = skillsList.map(skill => ({
      name: skill.name || skill.keywords?.[0] || ''
    })).filter(s => s.name); // Filter out empty skills

    // Flatten skills into individual properties (skill1, skill2, etc.) for indexed access
    const skillsFlattened: Record<string, string> = {};
    skillsArray.forEach((skill, index) => {
      skillsFlattened[`skill${index + 1}`] = skill.name;
    });

    const templateData = {
      // Basic contact information
      name: basics.name || profile.name || 'YOUR NAME',
      email: basics.email || '',
      phone: basics.phone || '',
      website: basics.url || '',
      linkedin: basics.profiles?.find(p => p.network?.toLowerCase() === 'linkedin')?.url || '',

      // Professional information
      title: work[0]?.position || basics.label || '',
      summary: basics.summary || '',

      // Skills array - for loop syntax {#skills}{name}{/skills}
      skills: skillsArray,

      // Flattened skills - for indexed access {skill1}, {skill2}, etc.
      ...skillsFlattened,

      // Work experience array
      work: work.map(job => {
        const start = parseDateComponents(job.startDate);

        // Check if currently employed
        const isPresent = job.endDate?.toLowerCase() === 'present' || !job.endDate;
        const end = isPresent ? { original: 'Present' } : parseDateComponents(job.endDate);

        return {
          company: job.name || '',
          position: job.position || '',
          location: job.location || '',

          // Original date strings
          startDate: job.startDate || '',
          endDate: job.endDate || 'Present',

          // Start date components
          startYear: start.year || '',
          startMonth: start.month || '',
          startMonthName: start.monthName || '',
          startMonthShort: start.monthShort || '',
          startDay: start.day || '',

          // End date components - empty for current jobs (use {endDate} for "Present")
          endYear: isPresent ? '' : (end.year || ''),
          endMonth: isPresent ? '' : (end.month || ''),
          endMonthName: isPresent ? '' : (end.monthName || ''),
          endMonthShort: isPresent ? '' : (end.monthShort || ''),
          endDay: isPresent ? '' : (end.day || ''),

          summary: job.summary || '',
          highlights: job.highlights || []
        };
      }),

      // Education array
      education: education.map(edu => {
        const start = parseDateComponents(edu.startDate);
        const end = parseDateComponents(edu.endDate);

        return {
          degree: edu.studyType || '',
          institution: edu.institution || '',
          area: edu.area || '',
          location: edu.location || '',

          // Original date strings
          startDate: edu.startDate || '',
          endDate: edu.endDate || '',

          // Start date components
          startYear: start.year || '',
          startMonth: start.month || '',
          startMonthName: start.monthName || '',
          startMonthShort: start.monthShort || '',
          startDay: start.day || '',

          // End date components
          endYear: end.year || '',
          endMonth: end.month || '',
          endMonthName: end.monthName || '',
          endMonthShort: end.monthShort || '',
          endDay: end.day || '',

          gpa: edu.score || ''
        };
      }),

      // Certificates array
      certificates: certificates.map(cert => {
        const certDate = parseDateComponents(cert.date);

        return {
          name: cert.name || '',
          issuer: cert.issuer || '',

          // Original date string
          date: cert.date || '',

          // Date components
          year: certDate.year || '',
          month: certDate.month || '',
          monthName: certDate.monthName || '',
          monthShort: certDate.monthShort || '',
          day: certDate.day || '',

          url: cert.url || ''
        };
      })
    };

    // Set the data in the template
    doc.setData(templateData);

    // Render the document (replace all placeholders)
    doc.render();

    // Generate the DOCX blob
    const blob = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    return blob;

  } catch (error) {
    console.error('Error generating resume:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to generate resume: ${error.message}`);
    }
    throw new Error('Failed to generate resume. Please try again.');
  }
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
