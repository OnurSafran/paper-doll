import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAppStore } from '../js/core/app-store.js';
import { getAsset as getBuiltInAsset } from '../js/core/asset-catalog.js';
import { persistedProjection } from '../js/core/state-schema.js';
import { PACK_REGISTRY } from '../js/packs/index.js';
import {
  getAvailableBackup,
  saveProjectBackup,
  serializeProjectPackage,
  validateImportPayload
} from '../js/services/project-portability.js';

const PACK_TOP = 'fh_linen_shirt_adult';
const PACK_BACKGROUND = 'fh_living_room';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
}

/** A project whose doll wears Family & Home clothing in a Family & Home room. */
function packProject() {
  const store = createAppStore(undefined, {
    getAsset: PACK_REGISTRY.getAsset,
    assets: PACK_REGISTRY.getPacks().flatMap((manifest) => manifest.assets)
  });
  store.dispatch({ type: 'designer/setBaseDoll', baseDollId: 'doll_adult_a' });
  store.dispatch({ type: 'designer/equip', assetId: PACK_TOP });
  store.dispatch({ type: 'preset/save', name: 'Pack Doll' });
  store.dispatch({ type: 'scene/setBackground', backgroundId: PACK_BACKGROUND });
  const state = store.getState();
  assert.equal(state.presets[0]?.slots.top?.assetId, PACK_TOP, 'fixture must hold pack clothing');
  assert.equal(state.currentScene.backgroundId, PACK_BACKGROUND, 'fixture must use a pack background');
  return state;
}

test('importing a project keeps Family & Home clothing and backgrounds with the pack-aware resolver', async () => {
  const json = serializeProjectPackage(packProject());
  const result = await validateImportPayload(json, PACK_REGISTRY.getAsset);
  assert.equal(result.ok, true);
  assert.equal(result.envelope.presets[0].slots.top.assetId, PACK_TOP);
  assert.equal(result.envelope.currentScene.backgroundId, PACK_BACKGROUND);
  assert.ok(result.envelope.packRequirements.some((pack) => pack.id === 'pack_family_home'));
});

test('restoring a backup keeps Family & Home clothing and backgrounds with the pack-aware resolver', () => {
  const storage = memoryStorage();
  saveProjectBackup(storage, persistedProjection(packProject()));
  const backup = getAvailableBackup(storage, PACK_REGISTRY.getAsset);
  assert.equal(backup.available, true);
  assert.equal(backup.envelope.presets[0].slots.top.assetId, PACK_TOP);
  assert.equal(backup.envelope.currentScene.backgroundId, PACK_BACKGROUND);
});

test('the built-in-only catalog cannot resolve pack assets, so it must never be the project resolver', () => {
  assert.equal(getBuiltInAsset(PACK_TOP), undefined);
  assert.ok(PACK_REGISTRY.getAsset(PACK_TOP));
});

test('app wiring gives the project controller the pack registry resolver', () => {
  const controller = readFileSync(new URL('../js/app-project-controller.js', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(controller, /asset-catalog/, 'controller must not import the built-in catalog');
  assert.match(controller, /validateImportPayload\(text, context\.getAsset\)/);
  assert.equal((controller.match(/getAvailableBackup\([^)]*context\.getAsset\)/g) || []).length, 2);
  assert.match(app, /createAppProjectController\(\{[\s\S]*?getAsset: PACK_REGISTRY\.getAsset/);
});
