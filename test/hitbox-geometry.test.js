import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ASSETS, getAsset } from '../js/core/asset-catalog.js';
import { FAMILY_ASSETS } from '../js/packs/family-home/catalog.js';
import { ALPHA_THRESHOLD, computeAlphaBounds, createAlphaMask, maskAlphaAt, maskHit } from '../js/core/alpha-mask.js';
import { computeNonTransparentBounds } from '../js/features/paint/paint-raster.js';
import { createPaintSaveService } from '../js/features/paint/paint-save-service.js';
import { PointerController } from '../js/core/pointer-controller.js';
import { measureCharacterContacts } from '../js/core/character-measurement.js';
import { isStageArtworkEvent } from '../js/features/play/stage-pointer-controller.js';
import {
  CHARACTER_ARTWORK_SCALE,
  characterArtworkTransform,
  getCharacterContact,
  getCharacterStageBounds,
  recordCustomArtworkBottom,
  forgetCustomArtworkBottom
} from '../js/domain/character-geometry.js';
import { getEntityBounds } from '../js/domain/scene-rules.js';
import {
  characterAuthoringPoint,
  characterMasksHit,
  createStageHitTester,
  entityLocalPoint,
  inverseOriginTransform,
  meetBoxToUser,
  orderCandidates,
  selectionMarkerPoint
} from '../js/features/play/stage-hit-testing.js';
import { t } from '../js/core/i18n.js';
import { createDefaultFace } from '../js/domain/outfit-rules.js';
import { characterMaskKey, HIT_TOLERANCE_CSS_PX } from '../js/features/play/stage-hit-testing.js';

