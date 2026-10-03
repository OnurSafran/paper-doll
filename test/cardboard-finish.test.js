import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSETS } from '../js/core/asset-catalog.js';
import { FAMILY_ASSETS } from '../js/packs/family-home/catalog.js';
import { customAssetToDescriptor } from '../js/core/asset-registry.js';
import { sanitizeCustomAsset, cloneCustomAsset } from '../js/core/state-schema.js';
import { renderDollInto } from '../js/features/designer/designer-view.js';
import { createSceneEntityView } from '../js/features/play/scene-entity-view.js';
import { characterStandStyle, forgetCustomArtworkBottom, getCharacterStandSpan, recordCustomArtworkBottom } from '../js/domain/character-geometry.js';
import { measureCharacterContacts } from '../js/core/character-measurement.js';

const all = [...ASSETS, ...FAMILY_ASSETS];

test('all official props declare a finish, with ground and hanging decorations disabled', () => {
  for (const asset of all.filter(a => a.kind === 'prop')) {
    assert.ok(['none', 'edge', 'stand'].includes(asset.cardboard), asset.id);
  }
  for (const id of ['prop_rug', 'prop_picnic_blanket', 'prop_painting', 'prop_kite', 'prop_balloons', 'fh_play_mat', 'fh_family_frame', 'fh_mobile', 'fh_slumber_banner', 'fh_bunting', 'fh_winter_wreath', 'fh_calendar', 'fh_sleeping_bag']) {
    assert.equal(all.find(a => a.id === id).cardboard, 'none', id);
  }
});

test('custom prop finish defaults safely and survives sanitizing, cloning and registry conversion', () => {
  const painting = { assetId: 'custom_prop_painting', name: 'Painting', kind: 'prop' };
  for (const cardboard of [undefined, 'edge', 'stand', 'none', 'invalid']) {
    const saved = sanitizeCustomAsset({ ...painting, cardboard });
    const expected = cardboard === 'none' || cardboard === 'stand' ? cardboard : 'edge';
    assert.equal(saved.cardboard, expected);
    assert.equal(customAssetToDescriptor(cloneCustomAsset(saved)).cardboard, expected);
  }
});

function element(tag) {
  return {
    localName: tag, dataset: {}, style: { values: {}, setProperty(name, value) { this.values[name] = value; } }, children: [],
    append(...nodes) { this.children.push(...nodes); },
    prepend(...nodes) { this.children.unshift(...nodes); },
    replaceChildren(...nodes) { this.children = nodes; },
    setAttribute() {}, addEventListener() {}, querySelector() { return null; }
  };
}

test('every doll model and custom full painting uses the same composed finish marker', async t => {
  const previous = globalThis.document;
  globalThis.document = { createElement: element, createElementNS: (_ns, tag) => element(tag) };
  t.after(() => { globalThis.document = previous; });
  for (const baseDollId of [...ASSETS.filter(a => a.kind === 'doll').map(a => a.id), 'custom_doll_painting']) {
    const container = element('span');
    await renderDollInto(container, { baseDollId, slots: {} }, {
      loadAssetSvg: async () => element('svg'),
      getCustomArtUrl: async () => 'data:image/png;base64,example'
    });
    assert.equal(container.children.find(layer => layer.dataset.slot === 'skin').dataset.cardboard, 'stand', baseDollId);
    const footY = all.find(a => a.id === baseDollId)?.footContact?.y ?? 450;
    assert.equal(container.style.values['--contact-y-pct'], `${footY / 450 * 100}%`, 'stand follows this doll’s feet');
  }
});

test('scene renderer honors prop metadata for SVGs and custom PNGs', async t => {
  const previous = globalThis.document;
  globalThis.document = { createElement: element };
  t.after(() => { globalThis.document = previous; });
  for (const sourceId of ['prop_chair', 'prop_rug', 'fh_mobile', 'fh_books', 'custom_prop_painting']) {
    const asset = all.find(a => a.id === sourceId) || customAssetToDescriptor({ assetId: sourceId, kind: 'prop' });
    const view = createSceneEntityView({
      getAsset: () => asset,
      sceneEntityRenderKey: () => sourceId,
      store: { getState: () => ({ settings: {}, currentScene: { entities: [] } }) },
      propSymbols: { create: async () => element('svg') },
      customArtRepo: { getTrackedObjectUrl: async () => 'data:image/png;base64,example' }
    });
    const node = await view.createSceneEntity({ instanceId: sourceId, sourceId, kind: 'prop', x: 500, y: 600, scale: 1, order: 1 });
    const visual = node.children.find(child => child.className === 'scene-entity-visual');
    assert.equal(visual.dataset.cardboard, asset.cardboard);
    assert.equal(visual.children[0].localName, sourceId.startsWith('custom_') ? 'img' : 'svg');
  }
});

