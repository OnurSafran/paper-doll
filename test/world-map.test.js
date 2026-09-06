import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BIOMES,
  MAP_CANVAS,
  SOUVENIR_STAMPS,
  WORLD_MAP_LANDMARKS,
  cameraXForLandmark,
  clampCameraX,
  landmarkMapRatio,
  isLandmarkUnlocked,
  evaluateUnlockableBackgrounds,
  getLandmarkById,
  getLandmarkByBackgroundId,
  getStampById,
  getLandmarksByBiome
} from '../js/domain/world-map-catalog.js';
import { createAppStore } from '../js/core/app-store.js';
import { createDefaultEnvelope, sanitizeEnvelope } from '../js/core/state-schema.js';
import { ASSETS } from '../js/core/asset-catalog.js';

test('world-map-catalog defines 3 biomes and 11 landmarks mapped to background catalog', () => {
  assert.equal(Object.keys(BIOMES).length, 3);
  assert.equal(WORLD_MAP_LANDMARKS.length, 11);

  const backgroundAssets = ASSETS.filter((a) => a.kind === 'background');
  assert.equal(backgroundAssets.length, 11);

  const catalogBgIds = new Set(backgroundAssets.map((a) => a.id));
  for (const landmark of WORLD_MAP_LANDMARKS) {
    assert.ok(catalogBgIds.has(landmark.backgroundId), `Landmark ${landmark.id} background ${landmark.backgroundId} exists in catalog`);
    assert.ok(BIOMES[landmark.biome], `Landmark ${landmark.id} biome ${landmark.biome} exists in BIOMES`);
    assert.ok(Number.isFinite(landmark.coord.x) && Number.isFinite(landmark.coord.y), 'Landmark has valid coordinates');
    assert.ok(landmark.stampId, 'Landmark references a souvenir stamp');
  }
});

test('world-map-catalog defines 11 unique souvenir stamps with icons', () => {
  assert.equal(SOUVENIR_STAMPS.length, 11);
  const stampIds = new Set(SOUVENIR_STAMPS.map((s) => s.id));
  assert.equal(stampIds.size, 11);

  for (const stamp of SOUVENIR_STAMPS) {
    assert.ok(getStampById(stamp.id), `Stamp ${stamp.id} retrieved successfully`);
    assert.ok(getLandmarkById(stamp.landmarkId), `Stamp ${stamp.id} mapped to landmark ${stamp.landmarkId}`);
    assert.ok(stamp.icon, 'Stamp has an icon');
  }
});

test('isLandmarkUnlocked evaluates defaults, settings list, and requirements correctly', () => {
  const defaultLandmark = getLandmarkById('bedroom');
  assert.equal(isLandmarkUnlocked(defaultLandmark, {}), true);

  const mockLockedLandmark = {
    id: 'secret_shrine',
    backgroundId: 'bg_secret_shrine',
    unlockedByDefault: false,
    unlockRequirement: { type: 'stamp_count', threshold: 3 }
  };

  assert.equal(isLandmarkUnlocked(mockLockedLandmark, {}), false);
  assert.equal(isLandmarkUnlocked(mockLockedLandmark, { stamps: ['chimney', 'kitten'] }), false);
  assert.equal(isLandmarkUnlocked(mockLockedLandmark, { stamps: ['chimney', 'kitten', 'owl'] }), true);

  // Directly in unlockedBackgrounds list
  assert.equal(isLandmarkUnlocked(mockLockedLandmark, { unlockedBackgrounds: ['bg_secret_shrine'] }), true);

  // Easter egg requirement
  const eggLandmark = {
    id: 'hidden_grotto',
    backgroundId: 'bg_hidden_grotto',
    unlockedByDefault: false,
    unlockRequirement: { type: 'easter_egg', eggId: 'pinwheel' }
  };
  assert.equal(isLandmarkUnlocked(eggLandmark, { stamps: ['chimney'] }), false);
  assert.equal(isLandmarkUnlocked(eggLandmark, { stamps: ['chimney', 'pinwheel'] }), true);
});

