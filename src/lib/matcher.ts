import { guidelineConditions } from '../data/conditions';
import { GuidelineCondition, MatchResult } from '../types';

const symptomAliases: Record<string, string[]> = {
  'shortness of breath': ['breathlessness', 'difficulty breathing'],
  breathlessness: ['shortness of breath', 'difficulty breathing'],
  'body pain': ['body pains', 'body ache', 'body aches', 'generalized body pain'],
  'joint pain': ['joint pains', 'body pain'],
  wheeze: ['wheezing'],
  wheezing: ['wheeze'],
  diarrhoea: ['diarrhea'],
  diarrhea: ['diarrhoea'],
  dysuria: ['painful urination', 'burning urination'],
  rigors: ['chills'],
  confusion: ['altered consciousness', 'change in behaviour'],
  'neck stiffness': ['neck pain'],
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9,\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const splitSymptoms = (input: string) => {
  const normalized = normalize(input);
  if (!normalized) {
    return [];
  }

  const rawParts = normalized
    .split(/,|\band\b|\n|\/|;/)
    .map((part) => part.trim())
    .filter(Boolean);

  return Array.from(new Set(rawParts));
};

const expandSymptoms = (symptoms: string[]) => {
  const expanded = new Set(symptoms);

  symptoms.forEach((symptom) => {
    Object.entries(symptomAliases).forEach(([canonical, aliases]) => {
      if (
        symptom.includes(canonical) ||
        canonical.includes(symptom) ||
        aliases.some((alias) => symptom.includes(alias) || alias.includes(symptom))
      ) {
        expanded.add(canonical);
        aliases.forEach((alias) => expanded.add(alias));
      }
    });
  });

  return Array.from(expanded);
};

const scoreDuration = (condition: GuidelineCondition, durationDays: number | null) => {
  if (!durationDays) {
    return { bonus: 0.4, fit: 'partial' as const };
  }

  const { minDays, maxDays } = condition.duration;
  if (durationDays >= minDays && durationDays <= maxDays) {
    return { bonus: 1.2, fit: 'strong' as const };
  }

  const distance = Math.min(Math.abs(durationDays - minDays), Math.abs(durationDays - maxDays));
  if (distance <= 3) {
    return { bonus: 0.5, fit: 'partial' as const };
  }

  return { bonus: -0.3, fit: 'weak' as const };
};

const matchesTerm = (symptom: string, term: string) =>
  symptom === term || symptom.includes(term);

const hasTermMatch = (terms: string[], symptomPool: string[]) =>
  terms.filter((term) =>
    symptomPool.some((symptom) => matchesTerm(symptom, term))
  );

const scoreCondition = (
  condition: GuidelineCondition,
  symptoms: string[],
  durationDays: number | null
): MatchResult => {
  const matchedSymptoms = hasTermMatch(condition.symptomKeywords, symptoms);

  const hallmarkHits = hasTermMatch(condition.hallmarkSymptoms, symptoms);
  const matchedRedFlags = hasTermMatch(condition.redFlags, symptoms);
  const evidenceHits = matchedSymptoms.length + hallmarkHits.length + matchedRedFlags.length;

  const duration = scoreDuration(condition, durationDays);
  const emergencyBoost =
    matchedRedFlags.length > 0 && condition.category.toLowerCase().includes('emergency') ? 1.4 : 0;
  const base =
    matchedSymptoms.length * 1.35 +
    hallmarkHits.length * 1.75 +
    matchedRedFlags.length * 0.8 +
    duration.bonus +
    emergencyBoost;
  const penalty =
    matchedRedFlags.length > 0 && !condition.category.toLowerCase().includes('emergency') ? 0.75 : 0;

  const score = evidenceHits === 0 ? 0 : Math.max(0, Number((base - penalty).toFixed(2)));
  const missingHallmarks = condition.hallmarkSymptoms.filter((keyword) => !hallmarkHits.includes(keyword));

  let confidenceLabel: MatchResult['confidenceLabel'] = 'Low';
  if (score >= 6) {
    confidenceLabel = 'High';
  } else if (score >= 3.5) {
    confidenceLabel = 'Moderate';
  }

  return {
    condition,
    score,
    matchedSymptoms,
    missingHallmarks,
    matchedRedFlags,
    durationFit: duration.fit,
    confidenceLabel,
  };
};

export const getMatches = (symptomInput: string, durationDays: number | null): MatchResult[] => {
  const symptoms = expandSymptoms(splitSymptoms(symptomInput));

  if (!symptoms.length) {
    return [];
  }

  return guidelineConditions
    .map((condition) => scoreCondition(condition, symptoms, durationDays))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
};

export const formatDurationToDays = (value: string, unit: 'days' | 'weeks' | 'months') => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  if (unit === 'weeks') {
    return numeric * 7;
  }

  if (unit === 'months') {
    return numeric * 30;
  }

  return numeric;
};

export const detectEmergencySignals = (results: MatchResult[]) => {
  const topMatch = results[0];
  if (!topMatch) {
    return [];
  }

  const urgentTerms = new Set([
    ...topMatch.matchedRedFlags,
    ...(topMatch.condition.category.toLowerCase().includes('emergency')
      ? topMatch.condition.redFlags
      : []),
  ]);

  return Array.from(urgentTerms);
};
