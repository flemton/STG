import {
  AgeRange,
  ConditionAgeBand,
  DiagnosticEvidence,
  GuidelineCondition,
  StgChapter,
  StgChapterSummary,
  SearchableAgeBand,
  SearchableStgEntry,
  TreatmentLine,
  TriageBucketId,
} from '../types';

import { generatedCorpus } from './generated-corpus';
import { getChapterByTitle, getRankedReason, getReferenceReason, stgChapters } from './stgChapters';

const tx = (title: string, details: string): TreatmentLine => ({ title, details });
const range = (label: string, minDays: number, maxDays: number): AgeRange => ({
  label,
  minDays,
  maxDays,
});

const evidence = (
  symptoms: string[],
  signs: string[],
  investigations: string[],
  hallmarkSymptoms: string[],
  hallmarkSigns: string[],
  redFlags: string[],
  referralCriteria?: string[],
  diagnosticNotes?: string[]
): DiagnosticEvidence => ({
  symptoms,
  signs,
  investigations,
  hallmarkSymptoms,
  hallmarkSigns,
  redFlags,
  referralCriteria,
  diagnosticNotes,
});

const band = (
  id: string,
  ageRange: AgeRange,
  summary: string,
  details: DiagnosticEvidence,
  treatment: TreatmentLine[],
  source: { section: string; pdfPages: string },
  contraindicationsOrNotes?: string[]
): ConditionAgeBand => ({
  id,
  label: ageRange.label,
  ageRange,
  summary,
  evidence: details,
  treatment,
  source,
  contraindicationsOrNotes,
});

const sanitizeGeneratedTerms = (terms: string[]) =>
  Array.from(
    new Set(
      terms
        .flatMap((term) =>
          term
            .replace(/([a-z]) ([A-Z])/g, '$1|$2')
            .split(/[|;:.]/)
            .flatMap((part) => part.split(','))
        )
        .map((term) => term.replace(/\s+/g, ' ').trim().toLowerCase())
        .filter(
          (term) =>
            term.length >= 3 &&
            term.length <= 80 &&
            term.split(' ').length <= 10 &&
            !term.includes('table ') &&
            !term.includes('evidence rating') &&
            !term.includes('treatment plan')
        )
    )
  );

const NEONATE = range('Neonate (0-28 days)', 0, 28);
const INFANT = range('Infant (1-11 months)', 29, 364);
const UNDER_FIVE = range('Child under 5 years', 29, 1825);
const CHILD = range('Child (1-12 years)', 365, 4380);
const AGE_1_PLUS = range('Child/Adult (1 year and above)', 365, 43800);
const AGE_5_PLUS = range('Age 5 years and above', 1826, 43800);
const AGE_12_PLUS = range('Adolescent/Adult (12 years and above)', 4381, 43800);
const ADULT = range('Adult (18 years and above)', 6570, 43800);
const ALL_AGES = range('All ages', 0, 43800);

const curatedConditionsBase: Array<
  Omit<GuidelineCondition, 'chapterIndex' | 'chapterTitle' | 'triageBucketId' | 'sourceEntryId'>
