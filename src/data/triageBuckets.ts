import { guidelineConditions } from './conditions';
import { TriageBucketId } from '../types';

export type TriageBucket = {
  id: TriageBucketId;
  label: string;
  shortLabel: string;
  helperText: string;
  symptomOptions: string[];
  signOptions: string[];
  preferredConditionIds: string[];
};

const bucketDefinitions: Omit<TriageBucket, 'preferredConditionIds'>[] = [
  {
    id: 'fever-systemic',
    label: 'Fever / systemic illness',
    shortLabel: 'Fever',
    helperText: 'Use for malaria-, typhoid-, measles-, or sepsis-like febrile presentations.',
    symptomOptions: [
      'fever',
      'headache',
      'chills',
      'rigors',
      'body pains',
      'malaise',
      'vomiting',
      'abdominal pain',
      'diarrhoea',
      'rash',
      'poor feeding',
    ],
    signOptions: [
      'dark urine',
      'altered consciousness',
      'convulsions',
      'neck stiffness',
      'photophobia',
      'bulging fontanelle',
      'toxic appearance',
    ],
  },
  {
    id: 'respiratory',
    label: 'Respiratory / cough / breathing',
    shortLabel: 'Respiratory',
    helperText: 'Use for pneumonia, asthma, bronchitis, TB, and upper respiratory patterns.',
    symptomOptions: [
      'cough',
      'shortness of breath',
      'wheeze',
      'chest pain',
      'sputum',
      'sore throat',
      'runny nose',
      'sneezing',
    ],
    signOptions: [
      'rapid breathing',
      'chest indrawing',
      'crepitations',
      'bronchial breath sounds',
      'rhonchi',
      'use of accessory muscles',
      'cyanosis',
    ],
  },
  {
    id: 'diarrhoea-dehydration',
    label: 'Diarrhoea / dehydration',
    shortLabel: 'Diarrhoea',
    helperText: 'Use when stool pattern and dehydration signs are the dominant STG pathway.',
    symptomOptions: [
      'diarrhoea',
      'watery diarrhoea',
      'watery stool',
      'vomiting',
      'thirst',
      'blood in stool',
      'poor feeding',
    ],
    signOptions: [
      'sunken eyes',
      'poor drinking',
      'skin pinch goes back slowly',
      'skin pinch goes back very slowly',
      'dry mouth',
      'poor skin turgor',
      'diminished skin turgor',
      'altered consciousness',
    ],
  },
  {
    id: 'gastrointestinal-bowel',
    label: 'Upper GI / bowel / rectal',
    shortLabel: 'Upper GI',
    helperText: 'Use for dyspepsia, reflux, constipation, rectal bleeding, anal swelling, or anorectal symptoms.',
    symptomOptions: [
      'epigastric pain',
      'heartburn',
      'retrosternal pain',
      'difficulty swallowing',
      'pain on swallowing',
      'vomiting',
      'constipation',
      'hard stools',
      'straining to pass stools',
      'bright red rectal bleeding',
      'anal swelling',
      'pruritus ani',
    ],
    signOptions: [
      'epigastric tenderness',
      'pallor',
      'skin tags',
      'thrombosed haemorrhoids',
      'swelling at the anus',
      'abdominal mass',
      'absent bowel sounds',
      'peritonitis',
    ],
  },
  {
    id: 'hepatobiliary',
    label: 'Liver / jaundice / confusion',
    shortLabel: 'Liver',
    helperText: 'Use for jaundice, right upper abdominal pain, hepatomegaly, encephalopathy, or liver abscess patterns.',
    symptomOptions: [
      'yellow eyes',
      'dark urine',
      'pale stools',
      'itching',
      'right upper abdominal pain',
      'anorexia',
      'malaise',
      'weight loss',
      'confusion',
      'fever',
    ],
    signOptions: [
      'jaundice',
      'hepatomegaly',
      'large tender liver',
      'right hypochondrial tenderness',
      'asterixis',
      'fetor hepaticus',
      'ascites',
      'tender intercostal swelling',
    ],
  },
  {
    id: 'urinary',
    label: 'Urinary / kidney',
    shortLabel: 'Urinary',
    helperText: 'Use for dysuria, frequency, urgency, suprapubic pain, or loin tenderness.',
    symptomOptions: [
      'painful urination',
      'frequent urination',
      'urgency',
      'suprapubic pain',
      'fever',
      'abdominal pain',
      'poor feeding',
    ],
    signOptions: ['suprapubic tenderness', 'loin tenderness'],
  },
  {
    id: 'neurologic-meningeal',
    label: 'Neurologic / meningeal',
    shortLabel: 'Neurologic',
    helperText: 'Use when altered consciousness, seizures, meningeal signs, or neonatal neurologic illness is central.',
    symptomOptions: ['headache', 'vomiting', 'poor feeding', 'weak cry', 'fever', 'confusion'],
    signOptions: [
      'neck stiffness',
      'photophobia',
      'bulging fontanelle',
      'altered consciousness',
      'convulsions',
      'positive kernig sign',
      'positive brudzinski sign',
      'difficulty breathing',
      'asterixis',
    ],
  },
  {
    id: 'eye-nutrition',
    label: 'Eye / nutrition',
    shortLabel: 'Eye/Nutrition',
    helperText: 'Use for xerophthalmia, conjunctival/corneal findings, or measles-related eye presentations.',
    symptomOptions: ['poor night vision', 'night blindness', 'red eyes', 'fever', 'cough', 'rash'],
    signOptions: [
      'dry conjunctiva',
      'grey sclera',
      'conjunctival folding',
      'keratomalacia',
      'conjunctivitis',
      'koplik spots',
      'yellow eyes',
    ],
  },
];

export const triageBuckets: TriageBucket[] = bucketDefinitions.map((definition) => ({
  ...definition,
  preferredConditionIds: guidelineConditions
    .filter((condition) => condition.triageBucketId === definition.id)
    .map((condition) => condition.id),
}));
