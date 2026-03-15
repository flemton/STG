import { guidelineConditions } from '../data/conditions';
import { GuidelineCondition, MatchResult } from '../types';

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

const scoreCondition = (condition: GuidelineCondition, symptoms: string[], durationDays: number | null): MatchResult => {
  const matchedSymptoms = condition.symptomKeywords.filter((keyword) =>
    symptoms.some((symptom) => symptom.includes(keyword) || keyword.includes(symptom))
  );

  const hallmarkHits = condition.hallmarkSymptoms.filter((keyword) =>
    symptoms.some((symptom) => symptom.includes(keyword) || keyword.includes(symptom))
  );

  const duration = scoreDuration(condition, durationDays);
  const base = matchedSymptoms.length * 1.6 + hallmarkHits.length * 1.4 + duration.bonus;
  const penalty = condition.redFlags.some((flag) =>
    symptoms.some((symptom) => symptom.includes(flag) || flag.includes(symptom))
  ) && !condition.category.toLowerCase().includes('emergency')
    ? 0.6
    : 0;

  const score = Math.max(0, Number((base - penalty).toFixed(2)));
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
    durationFit: duration.fit,
    confidenceLabel,
  };
};

export const getMatches = (symptomInput: string, durationDays: number | null): MatchResult[] => {
  const symptoms = splitSymptoms(symptomInput);

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
