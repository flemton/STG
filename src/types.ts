export type AgeUnit = 'days' | 'months' | 'years';

export type DurationWindow = {
  minDays: number;
  maxDays: number;
  label: string;
};

export type AgeRange = {
  minDays: number;
  maxDays: number;
  label: string;
};

export type NormalizedAge = {
  value: number;
  unit: AgeUnit;
  days: number;
  months: number;
  years: number;
  display: string;
};

export type TreatmentLine = {
  title: string;
  details: string;
};

export type DiagnosticEvidence = {
  symptoms: string[];
  signs: string[];
  investigations: string[];
  hallmarkSymptoms: string[];
  hallmarkSigns: string[];
  redFlags: string[];
  referralCriteria?: string[];
  diagnosticNotes?: string[];
};

export type ConditionAgeBand = {
  id: string;
  label: string;
  ageRange: AgeRange;
  summary: string;
  evidence: DiagnosticEvidence;
  treatment: TreatmentLine[];
  contraindicationsOrNotes?: string[];
  source?: {
    section: string;
    pdfPages: string;
  };
};

export type GuidelineCondition = {
  id: string;
  title: string;
  category: string;
  dataSource?: 'curated' | 'generated';
  ageSensitive: boolean;
  preferredAgeBands?: string[];
  duration?: DurationWindow;
  ageBands: ConditionAgeBand[];
};

export type MatchResult = {
  condition: GuidelineCondition;
  ageBand: ConditionAgeBand;
  score: number;
  matchedSymptoms: string[];
  matchedSigns: string[];
  matchedInvestigations: string[];
  missingHallmarks: string[];
  matchedRedFlags: string[];
  suggestedInvestigations: string[];
  durationFit: 'strong' | 'partial' | 'weak';
  confidenceLabel: 'High' | 'Moderate' | 'Low';
  evidenceQuality: 'specific' | 'mixed' | 'generic';
  needsHallmarkFindings: boolean;
};

export type SearchableAgeBand = {
  id: string;
  label: string;
  ageRange: AgeRange;
  summary: string;
  symptoms: string[];
  signs: string[];
  hallmarkSymptoms: string[];
  hallmarkSigns: string[];
  investigations: string[];
  redFlags: string[];
  referralCriteria: string[];
  treatment: TreatmentLine[];
  contraindicationsOrNotes: string[];
  source?: {
    section: string;
    pdfPages: string;
  };
};

export type SearchableStgEntry = {
  id: string;
  title: string;
  category: string;
  sourceType: 'curated' | 'generated';
  pdfPages: string;
  aliases: string[];
  normalizedTitle: string;
  searchTokens: string[];
  fuzzyTitle: string;
  diagnosticNotes: string[];
  causes: string[];
  symptoms: string[];
  signs: string[];
  signsAndSymptoms: string[];
  diagnosticClues: string[];
  diagnosis: string[];
  investigations: string[];
  treatmentObjectives: string[];
  nonPharmacologicalTreatment: string[];
  pharmacologicalTreatment: string[];
  treatment: string[];
  referralCriteria: string[];
  prevention: string[];
  counsellingPoints: string[];
  complications: string[];
  ageBands: SearchableAgeBand[];
};

export type DiseaseSearchResult = {
  entry: SearchableStgEntry;
  score: number;
  exact: boolean;
  matchStrength: 'exact' | 'alias' | 'prefix' | 'token' | 'fuzzy';
  matchReason: string;
};
