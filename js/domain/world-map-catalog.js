/**
 * The Papercraft World Map (Diyar Haritası) Domain Catalog & Unlock Engine
 * Declares the map canvas, biomes, illustrated landmarks, easter eggs,
 * collectible stamps, and future-proof unlock requirements.
 *
 * This module is the single source of truth for landmark placement. The SVG in
 * index.html only supplies the artwork; `world-map-view.js` positions every
 * landmark anchor from `coord` here, so adding a realm never means editing
 * coordinates in two places.
 */

/**
 * Wide, scrollable map canvas. Matches the SVG viewBox in index.html and is
 * asserted by test/world-map.test.js so the two can never drift.
 */
export const MAP_CANVAS = Object.freeze({
  width: 2400,
  height: 900,
  /** Horizontal padding kept clear of landmarks when the camera pans. */
  edgePadding: 60,
  /** Vertical space a landmark needs above its anchor for the doll marker. */
  markerHeadroom: 190
});

export const BIOMES = Object.freeze({
  cozyTown: {
    id: 'cozyTown',
    icon: '🏡',
    nameKey: 'worldMap.biomes.cozyTown.name',
    themeColor: '#e07a5f',
    bgTint: '#fdf6ed',
    band: { x: 34, width: 766 }
  },
  theWilds: {
    id: 'theWilds',
    icon: '🌲',
    nameKey: 'worldMap.biomes.theWilds.name',
    themeColor: '#588157',
    bgTint: '#edf6ed',
    band: { x: 796, width: 790 }
  },
  dreamRealms: {
    id: 'dreamRealms',
    icon: '✨',
    nameKey: 'worldMap.biomes.dreamRealms.name',
    themeColor: '#7b2cbf',
    bgTint: '#f4eefd',
    band: { x: 1584, width: 782 }
  }
});

export const SOUVENIR_STAMPS = Object.freeze([
  { id: 'chimney', landmarkId: 'bedroom', icon: '💨', nameKey: 'worldMap.stamps.chimney.name' },
  { id: 'kitten', landmarkId: 'cafe', icon: '🐱', nameKey: 'worldMap.stamps.kitten.name' },
  { id: 'palette', landmarkId: 'atelier', icon: '🎨', nameKey: 'worldMap.stamps.palette.name' },
  { id: 'owl', landmarkId: 'library', icon: '🦉', nameKey: 'worldMap.stamps.owl.name' },
  { id: 'butterfly', landmarkId: 'park', icon: '🦋', nameKey: 'worldMap.stamps.butterfly.name' },
  { id: 'message_bottle', landmarkId: 'beach', icon: '📜', nameKey: 'worldMap.stamps.message_bottle.name' },
  { id: 'squirrel', landmarkId: 'forest', icon: '🐿️', nameKey: 'worldMap.stamps.squirrel.name' },
  { id: 'fireflies', landmarkId: 'moonlit-meadow', icon: '✨', nameKey: 'worldMap.stamps.fireflies.name' },
  { id: 'snowflake', landmarkId: 'snowy-village', icon: '❄️', nameKey: 'worldMap.stamps.snowflake.name' },
  { id: 'balloon', landmarkId: 'city-sunset', icon: '🎈', nameKey: 'worldMap.stamps.balloon.name' },
  { id: 'pinwheel', landmarkId: 'candy-land', icon: '🍭', nameKey: 'worldMap.stamps.pinwheel.name' }
]);