> = [
  {
    id: 'sick-newborn-sepsis',
    title: 'Sick Newborn / Neonatal Sepsis',
    category: 'Emergency Neonatal',
    dataSource: 'curated',
    ageSensitive: true,
    preferredAgeBands: ['neonate'],
    duration: { minDays: 1, maxDays: 7, label: 'acute' },
    ageBands: [
      band(
        'neonate',
        NEONATE,
        'Unwell neonate with feeding difficulty, weak cry, temperature instability, reduced movement, or breathing problems.',
        evidence(
          ['poor feeding', 'refusal of feeds', 'weak cry', 'vomiting', 'fever', 'low temperature'],
          ['difficulty breathing', 'apnoea', 'floppy', 'reduced movement', 'abdominal distension', 'cyanosis'],
          ['blood culture', 'blood glucose', 'full blood count'],
          ['poor feeding', 'weak cry'],
          ['difficulty breathing', 'apnoea', 'cyanosis'],
          ['seizures', 'drowsiness', 'unconsciousness', 'respiratory distress'],
          ['refer urgently if no improvement after 48 hours'],
          ['Treat as neonatal sepsis when a sick neonate has poor activity, abnormal temperature, respiratory distress, or feeding failure.']
        ),
        [
          tx('Immediate care', 'Secure airway, breathing and circulation, keep baby warm, and give oxygen if available.'),
          tx('Glucose and fluids', 'Use Dextrose 10% IV and correct hypoglycaemia urgently when present.'),
          tx('Antibiotics', 'Start ampicillin plus gentamicin; ampicillin plus cefotaxime is an alternative in the STG.'),
        ],
        { section: 'Section 34. Sick newborn', pdfPages: '115-117' }
      ),
    ],
  },
  {
    id: 'neonatal-hypoglycaemia',
    title: 'Neonatal Hypoglycaemia',
    category: 'Emergency Neonatal',
    dataSource: 'curated',
    ageSensitive: true,
    preferredAgeBands: ['neonate'],
    duration: { minDays: 1, maxDays: 3, label: 'often in the first hours to days of life' },
    ageBands: [
      band(
        'neonate',
        NEONATE,
        'Low blood glucose in a neonate, especially if premature, septic, low birth weight, or infant of a diabetic mother.',
        evidence(
          ['poor feeding', 'weak cry', 'lethargy', 'restlessness', 'irritability'],
          ['tremors', 'sweating', 'seizures', 'unconsciousness'],
          ['blood glucose'],
          ['lethargy'],
          ['tremors', 'sweating'],
          ['seizures', 'unconsciousness', 'poor feeding'],
          ['refer if recurrent or not correcting'],
          ['Hypoglycaemia is supported by tremors, sweating, lethargy, poor feeding, or seizures in a neonate.']
        ),
        [
          tx('Immediate treatment', 'Give Dextrose 10% IV 4 ml/kg bolus immediately.'),
          tx('Maintenance', 'Continue maintenance fluids in Dextrose 10% and recheck glucose frequently.'),
          tx('Feeds', 'Support early breastfeeding or expressed breast milk if the baby can feed.'),
        ],
        { section: 'Section 35. Neonatal Hypoglycaemia', pdfPages: '118-119' }
      ),
    ],
  },
  {
    id: 'neonatal-jaundice',
    title: 'Neonatal Jaundice',
    category: 'Neonatal',
    dataSource: 'curated',
    ageSensitive: true,
    preferredAgeBands: ['neonate'],
    duration: { minDays: 1, maxDays: 14, label: 'within the first 14 days is most relevant' },
    ageBands: [
      band(
        'neonate',
        NEONATE,
        'Jaundice in the first month of life, with day-one jaundice and illness signs suggesting pathological disease.',
        evidence(
          ['yellow eyes', 'yellow skin', 'poor feeding', 'fever'],
          ['yellow palms', 'yellow soles', 'pale stools'],
          ['serum bilirubin', 'blood group and direct coombs test'],
          ['yellow eyes'],
          ['yellow palms', 'yellow soles'],
          ['jaundice on day 1', 'pale stools', 'fever', 'prolonged jaundice'],
          ['refer urgently for day-one jaundice or need for exchange transfusion'],
          ['Jaundice reaching palms or soles, appearing in the first 24 hours, or persisting beyond 14 days is concerning.']
        ),
        [
          tx('Phototherapy', 'Use phototherapy when bilirubin thresholds or visible severity criteria in the STG are met.'),
          tx('Escalation', 'Arrange exchange transfusion when bilirubin is dangerously high or rising rapidly.'),
          tx('Cause treatment', 'Treat underlying sepsis or haemolysis where suspected.'),
        ],
        { section: 'Section 36. Neonatal Jaundice', pdfPages: '119-122' }
      ),
    ],
  },
  {
    id: 'acute-diarrhoea',
    title: 'Acute Diarrhoea / Gastroenteritis',
    category: 'Gastrointestinal',
    dataSource: 'curated',
    ageSensitive: true,
    duration: { minDays: 1, maxDays: 7, label: 'usually acute over 1-7 days' },
    ageBands: [
      band(
        'under-five',
        UNDER_FIVE,
        'Diarrhoea in young children is classified mainly by dehydration severity, stool pattern, and ability to drink.',
        evidence(
          ['diarrhoea', 'watery stool', 'vomiting', 'thirst', 'poor feeding', 'blood in stool'],
          ['sunken eyes', 'restless', 'lethargic', 'poor drinking', 'skin pinch goes back slowly', 'skin pinch goes back very slowly'],
          ['stool microscopy and culture when indicated', 'serum electrolytes in severe dehydration'],
          [],
          ['sunken eyes', 'poor drinking'],
          ['blood in stool', 'altered consciousness', 'convulsions', 'severe dehydration'],
          ['refer if severe dehydration, persistent vomiting, blood in stool, or poor response to fluids'],
          ['Use WHO/STG dehydration signs such as sunken eyes, thirst, ability to drink, and skin turgor.']
        ),
        [
          tx('Rehydration', 'Use ORS Plan A or B, or urgent IV fluids Plan C depending on dehydration severity.'),
          tx('Zinc', 'Give zinc supplementation for 10-14 days in children.'),
          tx('Feeding', 'Continue breastfeeding and age-appropriate feeding during rehydration.'),
        ],
        { section: 'Section 8. Diarrhoea', pdfPages: '11-17' }
      ),
      band(
        'older',
        AGE_5_PLUS,
        'Older children and adults with acute diarrhoea are managed primarily with rehydration and selected antimicrobials only when indicated.',
        evidence(
          ['diarrhoea', 'watery stool', 'vomiting', 'abdominal cramps', 'abdominal pain', 'blood in stool'],
          ['sunken eyes', 'dry mouth', 'poor skin turgor'],
          ['stool microscopy and culture when indicated', 'serum electrolytes in severe dehydration'],
          [],
          ['poor skin turgor'],
          ['blood in stool', 'severe dehydration', 'persistent vomiting'],
          ['refer if worsening, chronic diarrhoea is suspected, or severe dehydration is present']
        ),
        [
          tx('Main treatment', 'Use ORS liberally and replace ongoing losses.'),
          tx('Selected antibiotics', 'Use antibiotics only for STG-supported causes such as cholera, bacterial gastroenteritis, or amoebiasis.'),
        ],
        { section: 'Section 8. Diarrhoea', pdfPages: '11-17' }
      ),
    ],
  },
  {
    id: 'rotavirus-diarrhoea',
    title: 'Rotavirus Disease and Diarrhoea',
    category: 'Paediatric Gastrointestinal',
    dataSource: 'curated',
    ageSensitive: true,
    preferredAgeBands: ['under-five'],
    duration: { minDays: 1, maxDays: 5, label: 'commonly acute over 1-5 days' },
    ageBands: [
      band(
        'under-five',
        UNDER_FIVE,
        'Common cause of severe diarrhoea in infants and young children with vomiting, watery stools, fever, and dehydration.',
        evidence(
          ['watery diarrhoea', 'vomiting', 'fever', 'thirst'],
          ['sunken eyes', 'diminished skin turgor', 'altered consciousness', 'poor drinking'],
          ['stool testing is rarely needed routinely'],
          ['watery diarrhoea'],
          ['sunken eyes', 'poor drinking'],
          ['altered consciousness', 'convulsions', 'poor drinking'],
          ['refer if poor response to rehydration or danger signs develop']
        ),
        [
          tx('Main treatment', 'Correct fluid and electrolyte deficits using ORS or IV fluids according to dehydration severity.'),
          tx('Nutrition', 'Continue breastfeeding or tolerated feeds.'),
        ],
        { section: 'Section 9. Rotavirus Disease and Diarrhoea', pdfPages: '18-21' }
      ),
    ],
  },
  {
    id: 'measles',
    title: 'Measles',
    category: 'Immunisable Disease',
    dataSource: 'curated',
    ageSensitive: true,
    preferredAgeBands: ['under-five'],
    duration: { minDays: 2, maxDays: 10, label: 'acute over several days with fever before rash' },
    ageBands: [
      band(
        'under-five',
        UNDER_FIVE,
        'Measles in young children is a clinical diagnosis with fever, cough, coryza, conjunctivitis, and a rash beginning on the face or neck.',
        evidence(
          ['runny nose', 'cough', 'red eyes', 'sore mouth', 'high fever', 'rash', 'diarrhoea'],
          ['conjunctivitis', 'koplik spots', 'maculo-papular rash', 'rash starts on face', 'rash starts on neck'],
          ['usually none', 'measles immunoglobulin m antibody assay if required'],
          ['runny nose', 'cough', 'red eyes', 'rash'],
          ['koplik spots', 'conjunctivitis'],
          ['black rash', 'stridor', 'pneumonia', 'coma', 'difficulty drinking', 'dehydration', 'malnutrition'],
          ['refer if there is pneumonia, dehydration, stridor, coma, or difficulty feeding/drinking'],
          ['Measles diagnosis is mainly clinical in the STG and the classic pattern is fever with cough, coryza, conjunctivitis, and rash.']
        ),
        [
          tx('Supportive care', 'Use tepid sponging, oral hygiene, continued soft high-calorie feeds, and eye washing with clean water.'),
          tx('Pain and fever', 'Give paracetamol using the STG age dosing.'),
          tx('Vitamin A', 'Give oral vitamin A for 2 days using the STG child age bands to prevent eye complications.'),
        ],
        { section: 'Section 24. Measles', pdfPages: '82-84' }
      ),
      band(
        'older-child-adult',
        AGE_1_PLUS,
        'Older children and adults still present with fever, cough, coryza, conjunctivitis, and a generalized maculo-papular rash.',
        evidence(
          ['runny nose', 'cough', 'red eyes', 'sore mouth', 'high fever', 'rash', 'diarrhoea'],
          ['conjunctivitis', 'koplik spots', 'maculo-papular rash', 'rash starts on face', 'rash starts on neck'],
          ['usually none', 'measles immunoglobulin m antibody assay if required'],
          ['cough', 'red eyes', 'rash'],
          ['koplik spots', 'conjunctivitis'],
          ['black rash', 'stridor', 'pneumonia', 'coma', 'difficulty drinking', 'dehydration'],
          ['refer complications urgently']
        ),
        [
          tx('Supportive care', 'Use paracetamol, fluids, nutrition support, and skin/eye care as outlined in the STG.'),
          tx('Complications', 'Manage associated diarrhoea, pneumonia, or otitis media using the relevant STG sections.'),
        ],
        { section: 'Section 24. Measles', pdfPages: '82-84' }
      ),
    ],
  },
  {
    id: 'uncomplicated-malaria',
    title: 'Uncomplicated Malaria',
    category: 'Infectious',
    dataSource: 'curated',
    ageSensitive: true,
    preferredAgeBands: ['under-five'],
    duration: { minDays: 1, maxDays: 7, label: 'usually acute over 1-7 days' },
    ageBands: [
      band(
        'under-five',
        UNDER_FIVE,
        'Younger children may present with fever plus poor feeding, vomiting, irritability, abdominal pain, pallor, or mild jaundice.',
        evidence(
          ['fever', 'vomiting', 'poor feeding', 'irritability', 'abdominal pain'],
          ['mild pallor', 'mild jaundice'],
          ['malaria rapid diagnostic test', 'blood film for malaria parasites', 'haemoglobin'],
          [],
          [],
          ['convulsions', 'unable to drink', 'difficulty breathing', 'confusion'],
          ['refer if severe malaria features are present or the child cannot take oral treatment'],
          ['Uncomplicated malaria should not dominate when severe features or alternative hallmark signs point elsewhere.']
        ),
        [
          tx('First-line', 'Use recommended ACTs such as Artesunate + Amodiaquine, Artemether + Lumefantrine, or Dihydroartemisinin + Piperaquine according to STG tables.'),
          tx('Testing', 'Confirm with RDT or microscopy where possible.'),
          tx('Supportive care', 'Use tepid sponging for fever and encourage fluids.'),
        ],
        { section: 'Section 187. Uncomplicated Malaria', pdfPages: '487-491' }
      ),
      band(
        'older',
        AGE_5_PLUS,
        'Older children and adults typically report fever, chills or rigors, headache, sweating, body pains, nausea, or vomiting.',
        evidence(
          ['fever', 'chills', 'rigors', 'headache', 'sweating', 'body pains', 'vomiting', 'loss of appetite'],
          [],
          ['malaria rapid diagnostic test', 'blood film for malaria parasites', 'haemoglobin'],
          ['chills', 'rigors'],
          [],
          ['confusion', 'convulsions', 'dark urine', 'difficulty breathing'],
          ['refer if severe malaria is suspected or oral therapy is not tolerated']
        ),
        [
          tx('First-line', 'Use Artesunate + Amodiaquine or other recommended ACT regimens from the STG.'),
          tx('Testing', 'Seek laboratory confirmation where possible before treatment.'),
        ],
        { section: 'Section 187. Uncomplicated Malaria', pdfPages: '487-491' }
      ),
    ],
  },
  {
    id: 'severe-malaria',
    title: 'Severe Malaria',
    category: 'Emergency Infectious',
    dataSource: 'curated',
    ageSensitive: true,
    preferredAgeBands: ['under-five'],
    duration: { minDays: 1, maxDays: 5, label: 'acute deterioration over hours to days' },
    ageBands: [
      band(
        'under-five',
        UNDER_FIVE,
        'Life-threatening malaria in children with impaired consciousness, repeated convulsions, severe pallor, respiratory distress, or inability to feed.',
        evidence(
          ['fever', 'vomiting', 'poor feeding'],
          ['convulsions', 'altered consciousness', 'severe pallor', 'respiratory distress', 'dark urine', 'shock'],
          ['malaria rapid diagnostic test', 'blood film for malaria parasites', 'haemoglobin', 'blood glucose'],
          [],
          ['altered consciousness', 'convulsions'],
          ['dark urine', 'shock', 'unable to drink', 'repeated convulsions', 'respiratory distress'],
          ['start treatment immediately before referral or transfer'],
          ['Severe malaria requires defining danger signs rather than generic fever alone.']
        ),
        [
          tx('Parenteral treatment', 'Give IV or IM artesunate immediately, then complete an ACT when oral treatment is possible.'),
          tx('Supportive care', 'Correct hypoglycaemia, anaemia, seizures, and fluids carefully according to the STG.'),
        ],
        { section: 'Section 188. Severe Malaria', pdfPages: '491-492' }
      ),
      band(
        'older',
        AGE_5_PLUS,
        'Severe malaria in older patients is suggested by fever plus cerebral signs, shock, dark urine, jaundice, respiratory distress, or severe anaemia.',
        evidence(
          ['fever', 'vomiting', 'headache'],
          ['altered consciousness', 'convulsions', 'dark urine', 'shock', 'respiratory distress', 'jaundice', 'severe pallor'],
          ['malaria rapid diagnostic test', 'blood film for malaria parasites', 'haemoglobin', 'blood glucose'],
          [],
          ['altered consciousness', 'convulsions', 'dark urine'],
          ['shock', 'respiratory distress', 'severe anaemia'],
          ['start treatment immediately before referral or transfer']
        ),
        [
          tx('Parenteral treatment', 'Give IV or IM artesunate urgently, then step down to oral ACT when stable.'),
          tx('Supportive care', 'Manage airway, glucose, fluids, seizures, and severe anaemia according to the STG.'),
        ],
        { section: 'Section 188. Severe Malaria', pdfPages: '491-492' }
      ),
    ],
  },
  {
    id: 'meningitis',
    title: 'Meningitis',
    category: 'Emergency Infectious',
    dataSource: 'curated',
    ageSensitive: true,
    duration: { minDays: 1, maxDays: 5, label: 'usually acute over hours to days' },
    ageBands: [
      band(
        'infant',
        INFANT,
        'Infants may present non-specifically, but bulging fontanelle, seizures, lethargy, neck retraction, or altered consciousness are defining clues.',
        evidence(
          ['fever', 'vomiting', 'poor feeding', 'irritability'],
          ['bulging fontanelle', 'lethargy', 'neck retraction', 'seizures', 'altered consciousness'],
          ['lumbar puncture', 'cerebrospinal fluid analysis', 'blood culture'],
          [],
          ['bulging fontanelle', 'neck retraction', 'altered consciousness'],
          ['seizures', 'unconsciousness', 'bulging fontanelle'],
          ['treat urgently and refer if airway, seizures, or consciousness are compromised'],
          ['Do not rank meningitis highly on fever and vomiting alone without hallmark meningeal or neurologic signs.']
        ),
        [
          tx('Urgent antibiotics', 'Start ceftriaxone or cefotaxime promptly according to the STG age-specific regimen.'),
          tx('Supportive care', 'Manage seizures, fluids, fever, and airway support urgently.'),
        ],
        { section: 'Section 194. Meningitis', pdfPages: '513-516' }
      ),
      band(
        'older',
        AGE_1_PLUS,
        'Older children and adults usually have fever with severe headache and defining meningeal or neurologic signs such as neck stiffness, photophobia, or altered mental state.',
        evidence(
          ['fever', 'headache', 'vomiting'],
          ['neck stiffness', 'photophobia', 'altered consciousness', 'positive kernig sign', 'positive brudzinski sign', 'convulsions'],
          ['lumbar puncture', 'cerebrospinal fluid analysis', 'blood culture'],
          [],
          ['neck stiffness', 'photophobia', 'altered consciousness'],
          ['convulsions', 'unconsciousness', 'shock'],
          ['treat urgently and refer if airway, seizures, or consciousness are compromised']
        ),
        [
          tx('Urgent antibiotics', 'Start ceftriaxone promptly according to the STG adult or child regimen.'),
          tx('Supportive care', 'Give fluids, antipyretics, anticonvulsants, and oxygen as needed.'),
        ],
        { section: 'Section 194. Meningitis', pdfPages: '513-516' }
      ),
    ],
  },
  {
    id: 'common-cold',
    title: 'Common Cold',
    category: 'Respiratory',
    dataSource: 'curated',
    ageSensitive: false,
    duration: { minDays: 1, maxDays: 7, label: 'self-limiting over about a week' },
    ageBands: [
      band(
        'all',
        ALL_AGES,
        'A self-limiting upper respiratory tract infection with coryza, sneezing, nasal congestion, mild fever, sore throat, and cough.',
        evidence(
          ['runny nose', 'sneezing', 'nasal congestion', 'mild fever', 'headache', 'sore throat', 'muscle aches', 'cough', 'fatigue', 'malaise'],
          ['low grade fever', 'nasal discharge', 'nasal mucosa reddening', 'watering of eyes'],
          ['no investigations required'],
          ['runny nose', 'sneezing', 'nasal congestion'],
          ['nasal discharge'],
          ['persistent fever', 'persistent cough', 'purulent phlegm', 'offensive nasal discharge'],
          ['refer suspected measles, influenza, or complications'],
          ['The STG notes antibiotics are not indicated for common cold and symptoms usually resolve within a week.']
        ),
        [
          tx('Non-drug care', 'Rest, encourage adequate fluids, gargle lukewarm salt solution, and use steam inhalation.'),
          tx('Symptom relief', 'Use paracetamol and saline nasal drops; xylometazoline and cetirizine/chlorpheniramine may be used as in the STG.'),
          tx('Antibiotics', 'Antibiotics are not indicated for common cold.'),
        ],
        { section: 'Section 58. Common Cold', pdfPages: '167-169' }
      ),
    ],
  },
  {
    id: 'pneumonia',
    title: 'Pneumonia',
    category: 'Respiratory',
    dataSource: 'curated',
    ageSensitive: true,
    duration: { minDays: 1, maxDays: 10, label: 'usually acute over days' },
    ageBands: [
      band(
        'under-five',
        UNDER_FIVE,
        'Pneumonia in under-fives is classified by cough or difficulty breathing plus fast breathing, chest indrawing, danger signs, or hypoxia.',
        evidence(
          ['cough', 'difficulty breathing', 'fever'],
          ['rapid breathing', 'lower chest wall indrawing', 'nasal flaring', 'grunting', 'central cyanosis'],
          ['pulse oximetry', 'chest x-ray when indicated'],
          ['cough', 'difficulty breathing'],
          ['rapid breathing', 'lower chest wall indrawing'],
          ['central cyanosis', 'inability to drink', 'convulsions', 'severe respiratory distress'],
          ['refer severe pneumonia urgently']
        ),
        [
          tx('Antibiotics', 'Use age-appropriate oral or parenteral antibiotics depending on severity as outlined in the STG.'),
          tx('Supportive care', 'Give oxygen, antipyretics, and fluids as needed.'),
        ],
        { section: 'Section 199. Pneumonia', pdfPages: '508-512' }
      ),
      band(
        'older',
        AGE_5_PLUS,
        'Older children and adults usually have cough, fever, pleuritic chest pain, sputum, fast breathing, or focal chest signs.',
        evidence(
          ['cough', 'fever', 'chest pain', 'shortness of breath', 'sputum'],
          ['rapid breathing', 'crepitations', 'bronchial breath sounds'],
          ['pulse oximetry', 'chest x-ray when indicated'],
          ['cough'],
          ['crepitations', 'bronchial breath sounds'],
          ['cyanosis', 'severe respiratory distress', 'confusion'],
          ['refer if severe disease or oxygen requirement']
        ),
        [
          tx('Antibiotics', 'Use STG-recommended oral or IV antibiotics based on severity and setting.'),
          tx('Supportive care', 'Provide oxygen and fluids when needed.'),
        ],
        { section: 'Section 199. Pneumonia', pdfPages: '508-512' }
      ),
    ],
  },
  {
    id: 'bronchial-asthma',
    title: 'Bronchial Asthma',
    category: 'Respiratory',
    dataSource: 'curated',
    ageSensitive: true,
    duration: { minDays: 1, maxDays: 30, label: 'episodic or acute attack' },
    ageBands: [
      band(
        'child',
        CHILD,
        'Asthma is supported by recurrent wheeze, cough, breathlessness, chest tightness, and response to bronchodilators.',
        evidence(
          ['wheeze', 'cough', 'shortness of breath', 'chest tightness'],
          ['prolonged expiration', 'use of accessory muscles', 'silent chest'],
          ['peak expiratory flow if available'],
          ['wheeze'],
          ['use of accessory muscles'],
          ['silent chest', 'cyanosis', 'inability to speak', 'exhaustion'],
          ['refer severe attack urgently']
        ),
        [
          tx('Reliever', 'Use inhaled salbutamol promptly; add oxygen and systemic steroids for moderate or severe attacks.'),
          tx('Escalation', 'Nebulized bronchodilator and urgent referral are indicated in severe attacks.'),
        ],
        { section: 'Section 196. Bronchial Asthma', pdfPages: '518-520' }
      ),
      band(
        'adult',
        ADULT,
        'Asthma in adults typically presents with recurrent wheeze, breathlessness, chest tightness, and cough, often worse at night or with triggers.',
        evidence(
          ['wheeze', 'shortness of breath', 'cough', 'chest tightness'],
          ['prolonged expiration', 'use of accessory muscles', 'silent chest'],
          ['peak expiratory flow if available'],
          ['wheeze'],
          ['use of accessory muscles'],
          ['silent chest', 'cyanosis', 'inability to speak', 'exhaustion'],
          ['refer severe attack urgently']
        ),
        [
          tx('Reliever', 'Use inhaled salbutamol; add oral prednisolone or IV hydrocortisone when the attack is moderate or severe.'),
          tx('Escalation', 'Give oxygen and urgent nebulized therapy in severe disease.'),
        ],
        { section: 'Section 196. Bronchial Asthma', pdfPages: '518-520' }
      ),
    ],
  },
  {
    id: 'acute-bronchitis',
    title: 'Acute Bronchitis',
    category: 'Respiratory',
    dataSource: 'curated',
    ageSensitive: false,
    duration: { minDays: 1, maxDays: 14, label: 'acute cough illness over days to 2 weeks' },
    ageBands: [
      band(
        'all',
        ALL_AGES,
        'Acute inflammation of the bronchial mucosa, often with upper respiratory infection symptoms and usually not requiring antibiotics.',
        evidence(
          ['dry cough', 'sputum production', 'sore throat', 'pleuritic chest pain', 'low grade fever'],
          ['fever', 'rhinorrhoea', 'rhonchi', 'wheeze', 'crepitations'],
          ['full blood count', 'sputum culture and gram stain', 'sputum afb if symptoms last more than 2 weeks'],
          ['dry cough'],
          ['rhonchi', 'wheeze'],
          ['spo2 less than 92', 'symptoms longer than 2 weeks', 'underlying hiv', 'malnutrition', 'measles'],
          ['refer if not improving, low oxygen saturation, or significant comorbidity/secondary bacterial infection'],
          ['Most cases of acute bronchitis do not require antibiotics in the STG.']
        ),
        [
          tx('Supportive care', 'Use bed rest, oral fluids, and humidified air or steam inhalation.'),
          tx('Symptom relief', 'Use paracetamol and cough remedies such as guaifenesin, simple linctus, carbocysteine, or dextromethorphan as age-appropriate in the STG.'),
          tx('Antibiotics when complicated', 'Use amoxicillin or amoxicillin-clavulanic acid for complicated infection with comorbidity or suspected secondary bacterial infection.'),
        ],
        { section: 'Section 61. Acute Bronchitis', pdfPages: '180-182' }
      ),
    ],
  },
  {
    id: 'urinary-tract-infection',
    title: 'Urinary Tract Infection',
    category: 'Genitourinary',
    dataSource: 'curated',
    ageSensitive: true,
    duration: { minDays: 1, maxDays: 10, label: 'usually acute over days' },
    ageBands: [
      band(
        'child',
        CHILD,
        'In children, UTI can present with fever, dysuria, frequency, abdominal pain, vomiting, or poor feeding depending on age.',
        evidence(
          ['fever', 'painful urination', 'frequent urination', 'vomiting', 'abdominal pain', 'poor feeding'],
          ['suprapubic tenderness', 'loin tenderness'],
          ['urinalysis', 'urine culture'],
          ['painful urination', 'frequent urination'],
          ['suprapubic tenderness'],
          ['vomiting', 'loin tenderness', 'toxic appearance'],
          ['refer complicated or recurrent UTI']
        ),
        [
          tx('Antibiotics', 'Treat with pediatric STG antibiotic choices based on cystitis versus pyelonephritis and local dosing tables.'),
          tx('Testing', 'Obtain urinalysis and urine culture where possible.'),
        ],
        { section: 'Section 136. Urinary Tract Infections', pdfPages: '394-398' }
      ),
      band(
        'adult',
        ADULT,
        'Adults often present with dysuria, frequency, urgency, suprapubic pain, and occasionally fever or loin pain.',
        evidence(
          ['painful urination', 'frequent urination', 'urgency', 'suprapubic pain', 'fever'],
          ['suprapubic tenderness', 'loin tenderness'],
          ['urinalysis', 'urine culture'],
          ['painful urination', 'frequent urination'],
          ['suprapubic tenderness'],
          ['loin tenderness', 'vomiting', 'pregnancy'],
          ['refer complicated, recurrent, or pyelonephritis cases']
        ),
        [
          tx('Antibiotics', 'Use nitrofurantoin, cefuroxime, ciprofloxacin, or other STG-directed therapy depending on syndrome and contraindications.'),
          tx('Testing', 'Use urinalysis and urine culture where indicated.'),
        ],
        { section: 'Section 136. Urinary Tract Infections', pdfPages: '394-398' }
      ),
    ],
  },
  {
    id: 'tuberculosis',
    title: 'Tuberculosis',
    category: 'Infectious',
    dataSource: 'curated',
    ageSensitive: true,
    duration: { minDays: 14, maxDays: 180, label: 'usually chronic over at least 2 weeks' },
    ageBands: [
      band(
        'child',
        CHILD,
        'Tuberculosis in children may be pulmonary or extrapulmonary and should be considered in chronic cough, weight loss, persistent low grade fever, failure to thrive, or neurologic/spinal features.',
        evidence(
          ['cough often for 2 weeks or more', 'chronic cough', 'persistent cough', 'cough', 'chest pain', 'loss of weight', 'loss of appetite', 'fever', 'night sweats', 'failure to thrive', 'fatigue', 'malaise', 'poor appetite', 'back pain', 'lower limb weakness', 'irritability', 'vomiting'],
          ['signs of malnutrition', 'cachexia', 'pallor', 'lymphadenopathy', 'neck stiffness', 'altered consciousness', 'spinal tenderness', 'gibbus', 'paraplegia', 'pleural effusion'],
          ['sputum smear microscopy', 'chest x-ray', 'mantoux test', 'gene xpert', 'mycobacterial culture', 'hiv screening'],
          ['chronic cough', 'loss of weight', 'failure to thrive'],
          ['cachexia', 'lymphadenopathy', 'gibbus'],
          ['impaired consciousness', 'paraplegia', 'severe malnutrition', 'haemoptysis'],
          ['refer to TB program or specialist care, especially for severe illness, TB meningitis, or spinal disease'],
          ['In children with severe malnutrition and poor response to dietary treatment, TB should be considered and excluded.']
        ),
        [
          tx('Program-based treatment', 'Treat using National TB Programme regimens and weight-based guidance from the STG/TB client card.'),
          tx('Supportive care', 'Encourage nutrition, rest, psychosocial support, and screening of close adult contacts.'),
        ],
        { section: 'Section 183. Tuberculosis', pdfPages: '471-475' }
      ),
      band(
        'adult',
        AGE_12_PLUS,
        'Pulmonary TB in adults is suggested by chronic cough, chest pain, weight loss, appetite loss, fever, blood-stained sputum, and drenching night sweats.',
        evidence(
          ['cough often for 2 weeks or more', 'chronic cough', 'persistent cough', 'cough', 'chest pain', 'loss of weight', 'loss of appetite', 'blood stained sputum', 'fever', 'drenching night sweats'],
          ['cachexia', 'pallor', 'lymphadenopathy', 'signs of pneumonia', 'pleural effusion'],
          ['sputum smear microscopy', 'chest x-ray', 'gene xpert', 'mycobacterial culture', 'hiv screening'],
          ['chronic cough', 'loss of weight', 'drenching night sweats'],
          ['cachexia', 'pleural effusion'],
          ['haemoptysis', 'respiratory distress', 'signs of extrapulmonary disease'],
          ['refer and manage under the TB program or specialist service'],
          ['Pulmonary TB patients with AFB-positive sputum are the most infectious according to the STG.']
        ),
        [
          tx('Program-based treatment', 'Use standard TB treatment regimens under the National TB Programme according to the STG and TB client card guidance.'),
          tx('Supportive care', 'Give counselling, encourage nutrition and rest, and investigate close contacts.'),
        ],
        { section: 'Section 183. Tuberculosis', pdfPages: '471-475' }
      ),
    ],
  },
  {
    id: 'typhoid-fever',
    title: 'Typhoid Fever',
    category: 'Infectious',
    dataSource: 'curated',
    ageSensitive: false,
    duration: { minDays: 5, maxDays: 21, label: 'usually a sustained febrile illness over 5-21 days' },
    ageBands: [
      band(
        'all',
        ALL_AGES,
        'Typhoid is usually a more sustained febrile illness with abdominal pain, headache, diarrhoea or constipation, and systemic toxicity.',
        evidence(
          ['fever', 'abdominal pain', 'headache', 'diarrhoea', 'constipation', 'malaise'],
          ['toxic appearance', 'abdominal tenderness'],
          ['blood culture', 'stool culture', 'full blood count'],
          [],
          ['abdominal tenderness'],
          ['intestinal bleeding', 'perforation', 'shock'],
          ['refer severe disease or complications']
        ),
        [
          tx('Antibiotics', 'Use STG-directed antibiotics such as ceftriaxone or azithromycin depending on severity and local guidance.'),
          tx('Supportive care', 'Correct fluids, electrolytes, and fever.'),
        ],
        { section: 'Section 193. Typhoid Fever', pdfPages: '506-507' }
      ),
    ],
  },
  {
    id: 'vitamin-a-deficiency-eye-disease',
    title: 'Vitamin A Deficiency / Xerophthalmia',
    category: 'Nutritional / Eye',
    dataSource: 'curated',
    ageSensitive: true,
    preferredAgeBands: ['under-five'],
    duration: { minDays: 7, maxDays: 120, label: 'usually develops progressively' },
    ageBands: [
      band(
        'under-five',
        UNDER_FIVE,
        'Vitamin A deficiency in infants and young children is largely sign-driven, with conjunctival and corneal changes being the key STG findings.',
        evidence(
          ['poor night vision', 'night blindness'],
          ['dry conjunctiva', 'grey sclera', 'conjunctival folding', 'conjunctival wrinkling', 'keratomalacia', 'cloudy cornea'],
          ['nil'],
          ['poor night vision'],
          ['dry conjunctiva', 'grey sclera', 'conjunctival folding'],
          ['keratomalacia', 'corneal ulceration'],
          ['refer urgently if keratomalacia or corneal ulceration is present'],
          ['The STG uses dry conjunctiva, grey sclera, conjunctival folding, and keratomalacia as important signs of vitamin A deficiency eye disease.']
        ),
        [
          tx('Dietary support', 'Encourage high vitamin A containing foods and address underlying malnutrition or measles where present.'),
          tx('Vitamin A treatment', 'Give oral vitamin A immediately after diagnosis, repeat after 24 hours, and again after 1 week using the STG child age dosing schedule.'),
          tx('Complication prevention', 'Treat early to prevent blindness and urgent corneal complications.'),
        ],
        { section: 'Vitamin A deficiency eye disease', pdfPages: '503-504' }
      ),
    ],
  },
  {
    id: 'constipation',
    title: 'Constipation',
    category: 'Gastrointestinal',
    dataSource: 'curated',
    ageSensitive: false,
    duration: { minDays: 3, maxDays: 90, label: 'usually persistent over days to weeks' },
    ageBands: [
      band(
        'all',
        ALL_AGES,
        'Constipation is suggested by infrequent hard stools, straining, incomplete evacuation, or obstructive bowel symptoms.',
        evidence(
          [
            'constipation',
            'passing hard stools',
            'infrequent passing of stools',
            'straining to pass stools',
            'feeling of incomplete evacuation of bowel',
            'inability to pass flatus',
            'colicky abdominal pain',
            'vomiting',
          ],
          [
            'frequent high pitched bowel sounds',
            'absent bowel sounds',
            'peritonitis',
            'abdominal mass',
          ],
          [
            'digital rectal examination',
            'stool for occult blood',
            'plain abdominal x ray',
            'proctoscopy or colonoscopy when obstruction is not suspected',
          ],
          ['passing hard stools', 'infrequent passing of stools'],
          ['absent bowel sounds', 'peritonitis'],
          ['vomiting', 'inability to pass flatus', 'peritonitis', 'absent bowel sounds'],
          [
            'refer suspected obstruction, surgical cause, or constipation resistant to treatment',
          ],
          [
            'The STG emphasizes digital rectal examination for all patients with suspected constipation.',
          ]
        ),
        [
          tx('Non-drug care', 'Use regular exercise, a high fibre diet, and adequate fluid intake where there is no contraindication.'),
          tx('Laxatives', 'Use age-appropriate stool softeners or laxatives such as lactulose, bisacodyl, senna, or glycerol suppositories according to the STG dosing tables.'),
          tx('Escalation', 'Refer suspected obstruction or surgical causes urgently instead of escalating laxatives.'),
        ],
        { section: 'Section 3. Constipation', pdfPages: '37-40' }
      ),
    ],
  },
  {
    id: 'peptic-ulcer-disease',
    title: 'Peptic Ulcer Disease',
    category: 'Gastrointestinal',
    dataSource: 'curated',
    ageSensitive: false,
    duration: { minDays: 3, maxDays: 120, label: 'usually recurrent or persistent over days to months' },
    ageBands: [
      band(
        'all',
        ALL_AGES,
        'Peptic ulcer disease is suggested by recurrent epigastric or upper abdominal burning pain, relation to meals, and dyspeptic symptoms.',
        evidence(
          [
            'epigastric pain',
            'burning epigastric pain',
            'episodic abdominal pain',
            'right hypochondrial pain',
            'retrosternal pain',
            'vomiting',
            'peri umbilical pain',
          ],
          ['epigastric tenderness', 'weight loss', 'weight gain'],
          [
            'haemoglobin',
            'h pylori stool antigen',
            'endoscopy',
            'barium meal',
            'stool examination',
          ],
          ['epigastric pain', 'burning epigastric pain'],
          ['epigastric tenderness'],
          ['vomiting blood', 'melaena', 'gastric outlet obstruction', 'perforation'],
          [
            'refer failed medical treatment, h pylori eradication failure, or surgical complications',
          ],
          [
            'The STG distinguishes gastric from duodenal ulcer by relation of pain to meals and warns that gastric ulcer may be malignant.',
          ]
        ),
        [
          tx('Non-drug care', 'Avoid alcohol, tobacco, and foods that aggravate symptoms, and reduce anxiety or stress where possible.'),
          tx('Acid suppression', 'Use antacids or PPIs such as omeprazole, esomeprazole, or pantoprazole according to the STG.'),
          tx('H. pylori eradication', 'When H. pylori is present, use a PPI plus two STG-recommended antibiotics for 10-14 days.'),
        ],
        { section: 'Section 4. Peptic Ulcer Disease', pdfPages: '40-43' }
      ),
    ],
  },
  {
    id: 'gastro-oesophageal-reflux-disease',
    title: 'Gastro-oesophageal Reflux Disease',
    category: 'Gastrointestinal',
    dataSource: 'curated',
    ageSensitive: true,
    duration: { minDays: 3, maxDays: 180, label: 'often recurrent or persistent over days to months' },
    ageBands: [
      band(
        'child',
        CHILD,
        'In children, GORD is suggested by recurrent regurgitation, vomiting, poor feeding, cough, aspiration-type symptoms, or failure to thrive.',
        evidence(
          [
            'failure to thrive',
            'refusing food',
            'vomiting',
            'coughing',
            'forceful regurgitation',
            'shortness of breath',
          ],
          ['wheeze', 'epigastric tenderness'],
          ['barium swallow', 'endoscopy when indicated', 'chest x ray'],
          ['forceful regurgitation', 'failure to thrive'],
          ['wheeze'],
          ['aspiration pneumonia', 'difficulty swallowing', 'failure to thrive'],
          ['refer severe disease, aspiration, or treatment failure'],
          [
            'The STG notes aspiration pneumonia and feeding difficulty as important paediatric clues.',
          ]
        ),
        [
          tx('Lifestyle and feeding', 'Use smaller feeds, avoid feeding close to sleep, keep the head elevated, and avoid aggravating triggers.'),
          tx('Acid suppression', 'Use omeprazole according to the STG child weight bands when medication is indicated.'),
          tx('Escalation', 'Refer severe cases, treatment failures, or children with complications such as aspiration.'),
        ],
        { section: 'Section 5. Gastro-oesophageal Reflux Disease', pdfPages: '43-45' }
      ),
      band(
        'adult',
        AGE_12_PLUS,
        'In older children and adults, GORD is suggested by heartburn, retrosternal or epigastric pain, nocturnal regurgitation, dysphagia, or odynophagia.',
        evidence(
          [
            'heartburn',
            'dyspepsia',
            'early satiety',
            'retrosternal pain',
            'epigastric pain',
            'pain on swallowing',
            'difficulty swallowing',
            'nocturnal regurgitation',
          ],
          ['epigastric tenderness', 'wheeze'],
          ['endoscopy', 'chest x ray', 'abdominal ultrasound', 'barium swallow', 'oesophageal ph monitoring'],
          ['heartburn', 'nocturnal regurgitation'],
          [],
          ['difficulty swallowing', 'pain on swallowing', 'aspiration pneumonia'],
          ['refer severe disease, complications, or treatment failure'],
          [
            'The STG specifically notes bending forward or lying flat as common aggravating factors for reflux symptoms.',
          ]
        ),
        [
          tx('Lifestyle measures', 'Elevate the head of the bed, avoid sleeping soon after meals, avoid heavy late meals, and reduce triggers such as fatty food, alcohol, smoking, and NSAIDs.'),
          tx('Medicines', 'Use antacids or PPIs such as omeprazole, esomeprazole, or rabeprazole as outlined in the STG.'),
          tx('Bloating or regurgitation', 'Add prokinetic therapy such as metoclopramide or domperidone only when STG indications fit.'),
        ],
        { section: 'Section 5. Gastro-oesophageal Reflux Disease', pdfPages: '43-45' }
      ),
    ],
  },
  {
    id: 'haemorrhoids',
    title: 'Haemorrhoids',
    category: 'Gastrointestinal',
    dataSource: 'curated',
    ageSensitive: false,
    duration: { minDays: 1, maxDays: 120, label: 'may be acute or recurrent over days to months' },
    ageBands: [
      band(
        'all',
        ALL_AGES,
        'Haemorrhoids are suggested by bright red rectal bleeding, anal swelling, pruritus, prolapse, or painful thrombosed piles.',
        evidence(
          [
            'bright red rectal bleeding',
            'passage of bright red blood at defaecation',
            'rectal bleeding',
            'anal swelling',
            'pruritus ani',
            'discomfort after opening bowels',
            'anal pain',
            'mucoid discharge',
          ],
          [
            'swelling at the anus',
            'skin tags',
            'thrombosed haemorrhoids',
            'pallor',
            'haemorrhagic shock',
          ],
          ['full blood count', 'proctoscopy', 'sigmoidoscopy'],
          ['bright red rectal bleeding', 'anal swelling'],
          ['thrombosed haemorrhoids', 'skin tags'],
          ['haemorrhagic shock', 'profuse bleeding', 'strangulation', 'infection'],
          ['refer for ligation or operative treatment when indicated'],
          [
            'The STG emphasizes digital rectal examination to exclude carcinoma and more sinister anorectal disease.',
          ]
        ),
        [
          tx('Non-drug care', 'Increase fluids and roughage, avoid prolonged straining, and use warm sitz baths for infected haemorrhoids.'),
          tx('Symptom relief', 'Use topical soothing agents and address associated constipation with stool-softening therapy.'),
          tx('Complications', 'Treat infected or anaemic cases according to the STG and refer for rubber band ligation or surgery when required.'),
        ],
        { section: 'Section 7. Haemorrhoids', pdfPages: '47-51' }
      ),
    ],
  },
  {
    id: 'amoebic-liver-abscess',
    title: 'Amoebic Liver Abscess',
    category: 'Liver',
    dataSource: 'curated',
    ageSensitive: false,
    duration: { minDays: 3, maxDays: 30, label: 'usually develops over days to weeks' },
    ageBands: [
      band(
        'all',
        ALL_AGES,
        'Amoebic liver abscess is suggested by right upper abdominal pain, fever, hepatomegaly, and chest or shoulder-referred pain.',
        evidence(
          [
            'right upper abdominal pain',
            'right hypochondrial pain',
            'fever',
            'malaise',
            'sweats',
            'cough',
            'hiccups',
            'anorexia',
            'weight loss',
            'jaundice',
            'diarrhoea',
          ],
          [
            'large tender liver',
            'tender intercostal swelling',
            'hepatomegaly',
            'jaundice',
            'basal crepitations',
            'peritonitis',
          ],
          ['abdominal ultrasound', 'chest x ray', 'full blood count', 'stool examination', 'serology'],
          ['right upper abdominal pain', 'fever'],
          ['large tender liver'],
          ['peritonitis', 'empyema', 'jaundice'],
          ['refer large abscesses or poor response to treatment'],
          [
            'The STG notes pyogenic liver abscess as an important clinical mimic.',
          ]
        ),
        [
          tx('Anti-amoebic treatment', 'Use a tissue agent such as metronidazole or tinidazole, then follow with a luminal agent such as diloxanide furoate or paromomycin according to the STG.'),
          tx('Monitoring', 'Use abdominal ultrasound and reassess clinical response during therapy.'),
          tx('Escalation', 'Refer large abscesses or cases with poor response for specialist review and possible aspiration.'),
        ],
        { section: 'Section 8. Amoebic Liver Access', pdfPages: '51-53' }
      ),
    ],
  },
  {
    id: 'acute-hepatitis',
    title: 'Acute Hepatitis',
    category: 'Liver',
    dataSource: 'curated',
    ageSensitive: false,
    duration: { minDays: 3, maxDays: 42, label: 'usually acute over days to weeks' },
    ageBands: [
      band(
        'all',
        ALL_AGES,
        'Acute hepatitis is suggested by jaundice with dark urine, pale stools, right hypochondrial pain, fever, and liver tenderness.',
        evidence(
          [
            'right hypochondrial pain',
            'fever',
            'malaise',
            'anorexia',
            'nausea',
            'vomiting',
            'dark urine',
            'pale stools',
            'itching',
            'fatigue',
            'confusion',
          ],
          ['jaundice', 'right hypochondrial tenderness', 'hepatomegaly', 'asterixis'],
          ['full blood count', 'liver function tests', 'hepatitis screen', 'abdominal ultrasound'],
          ['dark urine', 'pale stools'],
          ['jaundice', 'right hypochondrial tenderness'],
          ['confusion', 'asterixis', 'rapid progression', 'bleeding'],
          ['refer rapidly progressive disease to a physician specialist'],
          [
            'The STG advises avoiding hepatotoxic drugs such as paracetamol and high doses of anxiolytic-hypnotics in acute hepatitis.',
          ]
        ),
        [
          tx('Supportive care', 'Use rest, high-calorie fluids, tolerated feeding, and IV fluids where needed, and avoid alcohol.'),
          tx('Avoid harm', 'Avoid hepatotoxic medicines while evaluating the cause.'),
          tx('Escalation', 'Refer rapidly progressive disease, encephalopathy, or bleeding promptly.'),
        ],
        { section: 'Section 10. Acute Hepatitis', pdfPages: '55-56' }
      ),
    ],
  },
  {
    id: 'hepatic-encephalopathy',
    title: 'Hepatic Encephalopathy',
    category: 'Liver Emergency',
    dataSource: 'curated',
    ageSensitive: false,
    duration: { minDays: 1, maxDays: 21, label: 'acute deterioration over hours to days' },
    ageBands: [
      band(
        'all',
        ALL_AGES,
        'Hepatic encephalopathy is suggested by jaundice or chronic liver disease with confusion, disturbed consciousness, asterixis, or fetor hepaticus.',
        evidence(
          ['jaundice', 'confusion', 'disturbed consciousness', 'personality changes'],
          [
            'fetor hepaticus',
            'asterixis',
            'cyanosis',
            'speech impairment',
            'incoordination',
            'lethargy',
            'ascites',
          ],
          ['full blood count', 'blood glucose', 'liver function tests', 'urea and electrolytes', 'infection screen'],
          ['confusion', 'disturbed consciousness'],
          ['asterixis', 'fetor hepaticus'],
          ['coma', 'severe dehydration', 'hypoglycaemia', 'active bleeding'],
          ['refer if not improving; all children require specialist referral'],
          [
            'The STG specifically states that protein restriction should not be used in hepatic encephalopathy.',
          ]
        ),
        [
          tx('Immediate care', 'Place unconscious patients in the coma position and correct fluid, electrolyte, and glucose problems.'),
          tx('Lower ammonia', 'Use lactulose orally or rectally and add STG-directed antibiotics such as metronidazole or rifaximin when indicated.'),
          tx('Avoid precipitants', 'Avoid alcohol, paracetamol, sedatives, and other hepatotoxic or consciousness-impairing agents.'),
        ],
        { section: 'Section 12. Hepatic Encephalopathy', pdfPages: '60-64' }
      ),
    ],
  },
];

