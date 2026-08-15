const dollViewBox = [0, 0, 300, 450];
const NEW_CORE_ASSET_IDS = new Set([
  'top_raincoat', 'top_vest', 'bottom_culottes', 'bottom_cargo', 'dress_overall',
  'shoes_rainboots', 'hair_bun', 'hair_wavy_bob', 'accessory_ribbon',
  'accessory_hairclip', 'accessory_flower', 'prop_bicycle', 'prop_kite',
  'prop_camera', 'prop_flower_pot', 'prop_mailbox', 'prop_picnic_blanket'
]);
const ASSET_CREATOR = 'Paper Doll Studio';
const NEW_ASSET_CREATOR = '5.6 Luna';

export const ASSETS = Object.freeze([
  { id: 'doll_classic_a', kind: 'doll', name: 'Classic doll', path: 'assets/characters/doll-classic-a.svg', viewBox: dollViewBox, requiredGroups: ['body'] },
  { id: 'doll_classic_b', kind: 'doll', name: 'Joy doll', path: 'assets/characters/doll-classic-b.svg', viewBox: dollViewBox, requiredGroups: ['body'] },
  { id: 'doll_chibi_a', kind: 'doll', name: 'Chibi doll', path: 'assets/characters/doll-chibi-a.svg', viewBox: dollViewBox, requiredGroups: ['body'] },

  wearable('top_tshirt', 'top', 'Sailor stripe tee', 'assets/clothing/tops/tshirt.svg', 'coral'),
  wearable('top_blouse', 'top', 'Ruffle blouse', 'assets/clothing/tops/blouse.svg', 'marigold'),
  wearable('top_hoodie', 'top', 'Cozy hoodie', 'assets/clothing/tops/hoodie.svg', 'sage'),
  wearable('top_cardigan', 'top', 'Knit cardigan', 'assets/clothing/tops/cardigan.svg', 'lavender'),
  wearable('top_crop_jacket', 'top', 'Denim jacket', 'assets/clothing/tops/crop-jacket.svg', 'denim'),
  wearable('top_sweater', 'top', 'Oversized sweater', 'assets/clothing/tops/sweater.svg', 'cream'),
  wearable('top_sailor', 'top', 'Sailor school blouse', 'assets/clothing/tops/sailor.svg', 'sky'),
  wearable('top_raincoat', 'top', 'Sunny raincoat', 'assets/clothing/tops/raincoat.svg', 'marigold'),
  wearable('top_vest', 'top', 'Utility vest', 'assets/clothing/tops/vest.svg', 'sage'),

  wearable('bottom_jeans', 'bottom', 'High-waist jeans', 'assets/clothing/bottoms/jeans.svg', 'denim'),
  wearable('bottom_skirt', 'bottom', 'Tennis skirt', 'assets/clothing/bottoms/skirt.svg', 'marigold'),
  wearable('bottom_shorts', 'bottom', 'Pleated shorts', 'assets/clothing/bottoms/shorts.svg', 'sage'),
  wearable('bottom_overalls', 'bottom', 'Dungaree overalls', 'assets/clothing/bottoms/overalls.svg', 'cocoa'),
  wearable('bottom_pleated_skirt', 'bottom', 'Plaid pleated skirt', 'assets/clothing/bottoms/pleated-skirt.svg', 'cherry'),
  wearable('bottom_culottes', 'bottom', 'Garden culottes', 'assets/clothing/bottoms/culottes.svg', 'lavender'),
  wearable('bottom_cargo', 'bottom', 'Pocket cargo pants', 'assets/clothing/bottoms/cargo.svg', 'sage'),

  wearable('dress_sundress', 'dress', 'Sundress', 'assets/clothing/dresses/sundress.svg', 'coral'),
  wearable('dress_party', 'dress', 'Tiered party dress', 'assets/clothing/dresses/party-dress.svg', 'coral'),
  wearable('dress_pinafore', 'dress', 'Pinafore apron dress', 'assets/clothing/dresses/pinafore.svg', 'marigold'),
  wearable('dress_ballgown', 'dress', 'Princess ballgown', 'assets/clothing/dresses/ballgown.svg', 'lavender'),
  wearable('dress_overall', 'dress', 'Patchwork overall dress', 'assets/clothing/dresses/overall.svg', 'denim'),

  wearable('shoes_sneakers', 'shoes', 'Retro sneakers', 'assets/clothing/shoes/sneakers.svg', 'coral'),
  wearable('shoes_sandals', 'shoes', 'Mary Jane flats', 'assets/clothing/shoes/sandals.svg', 'cocoa'),
  wearable('shoes_boots', 'shoes', 'Lace-up ankle boots', 'assets/clothing/shoes/boots.svg', 'cocoa'),
  wearable('shoes_loafers', 'shoes', 'Preppy loafers', 'assets/clothing/shoes/loafers.svg', 'brown'),
  wearable('shoes_ballet', 'shoes', 'Ballet ribbon flats', 'assets/clothing/shoes/ballet.svg', 'coral'),
  wearable('shoes_rainboots', 'shoes', 'Sunny rain boots', 'assets/clothing/shoes/rainboots.svg', 'marigold'),

  wearable('hair_short', 'hair', 'Chic bob', 'assets/clothing/hair/short.svg', 'marigold', ['hairBack', 'hairFront']),
  wearable('hair_long', 'hair', 'Long waves', 'assets/clothing/hair/long.svg', 'brown', ['hairBack', 'hairFront']),
  wearable('hair_ponytail', 'hair', 'High ponytail', 'assets/clothing/hair/ponytail.svg', 'cocoa', ['hairBack', 'hairFront']),
  wearable('hair_twintails', 'hair', 'Bouncy twintails', 'assets/clothing/hair/twintails.svg', 'blonde', ['hairBack', 'hairFront']),
  wearable('hair_curly', 'hair', 'Voluminous curls', 'assets/clothing/hair/curly.svg', 'brown', ['hairBack', 'hairFront']),
  wearable('hair_braids', 'hair', 'Crown braids', 'assets/clothing/hair/braids.svg', 'cocoa', ['hairBack', 'hairFront']),
  wearable('hair_bun', 'hair', 'Top knot bun', 'assets/clothing/hair/bun.svg', 'brown', ['hairBack', 'hairFront']),
  wearable('hair_wavy_bob', 'hair', 'Wavy bob', 'assets/clothing/hair/wavy-bob.svg', 'cocoa', ['hairBack', 'hairFront']),

  wearable('accessory_hat', 'accessory', 'Sun hat', 'assets/clothing/accessories/hat.svg', 'marigold'),
  wearable('accessory_glasses', 'accessory', 'Cat-eye glasses', 'assets/clothing/accessories/glasses.svg', 'cocoa'),
  wearable('accessory_bow', 'accessory', 'Silk hair bow', 'assets/clothing/accessories/bow.svg', 'coral'),
  wearable('accessory_beret', 'accessory', 'Artist wool beret', 'assets/clothing/accessories/beret.svg', 'cherry'),
  wearable('accessory_crown', 'accessory', 'Golden tiara', 'assets/clothing/accessories/crown.svg', 'marigold'),
  wearable('accessory_headphones', 'accessory', 'Retro headphones', 'assets/clothing/accessories/headphones.svg', 'mint'),
  wearable('accessory_cat_ears', 'accessory', 'Cat ear headband', 'assets/clothing/accessories/cat-ears.svg', 'coral'),
  wearable('accessory_ribbon', 'accessory', 'Polka-dot ribbon', 'assets/clothing/accessories/ribbon.svg', 'coral'),
  wearable('accessory_hairclip', 'accessory', 'Star hair clip', 'assets/clothing/accessories/hairclip.svg', 'marigold'),
  wearable('accessory_flower', 'accessory', 'Daisy hair flower', 'assets/clothing/accessories/flower.svg', 'marigold'),

  { id: 'bg_bedroom', kind: 'background', name: 'Cozy bedroom', path: 'assets/backgrounds/bedroom.svg', viewBox: [0, 0, 800, 500], requiredGroups: ['background'] },
  { id: 'bg_park', kind: 'background', name: 'Sunny park', path: 'assets/backgrounds/park.svg', viewBox: [0, 0, 800, 500], requiredGroups: ['background'] },
  { id: 'bg_atelier', kind: 'background', name: 'Creative atelier', path: 'assets/backgrounds/atelier.svg', viewBox: [0, 0, 800, 500], requiredGroups: ['background'] },
  { id: 'bg_beach', kind: 'background', name: 'Sunny beach', path: 'assets/backgrounds/beach.svg', viewBox: [0, 0, 800, 500], requiredGroups: ['background'] },
  { id: 'bg_cafe', kind: 'background', name: 'Cozy cafe & bakery', path: 'assets/backgrounds/cafe.svg', viewBox: [0, 0, 800, 500], requiredGroups: ['background'] },
  { id: 'bg_forest', kind: 'background', name: 'Enchanted forest', path: 'assets/backgrounds/forest.svg', viewBox: [0, 0, 800, 500], requiredGroups: ['background'] },
  { id: 'bg_library', kind: 'background', name: 'Vintage library', path: 'assets/backgrounds/library.svg', viewBox: [0, 0, 800, 500], requiredGroups: ['background'] },

  prop('prop_chair', 'Armchair', 'assets/props/chair.svg', 240, 270),
  prop('prop_table', 'Cafe table', 'assets/props/table.svg', 250, 230),
  prop('prop_plant', 'Monstera plant', 'assets/props/plant.svg', 200, 270),
  prop('prop_lamp', 'Floor lamp', 'assets/props/lamp.svg', 160, 360),
  prop('prop_rug', 'Pastel rug', 'assets/props/rug.svg', 380, 140),
  prop('prop_tea_set', 'Tea set', 'assets/props/tea-set.svg', 170, 120),
  prop('prop_easel', 'Art easel', 'assets/props/easel.svg', 220, 290),
  prop('prop_bookshelf', 'Cozy bookshelf', 'assets/props/bookshelf.svg', 260, 320),
  prop('prop_cat', 'Sleeping cat', 'assets/props/cat.svg', 180, 130),
  prop('prop_picnic_basket', 'Picnic basket', 'assets/props/picnic-basket.svg', 190, 160),
  prop('prop_umbrella', 'Beach parasol', 'assets/props/umbrella.svg', 260, 340),
  prop('prop_balloons', 'Balloons bunch', 'assets/props/balloons.svg', 210, 310),
  prop('prop_cake', 'Celebration cake', 'assets/props/cake.svg', 170, 170),
  prop('prop_guitar', 'Acoustic guitar', 'assets/props/guitar.svg', 180, 300),
  prop('prop_painting', 'Wall art frame', 'assets/props/painting.svg', 220, 180),
  prop('prop_bench', 'Garden bench', 'assets/props/bench.svg', 300, 200),
  prop('prop_bicycle', 'Garden bicycle', 'assets/props/bicycle.svg', 300, 220),
  prop('prop_kite', 'Colorful kite', 'assets/props/kite.svg', 200, 260),
  prop('prop_camera', 'Little camera', 'assets/props/camera.svg', 180, 140),
  prop('prop_flower_pot', 'Flower pot', 'assets/props/flower-pot.svg', 180, 220),
  prop('prop_mailbox', 'Garden mailbox', 'assets/props/mailbox.svg', 220, 220),
  prop('prop_picnic_blanket', 'Picnic blanket', 'assets/props/picnic-blanket.svg', 360, 160)
].map((asset) => Object.freeze({
  ...asset,
  metadata: Object.freeze({
    added_date: NEW_CORE_ASSET_IDS.has(asset.id) ? '2026-08-16' : '2026-08-14',
    creator: NEW_CORE_ASSET_IDS.has(asset.id) ? NEW_ASSET_CREATOR : ASSET_CREATOR,
    concept: NEW_CORE_ASSET_IDS.has(asset.id) ? 'weekend garden' : 'core',
    dlc: 'core',
    source: 'project-authored SVG primitives and paths'
  })
})));

const byId = new Map(ASSETS.map((asset) => [asset.id, Object.freeze(asset)]));

export function getAsset(id) {
  return byId.get(id);
}

export function assetsByKind(kind) {
  return ASSETS.filter((asset) => asset.kind === kind);
}

export function wearablesBySlot(slot) {
  return ASSETS.filter((asset) => asset.kind === 'wearable' && asset.slot === slot);
}

function wearable(id, slot, name, path, color, requiredGroups = ['garment']) {
  return {
    id, kind: 'wearable', slot, name, path, viewBox: dollViewBox,
    tintable: true, defaultColors: { primary: color }, requiredGroups
  };
}

function prop(id, name, path, displayWidth, displayHeight) {
  return {
    id, kind: 'prop', name, path, viewBox: [0, 0, 1000, 1000], requiredGroups: ['prop'],
    displayWidth, displayHeight, groundAnchor: { x: 0.5, y: 1.0 }, defaultScale: 1
  };
}
