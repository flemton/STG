import { searchableStgEntries } from '../data/conditions';
import { DiseaseSearchResult, NormalizedAge, SearchableAgeBand, SearchableStgEntry } from '../types';

const MAX_SEARCH_PREFIX_LENGTH = 16;
const SEARCH_DIRECT_CAP = 40;
const SEARCH_FUZZY_CAP = 64;

type SearchStrength = DiseaseSearchResult['matchStrength'];

type SearchCandidate = {
  entry: SearchableStgEntry;
  label: 'title' | 'alias';
  value: string;
  display: string;
  tokens: string[];
  flattened: string;
};

type SearchIndex = {
  exactMap: Map<string, SearchCandidate[]>;
  prefixMap: Map<string, SearchCandidate[]>;
  tokenPrefixMap: Map<string, SearchCandidate[]>;
  flattenedBuckets: Map<string, SearchCandidate[]>;
};

type SearchOptions = {
  allowFuzzy?: boolean;
  limit?: number;
};

const normalizeSearchText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (value: string) =>
  normalizeSearchText(value)
    .split(' ')
    .filter((token) => token.length > 1);

const flattenSearchText = (value: string) => normalizeSearchText(value).replace(/\s+/g, '');

const pushUnique = <T>(map: Map<string, T[]>, key: string, value: T) => {
  const current = map.get(key);
  if (!current) {
    map.set(key, [value]);
    return;
  }

  if (!current.includes(value)) {
    current.push(value);
  }
};

const addPrefixes = (map: Map<string, SearchCandidate[]>, source: string, candidate: SearchCandidate) => {
  const limit = Math.min(source.length, MAX_SEARCH_PREFIX_LENGTH);
  for (let index = 1; index <= limit; index += 1) {
    pushUnique(map, source.slice(0, index), candidate);
  }
};

const searchCandidates: SearchCandidate[] = searchableStgEntries.flatMap((entry) => [
  {
    entry,
    label: 'title' as const,
    value: entry.normalizedTitle,
    display: entry.title,
    tokens: tokenize(entry.normalizedTitle),
    flattened: flattenSearchText(entry.normalizedTitle),
  },
  ...entry.aliases
    .map((alias) => normalizeSearchText(alias))
    .filter(Boolean)
    .map((alias) => ({
      entry,
      label: 'alias' as const,
      value: alias,
      display: alias,
      tokens: tokenize(alias),
      flattened: flattenSearchText(alias),
    })),
]);

const searchIndex: SearchIndex = {
  exactMap: new Map(),
  prefixMap: new Map(),
  tokenPrefixMap: new Map(),
  flattenedBuckets: new Map(),
};

for (const candidate of searchCandidates) {
  pushUnique(searchIndex.exactMap, candidate.value, candidate);
  addPrefixes(searchIndex.prefixMap, candidate.value, candidate);

  for (const token of candidate.tokens) {
    addPrefixes(searchIndex.tokenPrefixMap, token, candidate);
  }

  const bucketKey = candidate.flattened.charAt(0);
  if (bucketKey) {
    pushUnique(searchIndex.flattenedBuckets, bucketKey, candidate);
  }
}

const levenshteinDistance = (left: string, right: string, maxDistance = Infinity) => {
  if (left === right) {
    return 0;
  }

  if (!left.length) {
    return right.length;
  }

  if (!right.length) {
    return left.length;
  }

  if (Math.abs(left.length - right.length) > maxDistance) {
    return maxDistance + 1;
  }

  const rows = Array.from({ length: left.length + 1 }, (_, index) => index);

  for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
    let previous = rows[0];
    rows[0] = rightIndex;
    let rowMin = rows[0];

    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      const current = rows[leftIndex];
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      rows[leftIndex] = Math.min(
        rows[leftIndex] + 1,
        rows[leftIndex - 1] + 1,
        previous + cost
      );
      previous = current;
      rowMin = Math.min(rowMin, rows[leftIndex]);
    }

    if (rowMin > maxDistance) {
      return maxDistance + 1;
    }
  }

  return rows[left.length];
};

const buildResult = (
  candidate: SearchCandidate,
  score: number,
  matchStrength: SearchStrength,
  exact: boolean,
  matchReason: string
): DiseaseSearchResult => ({
  entry: candidate.entry,
  score: score + (candidate.label === 'alias' ? 2 : 5) + (candidate.entry.sourceType === 'curated' ? 6 : 0),
  exact,
  matchStrength:
    candidate.label === 'alias' && matchStrength === 'exact'
      ? 'alias'
      : matchStrength,
  matchReason:
    candidate.label === 'alias' && matchStrength === 'exact'
      ? `Exact alias match: ${candidate.display}`
      : candidate.label === 'alias'
        ? `Suggested by alias: ${candidate.display}`
        : matchReason,
});

