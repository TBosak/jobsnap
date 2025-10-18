import type { JDKeyword } from "../ui-shared/types.jd";
import { embedTexts } from "./embeddings";

const DEFAULT_STOPWORDS = new Set(
  "a,an,the,and,or,but,if,then,else,when,where,how,what,why,to,of,in,on,for,with,by,from,at,as,is,are,was,were,be,been,being,into,via,across,over,under,per,using,use,used,will,should,would,could,may,can,your,you,we,our,they,their,them,this,that,these,those,job,role,team,position,company,responsibilities,responsibility,requirements,requirement,about,summary,description,looking,work,working,looking,help,make,including,such,also,well,must,need,able,within,based,ideal,candidate,candidates,strong,good,excellent,ability,skills,skill,knowledge,understanding,background,field,area,level,degree,minimum,preferred,plus,bonus,nice,have,years,year,experience,experienced".split(",")
);

// Benefits and compensation-related terms to filter out
const BENEFITS_STOPWORDS = new Set(
  "salary,compensation,pay,wage,hourly,annual,competitive,bonus,commission,equity,stock,options,rsu,vesting,401k,retirement,pension,healthcare,health,medical,dental,vision,insurance,life,disability,pto,vacation,holiday,sick,leave,maternity,paternity,parental,benefits,perks,flexible,remote,hybrid,work-life,balance,culture,environment,office,workspace,gym,fitness,wellness,food,snacks,lunch,dinner,catering,beverages,coffee,drinks,commuter,transportation,parking,relocation,tuition,reimbursement,professional,development,training,conference,learning,growth,opportunity,opportunities,career,advancement,promotion,mentorship,coaching,diverse,inclusive,inclusion,diversity,equity,equal,eoe,employer,affirmative,action,disability,veteran,protected,status,discrimination,race,color,religion,sex,gender,orientation,national,origin,age,genetic,pregnancy".split(",")
);