const chapter = (title: string): StgChapter => {
  const value = getChapterByTitle(title);
  if (!value) {
    throw new Error(`Unknown STG chapter: ${title}`);
  }
  return value;
};

const GI_CHAPTER = chapter('Disorders of the Gastrointestinal Tract');
const LIVER_CHAPTER = chapter('Disorders of the Liver');
const NUTRITION_CHAPTER = chapter('Nutritional Disorders');
const IMMUNISABLE_CHAPTER = chapter('Immunisable Diseases');
const NEWBORN_CHAPTER = chapter('Problems of the Newborn (Neonate)');
const RESPIRATORY_CHAPTER = chapter('Disorders of the Respiratory System');
const CNS_CHAPTER = chapter('Disorders of the Central Nervous System');
const INFECTIOUS_CHAPTER = chapter('Infectious Diseases and Infestations');
const KIDNEY_CHAPTER = chapter('Disorders of the Kidney and Genitourinary System');

const curatedConditionMetadata: Record<
  string,
  {
    chapter: StgChapter;
    triageBucketId: TriageBucketId;
    sourceEntryId: string;
  }
> = {
  'acute-diarrhoea': {
    chapter: GI_CHAPTER,
    triageBucketId: 'diarrhoea-dehydration',
    sourceEntryId: 'diarrhoea',
  },
  'rotavirus-diarrhoea': {
    chapter: GI_CHAPTER,
    triageBucketId: 'diarrhoea-dehydration',
    sourceEntryId: 'rotavirus-disease-and-diarrhoea',
  },
  constipation: {
    chapter: GI_CHAPTER,
    triageBucketId: 'gastrointestinal-bowel',
    sourceEntryId: 'constipation',
  },
  'peptic-ulcer-disease': {
    chapter: GI_CHAPTER,
    triageBucketId: 'gastrointestinal-bowel',
    sourceEntryId: 'peptic-ulcer-disease',
  },
  'gastro-oesophageal-reflux-disease': {
    chapter: GI_CHAPTER,
    triageBucketId: 'gastrointestinal-bowel',
    sourceEntryId: 'gastro-oesophageal-reflux-disease',
  },
  haemorrhoids: {
    chapter: GI_CHAPTER,
    triageBucketId: 'gastrointestinal-bowel',
    sourceEntryId: 'haemorrhoids',
  },
  'amoebic-liver-abscess': {
    chapter: LIVER_CHAPTER,
    triageBucketId: 'hepatobiliary',
    sourceEntryId: 'amoebic-liver-access',
  },
  'acute-hepatitis': {
    chapter: LIVER_CHAPTER,
    triageBucketId: 'hepatobiliary',
    sourceEntryId: 'acute-hepatitis',
  },
  'hepatic-encephalopathy': {
    chapter: LIVER_CHAPTER,
    triageBucketId: 'hepatobiliary',
    sourceEntryId: 'hepatic-encephalopathy',
  },
  measles: {
    chapter: IMMUNISABLE_CHAPTER,
    triageBucketId: 'fever-systemic',
    sourceEntryId: 'measles',
  },
  'sick-newborn-sepsis': {
    chapter: NEWBORN_CHAPTER,
    triageBucketId: 'fever-systemic',
    sourceEntryId: 'sick-newborn',
  },
  'neonatal-hypoglycaemia': {
    chapter: NEWBORN_CHAPTER,
    triageBucketId: 'neurologic-meningeal',
    sourceEntryId: 'neonatal-hypoglycaemia',
  },
  'neonatal-jaundice': {
    chapter: NEWBORN_CHAPTER,
    triageBucketId: 'hepatobiliary',
    sourceEntryId: 'neonatal-jaundice',
  },
  'vitamin-a-deficiency-eye-disease': {
    chapter: NUTRITION_CHAPTER,
    triageBucketId: 'eye-nutrition',
    sourceEntryId: 'xerophthalmia',
  },
  'common-cold': {
    chapter: RESPIRATORY_CHAPTER,
    triageBucketId: 'respiratory',
    sourceEntryId: 'common-cold',
  },
  pneumonia: {
    chapter: RESPIRATORY_CHAPTER,
    triageBucketId: 'respiratory',
    sourceEntryId: 'pneumonia',
  },
  'bronchial-asthma': {
    chapter: RESPIRATORY_CHAPTER,
    triageBucketId: 'respiratory',
    sourceEntryId: 'bronchial-asthma',
  },
  'acute-bronchitis': {
    chapter: RESPIRATORY_CHAPTER,
    triageBucketId: 'respiratory',
    sourceEntryId: 'acute-bronchitis',
  },
  meningitis: {
    chapter: CNS_CHAPTER,
    triageBucketId: 'neurologic-meningeal',
    sourceEntryId: 'meningitis',
  },
  'uncomplicated-malaria': {
    chapter: INFECTIOUS_CHAPTER,
    triageBucketId: 'fever-systemic',
    sourceEntryId: 'uncomplicated-malaria',
  },
  'severe-malaria': {
    chapter: INFECTIOUS_CHAPTER,
    triageBucketId: 'neurologic-meningeal',
    sourceEntryId: 'severe-malaria',
  },
  tuberculosis: {
    chapter: INFECTIOUS_CHAPTER,
    triageBucketId: 'respiratory',
    sourceEntryId: 'tuberculosis',
  },
  'typhoid-fever': {
    chapter: INFECTIOUS_CHAPTER,
    triageBucketId: 'fever-systemic',
    sourceEntryId: 'typhoid-fever',
  },
  'urinary-tract-infection': {
    chapter: KIDNEY_CHAPTER,
    triageBucketId: 'urinary',
    sourceEntryId: 'urinary-tract-infections',
  },
};