export const WORLD_MAP_LANDMARKS = Object.freeze([
  // 🏡 Sevimli Kasaba (Cozy Town)
  {
    id: 'bedroom',
    backgroundId: 'bg_bedroom',
    biome: 'cozyTown',
    nameKey: 'worldMap.landmarks.bedroom.name',
    descKey: 'worldMap.landmarks.bedroom.desc',
    easterEggHintKey: 'worldMap.landmarks.bedroom.eggHint',
    stampId: 'chimney',
    coord: { x: 170, y: 330 },
    unlockedByDefault: true
  },
  {
    id: 'cafe',
    backgroundId: 'bg_cafe',
    biome: 'cozyTown',
    nameKey: 'worldMap.landmarks.cafe.name',
    descKey: 'worldMap.landmarks.cafe.desc',
    easterEggHintKey: 'worldMap.landmarks.cafe.eggHint',
    stampId: 'kitten',
    coord: { x: 450, y: 300 },
    unlockedByDefault: true
  },
  {
    id: 'atelier',
    backgroundId: 'bg_atelier',
    biome: 'cozyTown',
    nameKey: 'worldMap.landmarks.atelier.name',
    descKey: 'worldMap.landmarks.atelier.desc',
    easterEggHintKey: 'worldMap.landmarks.atelier.eggHint',
    stampId: 'palette',
    coord: { x: 240, y: 670 },
    unlockedByDefault: true
  },
  {
    id: 'library',
    backgroundId: 'bg_library',
    biome: 'cozyTown',
    nameKey: 'worldMap.landmarks.library.name',
    descKey: 'worldMap.landmarks.library.desc',
    easterEggHintKey: 'worldMap.landmarks.library.eggHint',
    stampId: 'owl',
    coord: { x: 620, y: 580 },
    unlockedByDefault: true
  },

  // 🌲 Doğanın Kalbi (The Wilds)
  {
    id: 'park',
    backgroundId: 'bg_park',
    biome: 'theWilds',
    nameKey: 'worldMap.landmarks.park.name',
    descKey: 'worldMap.landmarks.park.desc',
    easterEggHintKey: 'worldMap.landmarks.park.eggHint',
    stampId: 'butterfly',
    coord: { x: 960, y: 320 },
    unlockedByDefault: true
  },
  {
    id: 'beach',
    backgroundId: 'bg_beach',
    biome: 'theWilds',
    nameKey: 'worldMap.landmarks.beach.name',
    descKey: 'worldMap.landmarks.beach.desc',
    easterEggHintKey: 'worldMap.landmarks.beach.eggHint',
    stampId: 'message_bottle',
    coord: { x: 1450, y: 300 },
    unlockedByDefault: true
  },
  {
    id: 'forest',
    backgroundId: 'bg_forest',
    biome: 'theWilds',
    nameKey: 'worldMap.landmarks.forest.name',
    descKey: 'worldMap.landmarks.forest.desc',
    easterEggHintKey: 'worldMap.landmarks.forest.eggHint',
    stampId: 'squirrel',
    coord: { x: 1230, y: 660 },
    unlockedByDefault: true
  },

  // ✨ Rüya Diyarları (Dream Realms)
  {
    id: 'moonlit-meadow',
    backgroundId: 'bg_moonlit_meadow',
    biome: 'dreamRealms',
    nameKey: 'worldMap.landmarks.moonlitMeadow.name',
    descKey: 'worldMap.landmarks.moonlitMeadow.desc',
    easterEggHintKey: 'worldMap.landmarks.moonlitMeadow.eggHint',
    stampId: 'fireflies',
    coord: { x: 1730, y: 320 },
    unlockedByDefault: true
  },
  {
    id: 'snowy-village',
    backgroundId: 'bg_snowy_village',
    biome: 'dreamRealms',
    nameKey: 'worldMap.landmarks.snowyVillage.name',
    descKey: 'worldMap.landmarks.snowyVillage.desc',
    easterEggHintKey: 'worldMap.landmarks.snowyVillage.eggHint',
    stampId: 'snowflake',
    coord: { x: 2060, y: 300 },
    unlockedByDefault: true
  },
  {
    id: 'city-sunset',
    backgroundId: 'bg_city_sunset',
    biome: 'dreamRealms',
    nameKey: 'worldMap.landmarks.citySunset.name',
    descKey: 'worldMap.landmarks.citySunset.desc',
    easterEggHintKey: 'worldMap.landmarks.citySunset.eggHint',
    stampId: 'balloon',
    coord: { x: 1800, y: 670 },
    unlockedByDefault: true
  },
  {
    id: 'candy-land',
    backgroundId: 'bg_candy_land',
    biome: 'dreamRealms',
    nameKey: 'worldMap.landmarks.candyLand.name',
    descKey: 'worldMap.landmarks.candyLand.desc',
    easterEggHintKey: 'worldMap.landmarks.candyLand.eggHint',
    stampId: 'pinwheel',
    coord: { x: 2170, y: 650 },
    unlockedByDefault: true
  }
]);