// Comprehensive patterns for all industries and skill types
const JOB_PATTERNS = {
  // Technical & Software Skills
  TECH_STACK: /\b(?:React|Node\.js|Python|Java|SQL|AWS|Docker|Kubernetes|Git|API|REST|GraphQL|TypeScript|JavaScript|HTML|CSS|Salesforce|SAP|Oracle|Tableau|Power BI|Excel|AutoCAD|Photoshop|InDesign|Figma|Sketch)\b/gi,

  // Healthcare & Medical Skills
  HEALTHCARE: /\b(?:CPR|BLS|ACLS|PALS|EMR|Electronic Health Records|HIPAA|ICD-10|CPT|Medical Coding|Nursing|Pharmacy|Radiology|Laboratory|Clinical Research|Patient Care|Healthcare Administration)\b/gi,

  // Finance & Accounting Skills
  FINANCE: /\b(?:CPA|CFA|FRM|QuickBooks|SAP|Oracle Financials|GAAP|IFRS|Financial Analysis|Budgeting|Forecasting|Tax Preparation|Audit|Risk Management|Investment Analysis|Portfolio Management)\b/gi,

  // Marketing & Sales Skills
  MARKETING: /\b(?:SEO|SEM|Google Analytics|Facebook Ads|LinkedIn Marketing|Content Marketing|Email Marketing|CRM|Salesforce|HubSpot|Social Media|Brand Management|Market Research|Lead Generation)\b/gi,

  // Manufacturing & Engineering Skills
  MANUFACTURING: /\b(?:Lean Manufacturing|Six Sigma|Quality Control|ISO|GMP|CAD|SolidWorks|Mechanical Engineering|Electrical Engineering|Project Management|PMP|Supply Chain|Logistics)\b/gi,

  // Education & Training Skills
  EDUCATION: /\b(?:Curriculum Development|Instructional Design|Classroom Management|Student Assessment|Educational Technology|Learning Management Systems|Special Education|ESL|TESOL|Tutoring)\b/gi,

  // Legal & Compliance Skills
  LEGAL: /\b(?:Legal Research|Contract Law|Litigation|Compliance|Regulatory|Paralegal|Legal Writing|Discovery|Depositions|Trial Preparation|Intellectual Property|Employment Law)\b/gi,

  // Soft Skills & Interpersonal
  SOFT_SKILLS: /\b(?:Leadership|Communication|Teamwork|Problem Solving|Critical Thinking|Time Management|Project Management|Customer Service|Public Speaking|Presentation|Negotiation|Conflict Resolution|Mentoring|Training|Coaching|Analytical|Creative|Detail[- ]?Oriented|Multi[- ]?tasking|Adaptability|Flexibility|Initiative|Self[- ]?Motivated|Organizational|Interpersonal|Collaboration|Strategic Thinking|Decision Making)\b/gi,

  // Languages & Communication
  LANGUAGES: /\b(?:English|Spanish|French|German|Mandarin|Cantonese|Japanese|Korean|Arabic|Portuguese|Italian|Russian|Hindi|Bengali|Bilingual|Multilingual|Native Speaker|Fluent|Conversational)\b/gi,

  // Certifications & Credentials
  CERTIFICATIONS: /\b(?:PhD|MBA|Master's|Bachelor's|Associate|Certificate|Licensed|Certified|Board Certified|Professional|Accredited|Chartered|Fellowship)\b/gi,

  // Job levels and roles (expanded)
  SENIORITY: /\b(?:Senior|Junior|Lead|Principal|Staff|Manager|Director|VP|Vice President|Chief|Head of|Associate|Intern|Entry[- ]?Level|Mid[- ]?Level|Executive|Supervisor|Coordinator|Specialist|Analyst|Consultant|Administrator)\b/gi,

  // Experience patterns
  EXPERIENCE: /\b\d+\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)\b/gi,

  // Location patterns
  LOCATION: /\b(?:remote|hybrid|on-site|office|based|located|travel|relocation|commute)\b/gi,

  // Benefits and compensation
  BENEFITS: /\b(?:salary|equity|stock|options|healthcare|dental|vision|401k|retirement|vacation|pto|benefits|bonus|commission|flexible|work[- ]?life[- ]?balance|professional development|tuition|training)\b/gi,

  // Industry-specific terms
  INDUSTRIES: /\b(?:Healthcare|Finance|Technology|Manufacturing|Education|Retail|Hospitality|Non[- ]?Profit|Government|Consulting|Real Estate|Construction|Energy|Telecommunications|Media|Entertainment|Fashion|Food Service|Transportation|Logistics)\b/gi
};

export async function extractKeywords(texts: string[], topK = 25): Promise<JDKeyword[]> {
  // First, aggressively filter to extract only skill-relevant content
  const skillContent = texts.map(text => extractSkillsOnlyContent(text));
  const candidates = buildCandidates(skillContent);

  if (!candidates.length) {
    return [];
  }

  const documentEmbedding = await embedTexts([skillContent.join("\n")]);
  const candidateEmbeddings = await embedTexts(candidates);

  const scored = candidates.map((term, index) => ({
    term,
    emb: candidateEmbeddings[index],
    score: cosine(documentEmbedding[0], candidateEmbeddings[index])
  }));

  // Step 1: Remove case-insensitive duplicates first
  const caseDeduped = deduplicateByCaseWithEmbeddings(scored);

  // Step 2: Remove string containment duplicates (keep shorter term)
  const containmentDeduped = deduplicateByContainment(caseDeduped);

  // Step 3: Apply MMR for semantic diversity
  const selected = mmr(containmentDeduped, documentEmbedding[0], topK, 0.8);

  // Step 4: Final semantic similarity deduplication (stricter threshold)
  const finalDeduped = deduplicateBySimilarity(selected, 0.80);

  // Step 5: De-prioritize vague single words (but don't eliminate them)
  const filtered = filterLowQualitySingleWords(finalDeduped);

  return filtered.map(({ term, score }) => ({ term, score }));
}

