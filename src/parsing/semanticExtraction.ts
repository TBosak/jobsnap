import { embedTexts } from "../analysis/embeddings";

// Use embeddings to extract specific entities by semantic similarity
export class SemanticEntityExtractor {
  private static companyIndicators = [
    "Google Inc", "Microsoft Corporation", "Apple Inc", "Amazon.com",
    "Software company", "Technology firm", "Startup company",
    "Fortune 500 company", "Consulting firm", "Financial services"
  ];

  private static locationIndicators = [
    "San Francisco, CA", "New York, NY", "Seattle, WA", "Austin, TX",
    "Remote work", "United States", "California", "Massachusetts"
  ];

  private static skillIndicators = [
    "Programming in Python", "JavaScript development", "React framework",
    "Machine learning expertise", "Data analysis skills", "Cloud computing",
    "Project management", "Leadership abilities", "Communication skills"
  ];

  private static jobTitleIndicators = [
    "Software Engineer", "Senior Developer", "Product Manager", "Data Scientist",
    "Frontend Developer", "Backend Engineer", "Full Stack Developer",
    "Engineering Manager", "Technical Lead", "Principal Engineer"
  ];

  private static nameIndicators = [
    "John Smith", "Mary Johnson", "Michael Brown", "Sarah Davis",
    "David Wilson", "Jennifer Garcia", "Christopher Miller", "Lisa Anderson",
    "Matthew Taylor", "Emily Martinez", "Daniel Thomas", "Jessica Jackson",
    "Anthony White", "Ashley Harris", "Mark Thompson", "Amanda Clark"
  ];

  static async extractCompanies(text: string): Promise<string[]> {
    return this.extractEntitiesBySemanticSimilarity(
      text,
      this.companyIndicators,
      /\b[A-Z][a-zA-Z\s&.,]{2,30}(?:\s(?:Inc|Corp|Corporation|LLC|Ltd|Company|Group|Technologies|Solutions)\.?)?/g,
      0.6
    );
  }

  static async extractSkills(text: string): Promise<string[]> {
    return this.extractEntitiesBySemanticSimilarity(
      text,
      this.skillIndicators,
      /\b[A-Z][a-zA-Z\s+#.]{2,25}/g,
      0.5
    );
  }

  static async extractJobTitles(text: string): Promise<string[]> {
    return this.extractEntitiesBySemanticSimilarity(
      text,
      this.jobTitleIndicators,
      /\b[A-Z][a-zA-Z\s]{5,40}/g,
      0.65
    );
  }

  static async extractLocations(text: string): Promise<string[]> {
    return this.extractEntitiesBySemanticSimilarity(
      text,
      this.locationIndicators,
      /\b[A-Z][a-zA-Z\s,]{3,50}/g,
      0.6
    );
  }

  static async extractNames(text: string): Promise<string[]> {
    // Use semantic similarity to find person names
    const semanticNames = await this.extractEntitiesBySemanticSimilarity(
      text,
      this.nameIndicators,
      /\b[A-Z][a-zA-Z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-zA-Z]+\b/g, // "First Last" or "First M. Last" patterns
      0.7
    );

    // Also look for strong name patterns with higher confidence
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const strongNamePatterns = [
      /^[A-Z][a-z]+ [A-Z]\. [A-Z][a-z]+$/, // "Timothy M. Barani"
      /^[A-Z][a-z]+ [A-Z][a-z]+$/, // "John Smith"
      /^[A-Z][A-Z]+ [A-Z]\. [A-Z][A-Z]+$/, // "TIMOTHY M. BARANI"
    ];

    const patternNames: string[] = [];
    for (const line of lines) {
      // Skip obvious non-names
      if (/^(SKILLS|EDUCATION|EXPERIENCE|WORK|CONTACT|PROFILE|SUMMARY|OBJECTIVE|EMAIL|PHONE|LINKEDIN|WEBSITE)$/i.test(line.trim())) {
        continue;
      }
      if (line.includes("@") || /\d{3}/.test(line)) continue;

      for (const pattern of strongNamePatterns) {
        if (pattern.test(line)) {
          patternNames.push(line);
        }
      }
    }

    // Combine and deduplicate results, prioritizing pattern matches
    const allNames = [...patternNames, ...semanticNames];
    return Array.from(new Set(allNames));
  }

  private static async extractEntitiesBySemanticSimilarity(
    text: string,
    indicators: string[],
    candidatePattern: RegExp,
    threshold: number
  ): Promise<string[]> {
    // Extract potential candidates using regex
    const candidates = Array.from(text.match(candidatePattern) || [])
      .map(match => match.trim())
      .filter(candidate => candidate.length > 2)
      .slice(0, 50); // Limit candidates for performance

    if (candidates.length === 0) {
      return [];
    }

    // Get embeddings for indicators and candidates
    const [indicatorEmbeddings, candidateEmbeddings] = await Promise.all([
      embedTexts(indicators),
      embedTexts(candidates)
    ]);

    const results: Array<{ text: string; score: number }> = [];

    // Calculate similarity scores
    for (let i = 0; i < candidates.length; i++) {
      const candidateEmb = candidateEmbeddings[i];

      // Find best similarity to any indicator
      const similarities = indicatorEmbeddings.map(indicatorEmb =>
        this.cosineSimilarity(candidateEmb, indicatorEmb)
      );

      const maxSimilarity = Math.max(...similarities);

      if (maxSimilarity > threshold) {
        results.push({
          text: candidates[i],
          score: maxSimilarity
        });
      }
    }

    // Return top results, sorted by score
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(result => result.text);
  }

  private static cosineSimilarity(a: number[], b: number[]): number {
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
}

// Question-answering approach for specific data extraction
export async function extractByQuestionAnswering(text: string): Promise<{
  name?: string;
  email?: string;
  phone?: string;
  currentRole?: string;
  yearsOfExperience?: string;
}> {
  // This would use a question-answering model if available
  // For now, we'll use semantic similarity to find answers

  const queries = [
    { key: 'name', query: 'What is the person\'s full name?' },
    { key: 'email', query: 'What is the email address?' },
    { key: 'phone', query: 'What is the phone number?' },
    { key: 'currentRole', query: 'What is the current job title?' },
    { key: 'yearsOfExperience', query: 'How many years of experience?' }
  ];

  const results: Record<string, string> = {};

  // This is a simplified approach - a real QA model would be more sophisticated
  for (const { key, query } of queries) {
    const answer = await findAnswerBySemanticSearch(text, query);
    if (answer) {
      results[key] = answer;
    }
  }

  return results;
}

async function findAnswerBySemanticSearch(text: string, question: string): Promise<string | undefined> {
  // Split text into sentences/chunks
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);

  if (sentences.length === 0) {
    return undefined;
  }

  // Get embeddings for question and all sentences
  const [questionEmbedding, sentenceEmbeddings] = await Promise.all([
    embedTexts([question]),
    embedTexts(sentences)
  ]);

  // Find most similar sentence
  let bestMatch = { index: -1, score: 0 };

  sentenceEmbeddings.forEach((sentenceEmb, index) => {
    const similarity = cosineSimilarity(questionEmbedding[0], sentenceEmb);
    if (similarity > bestMatch.score) {
      bestMatch = { index, score: similarity };
    }
  });

  // Return the most relevant sentence if similarity is high enough
  if (bestMatch.score > 0.5 && bestMatch.index >= 0) {
    return sentences[bestMatch.index].trim();
  }

  return undefined;
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