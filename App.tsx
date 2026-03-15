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
import { formatDurationToDays, getMatches } from './src/lib/matcher';
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

export default function App() {
  const [symptomText, setSymptomText] = useState('fever, headache, chills, body pains');
  const [durationValue, setDurationValue] = useState('3');
  const [durationUnit, setDurationUnit] = useState<(typeof durationUnits)[number]>('days');

  const durationDays = useMemo(
    () => formatDurationToDays(durationValue, durationUnit),
    [durationUnit, durationValue]
  );

  const results = useMemo(() => getMatches(symptomText, durationDays), [durationDays, symptomText]);

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>Offline STG Triage</Text>
          <Text style={styles.title}>Possible diagnoses from Ghana STG 2017</Text>
          <Text style={styles.subtitle}>
            Enter symptoms and duration. Matches come only from the local Standard Treatment
            Guidelines dataset curated from the attached PDF.
          </Text>
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