const curatedConditions: GuidelineCondition[] = curatedConditionsBase.map((condition) => {
  const metadata = curatedConditionMetadata[condition.id];
  if (!metadata) {
    throw new Error(`Missing chapter metadata for curated STG condition: ${condition.id}`);
  }

  return {
    ...condition,
    chapterIndex: metadata.chapter.index,
    chapterTitle: metadata.chapter.title,
    triageBucketId: metadata.triageBucketId,
    sourceEntryId: metadata.sourceEntryId,
  };
});

const curatedIds = new Set(curatedConditions.map((condition) => condition.id));
const curatedSourceEntryIds = new Set(curatedConditions.map((condition) => condition.sourceEntryId));

const normalizeSearchValue = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildSearchTokens = (...values: string[]) =>
  Array.from(
    new Set(
      values
        .flatMap((value) => normalizeSearchValue(value).split(' '))
        .filter((token) => token.length > 1)
    )
  );

const buildCuratedAliases = (title: string) => {
  const aliases = new Set<string>();
  const normalized = normalizeSearchValue(title);

  if (normalized === 'vitamin a deficiency xerophthalmia') {
    aliases.add('xerophthalmia');
    aliases.add('vitamin a deficiency eye disease');
  }

  if (normalized === 'urinary tract infection') {
    aliases.add('uti');
    aliases.add('urinary tract infections');
  }

  if (normalized === 'bronchial asthma') {
    aliases.add('asthma');
  }

  if (normalized === 'acute diarrhoea gastroenteritis') {
    aliases.add('gastroenteritis');
    aliases.add('diarrhoea');
  }

  if (normalized === 'gastro oesophageal reflux disease') {
    aliases.add('gord');
    aliases.add('gerd');
    aliases.add('reflux disease');
  }

  if (normalized === 'amoebic liver abscess') {
    aliases.add('amoebic liver access');
  }

  return Array.from(aliases);
};