/**
 * Checks if a landmark or background is unlocked for the current settings.
 * A landmark is unlocked if:
 * 1. It is unlockedByDefault (true for all default landmarks)
 * 2. Or backgroundId is in settings.unlockedBackgrounds
 * 3. Or its unlockRequirement is satisfied by the current settings
 */
export function isLandmarkUnlocked(landmark, settings = {}) {
  if (!landmark) return false;
  if (landmark.unlockedByDefault !== false) return true;

  const unlockedList = Array.isArray(settings?.unlockedBackgrounds) ? settings.unlockedBackgrounds : [];
  if (unlockedList.includes(landmark.backgroundId) || unlockedList.includes(landmark.id)) {
    return true;
  }

  const req = landmark.unlockRequirement;
  if (!req) return false;

  const stamps = Array.isArray(settings?.stamps) ? settings.stamps : [];
  if (req.type === 'stamp_count') {
    return stamps.length >= (req.threshold ?? 1);
  }
  if (req.type === 'easter_egg' && req.eggId) {
    return stamps.includes(req.eggId);
  }

  return false;
}

/**
 * Evaluates all landmarks against settings to identify any newly eligible unlocks.
 */
export function evaluateUnlockableBackgrounds(settings = {}, customLandmarks = []) {
  const all = [...WORLD_MAP_LANDMARKS, ...customLandmarks];
  const eligible = [];
  for (const lm of all) {
    if (lm.unlockedByDefault === false && isLandmarkUnlocked(lm, settings)) {
      eligible.push(lm.backgroundId);
    }
  }
  return [...new Set(eligible)];
}

export function getLandmarkById(id) {
  return WORLD_MAP_LANDMARKS.find((lm) => lm.id === id) || null;
}

export function getLandmarkByBackgroundId(bgId) {
  return WORLD_MAP_LANDMARKS.find((lm) => lm.backgroundId === bgId) || null;
}

export function getStampById(id) {
  return SOUVENIR_STAMPS.find((s) => s.id === id) || null;
}

export function getLandmarksByBiome(biomeId) {
  return WORLD_MAP_LANDMARKS.filter((lm) => lm.biome === biomeId);
}

/**
 * Clamps a desired camera offset to the pannable range of the wide map.
 * `visibleWidth` is the width of the camera window in map units.
 */
export function clampCameraX(cameraX, visibleWidth, canvasWidth = MAP_CANVAS.width) {
  const maxX = Math.max(0, canvasWidth - Math.max(0, visibleWidth));
  if (!Number.isFinite(cameraX)) return 0;
  return Math.min(maxX, Math.max(0, cameraX));
}

/**
 * Camera offset that centres a landmark inside the visible window.
 */
export function cameraXForLandmark(landmark, visibleWidth, canvasWidth = MAP_CANVAS.width) {
  const x = Number.isFinite(landmark?.coord?.x) ? landmark.coord.x : 0;
  return clampCameraX(x - visibleWidth / 2, visibleWidth, canvasWidth);
}

/**
 * Normalised [0..1] position of a landmark across the canvas, for minimap dots.
 */
export function landmarkMapRatio(landmark, canvasWidth = MAP_CANVAS.width) {
  const x = Number.isFinite(landmark?.coord?.x) ? landmark.coord.x : 0;
  return Math.min(1, Math.max(0, x / canvasWidth));
}
