import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSETS, assetsByCollection, getAsset, PROP_COLLECTIONS, wearablesBySlot } from '../js/core/asset-catalog.js';
import { isColorValue } from '../js/core/palette.js';
import { createAppStore } from '../js/core/app-store.js';

test('expanded catalog has unique IDs and the complete planned inventory', () => {
  assert.equal(new Set(ASSETS.map((asset) => asset.id)).size, ASSETS.length);
  assert.equal(ASSETS.filter((asset) => asset.kind === 'doll').length, 6);
  assert.equal(ASSETS.filter((asset) => asset.kind === 'wearable').length, 87);
  assert.equal(ASSETS.filter((asset) => asset.kind === 'face').length, 19);
  assert.equal(ASSETS.filter((asset) => asset.kind === 'background').length, 11);
  assert.equal(ASSETS.filter((asset) => asset.kind === 'prop').length, 22);
  assert.ok(ASSETS.filter((asset) => asset.kind === 'background').every((asset) => [1600, 3200, 4800].includes(asset.backgroundWidth)));
  assert.equal(getAsset('bg_moonlit_meadow').backgroundWidth, 3200);
  assert.equal(getAsset('bg_candy_land').backgroundWidth, 4800);
  // Standard tiling backgrounds are authored at their native 1600x900 tile so nothing is cropped or stretched.
  assert.ok(ASSETS.filter((asset) => asset.kind === 'background' && asset.backgroundWidth === 1600)
    .every((asset) => asset.viewBox.join(' ') === '0 0 1600 900'));
});

test('wearable slot counts match the expanded product contract', () => {
  assert.deepEqual(
    Object.fromEntries(['top', 'bottom', 'dress', 'shoes', 'hair', 'accessory'].map((slot) => [slot, wearablesBySlot(slot).length])),
    { top: 15, bottom: 13, dress: 14, shoes: 12, hair: 15, accessory: 18 }
  );
});

test('catalog assets carry core DLC provenance metadata', () => {
  for (const asset of ASSETS) {
    assert.deepEqual(Object.keys(asset.metadata).sort(), ['added_date', 'concept', 'creator', 'dlc', 'source']);
    assert.match(asset.metadata.added_date, /^2026-08-(14|16|17|19)$/);
    assert.ok(['Paper Doll Studio', '5.6 Luna'].includes(asset.metadata.creator));
    assert.ok(['core', 'weekend garden', 'seamless panorama'].includes(asset.metadata.concept));
    assert.equal(asset.metadata.dlc, 'core');
  }
  assert.equal(getAsset('top_raincoat').metadata.added_date, '2026-08-16');
  assert.equal(getAsset('top_raincoat').metadata.creator, '5.6 Luna');
  assert.equal(getAsset('top_raincoat').metadata.concept, 'weekend garden');
  assert.equal(getAsset('prop_bicycle').metadata.source, 'project-authored SVG primitives and paths');
  assert.equal(getAsset('top_tshirt').metadata.added_date, '2026-08-14');
  assert.equal(getAsset('top_tshirt').metadata.creator, 'Paper Doll Studio');
  assert.equal(getAsset('top_tshirt').metadata.concept, 'core');
  assert.equal(getAsset('bg_moonlit_meadow').metadata.added_date, '2026-08-19');
  assert.equal(getAsset('bg_moonlit_meadow').metadata.creator, 'Paper Doll Studio');
  assert.equal(getAsset('bg_moonlit_meadow').metadata.concept, 'seamless panorama');
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

test('props expose the short curated collections without requiring one global all tab', () => {
  assert.deepEqual(PROP_COLLECTIONS.map((collection) => collection.id), ['home', 'outdoors', 'creative', 'fun', 'my-art']);
  for (const collection of PROP_COLLECTIONS.filter((item) => !item.customOnly)) {
    const props = assetsByCollection('prop', collection.id);
    assert.ok(props.length > 0, `${collection.id} should contain props`);
    assert.ok(props.every((prop) => prop.collections.includes(collection.id)));
  }
  assert.equal(assetsByCollection('prop', 'my-art').length, 0, 'My Art is derived from custom ownership');
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
