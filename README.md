# STG Triage

Offline Expo app for Android and iOS built around the Ghana Standard Treatment Guidelines (STG), 7th edition (2017).

The app now has two clearly separated workflows:

- `Guided triage`: a stricter, age-aware rules engine that ranks only curated STG conditions
- `STG reference`: a broader offline disease/section lookup across the searchable STG corpus

## What it does

- Collects `age`, `duration`, `symptoms`, and `signs` separately.
- Supports guided triage with structured STG buckets plus manual symptom/sign entry.
- Ranks likely conditions locally on-device using curated age-aware STG logic.
- Lets users search STG diseases/conditions by name with typo-tolerant offline search.
- Shows treatment options, investigations, red flags, and source section/page references from the STG.
- Uses no authentication, no backend, and no external API calls.

## Current product shape

### Guided triage

- Designed to return one careful primary STG answer first
- Uses age bands, hallmark findings, red flags, and duration windows
- Separates `symptoms` from `signs / examination findings`
- Keeps ranking limited to curated conditions instead of the full extracted corpus

### STG reference

- Searches the broader offline STG corpus by disease/condition name
- Returns structured section content for confirmation and reference
- Labels entries as either:
  - `Ranked by guided triage`
  - `Reference-only STG section`

## Local setup

```bash
npm install
npm start
```

Then open the Expo app on Android or iOS.

## Validation

```bash
npm test
npx tsc --noEmit
npx expo-doctor
npx expo export --platform web
```

## Curated guided-triage coverage

The ranked guided-triage layer currently includes:

- Sick newborn / neonatal sepsis
- Neonatal hypoglycaemia
- Neonatal jaundice
- Acute diarrhoea / gastroenteritis
- Rotavirus diarrhoea
- Measles
- Uncomplicated malaria
- Severe malaria
- Meningitis
- Common cold
- Pneumonia
- Bronchial asthma
- Acute bronchitis
- Urinary tract infection
- Tuberculosis
- Typhoid fever
- Vitamin A deficiency / xerophthalmia
- Constipation
- Peptic ulcer disease
- Gastro-oesophageal reflux disease
- Haemorrhoids
- Amoebic liver abscess
- Acute hepatitis
- Hepatic encephalopathy

## Search/reference coverage

- The app includes a generated offline STG corpus built from the PDF table of contents and section extraction pipeline.
- All 30 STG chapters are accounted for in the searchable corpus.
- Search/reference coverage is broader than ranked triage coverage by design.

## Notes

- This is an offline decision-support tool, not a substitute for clinical judgment or confirmed diagnosis.
- Accuracy is intentionally prioritized by keeping ranked diagnosis limited to curated STG conditions.
- The broader extracted STG corpus is available for reference search without being overclaimed as triage-quality ranking.
- The matching logic is transparent, lightweight, and designed to run fully on-device.
