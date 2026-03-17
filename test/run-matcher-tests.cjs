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
    'src/data/conditions.ts',
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

const { detectEmergencySignals, formatDurationToDays, getMatches } = require(
  path.join(outDir, 'lib', 'matcher.js')
);

const cases = [
  {
    name: 'malaria-like symptoms rank uncomplicated malaria first',
    run() {
      const results = getMatches('fever, chills, headache, body aches, vomiting', 3);
      assert.equal(results[0]?.condition.id, 'uncomplicated-malaria');
    },
  },
  {
    name: 'uti-like symptoms rank urinary tract infection first',
    run() {
      const results = getMatches('painful urination, frequent urination, suprapubic pain, fever', 4);
      assert.equal(results[0]?.condition.id, 'urinary-tract-infection');
    },
  },
  {
    name: 'reflux-like symptoms rank GORD first for chronic heartburn symptoms',
    run() {
      const results = getMatches('heartburn, regurgitation, retrosternal pain, night cough', 21);
      assert.equal(results[0]?.condition.id, 'gord');
    },
  },
  {
    name: 'meningitis-like symptoms trigger emergency signals',
    run() {
      const results = getMatches('fever, severe headache, neck stiffness, vomiting, confusion', 2);
      assert.equal(results[0]?.condition.id, 'meningitis');
      assert.ok(detectEmergencySignals(results).includes('neck stiffness'));
    },
  },
  {
    name: 'duration conversion handles weeks and invalid values',
    run() {
      assert.equal(formatDurationToDays('2', 'weeks'), 14);
      assert.equal(formatDurationToDays('0', 'days'), null);
      assert.equal(formatDurationToDays('1.5', 'months'), 45);
    },
  },
  {
    name: 'duration alone does not create low-information matches',
    run() {
      const results = getMatches('fatigue', 3);
      assert.equal(results.length, 0);
    },
  },
  {
    name: 'generic fever does not inflate typhoid ranking',
    run() {
      const results = getMatches('fever', 2);
      assert.equal(results[0]?.condition.id, 'uncomplicated-malaria');
      assert.notEqual(results[1]?.condition.id, 'typhoid-fever');
    },
  },
];

for (const testCase of cases) {
  testCase.run();
  console.log(`PASS ${testCase.name}`);
}

console.log(`PASS ${cases.length} matcher checks`);
