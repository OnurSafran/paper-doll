import test from 'node:test';
import assert from 'node:assert/strict';
import { getEntityBounds } from '../js/domain/scene-rules.js';
import { customColorOutline, getRelativeLuminance } from '../js/core/palette.js';
import { prepareWearableOutlines } from '../js/core/svg-loader.js';
import { appendAsset, patchDollColors, previewCustomColor } from '../js/features/designer/designer-view.js';
import { createStarterDraft } from '../js/domain/outfit-rules.js';
import { createExportService, svgElementToImage } from '../js/services/export-service.js';

function styledNode() {
  const properties = new Map();
  return { properties, style: { setProperty: (key, value) => properties.set(key, value) }, append() {} };
}

test('bounds stay current across moves, text edits, styles, scales and asset changes', () => {
  const bubble = { instanceId: 'memo-bubble', kind: 'bubble', scale: 1, width: 200, text: 'a'.repeat(100) };
  const initial = getEntityBounds(bubble);
  assert.deepEqual(getEntityBounds({ ...bubble, x: 123 }), initial);
  initial.width = 1;
  assert.equal(getEntityBounds(bubble).width, 200, 'callers cannot mutate cached bounds');
  assert.notDeepEqual(getEntityBounds({ ...bubble, width: 300 }), getEntityBounds(bubble));
  assert.notDeepEqual(getEntityBounds({ ...bubble, bubbleStyle: 'caption' }), getEntityBounds(bubble));
  assert.notDeepEqual(getEntityBounds({ ...bubble, text: 'short' }), getEntityBounds(bubble));
  assert.equal(getEntityBounds({ ...bubble, scale: 2 }).width, 400);
  const prop = { instanceId: 'memo-prop', kind: 'prop', sourceId: 'custom', scale: 1 };
  const asset = { displayWidth: 300, displayHeight: 400, groundAnchor: { x: 0.2, y: 0.8 } };
  assert.equal(getEntityBounds(prop, () => asset).width, 300);
  asset.displayWidth = 500;
  asset.groundAnchor.x = 0.7;
  assert.equal(getEntityBounds(prop, () => asset).width, 500);
  assert.equal(getEntityBounds(prop, () => asset).anchorX, 0.7);
  assert.equal(getEntityBounds(prop, () => undefined).width, 200);
  for (let i = 0; i < 300; i++) getEntityBounds({ ...prop, instanceId: `evict-${i}` });
  assert.equal(getEntityBounds(prop, () => asset).width, 500);
});

test('custom dark colors gain contrast without changing built-in or invalid colors', () => {
  assert.equal(getRelativeLuminance('#000000'), 0);
  assert.equal(getRelativeLuminance('#ffffff'), 1);
  for (const color of ['#111111', '#1c1917', '#000033']) assert.equal(customColorOutline(color), '#b8afa3');
  for (const color of ['black', 'brown', '#ffffff', '#abcdef', 'invalid', null]) assert.equal(customColorOutline(color), '#2d261e');
  const attributes = new Map([['stroke', '#2d261e']]);
  const node = { getAttribute: (key) => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value) };
  prepareWearableOutlines({ ...node, querySelectorAll: () => [] });
  assert.equal(attributes.get('stroke'), 'var(--asset-outline-color, #2d261e)');
});

test('thumbnail, live color preview and color-only patches restore normal outlines', async () => {
  const layer = styledNode();
  await appendAsset(layer, 'hair_long', { color: '#111111', loadAssetSvg: async () => ({}) });
  assert.equal(layer.properties.get('--asset-outline-color'), '#b8afa3');
  previewCustomColor('#ffffff', 'hair', () => [layer]);
  assert.equal(layer.properties.get('--asset-outline-color'), '#2d261e');
  const previous = createStarterDraft();
  const next = globalThis.structuredClone(previous);
  next.slots.hair.color = '#111111';
  layer.dataset = { slot: 'hair' };
  const container = { querySelectorAll: () => [layer] };
  assert.equal(patchDollColors(container, previous, next), true);
  assert.equal(layer.properties.get('--asset-outline-color'), '#b8afa3');
  assert.equal(patchDollColors(container, next, previous), true);
  assert.equal(layer.properties.get('--asset-outline-color'), '#2d261e');
});

function canvasMock() {
  return { width: 0, height: 0, getContext: () => ({ drawImage() {}, fillRect() {} }), toBlob: (cb) => cb(new Blob(['png'])) };
}

for (const mode of ['supported', 'unavailable-context', 'encoding-failure', 'cancel-encoding']) {
  test(`export canvas compatibility: ${mode}`, async () => {
    let htmlCanvases = 0;
    let closed = 0;
    let service;
    const originalDocument = globalThis.document;
    const originalOffscreen = globalThis.OffscreenCanvas;
    globalThis.document = { createElement: () => { htmlCanvases++; return canvasMock(); } };
    globalThis.OffscreenCanvas = class {
      getContext() { return mode === 'unavailable-context' ? null : canvasMock().getContext(); }
      async convertToBlob() {
        if (mode === 'cancel-encoding') service.cancel();
        if (mode === 'encoding-failure' || mode === 'cancel-encoding') throw new Error('Unsupported encoder');
        return new Blob(['png']);
      }
    };
    try {
      service = createExportService({
        loadAssetSvg: async () => ({}),
        svgElementToImage: async () => ({ close: () => closed++ })
      });
      const result = await service.exportSceneBlob({ entities: [] });
      assert.equal(result.ok, mode !== 'cancel-encoding');
      if (mode === 'cancel-encoding') assert.equal(result.code, 'EXPORT_CANCELLED');
      assert.equal(htmlCanvases, mode === 'supported' || mode === 'cancel-encoding' ? 0 : 1);
      assert.equal(closed, mode === 'encoding-failure' ? 2 : 1);
      assert.equal(service.isExporting(), false);
    } finally {
      globalThis.document = originalDocument;
      globalThis.OffscreenCanvas = originalOffscreen;
    }
  });
}

test('SVG bitmap decoding falls back to Image and revokes its object URL', async () => {
  const saved = { Image: globalThis.Image, XMLSerializer: globalThis.XMLSerializer, createImageBitmap: globalThis.createImageBitmap };
  const oldCreate = URL.createObjectURL;
  const oldRevoke = URL.revokeObjectURL;
  let revoked = 0;
  const svg = { cloneNode: () => ({ setAttribute() {} }) };
  globalThis.XMLSerializer = class { serializeToString() { return '<svg xmlns="http://www.w3.org/2000/svg"/>'; } };
  try {
    const bitmap = { close() {} };
    globalThis.createImageBitmap = async () => bitmap;
    assert.equal(await svgElementToImage(svg, 100, 100), bitmap);
    globalThis.createImageBitmap = async () => { throw new Error('SVG unsupported'); };
    globalThis.Image = class { set src(_value) { this.onload(); } };
    URL.createObjectURL = () => 'blob:test';
    URL.revokeObjectURL = () => revoked++;
    assert.ok(await svgElementToImage(svg, 100, 100) instanceof globalThis.Image);
    assert.equal(revoked, 1);
    globalThis.Image = class { set src(_value) { this.onerror(new Error('decode failed')); } };
    await assert.rejects(svgElementToImage(svg, 100, 100), /decode failed/);
    assert.equal(revoked, 2);
  } finally {
    Object.assign(globalThis, saved);
    URL.createObjectURL = oldCreate;
    URL.revokeObjectURL = oldRevoke;
  }
});