const mapAgeBandForSearch = (condition: GuidelineCondition, ageBand: ConditionAgeBand): SearchableAgeBand => ({
  id: ageBand.id,
  label: ageBand.label,
  ageRange: ageBand.ageRange,
  summary: ageBand.summary,
  symptoms: ageBand.evidence.symptoms,
  signs: ageBand.evidence.signs,
  hallmarkSymptoms: ageBand.evidence.hallmarkSymptoms,
  hallmarkSigns: ageBand.evidence.hallmarkSigns,
  investigations: ageBand.evidence.investigations,
  redFlags: ageBand.evidence.redFlags,
  referralCriteria: ageBand.evidence.referralCriteria ?? [],
  treatment: ageBand.treatment,
  contraindicationsOrNotes: ageBand.contraindicationsOrNotes ?? [],
  source: ageBand.source,
});

const curatedSearchEntries: SearchableStgEntry[] = curatedConditions.map((condition) => {
  const aliases = buildCuratedAliases(condition.title);
  const pdfPages = Array.from(
    new Set(condition.ageBands.map((band) => band.source?.pdfPages).filter(Boolean))
  ).join(', ');

  return {
    id: condition.id,
    title: condition.title,
    category: condition.category,
    sourceType: 'curated',
    chapterIndex: condition.chapterIndex,
    chapterTitle: condition.chapterTitle,
    triageMode: 'ranked',
    triageReason: getRankedReason(condition.chapterTitle),
    pdfPages,
    aliases,
    normalizedTitle: normalizeSearchValue(condition.title),
    searchTokens: buildSearchTokens(condition.title, condition.category, ...aliases),
    fuzzyTitle: normalizeSearchValue(condition.title).replace(/\s+/g, ''),
    diagnosticNotes: Array.from(
      new Set(condition.ageBands.flatMap((band) => band.evidence.diagnosticNotes ?? []))
    ),
    causes: [],
    symptoms: Array.from(new Set(condition.ageBands.flatMap((band) => band.evidence.symptoms))),
    signs: Array.from(new Set(condition.ageBands.flatMap((band) => band.evidence.signs))),
    signsAndSymptoms: [],
    diagnosticClues: [],
    diagnosis: [],
    investigations: Array.from(
      new Set(condition.ageBands.flatMap((band) => band.evidence.investigations))
    ),
    treatmentObjectives: [],
    nonPharmacologicalTreatment: [],
    pharmacologicalTreatment: [],
    treatment: [],
    referralCriteria: Array.from(
      new Set(condition.ageBands.flatMap((band) => band.evidence.referralCriteria ?? []))
    ),
    prevention: [],
    counsellingPoints: [],
    complications: [],
    ageBands: condition.ageBands.map((band) => mapAgeBandForSearch(condition, band)),
  };
});

