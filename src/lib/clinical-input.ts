const MAX_PREFIX_LENGTH = 12;
const MAX_TOKEN_PREFIX_LENGTH = 10;
const DIRECT_CANDIDATE_CAP = 24;
const FUZZY_CANDIDATE_CAP = 80;

type SuggestionReason = 'exact' | 'prefix' | 'token' | 'fuzzy';

type SuggestionCandidate = {
  term: string;
  score: number;
  reason: SuggestionReason;
};

type ClinicalIndexEntry = {
  term: string;
  normalized: string;
  flattened: string;
  tokens: string[];
};

type ClinicalSuggestionEngine = {
  entries: ClinicalIndexEntry[];
  exactMap: Map<string, ClinicalIndexEntry[]>;
  prefixMap: Map<string, ClinicalIndexEntry[]>;
  tokenPrefixMap: Map<string, ClinicalIndexEntry[]>;
  flattenedBuckets: Map<string, ClinicalIndexEntry[]>;
};

type SuggestionOptions = {
  allowFuzzy?: boolean;
  limit?: number;
};

const engineCache = new WeakMap<string[], ClinicalSuggestionEngine>();

const normalizeClinicalText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9,\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const flattenClinicalText = (value: string) => normalizeClinicalText(value).replace(/\s+/g, '');

const pushUnique = <T>(map: Map<string, T[]>, key: string, value: T) => {
  const existing = map.get(key);
  if (!existing) {
    map.set(key, [value]);
    return;
  }

  if (!existing.includes(value)) {
    existing.push(value);
  }
};

const indexPrefixes = (map: Map<string, ClinicalIndexEntry[]>, value: string, entry: ClinicalIndexEntry, maxLength: number) => {
  const limit = Math.min(value.length, maxLength);
  for (let index = 1; index <= limit; index += 1) {
    pushUnique(map, value.slice(0, index), entry);
  }
};

const buildClinicalSuggestionEngine = (vocabulary: string[]) => {
  const cached = engineCache.get(vocabulary);
  if (cached) {
    return cached;
  }

  const dedupedTerms = Array.from(
    new Set(vocabulary.map((term) => normalizeClinicalText(term)).filter(Boolean))
  );

  const entries = dedupedTerms.map<ClinicalIndexEntry>((term) => ({
    term,
    normalized: term,
    flattened: flattenClinicalText(term),
    tokens: term.split(' ').filter(Boolean),
  }));

  const engine: ClinicalSuggestionEngine = {
    entries,
    exactMap: new Map(),
    prefixMap: new Map(),
    tokenPrefixMap: new Map(),
    flattenedBuckets: new Map(),
  };

  for (const entry of entries) {
    pushUnique(engine.exactMap, entry.normalized, entry);
    indexPrefixes(engine.prefixMap, entry.normalized, entry, MAX_PREFIX_LENGTH);

    for (const token of entry.tokens) {
      indexPrefixes(engine.tokenPrefixMap, token, entry, MAX_TOKEN_PREFIX_LENGTH);
    }

    const bucketKey = entry.flattened.charAt(0);
    if (bucketKey) {
      pushUnique(engine.flattenedBuckets, bucketKey, entry);
    }
  }

  engineCache.set(vocabulary, engine);
  return engine;
};

const getLastFragment = (input: string) => {
  const parts = input.split(',');
  return parts[parts.length - 1]?.trim() ?? '';
};

const levenshteinDistance = (left: string, right: string, maxDistance = Infinity) => {
  if (left === right) {
    return 0;
  }

  if (Math.abs(left.length - right.length) > maxDistance) {
    return maxDistance + 1;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array(right.length + 1).fill(0);

  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row;
    let rowMin = current[0];

    for (let col = 1; col <= right.length; col += 1) {
      const substitutionCost = left[row - 1] === right[col - 1] ? 0 : 1;
      current[col] = Math.min(
        previous[col] + 1,
        current[col - 1] + 1,
        previous[col - 1] + substitutionCost
      );
      rowMin = Math.min(rowMin, current[col]);
    }

    if (rowMin > maxDistance) {
      return maxDistance + 1;
    }

    for (let col = 0; col <= right.length; col += 1) {
      previous[col] = current[col];
    }
  }

  return previous[right.length];
};

export const splitClinicalInput = (input: string) => {
  const normalized = normalizeClinicalText(input);
  if (!normalized) {
    return [];
  }

  return Array.from(
    new Set(
      normalized
        .split(/,|\band\b|\n|\/|;/)
        .map((part) => part.trim())
        .filter((part) => part.length > 1)
    )
  );
};

