import { FIT_FAMILIES, isPropCollection } from '../domain/vocabulary.js';

const dollViewBox = [0, 0, 300, 450];
const NEW_CORE_ASSET_IDS = new Set([
  'top_raincoat', 'top_vest', 'bottom_culottes', 'bottom_cargo', 'dress_overall',
  'shoes_rainboots', 'hair_bun', 'hair_wavy_bob', 'accessory_ribbon',
  'accessory_hairclip', 'accessory_flower', 'prop_bicycle', 'prop_kite',
  'prop_camera', 'prop_flower_pot', 'prop_mailbox', 'prop_picnic_blanket'
]);
const PANORAMIC_CORE_ASSET_IDS = new Set(['bg_moonlit_meadow', 'bg_snowy_village', 'bg_city_sunset', 'bg_candy_land']);
const ASSET_CREATOR = 'Paper Doll Studio';
const NEW_ASSET_CREATOR = '5.6 Luna';

export const HEAD_ACCESSORY_IDS = Object.freeze(new Set([
  'accessory_hat', 'accessory_glasses', 'accessory_bow', 'accessory_beret',
  'accessory_crown', 'accessory_headphones', 'accessory_cat_ears', 'accessory_ribbon',
  'accessory_hairclip', 'accessory_flower', 'accessory_pacifier_baby',
  'accessory_spectacles_elder', 'accessory_cap_child', 'accessory_bonnet_baby'
]));

export function isHeadBoundLayer(slot, assetId, getAssetFn = getAsset) {
  if (slot === 'hair' || slot === 'face-eyes' || slot === 'face-eyebrows' ||
      slot === 'face-detail' || slot === 'face-nose' || slot === 'face-mouth') {
    return true;
  }
  if (slot === 'accessory' && assetId) {
    const asset = typeof getAssetFn === 'function' ? getAssetFn(assetId) : null;
    if (asset?.poseChannel === 'head') return true;
    return HEAD_ACCESSORY_IDS.has(assetId);
  }
  const asset = typeof getAssetFn === 'function' && assetId ? getAssetFn(assetId) : null;
  return asset?.kind === 'face' || asset?.poseChannel === 'head';
}

export const LIMB_ACCESSORY_IDS = Object.freeze(new Map([
  ['accessory_rattle_baby', 'armRight']
]));

export function getLimbBoundChannel(slot, assetId, getAssetFn = getAsset) {
  if (slot === 'accessory' && assetId) {
    const mapped = LIMB_ACCESSORY_IDS.get(assetId);
    if (mapped) return mapped;
    const asset = typeof getAssetFn === 'function' ? getAssetFn(assetId) : null;
    if (asset?.poseChannel === 'armLeft' || asset?.poseChannel === 'armRight' ||
        asset?.poseChannel === 'legLeft' || asset?.poseChannel === 'legRight') {
      return asset.poseChannel;
    }
  }
  return null;
}

export function isLimbBoundLayer(slot, assetId, getAssetFn = getAsset) {
  return Boolean(getLimbBoundChannel(slot, assetId, getAssetFn));
}

export function hasRigidWearableForLimb(draft, limbChannel, getAssetFn = getAsset) {
  if (!draft?.slots) return false;
  const resolveAsset = typeof getAssetFn === 'function' ? getAssetFn : getAsset;
  if (limbChannel === 'armLeft' || limbChannel === 'armRight') {
    const top = draft.slots.top ? resolveAsset(draft.slots.top.assetId) : null;
    const dress = draft.slots.dress ? resolveAsset(draft.slots.dress.assetId) : null;
    if (top && (top.poseSupport ?? 'rigid') === 'rigid') return true;
    if (dress && (dress.poseSupport ?? 'rigid') === 'rigid') return true;
  }
  if (limbChannel === 'legLeft' || limbChannel === 'legRight') {
    const bottom = draft.slots.bottom ? resolveAsset(draft.slots.bottom.assetId) : null;
    const dress = draft.slots.dress ? resolveAsset(draft.slots.dress.assetId) : null;
    const shoes = draft.slots.shoes ? resolveAsset(draft.slots.shoes.assetId) : null;
    if (bottom && (bottom.poseSupport ?? 'rigid') === 'rigid') return true;
    if (dress && (dress.poseSupport ?? 'rigid') === 'rigid') return true;
    if (shoes && (shoes.poseSupport ?? 'rigid') === 'rigid') return true;
  }
  return false;
}

const dollRequiredGroups = Object.freeze([
  'body',
  'pose-root',
  'pose-head',
  'pose-arm-left',
  'pose-arm-right',
  'pose-leg-left',
  'pose-leg-right',
  'torso'
]);