test('unconfigured custom ground, wall and legacy hanging art are disabled; explicit modes win', () => {
  const painting = { assetId: 'custom_prop_placement', name: 'Painting', kind: 'prop' };
  const rules = { allowedTargets: ['floor'], tags: [], contactFootprint: { width: .5, depth: .02 }, renderClass: 'ground' };
  for (const metadata of [
    { groundAnchor: { x: .5, y: .5 } },
    { placementRules: rules },
    { placementRules: { ...rules, allowedTargets: ['wall'], renderClass: 'upright' } }
  ]) {
    assert.equal(customAssetToDescriptor({ ...painting, ...metadata }).cardboard, 'none');
    assert.equal(sanitizeCustomAsset({ ...painting, ...metadata }).cardboard, 'none');
    assert.equal(sanitizeCustomAsset({ ...painting, ...metadata, cardboard: 'edge' }).cardboard, 'edge');
  }
});

test('custom doll stands fit the measured base, and shipped or unmeasured dolls keep the default', async () => {
  const id = 'custom_doll_stand';
  const snapshot = { baseDollId: id, slots: {} };
  const clear = { '--stand-left-pct': '', '--stand-width-pct': '' };
  try {
    assert.equal(getCharacterStandSpan(snapshot), null, 'unmeasured');
    assert.deepEqual(characterStandStyle(snapshot), clear);
    assert.equal(getCharacterStandSpan({ baseDollId: 'doll_classic_a', slots: {} }), null);

    // Visible art spans rows 10-89; wide raised arms must not widen the stand.
    const width = 100, height = 100;
    const data = new Uint8ClampedArray(width * height * 4);
    const paint = (x0, x1, y0, y1) => {
      for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) data[(y * width + x) * 4 + 3] = 255;
    };
    paint(0, 99, 20, 22);
    paint(40, 59, 10, 89);
    await measureCharacterContacts(snapshot, {
      customArtRepo: { getTrackedObjectUrl: async () => 'blob:measured' },
      rasterizeImage: async () => ({ width, height, data })
    });
    const span = getCharacterStandSpan(snapshot);
    assert.deepEqual({ left: Math.round(span.left), width: Math.round(span.width) }, { left: 108, width: 84 });
    assert.deepEqual(characterStandStyle(snapshot), { '--stand-left-pct': '36.0000%', '--stand-width-pct': '28.0000%' });
  } finally { forgetCustomArtworkBottom(id); }
});

test('a stand span is clamped inside the canvas and empty artwork has none', () => {
  const id = 'custom_doll_stand_edge';
  const snapshot = { baseDollId: id, slots: {} };
  try {
    recordCustomArtworkBottom(id, 440, null, { left: 270, right: 300 });
    const edge = getCharacterStandSpan(snapshot);
    assert.ok(edge.left >= 0 && edge.left + edge.width <= 300, 'stays inside the canvas');
    assert.ok(edge.width >= 60, 'never thinner than the minimum stand');
    recordCustomArtworkBottom(id, null, null, null);
    assert.equal(getCharacterStandSpan(snapshot), null);
  } finally { forgetCustomArtworkBottom(id); }
});

test('the scene renderer applies a measured stand and clears it when the doll changes', async t => {
  const previous = globalThis.document;
  globalThis.document = { createElement: element, createElementNS: (_ns, tag) => element(tag) };
  t.after(() => { globalThis.document = previous; });
  const id = 'custom_doll_stand_scene';
  recordCustomArtworkBottom(id, 400, null, { left: 100, right: 200 });
  t.after(() => forgetCustomArtworkBottom(id));
  const view = createSceneEntityView({
    getAsset: (assetId) => all.find(a => a.id === assetId),
    sceneEntityRenderKey: () => 'k',
    store: { getState: () => ({ settings: {}, presets: [], currentScene: { entities: [] } }) },
    customArtRepo: { getTrackedObjectUrl: async () => 'data:image/png;base64,example' }
  });
  const entity = { instanceId: 'c1', sourceId: 'doll', kind: 'character', x: 500, y: 600, scale: 1, order: 1, characterSnapshot: { baseDollId: id, slots: {} } };
  const node = { ...element('button'), className: '' };
  view.patchSceneEntity(node, entity, false, false);
  assert.equal(node.style.values['--stand-left-pct'], '29.3333%');
  view.patchSceneEntity(node, { ...entity, characterSnapshot: { baseDollId: 'doll_classic_a', slots: {} } }, false, false);
  assert.equal(node.style.values['--stand-left-pct'], '', 'a shipped doll falls back to the stylesheet default');
});
