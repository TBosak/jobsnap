export interface JsonResumeBasicsProfile {
  network: string;
  username?: string;
  url?: string;
}

export interface JsonResumeBasics {
  name?: string;
  label?: string;
  image?: string;
  email?: string;
  phone?: string;
  url?: string;
  summary?: string;
  location?: {
    address?: string;
    postalCode?: string;
    city?: string;
    countryCode?: string;
    region?: string;
  };
  profiles?: JsonResumeBasicsProfile[];
}

export interface JsonResumeWork {
  name?: string;
  location?: string;
  position?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  highlights?: string[];
}

export interface JsonResumeEducation {
  institution?: string;
  area?: string;
  studyType?: string;
  startDate?: string;
  endDate?: string;
  score?: string;
  courses?: string[];
  url?: string;
}

export interface JsonResumeSkill {
  name: string;
  level?: string;
  keywords?: string[];
}

export interface JsonResumeProject {
  name: string;
  description?: string;
  url?: string;
   startDate?: string;
   endDate?: string;
  highlights?: string[];
}

export interface JsonResumeCertificate {
  name: string;
  date?: string;
  issuer?: string;
  url?: string;
}

export interface JsonResumeVolunteer {
  organization: string;
  position?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  highlights?: string[];
}

export interface JsonResumeAward {
  title: string;
  date?: string;
  awarder?: string;
  summary?: string;
}

export interface JsonResumePublication {
  name: string;
  publisher?: string;
  releaseDate?: string;
  url?: string;
  summary?: string;
}

export interface JsonResumeInterest {
  name: string;
  keywords?: string[];
}

export interface JsonResumeReference {
  name: string;
  reference?: string;
}

export interface JsonResumeLanguage {
  language: string;
  fluency?: string;
}

export interface JsonResume {
  basics?: JsonResumeBasics;
  work?: JsonResumeWork[];
  education?: JsonResumeEducation[];
  skills?: JsonResumeSkill[];
  projects?: JsonResumeProject[];
  certificates?: JsonResumeCertificate[];
  languages?: JsonResumeLanguage[];
  awards?: JsonResumeAward[];
  volunteer?: JsonResumeVolunteer[];
  publications?: JsonResumePublication[];
  interests?: JsonResumeInterest[];
  references?: JsonResumeReference[];
}

export interface ProfileRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  resume: JsonResume;
  tags?: string[];
  notes?: string;
  computedSkills?: string[];
  computedAt?: string;
}

export interface AlertSettings {
  noResponseReminder: {
    enabled: boolean;
    daysThreshold: number;
  };
  ghostingDetection: {
    enabled: boolean;
    daysThreshold: number;
  };
  dailyApplicationGoal: {
    enabled: boolean;
    dailyGoal: number;
    weeklyGoal: number;
    reminderTime: string; // "HH:MM" format
  };
  thankYouNoteReminder: {
    enabled: boolean;
    hoursAfter: number;
  };
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  noResponseReminder: {
    enabled: true,
    daysThreshold: 7,
  },
  ghostingDetection: {
    enabled: true,
    daysThreshold: 30,
  },
  dailyApplicationGoal: {
    enabled: false,
    dailyGoal: 1,
    weeklyGoal: 5,
    reminderTime: "18:00",
  },
  thankYouNoteReminder: {
    enabled: true,
    hoursAfter: 24,
  },
};
