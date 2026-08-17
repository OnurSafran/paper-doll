import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSETS, getAsset, wearablesBySlot } from '../js/core/asset-catalog.js';
import { isColorValue } from '../js/core/palette.js';
import { createAppStore } from '../js/core/app-store.js';

test('expanded catalog has unique IDs and the complete planned inventory', () => {
  assert.equal(new Set(ASSETS.map((asset) => asset.id)).size, ASSETS.length);
  assert.equal(ASSETS.filter((asset) => asset.kind === 'doll').length, 6);
  assert.equal(ASSETS.filter((asset) => asset.kind === 'wearable').length, 58);
  assert.equal(ASSETS.filter((asset) => asset.kind === 'face').length, 19);
  assert.equal(ASSETS.filter((asset) => asset.kind === 'background').length, 7);
  assert.equal(ASSETS.filter((asset) => asset.kind === 'prop').length, 22);
});

test('wearable slot counts match the expanded product contract', () => {
  assert.deepEqual(
    Object.fromEntries(['top', 'bottom', 'dress', 'shoes', 'hair', 'accessory'].map((slot) => [slot, wearablesBySlot(slot).length])),
    { top: 11, bottom: 8, dress: 6, shoes: 8, hair: 11, accessory: 14 }
  );
});

test('catalog assets carry core DLC provenance metadata', () => {
  for (const asset of ASSETS) {
    assert.deepEqual(Object.keys(asset.metadata).sort(), ['added_date', 'concept', 'creator', 'dlc', 'source']);
    assert.match(asset.metadata.added_date, /^2026-08-(14|16|17)$/);
    assert.ok(['Paper Doll Studio', '5.6 Luna'].includes(asset.metadata.creator));
    assert.ok(['core', 'weekend garden'].includes(asset.metadata.concept));
    assert.equal(asset.metadata.dlc, 'core');
  }
  assert.equal(getAsset('top_raincoat').metadata.added_date, '2026-08-16');
  assert.equal(getAsset('top_raincoat').metadata.creator, '5.6 Luna');
  assert.equal(getAsset('top_raincoat').metadata.concept, 'weekend garden');
  assert.equal(getAsset('prop_bicycle').metadata.source, 'project-authored SVG primitives and paths');
  assert.equal(getAsset('top_tshirt').metadata.added_date, '2026-08-14');
  assert.equal(getAsset('top_tshirt').metadata.creator, 'Paper Doll Studio');
  assert.equal(getAsset('top_tshirt').metadata.concept, 'core');
});

test('every prop has logical sizing and a ground anchor', () => {
  for (const asset of ASSETS.filter((item) => item.kind === 'prop')) {
    assert.ok(asset.displayWidth > 0, `prop ${asset.id} displayWidth > 0`);
    assert.ok(asset.displayHeight > 0, `prop ${asset.id} displayHeight > 0`);
    assert.deepEqual(Object.keys(asset.groundAnchor), ['x', 'y']);
  }
  assert.equal(getAsset('prop_chair').name, 'Armchair');
  assert.equal(getAsset('prop_easel').name, 'Art easel');
  assert.equal(getAsset('prop_cake').name, 'Celebration cake');
});

test('every wearable has a persistable default color', () => {
  for (const asset of ASSETS.filter((item) => item.kind === 'wearable')) {
    assert.equal(isColorValue(asset.defaultColors?.primary), true, asset.id);
  }
});

test('base doll model can be switched via designer/setBaseDoll with undo/redo', () => {
  const store = createAppStore(undefined, { getAsset, assets: ASSETS });
  assert.equal(store.getState().designer.draft.baseDollId, 'doll_classic_a');

  store.dispatch({ type: 'designer/setBaseDoll', baseDollId: 'doll_classic_b' });
  assert.equal(store.getState().designer.draft.baseDollId, 'doll_classic_b');

  store.dispatch({ type: 'designer/setBaseDoll', baseDollId: 'doll_chibi_a' });
  assert.equal(store.getState().designer.draft.baseDollId, 'doll_chibi_a');

  store.dispatch({ type: 'app/undo' });
  assert.equal(store.getState().designer.draft.baseDollId, 'doll_classic_b');

  store.dispatch({ type: 'app/undo' });
  assert.equal(store.getState().designer.draft.baseDollId, 'doll_classic_a');

  store.dispatch({ type: 'app/redo' });
  assert.equal(store.getState().designer.draft.baseDollId, 'doll_classic_b');
});