const close = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} ≉ ${expected}`);

/** RGBA pixels whose alpha comes from `alphaAt(x, y)`. */
function pixels(width, height, alphaAt) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data[(y * width + x) * 4 + 3] = alphaAt(x, y);
  }
  return { width, height, data };
}

// ---------------------------------------------------------------------------
// Alpha threshold

test('threshold-15 bounds are inclusive and ignore pixels at alpha 0 and 14', () => {
  const image = pixels(10, 10, (x, y) => {
    if (x === 0 && y === 0) return 14; // below threshold
    if (x === 9 && y === 9) return 0;
    if (x === 2 && y === 3) return 15; // exactly at threshold
    if (x === 6 && y === 7) return 255;
    return 0;
  });
  assert.equal(ALPHA_THRESHOLD, 15);
  assert.deepEqual(computeAlphaBounds(image), { empty: false, x: 2, y: 3, width: 5, height: 5, aspectRatio: 1 });
  // Paint Studio crops through the same threshold.
  assert.deepEqual(computeNonTransparentBounds(image), computeAlphaBounds(image));
  assert.equal(computeAlphaBounds(pixels(4, 4, () => 14)).empty, true);
});

test('alpha masks sample user-space points and reject coordinates outside the artwork', () => {
  const mask = createAlphaMask(pixels(4, 2, (x) => (x < 2 ? 255 : 10)), { x: 100, y: 50, width: 40, height: 20 });
  assert.equal(maskAlphaAt(mask, 105, 55), 255);
  assert.equal(maskHit(mask, 105, 55), true);
  assert.equal(maskHit(mask, 135, 55), false, 'alpha 10 is below the threshold');
  assert.equal(maskHit(mask, 99, 55), false);
  assert.equal(maskHit(mask, 141, 55), false);
  assert.equal(createAlphaMask(pixels(2, 2, () => 14), { x: 0, y: 0, width: 2, height: 2 }).empty, true);
});

test('selection markers use painted extents within padded and letterboxed artwork', () => {
  const mask = createAlphaMask(pixels(100, 100, (x, y) => x >= 10 && x < 25 && y >= 40 && y < 60 ? 255 : 0), { x: 100, y: 200, width: 100, height: 100 });
  assert.deepEqual(mask.bounds, { x: 110, y: 240, width: 15, height: 20 });
  const wide = selectionMarkerPoint({ mode: 'mask', mask }, { width: 200, height: 100 });
  close(wide.x, .3375); close(wide.y, .4);
  const tall = selectionMarkerPoint({ mode: 'mask', mask }, { width: 100, height: 200 });
  close(tall.x, .175); close(tall.y, .45);
});

test('layered doll markers combine cached channel extents in the original canvas', () => {
  const body = createAlphaMask(pixels(300, 450, (x, y) => x >= 100 && x < 200 && y >= 100 && y < 400 ? 255 : 0), { x: 0, y: 0, width: 300, height: 450 });
  const head = createAlphaMask(pixels(300, 450, (x, y) => x >= 90 && x < 210 && y >= 30 && y < 110 ? 255 : 0), { x: 0, y: 0, width: 300, height: 450 });
  const empty = createAlphaMask(pixels(1, 1, () => 0), { x: 0, y: 0, width: 300, height: 450 });
  assert.deepEqual(selectionMarkerPoint({ mode: 'character', masks: { body, head, eyes: empty } }, {}), { x: .5, y: 30 / 450 });
  assert.deepEqual(selectionMarkerPoint({ mode: 'character', masks: { body: empty } }, {}), { x: .5, y: 0 });
});

test('all built-in doll markers stay over the body with asymmetric hair or clothing', () => {
  for (const doll of ASSETS.filter(asset => asset.kind === 'doll')) {
    for (const head of [
      { bounds: { x: 115, y: 24, width: 110, height: 130 } },
      { bounds: { x: 75, y: 12, width: 110, height: 130 } }
    ]) {
      const descriptor = { mode: 'character', bodyCenterX: doll.footContact.x,
        masks: { body: { bounds: { x: 90, y: 110, width: 120, height: 300 } }, head } };
      assert.deepEqual(selectionMarkerPoint(descriptor, {}), { x: .5, y: head.bounds.y / 450 }, doll.id);
      // Custom artwork without an authored body center retains silhouette centering.
      const custom = selectionMarkerPoint({ ...descriptor, bodyCenterX: undefined }, {});
      assert.notEqual(custom.x, .5);
      assert.equal(custom.y, head.bounds.y / 450);
    }
  }
});

test('saving a prop with no qualifying pixel is rejected and keeps the draft editable', async () => {
  const alerts = [];
  let saved = false;
  let cleared = false;
  const ctx = { getImageData: () => pixels(8, 8, (x) => (x === 4 ? 14 : 0)) };
  const service = createPaintSaveService({
    rootElement: { querySelector: () => null },
    store: { dispatch: () => ({ ok: true }) },
    getSession: () => ({
      getState: () => ({ name: 'Faint', itemType: 'prop', propSize: 'medium', propPlacement: 'surface', originContext: 'paint' }),
      setName: () => {},
      markDirty: () => {},
      logicalWidth: 4,
      logicalHeight: 4
    }),
    getCanvasState: () => ({ canvas: { width: 8, height: 8, getContext: () => ctx }, ctx }),
    customArtRepo: {
      computeSha256: async () => 'sha',
      saveArtwork: async () => { saved = true; return { ok: true }; },
      clearDraft: async () => { cleared = true; }
    },
    showAlert: async (message) => { alerts.push(message); },
    announceStatus: () => {}
  });
  await service.commitSave(false);
  assert.deepEqual(alerts, [t('paint.emptyArtwork')]);
  assert.equal(saved, false);
  assert.equal(cleared, false);
});

// ---------------------------------------------------------------------------
// Character contact and envelope

test('every doll and footwear asset carries measured contact metadata', () => {
  for (const doll of ASSETS.filter(asset => asset.kind === 'doll')) {
    assert.ok(doll.footContact, `${doll.id} needs footContact`);
    assert.equal(doll.footContact.x, 150);
    assert.ok(doll.footContact.y > 350 && doll.footContact.y <= 450, doll.id);
  }
  for (const shoe of [...ASSETS, ...FAMILY_ASSETS].filter(asset => asset.slot === 'shoes')) {
    assert.ok(Number.isFinite(shoe.soleContactY), `${shoe.id} needs soleContactY`);
    assert.ok(shoe.soleContactY > 350 && shoe.soleContactY <= 450, shoe.id);
  }
});

test('neutral contact is the lowest support edge of the doll feet or its shoes', () => {
  const classic = { baseDollId: 'doll_classic_a', slots: {} };
  assert.deepEqual(getCharacterContact(classic, getAsset), { x: 150, y: 410, source: 'authored' });
  const oxfords = { baseDollId: 'doll_classic_a', slots: { shoes: { assetId: 'shoes_oxfords_classic' } } };
  assert.equal(getCharacterContact(oxfords, getAsset).y, 419);
  const baby = { baseDollId: 'doll_baby_a', slots: { shoes: { assetId: 'shoes_booties_baby' } } };
  assert.equal(getCharacterContact(baby, getAsset).y, 370);
  // Clothing never defines contact, only feet and footwear.
  const gown = { baseDollId: 'doll_classic_a', slots: { dress: { assetId: 'dress_ballgown' } } };
  assert.equal(getCharacterContact(gown, getAsset).y, 410);
});

test('custom full dolls use their measured bottom edge, or the canvas bottom until measured', () => {
  const snapshot = { kind: 'custom_full', baseDollId: 'custom_doll_fixture', slots: {} };
  try {
    assert.deepEqual(getCharacterContact(snapshot, getAsset), { x: 150, y: 450, source: 'unavailable' });
    recordCustomArtworkBottom('custom_doll_fixture', 402);
    assert.deepEqual(getCharacterContact(snapshot, getAsset), { x: 150, y: 402, source: 'measured' });
    recordCustomArtworkBottom('custom_doll_fixture', null);
    assert.equal(getCharacterContact(snapshot, getAsset).source, 'unavailable');
  } finally {
    forgetCustomArtworkBottom('custom_doll_fixture');
  }
});

test('shared custom contact measurement prepares geometry once before any view opens', async () => {
  const fullId = 'custom_shared_contact';
  const shoeId = 'custom_shared_shoes';
  const snapshot = { baseDollId: fullId, slots: { shoes: { assetId: shoeId } } };
  let decoded = 0;
  const options = {
    customArtRepo: { getTrackedObjectUrl: async id => id },
    rasterizeImage: async id => {
      decoded += 1;
      return pixels(300, 450, (_x, y) => y === (id === fullId ? 399 : 419) ? 255 : 0);
    }
  };
  try {
    await Promise.all([measureCharacterContacts(snapshot, options), measureCharacterContacts(snapshot, options)]);
    assert.equal(getCharacterContact(snapshot, getAsset).y, 400);
    assert.equal(getCharacterContact({ baseDollId: 'doll_classic_a', slots: snapshot.slots }, getAsset).y, 420);
    await measureCharacterContacts(snapshot, options);
    assert.equal(decoded, 2, 'concurrent and later renderers reuse measured contacts');
  } finally {
    forgetCustomArtworkBottom(fullId);
    forgetCustomArtworkBottom(shoeId);
  }
});

test('the envelope ends at the contact while the artwork keeps its uniform 235/300 scale', () => {
  const snapshot = { baseDollId: 'doll_classic_a', slots: { shoes: { assetId: 'shoes_sneakers' } } };
  const bounds = getCharacterStageBounds(snapshot, 1, getAsset);
  close(CHARACTER_ARTWORK_SCALE, 235 / 300);
  close(bounds.width, 235);
  close(bounds.height, 413 * 235 / 300);
  assert.equal(bounds.anchorX, 0.5);
  assert.equal(bounds.anchorY, 1);
  // Stage bounds come from the same shared calculation.
  const entity = { instanceId: 'doll-1', kind: 'character', characterSnapshot: snapshot, x: 800, y: 750, scale: 1.5 };
  const entityBounds = getEntityBounds(entity, getAsset);
  close(entityBounds.width, 235 * 1.5);
  close(entityBounds.height, 413 * 235 / 300 * 1.5);
  // Changing footwear invalidates the cached envelope.
  const changed = { ...entity, characterSnapshot: { ...snapshot, slots: { shoes: { assetId: 'shoes_oxfords_classic' } } } };
  close(getEntityBounds(changed, getAsset).height, 419 * 235 / 300 * 1.5);
});

test('the shared artwork transform puts the neutral contact on the entity origin', () => {
  const contact = { x: 150, y: 413 };
  const transform = characterArtworkTransform(contact);
  assert.equal(transform, `scale(${235 / 300}, ${235 / 300}) translate(-150, -413)`);
  // Root motion composes around the contact rather than the canvas corner.
  assert.equal(characterArtworkTransform(contact, { x: 4, y: -10, rotate: 5, scaleX: 1, scaleY: 0.9 }),
    `translate(4, -10) rotate(5) scale(${235 / 300}, ${235 / 300 * 0.9}) translate(-150, -413)`);
});

test('a neutral doll at y 750 meets the plane and motion pivots on the contact', () => {
  for (const doll of ASSETS.filter(asset => asset.kind === 'doll')) {
    const snapshot = { baseDollId: doll.id, slots: {} };
    const bounds = getEntityBounds({ instanceId: `ground-${doll.id}`, kind: 'character', characterSnapshot: snapshot, x: 800, y: 750, scale: 1 }, getAsset);
    // Envelope bottom == y; the contact row of the canvas maps onto it.
    const envelopeBottom = 750 + bounds.height * (1 - bounds.anchorY);
    const contactStageY = 750 - bounds.height + doll.footContact.y * CHARACTER_ARTWORK_SCALE;
    close(envelopeBottom, 750);
    close(contactStageY, 750, 1e-9);
  }
  const css = readFileSync(new URL('../css/features/play.css', import.meta.url), 'utf8');
  assert.match(css, /transform-origin:\s*var\(--contact-x-pct, 50%\) var\(--contact-y-pct, 100%\)/);
});

// ---------------------------------------------------------------------------
// Catalog normalization

test('core props use trimmed viewBoxes with uniform display scale and in-range placement geometry', () => {
  for (const prop of ASSETS.filter(asset => asset.kind === 'prop')) {
    const [, , vw, vh] = prop.viewBox;
    assert.ok(vw < 1000 || vh < 1000, `${prop.id} keeps transparent padding`);
    close(prop.displayWidth / prop.displayHeight, vw / vh, 0.01);
    const svg = readFileSync(new URL(`../${prop.path}`, import.meta.url), 'utf8');
    assert.match(svg, new RegExp(`viewBox="${prop.viewBox.join(' ')}"`), prop.id);
    for (const surface of prop.supportSurfaces || []) {
      for (const [u, v] of surface.polygon) {
        assert.ok(u >= 0 && u <= 1 && v >= 0 && v <= 1, `${prop.id}/${surface.id} stays inside its artwork`);
      }
    }
    assert.ok(prop.groundAnchor.x >= 0 && prop.groundAnchor.x <= 1 && prop.groundAnchor.y >= 0 && prop.groundAnchor.y <= 1);
  }
  // Floor props without authored contact use bottom-center; the wall frame keeps its anchor.
  assert.deepEqual(getAsset('prop_chair').groundAnchor, { x: 0.5, y: 1 });
  close(getAsset('prop_painting').groundAnchor.y, 406 / 737);
});

test('cropping preserves the visible artwork scale of every core prop', () => {
  const previous = {
    prop_chair: [240, 270], prop_table: [250, 230], prop_lamp: [160, 360], prop_rug: [380, 140], prop_painting: [220, 180]
  };
  for (const [id, [width, height]] of Object.entries(previous)) {
    const prop = getAsset(id);
    // Display units per artwork unit before (meet-fit into the old box) and after.
    const before = Math.min(width, height) / 1000;
    const after = prop.displayWidth / prop.viewBox[2];
    close(after, before, 1e-6);
  }
});

test('pack prop crops match their SVGs and preserve valid authored placement geometry', () => {
  for (const prop of FAMILY_ASSETS.filter(asset => asset.kind === 'prop')) {
    const [, , width, height] = prop.viewBox;
    assert.ok(width < 1000 && height < 1000, prop.id);
    close(prop.displayWidth / width, prop.displayHeight / height);
    const svg = readFileSync(new URL(`../${prop.path}`, import.meta.url), 'utf8');
    assert.ok(svg.includes(`viewBox="${prop.viewBox.join(' ')}"`), prop.id);
    assert.ok(prop.groundAnchor.x >= 0 && prop.groundAnchor.x <= 1, prop.id);
    assert.ok(prop.groundAnchor.y >= 0 && prop.groundAnchor.y <= 1, prop.id);
    for (const surface of prop.supportSurfaces || []) {
      for (const [u, v] of surface.polygon) assert.ok(u >= 0 && u <= 1 && v >= 0 && v <= 1, prop.id);
    }
    if (prop.placementRules) {
      const footprint = prop.placementRules.contactFootprint;
      assert.ok(footprint.width > 0 && footprint.width <= 1, prop.id);
      assert.ok(footprint.depth > 0 && footprint.depth <= 1, prop.id);
    } else {
      assert.deepEqual(prop.groundAnchor, { x: .5, y: 1 }, prop.id);
    }
  }
  // Narrow furniture and props keep the same artwork scale and authored contact,
  // rather than stretching their drawings to fill their old display boxes.
  for (const [id, scale, originalY, originalFootprint] of [
    ['fh_storage', .33, .88, .55], ['fh_high_chair', .22, .92, .55], ['fh_bottle', .05, .9, .25]
  ]) {
    const prop = FAMILY_ASSETS.find(asset => asset.id === id);
    const [x, y, width, height] = prop.viewBox;
    close(prop.displayWidth / width, scale);
    close(x + prop.groundAnchor.x * width, 500);
    close(y + prop.groundAnchor.y * height, originalY * 1000);
    close(prop.placementRules.contactFootprint.width * width, originalFootprint * 1000);
    close(prop.placementRules.contactFootprint.depth * height, 20);
  }
  const cabinet = FAMILY_ASSETS.find(asset => asset.id === 'fh_storage');
  const [x, y, width, height] = cabinet.viewBox;
  const [u, v] = cabinet.supportSurfaces[0].polygon[0];
  close(x + u * width, 170);
  close(y + v * height, 205);
});

// ---------------------------------------------------------------------------
// Hit testing geometry

test('inverse transforms undo translate, rotate, flip, and scale around an origin', () => {
  const origin = { x: 10, y: 20 };
  // Forward: rotate (1, 0) relative to the origin by 90° (clockwise on screen), then translate.
  const inverse = inverseOriginTransform({ x: 10 + 5, y: 20 + 1 + 7 }, { origin, tx: 5, ty: 7, rotate: 90 });
  close(inverse.x, 11);
  close(inverse.y, 20);
  const flipped = inverseOriginTransform({ x: 7, y: 0 }, { origin: { x: 10, y: 0 }, scaleX: -1 });
  close(flipped.x, 13);
  assert.equal(inverseOriginTransform({ x: 1, y: 1 }, { scaleX: 0 }), null);
});

test('entity-local points account for anchors, flipping, and attachment motion', () => {
  const geometry = { x: 500, y: 700, width: 200, height: 100, anchorX: 0.25, anchorY: 1, flip: 1 };
  assert.deepEqual(entityLocalPoint({ x: 450, y: 600 }, geometry), { x: 0, y: 0 });
  // A flipped visual mirrors around the anchor while the positioner stays put.
  const flipped = entityLocalPoint({ x: 540, y: 650 }, { ...geometry, flip: -1 });
  close(flipped.x, 10);
  close(flipped.y, 50);
  // Attachment motion shifts the drawn artwork, so the same box column moves right.
  const attached = entityLocalPoint({ x: 490, y: 650 }, { ...geometry, attachedTx: 20 });
  close(attached.x, 20);
  // A 90° clockwise turn about the anchor carries the box's bottom-left corner above it.
  const turned = entityLocalPoint({ x: 500, y: 650 }, { ...geometry, attachedRot: 90 });
  close(turned.x, 0);
  close(turned.y, 100);
});

test('meet mapping matches preserveAspectRatio and object-fit contain letterboxing', () => {
  const rect = { x: 100, y: 0, width: 200, height: 100 };
  // A 100×100 box shows a 200×100 viewBox at half scale, centered vertically.
  assert.deepEqual(meetBoxToUser({ x: 0, y: 25 }, 100, 100, rect), { x: 100, y: 0 });
  assert.deepEqual(meetBoxToUser({ x: 100, y: 75 }, 100, 100, rect), { x: 300, y: 100 });
});

test('character points follow root motion pivoting on the contact', () => {
  const contact = { x: 150, y: 400 };
  const width = 235;
  // Unposed: the contact row in the box maps back to the authoring contact.
  const neutral = characterAuthoringPoint({ x: 117.5, y: 400 * 235 / 300 }, width, contact);
  close(neutral.x, 150);
  close(neutral.y, 400);
  // A jump lifts the whole doll: the lifted feet are hit, the vacated plane is not.
  const lifted = characterAuthoringPoint({ x: 117.5, y: 400 * 235 / 300 - 30 }, width, contact, { y: -30 });
  close(lifted.y, 400);
});

test('animated limbs are hit where they are drawn, not at their rest pose', () => {
  const rect = { x: 0, y: 0, width: 300, height: 450 };
  const body = createAlphaMask(pixels(300, 450, (x, y) => (x >= 130 && x < 170 && y >= 100 && y < 400 ? 255 : 0)), rect);
  // Rest arm hangs from the shoulder at (170, 120) down to y 220.
  const armRight = createAlphaMask(pixels(300, 450, (x, y) => (x >= 170 && x < 180 && y >= 120 && y < 220 ? 255 : 0)), rect);
  const masks = { body, armRight };
  const pivots = { armRight: { x: 175, y: 120 } };
  const rest = { x: 175, y: 200 };
  assert.equal(characterMasksHit(masks, rest, pivots), true);
  // Raise the arm -90° (counter-clockwise): it now points right of the shoulder.
  const raised = { armRight: { rotate: -90 } };
  assert.equal(characterMasksHit(masks, rest, pivots, raised), false);
  assert.equal(characterMasksHit(masks, { x: 255, y: 122 }, pivots, raised), true);
  assert.equal(characterMasksHit(masks, { x: 150, y: 200 }, pivots, raised), true, 'body stays hittable');
});

test('faint character channels are thresholded after alpha compositing', () => {
  const rect = { x: 0, y: 0, width: 1, height: 1 };
  const faint = createAlphaMask(pixels(1, 1, () => 10), rect);
  const point = { x: .5, y: .5 };
  assert.equal(characterMasksHit({ body: faint }, point, {}), false);
  assert.equal(characterMasksHit({ body: faint, head: faint }, point, { head: { x: 0, y: 0 } }), true);
});

test('eye masks follow the live blink scale around the head pivot', () => {
  const rect = { x: 0, y: 0, width: 300, height: 450 };
  const eyes = createAlphaMask(pixels(300, 450, (x, y) => x >= 140 && x < 160 && y >= 60 && y < 70 ? 255 : 0), rect);
  const point = { x: 150, y: 65 };
  const pivots = { eyes: { x: 150, y: 90 } };
  assert.equal(characterMasksHit({ eyes }, point, pivots), true);
  assert.equal(characterMasksHit({ eyes }, point, pivots, { eyes: { scaleY: .1 } }), false);
  assert.equal(characterMasksHit({ eyes }, { x: 150, y: 87.5 }, pivots, { eyes: { scaleY: .1 } }), true);
});

test('candidates are ordered front to back by z-index then DOM order, dragged first', () => {
  const el = (id, z, dragging = false) => ({ id, style: { zIndex: String(z) }, classList: { contains: (name) => dragging && name === 'is-dragging' } });
  const order = orderCandidates([el('a', 1), el('b', 3), el('c', 3), el('d', 2, true)]).map(item => item.id);
  assert.deepEqual(order, ['d', 'c', 'b', 'a']);
});

// ---------------------------------------------------------------------------
// Resolver integration with prepared masks

function fakePositioner(id, vars, z, flip = 1) {
  const visual = { style: { getPropertyValue: (name) => (name === '--flip' ? String(flip) : '') } };
  return {
    dataset: { instanceId: id },
    style: { zIndex: String(z), getPropertyValue: (name) => (name in vars ? String(vars[name]) : '') },
    classList: { contains: () => false },
    querySelector: (selector) => (selector === '.scene-entity-visual' ? visual : null)
  };
}

test('selection falls through transparent artwork across three overlapping props', async () => {
  // Three 100×100 props share one box; their artwork occupies different columns.
  const columns = { prop_front: [0, 20], prop_middle: [40, 60], prop_back: [0, 100] };
  const assets = Object.fromEntries(Object.keys(columns).map(id => [id, { id, kind: 'prop', viewBox: [0, 0, 100, 100], displayWidth: 100, displayHeight: 100 }]));
  const hitTester = createStageHitTester({
    getAsset: (id) => assets[id],
    loadSvg: async (id) => ({ id }),
    rasterize: async (sources, rect, width, height) => {
      const [from, to] = columns[sources[0].svg.id];
      return pixels(Math.round(width), Math.round(height), (x) => (x / width * 100 >= from && x / width * 100 < to ? 255 : 0));
    }
  });
  const vars = { '--x': 850, '--y': 500, '--entity-width': 100, '--entity-height': 100, '--anchor-x': 0.5, '--anchor-y': 1 };
  const back = fakePositioner('back', vars, 1);
  const middle = fakePositioner('middle', vars, 2);
  const front = fakePositioner('front', vars, 3);
  const unprepared = fakePositioner('pending', vars, 4);
  await hitTester.prepare({ kind: 'prop', sourceId: 'prop_back' }, back);
  await hitTester.prepare({ kind: 'prop', sourceId: 'prop_middle' }, middle);
  await hitTester.prepare({ kind: 'prop', sourceId: 'prop_front' }, front);
  const elements = [back, middle, front, unprepared];
  // The stage maps 1 client px to 1 logical unit.
  const stageEl = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 900 }), querySelectorAll: () => elements };
  const at = (x, y) => hitTester.resolve(stageEl, x, y)?.dataset.instanceId ?? null;
  assert.equal(at(810, 450), 'front');
  assert.equal(at(850, 450), 'middle', 'passes through the front prop');
  assert.equal(at(890, 450), 'back', 'passes through two transparent props');
  assert.equal(at(950, 450), null, 'outside every artwork');
  assert.equal(hitTester.size, 3, 'masks are cached per artwork');

  // Flipping mirrors the hit region around the anchor.
  const flippedFront = fakePositioner('flipped', vars, 5, -1);
  await hitTester.prepare({ kind: 'prop', sourceId: 'prop_front' }, flippedFront);
  elements.push(flippedFront);
  assert.equal(at(890, 450), 'flipped');
  assert.equal(hitTester.size, 3, 'the same artwork reuses its mask');
  assert.equal(at(810, 450), 'front');

  hitTester.retain([{ kind: 'prop', sourceId: 'prop_back' }]);
  assert.equal(hitTester.size, 1, 'unused masks are released');
  assert.equal(at(810, 450), 'front', 'live elements keep their prepared masks');
});

test('missing artwork uses its visible placeholder box as the hit target', async () => {
  const hitTester = createStageHitTester({ getAsset: () => undefined });
  const element = fakePositioner('missing', { '--x': 100, '--y': 200, '--entity-width': 50, '--entity-height': 50 }, 1);
  const descriptor = await hitTester.prepare({ kind: 'prop', sourceId: 'prop_unknown' }, element);
  assert.equal(descriptor.mode, 'box');
  assert.equal(hitTester.hitTest(element, { x: 80, y: 160 }), true);
  assert.equal(hitTester.hitTest(element, { x: 130, y: 160 }), false);
});

test('edge tolerance stays in CSS pixels at different stage sizes without filling holes or corners', async () => {
  const asset = { id: 'ring', kind: 'prop', viewBox: [0, 0, 100, 100], displayWidth: 100, displayHeight: 100 };
  let builds = 0;
  const tester = createStageHitTester({
    getAsset: () => asset, loadSvg: async () => ({}),
    rasterize: async (_sources, _rect, width, height) => {
      builds += 1;
      return pixels(width, height, (x, y) => Math.abs(Math.hypot(x / 2 - 50, y / 2 - 50) - 30) < 1 ? 255 : 0);
    }
  });
  const element = fakePositioner('ring', { '--x': 800, '--y': 500, '--entity-width': 100, '--entity-height': 100 }, 1);
  await tester.prepare({ kind: 'prop', sourceId: 'ring' }, element);
  assert.equal(HIT_TOLERANCE_CSS_PX, 2.5);
  for (const zoom of [.25, .5, 1, 2]) {
    const stage = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600 * zoom, height: 900 * zoom }), querySelectorAll: () => [element] };
    assert.equal(tester.resolve(stage, 830 * zoom + 2, 450 * zoom), element, 'two CSS pixels from a thin edge');
    assert.equal(tester.resolve(stage, 830 * zoom + 5, 450 * zoom), null, 'five CSS pixels away stays transparent');
    assert.equal(tester.resolve(stage, 800 * zoom, 450 * zoom), null, 'hollow center stays transparent');
    assert.equal(tester.resolve(stage, 751 * zoom, 401 * zoom), null, 'empty corner stays transparent');
  }
  assert.equal(builds, 1, 'resolution never rasterizes or decodes again');
});

test('raster revisions invalidate masks and concurrent prepares share one decode', async () => {
  let revision = 'first';
  let decodes = 0;
  const tester = createStageHitTester({
    getAsset: () => ({ sha256: revision }),
    customArtRepo: { getTrackedObjectUrl: async () => 'blob:custom' },
    rasterizeImage: async () => { decodes += 1; return pixels(10, 10, x => x < (revision === 'first' ? 3 : 7) ? 255 : 0); }
  });
  const entity = { kind: 'prop', sourceId: 'custom_prop_hit' };
  const element = fakePositioner('custom', { '--x': 100, '--y': 100, '--entity-width': 10, '--entity-height': 10 }, 1);
  await Promise.all([tester.prepare(entity, element), tester.prepare(entity, element)]);
  assert.equal(decodes, 1);
  assert.equal(tester.hitTest(element, { x: 101, y: 95 }), false);
  revision = 'second';
  await tester.prepare(entity, element);
  assert.equal(decodes, 2);
  assert.equal(tester.hitTest(element, { x: 101, y: 95 }), true);
  tester.retain([entity]);
  assert.equal(tester.size, 1);
});

test('character mask keys include custom layer revisions and baked-face state, but reuse recolors and poses', () => {
  let revision = 'one';
  const resolve = () => ({ sha256: revision });
  const entity = { kind: 'character', expression: 'neutral', characterSnapshot: { baseDollId: 'doll_classic_a', face: createDefaultFace('doll_classic_a'), slots: { hair: { assetId: 'custom_hair_test', color: 'brown' } } } };
  const key = characterMaskKey(entity, resolve);
  entity.characterSnapshot.slots.hair.color = 'pink';
  entity.pose = 'wave';
  assert.equal(characterMaskKey(entity, resolve), key);
  entity.characterSnapshot.face.eyes.irisColor = 'blue';
  assert.notEqual(characterMaskKey(entity, resolve), key, 'iris color can replace the baked face with movable eye artwork');
  const faceKey = characterMaskKey(entity, resolve);
  revision = 'two';
  assert.notEqual(characterMaskKey(entity, resolve), faceKey);
});

test('mask failures replace the drawing with the explicit visible placeholder', async () => {
  let replacement = null;
  const originalDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ setAttribute() {} }) };
  try {
    const visual = { replaceChildren: node => { replacement = node; } };
    const element = { querySelector: selector => selector === '.scene-entity-visual' ? visual : null, getAttribute: () => 'Prop' };
    const tester = createStageHitTester({ getAsset: () => ({ id: 'prop', viewBox: [0, 0, 100, 100] }), loadSvg: async () => { throw new Error('decode failure'); } });
    assert.equal((await tester.prepare({ kind: 'prop', sourceId: 'prop' }, element)).mode, 'box');
    assert.equal(replacement.className, 'asset-placeholder');
    assert.equal(replacement.textContent, 'Prop');
    assert.equal(tester.size, 0, 'a failed build can retry');
  } finally { globalThis.document = originalDocument; }
});

// ---------------------------------------------------------------------------
// One selection authority

test('the pointer controller resolves its subject before selection and capture', () => {
  const listeners = new Map();
  const root = {
    captured: false,
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: () => {},
    setPointerCapture() { this.captured = true; },
    hasPointerCapture() { return this.captured; },
    releasePointerCapture() { this.captured = false; }
  };
  const subject = (id) => ({ id });
  const front = subject('front');
  const behind = subject('behind');
  const selected = [];
  let deselected = 0;
  let resolved = behind;
  const previousFrame = globalThis.requestAnimationFrame;
  const previousCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  try {
    const controller = new PointerController(root, {
      selector: '.entity',
      getId: (element) => element.id,
      resolveSubject: () => resolved,
      onSelect: (id) => selected.push(id),
      onDeselect: () => { deselected += 1; }
    });
    const target = { closest: () => front };
    listeners.get('pointerdown')({ target, pointerId: 1, pointerType: 'touch', button: 0, isPrimary: true, clientX: 0, clientY: 0 });
    assert.deepEqual(selected, ['behind']);
    assert.equal(root.captured, true, 'the stage owns the gesture from the press, before any drag');
    // Touch keeps its larger drag threshold.
    listeners.get('pointermove')({ pointerId: 1, clientX: 6, clientY: 0, preventDefault() {} });
    assert.equal(controller.session.dragging, false);
    listeners.get('pointermove')({ pointerId: 1, clientX: 9, clientY: 0, preventDefault() {} });
    assert.equal(controller.session.dragging, true);
    listeners.get('pointercancel')({ type: 'pointercancel', pointerId: 1, clientX: 9, clientY: 0 });
    assert.equal(root.captured, false);

    resolved = null;
    listeners.get('pointerdown')({ target: { closest: () => null }, pointerId: 2, pointerType: 'mouse', button: 0, isPrimary: true, clientX: 0, clientY: 0 });
    assert.equal(deselected, 1, 'transparent-only hits fall back to background deselection');
    controller.destroy();
  } finally {
    globalThis.requestAnimationFrame = previousFrame;
    globalThis.cancelAnimationFrame = previousCancel;
  }
});

test('stage UI controls bypass resolution and background deselection', () => {
  const listeners = new Map();
  const root = { addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener() {} };
  let resolved = 0;
  let deselected = 0;
  const controller = new PointerController(root, {
    shouldHandleEvent: event => isStageArtworkEvent(root, event),
    resolveSubject: () => { resolved += 1; return null; },
    onDeselect: () => { deselected += 1; }
  });
  const control = { classList: { contains: () => false } };
  const target = { closest: selector => selector === '#scene-world' ? {} : selector.startsWith('button') ? control : null };
  listeners.get('pointerdown')({ target, button: 0, isPrimary: true });
  assert.equal(resolved, 0);
  assert.equal(deselected, 0);
  assert.equal(controller.session, null);
  controller.destroy();
});

test('entity buttons leave pointer selection to the resolver but keep keyboard activation', () => {
  const source = readFileSync(new URL('../js/features/play/scene-entity-view.js', import.meta.url), 'utf8');
  assert.match(source, /if \(e\.detail > 0\) return;/);
  assert.doesNotMatch(source, /addEventListener\('dblclick'/);
  const stage = readFileSync(new URL('../js/features/play/stage-pointer-controller.js', import.meta.url), 'utf8');
  assert.match(stage, /resolveSubject: \(event\) => resolveEntityAt\(stageEl, event\)/);
});

// ---------------------------------------------------------------------------
// v2.0.0 storage boundary

test('pre-v2 data resets once, valid v2 projects survive repeated boots, and future versions are not wiped', async () => {
  const { loadProject, resetObsoleteProject, STORAGE_KEY } = await import('../js/services/project-repository.js');
  const { createDefaultEnvelope, APP_VERSION } = await import('../js/core/state-schema.js');
  const memory = (initial) => {
    const data = new Map(Object.entries(initial));
    return {
      data,
      get length() { return data.size; },
      key: (i) => [...data.keys()][i] ?? null,
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, String(value)),
      removeItem: (key) => data.delete(key)
    };
  };
  assert.equal(APP_VERSION, '2.0.0');
  for (const legacy of [{ schemaVersion: 8 }, { appVersion: '1.99.9' }, { title: 'unversioned' }]) {
    const storage = memory({ [STORAGE_KEY]: JSON.stringify(legacy) });
    assert.equal(loadProject(storage, getAsset).resetRequired, true, JSON.stringify(legacy));
    await resetObsoleteProject(storage, { resetAll: async () => ({ ok: true }) });
    // The fresh envelope is accepted on every later boot.
    for (let boot = 0; boot < 3; boot += 1) assert.equal(loadProject(storage, getAsset).resetRequired, undefined);
  }
  const current = { ...createDefaultEnvelope(), revision: 4 };
  const kept = memory({ [STORAGE_KEY]: JSON.stringify(current) });
  for (let boot = 0; boot < 3; boot += 1) {
    const result = loadProject(kept, getAsset);
    assert.equal(result.resetRequired, undefined);
    assert.equal(result.envelope.revision, 4);
  }
  for (const future of [{ appVersion: '3.0.0', schemaVersion: '3.0.0' }, { schemaVersion: 999 }]) {
    const storage = memory({ [STORAGE_KEY]: JSON.stringify({ ...createDefaultEnvelope(), ...future }) });
    assert.notEqual(loadProject(storage, getAsset).resetRequired, true, JSON.stringify(future));
  }
});

test('a reset interrupted after clearing artwork is safe to retry', async () => {
  const { loadProject, resetObsoleteProject, STORAGE_KEY } = await import('../js/services/project-repository.js');
  const data = new Map([[STORAGE_KEY, '{"schemaVersion":7}'], ['paperDollStudio.settings', 'old']]);
  let failRemoval = true;
  const storage = {
    get length() { return data.size; },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => {
      if (failRemoval && key === 'paperDollStudio.settings') throw new Error('storage blocked');
      data.delete(key);
    }
  };
  let artworkResets = 0;
  const repo = { resetAll: async () => { artworkResets += 1; return { ok: true }; } };
  await assert.rejects(resetObsoleteProject(storage, repo), /storage blocked/);
  assert.equal(loadProject(storage, getAsset).resetRequired, true, 'partial reset still requires a reset');
  failRemoval = false;
  await resetObsoleteProject(storage, repo);
  assert.equal(artworkResets, 2);
  assert.equal(loadProject(storage, getAsset).resetRequired, undefined);
  assert.deepEqual([...data.keys()], [STORAGE_KEY]);
});
