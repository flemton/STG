import { StatusBar } from 'expo-status-bar';
import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  generatedCorpusCount,
  guidelineConditions,
  signVocabulary,
  symptomVocabulary,
} from './src/data/conditions';
import { getClinicalSuggestions, replaceLastClinicalFragment } from './src/lib/clinical-input';
import {
  detectEmergencySignals,
  formatAgeToNormalized,
  formatDurationToDays,
  getMatches,
  getRelatedSections,
} from './src/lib/matcher';
import { getApplicableAgeBand, searchDiseases } from './src/lib/search';
import { AgeUnit, DiseaseSearchResult, MatchResult, SearchableAgeBand, SearchableStgEntry } from './src/types';

const quickSymptoms = [
  'Fever',
  'Poor feeding',
  'Vomiting',
  'Cough',
  'Breathlessness',
  'Wheeze',
  'Diarrhoea',
  'Headache',
  'Painful urination',
  'Frequent urination',
  'Yellow eyes',
  'Poor night vision',
];

const quickSigns = [
  'Neck stiffness',
  'Photophobia',
  'Sunken eyes',
  'Chest indrawing',
  'Dark urine',
  'Pallor',
  'Bulging fontanelle',
  'Convulsions',
  'Dry conjunctiva',
  'Grey sclera',
  'Conjunctival folding',
  'Keratomalacia',
];

const durationUnits = ['days', 'weeks', 'months'] as const;
const ageUnits: AgeUnit[] = ['days', 'months', 'years'];
const modes = [
  { id: 'triage', label: 'Triage by symptoms/signs' },
  { id: 'search', label: 'Search by disease name' },
] as const;

const exampleCases = [
  {
    label: 'Neonate sepsis',
    symptoms: 'poor feeding, weak cry, fever',
    signs: 'difficulty breathing',
    ageValue: '7',
    ageUnit: 'days' as const,
    duration: '1',
    durationUnit: 'days' as const,
  },
  {
    label: 'Infant meningitis',
    symptoms: 'fever, poor sucking, vomiting',
    signs: 'bulging fontanelle',
    ageValue: '6',
    ageUnit: 'months' as const,
    duration: '2',
    durationUnit: 'days' as const,
  },
  {
    label: 'Child pneumonia',
    symptoms: 'fever, cough',
    signs: 'rapid breathing, chest indrawing',
    ageValue: '3',
    ageUnit: 'years' as const,
    duration: '3',
    durationUnit: 'days' as const,
  },
  {
    label: 'Adult malaria',
    symptoms: 'fever, chills, rigors, headache, body pains, vomiting',
    signs: '',
    ageValue: '25',
    ageUnit: 'years' as const,
    duration: '3',
    durationUnit: 'days' as const,
  },
  {
    label: 'Child dehydration',
    symptoms: 'diarrhoea, vomiting, thirst',
    signs: 'sunken eyes, poor drinking',
    ageValue: '2',
    ageUnit: 'years' as const,
    duration: '2',
    durationUnit: 'days' as const,
  },
  {
    label: 'Vitamin A eye signs',
    symptoms: 'poor night vision',
    signs: 'dry conjunctiva, grey sclera, conjunctival folding',
    ageValue: '2',
    ageUnit: 'months' as const,
    duration: '14',
    durationUnit: 'days' as const,
  },
];

function LogoMark() {
  return (
    <View style={styles.logoShell}>
      <View style={styles.logoOuterRing}>
        <View style={styles.logoCore}>
          <View style={styles.logoSparkTop} />
          <View style={styles.logoSparkRight} />
          <View style={styles.logoSparkBottom} />
          <View style={styles.logoSparkLeft} />
          <Text style={styles.logoLetters}>STG</Text>
        </View>
      </View>
    </View>
  );
}

function SectionList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (!items.length) {
    return null;
  }

  return (
    <View style={styles.sectionGroup}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item) => (
        <Text key={`${title}-${item}`} style={styles.noteText}>
          - {item}
        </Text>
      ))}
    </View>
  );
}

function SearchAgeBandCard({
  ageBand,
  highlighted,
}: {
  ageBand: SearchableAgeBand;
  highlighted: boolean;
}) {
  return (
    <View style={[styles.ageBandCard, highlighted && styles.highlightAgeBandCard]}>
      <View style={styles.ageBandHeader}>
        <Text style={styles.ageBandTitle}>{ageBand.label}</Text>
        {highlighted && (
          <View style={styles.matchChip}>
            <Text style={styles.matchChipText}>Age match</Text>
          </View>
        )}
      </View>

      <Text style={styles.cardSummary}>{ageBand.summary}</Text>

      <SectionList title="Symptoms" items={ageBand.symptoms} />
      <SectionList title="Signs" items={ageBand.signs} />
      <SectionList title="Hallmark symptoms" items={ageBand.hallmarkSymptoms} />
      <SectionList title="Hallmark signs" items={ageBand.hallmarkSigns} />
      <SectionList title="Investigations" items={ageBand.investigations} />
      <SectionList title="Red flags" items={ageBand.redFlags} />
      <SectionList title="Referral criteria" items={ageBand.referralCriteria} />

      <View style={styles.sectionGroup}>
        <Text style={styles.sectionTitle}>Treatment</Text>
        {ageBand.treatment.map((item) => (
          <View key={`${ageBand.id}-${item.title}`} style={styles.treatmentRow}>
            <Text style={styles.treatmentTitle}>{item.title}</Text>
            <Text style={styles.treatmentText}>{item.details}</Text>
          </View>
        ))}
      </View>

      <SectionList title="Notes" items={ageBand.contraindicationsOrNotes} />

      {!!ageBand.source && (
        <Text style={styles.sourceText}>
          Source: {ageBand.source.section} | PDF pages {ageBand.source.pdfPages}
        </Text>
      )}
    </View>
  );
}