test('evaluateUnlockableBackgrounds discovers newly eligible unlocks from custom landmarks', () => {
  const custom = [
    {
      id: 'bonus_realm',
      backgroundId: 'bg_bonus_realm',
      unlockedByDefault: false,
      unlockRequirement: { type: 'stamp_count', threshold: 2 }
    }
  ];

  const unlockedBefore = evaluateUnlockableBackgrounds({ stamps: ['chimney'] }, custom);
  assert.ok(!unlockedBefore.includes('bg_bonus_realm'));

  const unlockedAfter = evaluateUnlockableBackgrounds({ stamps: ['chimney', 'kitten'] }, custom);
  assert.ok(unlockedAfter.includes('bg_bonus_realm'));
});

test('AppStore handles settings/unlockStamp and settings/unlockBackground with persistence and deduplication', () => {
  const dummyAsset = (id) => (id === 'bg_bedroom' ? { id, kind: 'background' } : { id, kind: 'doll' });
  const store = createAppStore(createDefaultEnvelope(), { getAsset: dummyAsset });

  assert.deepEqual(store.getState().settings.stamps, []);
  assert.deepEqual(store.getState().settings.unlockedBackgrounds, []);

  // Unlock first stamp
  const res1 = store.dispatch({ type: 'settings/unlockStamp', stampId: 'chimney' });
  assert.equal(res1?.ok, true);
  assert.deepEqual(store.getState().settings.stamps, ['chimney']);

  // Duplicate stamp is a no-op
  const resDup = store.dispatch({ type: 'settings/unlockStamp', stampId: 'chimney' });
  assert.equal(resDup?.ok, false);
  assert.deepEqual(store.getState().settings.stamps, ['chimney']);

  // Unlock background
  const resBg = store.dispatch({ type: 'settings/unlockBackground', backgroundId: 'bg_bonus_realm' });
  assert.equal(resBg?.ok, true);
  assert.deepEqual(store.getState().settings.unlockedBackgrounds, ['bg_bonus_realm']);
});

test('State Schema sanitizes stamps and unlockedBackgrounds cleanly', () => {
  const raw = {
    ...createDefaultEnvelope(),
    settings: {
      soundEnabled: true,
      stamps: ['chimney', 123, '', '   kitten   ', 'chimney', null, 'a'.repeat(60)],
      unlockedBackgrounds: ['bg_custom', 'bg_custom', '   ']
    }
  };

  const { envelope } = sanitizeEnvelope(raw);
  assert.deepEqual(envelope.settings.stamps, ['chimney', 'kitten']);
  assert.deepEqual(envelope.settings.unlockedBackgrounds, ['bg_custom']);
});

test('getLandmarkByBackgroundId resolves landmarks for all 11 backgrounds', () => {
  for (const landmark of WORLD_MAP_LANDMARKS) {
    const found = getLandmarkByBackgroundId(landmark.backgroundId);
    assert.equal(found?.id, landmark.id);
  }
});

test('Paper audio factory exposes all methods and respects soundEnabled setting', async () => {
  const { createPaperAudio } = await import('../js/core/paper-audio.js');
  let soundOn = false;
  const audio = createPaperAudio(() => soundOn);

  assert.equal(typeof audio.playPaperRustle, 'function');
  assert.equal(typeof audio.playStampThud, 'function');
  assert.equal(typeof audio.playPurr, 'function');
  assert.equal(typeof audio.playChime, 'function');
  assert.equal(typeof audio.playPageTurn, 'function');
  assert.equal(typeof audio.playPop, 'function');

  // Should safely execute without errors when sound is off
  assert.doesNotThrow(() => audio.playPaperRustle());
  assert.doesNotThrow(() => audio.playStampThud());
  assert.doesNotThrow(() => audio.playPurr());
  assert.doesNotThrow(() => audio.playChime());
  assert.doesNotThrow(() => audio.playPageTurn());
  assert.doesNotThrow(() => audio.playPop());
});

