export type FeatureTestResult = boolean | string | number | RegExpMatchArray | null | undefined;
export type FeatureTest = (line: string) => FeatureTestResult;

export interface FeatureSet {
  test: FeatureTest;
  score: number;
  capture?: boolean;
}

export interface ScoredLine {
  index: number;
  line: string;
  score: number;
  capture?: string;
}

export interface PickOptions {
  threshold?: number;
  preferCapture?: boolean;
  allowEmpty?: boolean;
  disallow?: (line: string) => boolean;
}

export function scoreLine(line: string, featureSets: FeatureSet[]): ScoredLine {
  let score = 0;
  let capture: string | undefined;
  for (const feature of featureSets) {
    const result = feature.test(line);
    let matched = false;
    if (Array.isArray(result)) {
      matched = result.length > 0;
    } else if (typeof result === "boolean") {
      matched = result;
    } else if (typeof result === "string" || typeof result === "number") {
      matched = true;
    } else if (result) {
      matched = true;
    }
    if (matched) {
      score += feature.score;
      if (feature.capture) {
        if (Array.isArray(result) && result[0]) {
          capture = result[0];
        } else if (typeof result === "string") {
          capture = result;
        } else {
          capture = line;
        }
      }
    }
  }
  return { line, index: -1, score, capture };
}

export function pickBestLine(
  lines: string[],
  featureSets: FeatureSet[],
  options: PickOptions = {}
): ScoredLine | undefined {
  const { threshold = 0, preferCapture = false, allowEmpty = false, disallow } = options;
  let best: ScoredLine | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line && !allowEmpty) {
      continue;
    }
    if (disallow?.(line)) {
      continue;
    }
    const scored = scoreLine(line, featureSets);
    scored.index = i;
    if (!best || scored.score > best.score || (preferCapture && scored.capture && !best.capture)) {
      best = scored;
    }
  }

  if (best && best.score >= threshold) {
    return best;
  }
  return undefined;
}

export function penalizeMatch(value: string | undefined, penalty: number): FeatureSet {
  return {
    test: (line) => (value ? line.includes(value) : false),
    score: penalty,
  };
}
