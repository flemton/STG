const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const outDir = '/tmp/stg-test-build';

execFileSync(
  'npx',
  [
    'tsc',
    'src/lib/matcher.ts',
    'src/lib/clinical-input.ts',
    'src/lib/search.ts',
    'src/data/conditions.ts',
    'src/data/generated-corpus.ts',
    'src/types.ts',
    '--module',
    'commonjs',
    '--target',
    'es2020',
    '--outDir',
    outDir,
    '--esModuleInterop',
    '--skipLibCheck',
  ],
  { cwd: root, stdio: 'pipe' }
);

const {
  detectEmergencySignals,
  formatAgeToNormalized,
  formatDurationToDays,
  getMatches,
} = require(path.join(outDir, 'lib', 'matcher.js'));
const {
  getApplicableAgeBand,
  getSearchEntryById,
  searchDiseases,
} = require(path.join(outDir, 'lib', 'search.js'));
const {
  getClinicalSuggestions,
  replaceLastClinicalFragment,
} = require(path.join(outDir, 'lib', 'clinical-input.js'));
const { generatedCorpus } = require(path.join(outDir, 'data', 'generated-corpus.js'));
const {
  searchableStgEntries,
  signVocabulary,
  stgChapterSummaries,
  symptomVocabulary,
} = require(path.join(outDir, 'data', 'conditions.js'));

const age = (value, unit) => formatAgeToNormalized(String(value), unit);

