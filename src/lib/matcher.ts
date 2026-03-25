import {
  guidelineConditions,
  searchableGeneratedSections,
  signVocabulary,
  symptomVocabulary,
} from '../data/conditions';
import {
  AgeUnit,
  ConditionAgeBand,
  GuidelineCondition,
  MatchResult,
  NormalizedAge,
} from '../types';
import {
  canonicalizeClinicalTerms,
  normalizeClinicalText,
  splitClinicalInput,
} from './clinical-input';

const aliases: Record<string, string[]> = {
  'shortness of breath': ['breathlessness', 'difficulty breathing'],
  breathlessness: ['shortness of breath'],
  wheeze: ['wheezing'],
  wheezing: ['wheeze'],
  diarrhoea: ['diarrhea'],
  diarrhea: ['diarrhoea'],
  dysuria: ['painful urination', 'burning urination'],
  rigors: ['chills'],
  confusion: ['altered consciousness', 'change in behaviour'],
  'neck stiffness': ['stiff neck', 'neck retraction'],
  'poor feeding': ['poor sucking', 'refusal of feeds', 'refusal to eat', 'poor oral intake'],
  jaundice: ['yellow eyes', 'yellow skin', 'yellow palms', 'yellow soles'],
  'rapid breathing': ['fast breathing', 'tachypnoea'],
  'lower chest wall indrawing': ['chest indrawing'],
  seizures: ['convulsions'],
  'bulging fontanelle': ['bulging fontanel'],
  'body pains': ['body pain', 'body aches'],
  'sunken eyes': ['eyes sunken'],
  'grey sclera': ['gray sclera'],
  'conjunctival folding': ['conjunctival wrinkling', 'wrinkling conjunctiva'],
  keratomalacia: ['cloudy cornea'],
};

const aliasVocabulary = Array.from(
  new Set([
    ...Object.keys(aliases),
    ...Object.values(aliases).flat(),
  ])
);
const symptomNormalizationVocabulary = Array.from(
  new Set([...symptomVocabulary, ...aliasVocabulary])
);
const signNormalizationVocabulary = Array.from(
  new Set([...signVocabulary, ...aliasVocabulary])
);

const genericSymptoms = new Set([
  'fever',
  'vomiting',
  'headache',
  'malaise',
  'fatigue',
  'poor appetite',
  'loss of appetite',
  'abdominal pain',
  'diarrhoea',
  'cough',
]);

const splitReferenceText = (input: string) => {
  const normalized = normalizeClinicalText(input);
  if (!normalized) {
    return [];
  }

  return Array.from(
    new Set(
      normalized
        .split(/,|\band\b|\n|\/|;|:|\.|\(|\)/)
        .map((part) => part.trim())
        .filter((part) => part.length > 1)
    )
  );
};

const expandTerms = (terms: string[]) => {
  const expanded = new Set(terms);

  for (const term of terms) {
    for (const [canonical, values] of Object.entries(aliases)) {
      if (
        term === canonical ||
        values.includes(term) ||
        values.some((value) => value.includes(term) || term.includes(value)) ||
        canonical.includes(term) ||
        term.includes(canonical)
      ) {
        expanded.add(canonical);
        values.forEach((value) => expanded.add(value));
      }
    }
  }

  return Array.from(expanded);
};

const matchesTerm = (input: string, term: string) => {
  if (input === term || input.includes(term)) {
    return true;
  }

  const inputWords = input.split(' ').filter(Boolean).length;
  return inputWords >= 2 && input.length >= 6 && term.includes(input);
};

const collectMatches = (terms: string[], inputs: string[]) =>
  terms.filter((term) => inputs.some((input) => matchesTerm(input, term)));

const genericMatchCount = (terms: string[]) =>
  terms.filter((term) => genericSymptoms.has(term)).length;

const scoreDuration = (condition: GuidelineCondition, durationDays: number | null) => {
  if (!condition.duration || !durationDays) {
    return { bonus: 0, fit: 'partial' as const };
  }

  const { minDays, maxDays } = condition.duration;
  if (durationDays >= minDays && durationDays <= maxDays) {
    return { bonus: 1.05, fit: 'strong' as const };
  }

  const distance = Math.min(Math.abs(durationDays - minDays), Math.abs(durationDays - maxDays));
  if (distance <= 3) {
    return { bonus: 0.2, fit: 'partial' as const };
  }

  return { bonus: -0.55, fit: 'weak' as const };
};

