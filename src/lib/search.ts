import { searchableStgEntries } from '../data/conditions';
import { DiseaseSearchResult, NormalizedAge, SearchableAgeBand, SearchableStgEntry } from '../types';

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

const levenshteinDistance = (left: string, right: string) => {
  if (left === right) {
    return 0;
  }

  if (!left.length) {
    return right.length;
  }

  if (!right.length) {
    return left.length;
  }

  const rows = Array.from({ length: left.length + 1 }, (_, index) => index);

  for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
    let previous = rows[0];
    rows[0] = rightIndex;

    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      const current = rows[leftIndex];
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      rows[leftIndex] = Math.min(
        rows[leftIndex] + 1,
        rows[leftIndex - 1] + 1,
        previous + cost
      );
      previous = current;
    }
  }

  return rows[left.length];
};

const compareName = (query: string, candidate: string) => {
  if (!query || !candidate) {
    return null;
  }

  const queryTokens = tokenize(query);
  const candidateTokens = tokenize(candidate);

  if (query === candidate) {
    return { score: 140, strength: 'exact' as const, reason: 'Exact STG title match', exact: true };
  }

  if (candidate.startsWith(query)) {
    return { score: 115, strength: 'prefix' as const, reason: 'Starts with your query', exact: false };
  }

  const tokenHits = queryTokens.filter((token) => candidateTokens.some((candidateToken) => candidateToken.startsWith(token) || candidateToken === token));
  if (queryTokens.length && tokenHits.length === queryTokens.length) {
    return {
      score: 95 + tokenHits.length,
      strength: 'token' as const,
      reason: 'Matches all search words',
      exact: false,
    };
  }

  const distance = levenshteinDistance(query.replace(/\s+/g, ''), candidate.replace(/\s+/g, ''));
  const allowedDistance = Math.max(1, Math.floor(query.length * 0.2));
  if (distance <= allowedDistance) {
    return {
      score: 72 - distance,
      strength: 'fuzzy' as const,
      reason: 'Close spelling match',
      exact: false,
    };
  }

  return null;
};

const compareEntry = (query: string, entry: SearchableStgEntry): DiseaseSearchResult | null => {
  const candidates = [
    { label: 'title', value: entry.normalizedTitle, display: entry.title },
    ...entry.aliases.map((alias) => ({
      label: 'alias' as const,
      value: normalizeSearchText(alias),
      display: alias,
    })),
  ];

  let bestMatch: DiseaseSearchResult | null = null;

  for (const candidate of candidates) {
    const comparison = compareName(query, candidate.value);
    if (!comparison) {
      continue;
    }

    const matchReason =
      candidate.label === 'alias' && comparison.strength === 'exact'
        ? `Exact alias match: ${candidate.display}`
        : candidate.label === 'alias'
          ? `Suggested by alias: ${candidate.display}`
          : comparison.reason;

    const adjustedScore =
      comparison.score +
      (candidate.label === 'alias' ? 2 : 5) +
      (entry.sourceType === 'curated' ? 6 : 0);

    if (!bestMatch || adjustedScore > bestMatch.score) {
      bestMatch = {
        entry,
        score: adjustedScore,
        exact: comparison.exact,
        matchStrength:
          candidate.label === 'alias' && comparison.strength === 'exact'
            ? 'alias'
            : comparison.strength,
        matchReason,
      };
    }
  }

  return bestMatch;
};

export const searchDiseases = (query: string): DiseaseSearchResult[] => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  return searchableStgEntries
    .map((entry) => compareEntry(normalizedQuery, entry))
    .filter((result): result is DiseaseSearchResult => Boolean(result))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (left.exact !== right.exact) {
        return left.exact ? -1 : 1;
      }
      return left.entry.title.localeCompare(right.entry.title);
    })
    .slice(0, 16);
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