test('World map HTML contains accessible foreignObject doll slot and keyboard-accessible easter eggs', async () => {
  const fs = await import('node:fs');
  const html = fs.readFileSync('index.html', 'utf-8');

  // foreignObject active doll slot
  assert.match(html, /<foreignObject id="active-marker-doll-foreign"[^>]*>/);
  assert.match(html, /<div id="active-marker-doll-slot" class="active-marker-doll-slot"><\/div>/);

  // Easter egg accessibility: role="button" and tabindex="0" on all triggers
  const eggIds = [
    'egg-cottage-chimney', 'egg-cafe-bench', 'egg-atelier-easel',
    'egg-library-owl', 'egg-park-flowers', 'egg-beach-bottle',
    'egg-forest-oak', 'egg-meadow-moon', 'egg-snowy-chimney',
    'egg-city-clouds', 'egg-candy-pinwheel'
  ];

  for (const eggId of eggIds) {
    assert.match(html, new RegExp(`id="${eggId}"[^>]*role="button"[^>]*tabindex="0"`));
    assert.match(html, new RegExp(`id="${eggId}"[^>]*class="[^"]*easter-egg-trigger[^"]*"`));
  }
});

test('World map dialog supports light-dismiss via closedby="any" and the shared backdrop helper', async () => {
  const fs = await import('node:fs');
  const html = fs.readFileSync('index.html', 'utf-8');
  const viewJs = fs.readFileSync('js/features/world-map/world-map-view.js', 'utf-8');
  const appJs = fs.readFileSync('js/app.js', 'utf-8');

  // Declarative modern standard closedby="any"
  assert.match(html, /<dialog id="world-map-dialog"[^>]*closedby="any"/);
  assert.match(html, /<dialog id="world-map-dialog"[^>]*class="[^"]*library-dialog/);

  // Backdrop dismissal comes from the shared helper, not a per-view copy.
  assert.match(appJs, /dialog\.library-dialog.+enableDialogLightDismiss/s);
  assert.doesNotMatch(viewJs, /pointerDownOnBackdrop/);
  assert.match(viewJs, /closeWorldMapDialog\(\)/);
});


// ===========================================================================
// Wide-canvas layout: the catalog is the single source of truth
// ===========================================================================

function readMapSvg() {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const start = html.indexOf('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 900"');
  assert.ok(start > -1, 'index.html embeds the wide world map SVG');
  return { html, svg: html.slice(start, html.indexOf('</svg>', start) + 6) };
}

test('World map SVG canvas matches MAP_CANVAS and every landmark is placed from the catalog', () => {
  const { svg } = readMapSvg();

  assert.ok(svg.includes(`viewBox="0 0 ${MAP_CANVAS.width} ${MAP_CANVAS.height}"`),
    'SVG viewBox matches MAP_CANVAS');

  for (const landmark of WORLD_MAP_LANDMARKS) {
    const anchor = new RegExp(`<g class="map-landmark-anchor" data-landmark-id="${landmark.id}">`);
    assert.match(svg, anchor, `${landmark.id} has a positioning anchor`);

    // Anchors must carry no authored coordinates — world-map-view.js sets them.
    const anchorTag = svg.match(new RegExp(`<g class="map-landmark-anchor" data-landmark-id="${landmark.id}"[^>]*>`))[0];
    assert.doesNotMatch(anchorTag, /\stransform=/,
      `${landmark.id} anchor must not hard-code a transform (the catalog owns coordinates)`);

    const bodyTag = svg.match(new RegExp(`<g id="landmark-${landmark.id}"[^>]*>`))[0];
    assert.doesNotMatch(bodyTag, /\stransform=/,
      `#landmark-${landmark.id} must stay free of a transform attribute so CSS hover lift composes`);
  }
});