const isAgeInBand = (age: NormalizedAge, band: ConditionAgeBand) =>
  age.days >= band.ageRange.minDays && age.days <= band.ageRange.maxDays;

const compareBandEvidence = (
  band: ConditionAgeBand,
  symptomInputs: string[],
  signInputs: string[],
  allInputs: string[]
) => {
  const matchedSymptoms = collectMatches(band.evidence.symptoms, symptomInputs);
  const matchedSigns = collectMatches(band.evidence.signs, signInputs);
  const matchedInvestigations = collectMatches(band.evidence.investigations, allInputs);
  const hallmarkSymptomHits = collectMatches(band.evidence.hallmarkSymptoms, symptomInputs);
  const hallmarkSignHits = collectMatches(band.evidence.hallmarkSigns, signInputs);
  const matchedRedFlags = collectMatches(band.evidence.redFlags, allInputs);

  return {
    matchedSymptoms,
    matchedSigns,
    matchedInvestigations,
    hallmarkSymptomHits,
    hallmarkSignHits,
    matchedRedFlags,
    evidenceHits:
      matchedSymptoms.length +
      matchedSigns.length +
      matchedInvestigations.length +
      hallmarkSymptomHits.length +
      hallmarkSignHits.length +
      matchedRedFlags.length,
  };
};

const pickBand = (
  condition: GuidelineCondition,
  symptomInputs: string[],
  signInputs: string[],
  allInputs: string[],
  age: NormalizedAge
) => {
  const applicableBands = condition.ageBands.filter((band) => isAgeInBand(age, band));
  if (!applicableBands.length) {
    return null;
  }

  const applicable = applicableBands
    .map((band) => ({
      band,
      evidence: compareBandEvidence(band, symptomInputs, signInputs, allInputs),
    }))
    .sort((left, right) => right.evidence.evidenceHits - left.evidence.evidenceHits)[0];

  const competingBandEvidence = condition.ageBands
    .filter((band) => !isAgeInBand(age, band))
    .map(
      (band) => compareBandEvidence(band, symptomInputs, signInputs, allInputs).evidenceHits
    );

  return {
    ...applicable,
    competingBandEvidence: competingBandEvidence.length ? Math.max(...competingBandEvidence) : 0,
  };
};

const classifyEvidenceQuality = (
  matchedSymptoms: string[],
  matchedSigns: string[],
  hallmarkHits: string[]
): MatchResult['evidenceQuality'] => {
  if (hallmarkHits.length > 0 || matchedSigns.length >= 2) {
    return 'specific';
  }

  if (matchedSigns.length > 0 || matchedSymptoms.some((term) => !genericSymptoms.has(term))) {
    return 'mixed';
  }

  return 'generic';
};

const hasSymptom = (matchedSymptoms: string[], term: string) => matchedSymptoms.includes(term);

