# STG Triage

Offline Expo app for Android and iOS that suggests possible diagnoses and treatment options using a curated ruleset derived from the Ghana Standard Treatment Guidelines, 7th edition (2017).

## What it does

- Accepts symptom text and a duration.
- Ranks likely conditions locally on-device.
- Shows treatment options and source section/page references from the PDF.
- Uses no authentication, no backend, and no external API calls.

## Local setup

```bash
npm install
npm start
```

Then open the Expo app on Android or iOS.

## Current guideline coverage

The app currently includes curated entries for:

- Uncomplicated malaria
- Severe malaria
- Typhoid fever
- Meningitis
- Pneumonia
- Bronchial asthma
- Urinary tract infection
- Peptic ulcer disease
- Gastro-oesophageal reflux disease
- Acute diarrhoea / gastroenteritis

## Notes

- This is a lightweight offline decision-support interface, not a confirmed diagnosis engine.
- The matching logic is intentionally transparent and fast so it can run entirely on-device.
