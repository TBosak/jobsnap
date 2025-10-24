import JSZip from "jszip";
import type { ProfileRecord } from "../ui-shared/schema";

/**
 * Resume template processor and DOCX generator
 *
 * This module handles:
 * - Loading the resume template from /resumes/default/
 * - Replacing placeholders with profile data
 * - Generating a downloadable DOCX file
 */

export interface ResumeTemplate {
  name: string;
  path: string;
}

/**
 * Replace text content in Word document XML while preserving formatting
 * Word XML can split text across multiple <w:t> tags, so we need to handle this carefully
 */
function replaceInXml(xml: string, replacements: Record<string, string>): string {
  let result = xml;

  // Replace each placeholder
  for (const [placeholder, value] of Object.entries(replacements)) {
    // Simple replacement for now - handles cases where text is in single <w:t> tag
    const regex = new RegExp(`(<w:t[^>]*>)([^<]*${placeholder}[^<]*)(<\/w:t>)`, 'g');
    result = result.replace(regex, (match, opening, text, closing) => {
      return opening + text.replace(placeholder, value) + closing;
    });
  }

  return result;
}

/**
 * Format skills as Word XML bullet points
 */
function formatSkillsXml(skills: string[]): string {
  // For now, return simple list - we'll enhance this with proper Word XML formatting
  return skills.join(', ');
}

/**
 * Format work experience as Word XML
 */
function formatExperienceXml(work?: Array<{ company?: string; position?: string; startDate?: string; endDate?: string }>): string {
  if (!work || work.length === 0) return '';

  // For now, return simple text - we'll enhance with proper Word XML formatting
  return work.map(exp =>
    `${exp.company || ''} - ${exp.position || ''} (${exp.startDate || ''} - ${exp.endDate || 'Present'})`
  ).join('\n');
}

/**
 * Generate resume DOCX from profile data
 */
export async function generateResume(profile: ProfileRecord): Promise<Blob> {
  const zip = new JSZip();

  // Load template files from public folder
  const templatePath = '/resumes/default';

  try {
    // Fetch all template files
    const filesToLoad = [
      '[Content_Types].xml',
      '_rels/.rels',
      'docProps/app.xml',
      'docProps/core.xml',
      'word/_rels/document.xml.rels',
      'word/document.xml',
      'word/fontTable.xml',
      'word/numbering.xml',
      'word/settings.xml',
      'word/styles.xml',
      'word/webSettings.xml',
      'word/theme/theme1.xml'
    ];

    // Extract data from JSON Resume format
    const basics = profile.resume.basics || {};
    const work = profile.resume.work || [];
    const skillsList = profile.resume.skills || [];
    const education = profile.resume.education || [];
    const certificates = profile.resume.certificates || [];

    // Helper to safely get skill names
    const getSkillName = (index: number) => {
      return skillsList[index]?.name || skillsList[index]?.keywords?.[0] || '';
    };

    // Create comprehensive placeholder replacements
    const replacements: Record<string, string> = {
      // Contact Information
      '{{FULL_NAME}}': basics.name || profile.name || 'YOUR NAME',
      '{{PHONE}}': basics.phone || '',
      '{{EMAIL}}': basics.email || '',
      '{{WEBSITE}}': basics.url || '',
      '{{LINKEDIN_URL}}': basics.profiles?.find(p => p.network?.toLowerCase() === 'linkedin')?.url || '',

      // Job Title
      '{{JOB_TITLE}}': work[0]?.position || basics.label || '',

      // Summary (split into parts to handle XML text splitting)
      '{{SUMMARY_PART1}}': basics.summary?.substring(0, 150) || '',
      '{{SUMMARY_PART2}}': basics.summary?.substring(150, 300) || '',
      '{{SUMMARY_PART3}}': basics.summary?.substring(300, 450) || '',
      '{{SUMMARY_PART4}}': basics.summary?.substring(450) || '',

      // Skills (up to 19 skills)
      ...Array.from({ length: 19 }, (_, i) => ({
        [`{{SKILL_${i + 1}}}`]: getSkillName(i)
      })).reduce((acc, item) => ({ ...acc, ...item }), {}),

      // Work Experience 1 (most recent)
      '{{COMPANY_1}}': work[0]?.name || '',
      '{{LOCATION_1}}': work[0]?.location || '',
      '{{START_DATE_1}}': work[0]?.startDate || '',
      '{{END_DATE_1}}': work[0]?.endDate || 'Present',

      // Education
      '{{EDUCATION}}': education[0] ?
        `${education[0].studyType || ''}, ${education[0].institution || ''}, ${education[0].location || ''}` : '',
      '{{UNIVERSITY}}': education[0]?.institution || '',

      // Certification Numbers (if any)
      '{{CERT_NUMBER_1}}': certificates[0]?.id || '',
      '{{CERT_NUMBER_2}}': certificates[1]?.id || '',
    };

    // Load and process each file
    for (const file of filesToLoad) {
      const response = await fetch(`${templatePath}/${file}`);
      if (!response.ok) {
        console.warn(`Could not load template file: ${file}`);
        continue;
      }

      let content = await response.text();

      // Only replace placeholders in document.xml
      if (file === 'word/document.xml') {
        content = replaceInXml(content, replacements);
      }

      zip.file(file, content);
    }

    // Generate the DOCX blob
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    return blob;

  } catch (error) {
    console.error('Error generating resume:', error);
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