const cases = [
  {
    name: 'adult malaria symptoms do not let meningitis outrank uncomplicated malaria',
    run() {
      const results = getMatches('fever, chills, rigors, headache, body pains, vomiting', '', 3, age(25, 'years'));
      assert.equal(results[0]?.condition.id, 'uncomplicated-malaria');
      assert.notEqual(results[0]?.condition.id, 'meningitis');
    },
  },
  {
    name: 'dehydration signs keep diarrhoeal illness ahead of meningitis',
    run() {
      const results = getMatches('diarrhoea, vomiting, thirst', 'sunken eyes, poor drinking', 2, age(2, 'years'));
      assert.ok(['acute-diarrhoea', 'rotavirus-diarrhoea'].includes(results[0]?.condition.id));
      assert.ok(results.findIndex((item) => item.condition.id === 'meningitis') > 0 || !results.some((item) => item.condition.id === 'meningitis'));
    },
  },
  {
    name: 'generic fever headache vomiting does not produce dominant high-confidence meningitis',
    run() {
      const results = getMatches('fever, headache, vomiting', '', 2, age(21, 'years'));
      const meningitis = results.find((item) => item.condition.id === 'meningitis');
      assert.ok(!meningitis || meningitis.confidenceLabel === 'Low' || meningitis.needsHallmarkFindings);
      assert.ok(!results.some((item) => item.matchedSymptoms.length === 1 && item.matchedSymptoms[0] === 'vomiting'));
    },
  },
  {
    name: 'adult acute diarrhoeal cluster returns a sensible low-confidence fallback instead of nothing',
    run() {
      const results = getMatches('fever, headache, diarrhoea, vomiting', '', 3, age(40, 'years'));
      assert.equal(results[0]?.condition.id, 'acute-diarrhoea');
      assert.ok(!results.some((item) => item.condition.id === 'urinary-tract-infection'));
    },
  },
  {
    name: 'adult typhoid symptom cluster surfaces typhoid when duration fits',
    run() {
      const results = getMatches('fever, headache, abdominal pain, diarrhoea', '', 5, age(40, 'years'));
      assert.equal(results[0]?.condition.id, 'typhoid-fever');
    },
  },
  {
    name: 'short febrile abdominal illness does not prematurely surface typhoid without duration fit',
    run() {
      const results = getMatches('fever, headache, abdominal pain, diarrhoea, malaise', '', 2, age(28, 'years'));
      assert.ok(!results.some((item) => item.condition.id === 'typhoid-fever'));
    },
  },
  {
    name: 'adult pneumonia cluster does not leak malaria on breathing overlap alone',
    run() {
      const results = getMatches('fever, cough, chest pain, shortness of breath', '', 4, age(40, 'years'));
      assert.equal(results[0]?.condition.id, 'pneumonia');
      assert.ok(!results.some((item) => item.condition.id === 'uncomplicated-malaria'));
    },
  },
  {
    name: 'common cold cluster surfaces common cold rather than pneumonia',
    run() {
      const results = getMatches('runny nose, sneezing, nasal congestion, sore throat, mild fever, cough', '', 3, age(24, 'years'));
      assert.equal(results[0]?.condition.id, 'common-cold');
    },
  },
  {
    name: 'acute bronchitis cluster surfaces acute bronchitis',
    run() {
      const results = getMatches('dry cough, sputum production, sore throat, pleuritic chest pain, low grade fever', 'rhonchi', 5, age(24, 'years'));
      assert.equal(results[0]?.condition.id, 'acute-bronchitis');
    },
  },
  {
    name: 'common clinical misspellings still recover acute bronchitis',
    run() {
      const results = getMatches('dry couh, sputm prodction, sore throat', 'rhonci', 5, age(24, 'years'));
      assert.equal(results[0]?.condition.id, 'acute-bronchitis');
    },
  },
  {
    name: 'common malaria symptom misspellings still recover uncomplicated malaria',
    run() {
      const results = getMatches('fevr, chils, hedache, body pans, vomitting', '', 3, age(25, 'years'));
      assert.equal(results[0]?.condition.id, 'uncomplicated-malaria');
    },
  },
  {
    name: 'fever vomiting altered consciousness without diarrhoeal features does not leak rotavirus or acute diarrhoea',
    run() {
      const results = getMatches('fever, vomiting, headache', 'altered consciousness, convulsions', 2, age(4, 'years'));
      assert.ok(!results.some((item) => item.condition.id === 'rotavirus-diarrhoea'));
      assert.ok(!results.some((item) => item.condition.id === 'acute-diarrhoea'));
      assert.ok(!results.some((item) => item.condition.id === 'urinary-tract-infection'));
    },
  },
  {
    name: 'measles cluster surfaces measles in a child with rash and conjunctivitis',
    run() {
      const results = getMatches('runny nose, cough, red eyes, high fever, rash, diarrhoea', 'conjunctivitis, koplik spots', 4, age(2, 'years'));
      assert.equal(results[0]?.condition.id, 'measles');
    },
  },
  {
    name: 'chronic cough with weight loss and night sweats surfaces tuberculosis',
    run() {
      const results = getMatches('chronic cough, chest pain, loss of weight, drenching night sweats, fever', '', 21, age(30, 'years'));
      assert.equal(results[0]?.condition.id, 'tuberculosis');
    },
  },
  {
    name: 'infant meningitis with bulging fontanelle surfaces meningitis and urgent signals',
    run() {
      const results = getMatches('fever, poor feeding, vomiting', 'bulging fontanelle', 2, age(6, 'months'));
      assert.equal(results[0]?.condition.id, 'meningitis');
      assert.ok(results[0]?.matchedSigns.includes('bulging fontanelle'));
      assert.ok(detectEmergencySignals(results).includes('bulging fontanelle'));
    },
  },
  {
    name: 'same urinary symptoms use different age-specific bands for child and adult',
    run() {
      const childResults = getMatches('painful urination, frequent urination, suprapubic pain, fever', '', 4, age(8, 'years'));
      const adultResults = getMatches('painful urination, frequent urination, suprapubic pain, fever', '', 4, age(29, 'years'));
      assert.equal(childResults[0]?.condition.id, 'urinary-tract-infection');
      assert.equal(adultResults[0]?.condition.id, 'urinary-tract-infection');
      assert.notEqual(childResults[0]?.ageBand.id, adultResults[0]?.ageBand.id);
    },
  },
  {
    name: 'neonatal symptoms surface sick newborn above adult disease sections',
    run() {
      const results = getMatches('poor feeding, weak cry, fever', 'difficulty breathing', 1, age(7, 'days'));
      assert.equal(results[0]?.condition.id, 'sick-newborn-sepsis');
      assert.equal(results[0]?.ageBand.id, 'neonate');
    },
  },
  {
    name: 'same symptoms with meningeal signs change ranking appropriately',
    run() {
      const generic = getMatches('fever, headache, vomiting', '', 2, age(21, 'years'));
      const withSigns = getMatches('fever, headache, vomiting', 'neck stiffness, photophobia', 2, age(21, 'years'));
      assert.notEqual(generic[0]?.condition.id, 'meningitis');
      assert.equal(withSigns[0]?.condition.id, 'meningitis');
    },
  },
  {
    name: 'guided respiratory selections produce a single reliable primary answer',
    run() {
      const results = getMatches('', '', 4, age(40, 'years'), {
        selectedSymptoms: ['cough', 'shortness of breath', 'chest pain'],
        selectedSigns: ['chest indrawing', 'crepitations'],
        preferredConditionIds: [
          'pneumonia',
          'bronchial-asthma',
          'acute-bronchitis',
          'common-cold',
          'tuberculosis',
        ],
      });
      assert.equal(results[0]?.condition.id, 'pneumonia');
      assert.ok(results[0]?.structuredEvidenceHits >= 4);
      assert.equal(results[0]?.confidenceGateStatus, 'reliable');
    },
  },
  {
    name: 'guided pathway still refuses a reliable answer when evidence is too generic',
    run() {
      const results = getMatches('', '', 2, age(30, 'years'), {
        selectedSymptoms: ['fever'],
        selectedSigns: [],
        preferredConditionIds: [
          'uncomplicated-malaria',
          'severe-malaria',
          'typhoid-fever',
          'meningitis',
          'measles',
          'sick-newborn-sepsis',
        ],
      });
      assert.ok(results.length === 0 || results[0].confidenceGateStatus !== 'reliable');
    },
  },
  {
    name: 'sign-heavy vitamin A deficiency eye findings return the curated condition',
    run() {
      const results = getMatches('poor night vision', 'dry conjunctiva, grey sclera, conjunctival folding', 2, age(2, 'months'));
      assert.equal(results[0]?.condition.id, 'vitamin-a-deficiency-eye-disease');
      assert.ok(results[0]?.matchedSigns.includes('dry conjunctiva'));
    },
  },
  {
    name: 'sign-only input can still rank sign-driven conditions',
    run() {
      const results = getMatches('', 'dry conjunctiva, grey sclera, conjunctival folding', 2, age(2, 'months'));
      assert.equal(results[0]?.condition.id, 'vitamin-a-deficiency-eye-disease');
    },
  },
  {
    name: 'adult GORD symptoms rank GORD above other upper GI conditions',
    run() {
      const results = getMatches('heartburn, nocturnal regurgitation, epigastric pain', '', 14, age(30, 'years'));
      assert.equal(results[0]?.condition.id, 'gastro-oesophageal-reflux-disease');
      assert.ok(results[0]?.score > (results[1]?.score ?? 0));
    },
  },
  {
    name: 'epigastric pain with tenderness ranks peptic ulcer disease',
    run() {
      const results = getMatches('epigastric pain, burning epigastric pain, vomiting', 'epigastric tenderness', 14, age(30, 'years'));
      assert.equal(results[0]?.condition.id, 'peptic-ulcer-disease');
    },
  },
  {
    name: 'constipation symptoms surface constipation',
    run() {
      const results = getMatches(
        'passing hard stools, straining to pass stools, feeling of incomplete evacuation of bowel',
        '',
        7,
        age(30, 'years')
      );
      assert.equal(results[0]?.condition.id, 'constipation');
    },
  },
  {
    name: 'bright red rectal bleeding and anal swelling surface haemorrhoids',
    run() {
      const results = getMatches('bright red rectal bleeding, anal swelling', 'skin tags', 7, age(30, 'years'));
      assert.equal(results[0]?.condition.id, 'haemorrhoids');
    },
  },
  {
    name: 'right upper abdominal pain with fever and tender liver surfaces amoebic liver abscess',
    run() {
      const results = getMatches('right upper abdominal pain, fever, malaise', 'large tender liver', 7, age(30, 'years'));
      assert.equal(results[0]?.condition.id, 'amoebic-liver-abscess');
    },
  },
  {
    name: 'jaundice with dark urine and right hypochondrial tenderness surfaces acute hepatitis',
    run() {
      const results = getMatches('dark urine, pale stools, malaise', 'jaundice, right hypochondrial tenderness', 7, age(30, 'years'));
      assert.equal(results[0]?.condition.id, 'acute-hepatitis');
    },
  },
  {
    name: 'confusion with jaundice and asterixis surfaces hepatic encephalopathy',
    run() {
      const results = getMatches('jaundice, confusion', 'asterixis, fetor hepaticus', 3, age(30, 'years'));
      assert.equal(results[0]?.condition.id, 'hepatic-encephalopathy');
    },
  },
  {
    name: 'low-information input stays empty instead of producing noisy matches',
    run() {
      const results = getMatches('fatigue', '', 3, age(25, 'years'));
      assert.equal(results.length, 0);
    },
  },
  {
    name: 'symptom suggestions offer STG correction candidates while typing',
    run() {
      const suggestions = getClinicalSuggestions('fevr, vomitt', symptomVocabulary);
      assert.equal(suggestions[0]?.term, 'vomiting');
      assert.equal(replaceLastClinicalFragment('fevr, vomitt', 'vomiting'), 'fevr, vomiting, ');
    },
  },
  {
    name: 'sign suggestions offer STG correction candidates while typing',
    run() {
      const suggestions = getClinicalSuggestions('dry conjunctiva, rhonci', signVocabulary);
      assert.equal(suggestions[0]?.term, 'rhonchi');
      assert.equal(replaceLastClinicalFragment('dry conjunctiva, rhonci', 'rhonchi'), 'dry conjunctiva, rhonchi, ');
    },
  },
  {
    name: 'selecting a suggestion from an empty field leaves the next entry ready',
    run() {
      assert.equal(replaceLastClinicalFragment('', 'fever'), 'fever, ');
    },
  },
  {
    name: 'clinical suggestions stay empty for very short fragments',
    run() {
      assert.equal(getClinicalSuggestions('f', symptomVocabulary).length, 0);
      assert.equal(getClinicalSuggestions('n', signVocabulary).length, 0);
    },
  },
  {
    name: 'clinical suggestions prefer direct prefix hits before fuzzy fallback',
    run() {
      const suggestions = getClinicalSuggestions('dry con', signVocabulary, 6, {
        allowFuzzy: false,
      });
      assert.equal(suggestions[0]?.reason, 'prefix');
      assert.equal(suggestions[0]?.term, 'dry conjunctiva');
    },
  },
  {
    name: 'generated corpus search contributes broader STG sections for non-curated topics',
    run() {
      const results = searchDiseases('acute epiglottitis');
      assert.equal(results[0]?.entry.title, 'Acute Epiglottitis');
      assert.equal(results[0]?.entry.sourceType, 'generated');
      assert.equal(results[0]?.entry.triageMode, 'reference_only');
    },
  },
  {
    name: 'exact disease title search returns the intended condition first',
    run() {
      const results = searchDiseases('meningitis');
      assert.equal(results[0]?.entry.title, 'Meningitis');
      assert.equal(results[0]?.matchStrength, 'exact');
    },
  },
  {
    name: 'alias search supports common abbreviations like GORD',
    run() {
      const results = searchDiseases('gord');
      assert.equal(results[0]?.entry.title, 'Gastro-oesophageal Reflux Disease');
      assert.ok(['alias', 'exact'].includes(results[0]?.matchStrength));
    },
  },
  {
    name: 'fuzzy disease search suggests close spellings',
    run() {
      const results = searchDiseases('meningtis');
      assert.equal(results[0]?.entry.title, 'Meningitis');
      assert.ok(['fuzzy', 'prefix', 'token'].includes(results[0]?.matchStrength));
    },
  },
  {
    name: 'search stays on the fast path when fuzzy matching is disabled',
    run() {
      const results = searchDiseases('meningtis', { allowFuzzy: false, limit: 16 });
      assert.equal(results.length, 0);
      const prefixResults = searchDiseases('men', { allowFuzzy: false, limit: 16 });
      assert.equal(prefixResults[0]?.entry.title, 'Meningitis');
      assert.equal(prefixResults[0]?.matchStrength, 'prefix');
    },
  },
  {
    name: 'generated-only condition search still returns STG entry details',
    run() {
      const results = searchDiseases('stroke');
      assert.equal(results[0]?.entry.title, 'Stroke');
      assert.equal(results[0]?.entry.sourceType, 'generated');
    },
  },
  {
    name: 'TOC-backed search now includes previously missing STG sections',
    run() {
      assert.equal(searchDiseases('haemorrhoids')[0]?.entry.title, 'Haemorrhoids');
      assert.equal(
        searchDiseases('acute epiglottitis')[0]?.entry.title,
        'Acute Epiglottitis'
      );
      assert.equal(
        searchDiseases('seasonal malaria chemoprevention')[0]?.entry.title,
        'Seasonal Malaria Chemoprevention (SMC)'
      );
    },
  },
  {
    name: 'search aliases cover corrected clinical spellings for STG typos',
    run() {
      const results = searchDiseases('amoebic liver abscess');
      assert.equal(results[0]?.entry.id, 'amoebic-liver-abscess');
    },
  },
  {
    name: 'generated corpus keeps full TOC-scale search coverage',
    run() {
      assert.ok(generatedCorpus.length >= 260);
    },
  },
  {
    name: 'search detail exposes age-specific guidance when age is available',
    run() {
      const entry = getSearchEntryById('meningitis');
      const band = getApplicableAgeBand(entry, age(6, 'months'));
      assert.equal(band?.id, 'infant');
    },
  },
  {
    name: 'diarrhoea reference entry now exposes aligned STG symptoms from the correct section',
    run() {
      const entry = generatedCorpus.find((item) => item.id === 'diarrhoea');
      assert.ok(entry);
      assert.ok(entry.symptoms.includes('Frequent watery stools'));
      assert.ok(entry.symptoms.includes('Associated vomiting'));
      assert.ok(entry.pdfPages.startsWith('29-'));
    },
  },
  {
    name: 'haemorrhoids reference entry exposes the expected bleeding and anal symptoms',
    run() {
      const entry = generatedCorpus.find((item) => item.id === 'haemorrhoids');
      assert.ok(entry);
      assert.ok(entry.symptoms.includes('Passage of bright red blood at defaecation'));
      assert.ok(entry.signs.includes('Pallor'));
      assert.ok(
        entry.diagnosticNotes[0]?.toLowerCase().includes('anal bleeding') ||
          entry.diagnosticNotes[0]?.toLowerCase().includes('haemorrhoids')
      );
    },
  },
  {
    name: 'amoebic liver abscess reference entry exposes liver abscess features instead of diarrhoeal carry-over',
    run() {
      const entry = generatedCorpus.find((item) => item.id === 'amoebic-liver-access');
      assert.ok(entry);
      assert.ok(
        entry.symptoms.some((item) => item.toLowerCase().includes('right upper abdominal pain'))
      );
      assert.ok(entry.signs.some((item) => item.toLowerCase().includes('large tender liver')));
    },
  },
  {
    name: 'all searchable STG entries now carry chapter and triage metadata',
    run() {
      assert.ok(searchableStgEntries.length >= 260);
      for (const entry of searchableStgEntries) {
        assert.ok(Number.isInteger(entry.chapterIndex) && entry.chapterIndex >= 1 && entry.chapterIndex <= 30);
        assert.ok(entry.chapterTitle.length > 0);
        assert.ok(['ranked', 'reference_only', 'excluded'].includes(entry.triageMode));
        assert.ok(entry.triageReason.length > 0);
      }
    },
  },
  {
    name: 'chapter summaries cover all 30 STG chapters and are fully classified',
    run() {
      assert.equal(stgChapterSummaries.length, 30);
      assert.ok(stgChapterSummaries.every((chapter) => chapter.isComplete));
      assert.ok(stgChapterSummaries.every((chapter) => chapter.totalSections > 0));
      assert.ok(
        stgChapterSummaries.some(
          (chapter) =>
            chapter.title === 'Disorders of the Gastrointestinal Tract' &&
            chapter.rankedSections >= 4
        )
      );
    },
  },
  {
    name: 'duration conversion handles invalid values',
    run() {
      assert.equal(formatDurationToDays('2', 'weeks'), 14);
      assert.equal(formatDurationToDays('0', 'days'), null);
      assert.equal(formatDurationToDays('1.5', 'months'), null);
    },
  },
  {
    name: 'age conversion handles units and rejects invalid values',
    run() {
      assert.equal(age(14, 'days').days, 14);
      assert.equal(age(6, 'months').days, 180);
      assert.equal(age(2, 'years').days, 730);
      assert.equal(formatAgeToNormalized('0', 'years'), null);
      assert.equal(formatAgeToNormalized('1.5', 'years'), null);
    },
  },
  {
    name: 'missing age returns no ranking',
    run() {
      assert.equal(getMatches('fever, cough', '', 2, null).length, 0);
      assert.equal(getMatches('fever, cough', '', 2, formatAgeToNormalized('', 'years')).length, 0);
    },
  },
];

for (const testCase of cases) {
  testCase.run();
  console.log(`PASS ${testCase.name}`);
}

console.log(`PASS ${cases.length} matcher checks`);