const buildDirectSuggestions = (
  normalizedFragment: string,
  engine: ClinicalSuggestionEngine
) => {
  const candidates = new Map<string, SuggestionCandidate>();
  const exactEntries = engine.exactMap.get(normalizedFragment) ?? [];
  const prefixEntries = engine.prefixMap.get(normalizedFragment) ?? [];
  const tokenEntries = engine.tokenPrefixMap.get(normalizedFragment) ?? [];

  for (const entry of exactEntries) {
    candidates.set(entry.term, {
      term: entry.term,
      score: 100,
      reason: 'exact',
    });
  }

  for (const entry of prefixEntries) {
    if (candidates.has(entry.term)) {
      continue;
    }

    candidates.set(entry.term, {
      term: entry.term,
      score: 92 - (entry.normalized.length - normalizedFragment.length) * 0.25,
      reason: 'prefix',
    });
  }

  for (const entry of tokenEntries) {
    if (candidates.has(entry.term)) {
      continue;
    }

    candidates.set(entry.term, {
      term: entry.term,
      score: 84 - (entry.normalized.length - normalizedFragment.length) * 0.2,
      reason: 'token',
    });
  }

  return Array.from(candidates.values())
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.term.localeCompare(right.term);
    })
    .slice(0, DIRECT_CANDIDATE_CAP);
};

const buildFuzzySuggestions = (
  fragment: string,
  normalizedFragment: string,
  engine: ClinicalSuggestionEngine,
  existingTerms: Set<string>
) => {
  const flattenedFragment = flattenClinicalText(fragment);
  if (flattenedFragment.length < 3) {
    return [];
  }

  const bucketKey = flattenedFragment.charAt(0);
  const bucket = engine.flattenedBuckets.get(bucketKey) ?? [];
  const lengthFiltered = bucket.filter(
    (entry) =>
      !existingTerms.has(entry.term) &&
      Math.abs(entry.flattened.length - flattenedFragment.length) <= 4
  );
  const fuzzyPool = lengthFiltered.slice(0, FUZZY_CANDIDATE_CAP);

  return fuzzyPool
    .map<SuggestionCandidate | null>((entry) => {
      const sharesStrongPrefix =
        flattenedFragment.slice(0, 4) === entry.flattened.slice(0, 4) &&
        flattenedFragment.length >= 4;
      const baseMaxDistance =
        flattenedFragment.length <= 5 ? 1 : flattenedFragment.length <= 10 ? 2 : 3;
      const maxDistance = sharesStrongPrefix ? baseMaxDistance + 1 : baseMaxDistance;
      const distance = levenshteinDistance(flattenedFragment, entry.flattened, maxDistance);

      if (distance > maxDistance) {
        return null;
      }

      return {
        term: entry.term,
        score:
          70 -
          distance * 8 -
          Math.abs(entry.flattened.length - flattenedFragment.length) * 1.2 -
          Math.max(0, entry.tokens.length - normalizedFragment.split(' ').length),
        reason: 'fuzzy',
      };
    })
    .filter((candidate): candidate is SuggestionCandidate => Boolean(candidate))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.term.localeCompare(right.term);
    });
};

export const getClinicalFragmentSuggestions = (
  fragment: string,
  vocabulary: string[],
  options: SuggestionOptions = {}
) => {
  const normalizedFragment = normalizeClinicalText(fragment);
  const limit = options.limit ?? 6;
  const allowFuzzy = options.allowFuzzy ?? true;

  if (normalizedFragment.length < 2) {
    return [];
  }

  const engine = buildClinicalSuggestionEngine(vocabulary);
  const directSuggestions = buildDirectSuggestions(normalizedFragment, engine);
  const existingTerms = new Set(directSuggestions.map((entry) => entry.term));

  if (!allowFuzzy || directSuggestions.length >= limit) {
    return directSuggestions.slice(0, limit);
  }

  const fuzzySuggestions = buildFuzzySuggestions(
    fragment,
    normalizedFragment,
    engine,
    existingTerms
  );

  return [...directSuggestions, ...fuzzySuggestions].slice(0, limit);
};

export const getClinicalSuggestions = (
  input: string,
  vocabulary: string[],
  limit = 6,
  options: Omit<SuggestionOptions, 'limit'> = {}
) => {
  const fragment = getLastFragment(input);
  return getClinicalFragmentSuggestions(fragment, vocabulary, {
    ...options,
    limit,
  });
};

export const replaceLastClinicalFragment = (input: string, nextTerm: string) => {
  const pieces = input.split(',');
  if (pieces.length === 0) {
    return nextTerm;
  }

  pieces[pieces.length - 1] = ` ${nextTerm}`;
  return pieces
    .join(',')
    .replace(/^\s+/, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .trim();
};

export const canonicalizeClinicalTerms = (terms: string[], vocabulary: string[]) =>
  Array.from(
    new Set(
      terms.map((term) => {
        const [best] = getClinicalFragmentSuggestions(term, vocabulary, {
          allowFuzzy: normalizeClinicalText(term).length >= 3,
          limit: 1,
        });

        if (!best) {
          return term;
        }

        if (best.reason === 'exact' || best.reason === 'prefix') {
          return normalizeClinicalText(best.term);
        }

        if (best.reason === 'fuzzy' && best.score >= 50) {
          return normalizeClinicalText(best.term);
        }

        return term;
      })
    )
  );

export { normalizeClinicalText };
