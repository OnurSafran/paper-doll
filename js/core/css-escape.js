/**
 * CSS Escaping
 * Single authority for escaping values interpolated into dynamically built
 * selectors, so an id carrying selector punctuation cannot restructure the
 * selector or throw a SyntaxError at querySelector time.
 */

/**
 * Escapes a value for use inside an ID selector or a quoted attribute value.
 * Prefers the platform CSS.escape; the fallback covers environments that do not
 * expose it (older engines and bare test harnesses).
 */
export function escapeCss(value) {
  const str = String(value);
  if (typeof globalThis.CSS?.escape === 'function') return globalThis.CSS.escape(str);
  return str.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}
