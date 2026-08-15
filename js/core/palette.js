export const PALETTE = Object.freeze({
  cream: { name: 'Vanilla cream', value: '#fff4d6' },
  coral: { name: 'Coral pink', value: '#ef7f72' },
  cherry: { name: 'Cherry red', value: '#c94c5c' },
  marigold: { name: 'Marigold', value: '#e9aa3a' },
  sage: { name: 'Sage green', value: '#86a873' },
  mint: { name: 'Mint green', value: '#8fcfbd' },
  sky: { name: 'Sky blue', value: '#78add2' },
  denim: { name: 'Denim blue', value: '#567da3' },
  lavender: { name: 'Lavender', value: '#a78bc4' },
  cocoa: { name: 'Cocoa brown', value: '#73513d' },
  charcoal: { name: 'Charcoal', value: '#3c342d' },
  white: { name: 'Paper white', value: '#fffdf7' },
  black: { name: 'Ink black', value: '#292420' },
  peach: { name: 'Peach skin', value: '#f2c7a5' },
  honey: { name: 'Honey skin', value: '#dca878' },
  bronze: { name: 'Bronze skin', value: '#a86f4f' },
  deep: { name: 'Deep skin', value: '#714735' },
  blonde: { name: 'Golden blonde', value: '#d8aa52' },
  auburn: { name: 'Auburn hair', value: '#9f553b' },
  brown: { name: 'Brown hair', value: '#654735' }
});

export const GARMENT_COLORS = Object.freeze([
  'coral', 'cherry', 'marigold', 'sage', 'mint', 'sky', 'denim', 'lavender', 'cream', 'charcoal'
]);

export const SKIN_COLORS = Object.freeze(['peach', 'honey', 'bronze', 'deep']);
export const HAIR_COLORS = Object.freeze(['blonde', 'auburn', 'brown', 'black', 'lavender']);

export function isPaletteToken(token) {
  return typeof token === 'string' && Object.hasOwn(PALETTE, token);
}

export function isColorValue(value) {
  return isPaletteToken(value) || (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value));
}

export function normalizeColorValue(value, fallback = 'coral') {
  if (isPaletteToken(value)) return value;
  if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  return fallback;
}

export function paletteValue(token, fallback = 'coral') {
  if (typeof token === 'string' && /^#[0-9a-f]{6}$/i.test(token)) return token.toLowerCase();
  return PALETTE[token]?.value ?? PALETTE[fallback].value;
}