const scoreCondition = (
  condition: GuidelineCondition,
  symptomInputs: string[],
  signInputs: string[],
  durationDays: number | null,
  age: NormalizedAge
): MatchResult | null => {
  const allInputs = Array.from(new Set([...symptomInputs, ...signInputs]));
  const selected = pickBand(condition, symptomInputs, signInputs, allInputs, age);
  if (!selected) {
    return null;
  }

  const { band, evidence, competingBandEvidence } = selected;
  const {
    matchedSymptoms,
    matchedSigns,
    matchedInvestigations,
    hallmarkSymptomHits,
    hallmarkSignHits,
    matchedRedFlags,
    evidenceHits,
  } = evidence;

  if (evidenceHits === 0) {
    return null;
  }

  const hasOnlyOneGenericCue =
    matchedSymptoms.length === 1 &&
    genericMatchCount(matchedSymptoms) === 1 &&
    matchedSigns.length === 0 &&
    matchedInvestigations.length === 0 &&
    hallmarkSymptomHits.length === 0 &&
    hallmarkSignHits.length === 0 &&
    matchedRedFlags.length === 0;

  if (hasOnlyOneGenericCue) {
    return null;
  }

  const duration = scoreDuration(condition, durationDays);
  const hallmarkHits = [...hallmarkSymptomHits, ...hallmarkSignHits];
  const primaryEvidenceCount =
    matchedSymptoms.length +
    matchedSigns.length +
    matchedInvestigations.length +
    hallmarkSymptomHits.length +
    hallmarkSignHits.length;

  if (primaryEvidenceCount === 0) {
    return null;
  }

  const missingHallmarks = [
    ...band.evidence.hallmarkSymptoms,
    ...band.evidence.hallmarkSigns,
  ].filter((keyword) => !hallmarkHits.includes(keyword));

  const hasHallmarkRequirements =
    band.evidence.hallmarkSymptoms.length + band.evidence.hallmarkSigns.length > 0;
  const onlyGenericSymptoms =
    matchedSymptoms.length > 0 &&
    matchedSymptoms.length === genericMatchCount(matchedSymptoms) &&
    matchedSigns.length === 0 &&
    matchedInvestigations.length === 0 &&
    hallmarkHits.length === 0;
  const signDrivenCondition =
    band.evidence.signs.length > band.evidence.symptoms.length ||
    (band.evidence.hallmarkSigns.length > 0 && band.evidence.symptoms.length <= 3);
  const hasDiarrhoealCoreFeature =
    matchedSymptoms.some((term) =>
      ['diarrhoea', 'watery stool', 'watery diarrhoea', 'thirst', 'blood in stool'].includes(term)
    ) ||
    matchedSigns.some((term) =>
      [
        'sunken eyes',
        'poor drinking',
        'skin pinch goes back slowly',
        'skin pinch goes back very slowly',
        'dry mouth',
        'poor skin turgor',
        'diminished skin turgor',
      ].includes(term)
    );
  if (
    (condition.id === 'acute-diarrhoea' || condition.id === 'rotavirus-diarrhoea') &&
    !hasDiarrhoealCoreFeature
  ) {
    return null;
  }
  const hasUrinaryCoreFeature =
    matchedSymptoms.some((term) =>
      [
        'painful urination',
        'frequent urination',
        'urgency',
        'suprapubic pain',
        'abdominal pain',
        'poor feeding',
      ].includes(term)
    ) ||
    matchedSigns.some((term) => ['suprapubic tenderness', 'loin tenderness'].includes(term));
  if (condition.id === 'urinary-tract-infection' && !hasUrinaryCoreFeature) {
    return null;
  }
  const hallmarkGateRequired =
    hasHallmarkRequirements &&
    (band.evidence.hallmarkSymptoms.length + band.evidence.hallmarkSigns.length >= 2 ||
      signDrivenCondition);
  const meningitisMeningealSigns = [
    'neck stiffness',
    'photophobia',
    'positive kernig sign',
    'positive brudzinski sign',
    'bulging fontanelle',
    'neck retraction',
  ];
  const hasMeningealSign =
    condition.id === 'meningitis' &&
    matchedSigns.some((sign) => meningitisMeningealSigns.includes(sign));
  const needsHallmarkFindings =
    hallmarkGateRequired &&
    hallmarkHits.length === 0 &&
    matchedSigns.length === 0 &&
    matchedRedFlags.length === 0 &&
    !signDrivenCondition;

  const symptomScore =
    matchedSymptoms.length * 1.05 - genericMatchCount(matchedSymptoms) * 0.35;
  const signScore = matchedSigns.length * 2.4;
  const investigationScore = matchedInvestigations.length * 0.75;
  const hallmarkScore = hallmarkSymptomHits.length * 2.2 + hallmarkSignHits.length * 3.6;
  const redFlagScore =
    primaryEvidenceCount >= 2 || matchedSigns.length > 0 || hallmarkHits.length > 0
      ? matchedRedFlags.length * 0.95
      : 0;
  const ageScore = condition.ageSensitive ? 0.55 : 0.15;
  const preferredBandScore = condition.preferredAgeBands?.includes(band.id) ? 0.35 : 0;
  const mismatchPenalty = condition.ageSensitive && competingBandEvidence > evidenceHits ? 0.8 : 0;
  const hallmarkPenalty = needsHallmarkFindings ? 3.4 : 0;
  const genericPenalty = onlyGenericSymptoms ? 2.4 : 0;
  const signMissingPenalty = signDrivenCondition && matchedSigns.length === 0 ? 2.1 : 0;
  const acuteDiarrhoeaClusterBonus =
    condition.id === 'acute-diarrhoea' &&
    duration.fit !== 'weak' &&
    hasSymptom(matchedSymptoms, 'diarrhoea') &&
    hasSymptom(matchedSymptoms, 'vomiting')
      ? 1.35
      : 0;
  const typhoidClusterBonus =
    condition.id === 'typhoid-fever' &&
    duration.fit === 'strong' &&
    hasSymptom(matchedSymptoms, 'fever') &&
    hasSymptom(matchedSymptoms, 'headache') &&
    hasSymptom(matchedSymptoms, 'abdominal pain') &&
    (hasSymptom(matchedSymptoms, 'diarrhoea') || hasSymptom(matchedSymptoms, 'constipation'))
      ? 1.1
      : 0;
  const weakTyphoidPenalty =
    condition.id === 'typhoid-fever' && duration.fit === 'weak' && matchedSigns.length === 0
      ? 1.05
      : 0;
  const meningitisNonMeningealPenalty =
    condition.id === 'meningitis' &&
    matchedSigns.length > 0 &&
    !hasMeningealSign
      ? 2.1
      : 0;

  if (
    condition.id === 'typhoid-fever' &&
    condition.duration &&
    durationDays !== null &&
    durationDays < condition.duration.minDays &&
    matchedSigns.length === 0
  ) {
    return null;
  }

  if (condition.id === 'typhoid-fever' && duration.fit === 'weak' && matchedSigns.length === 0) {
    return null;
  }

  let score =
    symptomScore +
    signScore +
    investigationScore +
    hallmarkScore +
    redFlagScore +
    duration.bonus +
    ageScore +
    preferredBandScore -
    mismatchPenalty -
    hallmarkPenalty -
    genericPenalty -
    signMissingPenalty +
    acuteDiarrhoeaClusterBonus +
    typhoidClusterBonus -
    weakTyphoidPenalty -
    meningitisNonMeningealPenalty;

  if (condition.id === 'meningitis' && hallmarkSignHits.length === 0 && matchedSigns.length === 0) {
    score -= 3.15;
  }

  if (condition.id === 'severe-malaria' && hallmarkSignHits.length === 0 && matchedRedFlags.length === 0) {
    score -= 2.25;
  }

  if (
    condition.id === 'acute-diarrhoea' &&
    matchedSigns.some((term) => term.includes('skin pinch') || term === 'sunken eyes')
  ) {
    score += 1.15;
  }

  if (score <= 0.5) {
    return null;
  }

  const evidenceQuality = classifyEvidenceQuality(matchedSymptoms, matchedSigns, hallmarkHits);

  let confidenceLabel: MatchResult['confidenceLabel'] = 'Low';
  if (!needsHallmarkFindings && evidenceQuality === 'specific' && score >= 7.5) {
    confidenceLabel = 'High';
  } else if (!onlyGenericSymptoms && score >= 4.5) {
    confidenceLabel = 'Moderate';
  }

  return {
    condition,
    ageBand: band,
    score: Number(score.toFixed(2)),
    matchedSymptoms,
    matchedSigns,
    matchedInvestigations,
    missingHallmarks,
    matchedRedFlags,
    suggestedInvestigations: band.evidence.investigations.slice(0, 4),
    durationFit: duration.fit,
    confidenceLabel,
    evidenceQuality,
    needsHallmarkFindings,
  };
};