export const ASSETS = Object.freeze([
  {
    id: 'doll_classic_a',
    kind: 'doll',
    name: 'Classic doll',
    path: 'assets/characters/doll-classic-a.svg',
    viewBox: dollViewBox,
    requiredGroups: dollRequiredGroups,
    fitFamily: 'teen',
    lifeStages: ['teen'],
    presentationStyles: ['neutral'],
    poseSupport: 'full',
    headPivot: Object.freeze({ x: 150, y: 90 }),
    shoulderLeftPivot: Object.freeze({ x: 126, y: 120 }),
    shoulderRightPivot: Object.freeze({ x: 174, y: 120 }),
    hipLeftPivot: Object.freeze({ x: 138, y: 230 }),
    hipRightPivot: Object.freeze({ x: 162, y: 230 })
  },
  {
    id: 'doll_classic_b',
    kind: 'doll',
    name: 'Joy doll',
    path: 'assets/characters/doll-classic-b.svg',
    viewBox: dollViewBox,
    requiredGroups: dollRequiredGroups,
    fitFamily: 'teen',
    lifeStages: ['teen'],
    presentationStyles: ['neutral'],
    poseSupport: 'full',
    headPivot: Object.freeze({ x: 150, y: 90 }),
    shoulderLeftPivot: Object.freeze({ x: 124, y: 120 }),
    shoulderRightPivot: Object.freeze({ x: 176, y: 120 }),
    hipLeftPivot: Object.freeze({ x: 138, y: 230 }),
    hipRightPivot: Object.freeze({ x: 162, y: 230 })
  },
  {
    id: 'doll_chibi_a',
    kind: 'doll',
    name: 'Chibi doll',
    path: 'assets/characters/doll-chibi-a.svg',
    viewBox: dollViewBox,
    requiredGroups: dollRequiredGroups,
    fitFamily: 'child',
    lifeStages: ['child'],
    presentationStyles: ['neutral'],
    poseSupport: 'full',
    headPivot: Object.freeze({ x: 150, y: 91 }),
    shoulderLeftPivot: Object.freeze({ x: 124, y: 120 }),
    shoulderRightPivot: Object.freeze({ x: 176, y: 120 }),
    hipLeftPivot: Object.freeze({ x: 138, y: 230 }),
    hipRightPivot: Object.freeze({ x: 162, y: 230 })
  },
  {
    id: 'doll_baby_a',
    kind: 'doll',
    name: 'Baby doll',
    path: 'assets/characters/doll-baby-a.svg',
    viewBox: dollViewBox,
    requiredGroups: dollRequiredGroups,
    fitFamily: 'baby',
    lifeStages: ['baby'],
    presentationStyles: ['neutral'],
    poseSupport: 'full',
    headPivot: Object.freeze({ x: 150, y: 94 }),
    shoulderLeftPivot: Object.freeze({ x: 122, y: 118 }),
    shoulderRightPivot: Object.freeze({ x: 178, y: 118 }),
    hipLeftPivot: Object.freeze({ x: 138, y: 240 }),
    hipRightPivot: Object.freeze({ x: 162, y: 240 })
  },
  {
    id: 'doll_adult_a',
    kind: 'doll',
    name: 'Adult doll',
    path: 'assets/characters/doll-adult-a.svg',
    viewBox: dollViewBox,
    requiredGroups: dollRequiredGroups,
    fitFamily: 'adult',
    lifeStages: ['adult'],
    presentationStyles: ['neutral'],
    poseSupport: 'full',
    headPivot: Object.freeze({ x: 150, y: 88 }),
    shoulderLeftPivot: Object.freeze({ x: 121, y: 116 }),
    shoulderRightPivot: Object.freeze({ x: 179, y: 116 }),
    hipLeftPivot: Object.freeze({ x: 138, y: 236 }),
    hipRightPivot: Object.freeze({ x: 162, y: 236 })
  },
  {
    id: 'doll_elder_a',
    kind: 'doll',
    name: 'Elder doll',
    path: 'assets/characters/doll-elder-a.svg',
    viewBox: dollViewBox,
    requiredGroups: dollRequiredGroups,
    fitFamily: 'elder',
    lifeStages: ['elder'],
    presentationStyles: ['neutral'],
    poseSupport: 'full',
    headPivot: Object.freeze({ x: 150, y: 90 }),
    shoulderLeftPivot: Object.freeze({ x: 124, y: 118 }),
    shoulderRightPivot: Object.freeze({ x: 176, y: 118 }),
    hipLeftPivot: Object.freeze({ x: 138, y: 234 }),
    hipRightPivot: Object.freeze({ x: 162, y: 234 })
  },

  // Face Features - Eyes
  face('eyes_classic', 'eyes', 'Classic eyes', 'assets/characters/face/eyes-classic.svg'),
  face('eyes_round', 'eyes', 'Round anime eyes', 'assets/characters/face/eyes-round.svg'),
  face('eyes_sparkle', 'eyes', 'Sparkle anime eyes', 'assets/characters/face/eyes-sparkle.svg'),
  face('eyes_calm', 'eyes', 'Calm eyes', 'assets/characters/face/eyes-calm.svg'),
  face('eyes_curious', 'eyes', 'Curious eyes', 'assets/characters/face/eyes-curious.svg'),

  // Face Features - Eyebrows
  face('brows_soft', 'eyebrows', 'Soft eyebrows', 'assets/characters/face/brows-soft.svg'),
  face('brows_arched', 'eyebrows', 'Arched eyebrows', 'assets/characters/face/brows-arched.svg'),
  face('brows_bold', 'eyebrows', 'Bold eyebrows', 'assets/characters/face/brows-bold.svg'),
  face('brows_expressive', 'eyebrows', 'Expressive eyebrows', 'assets/characters/face/brows-expressive.svg'),

  // Face Features - Nose
  face('nose_dot', 'nose', 'Dot nose', 'assets/characters/face/nose-dot.svg'),
  face('nose_button', 'nose', 'Button nose', 'assets/characters/face/nose-button.svg'),
  face('nose_soft_curve', 'nose', 'Soft curve nose', 'assets/characters/face/nose-soft-curve.svg'),

  // Face Features - Mouth
  face('mouth_gentle_smile', 'mouth', 'Gentle smile', 'assets/characters/face/mouth-gentle-smile.svg'),
  face('mouth_open_smile', 'mouth', 'Open smile', 'assets/characters/face/mouth-open-smile.svg'),
  face('mouth_neutral', 'mouth', 'Neutral mouth', 'assets/characters/face/mouth-neutral.svg'),
  face('mouth_playful', 'mouth', 'Playful smile', 'assets/characters/face/mouth-playful.svg'),
  face('mouth_smirk', 'mouth', 'Subtle smirk', 'assets/characters/face/mouth-smirk.svg'),

  // Face Features - Details
  face('detail_blush', 'detail', 'Sweet blush', 'assets/characters/face/detail-blush.svg'),
  face('detail_freckles', 'detail', 'Cute freckles', 'assets/characters/face/detail-freckles.svg'),

  wearable('top_tshirt', 'top', 'Sailor stripe tee', 'assets/clothing/tops/tshirt.svg', 'coral'),
  wearable('top_blouse', 'top', 'Ruffle blouse', 'assets/clothing/tops/blouse.svg', 'marigold', ['garment'], ['teen'], ['feminine']),
  wearable('top_hoodie', 'top', 'Cozy hoodie', 'assets/clothing/tops/hoodie.svg', 'sage'),
  wearable('top_cardigan', 'top', 'Knit cardigan', 'assets/clothing/tops/cardigan.svg', 'lavender', ['garment'], ['teen'], ['feminine']),
  wearable('top_crop_jacket', 'top', 'Denim jacket', 'assets/clothing/tops/crop-jacket.svg', 'denim'),
  wearable('top_sweater', 'top', 'Oversized sweater', 'assets/clothing/tops/sweater.svg', 'cream'),
  wearable('top_sailor', 'top', 'Sailor school blouse', 'assets/clothing/tops/sailor.svg', 'sky', ['garment'], ['teen'], ['feminine']),
  wearable('top_raincoat', 'top', 'Sunny raincoat', 'assets/clothing/tops/raincoat.svg', 'marigold'),
  wearable('top_vest', 'top', 'Utility vest', 'assets/clothing/tops/vest.svg', 'sage'),
  wearable('top_cardigan_classic', 'top', 'Classic cardigan', 'assets/clothing/tops/cardigan-classic.svg', 'sage', ['garment'], ['teen', 'adult', 'elder'], ['neutral']),
  wearable('top_coat_adult', 'top', 'Tailored coat', 'assets/clothing/tops/coat-adult.svg', 'charcoal', ['garment'], ['adult', 'elder'], ['neutral']),
  wearable('top_tshirt_child', 'top', 'Playground tee', 'assets/clothing/tops/tshirt-child.svg', 'sky', ['garment'], ['child'], ['neutral']),
  wearable('top_hoodie_child', 'top', 'Playground hoodie', 'assets/clothing/tops/hoodie-child.svg', 'coral', ['garment'], ['child'], ['neutral']),
  wearable('top_cardigan_baby', 'top', 'Baby cardigan', 'assets/clothing/tops/cardigan-baby.svg', 'lavender', ['garment'], ['baby'], ['neutral']),
  wearable('top_tee_baby', 'top', 'Baby tee', 'assets/clothing/tops/tee-baby.svg', 'mint', ['garment'], ['baby'], ['neutral']),

  wearable('bottom_jeans', 'bottom', 'High-waist jeans', 'assets/clothing/bottoms/jeans.svg', 'denim'),
  wearable('bottom_skirt', 'bottom', 'Tennis skirt', 'assets/clothing/bottoms/skirt.svg', 'marigold', ['garment'], ['teen'], ['feminine']),
  wearable('bottom_shorts', 'bottom', 'Pleated shorts', 'assets/clothing/bottoms/shorts.svg', 'sage'),
  wearable('bottom_overalls', 'bottom', 'Dungaree overalls', 'assets/clothing/bottoms/overalls.svg', 'cocoa'),
  wearable('bottom_pleated_skirt', 'bottom', 'Plaid pleated skirt', 'assets/clothing/bottoms/pleated-skirt.svg', 'cherry', ['garment'], ['teen'], ['feminine']),
  wearable('bottom_culottes', 'bottom', 'Garden culottes', 'assets/clothing/bottoms/culottes.svg', 'lavender'),
  wearable('bottom_cargo', 'bottom', 'Pocket cargo pants', 'assets/clothing/bottoms/cargo.svg', 'sage', ['garment'], ['teen'], ['masculine']),
  wearable('bottom_trousers_classic', 'bottom', 'Classic trousers', 'assets/clothing/bottoms/trousers-classic.svg', 'charcoal', ['garment'], ['teen', 'adult', 'elder'], ['neutral']),
  wearable('bottom_slacks_adult', 'bottom', 'Relaxed slacks', 'assets/clothing/bottoms/slacks-adult.svg', 'charcoal', ['garment'], ['adult', 'elder'], ['neutral']),
  wearable('bottom_shorts_child', 'bottom', 'Playground shorts', 'assets/clothing/bottoms/shorts-child.svg', 'marigold', ['garment'], ['child'], ['neutral']),
  wearable('bottom_jeans_child', 'bottom', 'Playground jeans', 'assets/clothing/bottoms/jeans-child.svg', 'denim', ['garment'], ['child'], ['neutral']),
  wearable('bottom_bloomers_baby', 'bottom', 'Baby bloomers', 'assets/clothing/bottoms/bloomers-baby.svg', 'coral', ['garment'], ['baby'], ['neutral']),
  wearable('bottom_leggings_baby', 'bottom', 'Baby leggings', 'assets/clothing/bottoms/leggings-baby.svg', 'lavender', ['garment'], ['baby'], ['neutral']),

  wearable('dress_sundress', 'dress', 'Sundress', 'assets/clothing/dresses/sundress.svg', 'coral', ['garment'], ['teen'], ['feminine']),
  wearable('dress_party', 'dress', 'Tiered party dress', 'assets/clothing/dresses/party-dress.svg', 'coral', ['garment'], ['teen'], ['feminine']),
  wearable('dress_pinafore', 'dress', 'Pinafore apron dress', 'assets/clothing/dresses/pinafore.svg', 'marigold', ['garment'], ['teen'], ['feminine']),
  wearable('dress_ballgown', 'dress', 'Princess ballgown', 'assets/clothing/dresses/ballgown.svg', 'lavender', ['garment'], ['teen'], ['feminine']),
  wearable('dress_overall', 'dress', 'Patchwork overall dress', 'assets/clothing/dresses/overall.svg', 'denim'),
  wearable('dress_romper_baby', 'dress', 'Baby romper', 'assets/clothing/dresses/romper-baby.svg', 'sky', ['garment'], ['baby'], ['neutral']),
  wearable('dress_play_child', 'dress', 'Play dress', 'assets/clothing/dresses/play-dress-child.svg', 'coral', ['garment'], ['child'], ['neutral']),
  wearable('dress_rain_child', 'dress', 'Rainy-day dress', 'assets/clothing/dresses/rain-dress-child.svg', 'marigold', ['garment'], ['child'], ['neutral']),
  wearable('dress_sun_baby', 'dress', 'Baby sun dress', 'assets/clothing/dresses/sun-dress-baby.svg', 'marigold', ['garment'], ['baby'], ['neutral']),
  wearable('dress_party_baby', 'dress', 'Baby party dress', 'assets/clothing/dresses/party-dress-baby.svg', 'lavender', ['garment'], ['baby'], ['neutral']),
  wearable('dress_wrap_adult', 'dress', 'Wrap dress', 'assets/clothing/dresses/wrap-adult.svg', 'coral', ['garment'], ['adult'], ['neutral']),
  wearable('dress_suit_adult', 'dress', 'Tailored suit dress', 'assets/clothing/dresses/suit-adult.svg', 'charcoal', ['garment'], ['adult'], ['neutral']),
  wearable('dress_knit_elder', 'dress', 'Knit day dress', 'assets/clothing/dresses/knit-elder.svg', 'cocoa', ['garment'], ['elder'], ['neutral']),
  wearable('dress_apron_elder', 'dress', 'Apron day dress', 'assets/clothing/dresses/apron-elder.svg', 'sage', ['garment'], ['elder'], ['neutral']),

  wearable('shoes_sneakers', 'shoes', 'Retro sneakers', 'assets/clothing/shoes/sneakers.svg', 'coral'),
  wearable('shoes_sandals', 'shoes', 'Mary Jane flats', 'assets/clothing/shoes/sandals.svg', 'cocoa', ['garment'], ['teen'], ['feminine']),
  wearable('shoes_boots', 'shoes', 'Lace-up ankle boots', 'assets/clothing/shoes/boots.svg', 'cocoa', ['garment'], ['teen', 'adult', 'elder'], ['neutral']),
  wearable('shoes_loafers', 'shoes', 'Preppy loafers', 'assets/clothing/shoes/loafers.svg', 'brown', ['garment'], ['teen', 'adult', 'elder'], ['neutral']),
  wearable('shoes_ballet', 'shoes', 'Ballet ribbon flats', 'assets/clothing/shoes/ballet.svg', 'coral', ['garment'], ['teen'], ['feminine']),
  wearable('shoes_rainboots', 'shoes', 'Sunny rain boots', 'assets/clothing/shoes/rainboots.svg', 'marigold'),
  wearable('shoes_booties_baby', 'shoes', 'Soft booties', 'assets/clothing/shoes/booties-baby.svg', 'cream', ['garment'], ['baby'], ['neutral']),
  wearable('shoes_oxfords_classic', 'shoes', 'Classic oxfords', 'assets/clothing/shoes/oxfords-classic.svg', 'cocoa', ['garment'], ['teen', 'adult', 'elder'], ['neutral']),
  wearable('shoes_sneakers_child', 'shoes', 'Playground sneakers', 'assets/clothing/shoes/sneakers-child.svg', 'coral', ['garment'], ['child'], ['neutral']),
  wearable('shoes_rainboots_child', 'shoes', 'Playground rain boots', 'assets/clothing/shoes/rainboots-child.svg', 'marigold', ['garment'], ['child'], ['neutral']),
  wearable('shoes_sandals_baby', 'shoes', 'Baby sandals', 'assets/clothing/shoes/sandals-baby.svg', 'sky', ['garment'], ['baby'], ['neutral']),
  wearable('shoes_sneakers_baby', 'shoes', 'Baby sneakers', 'assets/clothing/shoes/sneakers-baby.svg', 'mint', ['garment'], ['baby'], ['neutral']),

  wearable('hair_short', 'hair', 'Chic bob', 'assets/clothing/hair/short.svg', 'marigold', ['hairBack', 'hairFront']),
  wearable('hair_long', 'hair', 'Long waves', 'assets/clothing/hair/long.svg', 'brown', ['hairBack', 'hairFront'], ['teen'], ['feminine']),
  wearable('hair_ponytail', 'hair', 'High ponytail', 'assets/clothing/hair/ponytail.svg', 'cocoa', ['hairBack', 'hairFront']),
  wearable('hair_twintails', 'hair', 'Bouncy twintails', 'assets/clothing/hair/twintails.svg', 'blonde', ['hairBack', 'hairFront'], ['teen'], ['feminine']),
  wearable('hair_curly', 'hair', 'Voluminous curls', 'assets/clothing/hair/curly.svg', 'brown', ['hairBack', 'hairFront']),
  wearable('hair_braids', 'hair', 'Crown braids', 'assets/clothing/hair/braids.svg', 'cocoa', ['hairBack', 'hairFront'], ['teen'], ['feminine']),
  wearable('hair_bun', 'hair', 'Top knot bun', 'assets/clothing/hair/bun.svg', 'brown', ['hairBack', 'hairFront']),
  wearable('hair_wavy_bob', 'hair', 'Wavy bob', 'assets/clothing/hair/wavy-bob.svg', 'cocoa', ['hairBack', 'hairFront']),
  wearable('hair_baby_curl', 'hair', 'Baby curl', 'assets/clothing/hair/baby-curl.svg', 'blonde', ['hairBack', 'hairFront'], ['baby'], ['neutral']),
  wearable('hair_silver_waves', 'hair', 'Silver waves', 'assets/clothing/hair/silver-waves.svg', 'white', ['hairBack', 'hairFront'], ['adult', 'elder'], ['neutral']),
  wearable('hair_short_slick', 'hair', 'Short slick', 'assets/clothing/hair/short-slick.svg', 'black', ['hairBack', 'hairFront'], ['teen', 'adult', 'elder'], ['neutral']),
  wearable('hair_bob_child', 'hair', 'Child bob', 'assets/clothing/hair/bob-child.svg', 'marigold', ['hairBack', 'hairFront'], ['child'], ['neutral']),
  wearable('hair_curls_child', 'hair', 'Child curls', 'assets/clothing/hair/curls-child.svg', 'brown', ['hairBack', 'hairFront'], ['child'], ['neutral']),
  wearable('hair_puffs_baby', 'hair', 'Baby puffs', 'assets/clothing/hair/puffs-baby.svg', 'black', ['hairBack', 'hairFront'], ['baby'], ['neutral']),
  wearable('hair_bun_baby', 'hair', 'Baby bun', 'assets/clothing/hair/bun-baby.svg', 'brown', ['hairBack', 'hairFront'], ['baby'], ['neutral']),

  wearable('accessory_hat', 'accessory', 'Sun hat', 'assets/clothing/accessories/hat.svg', 'marigold'),
  wearable('accessory_glasses', 'accessory', 'Cat-eye glasses', 'assets/clothing/accessories/glasses.svg', 'cocoa'),
  wearable('accessory_bow', 'accessory', 'Silk hair bow', 'assets/clothing/accessories/bow.svg', 'coral', ['garment'], ['teen'], ['feminine']),
  wearable('accessory_beret', 'accessory', 'Artist wool beret', 'assets/clothing/accessories/beret.svg', 'cherry'),
  wearable('accessory_crown', 'accessory', 'Golden tiara', 'assets/clothing/accessories/crown.svg', 'marigold'),
  wearable('accessory_headphones', 'accessory', 'Retro headphones', 'assets/clothing/accessories/headphones.svg', 'mint'),
  wearable('accessory_cat_ears', 'accessory', 'Cat ear headband', 'assets/clothing/accessories/cat-ears.svg', 'coral'),
  wearable('accessory_ribbon', 'accessory', 'Polka-dot ribbon', 'assets/clothing/accessories/ribbon.svg', 'coral', ['garment'], ['teen'], ['feminine']),
  wearable('accessory_hairclip', 'accessory', 'Star hair clip', 'assets/clothing/accessories/hairclip.svg', 'marigold'),
  wearable('accessory_flower', 'accessory', 'Daisy hair flower', 'assets/clothing/accessories/flower.svg', 'marigold', ['garment'], ['teen'], ['feminine']),
  wearable('accessory_bib_baby', 'accessory', 'Baby bib', 'assets/clothing/accessories/bib-baby.svg', 'sky', ['garment'], ['baby'], ['neutral']),
  wearable('accessory_pacifier_baby', 'accessory', 'Baby pacifier', 'assets/clothing/accessories/pacifier-baby.svg', 'lavender', ['garment'], ['baby'], ['neutral']),
  wearable('accessory_shawl_elder', 'accessory', 'Warm wrap shawl', 'assets/clothing/accessories/shawl-elder.svg', 'sage', ['garment'], ['adult', 'elder'], ['neutral']),
  wearable('accessory_spectacles_elder', 'accessory', 'Reading spectacles', 'assets/clothing/accessories/spectacles-elder.svg', 'cocoa', ['garment'], ['teen', 'adult', 'elder'], ['neutral']),
  wearable('accessory_cap_child', 'accessory', 'Playground cap', 'assets/clothing/accessories/cap-child.svg', 'sky', ['garment'], ['child'], ['neutral']),
  wearable('accessory_backpack_child', 'accessory', 'Little backpack', 'assets/clothing/accessories/backpack-child.svg', 'coral', ['garment'], ['child'], ['neutral']),
  wearable('accessory_bonnet_baby', 'accessory', 'Soft baby bonnet', 'assets/clothing/accessories/bonnet-baby.svg', 'lavender', ['garment'], ['baby'], ['neutral']),
  wearable('accessory_rattle_baby', 'accessory', 'Baby rattle', 'assets/clothing/accessories/rattle-baby.svg', 'marigold', ['garment'], ['baby'], ['neutral']),

  { id: 'bg_bedroom', kind: 'background', name: 'Cozy bedroom', path: 'assets/backgrounds/bedroom.svg', viewBox: [0, 0, 1600, 900], backgroundWidth: 1600, requiredGroups: ['background'] },
  { id: 'bg_park', kind: 'background', name: 'Sunny park', path: 'assets/backgrounds/park.svg', viewBox: [0, 0, 1600, 900], backgroundWidth: 1600, requiredGroups: ['background'] },
  { id: 'bg_atelier', kind: 'background', name: 'Creative atelier', path: 'assets/backgrounds/atelier.svg', viewBox: [0, 0, 1600, 900], backgroundWidth: 1600, requiredGroups: ['background'] },
  { id: 'bg_beach', kind: 'background', name: 'Sunny beach', path: 'assets/backgrounds/beach.svg', viewBox: [0, 0, 1600, 900], backgroundWidth: 1600, requiredGroups: ['background'] },
  { id: 'bg_cafe', kind: 'background', name: 'Cozy cafe & bakery', path: 'assets/backgrounds/cafe.svg', viewBox: [0, 0, 1600, 900], backgroundWidth: 1600, requiredGroups: ['background'] },
  { id: 'bg_forest', kind: 'background', name: 'Enchanted forest', path: 'assets/backgrounds/forest.svg', viewBox: [0, 0, 1600, 900], backgroundWidth: 1600, requiredGroups: ['background'] },
  { id: 'bg_library', kind: 'background', name: 'Vintage library', path: 'assets/backgrounds/library.svg', viewBox: [0, 0, 1600, 900], backgroundWidth: 1600, requiredGroups: ['background'] },
  { id: 'bg_moonlit_meadow', kind: 'background', name: 'Moonlit meadow', path: 'assets/backgrounds/moonlit-meadow.svg', viewBox: [0, 0, 3200, 900], backgroundWidth: 3200, requiredGroups: ['background'] },
  { id: 'bg_snowy_village', kind: 'background', name: 'Snowy village', path: 'assets/backgrounds/snowy-village.svg', viewBox: [0, 0, 3200, 900], backgroundWidth: 3200, requiredGroups: ['background'] },
  { id: 'bg_city_sunset', kind: 'background', name: 'Rooftop sunset', path: 'assets/backgrounds/city-sunset.svg', viewBox: [0, 0, 3200, 900], backgroundWidth: 3200, requiredGroups: ['background'] },
  { id: 'bg_candy_land', kind: 'background', name: 'Candy land', path: 'assets/backgrounds/candy-land.svg', viewBox: [0, 0, 4800, 900], backgroundWidth: 4800, requiredGroups: ['background'] },

  prop('prop_chair', 'Armchair', 'assets/props/chair.svg', 240, 270, ['home']),
  prop('prop_table', 'Cafe table', 'assets/props/table.svg', 250, 230, ['home']),
  prop('prop_plant', 'Monstera plant', 'assets/props/plant.svg', 200, 270, ['home']),
  prop('prop_lamp', 'Floor lamp', 'assets/props/lamp.svg', 160, 360, ['home']),
  prop('prop_rug', 'Pastel rug', 'assets/props/rug.svg', 380, 140, ['home']),
  prop('prop_tea_set', 'Tea set', 'assets/props/tea-set.svg', 170, 120, ['home']),
  prop('prop_easel', 'Art easel', 'assets/props/easel.svg', 220, 290, ['creative']),
  prop('prop_bookshelf', 'Cozy bookshelf', 'assets/props/bookshelf.svg', 260, 320, ['home']),
  prop('prop_cat', 'Sleeping cat', 'assets/props/cat.svg', 180, 130, ['home']),
  prop('prop_picnic_basket', 'Picnic basket', 'assets/props/picnic-basket.svg', 190, 160, ['fun']),
  prop('prop_umbrella', 'Beach parasol', 'assets/props/umbrella.svg', 260, 340, ['outdoors']),
  prop('prop_balloons', 'Balloons bunch', 'assets/props/balloons.svg', 210, 310, ['fun']),
  prop('prop_cake', 'Celebration cake', 'assets/props/cake.svg', 170, 170, ['fun']),
  prop('prop_guitar', 'Acoustic guitar', 'assets/props/guitar.svg', 180, 300, ['creative']),
  prop('prop_painting', 'Wall art frame', 'assets/props/painting.svg', 220, 180, ['creative']),
  prop('prop_bench', 'Garden bench', 'assets/props/bench.svg', 300, 200, ['outdoors']),
  prop('prop_bicycle', 'Garden bicycle', 'assets/props/bicycle.svg', 300, 220, ['outdoors']),
  prop('prop_kite', 'Colorful kite', 'assets/props/kite.svg', 200, 260, ['fun']),
  prop('prop_camera', 'Little camera', 'assets/props/camera.svg', 180, 140, ['creative']),
  prop('prop_flower_pot', 'Flower pot', 'assets/props/flower-pot.svg', 180, 220, ['outdoors']),
  prop('prop_mailbox', 'Garden mailbox', 'assets/props/mailbox.svg', 220, 220, ['outdoors']),
  prop('prop_picnic_blanket', 'Picnic blanket', 'assets/props/picnic-blanket.svg', 360, 160, ['fun'])
].map((asset) => Object.freeze({
  ...asset,
  metadata: Object.freeze({
    added_date: PANORAMIC_CORE_ASSET_IDS.has(asset.id) ? '2026-08-19' : NEW_CORE_ASSET_IDS.has(asset.id) ? '2026-08-16' : '2026-08-14',
    creator: PANORAMIC_CORE_ASSET_IDS.has(asset.id) ? ASSET_CREATOR : NEW_CORE_ASSET_IDS.has(asset.id) ? NEW_ASSET_CREATOR : ASSET_CREATOR,
    concept: PANORAMIC_CORE_ASSET_IDS.has(asset.id) ? 'seamless panorama' : NEW_CORE_ASSET_IDS.has(asset.id) ? 'weekend garden' : 'core',
    dlc: 'core',
    source: 'project-authored SVG primitives and paths'
  })
})));