test('Landmarks fit the canvas with marker headroom and never overlap each other', () => {
  // Artwork extents measured from the SVG groups: 130 wide, ~106 above / 62 below.
  const HALF_WIDTH = 65;
  const ART_TOP = 106;
  const ART_BOTTOM = 62;

  for (const landmark of WORLD_MAP_LANDMARKS) {
    const { x, y } = landmark.coord;
    assert.ok(x - HALF_WIDTH >= MAP_CANVAS.edgePadding / 2 && x + HALF_WIDTH <= MAP_CANVAS.width - MAP_CANVAS.edgePadding / 2,
      `${landmark.id} sits inside the canvas horizontally`);
    assert.ok(y - MAP_CANVAS.markerHeadroom >= 0,
      `${landmark.id} leaves headroom for the "you are here" marker`);
    assert.ok(y + ART_BOTTOM <= MAP_CANVAS.height,
      `${landmark.id} sits inside the canvas vertically`);
  }

  // The doll marker floats above a landmark, so a realm must not sit under the
  // marker column of another realm — that was the old cramped-layout bug.
  for (let i = 0; i < WORLD_MAP_LANDMARKS.length; i++) {
    for (let j = i + 1; j < WORLD_MAP_LANDMARKS.length; j++) {
      const a = WORLD_MAP_LANDMARKS[i];
      const b = WORLD_MAP_LANDMARKS[j];
      const xOverlap = Math.abs(a.coord.x - b.coord.x) < HALF_WIDTH * 2;
      if (!xOverlap) continue;

      const upper = a.coord.y <= b.coord.y ? a : b;
      const lower = a.coord.y <= b.coord.y ? b : a;
      assert.ok(lower.coord.y - MAP_CANVAS.markerHeadroom >= upper.coord.y + ART_BOTTOM,
        `${lower.id} marker must not collide with ${upper.id}`);
      assert.ok(upper.coord.y - ART_TOP >= 0, `${upper.id} artwork stays on the canvas`);
    }
  }
});

test('Camera helpers clamp panning and centre landmarks inside the window', () => {
  assert.equal(clampCameraX(-500, 1200), 0);
  assert.equal(clampCameraX(99999, 1200), MAP_CANVAS.width - 1200);
  assert.equal(clampCameraX(NaN, 1200), 0);
  // A window wider than the canvas cannot pan at all.
  assert.equal(clampCameraX(400, MAP_CANVAS.width * 2), 0);

  const first = WORLD_MAP_LANDMARKS[0];
  const last = WORLD_MAP_LANDMARKS[WORLD_MAP_LANDMARKS.length - 1];
  assert.equal(cameraXForLandmark(first, 1200), 0, 'left-most realm pins the camera to the start');
  assert.equal(cameraXForLandmark(last, 1200), MAP_CANVAS.width - 1200, 'right-most realm pins to the end');

  const middle = getLandmarkById('forest');
  assert.equal(cameraXForLandmark(middle, 1200), middle.coord.x - 600);

  assert.equal(landmarkMapRatio({ coord: { x: 0 } }), 0);
  assert.equal(landmarkMapRatio({ coord: { x: MAP_CANVAS.width } }), 1);
  assert.equal(landmarkMapRatio({}), 0);
});

// ===========================================================================
// SVG transform contract
// ===========================================================================

test('No SVG element carries both a transform attribute and a CSS-driven transform', () => {
  // Regression guard. CSS `transform` REPLACES the SVG transform presentation
  // attribute instead of composing with it, so an element that is positioned by
  // the attribute and animated/lifted by CSS snaps to the map origin. That bug
  // teleported all 11 landmarks and every animated sprite.
  const { svg } = readMapSvg();
  const css = readFileSync(new URL('../css/features/world-map.css', import.meta.url), 'utf8');

  const cssTransformClasses = new Set();
  for (const match of css.matchAll(/\.([a-zA-Z0-9_-]+)[^{}]*\{([^}]*)\}/g)) {
    if (/(^|[;\s])transform\s*:/.test(match[2]) || /(^|[;\s])animation\s*:/.test(match[2])) {
      cssTransformClasses.add(match[1]);
    }
  }
  assert.ok(cssTransformClasses.size > 0, 'stylesheet declares CSS transforms');

  const offenders = [];
  for (const tag of svg.matchAll(/<(\w+)([^>]*)>/g)) {
    const attrs = tag[2];
    const cls = attrs.match(/class="([^"]+)"/);
    if (!cls || !/\stransform="/.test(attrs)) continue;
    for (const name of cls[1].split(/\s+/)) {
      if (cssTransformClasses.has(name)) {
        offenders.push(`<${tag[1]} class="${cls[1]}">`);
      }
    }
  }

  assert.deepEqual(offenders, [],
    'position with a wrapper anchor and animate the inner element instead');
});

