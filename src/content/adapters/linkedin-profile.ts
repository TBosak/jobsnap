import type { JsonResume } from "../../ui-shared/schema";

/**
 * LinkedIn Profile to JobSnap Profile Converter
 *
 * This adapter extracts profile data from LinkedIn profile pages and converts
 * it to JobSnap's profile format. It uses multiple parsing strategies similar
 * to the linkedin-to-jsonresume extension.
 */

interface LinkedInProfileData {
  basics?: {
    name?: string;
    headline?: string;
    summary?: string;
    location?: string;
    email?: string;
    phone?: string;
    website?: string;
    image?: string;
  };
  experience?: Array<{
    company?: string;
    title?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
    location?: string;
  }>;
  education?: Array<{
    institution?: string;
    degree?: string;
    fieldOfStudy?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  skills?: Array<{
    name: string;
    endorsements?: number;
  }>;
  languages?: Array<{
    name: string;
    proficiency?: string;
  }>;
  certifications?: Array<{
    name: string;
    authority?: string;
    licenseNumber?: string;
    startDate?: string;
    endDate?: string;
    url?: string;
  }>;
}

/**
 * Type mappings for LinkedIn's internal data structure
 * Based on the linkedin-to-jsonresume extension's approach
 */
const LI_TYPE_MAPPINGS = {
  profile: {
    tocKeys: ["*profile"],
    types: [
      "com.linkedin.voyager.identity.profile.Profile",
      "com.linkedin.voyager.dash.identity.profile.Profile"
    ]
  },
  experience: {
    tocKeys: ["*positionView", "*positionGroupView"],
    types: [
      "com.linkedin.voyager.identity.profile.Position",
      "com.linkedin.voyager.dash.identity.profile.Position"
    ]
  },
  education: {
    tocKeys: ["*educationView"],
    types: [
      "com.linkedin.voyager.identity.profile.Education",
      "com.linkedin.voyager.dash.identity.profile.Education"
    ]
  },
  skills: {
    tocKeys: ["*skillView"],
    types: [
      "com.linkedin.voyager.identity.profile.Skill",
      "com.linkedin.voyager.dash.identity.profile.Skill"
    ]
  },
  certifications: {
    tocKeys: ["*certificationView"],
    types: [
      "com.linkedin.voyager.dash.identity.profile.Certification"
    ]
  },
  languages: {
    tocKeys: ["*languageView"],
    types: [
      "com.linkedin.voyager.identity.profile.Language"
    ]
  }
};

export class LinkedInProfileParser {
  private voyagerDb: any = null;

  constructor() {
    this.initializeVoyagerDb();
  }

  /**
   * Initialize access to LinkedIn's Voyager data
   */
  private initializeVoyagerDb(): void {
    try {
      // LinkedIn stores profile data in a global voyager database
      const voyagerEndpoints = (window as any)?.voyagerEndpoints;
      if (voyagerEndpoints) {
        this.voyagerDb = voyagerEndpoints;
      }
    } catch (error) {
      console.warn("Could not access LinkedIn Voyager data:", error);
    }
  }

  /**
   * Main parsing function - attempts multiple extraction strategies
   */
  async parseProfile(): Promise<LinkedInProfileData | null> {
    try {
      // Strategy 1: Parse embedded JSON-LD schema
      const schemaData = this.parseEmbeddedSchema();
      if (schemaData) {
        return schemaData;
      }

      // Strategy 2: Parse Voyager API data
      const voyagerData = this.parseVoyagerData();
      if (voyagerData) {
        return voyagerData;
      }

      // Strategy 3: DOM scraping fallback
      const domData = this.parseDOMElements();
      return domData;

    } catch (error) {
      console.error("LinkedIn profile parsing failed:", error);
      return null;
    }
  }

  /**
   * Extract profile data from embedded JSON-LD schema
   */
  private parseEmbeddedSchema(): LinkedInProfileData | null {
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');

      for (const script of scripts) {
        const data = JSON.parse(script.textContent || "{}");

        if (data["@type"] === "Person" || data["@context"]?.includes("schema.org")) {
          return this.convertSchemaToProfile(data);
        }
      }
    } catch (error) {
      console.warn("Schema parsing failed:", error);
    }

    return null;
  }