const byId = new Map(ASSETS.map((asset) => [asset.id, Object.freeze(asset)]));

export function getAsset(id) {
  return byId.get(id);
}

export function assetsByKind(kind, { collectionId = null } = {}) {
  if (collectionId) return assetsByCollection(kind, collectionId);
  return ASSETS.filter((asset) => asset.kind === kind);
}

export const PROP_COLLECTIONS = Object.freeze([
  Object.freeze({ id: 'home', labelKey: 'play.propCollectionHome' }),
  Object.freeze({ id: 'outdoors', labelKey: 'play.propCollectionOutdoors' }),
  Object.freeze({ id: 'creative', labelKey: 'play.propCollectionCreative' }),
  Object.freeze({ id: 'fun', labelKey: 'play.propCollectionFun' }),
  Object.freeze({ id: 'my-art', labelKey: 'play.propCollectionMyArt', customOnly: true })
]);

export function assetsByCollection(kind, collectionId) {
  if (kind !== 'prop') return [];
  if (collectionId === 'my-art') return [];
  if (!isPropCollection(collectionId)) return [];
  return ASSETS.filter((asset) => asset.kind === kind && asset.collections?.includes(collectionId));
}

export function dolls() {
  return ASSETS.filter((asset) => asset.kind === 'doll');
}