test('Reduced-motion styles never reset the transform of a positioning anchor', () => {
  const css = readFileSync(new URL('../css/features/world-map.css', import.meta.url), 'utf8');
  const at = css.indexOf('@media (prefers-reduced-motion: reduce)');
  assert.ok(at > -1, 'stylesheet honours prefers-reduced-motion');

  let depth = 0;
  let end = css.indexOf('{', at);
  const bodyStart = end + 1;
  for (; end < css.length; end++) {
    if (css[end] === '{') depth++;
    else if (css[end] === '}' && --depth === 0) break;
  }
  const block = css.slice(bodyStart, end).replace(/\/\*[\s\S]*?\*\//g, '');

  for (const rule of block.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (!/(^|[;\s])transform\s*:/.test(rule[2])) continue;
    for (const anchor of ['map-landmark-anchor', 'sprite-anchor', 'active-doll-marker-anchor']) {
      assert.ok(!rule[1].includes(anchor),
        `.${anchor} positions the map via its transform attribute; resetting it collapses every realm onto the origin`);
    }
  }
});

// ===========================================================================
// Accessibility & localisation of the map chrome
// ===========================================================================

test('Map SVG is a group, not an image, so its landmark buttons stay in the a11y tree', () => {
  const { svg } = readMapSvg();
  const root = svg.slice(0, svg.indexOf('>') + 1);

  assert.doesNotMatch(root, /role="img"/,
    'role="img" is children-presentational, which hides the 22 landmark and easter-egg buttons');
  assert.match(root, /role="group"/);
  assert.match(root, /data-i18n-aria-label="worldMap\.svgAria"/);
});

test('Every world map landmark region is localised rather than hard-coded Turkish', () => {
  const { html } = readMapSvg();

  for (const [selector, key] of [
    ['id="world-map-preview-dock"', 'worldMap.dockAria'],
    ['class="world-map-passport-bar"', 'worldMap.passportAria'],
    ['id="world-map-camera"', 'worldMap.cameraAria'],
    ['id="world-map-minimap"', 'worldMap.minimapAria'],
    ['id="world-map-pan-left"', 'worldMap.panLeftAria'],
    ['id="world-map-pan-right"', 'worldMap.panRightAria']
  ]) {
    const tag = html.match(new RegExp(`<[a-z]+[^>]*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*>`))[0];
    assert.match(tag, new RegExp(`data-i18n-aria-label="${key.replace('.', '\\.')}"`),
      `${selector} must localise its aria-label`);
  }
});

test('Locked realms are rendered as locked and cannot be travelled to', () => {
  const viewJs = readFileSync(new URL('../js/features/world-map/world-map-view.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../css/features/world-map.css', import.meta.url), 'utf8');

  // The lock state reaches the SVG, not just the preview dock.
  assert.match(viewJs, /classList\.toggle\('is-locked', !unlocked\)/);
  assert.match(viewJs, /aria-disabled/);
  assert.match(css, /\.map-landmark\.is-locked/);

  // travelToLandmark refuses locked realms even if a caller bypasses the dock.
  const travel = viewJs.slice(viewJs.indexOf('function travelToLandmark'));
  assert.match(travel.slice(0, 600), /if \(!isLandmarkUnlocked\(landmark, getSettings\(\)\)\) return;/);
});

test('The map SVG is embedded once — no duplicate copy ships or is precached', async () => {
  const fs = await import('node:fs');
  assert.equal(fs.existsSync('assets/ui/world-map.svg'), false,
    'the standalone copy was a byte-identical duplicate of the inline SVG');

  const sw = fs.readFileSync('sw.js', 'utf-8');
  assert.doesNotMatch(sw, /assets\/ui\/world-map\.svg/);
});
