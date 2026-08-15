import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppStore } from '../js/core/app-store.js';
import { getAsset, ASSETS } from '../js/core/asset-catalog.js';
import { createDefaultEnvelope, persistedProjection, sanitizeEnvelope } from '../js/core/state-schema.js';
import { createStorageAdapter } from '../js/core/storage-adapter.js';

test('boundary limit: 50 presets limit enforced cleanly and rejects 51st', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset, assets: ASSETS });
  
  // Fill 50 presets
  for (let i = 1; i <= 50; i += 1) {
    const res = store.dispatch({ type: 'preset/save', name: `Doll Preset ${i}` });
    assert.equal(res.ok, true, `Failed at preset ${i}`);
  }
  assert.equal(store.getState().presets.length, 50);

  // Attempt 51st preset
  const overflow = store.dispatch({ type: 'preset/save', name: 'Doll Preset 51' });
  assert.equal(overflow.ok, false);
  assert.equal(overflow.code, 'LIMIT');
  assert.equal(store.getState().presets.length, 50);
});

test('boundary limit: 40 scene entities limit enforced cleanly across characters and props', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset, assets: ASSETS });
  store.dispatch({ type: 'scene/new' });
  assert.equal(store.getState().currentScene.entities.length, 0);

  // Add 40 entities
  for (let i = 1; i <= 40; i += 1) {
    const res = store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_plant', x: 500, y: 500 });
    assert.equal(res?.ok ?? true, true);
  }
  assert.equal(store.getState().currentScene.entities.length, 40);

  // Attempt 41st entity
  const overflow = store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_plant', x: 500, y: 500 });
  assert.equal(overflow.ok, false);
  assert.equal(overflow.code, 'LIMIT');
  assert.equal(store.getState().currentScene.entities.length, 40);
});

test('boundary limit: 30 library scenes limit enforced cleanly', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset, assets: ASSETS });
  
  for (let i = 1; i <= 30; i += 1) {
    const res = store.dispatch({ type: 'scene/saveToLibrary', name: `Scene ${i}` });
    assert.equal(res.ok, true, `Failed at scene ${i}`);
  }
  assert.equal(store.getState().scenes.length, 30);

  const overflow = store.dispatch({ type: 'scene/saveToLibrary', name: 'Scene 31' });
  assert.equal(overflow.ok, false);
  assert.equal(overflow.code, 'LIMIT');
  assert.equal(store.getState().scenes.length, 30);
});

test('storage payload footprint test at maximum boundary conditions', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset, assets: ASSETS });
  
  // Fill 50 presets with full outfits
  for (let i = 1; i <= 50; i += 1) {
    store.dispatch({ type: 'designer/equip', assetId: 'dress_sundress' });
    store.dispatch({ type: 'designer/equip', assetId: 'shoes_sneakers' });
    store.dispatch({ type: 'designer/equip', assetId: 'hair_ponytail' });
    store.dispatch({ type: 'preset/save', name: `Full Doll ${i}` });
  }

  // Fill current scene with 40 characters
  store.dispatch({ type: 'scene/new' });
  const samplePresetId = store.getState().presets[0].presetId;
  for (let i = 1; i <= 40; i += 1) {
    store.dispatch({ type: 'scene/spawnCharacter', presetId: samplePresetId, x: 200 + i * 20, y: 500 });
  }

  // Fill 30 library scenes
  for (let i = 1; i <= 30; i += 1) {
    store.dispatch({ type: 'scene/saveToLibrary', name: `Max Library Scene ${i}` });
  }

  const projection = persistedProjection(store.getState());
  const serialized = JSON.stringify(projection);

  // Standard browser localStorage quota is 5MB to 10MB (5,000,000+ bytes).
  // At absolute maximum state (50 full presets, 30 multi-character library scenes, 40 active scene entities),
  // assert footprint stays well below 1MB.
  assert.ok(serialized.length < 1_000_000, `Storage footprint was ${serialized.length} bytes, expected under 1MB`);
  
  // Verify no base64, data:, or DOM leaks in serialized JSON
  assert.doesNotMatch(serialized, /data:image/);
  assert.doesNotMatch(serialized, /<svg|<div/);

  // Verify roundtrip sanitation
  const sanitized = sanitizeEnvelope(JSON.parse(serialized), getAsset);
  assert.equal(sanitized.envelope.presets.length, 50);
  assert.equal(sanitized.envelope.scenes.length, 30);
  assert.equal(sanitized.envelope.currentScene.entities.length, 40);
});
