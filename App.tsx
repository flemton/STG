import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { guidelineConditions } from './src/data/conditions';
import { detectEmergencySignals, formatDurationToDays, getMatches } from './src/lib/matcher';
import { MatchResult, TreatmentLine } from './src/types';

const quickSymptoms = [
  'Fever',
  'Headache',
  'Chills',
  'Cough',
  'Chest pain',
  'Breathlessness',
  'Wheeze',
  'Vomiting',
  'Diarrhoea',
  'Abdominal pain',
  'Painful urination',
  'Frequent urination',
  'Heartburn',
  'Neck stiffness',
  'Confusion',
];

const durationUnits = ['days', 'weeks', 'months'] as const;
const exampleCases = [
  { label: 'Malaria-like', symptoms: 'fever, chills, headache, body aches, vomiting', duration: '3', unit: 'days' as const },
  { label: 'UTI-like', symptoms: 'painful urination, frequent urination, suprapubic pain, fever', duration: '4', unit: 'days' as const },
  { label: 'Meningitis-like', symptoms: 'fever, severe headache, neck stiffness, vomiting, confusion', duration: '2', unit: 'days' as const },
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

export default function App() {
  const [symptomText, setSymptomText] = useState('fever, headache, chills, body pains');
  const [durationValue, setDurationValue] = useState('3');
  const [durationUnit, setDurationUnit] = useState<(typeof durationUnits)[number]>('days');

  const durationDays = useMemo(
    () => formatDurationToDays(durationValue, durationUnit),
    [durationUnit, durationValue]
  );

  const results = useMemo(() => getMatches(symptomText, durationDays), [durationDays, symptomText]);
  const emergencySignals = useMemo(() => detectEmergencySignals(results), [results]);

  const toggleQuickSymptom = (symptom: string) => {
    const tokens = symptomText
      .split(',')
      .map((item: string) => item.trim())
      .filter(Boolean);

    const exists = tokens.some((token) => token.toLowerCase() === symptom.toLowerCase());
    const next = exists
      ? tokens.filter((token: string) => token.toLowerCase() !== symptom.toLowerCase())
      : [...tokens, symptom];

    setSymptomText(next.join(', '));
  };

  const loadExample = (symptoms: string, duration: string, unit: (typeof durationUnits)[number]) => {
    setSymptomText(symptoms);
    setDurationValue(duration);
    setDurationUnit(unit);
  };

  const clearInputs = () => {
    setSymptomText('');
    setDurationValue('');
    setDurationUnit('days');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <LogoMark />
            <View style={styles.heroCopy}>
              <Text style={styles.kicker}>Offline STG Triage</Text>
              <Text style={styles.title}>Possible diagnoses from Ghana STG 2017</Text>
              <Text style={styles.subtitle}>
                Enter symptoms and duration. Matches come only from the local Standard Treatment
                Guidelines dataset curated from the attached PDF.
              </Text>
            </View>
          </View>
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Local-only</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Fast triage hints</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Ghana STG based</Text>
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.label}>Signs and symptoms</Text>
          <TextInput
            multiline
            value={symptomText}
            onChangeText={setSymptomText}
            placeholder="e.g. fever, cough, breathlessness, chest pain"
            placeholderTextColor="#7e7a72"
            style={styles.textArea}
          />
          <View style={styles.actionsRow}>
            <Text style={styles.helperText}>Use commas, for example: fever, cough, breathlessness</Text>
            <Pressable onPress={clearInputs} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Quick add</Text>
          <View style={styles.chips}>
            {quickSymptoms.map((symptom) => {
              const active = symptomText.toLowerCase().includes(symptom.toLowerCase());
              return (
                <Pressable
                  key={symptom}
                  onPress={() => toggleQuickSymptom(symptom)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{symptom}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Duration</Text>
          <View style={styles.durationRow}>
            <TextInput
              value={durationValue}
              onChangeText={setDurationValue}
              keyboardType="numeric"
              style={styles.durationInput}
              placeholder="3"
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

          <Text style={styles.label}>Example cases</Text>
          <View style={styles.examplesRow}>
            {exampleCases.map((example) => (
              <Pressable
                key={example.label}
                onPress={() => loadExample(example.symptoms, example.duration, example.unit)}
                style={styles.exampleCard}
              >
                <Text style={styles.exampleTitle}>{example.label}</Text>
                <Text style={styles.exampleText}>{example.symptoms}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.infoStrip}>
          <Text style={styles.infoHeadline}>Fast local matching</Text>
          <Text style={styles.infoText}>
            {guidelineConditions.length} curated guideline conditions. No auth, no API calls, all
            ranking happens on-device.
          </Text>
        </View>

        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>Possible matches</Text>
          <Text style={styles.resultsCaption}>
            These are guideline-based suggestions, not a confirmed diagnosis.
          </Text>
        </View>

        {!!emergencySignals.length && (
          <View style={styles.globalAlert}>
            <Text style={styles.globalAlertTitle}>Urgent review suggested</Text>
            <Text style={styles.globalAlertText}>
              The current symptom pattern includes urgent features: {emergencySignals.join(', ')}.
            </Text>
          </View>
        )}

        {results.length ? (
          results.map((result: MatchResult, index: number) => (
            <View key={result.condition.id} style={styles.card}>
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

              <Text style={styles.cardSummary}>{result.condition.summary}</Text>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Matched:</Text>
                <Text style={styles.metaValue}>
                  {result.matchedSymptoms.length ? result.matchedSymptoms.join(', ') : 'limited overlap'}
                </Text>
              </View>

              {!!result.missingHallmarks.length && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Not yet seen:</Text>
                  <Text style={styles.metaValue}>{result.missingHallmarks.join(', ')}</Text>
                </View>
              )}

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Duration fit:</Text>
                <Text style={styles.metaValue}>
                  {result.durationFit} ({result.condition.duration.label})
                </Text>
              </View>

              {!!result.condition.redFlags.length && (
                <View style={styles.alertBox}>
                  <Text style={styles.alertTitle}>Urgent features to watch</Text>
                  <Text style={styles.alertText}>{result.condition.redFlags.join(', ')}</Text>
                </View>
              )}

              <Text style={styles.sectionTitle}>STG treatment options</Text>
              {result.condition.treatment.map((item: TreatmentLine) => (
                <View key={item.title} style={styles.treatmentRow}>
                  <Text style={styles.treatmentTitle}>{item.title}</Text>
                  <Text style={styles.treatmentText}>{item.details}</Text>
                </View>
              ))}

              <Text style={styles.sourceText}>
                Source: {result.condition.source.section} | PDF pages {result.condition.source.pdfPages}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No matches yet</Text>
            <Text style={styles.emptyText}>
              Enter symptoms separated by commas and add a duration to generate ranked guideline
              suggestions.
            </Text>
          </View>
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
    fontSize: 30,
    lineHeight: 36,
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
    shadowColor: '#091f1a',
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
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
  textArea: {
    minHeight: 116,
    borderRadius: 18,
    backgroundColor: '#efe8dc',
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#201c17',
    fontSize: 16,
    textAlignVertical: 'top',
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
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  helperText: {
    flex: 1,
    color: '#70665b',
    fontSize: 13,
    lineHeight: 18,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#eadfd1',
  },
  clearButtonText: {
    color: '#433b33',
    fontWeight: '700',
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
    borderRadius: 17,
    backgroundColor: '#8b5e34',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: '#fff7ed',
    fontWeight: '800',
  },
  cardTitleWrap: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    color: '#1f1a15',
    fontSize: 20,
    fontWeight: '800',
  },
  cardCategory: {
    color: '#71675d',
    fontSize: 13,
    fontWeight: '600',
  },
  confidenceBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  highBadge: {
    backgroundColor: '#d5f1df',
  },
  moderateBadge: {
    backgroundColor: '#f5e6b8',
  },
  lowBadge: {
    backgroundColor: '#eadfd1',
  },
  confidenceText: {
    color: '#2d2a26',
    fontWeight: '800',
    fontSize: 12,
  },
  cardSummary: {
    color: '#413a33',
    fontSize: 15,
    lineHeight: 21,
  },
  metaRow: {
    gap: 4,
  },
  metaLabel: {
    color: '#1e1a15',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metaValue: {
    color: '#51483f',
    lineHeight: 20,
  },
  alertBox: {
    backgroundColor: '#f5ddd2',
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  alertTitle: {
    color: '#8b2f1f',
    fontSize: 13,
    fontWeight: '800',
  },
  alertText: {
    color: '#7a3b2d',
    lineHeight: 20,
  },
  sectionTitle: {
    color: '#1f1a15',
    fontSize: 15,
    fontWeight: '800',
  },
  treatmentRow: {
    gap: 2,
  },
  treatmentTitle: {
    color: '#2d2b25',
    fontSize: 13,
    fontWeight: '800',
  },
  treatmentText: {
    color: '#564e46',
    lineHeight: 20,
  },
  sourceText: {
    color: '#6b6258',
    fontSize: 12,
    lineHeight: 18,
  },
  emptyState: {
    backgroundColor: '#fffaf2',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: '#231e18',
    fontSize: 20,
    fontWeight: '800',
  },
  emptyText: {
    color: '#5a5148',
    textAlign: 'center',
    lineHeight: 20,
  },
});
