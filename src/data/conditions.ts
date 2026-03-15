import { GuidelineCondition } from '../types';

export const guidelineConditions: GuidelineCondition[] = [
  {
    id: 'uncomplicated-malaria',
    title: 'Uncomplicated Malaria',
    category: 'Infectious',
    summary: 'Short febrile illness with chills, sweats, headache, body pains and possible vomiting.',
    symptomKeywords: [
      'fever',
      'chills',
      'rigors',
      'sweating',
      'headache',
      'body pain',
      'body pains',
      'joint pain',
      'joint pains',
      'nausea',
      'vomiting',
      'loss of appetite',
      'abdominal pain',
      'irritability'
    ],
    hallmarkSymptoms: ['fever', 'chills', 'headache'],
    duration: { minDays: 1, maxDays: 7, label: 'usually acute, over 1 to 7 days' },
    redFlags: ['confusion', 'convulsions', 'dark urine', 'difficulty breathing', 'unable to drink'],
    treatment: [
      { title: 'First-line', details: 'Artesunate + Amodiaquine orally for 3 days.' },
      { title: 'Alternatives', details: 'Artemether + Lumefantrine orally or Dihydroartemisinin + Piperaquine orally.' },
      { title: 'Supportive care', details: 'Tepid sponging in children and confirm with RDT or microscopy where possible.' }
    ],
    source: { section: 'Section 187. Uncomplicated Malaria', pdfPages: '501-503' }
  },
  {
    id: 'severe-malaria',
    title: 'Severe Malaria',
    category: 'Emergency Infectious',
    summary: 'Malaria with altered consciousness, repeated vomiting, dark urine, shock, severe weakness or breathing difficulty.',
    symptomKeywords: [
      'fever',
      'vomiting',
      'dark urine',
      'cola urine',
      'little urine',
      'difficulty breathing',
      'weakness',
      'unable to walk',
      'confusion',
      'delirium',
      'coma',
      'convulsions',
      'jaundice',
      'shock'
    ],
    hallmarkSymptoms: ['fever', 'vomiting', 'confusion'],
    duration: { minDays: 1, maxDays: 7, label: 'often rapid progression over hours to a few days' },
    redFlags: ['confusion', 'coma', 'convulsions', 'dark urine', 'difficulty breathing', 'shock'],
    treatment: [
      { title: 'Referral-centre first-line', details: 'IV or IM artesunate for at least 24 hours, then full 3-day oral ACT when able to swallow.' },
      { title: 'Alternatives', details: 'IM artemether, or IV/IM quinine followed by oral quinine plus clindamycin.' },
      { title: 'Action', details: 'Treat as emergency and start therapy immediately while confirming diagnosis.' }
    ],
    source: { section: 'Section 188. Severe Malaria', pdfPages: '504-509' }
  },
  {
    id: 'typhoid-fever',
    title: 'Typhoid Fever',
    category: 'Infectious',
    summary: 'Persistent fever rising gradually over days with headache, abdominal symptoms and poor response to antimalarials.',
    symptomKeywords: [
      'fever',
      'persistent fever',
      'high fever',
      'headache',
      'constipation',
      'abdominal pain',
      'diarrhoea',
      'dry cough',
      'confusion',
      'psychosis',
      'abdominal tenderness'
    ],
    hallmarkSymptoms: ['fever', 'headache', 'abdominal pain'],
    duration: { minDays: 5, maxDays: 21, label: 'classically builds over 5 to 21 days' },
    redFlags: ['confusion', 'bloody stool', 'severe abdominal pain', 'very ill appearance'],
    treatment: [
      { title: 'First-line', details: 'Ciprofloxacin orally for 10 to 14 days; IV ciprofloxacin if needed.' },
      { title: 'Second-line', details: 'IV ceftriaxone for 7 to 10 days or oral azithromycin for 7 days.' },
      { title: 'Supportive care', details: 'Tepid sponging and investigate with blood, stool or urine culture where possible.' }
    ],
    source: { section: 'Section 185. Typhoid Fever', pdfPages: '498-499' }
  },
  {
    id: 'meningitis',
    title: 'Meningitis',
    category: 'Emergency Infectious',
    summary: 'Medical emergency with fever, severe headache, neck pain or stiffness, vomiting, photophobia or altered behaviour.',
    symptomKeywords: [
      'fever',
      'neck pain',
      'neck stiffness',
      'headache',
      'severe headache',
      'photophobia',
      'change in behaviour',
      'confusion',
      'convulsions',
      'vomiting',
      'drowsiness',
      'irritability',
      'poor feeding',
      'bulging fontanelle'
    ],
    hallmarkSymptoms: ['fever', 'headache', 'neck stiffness'],
    duration: { minDays: 1, maxDays: 5, label: 'usually acute over 1 to 5 days' },
    redFlags: ['neck stiffness', 'confusion', 'coma', 'convulsions', 'bulging fontanelle'],
    treatment: [
      { title: 'First-line', details: 'Ceftriaxone IV or deep IM plus vancomycin IV for bacterial meningitis.' },
      { title: 'Alternatives', details: 'Benzylpenicillin plus chloramphenicol, or cefotaxime plus vancomycin.' },
      { title: 'Supportive care', details: 'Keep airway clear, tepid sponge, feed via NG tube if needed, and refer urgently if no response within 48 hours.' }
    ],
    source: { section: 'Section 191. Meningitis', pdfPages: '513-516' }
  },
  {
    id: 'pneumonia',
    title: 'Pneumonia',
    category: 'Respiratory',
    summary: 'Acute chest infection with fever, cough, sputum, breathlessness and pleuritic chest pain.',
    symptomKeywords: [
      'fever',
      'productive cough',
      'cough',
      'sputum',
      'blood stained sputum',
      'chest pain',
      'pleuritic chest pain',
      'breathlessness',
      'shortness of breath',
      'sweating',
      'muscle aches',
      'rapid breathing'
    ],
    hallmarkSymptoms: ['fever', 'cough', 'breathlessness'],
    duration: { minDays: 2, maxDays: 10, label: 'commonly acute over 2 to 10 days' },
    redFlags: ['oxygen saturation below 92%', 'confusion', 'severe breathlessness', 'rapid breathing'],
    treatment: [
      { title: 'Ambulatory first-line', details: 'High-dose oral amoxicillin for 7 days plus oral azithromycin for 6 days.' },
      { title: 'If penicillin allergy', details: 'Oral erythromycin; second-line options include oral cefuroxime or doxycycline in adults.' },
      { title: 'Hospital treatment', details: 'Oxygen, fluids, paracetamol, IV amoxicillin-clavulanate and azithromycin.' }
    ],
    source: { section: 'Section 59. Pneumonia', pdfPages: '187-191' }
  },
  {
    id: 'bronchial-asthma',
    title: 'Bronchial Asthma',
    category: 'Respiratory',
    summary: 'Recurrent wheeze, cough, chest tightness and episodic breathlessness, often worse at night or with triggers.',
    symptomKeywords: [
      'wheeze',
      'wheezing',
      'cough',
      'night cough',
      'chest tightness',
      'breathlessness',
      'shortness of breath',
      'nocturnal symptoms',
      'fast breathing',
      'unable to speak full sentences'
    ],
    hallmarkSymptoms: ['wheeze', 'cough', 'chest tightness'],
    duration: { minDays: 1, maxDays: 30, label: 'episodic over hours to weeks and often recurrent' },
    redFlags: ['silent chest', 'cyanosis', 'confusion', 'oxygen saturation below 92%', 'unable to speak full sentences'],
    treatment: [
      { title: 'Community initial care', details: 'Salbutamol inhaler with spacer, 1 to 2 puffs repeated every 15 to 30 minutes up to 10 doses.' },
      { title: 'Hospital acute care', details: 'Oxygen, nebulised salbutamol, nebulised ipratropium bromide and IV hydrocortisone.' },
      { title: 'Maintenance', details: 'Prednisolone after initial stabilisation and inhaled budesonide when frequent reliever use is needed.' }
    ],
    source: { section: 'Section 60. Bronchial Asthma', pdfPages: '193-196' }
  },
  {
    id: 'urinary-tract-infection',
    title: 'Urinary Tract Infection',
    category: 'Genitourinary',
    summary: 'Painful frequent urination with suprapubic pain, fever, cloudy urine or loin tenderness.',
    symptomKeywords: [
      'painful urination',
      'burning urination',
      'frequent urination',
      'haematuria',
      'blood in urine',
      'cloudy urine',
      'foul smelling urine',
      'vomiting',
      'suprapubic pain',
      'fever',
      'loin pain',
      'loin tenderness'
    ],
    hallmarkSymptoms: ['painful urination', 'frequent urination', 'suprapubic pain'],
    duration: { minDays: 1, maxDays: 14, label: 'commonly acute over 1 to 14 days' },
    redFlags: ['persistent haematuria', 'very ill appearance', 'loin tenderness', 'recurrent infection'],
    treatment: [
      { title: 'Uncomplicated first-line', details: 'Oral ciprofloxacin or oral cefuroxime; 5 to 7 days in females and 10 to 14 days in males.' },
      { title: 'Complicated UTI', details: 'IV ciprofloxacin, gentamicin or ceftriaxone depending on context and kidney function.' },
      { title: 'Supportive care', details: 'Encourage oral fluids and obtain urine microscopy, culture and sensitivity.' }
    ],
    source: { section: 'Section 139. Urinary Tract Infection', pdfPages: '419-421' }
  },
  {
    id: 'peptic-ulcer-disease',
    title: 'Peptic Ulcer Disease',
    category: 'Gastrointestinal',
    summary: 'Recurrent epigastric pain, often hunger-related or food-related, sometimes relieved by antacids or food.',
    symptomKeywords: [
      'abdominal pain',
      'epigastric pain',
      'burning pain',
      'gnawing pain',
      'pain when hungry',
      'night pain',
      'vomiting',
      'weight loss',
      'dyspepsia'
    ],
    hallmarkSymptoms: ['epigastric pain', 'burning pain', 'dyspepsia'],
    duration: { minDays: 7, maxDays: 90, label: 'often recurrent or persistent over weeks' },
    redFlags: ['vomiting blood', 'black stools', 'severe pain', 'weight loss'],
    treatment: [
      { title: 'Symptom control', details: 'Magnesium trisilicate or aluminium hydroxide for dyspepsia; omeprazole as second-line acid suppression.' },
      { title: 'NSAID-associated ulcer', details: 'Esomeprazole, omeprazole or pantoprazole for 4 weeks.' },
      { title: 'H. pylori eradication', details: 'PPI plus two antibiotics for 10 to 14 days, using combinations with amoxicillin, clarithromycin or metronidazole.' }
    ],
    source: { section: 'Section 11. Peptic Ulcer Disease', pdfPages: '40-42' }
  },
  {
    id: 'gord',
    title: 'Gastro-oesophageal Reflux Disease',
    category: 'Gastrointestinal',
    summary: 'Heartburn, retrosternal or epigastric pain and regurgitation, often worse after meals, bending or lying down.',
    symptomKeywords: [
      'heartburn',
      'dyspepsia',
      'retrosternal pain',
      'epigastric pain',
      'pain on swallowing',
      'difficulty swallowing',
      'regurgitation',
      'night cough',
      'wheezing',
      'vomiting'
    ],
    hallmarkSymptoms: ['heartburn', 'regurgitation', 'retrosternal pain'],
    duration: { minDays: 7, maxDays: 120, label: 'commonly persistent or recurrent over weeks to months' },
    redFlags: ['difficulty swallowing', 'weight loss', 'persistent vomiting'],
    treatment: [
      { title: 'Lifestyle', details: 'Elevate head of bed, avoid late meals, smoking, alcohol, NSAIDs and trigger foods.' },
      { title: 'Non-erosive GORD', details: 'Magnesium trisilicate, antacid combinations or omeprazole for 4 to 8 weeks.' },
      { title: 'Severe or erosive disease', details: 'Higher-dose omeprazole, esomeprazole or rabeprazole; add metoclopramide or domperidone if bloating is prominent.' }
    ],
    source: { section: 'Section 12. Gastro-oesophageal Reflux Disease', pdfPages: '43-45' }
  },
  {
    id: 'acute-diarrhoea',
    title: 'Acute Diarrhoea / Gastroenteritis',
    category: 'Gastrointestinal',
    summary: 'Watery stools with vomiting or abdominal cramps, sometimes with fever, blood or mucus depending on cause.',
    symptomKeywords: [
      'diarrhoea',
      'watery stool',
      'watery stools',
      'vomiting',
      'abdominal cramps',
      'abdominal pain',
      'fever',
      'blood in stool',
      'mucus in stool',
      'thirst',
      'sunken eyes',
      'dehydration'
    ],
    hallmarkSymptoms: ['diarrhoea', 'vomiting', 'abdominal pain'],
    duration: { minDays: 1, maxDays: 7, label: 'usually acute over 1 to 7 days' },
    redFlags: ['blood in stool', 'altered consciousness', 'convulsions', 'poor drinking', 'severe dehydration'],
    treatment: [
      { title: 'Core treatment', details: 'Rehydration with ORS; continue feeding and give zinc in children.' },
      { title: 'Bacterial gastroenteritis', details: 'Oral ciprofloxacin for 5 days, with cefuroxime as second-line in selected cases.' },
      { title: 'Amoebic dysentery or cholera', details: 'Use metronidazole for suspected amoebic dysentery; tetracycline, doxycycline or erythromycin regimens for cholera as indicated.' }
    ],
    source: { section: 'Section 1. Diarrhoea / Section 9. Rotavirus Disease and Diarrhoea', pdfPages: '32-37' }
  }
];