const curatedNormalizedTitles = new Set(curatedSearchEntries.map((entry) => entry.normalizedTitle));

export const searchableGeneratedSections: SearchableStgEntry[] = generatedCorpus
  .filter((entry) => !curatedIds.has(entry.id))
  .filter((entry) => !curatedSourceEntryIds.has(entry.id))
  .filter((entry) => !curatedNormalizedTitles.has(entry.normalizedTitle))
  .map<SearchableStgEntry | null>((entry) => {
    const chapterMetadata = getChapterByTitle(entry.category);
    if (!chapterMetadata) {
      return null;
    }

    const symptoms = sanitizeGeneratedTerms([
      ...entry.symptoms,
      ...entry.signsAndSymptoms,
    ]);
    const signs = sanitizeGeneratedTerms([
      ...entry.signs,
      ...entry.diagnosticClues,
    ]);
    const investigations = sanitizeGeneratedTerms(entry.investigations);
    const diagnosticNotes = sanitizeGeneratedTerms([
      ...entry.diagnosticNotes,
      ...entry.diagnosis,
    ]);

    if (!symptoms.length && !signs.length && !investigations.length && !diagnosticNotes.length) {
      return null;
    }

    return {
      id: entry.id,
      title: entry.title,
      category: entry.category,
      sourceType: 'generated',
      chapterIndex: chapterMetadata.index,
      chapterTitle: chapterMetadata.title,
      triageMode: 'reference_only',
      triageReason: getReferenceReason(entry.title, chapterMetadata.title),
      pdfPages: entry.pdfPages,
      aliases: entry.aliases,
      normalizedTitle: entry.normalizedTitle,
      searchTokens: entry.searchTokens,
      fuzzyTitle: entry.fuzzyTitle,
      diagnosticNotes: entry.diagnosticNotes,
      causes: entry.causes,
      symptoms: entry.symptoms,
      signs: entry.signs,
      signsAndSymptoms: entry.signsAndSymptoms,
      diagnosticClues: entry.diagnosticClues,
      diagnosis: entry.diagnosis,
      investigations: entry.investigations,
      treatmentObjectives: entry.treatmentObjectives,
      nonPharmacologicalTreatment: entry.nonPharmacologicalTreatment,
      pharmacologicalTreatment: entry.pharmacologicalTreatment,
      treatment: entry.treatment,
      referralCriteria: entry.referralCriteria,
      prevention: entry.prevention,
      counsellingPoints: entry.counsellingPoints,
      complications: entry.complications,
      ageBands: [],
    };
  })
  .filter((section): section is SearchableStgEntry => section !== null);