const SuggestionStrip = memo(function SuggestionStrip({
  title,
  suggestions,
  onPick,
}: {
  title: string;
  suggestions: { term: string; reason: string }[];
  onPick: (term: string) => void;
}) {
  if (!suggestions.length) {
    return null;
  }

  return (
    <View style={styles.suggestionBox}>
      <Text style={styles.suggestionLabel}>{title}</Text>
      <View style={styles.chips}>
        {suggestions.map((suggestion) => (
          <Pressable
            key={`${title}-${suggestion.term}`}
            onPress={() => onPick(suggestion.term)}
            style={styles.suggestionChip}
          >
            <Text style={styles.suggestionChipText}>{suggestion.term}</Text>
            <Text style={styles.suggestionHintText}>
              {suggestion.reason === 'fuzzy' ? 'Did you mean?' : 'Suggested'}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
});

const DiseaseAutocomplete = memo(function DiseaseAutocomplete({
  suggestions,
  onPick,
}: {
  suggestions: DiseaseSearchResult[];
  onPick: (result: DiseaseSearchResult) => void;
}) {
  if (!suggestions.length) {
    return null;
  }

  return (
    <View style={styles.suggestionBox}>
      <Text style={styles.suggestionLabel}>Suggested disease names</Text>
      <View style={styles.autocompleteList}>
        {suggestions.map((result) => (
          <Pressable
            key={`search-suggestion-${result.entry.id}`}
            onPress={() => onPick(result)}
            style={styles.autocompleteRow}
          >
            <View style={styles.autocompleteCopy}>
              <Text style={styles.autocompleteTitle}>{result.entry.title}</Text>
              <Text style={styles.autocompleteMeta}>
                {result.matchStrength === 'fuzzy'
                  ? 'Did you mean this STG condition?'
                  : result.matchStrength === 'alias'
                    ? 'Matched from a common alias'
                    : 'Strong search suggestion'}
              </Text>
            </View>
            <View style={styles.autocompleteBadge}>
              <Text style={styles.autocompleteBadgeText}>
                {result.matchStrength === 'fuzzy'
                  ? 'Typo fix'
                  : result.matchStrength === 'alias'
                    ? 'Alias'
                    : 'Pick'}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
});

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}

function SearchDetail({
  entry,
  age,
}: {
  entry: SearchableStgEntry;
  age: ReturnType<typeof formatAgeToNormalized>;
}) {
  const applicableAgeBand = getApplicableAgeBand(entry, age);
  const remainingAgeBands = entry.ageBands.filter((band) => band.id !== applicableAgeBand?.id);

  return (
    <View style={styles.card}>
      <View style={styles.searchDetailHeader}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle}>{entry.title}</Text>
          <Text style={styles.cardCategory}>{entry.category}</Text>
        </View>
        <View style={styles.detailPageBadge}>
          <Text style={styles.detailPageText}>PDF {entry.pdfPages}</Text>
        </View>
      </View>

      {!!entry.aliases.length && (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Also searched as</Text>
          <Text style={styles.metaValue}>{entry.aliases.join(', ')}</Text>
        </View>
      )}

      {entry.ageBands.length > 0 ? (
        <>
          {age ? (
            <Text style={styles.helperText}>
              Search detail is personalized for {age.display}. Matching age guidance is highlighted first.
            </Text>
          ) : (
            <Text style={styles.helperText}>
              Add age to highlight the relevant age-specific band. Full STG content remains visible without age.
            </Text>
          )}

          {!!applicableAgeBand && <SearchAgeBandCard ageBand={applicableAgeBand} highlighted />}

          {!!remainingAgeBands.length && (
            <View style={styles.sectionGroup}>
              <Text style={styles.sectionTitle}>Other age groups</Text>
              {remainingAgeBands.map((ageBand) => (
                <SearchAgeBandCard key={ageBand.id} ageBand={ageBand} highlighted={false} />
              ))}
            </View>
          )}
        </>
      ) : (
        <>
          <SectionList title="Diagnostic notes" items={entry.diagnosticNotes} />
          <SectionList title="Causes" items={entry.causes} />
          <SectionList title="Symptoms" items={entry.symptoms} />
          <SectionList title="Signs" items={entry.signs} />
          <SectionList title="Signs and symptoms" items={entry.signsAndSymptoms} />
          <SectionList title="Diagnostic clues" items={entry.diagnosticClues} />
          <SectionList title="Diagnosis" items={entry.diagnosis} />
          <SectionList title="Investigations" items={entry.investigations} />
          <SectionList title="Treatment objectives" items={entry.treatmentObjectives} />
          <SectionList
            title="Non-pharmacological treatment"
            items={entry.nonPharmacologicalTreatment}
          />
          <SectionList
            title="Pharmacological treatment"
            items={entry.pharmacologicalTreatment}
          />
          <SectionList title="Treatment" items={entry.treatment} />
          <SectionList title="Referral criteria" items={entry.referralCriteria} />
          <SectionList title="Prevention" items={entry.prevention} />
          <SectionList title="Counselling points" items={entry.counsellingPoints} />
          <SectionList title="Complications" items={entry.complications} />
          <Text style={styles.sourceText}>Source: {entry.title} | PDF pages {entry.pdfPages}</Text>
        </>
      )}
    </View>
  );
}

export default function App() {
  const [mode, setMode] = useState<(typeof modes)[number]['id']>('triage');
  const [symptomText, setSymptomText] = useState('');
  const [signText, setSignText] = useState('');
  const [diseaseQuery, setDiseaseQuery] = useState('');
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null);
  const [ageValue, setAgeValue] = useState('');
  const [ageUnit, setAgeUnit] = useState<AgeUnit>('years');
  const [durationValue, setDurationValue] = useState('');
  const [durationUnit, setDurationUnit] = useState<(typeof durationUnits)[number]>('days');

  const deferredSymptomText = useDeferredValue(symptomText);
  const deferredSignText = useDeferredValue(signText);
  const deferredDiseaseQuery = useDeferredValue(diseaseQuery);
  const debouncedSymptomText = useDebouncedValue(symptomText, 160);
  const debouncedSignText = useDebouncedValue(signText, 160);
  const debouncedDiseaseQuery = useDebouncedValue(diseaseQuery, 180);
  const age = useMemo(() => formatAgeToNormalized(ageValue, ageUnit), [ageUnit, ageValue]);
  const durationDays = useMemo(
    () => formatDurationToDays(durationValue, durationUnit),
    [durationUnit, durationValue]
  );
  const symptomSuggestions = useMemo(
    () =>
      getClinicalSuggestions(deferredSymptomText, symptomVocabulary, 6, {
        allowFuzzy: deferredSymptomText.trim() === debouncedSymptomText.trim(),
      })
        .filter((entry) => entry.reason !== 'exact')
        .slice(0, 6),
    [debouncedSymptomText, deferredSymptomText]
  );
  const signSuggestions = useMemo(
    () =>
      getClinicalSuggestions(deferredSignText, signVocabulary, 6, {
        allowFuzzy: deferredSignText.trim() === debouncedSignText.trim(),
      })
        .filter((entry) => entry.reason !== 'exact')
        .slice(0, 6),
    [debouncedSignText, deferredSignText]
  );

  const triageResults = useMemo(
    () => getMatches(deferredSymptomText, deferredSignText, durationDays, age),
    [age, deferredSignText, deferredSymptomText, durationDays]
  );
  const emergencySignals = useMemo(() => detectEmergencySignals(triageResults), [triageResults]);
  const relatedSections = useMemo(
    () => getRelatedSections(deferredSymptomText, deferredSignText),
    [deferredSignText, deferredSymptomText]
  );
  const likelyMatches = useMemo(
    () =>
      triageResults.filter(
        (result) => !result.needsHallmarkFindings && result.confidenceLabel !== 'Low'
      ),
    [triageResults]
  );
  const reviewMatches = useMemo(
    () =>
      triageResults.filter(
        (result) => result.needsHallmarkFindings || result.confidenceLabel === 'Low'
      ),
    [triageResults]
  );

  const searchResults = useMemo(
    () =>
      searchDiseases(deferredDiseaseQuery, {
        allowFuzzy: deferredDiseaseQuery.trim() === debouncedDiseaseQuery.trim(),
        limit: 16,
      }),
    [debouncedDiseaseQuery, deferredDiseaseQuery]
  );
  const searchAutocomplete = useMemo(() => searchResults.slice(0, 6), [searchResults]);
  const typoCorrectionSuggestion = useMemo(() => {
    if (!deferredDiseaseQuery.trim()) {
      return null;
    }

    const top = searchAutocomplete[0];
    if (!top) {
      return null;
    }

    return top.matchStrength === 'fuzzy' ? top : null;
  }, [deferredDiseaseQuery, searchAutocomplete]);
  const selectedSearchEntry = useMemo(() => {
    if (selectedSearchId) {
      return searchResults.find((result) => result.entry.id === selectedSearchId)?.entry ?? searchResults[0]?.entry ?? null;
    }
    return searchResults[0]?.entry ?? null;
  }, [searchResults, selectedSearchId]);

  const toggleQuickToken = (
    value: string,
    currentValue: string,
    setter: (next: string) => void
  ) => {
    const tokens = currentValue
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const exists = tokens.some((token) => token.toLowerCase() === value.toLowerCase());
    const next = exists
      ? tokens.filter((token) => token.toLowerCase() !== value.toLowerCase())
      : [...tokens, value];

    const normalized = next.join(', ');
    setter(!exists && normalized ? `${normalized}, ` : normalized);
  };

  const loadExample = (example: (typeof exampleCases)[number]) => {
    setMode('triage');
    setSymptomText(example.symptoms);
    setSignText(example.signs);
    setAgeValue(example.ageValue);
    setAgeUnit(example.ageUnit);
    setDurationValue(example.duration);
    setDurationUnit(example.durationUnit);
  };

  const clearTriageInputs = () => {
    setSymptomText('');
    setSignText('');
    setAgeValue('');
    setAgeUnit('years');
    setDurationValue('');
    setDurationUnit('days');
  };

  const clearSearch = () => {
    setDiseaseQuery('');
    setSelectedSearchId(null);
  };

  const ageIsRequired = mode === 'triage' && (!ageValue || !age);
  const ageInvalidButOptional = mode === 'search' && Boolean(ageValue) && !age;
  const durationInvalid = Boolean(durationValue) && durationDays === null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <LogoMark />
            <View style={styles.heroCopy}>
              <Text style={styles.kicker}>Offline STG Triage</Text>
              <Text style={styles.title}>Triage and disease lookup from the Ghana STG</Text>
              <Text style={styles.subtitle}>
                Switch between age-aware triage by symptoms/signs and direct disease-name search for
                fast STG confirmation.
              </Text>
            </View>
          </View>
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Offline-only</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Disease search</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Ghana STG based</Text>
            </View>
          </View>
        </View>

        <View style={styles.modeSwitch}>
          {modes.map((entry) => {
            const active = mode === entry.id;
            return (
              <Pressable
                key={entry.id}
                onPress={() => setMode(entry.id)}
                style={[styles.modeButton, active && styles.modeButtonActive]}
              >
                <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>
                  {entry.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.panel}>
          <Text style={styles.label}>Patient age</Text>
          <View style={styles.durationRow}>
            <TextInput
              value={ageValue}
              onChangeText={setAgeValue}
              keyboardType="numeric"
              style={styles.durationInput}
              placeholder="e.g. 40"
              placeholderTextColor="#7e7a72"
            />
            <View style={styles.segmented}>
              {ageUnits.map((unit) => {
                const active = ageUnit === unit;
                return (
                  <Pressable
                    key={unit}
                    onPress={() => setAgeUnit(unit)}
                    style={[styles.segment, active && styles.segmentActive]}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{unit}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Text style={styles.helperText}>
            {mode === 'triage'
              ? 'Age is required for triage because symptoms, signs, and treatment differ across age groups in the STG.'
              : 'Age is optional in disease search. If you add it, the app highlights the most relevant age-specific guidance.'}
          </Text>
          {ageIsRequired && <Text style={styles.validationText}>Enter a valid age greater than zero.</Text>}
          {ageInvalidButOptional && (
            <Text style={styles.validationText}>
              Enter a valid age if you want age-specific search highlighting.
            </Text>
          )}
        </View>

        {mode === 'triage' ? (
          <>
            <View style={styles.panel}>
              <Text style={styles.label}>Symptoms</Text>
              <TextInput
                multiline
                value={symptomText}
                onChangeText={setSymptomText}
                placeholder="e.g. fever, poor feeding, vomiting"
                placeholderTextColor="#7e7a72"
                style={styles.textArea}
              />
              <Text style={styles.helperText}>
                Symptoms are patient-reported or caregiver-reported complaints. Separate items with commas.
              </Text>
              <SuggestionStrip
                title="Suggested STG symptoms"
                suggestions={symptomSuggestions}
                onPick={(term) =>
                  setSymptomText((current) => replaceLastClinicalFragment(current, term))
                }
              />

              <Text style={styles.label}>Signs / examination findings</Text>
              <TextInput
                multiline
                value={signText}
                onChangeText={setSignText}
                placeholder="e.g. chest indrawing, bulging fontanelle, dry conjunctiva"
                placeholderTextColor="#7e7a72"
                style={styles.textArea}
              />
              <Text style={styles.helperText}>
                Signs are clinician-observed or examination findings from the STG. Separate items with commas.
              </Text>
              <SuggestionStrip
                title="Suggested STG signs"
                suggestions={signSuggestions}
                onPick={(term) =>
                  setSignText((current) => replaceLastClinicalFragment(current, term))
                }
              />

              <Text style={styles.label}>Quick symptom add</Text>
              <View style={styles.chips}>
                {quickSymptoms.map((symptom) => {
                  const active = symptomText.toLowerCase().includes(symptom.toLowerCase());
                  return (
                    <Pressable
                      key={symptom}
                      onPress={() => toggleQuickToken(symptom, symptomText, setSymptomText)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{symptom}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Quick sign add</Text>
              <View style={styles.chips}>
                {quickSigns.map((sign) => {
                  const active = signText.toLowerCase().includes(sign.toLowerCase());
                  return (
                    <Pressable
                      key={sign}
                      onPress={() => toggleQuickToken(sign, signText, setSignText)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{sign}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Duration of illness</Text>
              <View style={styles.durationRow}>
                <TextInput
                  value={durationValue}
                  onChangeText={setDurationValue}
                  keyboardType="numeric"
                  style={styles.durationInput}
                  placeholder="e.g. 3"
                  placeholderTextColor="#7e7a72"
                />
                <View style={styles.segmented}>
                  {durationUnits.map((unit) => {
                    const active = durationUnit === unit;
                    return (
                      <Pressable
                        key={unit}
                        onPress={() => setDurationUnit(unit)}
                        style={[styles.segment, active && styles.segmentActive]}
                      >
                        <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{unit}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              {durationInvalid && (
                <Text style={styles.validationText}>
                  Duration must be a whole number greater than zero.
                </Text>
              )}

              <Pressable onPress={clearTriageInputs} style={styles.clearAllButton}>
                <Text style={styles.clearAllButtonText}>Clear all</Text>
              </Pressable>

              <Text style={styles.label}>Example cases</Text>
              <View style={styles.examplesRow}>
                {exampleCases.map((example) => (
                  <Pressable
                    key={example.label}
                    onPress={() => loadExample(example)}
                    style={styles.exampleCard}
                  >
                    <Text style={styles.exampleTitle}>{example.label}</Text>
                    <Text style={styles.exampleText}>
                      {example.ageValue} {example.ageUnit} | Sx: {example.symptoms || 'none'} | Signs:{' '}
                      {example.signs || 'none'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.infoStrip}>
              <Text style={styles.infoHeadline}>Age-aware offline engine</Text>
              <Text style={styles.infoText}>
                {guidelineConditions.length} curated high-priority conditions use strict age-aware
                scoring, and {generatedCorpusCount} additional STG sections are searchable offline
                for broader review.
              </Text>
            </View>

            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>Possible STG matches</Text>
              <Text style={styles.resultsCaption}>
                These are guideline-based suggestions, not a confirmed diagnosis. Hallmark signs and
                exam findings matter.
              </Text>
            </View>

            {!!emergencySignals.length && (
              <View style={styles.globalAlert}>
                <Text style={styles.globalAlertTitle}>Urgent review suggested</Text>
                <Text style={styles.globalAlertText}>
                  The current age-specific pattern includes urgent features: {emergencySignals.join(', ')}.
                </Text>
              </View>
            )}

            {ageIsRequired ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Age is required</Text>
                <Text style={styles.emptyText}>
                  Add the patient&apos;s exact age in days, months, or years to generate age-aware STG
                  matches and treatment guidance.
                </Text>
              </View>
            ) : triageResults.length ? (
              <>
                {!likelyMatches.length && (
                  <View style={styles.globalAlert}>
                    <Text style={styles.globalAlertTitle}>More specific findings would help</Text>
                    <Text style={styles.globalAlertText}>
                      These findings are still non-specific in the STG. Add exam signs such as neck
                      stiffness, chest indrawing, sunken eyes, pallor, photophobia, bulging fontanelle,
                      or altered consciousness for a higher-confidence ranking.
                    </Text>
                  </View>
                )}

                {!!likelyMatches.length && (
                  <View style={styles.resultsHeader}>
                    <Text style={styles.resultsTitle}>Likely matches</Text>
                    <Text style={styles.resultsCaption}>
                      Higher-confidence STG matches based on the current evidence.
                    </Text>
                  </View>
                )}

                {[...likelyMatches, ...reviewMatches].map((result: MatchResult, index: number) => (
                  <View key={`${result.condition.id}-${result.ageBand.id}`} style={styles.card}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.rankBubble}>
                        <Text style={styles.rankText}>{index + 1}</Text>
                      </View>
                      <View style={styles.cardTitleWrap}>
                        <Text style={styles.cardTitle}>{result.condition.title}</Text>
                        <Text style={styles.cardCategory}>{result.condition.category}</Text>
                      </View>
                      <View
                        style={[
                          styles.confidenceBadge,
                          result.confidenceLabel === 'High'
                            ? styles.highBadge
                            : result.confidenceLabel === 'Moderate'
                              ? styles.moderateBadge
                              : styles.lowBadge,
                        ]}
                      >
                        <Text style={styles.confidenceText}>{result.confidenceLabel}</Text>
                      </View>
                    </View>

                    <Text style={styles.cardSummary}>{result.ageBand.summary}</Text>

                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Matched age group</Text>
                      <Text style={styles.metaValue}>{result.ageBand.label}</Text>
                    </View>

                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Treatment shown for</Text>
                      <Text style={styles.metaValue}>{result.ageBand.label}</Text>
                    </View>

                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Matched symptoms</Text>
                      <Text style={styles.metaValue}>
                        {result.matchedSymptoms.length
                          ? result.matchedSymptoms.join(', ')
                          : 'limited overlap'}
                      </Text>
                    </View>

                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Matched signs</Text>
                      <Text style={styles.metaValue}>
                        {result.matchedSigns.length ? result.matchedSigns.join(', ') : 'none yet'}
                      </Text>
                    </View>

                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Evidence quality</Text>
                      <Text style={styles.metaValue}>
                        {result.evidenceQuality}
                        {result.needsHallmarkFindings ? ' | needs hallmark findings' : ''}
                      </Text>
                    </View>

                    {!!result.missingHallmarks.length && (
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Hallmarks still missing</Text>
                        <Text style={styles.metaValue}>{result.missingHallmarks.join(', ')}</Text>
                      </View>
                    )}

                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Duration fit</Text>
                      <Text style={styles.metaValue}>
                        {result.durationFit}
                        {result.condition.duration ? ` (${result.condition.duration.label})` : ''}
                      </Text>
                    </View>

                    {!!result.ageBand.evidence.investigations.length && (
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Useful next checks</Text>
                        <Text style={styles.metaValue}>
                          {result.suggestedInvestigations.join(', ')}
                        </Text>
                      </View>
                    )}

                    {!!result.ageBand.evidence.redFlags.length && (
                      <View style={styles.alertBox}>
                        <Text style={styles.alertTitle}>
                          Urgent features to watch in this age group
                        </Text>
                        <Text style={styles.alertText}>
                          {result.ageBand.evidence.redFlags.join(', ')}
                        </Text>
                      </View>
                    )}

                    <Text style={styles.sectionTitle}>STG treatment options</Text>
                    {result.ageBand.treatment.map((item) => (
                      <View key={item.title} style={styles.treatmentRow}>
                        <Text style={styles.treatmentTitle}>{item.title}</Text>
                        <Text style={styles.treatmentText}>{item.details}</Text>
                      </View>
                    ))}

                    {!!result.ageBand.contraindicationsOrNotes?.length && (
                      <>
                        <Text style={styles.sectionTitle}>Age-specific notes</Text>
                        {result.ageBand.contraindicationsOrNotes.map((note) => (
                          <Text key={note} style={styles.noteText}>
                            - {note}
                          </Text>
                        ))}
                      </>
                    )}

                    {!!result.ageBand.source && (
                      <Text style={styles.sourceText}>
                        Source: {result.ageBand.source.section} | PDF pages {result.ageBand.source.pdfPages}
                      </Text>
                    )}
                  </View>
                ))}

                {!!relatedSections.length && (
                  <>
                    <View style={styles.resultsHeader}>
                      <Text style={styles.resultsTitle}>Other STG sections to review</Text>
                      <Text style={styles.resultsCaption}>
                        Broader offline matches from the extracted STG corpus. Use these when the
                        likely-match list is thin or you want to scan related guideline sections.
                      </Text>
                    </View>

                    {relatedSections.map((section) => (
                      <View key={section.id} style={styles.card}>
                        <Text style={styles.cardTitle}>{section.title}</Text>
                        <Text style={styles.cardCategory}>{section.category}</Text>

                        <View style={styles.metaRow}>
                          <Text style={styles.metaLabel}>Matched symptoms</Text>
                          <Text style={styles.metaValue}>
                            {section.matchedSymptoms.length
                              ? section.matchedSymptoms.join(', ')
                              : 'none'}
                          </Text>
                        </View>

                        <View style={styles.metaRow}>
                          <Text style={styles.metaLabel}>Matched signs</Text>
                          <Text style={styles.metaValue}>
                            {section.matchedSigns.length ? section.matchedSigns.join(', ') : 'none'}
                          </Text>
                        </View>

                        {!!section.investigations.length && (
                          <View style={styles.metaRow}>
                            <Text style={styles.metaLabel}>Useful next checks</Text>
                            <Text style={styles.metaValue}>{section.investigations.join(', ')}</Text>
                          </View>
                        )}

                        {!!section.diagnosticNotes.length && (
                          <Text style={styles.cardSummary}>{section.diagnosticNotes.join(' ')}</Text>
                        )}

                        <Text style={styles.sourceText}>
                          Source: {section.title} | PDF pages {section.pdfPages}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No age-appropriate matches yet</Text>
                <Text style={styles.emptyText}>
                  Add symptoms or signs with a valid age and duration to generate ranked STG suggestions.
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.panel}>
              <Text style={styles.label}>Search by disease or infection name</Text>
              <TextInput
                value={diseaseQuery}
                onChangeText={(value) => {
                  setDiseaseQuery(value);
                  if (!value.trim()) {
                    setSelectedSearchId(null);
                  }
                }}
                placeholder="e.g. meningitis, malaria, GORD, urinary tract infection"
                placeholderTextColor="#7e7a72"
                style={styles.searchInput}
              />
              <View style={styles.searchActions}>
                <Text style={styles.helperText}>
                  Search uses exact title matches first, then aliases and close spelling suggestions.
                </Text>
                <Pressable onPress={clearSearch} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Clear search</Text>
                </Pressable>
              </View>
              {!!typoCorrectionSuggestion && (
                <Pressable
                  onPress={() => {
                    setDiseaseQuery(typoCorrectionSuggestion.entry.title);
                    setSelectedSearchId(typoCorrectionSuggestion.entry.id);
                  }}
                  style={styles.didYouMeanBox}
                >
                  <Text style={styles.didYouMeanTitle}>Did you mean?</Text>
                  <Text style={styles.didYouMeanText}>
                    {typoCorrectionSuggestion.entry.title}
                  </Text>
                </Pressable>
              )}
              {!!diseaseQuery.trim() && (
                <DiseaseAutocomplete
                  suggestions={searchAutocomplete}
                  onPick={(result) => {
                    setDiseaseQuery(result.entry.title);
                    setSelectedSearchId(result.entry.id);
                  }}
                />
              )}
            </View>

            <View style={styles.infoStrip}>
              <Text style={styles.infoHeadline}>Full STG disease lookup</Text>
              <Text style={styles.infoText}>
                Search across {guidelineConditions.length} curated diagnostic entries and{' '}
                {generatedCorpusCount} broader STG sections. Search results open the structured
                guideline content directly in the app.
              </Text>
            </View>

            {!diseaseQuery.trim() ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Start typing a disease name</Text>
                <Text style={styles.emptyText}>
                  Search for any disease or condition by name to confirm its STG content, age guidance,
                  investigations, and treatment.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.resultsHeader}>
                  <Text style={styles.resultsTitle}>Search results</Text>
                  <Text style={styles.resultsCaption}>
                    Tap a result to open the full STG content for that condition.
                  </Text>
                </View>

                {searchResults.length ? (
                  searchResults.map((result: DiseaseSearchResult) => {
                    const selected = selectedSearchEntry?.id === result.entry.id;
                    return (
                      <Pressable
                        key={result.entry.id}
                        onPress={() => setSelectedSearchId(result.entry.id)}
                        style={[styles.searchResultCard, selected && styles.searchResultCardSelected]}
                      >
                        <View style={styles.searchResultTop}>
                          <View style={styles.cardTitleWrap}>
                            <Text style={styles.cardTitle}>{result.entry.title}</Text>
                            <Text style={styles.cardCategory}>{result.entry.category}</Text>
                          </View>
                          <View
                            style={[
                              styles.searchStrengthBadge,
                              result.matchStrength === 'exact' || result.matchStrength === 'alias'
                                ? styles.highBadge
                                : result.matchStrength === 'prefix' || result.matchStrength === 'token'
                                  ? styles.moderateBadge
                                  : styles.lowBadge,
                            ]}
                          >
                            <Text style={styles.confidenceText}>
                              {result.matchStrength === 'exact'
                                ? 'Exact'
                                : result.matchStrength === 'alias'
                                  ? 'Alias'
                                  : result.matchStrength === 'prefix'
                                    ? 'Prefix'
                                    : result.matchStrength === 'token'
                                      ? 'Token'
                                      : 'Fuzzy'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.helperText}>{result.matchReason}</Text>
                        <Text style={styles.sourceText}>PDF pages {result.entry.pdfPages}</Text>
                      </Pressable>
                    );
                  })
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No exact title found</Text>
                    <Text style={styles.emptyText}>
                      Try a shorter disease name, an STG abbreviation, or a broader condition term.
                    </Text>
                  </View>
                )}

                {!!selectedSearchEntry && (
                  <>
                    <View style={styles.resultsHeader}>
                      <Text style={styles.resultsTitle}>STG detail</Text>
                      <Text style={styles.resultsCaption}>
                        Full structured content for the selected disease or condition.
                      </Text>
                    </View>
                    <SearchDetail entry={selectedSearchEntry} age={age} />
                  </>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f2efe8',
  },
  container: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 16,
  },
  hero: {
    backgroundColor: '#1f4f46',
    borderRadius: 28,
    padding: 22,
  },
  heroTopRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  heroCopy: {
    flex: 1,
  },
  kicker: {
    color: '#bfe2cf',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  title: {
    color: '#f7f2e9',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    marginBottom: 10,
  },
  subtitle: {
    color: '#d7e8df',
    fontSize: 15,
    lineHeight: 22,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  heroBadge: {
    backgroundColor: 'rgba(255, 248, 233, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 233, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  heroBadgeText: {
    color: '#f0e7d7',
    fontWeight: '700',
    fontSize: 12,
  },
  logoShell: {
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoOuterRing: {
    width: 92,
    height: 92,
    borderRadius: 28,
    backgroundColor: '#f4ead6',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
  },
  logoCore: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#8b5e34',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoLetters: {
    color: '#fff7ed',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
  },
  logoSparkTop: {
    position: 'absolute',
    top: 8,
    width: 26,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#f0b45d',
  },
  logoSparkRight: {
    position: 'absolute',
    right: 8,
    width: 10,
    height: 26,
    borderRadius: 999,
    backgroundColor: '#f0b45d',
  },
  logoSparkBottom: {
    position: 'absolute',
    bottom: 8,
    width: 26,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#f0b45d',
  },
  logoSparkLeft: {
    position: 'absolute',
    left: 8,
    width: 10,
    height: 26,
    borderRadius: 999,
    backgroundColor: '#f0b45d',
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#ece4d7',
    borderRadius: 22,
    padding: 4,
    gap: 4,
  },
  modeButton: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#8b5e34',
  },
  modeButtonText: {
    color: '#4d453c',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  modeButtonTextActive: {
    color: '#fff8f0',
  },
  panel: {
    backgroundColor: '#fffaf2',
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  label: {
    color: '#39332c',
    fontSize: 14,
    fontWeight: '700',
  },
  helperText: {
    color: '#70665b',
    fontSize: 13,
    lineHeight: 18,
  },
  suggestionBox: {
    backgroundColor: '#f3ecdf',
    borderRadius: 18,
    padding: 12,
    gap: 10,
  },
  suggestionLabel: {
    color: '#4b433b',
    fontSize: 13,
    fontWeight: '700',
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#e2d6c4',
    gap: 3,
  },
  suggestionChipText: {
    color: '#2f2a24',
    fontSize: 13,
    fontWeight: '700',
  },
  suggestionHintText: {
    color: '#73685b',
    fontSize: 11,
    fontWeight: '600',
  },
  autocompleteList: {
    gap: 8,
  },
  autocompleteRow: {
    backgroundColor: '#e7dccb',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  autocompleteCopy: {
    flex: 1,
    gap: 2,
  },
  autocompleteTitle: {
    color: '#2f2a24',
    fontSize: 14,
    fontWeight: '800',
  },
  autocompleteMeta: {
    color: '#6f6559',
    fontSize: 12,
    lineHeight: 16,
  },
  autocompleteBadge: {
    backgroundColor: '#fff7ea',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  autocompleteBadgeText: {
    color: '#80572f',
    fontSize: 11,
    fontWeight: '800',
  },
  didYouMeanBox: {
    backgroundColor: '#f1e5cf',
    borderRadius: 18,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: '#dfc79d',
  },
  didYouMeanTitle: {
    color: '#8a5b2c',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  didYouMeanText: {
    color: '#2d261d',
    fontSize: 16,
    fontWeight: '800',
  },
  validationText: {
    color: '#9a3d2c',
    fontSize: 13,
    fontWeight: '600',
  },
  textArea: {
    minHeight: 110,
    borderRadius: 18,
    backgroundColor: '#efe8dc',
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#201c17',
    fontSize: 16,
    textAlignVertical: 'top',
  },
  searchInput: {
    borderRadius: 18,
    backgroundColor: '#efe8dc',
    paddingHorizontal: 14,
    paddingVertical: 16,
    color: '#201c17',
    fontSize: 16,
  },
  searchActions: {
    gap: 10,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#eadfd1',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#433b33',
    fontWeight: '700',
  },
  clearAllButton: {
    backgroundColor: '#8b5e34',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearAllButtonText: {
    color: '#fff8f0',
    fontWeight: '800',
    fontSize: 15,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#ece4d7',
  },
  chipActive: {
    backgroundColor: '#1f4f46',
  },
  chipText: {
    color: '#49423b',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#f6f1e8',
  },
  durationRow: {
    gap: 12,
  },
  durationInput: {
    backgroundColor: '#efe8dc',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#201c17',
    fontSize: 16,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#ece4d7',
    borderRadius: 18,
    padding: 4,
  },
  segment: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#8b5e34',
  },
  segmentText: {
    color: '#5c544c',
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  segmentTextActive: {
    color: '#fff8f0',
  },
  examplesRow: {
    gap: 10,
  },
  exampleCard: {
    backgroundColor: '#efe8dc',
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  exampleTitle: {
    color: '#2b241d',
    fontWeight: '800',
    fontSize: 14,
  },
  exampleText: {
    color: '#60574e',
    lineHeight: 19,
    fontSize: 13,
  },
  infoStrip: {
    backgroundColor: '#d7e8df',
    borderRadius: 22,
    padding: 18,
  },
  infoHeadline: {
    color: '#1d463e',
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 4,
  },
  infoText: {
    color: '#315e56',
    lineHeight: 20,
  },
  resultsHeader: {
    gap: 4,
  },
  resultsTitle: {
    color: '#211d18',
    fontSize: 24,
    fontWeight: '800',
  },
  resultsCaption: {
    color: '#625950',
    fontSize: 14,
  },
  globalAlert: {
    backgroundColor: '#8b2f1f',
    borderRadius: 24,
    padding: 18,
    gap: 4,
  },
  globalAlertTitle: {
    color: '#fff4ed',
    fontSize: 16,
    fontWeight: '800',
  },
  globalAlertText: {
    color: '#f7ddd4',
    lineHeight: 20,
  },
  emptyState: {
    backgroundColor: '#fffaf2',
    borderRadius: 24,
    padding: 22,
    gap: 6,
    borderWidth: 1,
    borderColor: '#eadfce',
  },
  emptyTitle: {
    color: '#2e271f',
    fontWeight: '800',
    fontSize: 18,
  },
  emptyText: {
    color: '#625950',
    lineHeight: 21,
  },
  card: {
    backgroundColor: '#fffaf2',
    borderRadius: 24,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: '#eadfce',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rankBubble: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#eadfd1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: '#503d2b',
    fontWeight: '800',
  },
  cardTitleWrap: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    color: '#241f19',
    fontWeight: '800',
    fontSize: 18,
  },
  cardCategory: {
    color: '#756d64',
    fontSize: 13,
    fontWeight: '600',
  },
  confidenceBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchStrengthBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  highBadge: {
    backgroundColor: '#d7e8df',
  },
  moderateBadge: {
    backgroundColor: '#efe2ba',
  },
  lowBadge: {
    backgroundColor: '#edd8cf',
  },
  confidenceText: {
    color: '#3b332b',
    fontWeight: '700',
    fontSize: 12,
  },
  cardSummary: {
    color: '#4f473f',
    lineHeight: 21,
  },
  metaRow: {
    gap: 2,
  },
  metaLabel: {
    color: '#6c6359',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metaValue: {
    color: '#28231d',
    lineHeight: 20,
  },
  alertBox: {
    backgroundColor: '#f8eee6',
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  alertTitle: {
    color: '#7a3929',
    fontWeight: '800',
  },
  alertText: {
    color: '#7a3929',
    lineHeight: 20,
  },
  sectionGroup: {
    gap: 6,
  },
  sectionTitle: {
    color: '#2f281f',
    fontWeight: '800',
    fontSize: 15,
  },
  treatmentRow: {
    gap: 4,
  },
  treatmentTitle: {
    color: '#352d24',
    fontWeight: '800',
  },
  treatmentText: {
    color: '#564d43',
    lineHeight: 20,
  },
  noteText: {
    color: '#5e554b',
    lineHeight: 20,
  },
  sourceText: {
    color: '#73695f',
    fontSize: 12,
    fontWeight: '600',
  },
  searchResultCard: {
    backgroundColor: '#fffaf2',
    borderRadius: 22,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#eadfce',
  },
  searchResultCardSelected: {
    borderColor: '#8b5e34',
    backgroundColor: '#fff3e3',
  },
  searchResultTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  searchDetailHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  detailPageBadge: {
    backgroundColor: '#ece4d7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  detailPageText: {
    color: '#4f473f',
    fontWeight: '700',
    fontSize: 12,
  },
  ageBandCard: {
    backgroundColor: '#f8f2e8',
    borderRadius: 18,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#eadfce',
  },
  highlightAgeBandCard: {
    borderColor: '#1f4f46',
    backgroundColor: '#edf5f1',
  },
  ageBandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'center',
  },
  ageBandTitle: {
    color: '#2f281f',
    fontWeight: '800',
    fontSize: 16,
    flex: 1,
  },
  matchChip: {
    backgroundColor: '#1f4f46',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  matchChipText: {
    color: '#f6f1e8',
    fontSize: 12,
    fontWeight: '700',
  },
});
