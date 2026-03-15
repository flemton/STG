export type DurationWindow = {
  minDays: number;
  maxDays: number;
  label: string;
};

export type TreatmentLine = {
  title: string;
  details: string;
};

export type GuidelineCondition = {
  id: string;
  title: string;
  category: string;
  summary: string;
  symptomKeywords: string[];
  hallmarkSymptoms: string[];
  duration: DurationWindow;
  redFlags: string[];
  treatment: TreatmentLine[];
  source: {
    section: string;
    pdfPages: string;
  };
};

export type MatchResult = {
  condition: GuidelineCondition;
  score: number;
  matchedSymptoms: string[];
  missingHallmarks: string[];
  durationFit: 'strong' | 'partial' | 'weak';
  confidenceLabel: 'High' | 'Moderate' | 'Low';
};