const chooseBestResults = (results: DiseaseSearchResult[], limit: number) => {
  const byEntry = new Map<string, DiseaseSearchResult>();

  for (const result of results) {
    const current = byEntry.get(result.entry.id);
    if (!current || result.score > current.score) {
      byEntry.set(result.entry.id, result);
    }
  }

  return Array.from(byEntry.values())
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (left.exact !== right.exact) {
        return left.exact ? -1 : 1;
      }
      return left.entry.title.localeCompare(right.entry.title);
    })
    .slice(0, limit);
};

const getDirectResults = (normalizedQuery: string) => {
  const results: DiseaseSearchResult[] = [];
  const seen = new Set<string>();
  const exactCandidates = searchIndex.exactMap.get(normalizedQuery) ?? [];
  const prefixCandidates = searchIndex.prefixMap.get(normalizedQuery) ?? [];
  const tokenCandidates = searchIndex.tokenPrefixMap.get(normalizedQuery) ?? [];

  for (const candidate of exactCandidates) {
    const key = `${candidate.entry.id}:${candidate.label}:${candidate.value}:exact`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(buildResult(candidate, 140, 'exact', true, 'Exact STG title match'));
  }

  for (const candidate of prefixCandidates) {
    const key = `${candidate.entry.id}:${candidate.label}:${candidate.value}:prefix`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(
      buildResult(
        candidate,
        115 - (candidate.value.length - normalizedQuery.length) * 0.15,
        'prefix',
        false,
        'Starts with your query'
      )
    );
  }

  for (const candidate of tokenCandidates) {
    const key = `${candidate.entry.id}:${candidate.label}:${candidate.value}:token`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(
      buildResult(candidate, 96 + candidate.tokens.length * 0.2, 'token', false, 'Matches all search words')
    );
  }

  return results.slice(0, SEARCH_DIRECT_CAP);
};

const getFuzzyResults = (
  normalizedQuery: string,
  existingResults: DiseaseSearchResult[]
) => {
  const flattenedQuery = flattenSearchText(normalizedQuery);
  if (flattenedQuery.length < 3) {
    return [];
  }

  const existingEntryIds = new Set(existingResults.map((result) => result.entry.id));
  const bucket = searchIndex.flattenedBuckets.get(flattenedQuery.charAt(0)) ?? [];
  const fuzzyPool = bucket
    .filter(
      (candidate) =>
        !existingEntryIds.has(candidate.entry.id) &&
        Math.abs(candidate.flattened.length - flattenedQuery.length) <= 4
    )
    .slice(0, SEARCH_FUZZY_CAP);

  return fuzzyPool
    .map<DiseaseSearchResult | null>((candidate) => {
      const baseMaxDistance = flattenedQuery.length <= 6 ? 2 : flattenedQuery.length <= 12 ? 3 : 4;
      const distance = levenshteinDistance(flattenedQuery, candidate.flattened, baseMaxDistance);
      if (distance > baseMaxDistance) {
        return null;
      }

      return buildResult(
        candidate,
        72 - distance - Math.abs(candidate.flattened.length - flattenedQuery.length) * 0.6,
        'fuzzy',
        false,
        'Close spelling match'
      );
    })
    .filter((result): result is DiseaseSearchResult => Boolean(result));
};

export const searchDiseases = (query: string, options: SearchOptions = {}): DiseaseSearchResult[] => {
  const normalizedQuery = normalizeSearchText(query);
  const allowFuzzy = options.allowFuzzy ?? true;
  const limit = options.limit ?? 16;

  if (!normalizedQuery) {
    return [];
  }

  const directResults = chooseBestResults(getDirectResults(normalizedQuery), limit);
  const hasStrongDirectMatch = directResults.some(
    (result) => result.matchStrength === 'exact' || result.matchStrength === 'alias' || result.matchStrength === 'prefix'
  );

  if (!allowFuzzy || hasStrongDirectMatch || directResults.length >= limit) {
    return directResults;
  }

  return chooseBestResults(
    [...directResults, ...getFuzzyResults(normalizedQuery, directResults)],
    limit
  );
};

export const getSearchEntryById = (id: string) =>
  searchableStgEntries.find((entry) => entry.id === id) ?? null;

export const getApplicableAgeBand = (
  entry: SearchableStgEntry,
  age: NormalizedAge | null
): SearchableAgeBand | null => {
  if (!age) {
    return null;
  }

  return (
    entry.ageBands.find(
      (band) => age.days >= band.ageRange.minDays && age.days <= band.ageRange.maxDays
    ) ?? null
  );
};
