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
  signVocabulary,
  symptomVocabulary,
} from './src/data/conditions';
import { triageBuckets, TriageBucket } from './src/data/triageBuckets';
import { getClinicalSuggestions, replaceLastClinicalFragment } from './src/lib/clinical-input';
import {
  detectEmergencySignals,
  formatAgeToNormalized,
  formatDurationToDays,
  getMatches,
} from './src/lib/matcher';
import { getApplicableAgeBand, searchDiseases } from './src/lib/search';
import { AgeUnit, DiseaseSearchResult, GuidedTriageContext, SearchableAgeBand, SearchableStgEntry } from './src/types';

const durationUnits = ['days', 'weeks', 'months'] as const;
const ageUnits: AgeUnit[] = ['days', 'months', 'years'];
const modes = [
  { id: 'triage', label: 'Guided triage' },
  { id: 'search', label: 'STG reference' },
] as const;

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
  const sourceLabel =
    entry.triageMode === 'ranked' ? 'Ranked by guided triage' : 'Reference-only STG section';

  return (
    <View style={styles.card}>
      <View style={styles.searchDetailHeader}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle}>{entry.title}</Text>
          <Text style={styles.cardCategory}>{entry.category}</Text>
        </View>
        <View style={styles.searchDetailBadges}>
          <View
            style={[
              styles.referenceTypeBadge,
              entry.triageMode === 'ranked' ? styles.curatedTypeBadge : styles.referenceTypeMutedBadge,
            ]}
          >
            <Text
              style={[
                styles.referenceTypeText,
                entry.triageMode === 'ranked'
                  ? styles.curatedTypeText
                  : styles.referenceTypeMutedText,
              ]}
            >
              {sourceLabel}
            </Text>
          </View>
          <View style={styles.detailPageBadge}>
            <Text style={styles.detailPageText}>PDF {entry.pdfPages}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.helperText}>
        {entry.triageMode === 'ranked'
          ? 'This section is part of the curated guided triage layer, so it can be ranked and read directly here.'
          : 'This section stays in the wider STG reference corpus. It is searchable and readable here, but it is not used as a ranked triage answer.'}
      </Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>STG chapter</Text>
        <Text style={styles.metaValue}>
          Chapter {entry.chapterIndex}: {entry.chapterTitle}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Triage status</Text>
        <Text style={styles.metaValue}>{entry.triageReason}</Text>
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
  const [selectedBucketId, setSelectedBucketId] = useState<TriageBucket['id'] | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedSigns, setSelectedSigns] = useState<string[]>([]);
  const [showManualSymptoms, setShowManualSymptoms] = useState(false);
  const [showManualSigns, setShowManualSigns] = useState(false);
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
  const activeBucket = useMemo(
    () => triageBuckets.find((bucket) => bucket.id === selectedBucketId) ?? null,
    [selectedBucketId]
  );
  const guidedContext = useMemo<GuidedTriageContext>(
    () => ({
      selectedSymptoms,
      selectedSigns,
      preferredConditionIds: activeBucket?.preferredConditionIds ?? [],
    }),
    [activeBucket, selectedSigns, selectedSymptoms]
  );
  const age = useMemo(() => formatAgeToNormalized(ageValue, ageUnit), [ageUnit, ageValue]);
  const durationDays = useMemo(
    () => formatDurationToDays(durationValue, durationUnit),
    [durationUnit, durationValue]
  );
  const symptomSuggestions = useMemo(
    () =>
      showManualSymptoms
        ? getClinicalSuggestions(deferredSymptomText, symptomVocabulary, 6, {
            allowFuzzy: deferredSymptomText.trim() === debouncedSymptomText.trim(),
          })
            .filter((entry) => entry.reason !== 'exact')
            .slice(0, 6)
        : [],
    [debouncedSymptomText, deferredSymptomText, showManualSymptoms]
  );
  const signSuggestions = useMemo(
    () =>
      showManualSigns
        ? getClinicalSuggestions(deferredSignText, signVocabulary, 6, {
            allowFuzzy: deferredSignText.trim() === debouncedSignText.trim(),
          })
            .filter((entry) => entry.reason !== 'exact')
            .slice(0, 6)
        : [],
    [debouncedSignText, deferredSignText, showManualSigns]
  );

  const triageResults = useMemo(
    () =>
      getMatches(
        showManualSymptoms ? deferredSymptomText : '',
        showManualSigns ? deferredSignText : '',
        durationDays,
        age,
        guidedContext
      ),
    [
      age,
      deferredSignText,
      deferredSymptomText,
      durationDays,
      guidedContext,
      showManualSigns,
      showManualSymptoms,
    ]
  );
  const primaryResult = triageResults[0] ?? null;
  const alternatives = useMemo(() => {
    if (!primaryResult || !primaryResult.allowAlternatives) {
      return [];
    }

    return triageResults
      .slice(1)
      .filter(
        (result) =>
          result.allowAlternatives &&
          result.confidenceGateStatus === 'reliable' &&
          result.score >= primaryResult.score - 1.35
      )
      .slice(0, 2);
  }, [primaryResult, triageResults]);
  const emergencySignals = useMemo(
    () => (primaryResult ? detectEmergencySignals([primaryResult]) : []),
    [primaryResult]
  );
  const triageHasInputs =
    selectedSymptoms.length > 0 ||
    selectedSigns.length > 0 ||
    Boolean(symptomText.trim()) ||
    Boolean(signText.trim());
  const triageNeedsMoreEvidence =
    Boolean(primaryResult) && primaryResult.confidenceGateStatus !== 'reliable';
  const triageCanShowResult = Boolean(primaryResult) && !triageNeedsMoreEvidence;
  const manualHelperVisible = showManualSymptoms || showManualSigns;

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

  const selectBucket = (bucketId: TriageBucket['id']) => {
    setSelectedBucketId(bucketId);
    setSelectedSymptoms([]);
    setSelectedSigns([]);
    setSymptomText('');
    setSignText('');
    setShowManualSymptoms(false);
    setShowManualSigns(false);
  };

  const toggleStructuredTerm = (
    value: string,
    currentValues: string[],
    setter: (next: string[]) => void
  ) => {
    const exists = currentValues.some((item) => item.toLowerCase() === value.toLowerCase());
    setter(
      exists
        ? currentValues.filter((item) => item.toLowerCase() !== value.toLowerCase())
        : [...currentValues, value]
    );
  };

  const clearTriageInputs = () => {
    setSelectedBucketId(null);
    setSelectedSymptoms([]);
    setSelectedSigns([]);
    setShowManualSymptoms(false);
    setShowManualSigns(false);
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
        <View style={styles.compactIntro}>
          <View style={styles.compactIntroTop}>
            <LogoMark />
            <View style={styles.compactIntroCopy}>
              <Text style={styles.kicker}>Offline Ghana STG 2017</Text>
              <Text style={styles.compactIntroTitle}>Simpler guided triage first</Text>
              <Text style={styles.compactIntroText}>
                Use guided triage when you need one careful STG answer, then switch to STG reference
                when you already know the condition and want the section content.
              </Text>
            </View>
          </View>
          <View style={styles.compactIntroBadges}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Triage-first</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Reference lookup</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Offline-only</Text>
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

        {mode === 'triage' ? (
          <>
            <View style={styles.panel}>
              <Text style={styles.stepLabel}>Step 1</Text>
              <Text style={styles.sectionTitle}>Age and duration</Text>
              <Text style={styles.helperText}>
                Guided triage stays age-aware and duration-aware because the STG changes both
                diagnostic meaning and treatment by age group and timeline.
              </Text>

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
                        <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                          {unit}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              {ageIsRequired && (
                <Text style={styles.validationText}>Enter a valid age greater than zero.</Text>
              )}

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
                        <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                          {unit}
                        </Text>
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
            </View>

            <View style={styles.panel}>
              <Text style={styles.stepLabel}>Step 2</Text>
              <Text style={styles.sectionTitle}>Choose the main STG pathway</Text>
              <Text style={styles.helperText}>
                Start with the dominant syndrome so the app narrows ranking to the most relevant
                curated STG conditions instead of guessing broadly.
              </Text>
              <View style={styles.bucketGrid}>
                {triageBuckets.map((bucket) => {
                  const active = selectedBucketId === bucket.id;
                  return (
                    <Pressable
                      key={bucket.id}
                      onPress={() => selectBucket(bucket.id)}
                      style={[styles.bucketCard, active && styles.bucketCardActive]}
                    >
                      <Text style={[styles.bucketTitle, active && styles.bucketTitleActive]}>
                        {bucket.label}
                      </Text>
                      <Text style={[styles.bucketHelper, active && styles.bucketHelperActive]}>
                        {bucket.helperText}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {!!activeBucket && (
              <View style={styles.panel}>
                <Text style={styles.stepLabel}>Step 3</Text>
                <Text style={styles.sectionTitle}>Add the most relevant findings</Text>
                <Text style={styles.helperText}>{activeBucket.helperText}</Text>

                <View style={styles.selectionHeader}>
                  <Text style={styles.label}>Patient-reported symptoms</Text>
                  <Text style={styles.selectionCount}>{selectedSymptoms.length} selected</Text>
                </View>
                <View style={styles.chips}>
                  {activeBucket.symptomOptions.map((symptom) => {
                    const active = selectedSymptoms.includes(symptom);
                    return (
                      <Pressable
                        key={symptom}
                        onPress={() =>
                          toggleStructuredTerm(symptom, selectedSymptoms, setSelectedSymptoms)
                        }
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {symptom}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.selectionHeader}>
                  <Text style={styles.label}>Observed signs / examination findings</Text>
                  <Text style={styles.selectionCount}>{selectedSigns.length} selected</Text>
                </View>
                <View style={styles.chips}>
                  {activeBucket.signOptions.map((sign) => {
                    const active = selectedSigns.includes(sign);
                    return (
                      <Pressable
                        key={sign}
                        onPress={() => toggleStructuredTerm(sign, selectedSigns, setSelectedSigns)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {sign}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.manualActionsRow}>
                  <Pressable
                    onPress={() => setShowManualSymptoms((current) => !current)}
                    style={[
                      styles.secondaryButton,
                      showManualSymptoms && styles.secondaryButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.secondaryButtonText,
                        showManualSymptoms && styles.secondaryButtonTextActive,
                      ]}
                    >
                      {showManualSymptoms ? 'Hide' : 'Add'} manual symptoms
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowManualSigns((current) => !current)}
                    style={[
                      styles.secondaryButton,
                      showManualSigns && styles.secondaryButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.secondaryButtonText,
                        showManualSigns && styles.secondaryButtonTextActive,
                      ]}
                    >
                      {showManualSigns ? 'Hide' : 'Add'} manual signs
                    </Text>
                  </Pressable>
                </View>

                {manualHelperVisible && (
                  <Text style={styles.helperText}>
                    Manual entry is fallback only. Structured STG selections are weighted more
                    strongly than free text in guided triage.
                  </Text>
                )}

                {showManualSymptoms && (
                  <>
                    <Text style={styles.label}>Manual symptom entry</Text>
                    <TextInput
                      multiline
                      value={symptomText}
                      onChangeText={setSymptomText}
                      placeholder="Optional fallback, e.g. fever, vomiting"
                      placeholderTextColor="#7e7a72"
                      style={styles.textArea}
                    />
                    <SuggestionStrip
                      title="Suggested STG symptoms"
                      suggestions={symptomSuggestions}
                      onPick={(term) =>
                        setSymptomText((current) => replaceLastClinicalFragment(current, term))
                      }
                    />
                  </>
                )}

                {showManualSigns && (
                  <>
                    <Text style={styles.label}>Manual sign entry</Text>
                    <TextInput
                      multiline
                      value={signText}
                      onChangeText={setSignText}
                      placeholder="Optional fallback, e.g. neck stiffness, sunken eyes"
                      placeholderTextColor="#7e7a72"
                      style={styles.textArea}
                    />
                    <SuggestionStrip
                      title="Suggested STG signs"
                      suggestions={signSuggestions}
                      onPick={(term) =>
                        setSignText((current) => replaceLastClinicalFragment(current, term))
                      }
                    />
                  </>
                )}

                <Pressable onPress={clearTriageInputs} style={styles.clearAllButton}>
                  <Text style={styles.clearAllButtonText}>Clear guided triage</Text>
                </Pressable>
              </View>
            )}

            {!age ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Age is required</Text>
                <Text style={styles.emptyText}>
                  Add the patient&apos;s exact age in days, months, or years before guided triage
                  can produce an STG answer.
                </Text>
              </View>
            ) : !selectedBucketId ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Choose one main clinical pathway</Text>
                <Text style={styles.emptyText}>
                  Start with the dominant syndrome so the app can limit ranking to the right
                  curated STG pathway instead of spreading across everything at once.
                </Text>
              </View>
            ) : !triageHasInputs ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Select findings from the chosen pathway</Text>
                <Text style={styles.emptyText}>
                  Choose the most relevant symptoms and signs first. Add manual terms only if the
                  structured checklist does not cover the case well enough.
                </Text>
              </View>
            ) : triageCanShowResult && primaryResult ? (
              <>
                <View style={styles.resultsHeader}>
                  <Text style={styles.resultsTitle}>Most likely STG match</Text>
                  <Text style={styles.resultsCaption}>
                    Guided triage now shows one primary answer first. Alternatives appear only when
                    they remain very close after structured STG weighting.
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

                <View style={styles.card}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.primaryMatchBadge}>
                      <Text style={styles.primaryMatchBadgeText}>Primary</Text>
                    </View>
                    <View style={styles.cardTitleWrap}>
                      <Text style={styles.cardTitle}>{primaryResult.condition.title}</Text>
                      <Text style={styles.cardCategory}>{primaryResult.condition.category}</Text>
                    </View>
                    <View
                      style={[
                        styles.confidenceBadge,
                        primaryResult.confidenceLabel === 'High'
                          ? styles.highBadge
                          : styles.moderateBadge,
                      ]}
                    >
                      <Text style={styles.confidenceText}>{primaryResult.confidenceLabel}</Text>
                    </View>
                  </View>

                  <Text style={styles.cardSummary}>{primaryResult.ageBand.summary}</Text>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Why this matches</Text>
                    <Text style={styles.metaValue}>
                      Symptoms: {primaryResult.matchedSymptoms.length ? primaryResult.matchedSymptoms.join(', ') : 'limited overlap'}{'\n'}
                      Signs: {primaryResult.matchedSigns.length ? primaryResult.matchedSigns.join(', ') : 'limited overlap'}
                    </Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Matched age group</Text>
                    <Text style={styles.metaValue}>{primaryResult.ageBand.label}</Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Key findings still missing</Text>
                    <Text style={styles.metaValue}>
                      {primaryResult.missingHallmarks.length
                        ? primaryResult.missingHallmarks.join(', ')
                        : 'none highlighted'}
                    </Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Useful next checks</Text>
                    <Text style={styles.metaValue}>
                      {primaryResult.suggestedInvestigations.length
                        ? primaryResult.suggestedInvestigations.join(', ')
                        : 'none listed'}
                    </Text>
                  </View>

                  {!!primaryResult.ageBand.evidence.redFlags.length && (
                    <View style={styles.alertBox}>
                      <Text style={styles.alertTitle}>Urgent features to watch</Text>
                      <Text style={styles.alertText}>
                        {primaryResult.ageBand.evidence.redFlags.join(', ')}
                      </Text>
                    </View>
                  )}

                  <Text style={styles.sectionTitle}>Age-specific treatment</Text>
                  {primaryResult.ageBand.treatment.map((item) => (
                    <View key={item.title} style={styles.treatmentRow}>
                      <Text style={styles.treatmentTitle}>{item.title}</Text>
                      <Text style={styles.treatmentText}>{item.details}</Text>
                    </View>
                  ))}

                  {!!primaryResult.ageBand.contraindicationsOrNotes?.length && (
                    <>
                      <Text style={styles.sectionTitle}>Notes</Text>
                      {primaryResult.ageBand.contraindicationsOrNotes.map((note) => (
                        <Text key={note} style={styles.noteText}>
                          - {note}
                        </Text>
                      ))}
                    </>
                  )}

                  {!!primaryResult.ageBand.source && (
                    <Text style={styles.sourceText}>
                      Source: {primaryResult.ageBand.source.section} | PDF pages{' '}
                      {primaryResult.ageBand.source.pdfPages}
                    </Text>
                  )}
                </View>

                {!!alternatives.length && (
                  <View style={styles.panel}>
                    <Text style={styles.sectionTitle}>Other close STG matches</Text>
                    <Text style={styles.helperText}>
                      These remain visible only because their evidence is genuinely close to the
                      primary answer.
                    </Text>
                    {alternatives.map((result) => (
                      <View key={`${result.condition.id}-${result.ageBand.id}`} style={styles.altResultRow}>
                        <View style={styles.altResultCopy}>
                          <Text style={styles.altResultTitle}>{result.condition.title}</Text>
                          <Text style={styles.altResultText}>
                            {result.matchedSymptoms.concat(result.matchedSigns).slice(0, 4).join(', ')}
                          </Text>
                        </View>
                        <Text style={styles.altResultBadge}>{result.confidenceLabel}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Insufficient STG evidence for a reliable answer</Text>
                <Text style={styles.emptyText}>
                  {primaryResult
                    ? `Current best fit is ${primaryResult.condition.title}, but the evidence is still too weak or too generic. Add more specific signs or hallmark findings from the selected pathway.`
                    : 'Add more pathway-specific symptoms or signs before the app tries to give a primary STG answer.'}
                </Text>
                {!!primaryResult?.missingHallmarks.length && (
                  <Text style={styles.helperText}>
                    Most helpful next findings: {primaryResult.missingHallmarks.join(', ')}
                  </Text>
                )}
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.panel}>
              <Text style={styles.stepLabel}>Reference</Text>
              <Text style={styles.label}>Search by disease or infection name</Text>
              <Text style={styles.helperText}>
                Search is for confirmation and lookup. It searches the wider STG corpus by disease
                name without trying to rank a diagnosis from free text.
              </Text>
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

            <View style={styles.panel}>
              <Text style={styles.label}>Optional age highlight</Text>
              <View style={styles.durationRow}>
                <TextInput
                  value={ageValue}
                  onChangeText={setAgeValue}
                  keyboardType="numeric"
                  style={styles.durationInput}
                  placeholder="e.g. 2"
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
                        <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                          {unit}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <Text style={styles.helperText}>
                Age is optional in STG reference. If you add it, the matching age-specific band is
                highlighted first inside the selected section.
              </Text>
              {ageInvalidButOptional && (
                <Text style={styles.validationText}>
                  Enter a valid age if you want age-specific search highlighting.
                </Text>
              )}
            </View>

            <View style={styles.infoStrip}>
              <Text style={styles.infoHeadline}>Reference mode stays separate from triage</Text>
              <Text style={styles.infoText}>
                Curated entries are trusted for ranked guided triage. Generated reference-only STG
                sections remain searchable here for confirmation and reading, but they do not drive
                the primary triage answer.
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
                        <View style={styles.searchMetaRow}>
                          <View
                            style={[
                              styles.referenceTypeBadge,
                              result.entry.triageMode === 'ranked'
                                ? styles.curatedTypeBadge
                                : styles.referenceTypeMutedBadge,
                            ]}
                          >
                            <Text
                              style={[
                                styles.referenceTypeText,
                                result.entry.triageMode === 'ranked'
                                  ? styles.curatedTypeText
                                  : styles.referenceTypeMutedText,
                              ]}
                            >
                              {result.entry.triageMode === 'ranked'
                                ? 'Ranked by triage'
                                : 'Reference only'}
                            </Text>
                          </View>
                          <Text style={styles.sourceText}>PDF pages {result.entry.pdfPages}</Text>
                        </View>
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
  compactIntro: {
    backgroundColor: '#1f4f46',
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  compactIntroTop: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  compactIntroCopy: {
    flex: 1,
    gap: 6,
  },
  compactIntroTitle: {
    color: '#f7f2e9',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  compactIntroText: {
    color: '#d7e8df',
    fontSize: 14,
    lineHeight: 20,
  },
  compactIntroBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  stepLabel: {
    color: '#8b5e34',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
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
  secondaryButtonActive: {
    backgroundColor: '#1f4f46',
  },
  secondaryButtonText: {
    color: '#433b33',
    fontWeight: '700',
  },
  secondaryButtonTextActive: {
    color: '#f6f1e8',
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
  bucketGrid: {
    gap: 10,
  },
  bucketCard: {
    borderRadius: 18,
    backgroundColor: '#efe8dc',
    borderWidth: 1,
    borderColor: '#e1d6c8',
    padding: 14,
    gap: 4,
  },
  bucketCardActive: {
    backgroundColor: '#edf5f1',
    borderColor: '#1f4f46',
  },
  bucketTitle: {
    color: '#2f281f',
    fontWeight: '800',
    fontSize: 15,
  },
  bucketTitleActive: {
    color: '#173e37',
  },
  bucketHelper: {
    color: '#6c6258',
    fontSize: 13,
    lineHeight: 18,
  },
  bucketHelperActive: {
    color: '#315e56',
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'center',
  },
  selectionCount: {
    color: '#756a5e',
    fontSize: 12,
    fontWeight: '700',
  },
  manualActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
  primaryMatchBadge: {
    backgroundColor: '#1f4f46',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  primaryMatchBadgeText: {
    color: '#f6f1e8',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  searchMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchDetailHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  searchDetailBadges: {
    gap: 8,
    alignItems: 'flex-end',
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
  referenceTypeBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  curatedTypeBadge: {
    backgroundColor: '#d7e8df',
  },
  referenceTypeMutedBadge: {
    backgroundColor: '#efe8dc',
  },
  referenceTypeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  curatedTypeText: {
    color: '#245048',
  },
  referenceTypeMutedText: {
    color: '#6b6258',
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
  altResultRow: {
    backgroundColor: '#f6efe4',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  altResultCopy: {
    flex: 1,
    gap: 3,
  },
  altResultTitle: {
    color: '#2e271f',
    fontSize: 15,
    fontWeight: '800',
  },
  altResultText: {
    color: '#655c52',
    fontSize: 13,
    lineHeight: 18,
  },
  altResultBadge: {
    color: '#6b5133',
    fontSize: 12,
    fontWeight: '800',
  },
});
