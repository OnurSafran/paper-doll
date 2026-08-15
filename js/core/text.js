export function normalizeDisplayName(value, maxGraphemes = 30) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) return null;
  return truncateGraphemes(normalized, maxGraphemes);
}

export function hasValidDisplayName(value, maxGraphemes = 30) {
  return typeof value === 'string'
    && value.trim().length > 0
    && graphemeCount(value.trim()) <= maxGraphemes;
}

export function truncateGraphemes(value, maxGraphemes) {
  return segmentGraphemes(value).slice(0, maxGraphemes).join('');
}

export function graphemeCount(value) {
  return segmentGraphemes(value).length;
}

function segmentGraphemes(value) {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return [...segmenter.segment(value)].map(({ segment }) => segment);
  }
  return [...value];
}
