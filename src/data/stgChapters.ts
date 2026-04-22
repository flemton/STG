import { StgChapter, TriageMode } from '../types';

export const stgChapters: StgChapter[] = [
  { index: 1, title: 'Disorders of the Gastrointestinal Tract' },
  { index: 2, title: 'Disorders of the Liver' },
  { index: 3, title: 'Nutritional Disorders' },
  { index: 4, title: 'Haematological Disorders' },
  { index: 5, title: 'Immunisable Diseases' },
  { index: 6, title: 'Problems of the Newborn (Neonate)' },
  { index: 7, title: 'Eye Disorders' },
  { index: 8, title: 'Disorders of the Cardiovascular System' },
  { index: 9, title: 'Obstetric Care and Obstetric Disorders' },
  { index: 10, title: 'Disorders of the Respiratory System' },
  { index: 11, title: 'Disorders of the Central Nervous System' },
  { index: 12, title: 'Psychiatric Disorders' },
  { index: 13, title: 'Disorders of the Skin' },
  { index: 14, title: 'Endocrine and Metabolic Disorders' },
  { index: 15, title: 'Infectious Diseases and Infestations' },
  { index: 16, title: 'Gynaecological Disorders' },
  { index: 17, title: 'Disorders of the Kidney and Genitourinary System' },
  { index: 18, title: 'Sexually Transmitted Infections' },
  { index: 19, title: 'HIV Infections and AIDS' },
  { index: 20, title: 'Ear, Nose and Throat Disorders' },
  { index: 21, title: 'Oral and Dental Conditions' },
  { index: 22, title: 'Disorders Of The Musculoskeletal System' },
  { index: 23, title: 'Trauma And Injuries' },
  { index: 24, title: 'General Emergencies' },
  { index: 25, title: 'Antibiotic Prophylaxis In Surgery' },
  { index: 26, title: 'Management of Acute Pain' },
  { index: 27, title: 'Common Malignancies' },
  { index: 28, title: 'General Management Of Poisoning' },
  { index: 29, title: 'Local Anaesthetic Agents' },
  { index: 30, title: 'Structured Approach to the Seriously Ill Child' },
];

const chapterByTitle = new Map(stgChapters.map((chapter) => [chapter.title, chapter]));

const managementFocusedChapters = new Set([
  'General Emergencies',
  'Antibiotic Prophylaxis In Surgery',
  'Management of Acute Pain',
  'General Management Of Poisoning',
  'Local Anaesthetic Agents',
  'Structured Approach to the Seriously Ill Child',
]);

const syndromeLikeTitles = new Set([
  'anaemia',
  'chest pain',
  'dyspnoea',
  'jaundice',
  'pain originating from the oesophagus',
  'vomiting',
]);

const normalizeValue = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const getChapterByTitle = (title: string) => chapterByTitle.get(title) ?? null;

export const getReferenceReason = (title: string, chapterTitle: string): string => {
  const normalizedTitle = normalizeValue(title);

  if (managementFocusedChapters.has(chapterTitle)) {
    return 'This STG section is management-focused or procedural, so it stays as searchable reference only.';
  }

  if (syndromeLikeTitles.has(normalizedTitle)) {
    return 'This STG section describes a broad syndrome or problem list and stays as reference-only until a safer curated triage pathway is encoded.';
  }

  return 'This STG section is searchable for confirmation and reference, but it has not yet been promoted into the curated guided triage rules.';
};

export const getRankedReason = (chapterTitle: string): string =>
  `This section has been promoted into the curated guided triage layer for ${chapterTitle} and can be ranked from STG symptoms, signs, age bands, and treatment guidance.`;

export const getDefaultChapterTriageMode = (chapterTitle: string): TriageMode =>
  managementFocusedChapters.has(chapterTitle) ? 'reference_only' : 'reference_only';
