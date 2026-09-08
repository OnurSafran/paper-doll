/**
 * Framing used by wardrobe and face preview cards.
 */
export const SLOT_PREVIEW_VIEWBOX = Object.freeze({
  top: '80 85 140 140',
  bottom: '90 170 120 220',
  dress: '60 105 180 270',
  shoes: '100 340 100 85',
  hair: '70 0 160 195',
  accessory: '90 0 120 80'
});

// Full-body pieces and body accessories do not fit their slot's usual crop.
const ASSET_PREVIEW_VIEWBOX = Object.freeze({
  bottom_overalls: '100 100 100 255',
  hair_long: '70 10 160 245',
  shoes_booties_baby: '100 325 100 55',
  shoes_sandals_baby: '100 325 100 55',
  shoes_sneakers_baby: '100 325 100 55',
  accessory_bib_baby: '105 95 90 95',
  accessory_shawl_elder: '95 100 110 130',
  accessory_backpack_child: '110 105 80 90',
  accessory_bonnet_baby: '100 0 100 120',
  accessory_rattle_baby: '178 138 48 68'
});

export function wearablePreviewViewBox(asset) {
  return ASSET_PREVIEW_VIEWBOX[asset?.id] ?? SLOT_PREVIEW_VIEWBOX[asset?.slot];
}

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