export const getMatches = (
  symptomText: string,
  signText: string,
  durationDays: number | null,
  age: NormalizedAge | null
): MatchResult[] => {
  if (!age) {
    return [];
  }

  const symptomInputs = expandTerms(
    canonicalizeClinicalTerms(splitClinicalInput(symptomText), symptomNormalizationVocabulary)
  );
  const signInputs = expandTerms(
    canonicalizeClinicalTerms(splitClinicalInput(signText), signNormalizationVocabulary)
  );

  if (!symptomInputs.length && !signInputs.length) {
    return [];
  }

  return guidelineConditions
    .map((condition) => scoreCondition(condition, symptomInputs, signInputs, durationDays, age))
    .filter((result): result is MatchResult => Boolean(result))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (left.confidenceLabel !== right.confidenceLabel) {
        return right.confidenceLabel.localeCompare(left.confidenceLabel);
      }
      return left.condition.title.localeCompare(right.condition.title);
    })
    .slice(0, 8);
};

export type RelatedSectionResult = {
  id: string;
  title: string;
  category: string;
  pdfPages: string;
  matchedSymptoms: string[];
  matchedSigns: string[];
  investigations: string[];
  diagnosticNotes: string[];
};

export const getRelatedSections = (symptomText: string, signText: string): RelatedSectionResult[] => {
  const symptomInputs = expandTerms(
    canonicalizeClinicalTerms(splitClinicalInput(symptomText), symptomNormalizationVocabulary)
  );
  const signInputs = expandTerms(
    canonicalizeClinicalTerms(splitClinicalInput(signText), signNormalizationVocabulary)
  );
  const allInputs = Array.from(new Set([...symptomInputs, ...signInputs]));

  if (!allInputs.length) {
    return [];
  }

  return searchableGeneratedSections
    .map((section) => {
      const sectionSymptoms = Array.from(
        new Set(
          [
            ...section.symptoms,
            ...section.signsAndSymptoms,
            ...section.causes,
            ...section.diagnosticNotes.slice(0, 3),
          ].flatMap((item) =>
            expandTerms(splitReferenceText(item))
          )
        )
      );
      const sectionSigns = Array.from(
        new Set(
          [...section.signs, ...section.diagnosticClues].flatMap((item) =>
            expandTerms(splitReferenceText(item))
          )
        )
      );
      const titleTerms = expandTerms(splitClinicalInput(section.title));
      const matchedTitleTerms = collectMatches(titleTerms, allInputs);
      const matchedSymptoms = Array.from(
        new Set([...collectMatches(sectionSymptoms, symptomInputs), ...matchedTitleTerms])
      );
      const matchedSigns = collectMatches(sectionSigns, signInputs);
      const score = matchedTitleTerms.length * 2.5 + matchedSigns.length * 2 + matchedSymptoms.length;

      return {
        section,
        matchedSymptoms,
        matchedSigns,
        score,
      };
    })
    .filter(
      (entry) =>
        entry.score >= 2 &&
        (entry.matchedSymptoms.length > 0 || entry.matchedSigns.length > 0)
    )
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map(({ section, matchedSymptoms, matchedSigns }) => ({
      id: section.id,
      title: section.title,
      category: section.category,
      pdfPages: section.pdfPages,
      matchedSymptoms,
      matchedSigns,
      investigations: section.investigations.slice(0, 4),
      diagnosticNotes: section.diagnosticNotes.slice(0, 2),
    }));
};

export const formatDurationToDays = (value: string, unit: 'days' | 'weeks' | 'months') => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0 || !Number.isInteger(numeric)) {
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

export const formatAgeToNormalized = (value: string, unit: AgeUnit): NormalizedAge | null => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0 || !Number.isInteger(numeric)) {
    return null;
  }

  const days = unit === 'days' ? numeric : unit === 'months' ? numeric * 30 : numeric * 365;
  return {
    value: numeric,
    unit,
    days,
    months: days / 30,
    years: days / 365,
    display: `${numeric} ${unit}`,
  };
};

export const detectEmergencySignals = (results: MatchResult[]) => {
  const topMatch = results[0];
  if (!topMatch) {
    return [];
  }

  return Array.from(
    new Set([
      ...topMatch.matchedRedFlags,
      ...(topMatch.condition.category.toLowerCase().includes('emergency')
        ? topMatch.ageBand.evidence.redFlags
        : []),
    ])
  );
};
