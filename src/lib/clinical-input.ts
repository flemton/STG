const normalizeClinicalText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9,\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const flattenClinicalText = (value: string) => normalizeClinicalText(value).replace(/\s+/g, '');

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

type SuggestionCandidate = {
  term: string;
  score: number;
  reason: 'exact' | 'prefix' | 'token' | 'fuzzy';
};

const scoreCandidate = (fragment: string, term: string): SuggestionCandidate | null => {
  const normalizedFragment = normalizeClinicalText(fragment);
  const normalizedTerm = normalizeClinicalText(term);

  if (!normalizedFragment || !normalizedTerm) {
    return null;
  }

  if (normalizedFragment === normalizedTerm) {
    return { term, score: 100, reason: 'exact' };
  }

  if (normalizedTerm.startsWith(normalizedFragment)) {
    return { term, score: 92 - (normalizedTerm.length - normalizedFragment.length) * 0.25, reason: 'prefix' };
  }

  if (normalizedTerm.split(' ').some((word) => word.startsWith(normalizedFragment))) {
    return { term, score: 84 - (normalizedTerm.length - normalizedFragment.length) * 0.2, reason: 'token' };
  }

  const flattenedFragment = flattenClinicalText(fragment);
  const flattenedTerm = flattenClinicalText(term);
  if (!flattenedFragment || !flattenedTerm) {
    return null;
  }

  const sharesStrongPrefix =
    flattenedFragment.slice(0, 4) === flattenedTerm.slice(0, 4) &&
    flattenedFragment.length >= 4;
  const baseMaxDistance =
    flattenedFragment.length <= 5 ? 1 : flattenedFragment.length <= 10 ? 2 : 3;
  const maxDistance = sharesStrongPrefix ? baseMaxDistance + 1 : baseMaxDistance;
  const distance = levenshteinDistance(flattenedFragment, flattenedTerm, maxDistance);

  if (distance <= maxDistance) {
    return {
      term,
      score: 70 - distance * 8 - Math.abs(flattenedTerm.length - flattenedFragment.length) * 1.2,
      reason: 'fuzzy',
    };
  }

  return null;
};

export const getClinicalSuggestions = (
  input: string,
  vocabulary: string[],
  limit = 6
) => {
  const fragment = getLastFragment(input);
  if (normalizeClinicalText(fragment).length < 2) {
    return [];
  }

  return vocabulary
    .map((term) => scoreCandidate(fragment, term))
    .filter((candidate): candidate is SuggestionCandidate => Boolean(candidate))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.term.localeCompare(right.term);
    })
    .slice(0, limit);
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
        const [best] = getClinicalSuggestions(term, vocabulary, 1);
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
