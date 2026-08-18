/**
 * Framing used by wardrobe and face preview cards.
 */
export const SLOT_PREVIEW_VIEWBOX = Object.freeze({
  top: '80 85 140 125',
  bottom: '90 170 120 180',
  dress: '60 105 180 270',
  shoes: '105 345 90 70',
  hair: '70 15 160 175',
  accessory: '90 0 120 80'
});

/**
 * Fallback framing for raw Paint cutouts when SVG getBBox() is unavailable.
 * This is intentionally tighter than SLOT_PREVIEW_VIEWBOX because it frames
 * the authored garment itself rather than a card preview of the full doll.
 */
export const SLOT_CUTOUT_FALLBACK_VIEWBOX = Object.freeze({
  top: '95 105 110 95',
  bottom: '100 170 100 190',
  dress: '80 105 140 210',
  shoes: '108 340 84 75',
  hair: '75 15 150 160',
  accessory: '95 15 110 90'
});
