import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppStore } from '../js/core/app-store.js';
import { getAsset } from '../js/core/asset-catalog.js';
import { createDefaultEnvelope, sanitizeCustomAsset } from '../js/core/state-schema.js';

test('AppStore accepts the Paint Studio route as a first-class UI mode', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset });
  const result = store.dispatch({ type: 'ui/setMode', mode: 'paint' });
  assert.equal(result.ok, true);
  assert.equal(store.getState().ui.mode, 'paint');
});

test('AppStore handles customAsset/add, customAsset/rename, customAsset/remove, and customAsset/restore with undo', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset });

  const customWearable = {
    assetId: 'custom_dress_party',
    name: 'Party Gown',
    kind: 'wearable',
    slot: 'dress',
    format: 'image/png',
    logicalWidth: 300,
    logicalHeight: 450,
    pixelWidth: 600,
    pixelHeight: 900,
    byteLength: 500,
    sha256: 'abcdef123456',
    libraryVisible: true,
    status: 'available'
  };

  // 1. Add custom asset
  const addRes = store.dispatch({ type: 'customAsset/add', asset: customWearable });
  assert.equal(addRes.ok, true);
  assert.equal(store.getState().customAssets.length, 1);
  assert.equal(store.getState().customAssets[0].name, 'Party Gown');

  // 2. Rename custom asset
  const renameRes = store.dispatch({ type: 'customAsset/rename', assetId: 'custom_dress_party', name: 'Royal Gown' });
  assert.equal(renameRes.ok, true);
  assert.equal(store.getState().customAssets[0].name, 'Royal Gown');

  // 3. Remove custom asset (marks status = 'trashed')
  const removeRes = store.dispatch({ type: 'customAsset/remove', assetId: 'custom_dress_party' });
  assert.equal(removeRes.ok, true);
  assert.equal(store.getState().customAssets[0].status, 'trashed');

  // 4. Restore custom asset
  const restoreRes = store.dispatch({ type: 'customAsset/restore', assetId: 'custom_dress_party' });
  assert.equal(restoreRes.ok, true);
  assert.equal(store.getState().customAssets[0].status, 'available');

  // 5. Undo restores to trashed state
  store.dispatch({ type: 'app/undo' });
  assert.equal(store.getState().customAssets[0].status, 'trashed');

  // 6. Undo restores to renamed state
  store.dispatch({ type: 'app/undo' });
  assert.equal(store.getState().customAssets[0].name, 'Royal Gown');
  assert.equal(store.getState().customAssets[0].status, 'available');
});

test('custom props retain validated collection assignments while My Art remains automatic', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset });
  const customProp = {
    assetId: 'custom_prop_collection_test',
    name: 'Collection Test',
    kind: 'prop',
    collections: ['home', 'outdoors', 'not-a-collection'],
    displayWidth: 200,
    displayHeight: 200,
    groundAnchor: { x: 0.5, y: 1 },
    sha256: '1234567890ab',
    libraryVisible: true,
    status: 'available'
  };

  assert.equal(store.dispatch({ type: 'customAsset/add', asset: customProp }).ok, true);
  assert.deepEqual(store.getState().customAssets[0].collections, ['home', 'outdoors']);
  assert.equal(store.dispatch({
    type: 'customAsset/setCollections',
    assetId: customProp.assetId,
    collections: ['creative', 'creative', 'unknown']
  }).ok, true);
  assert.deepEqual(store.getState().customAssets[0].collections, ['creative']);
});

test('AppStore equips custom wearable and prevents palette tinting on custom art', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset });

  const customTop = {
    assetId: 'custom_top_sparkle',
    name: 'Sparkle Top',
    kind: 'wearable',
    slot: 'top',
    format: 'image/png',
    logicalWidth: 300,
    logicalHeight: 450,
    pixelWidth: 600,
    pixelHeight: 900,
    byteLength: 500,
    sha256: 'abcdef123456',
    libraryVisible: true,
    status: 'available'
  };

  store.dispatch({ type: 'customAsset/add', asset: customTop });
  assert.equal(store.getState().customAssets.length, 1);

  // Equip custom top
  store.dispatch({ type: 'designer/equip', assetId: 'custom_top_sparkle' });
  assert.equal(store.getState().designer.draft.slots.top.assetId, 'custom_top_sparkle');

  // Attempting to change color on custom top has no effect
  const colorRes = store.dispatch({ type: 'designer/setColor', slot: 'top', color: 'emerald' });
  assert.equal(colorRes.code, 'NO_CHANGE');
});

test('AppStore customAsset/deleteWithUses cleans up all preset and scene occurrences', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset });

  const customProp = {
    assetId: 'custom_prop_statue',
    name: 'Gold Statue',
    kind: 'prop',
    format: 'image/png',
    displayWidth: 200,
    displayHeight: 300,
    groundAnchor: { x: 0.5, y: 1.0 },
    sha256: '1234567890ab',
    libraryVisible: true,
    status: 'available'
  };

  store.dispatch({ type: 'customAsset/add', asset: customProp });

  // Spawn prop into active scene
  store.dispatch({ type: 'scene/spawnProp', assetId: 'custom_prop_statue', x: 500, y: 600 });
  assert.equal(store.getState().currentScene.entities.some((e) => e.sourceId === 'custom_prop_statue'), true);

  // Delete with uses
  const delRes = store.dispatch({ type: 'customAsset/deleteWithUses', assetId: 'custom_prop_statue' });
  assert.equal(delRes.ok, true);
  assert.equal(store.getState().customAssets.length, 0);
  assert.equal(store.getState().currentScene.entities.some((e) => e.sourceId === 'custom_prop_statue'), false);
});

test('custom metadata enforces authoring dimensions and prop display bounds', () => {
  const valid = sanitizeCustomAsset({
    assetId: 'custom_prop_contract',
    name: 'Contract Prop',
    kind: 'prop',
    displayWidth: 999,
    displayHeight: 10
  });
  assert.equal(valid.logicalWidth, 500);
  assert.equal(valid.pixelWidth, 1000);
  assert.equal(valid.displayWidth, 360);
  assert.equal(valid.displayHeight, 40);

  assert.equal(sanitizeCustomAsset({
    assetId: 'custom_bad_dimensions',
    name: 'Bad Dimensions',
    kind: 'wearable',
    slot: 'top',
    logicalWidth: 640,
    logicalHeight: 480,
    pixelWidth: 1280,
    pixelHeight: 960
  }), null);
});