export function dollsByLifeStage(stage) {
  return ASSETS.filter((asset) => asset.kind === 'doll' && asset.lifeStages?.includes(stage));
}

export function wearablesBySlot(slot) {
  return ASSETS.filter((asset) => asset.kind === 'wearable' && asset.slot === slot);
}

export function getOfferedWearables(slot, baseDollId, styleFilter = 'all') {
  const doll = getAsset(baseDollId);
  const fitFamily = doll?.fitFamily || 'teen';
  return wearablesBySlot(slot).filter((wearable) => matchesDiscoveryFilters(wearable, fitFamily, styleFilter));
}

export function matchesDiscoveryFilters(asset, fitFamily = 'teen', styleFilter = 'all') {
  if (asset?.supportedFitFamilies && !asset.supportedFitFamilies.includes(fitFamily)) return false;
  if (styleFilter === 'all') return true;
  return asset?.presentationStyles?.includes(styleFilter) ||
    (styleFilter === 'unsorted' && (!asset?.presentationStyles || asset.presentationStyles.length === 0));
}

export function facesByGroup(group, fitFamily) {
  return ASSETS.filter((asset) => asset.kind === 'face' && asset.faceGroup === group &&
    (!fitFamily || !asset.supportedFitFamilies || asset.supportedFitFamilies.includes(fitFamily)));
}

function face(id, faceGroup, name, path, requiredGroups = ['face-feature']) {
  return {
    id, kind: 'face', faceGroup, name, path, viewBox: dollViewBox,
    requiredGroups,
    supportedFitFamilies: [...FIT_FAMILIES]
  };
}

function wearable(id, slot, name, path, color, requiredGroups = ['garment'], supportedFitFamilies = ['teen'], presentationStyles = ['neutral'], poseSupport = 'rigid') {
  return {
    id, kind: 'wearable', slot, name, path, viewBox: dollViewBox,
    tintable: true, defaultColors: { primary: color }, requiredGroups,
    supportedFitFamilies,
    presentationStyles,
    poseSupport
  };
}

function prop(id, name, path, displayWidth, displayHeight, collections = []) {
  return {
    id, kind: 'prop', name, path, viewBox: [0, 0, 1000, 1000], requiredGroups: ['prop'],
    displayWidth, displayHeight, collections: Object.freeze([...collections]),
    groundAnchor: { x: 0.5, y: 1.0 }, defaultScale: 1
  };
}