  /**
   * Extract profile data from LinkedIn's Voyager data structure
   */
  private parseVoyagerData(): LinkedInProfileData | null {
    if (!this.voyagerDb) {
      return null;
    }

    try {
      const profileData: LinkedInProfileData = {};

      // Extract basic profile info
      const profileEntries = this.getVoyagerValuesByKeys(LI_TYPE_MAPPINGS.profile.tocKeys);
      if (profileEntries.length > 0) {
        profileData.basics = this.parseBasicsFromVoyager(profileEntries[0]);
      }

      // Extract experience
      const experienceEntries = this.getVoyagerValuesByKeys(LI_TYPE_MAPPINGS.experience.tocKeys);
      if (experienceEntries.length > 0) {
        profileData.experience = this.parseExperienceFromVoyager(experienceEntries);
      }

      // Extract education
      const educationEntries = this.getVoyagerValuesByKeys(LI_TYPE_MAPPINGS.education.tocKeys);
      if (educationEntries.length > 0) {
        profileData.education = this.parseEducationFromVoyager(educationEntries);
      }

      // Extract skills
      const skillEntries = this.getVoyagerValuesByKeys(LI_TYPE_MAPPINGS.skills.tocKeys);
      if (skillEntries.length > 0) {
        profileData.skills = this.parseSkillsFromVoyager(skillEntries);
      }

      return profileData;
    } catch (error) {
      console.warn("Voyager parsing failed:", error);
      return null;
    }
  }

  /**
   * Fallback DOM scraping approach
   */
  private parseDOMElements(): LinkedInProfileData | null {
    try {
      const profileData: LinkedInProfileData = {};

      // Extract name
      const nameEl = document.querySelector('.pv-text-details__left-panel h1');
      const headline = document.querySelector('.pv-text-details__left-panel .text-body-medium');

      if (nameEl || headline) {
        profileData.basics = {
          name: nameEl?.textContent?.trim(),
          headline: headline?.textContent?.trim()
        };
      }

      // Extract experience section
      const experienceSection = document.querySelector('#experience-section, [data-section="experienceSection"]');
      if (experienceSection) {
        profileData.experience = this.parseExperienceFromDOM(experienceSection);
      }

      // Extract education section
      const educationSection = document.querySelector('#education-section, [data-section="educationSection"]');
      if (educationSection) {
        profileData.education = this.parseEducationFromDOM(educationSection);
      }

      return profileData;
    } catch (error) {
      console.warn("DOM parsing failed:", error);
      return null;
    }
  }

  /**
   * Convert JSON-LD schema data to profile format
   */
  private convertSchemaToProfile(schemaData: any): LinkedInProfileData {
    return {
      basics: {
        name: schemaData.name,
        headline: schemaData.jobTitle,
        summary: schemaData.description,
        email: schemaData.email,
        website: schemaData.url,
        image: schemaData.image
      }
    };
  }

  /**
   * Helper to get values from Voyager DB by keys
   */
  private getVoyagerValuesByKeys(keys: string[]): any[] {
    if (!this.voyagerDb) {
      return [];
    }

    const results: any[] = [];
    for (const key of keys) {
      try {
        const entries = this.voyagerDb.getValuesByKey?.(key) || [];
        results.push(...entries);
      } catch (error) {
        console.warn(`Failed to get Voyager data for key ${key}:`, error);
      }
    }
    return results;
  }

  /**
   * Parse basic profile info from Voyager data
   */
  private parseBasicsFromVoyager(profileEntry: any): LinkedInProfileData['basics'] {
    try {
      return {
        name: `${profileEntry.firstName || ''} ${profileEntry.lastName || ''}`.trim(),
        headline: profileEntry.headline,
        summary: profileEntry.summary,
        location: profileEntry.locationName || profileEntry.geoLocationName,
        image: profileEntry.profilePicture?.displayImageReference?.vectorImage?.rootUrl
      };
    } catch (error) {
      console.warn("Failed to parse basics from Voyager:", error);
      return {};
    }
  }

  /**
   * Parse experience from Voyager data
   */
  private parseExperienceFromVoyager(experienceEntries: any[]): LinkedInProfileData['experience'] {
    return experienceEntries.map(entry => {
      try {
        return {
          company: entry.companyName,
          title: entry.title,
          startDate: this.formatVoyagerDate(entry.timePeriod?.startDate),
          endDate: this.formatVoyagerDate(entry.timePeriod?.endDate),
          description: entry.description,
          location: entry.locationName
        };
      } catch (error) {
        console.warn("Failed to parse experience entry:", error);
        return {};
      }
    }).filter(exp => exp.company || exp.title);
  }

  /**
   * Parse education from Voyager data
   */
  private parseEducationFromVoyager(educationEntries: any[]): LinkedInProfileData['education'] {
    return educationEntries.map(entry => {
      try {
        return {
          institution: entry.schoolName,
          degree: entry.degreeName,
          fieldOfStudy: entry.fieldOfStudy,
          startDate: this.formatVoyagerDate(entry.timePeriod?.startDate),
          endDate: this.formatVoyagerDate(entry.timePeriod?.endDate),
          description: entry.description
        };
      } catch (error) {
        console.warn("Failed to parse education entry:", error);
        return {};
      }
    }).filter(edu => edu.institution || edu.degree);
  }

  /**
   * Parse skills from Voyager data
   */
  private parseSkillsFromVoyager(skillEntries: any[]): LinkedInProfileData['skills'] {
    return skillEntries.map(entry => {
      try {
        return {
          name: entry.name,
          endorsements: entry.numEndorsements
        };
      } catch (error) {
        console.warn("Failed to parse skill entry:", error);
        return { name: '' };
      }
    }).filter(skill => skill.name);
  }