export const searchableStgEntries: SearchableStgEntry[] = [
  ...curatedSearchEntries,
  ...searchableGeneratedSections,
];

const buildClinicalVocabulary = (terms: string[]) =>
  Array.from(
    new Set(
      terms
        .map((term) => term.replace(/\s+/g, ' ').trim().toLowerCase())
        .filter((term) => term.length >= 3 && term.length <= 80)
    )
  ).sort((left, right) => left.localeCompare(right));

export const symptomVocabulary = buildClinicalVocabulary([
  ...curatedConditions.flatMap((condition) =>
    condition.ageBands.flatMap((ageBand) => [
      ...ageBand.evidence.symptoms,
      ...ageBand.evidence.hallmarkSymptoms,
    ])
  ),
  ...searchableGeneratedSections.flatMap((entry) =>
    sanitizeGeneratedTerms([...entry.symptoms, ...entry.signsAndSymptoms])
  ),
]);

export const signVocabulary = buildClinicalVocabulary([
  ...curatedConditions.flatMap((condition) =>
    condition.ageBands.flatMap((ageBand) => [
      ...ageBand.evidence.signs,
      ...ageBand.evidence.hallmarkSigns,
    ])
  ),
  ...searchableGeneratedSections.flatMap((entry) =>
    sanitizeGeneratedTerms([...entry.signs, ...entry.diagnosticClues])
  ),
]);

export const generatedCorpusCount = searchableGeneratedSections.length;

export const guidelineConditions: GuidelineCondition[] = curatedConditions;

export const stgChapterSummaries: StgChapterSummary[] = stgChapters.map((chapter) => {
  const entries = searchableStgEntries.filter((entry) => entry.chapterIndex === chapter.index);
  const rankedSections = entries.filter((entry) => entry.triageMode === 'ranked').length;
  const referenceOnlySections = entries.filter((entry) => entry.triageMode === 'reference_only').length;
  const excludedSections = entries.filter((entry) => entry.triageMode === 'excluded').length;

  return {
    index: chapter.index,
    title: chapter.title,
    totalSections: entries.length,
    rankedSections,
    referenceOnlySections,
    excludedSections,
    isComplete: entries.length > 0 && rankedSections + referenceOnlySections + excludedSections === entries.length,
  };
});