function deduplicateByCase(keywords: JDKeyword[]): JDKeyword[] {
  const caseMap = new Map<string, JDKeyword>();

  keywords.forEach(keyword => {
    const lowerKey = keyword.term.toLowerCase();
    const existing = caseMap.get(lowerKey);

    if (!existing || keyword.score > existing.score) {
      // Keep the version with the higher score
      caseMap.set(lowerKey, keyword);
    }
  });

  return Array.from(caseMap.values());
}

function deduplicateByCaseWithEmbeddings(candidates: CandidateScore[]): CandidateScore[] {
  const caseMap = new Map<string, CandidateScore>();

  candidates.forEach(candidate => {
    const lowerKey = candidate.term.toLowerCase();
    const existing = caseMap.get(lowerKey);

    if (!existing || candidate.score > existing.score) {
      // Keep the version with the higher score
      caseMap.set(lowerKey, candidate);
    }
  });

  return Array.from(caseMap.values());
}

function deduplicateByContainment(candidates: CandidateScore[]): CandidateScore[] {
  // First, normalize common degree variations
  const normalized = candidates.map(candidate => {
    const term = candidate.term;
    const lower = term.toLowerCase();

    // Normalize degree terms to their simplest form
    if (lower.match(/\bbachelor'?s?\s*(degree)?/i)) {
      return { ...candidate, term: "Bachelor's Degree" };
    }
    if (lower.match(/\bmaster'?s?\s*(degree)?/i)) {
      return { ...candidate, term: "Master's Degree" };
    }
    if (lower.match(/\bphd\b|doctorate/i)) {
      return { ...candidate, term: "PhD" };
    }
    if (lower.match(/\bmba\b/i)) {
      return { ...candidate, term: "MBA" };
    }

    return candidate;
  });

  // Sort by length (shortest first) and then by score (highest first)
  const sorted = [...normalized].sort((a, b) => {
    const lenDiff = a.term.length - b.term.length;
    if (lenDiff !== 0) return lenDiff;
    return b.score - a.score;
  });

  const keep: CandidateScore[] = [];
  const skip = new Set<string>();

  for (const candidate of sorted) {
    if (skip.has(candidate.term)) continue;

    // Check if this term is contained in or contains any other term
    let shouldKeep = true;

    for (const other of sorted) {
      if (other.term === candidate.term) continue;
      if (skip.has(other.term)) continue;

      const candidateLower = candidate.term.toLowerCase();
      const otherLower = other.term.toLowerCase();

      // If candidate is contained in other (and other is longer), mark other for skipping
      if (otherLower.includes(candidateLower) && other.term.length > candidate.term.length) {
        skip.add(other.term);
      }
      // If other (shorter) is contained in candidate, skip candidate
      else if (candidateLower.includes(otherLower) && other.term.length < candidate.term.length) {
        shouldKeep = false;
        break;
      }
    }

    if (shouldKeep) {
      keep.push(candidate);
    }
  }

  return keep;
}

function deduplicateBySimilarity(candidates: CandidateScore[], threshold: number): CandidateScore[] {
  // Sort by score (highest first) so we keep the most relevant terms
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const keep: CandidateScore[] = [];

  for (const candidate of sorted) {
    // Check if this candidate is too similar to any already kept term
    let isTooSimilar = false;

    for (const kept of keep) {
      const similarity = cosine(candidate.emb, kept.emb);

      if (similarity >= threshold) {
        // Keep the shorter term (more concise)
        if (candidate.term.length < kept.term.length) {
          // Remove the longer term and add the shorter one
          const keptIndex = keep.indexOf(kept);
          keep.splice(keptIndex, 1);
          keep.push(candidate);
        }
        isTooSimilar = true;
        break;
      }
    }

    if (!isTooSimilar) {
      keep.push(candidate);
    }
  }

  return keep;
}

function filterLowQualitySingleWords(candidates: CandidateScore[]): CandidateScore[] {
  // Calculate median score for reference
  const scores = candidates.map(c => c.score).sort((a, b) => b - a);
  const medianScore = scores[Math.floor(scores.length / 2)] || 0;

  return candidates.filter(candidate => {
    const words = candidate.term.split(/\s+/);

    // Multi-word phrases pass through
    if (words.length > 1) {
      return true;
    }

    // Single words need to meet higher quality bar
    const singleWord = candidate.term;

    // Always keep all-caps acronyms (MBA, CPA, AWS, HIPAA, etc.)
    if (/^[A-Z]{2,}$/.test(singleWord)) {
      return true;
    }

    // Keep if it matches domain patterns (tools, technologies, certifications)
    const matchesDomainPattern = Object.values(JOB_PATTERNS).some(pattern =>
      pattern.test(singleWord)
    );
    if (matchesDomainPattern) {
      return true;
    }

    // For other single words, only keep if score is above median
    // This filters out vague single words like "travel", "executive" that have low relevance
    return candidate.score >= medianScore;
  });
}

function extractSkillsOnlyContent(text: string): string {
  const cleaned = preprocessText(text);

  // First try to find explicit skills/requirements sections
  const skillSections = [
    /(requirements?|qualifications?|skills?|experience|education|must have|preferred|what you need|what we're looking for|skill set)[:]\s*([^]*?)(?=\n\s*[A-Z][^:]*:|$)/gi,
    /(requirements?|qualifications?|skills?|experience|education|must have|preferred|what you need|what we're looking for|skill set)\s*\n([^]*?)(?=\n\s*[A-Z][^:]*:|$)/gi
  ];

  let skillContent = '';
  for (const pattern of skillSections) {
    const matches = cleaned.match(pattern);
    if (matches) {
      skillContent += matches.join(' ');
    }
  }

  // If no clear sections, extract only lines that look like requirements
  if (skillContent.length < 50) {
    const lines = cleaned.split(/[.\n!]/)
      .filter(line => {
        const l = line.trim();
        return l.length > 15 && l.length < 120 &&
               // Must contain skill indicators
               /\b(experience|skill|knowledge|proficiency|degree|certification|years|bachelor|master|phd|required|preferred|must|should|ability|familiar|understanding)\b/i.test(l) &&
               // Should not contain job description indicators
               !/\b(we|our|company|team|opportunity|challenge|will|you'll|within|months|join|culture|proud|build|grow|help|solve)\b/i.test(l);
      })
      .slice(0, 10); // Limit to prevent over-extraction

    skillContent = lines.join('. ');
  }

  // Fallback: extract known skill terms directly
  if (skillContent.length < 30) {
    const directSkills = [];
    Object.values(JOB_PATTERNS).forEach(pattern => {
      const matches = cleaned.match(pattern) || [];
      directSkills.push(...matches);
    });
    skillContent = directSkills.join(' ');
  }

  return skillContent || cleaned.substring(0, 200);
}

function preprocessText(text: string): string {
  return text
    // Remove HTML/XML tags and artifacts
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-zA-Z0-9#]+;/g, ' ')
    .replace(/\\n/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, ' ')

    // Remove excessive punctuation and special chars
    .replace(/[.]{2,}/g, '.')
    .replace(/[-]{2,}/g, '-')
    .replace(/[^\w\s.,;:()\-'"]/g, ' ')

    // Fix common encoding issues
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/&nbsp;/g, ' ')

    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

function buildCandidates(texts: string[]): string[] {
  const candidates = new Set<string>();
  const fullText = texts.join(' ');

  // 1. Extract high-value domain-specific patterns first (most reliable)
  extractDomainSpecificTerms(fullText, candidates);

  // 2. Extract whitelisted skill terms
  extractWhitelistedSkills(fullText, candidates);

  // 3. Extract meaningful skill phrases only (very selective)
  extractMeaningfulPhrases(fullText, candidates);

  // 4. Clean, filter, and deduplicate candidates
  return Array.from(candidates)
    .filter(term => isValidCandidate(term))
    .filter(term => !isRedundant(term, candidates))
    .slice(0, 50); // Further reduce for better quality
}

function extractWhitelistedSkills(text: string, candidates: Set<string>) {
  // High-value skills that should always be extracted if found
  const skillWhitelist = [
    // Technical Skills
    /\b(JavaScript|Python|Java|React|Node\.js|SQL|AWS|Azure|Docker|Kubernetes|Git|API|REST|GraphQL)\b/gi,
    /\b(Excel|Salesforce|SAP|Oracle|Tableau|Power BI|AutoCAD|Photoshop|Figma|Sketch)\b/gi,

    // Professional Skills
    /\b(Project Management|Product Management|Data Analysis|Financial Analysis|Market Research)\b/gi,
    /\b(Customer Service|Account Management|Business Development|Lead Generation)\b/gi,

    // Healthcare & Specialized
    /\b(HRIS|ADP|Workday|QuickBooks|HIPAA|CPR|BLS|EMR|ICD-10|CPT)\b/gi,
    /\b(Six Sigma|Lean Manufacturing|Quality Control|ISO|GMP|CAD|SolidWorks)\b/gi,

    // Certifications & Education
    /\b(CPA|CFA|PMP|MBA|PhD|Bachelor|Master|Certified|Licensed)\b/gi,
    /\b(\d+\+?\s*years?\s+experience|\d+\+?\s*years?\s+of\s+experience)\b/gi,

    // Soft Skills (concise versions)
    /\b(Leadership|Communication|Teamwork|Problem Solving|Time Management)\b/gi,
    /\b(Detail[- ]?Oriented|Results[- ]?Oriented|Customer[- ]?Focused)\b/gi,

    // Job Types & Arrangements
    /\b(Full[- ]?Time|Part[- ]?Time|Remote|Hybrid|Contract|Freelance)\b/gi,
    /\b(Senior|Junior|Entry[- ]?Level|Mid[- ]?Level|Manager|Director|Analyst|Specialist)\b/gi
  ];

  skillWhitelist.forEach(pattern => {
    const matches = text.match(pattern) || [];
    matches.forEach(match => candidates.add(match.trim()));
  });
}

function extractDomainSpecificTerms(text: string, candidates: Set<string>) {
  // Extract technical terms and tools
  Object.values(JOB_PATTERNS).forEach(pattern => {
    const matches = text.match(pattern) || [];
    matches.forEach(match => candidates.add(match.trim()));
  });

  // Extract hyphenated terms (like "India-based", "full-stack", "end-to-end")
  const hyphenatedTerms = text.match(/\b[A-Za-z]+-[A-Za-z]+(?:-[A-Za-z]+)*\b/g) || [];
  hyphenatedTerms.forEach(term => candidates.add(term));

  // Extract quoted terms and proper nouns
  const quotedTerms = text.match(/"([^"]+)"/g) || [];
  quotedTerms.forEach(term => candidates.add(term.replace(/"/g, '')));
}

function extractMeaningfulPhrases(text: string, candidates: Set<string>) {
  // Only extract very specific skill patterns - no general phrase extraction
  extractSkillPhrases(text, candidates);

  // Extract only very specific 2-word skill combinations
  const words = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);

  for (let i = 0; i < words.length - 1; i++) {
    const twoWordPhrase = words.slice(i, i + 2).join(' ');

    // Only accept if both words are skill-relevant
    if (isHighValueSkillPhrase(twoWordPhrase)) {
      candidates.add(capitalizePhrase(twoWordPhrase));
    }
  }
}

function isHighValueSkillPhrase(phrase: string): boolean {
  const skillCombinations = [
    // Technology combinations
    /\b(data|business|market|financial|risk|project|product|customer|account|talent|hr|human|supply|quality|process)\s+(analysis|management|development|research|service|relations|administration|control|improvement)\b/i,

    // Experience combinations
    /\b(years|bachelor|master|phd|professional)\s+(experience|degree|background|certification)\b/i,

    // Skill modifiers
    /\b(excellent|strong|proven|advanced|expert|senior|junior)\s+(communication|leadership|analytical|technical|management)\b/i,

    // Tools and systems
    /\b(microsoft|google|adobe|salesforce|oracle|sap)\s+(excel|analytics|suite|cloud|office|systems)\b/i
  ];

  return skillCombinations.some(pattern => pattern.test(phrase));
}


function isRelevantPhrase(phrase: string, words: string[]): boolean {
  // Skip if too many stopwords
  const stopwordCount = words.filter(word => DEFAULT_STOPWORDS.has(word)).length;
  if (stopwordCount > words.length / 2) return false;

  // Skip if contains benefits-related terms
  const hasBenefitsTerm = words.some(word => BENEFITS_STOPWORDS.has(word));
  if (hasBenefitsTerm) return false;

  // Avoid action-heavy phrases - focus on skills/qualifications
  const actionWords = ['doing', 'managing', 'leading', 'developing', 'implementing', 'creating', 'building', 'working', 'handling', 'supporting'];
  const startsWithAction = actionWords.some(action => phrase.toLowerCase().startsWith(action));
  if (startsWithAction) return false;

  // Must contain skill/qualification keywords
  const skillWords = ['experience', 'skill', 'management', 'analysis', 'knowledge', 'proficiency', 'certification', 'degree', 'years', 'bachelor', 'master', 'phd', 'technology', 'software', 'system'];
  const hasSkillWord = words.some(word => skillWords.includes(word));

  // Or match our domain patterns (specific tools/technologies)
  const matchesDomainPattern = Object.values(JOB_PATTERNS).some(pattern =>
    pattern.test(phrase)
  );

  // Or is a recognized professional term
  const professionalTerms = /\b(hris|hr|adp|workday|salesforce|excel|sql|crm|erp|api|java|python|aws|marketing|finance|healthcare|compliance|payroll|benefits)\b/i;
  const isProfessionalTerm = professionalTerms.test(phrase);

  return hasSkillWord || matchesDomainPattern || isProfessionalTerm;
}

function extractSkillPhrases(text: string, candidates: Set<string>) {
  // Focus only on the most common and valuable skill patterns
  const skillPatterns = [
    // Core soft skills (concise versions)
    /\b(?:communication|leadership|teamwork|problem solving|time management|project management)\s+skills?\b/gi,
    /\b(?:customer service|client relations)\b/gi,
    /\b(?:detail[- ]?oriented|results[- ]?oriented)\b/gi,

    // Experience patterns
    /\b\d+\+?\s*years?\s+(?:of\s+)?experience\b/gi,
    /\b(?:bachelor|master|phd|mba)\s*(?:degree|'s)?\b/gi,

    // Essential job terms
    /\b(?:full[- ]?time|part[- ]?time|remote|hybrid)\b/gi,
    /\b(?:entry[- ]?level|senior|junior|mid[- ]?level)\b/gi
  ];

  skillPatterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    matches.forEach(match => {
      const cleaned = match.trim().replace(/\s+/g, ' ');
      if (cleaned.length <= 25) { // Avoid overly long phrases
        candidates.add(capitalizePhrase(cleaned));
      }
    });
  });
}

function extractSingleTerms(text: string, candidates: Set<string>) {
  // Extract capitalized terms and acronyms
  const capitalizedTerms = text.match(/\b[A-Z][a-z]{2,}\b/g) || [];
  capitalizedTerms.forEach(term => {
    if (!DEFAULT_STOPWORDS.has(term.toLowerCase())) {
      candidates.add(term);
    }
  });

  // Extract acronyms and technical terms
  const acronyms = text.match(/\b[A-Z]{2,}\b/g) || [];
  acronyms.forEach(term => candidates.add(term));

  // Extract terms with numbers (like "5+ years", "401k")
  const numberTerms = text.match(/\b\w*\d+\w*\+?\b/g) || [];
  numberTerms.forEach(term => candidates.add(term));
}

function capitalizePhrase(phrase: string): string {
  return phrase
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function isRedundant(term: string, allCandidates: Set<string>): boolean {
  const termLower = term.toLowerCase();
  const termWords = termLower.split(/\s+/);

  // Check if this term is a subset of a longer, more specific term
  for (const other of allCandidates) {
    if (other === term) continue;

    const otherLower = other.toLowerCase();
    const otherWords = otherLower.split(/\s+/);

    // Skip if other term is shorter
    if (otherWords.length <= termWords.length) continue;

    // Check if current term is contained in the other term
    const termSet = new Set(termWords);
    const otherSet = new Set(otherWords);
    const isSubset = [...termSet].every(word => otherSet.has(word));

    if (isSubset) {
      return true; // This term is redundant
    }
  }

  // Check for company-specific terms that aren't job requirements
  const companyTerms = /\b(?:office hours|marketplace|platform|company|organization|team|we|our|us)\b/i;
  if (companyTerms.test(term) && !/(experience|management|skills?|knowledge)\b/i.test(term)) {
    return true;
  }

  return false;
}

function isValidCandidate(term: string): boolean {
  // Filter out very short terms
  if (term.length < 3) return false;

  // Filter out terms that are mostly stopwords
  const words = term.toLowerCase().split(/\s+/);
  const stopwordRatio = words.filter(word => DEFAULT_STOPWORDS.has(word)).length / words.length;
  if (stopwordRatio > 0.5) return false;

  // Filter out benefits-related terms
  const hasBenefitsTerm = words.some(word => BENEFITS_STOPWORDS.has(word));
  if (hasBenefitsTerm) {
    // Allow if it's a technical term that happens to include a benefits word (like "health informatics")
    const isTechnicalException = /\b(health informatics|healthcare it|medical technology|insurance technology|financial planning|compensation analysis|benefits administration)\b/i.test(term);
    if (!isTechnicalException) return false;
  }

  // Filter out terms with too many special characters
  const specialCharRatio = (term.match(/[^A-Za-z0-9\s-]/g) || []).length / term.length;
  if (specialCharRatio > 0.2) return false;

  // Must contain job-relevant keywords
  const jobRelevantTerms = [
    // Core job terms
    /\b(?:experience|skill|management|development|knowledge|ability|proficiency|certification|degree|training|leadership|communication)\b/i,
    // Qualifications
    /\b(?:bachelor|master|phd|mba|certified|licensed|years)\b/i,
    // Job requirements
    /\b(?:required|preferred|must|should|able|capable)\b/i,
    // Work arrangements
    /\b(?:remote|hybrid|full[- ]?time|part[- ]?time|contract)\b/i,
    // Technical terms from our patterns
    /\b(?:sql|excel|crm|erp|api|software|systems|database)\b/i
  ];

  const isJobRelevant = jobRelevantTerms.some(pattern => pattern.test(term));

  // Or is a recognized skill from our domain patterns
  const matchesDomainPattern = Object.values(JOB_PATTERNS).some(pattern =>
    pattern.test(term)
  );

  // Or is a proper noun/acronym that might be a tool/technology
  const isProperNoun = /^[A-Z][a-z]*$/.test(term) || /^[A-Z]{2,}$/.test(term);

  return isJobRelevant || matchesDomainPattern || (isProperNoun && term.length >= 3);
}

function cosine(a: number[], b: number[]): number {
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

interface CandidateScore {
  term: string;
  emb: number[];
  score: number;
}

function mmr(candidates: CandidateScore[], centroid: number[], topK: number, lambda: number): CandidateScore[] {
  const selected: CandidateScore[] = [];
  const remaining = [...candidates].sort((a, b) => b.score - a.score);

  while (remaining.length && selected.length < topK) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    remaining.forEach((candidate, index) => {
      const diversityPenalty = selected.reduce((max, chosen) => Math.max(max, cosine(candidate.emb, chosen.emb)), 0);
      const mmrScore = lambda * candidate.score - (1 - lambda) * diversityPenalty;
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIndex = index;
      }
    });

    const [chosen] = remaining.splice(bestIndex, 1);
    selected.push(chosen);
  }

  return selected;
}