  /**
   * Parse experience from DOM elements
   */
  private parseExperienceFromDOM(section: Element): LinkedInProfileData['experience'] {
    const experiences: LinkedInProfileData['experience'] = [];

    const experienceItems = section.querySelectorAll('.pv-profile-section__list-item, .pv-entity__position-group-pager li');

    experienceItems.forEach(item => {
      try {
        const titleEl = item.querySelector('.pv-entity__summary-info h3');
        const companyEl = item.querySelector('.pv-entity__secondary-title');
        const datesEl = item.querySelector('.pv-entity__date-range span:last-child');
        const descEl = item.querySelector('.pv-entity__description');

        if (titleEl || companyEl) {
          experiences.push({
            title: titleEl?.textContent?.trim(),
            company: companyEl?.textContent?.trim(),
            startDate: '', // Would need more complex parsing for dates
            endDate: '',
            description: descEl?.textContent?.trim()
          });
        }
      } catch (error) {
        console.warn("Failed to parse experience item from DOM:", error);
      }
    });

    return experiences;
  }

  /**
   * Parse education from DOM elements
   */
  private parseEducationFromDOM(section: Element): LinkedInProfileData['education'] {
    const education: LinkedInProfileData['education'] = [];

    const educationItems = section.querySelectorAll('.pv-profile-section__list-item, .pv-education-entity');

    educationItems.forEach(item => {
      try {
        const schoolEl = item.querySelector('.pv-entity__school-name');
        const degreeEl = item.querySelector('.pv-entity__degree-name span:last-child');
        const fieldEl = item.querySelector('.pv-entity__fos span:last-child');

        if (schoolEl || degreeEl) {
          education.push({
            institution: schoolEl?.textContent?.trim(),
            degree: degreeEl?.textContent?.trim(),
            fieldOfStudy: fieldEl?.textContent?.trim()
          });
        }
      } catch (error) {
        console.warn("Failed to parse education item from DOM:", error);
      }
    });

    return education;
  }

  /**
   * Format Voyager date object to string
   */
  private formatVoyagerDate(dateObj: any): string {
    if (!dateObj) return '';

    try {
      const { year, month } = dateObj;
      if (year) {
        return month ? `${year}-${month.toString().padStart(2, '0')}` : year.toString();
      }
    } catch (error) {
      console.warn("Failed to format Voyager date:", error);
    }

    return '';
  }

  /**
   * Convert LinkedIn profile data to JobSnap profile format
   */
  convertToJobSnapProfile(linkedinData: LinkedInProfileData): JsonResume {
    const profile: JsonResume = {
      basics: {
        name: linkedinData.basics?.name || '',
        label: linkedinData.basics?.headline || '',
        email: linkedinData.basics?.email,
        phone: linkedinData.basics?.phone,
        url: linkedinData.basics?.website,
        summary: linkedinData.basics?.summary,
        location: linkedinData.basics?.location ? {
          city: linkedinData.basics.location
        } : undefined,
        profiles: []
      },
      work: linkedinData.experience?.map(exp => ({
        name: exp.company || '',
        position: exp.title || '',
        startDate: exp.startDate,
        endDate: exp.endDate,
        summary: exp.description,
        location: exp.location
      })) || [],
      education: linkedinData.education?.map(edu => ({
        institution: edu.institution || '',
        studyType: edu.degree || '',
        area: edu.fieldOfStudy,
        startDate: edu.startDate,
        endDate: edu.endDate,
        courses: edu.description ? [edu.description] : undefined
      })) || [],
      skills: linkedinData.skills?.map(skill => ({
        name: skill.name,
        level: skill.endorsements ? `${skill.endorsements} endorsements` : undefined
      })) || [],
      certificates: linkedinData.certifications?.map(cert => ({
        name: cert.name || '',
        issuer: cert.authority,
        date: cert.startDate,
        url: cert.url
      })) || [],
      languages: linkedinData.languages?.map(lang => ({
        language: lang.name,
        fluency: lang.proficiency
      })) || [],
      projects: [],
      awards: [],
      publications: [],
      volunteer: [],
      interests: [],
      references: []
    };

    return profile;
  }
}

/**
 * Main function to extract LinkedIn profile and convert to JobSnap format
 */
export async function extractLinkedInProfile(): Promise<JsonResume | null> {
  // Verify we're on a LinkedIn profile page
  if (!window.location.hostname.includes('linkedin.com') ||
      !window.location.pathname.includes('/in/')) {
    console.warn('Not on a LinkedIn profile page');
    return null;
  }

  const parser = new LinkedInProfileParser();
  const linkedinData = await parser.parseProfile();

  if (!linkedinData) {
    console.error('Failed to extract LinkedIn profile data');
    return null;
  }

  return parser.convertToJobSnapProfile(linkedinData);
}