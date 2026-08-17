import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppStore } from '../js/core/app-store.js';
import { ASSETS, getAsset } from '../js/core/asset-catalog.js';
import { createDefaultEnvelope, createRuntimeState, persistedProjection, sanitizeEnvelope, STORAGE_KEY } from '../js/core/state-schema.js';
import { createStorageAdapter, loadEnvelope } from '../js/core/storage-adapter.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    data
  };
}

test('invalid child presets are skipped without discarding valid sections', () => {
  const envelope = createDefaultEnvelope();
  envelope.settings.soundEnabled = true;
  envelope.presets = [{ presetId: 'bad', name: '', baseDollId: 'doll_classic_a', skinTone: 'peach', slots: {} }];
  const result = sanitizeEnvelope(envelope, getAsset);
  assert.equal(result.envelope.settings.soundEnabled, true);
  assert.equal(result.envelope.presets.length, 0);
  assert.equal(result.warnings.length, 1);
});

test('malformed JSON loads safe defaults', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: '{broken' });
  const result = loadEnvelope(storage, getAsset);
  assert.equal(result.envelope.schemaVersion, 4);
  assert.equal(result.available, false);
  assert.match(result.warnings[0], /could not be read/);
  assert.equal([...storage.data.keys()].some((key) => key.startsWith('paperDollStudio.quarantine.')), true);
});

test('version 1 data migrates to version 4 without losing presets', () => {
  const legacy = createDefaultEnvelope();
  legacy.schemaVersion = 1;
  const result = sanitizeEnvelope(legacy, getAsset);
  assert.equal(result.envelope.schemaVersion, 4);
  assert.match(result.warnings[0], /upgraded/);
});

test('only a pristine runtime receives the first-run sample scene', () => {
  const fresh = createRuntimeState(createDefaultEnvelope());
  assert.deepEqual(fresh.currentScene.entities.map((entity) => entity.instanceId), ['sample-emma', 'sample-chair', 'sample-plant']);
  const envelope = createDefaultEnvelope();
  envelope.currentScene = { sceneId: 'empty-scene', title: 'Current Scene', backgroundId: 'bg_bedroom', updatedAt: new Date().toISOString(), entities: [] };
  assert.equal(createRuntimeState(envelope).currentScene.entities.length, 0);
});

test('stale temporary storage is discarded when the main value is valid', () => {
  const storage = memoryStorage({
    [STORAGE_KEY]: JSON.stringify(createDefaultEnvelope()),
    [`${STORAGE_KEY}.tmp`]: '{stale'
  });
  const result = loadEnvelope(storage, getAsset);
  assert.equal(result.available, true);
  assert.equal(storage.data.has(`${STORAGE_KEY}.tmp`), false);
});

test('temporary-key cleanup failure does not discard a valid main record', () => {
  const envelope = createDefaultEnvelope();
  envelope.settings.soundEnabled = true;
  const storage = memoryStorage({
    [STORAGE_KEY]: JSON.stringify(envelope),
    [`${STORAGE_KEY}.tmp`]: '{stale'
  });
  storage.removeItem = () => { throw new Error('denied'); };
  const result = loadEnvelope(storage, getAsset);
  assert.equal(result.available, true);
  assert.equal(result.envelope.settings.soundEnabled, true);
  assert.match(result.warnings[0], /could not be cleared/);
});

test('failed main write preserves previous successful bytes', () => {
  const previous = JSON.stringify(createDefaultEnvelope());
  const storage = memoryStorage({ [STORAGE_KEY]: previous });
  const originalSet = storage.setItem;
  storage.setItem = (key, value) => {
    if (key === STORAGE_KEY) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
    originalSet(key, value);
  };
  const statuses = [];
  const adapter = createStorageAdapter({ storage, onStatus: (status) => statuses.push(status) });
  const result = adapter.save({ ...createDefaultEnvelope(), savedAt: new Date().toISOString() });
  assert.equal(result.code, 'STORAGE_QUOTA');
  assert.equal(storage.data.get(STORAGE_KEY), previous);
  assert.equal(storage.data.has(`${STORAGE_KEY}.tmp`), false);
  assert.equal(statuses.at(-1).status, 'unsaved');
});

test('cleanup failure after the main write still reports saved data', () => {
  const storage = memoryStorage();
  storage.removeItem = () => { throw new Error('denied'); };
  const statuses = [];
  const adapter = createStorageAdapter({ storage, onStatus: (status) => statuses.push(status) });
  const envelope = { ...createDefaultEnvelope(), savedAt: new Date().toISOString() };
  const result = adapter.save(envelope);
  assert.equal(result.ok, true);
  assert.equal(result.code, 'TEMP_CLEANUP_FAILED');
  assert.deepEqual(JSON.parse(storage.data.get(STORAGE_KEY)), { ...envelope, revision: 2 });
  assert.equal(statuses.at(-1).status, 'saved');
});

test('scheduled saves coalesce and flush once with incremented revision', () => {
  const storage = memoryStorage();
  let writes = 0;
  const originalSet = storage.setItem;
  storage.setItem = (key, value) => { if (key === STORAGE_KEY) writes += 1; originalSet(key, value); };
  const adapter = createStorageAdapter({ storage, delay: 10000 });
  adapter.schedule({ ...createDefaultEnvelope(), savedAt: 'first' });
  adapter.schedule({ ...createDefaultEnvelope(), savedAt: 'second' });
  adapter.flush();
  assert.equal(writes, 1);
  const stored = JSON.parse(storage.data.get(STORAGE_KEY));
  assert.equal(stored.savedAt, 'second');
  assert.equal(stored.revision, 2);
});

test('monotonic revision increments upon successive saves', () => {
  const storage = memoryStorage();
  const adapter = createStorageAdapter({ storage, initialRevision: 1 });
  assert.equal(adapter.getBaseRevision(), 1);

  const res1 = adapter.save({ ...createDefaultEnvelope(), savedAt: 'v1' });
  assert.equal(res1.ok, true);
  assert.equal(res1.revision, 2);
  assert.equal(adapter.getBaseRevision(), 2);
  assert.equal(JSON.parse(storage.data.get(STORAGE_KEY)).revision, 2);

  const res2 = adapter.save({ ...createDefaultEnvelope(), savedAt: 'v2' });
  assert.equal(res2.ok, true);
  assert.equal(res2.revision, 3);
  assert.equal(adapter.getBaseRevision(), 3);
  assert.equal(JSON.parse(storage.data.get(STORAGE_KEY)).revision, 3);
});

test('cross-tab revision conflict blocks stale save and preserves newer storage bytes', () => {
  // Tab A and Tab B start with baseRevision 1
  const storage = memoryStorage({
    [STORAGE_KEY]: JSON.stringify({ ...createDefaultEnvelope(), revision: 1, savedAt: 'initial' })
  });

  const tabA = createStorageAdapter({ storage, initialRevision: 1 });
  const tabBStatuses = [];
  const tabB = createStorageAdapter({ storage, initialRevision: 1, onStatus: (s) => tabBStatuses.push(s) });

  // Tab A saves new data -> advances storage to revision 2
  const saveA = tabA.save({ ...createDefaultEnvelope(), savedAt: 'saved-by-tab-a' });
  assert.equal(saveA.ok, true);
  assert.equal(saveA.revision, 2);
  assert.equal(JSON.parse(storage.data.get(STORAGE_KEY)).savedAt, 'saved-by-tab-a');

  // Tab B (still at baseRevision 1) attempts to save
  const saveB = tabB.save({ ...createDefaultEnvelope(), savedAt: 'stale-save-tab-b' });
  assert.equal(saveB.ok, false);
  assert.equal(saveB.code, 'REVISION_CONFLICT');
  assert.equal(saveB.storageRevision, 2);
  assert.equal(saveB.baseRevision, 1);

  // Assert storage is UNTOUCHED (Tab A's data preserved)
  const currentDisk = JSON.parse(storage.data.get(STORAGE_KEY));
  assert.equal(currentDisk.savedAt, 'saved-by-tab-a');
  assert.equal(currentDisk.revision, 2);
  assert.equal(tabBStatuses.at(-1).status, 'unsaved');

  // Tab B forces overwrite with explicit permission
  const forcedSaveB = tabB.save({ ...createDefaultEnvelope(), savedAt: 'forced-save-tab-b' }, { force: true });
  assert.equal(forcedSaveB.ok, true);
  assert.equal(forcedSaveB.revision, 3);
  assert.equal(JSON.parse(storage.data.get(STORAGE_KEY)).savedAt, 'forced-save-tab-b');
  assert.equal(JSON.parse(storage.data.get(STORAGE_KEY)).revision, 3);
});

test('store completes Designer to Play while preserving scene snapshots', () => {
  let id = 0;
  const events = [];
  const store = createAppStore(createDefaultEnvelope(), {
    getAsset,
    assets: ASSETS,
    makeId: () => `generated-${++id}`,
    now: () => new Date('2026-08-14T00:00:00.000Z')
  });
  store.subscribe((event) => events.push(event));
  store.dispatch({ type: 'designer/equip', assetId: 'dress_sundress' });
  const saved = store.dispatch({ type: 'preset/save', name: '  Summer Doll  ' });
  assert.equal(saved.ok, true);
  assert.equal(store.getState().presets[0].name, 'Summer Doll');
  assert.equal(events.at(-1).persist, true);

  store.dispatch({ type: 'scene/new' });
  store.dispatch({ type: 'scene/spawnCharacter', presetId: saved.presetId, x: 700, y: 710 });
  const instance = store.getState().currentScene.entities[0];
  assert.equal(instance.characterSnapshot.slots.dress.assetId, 'dress_sundress');
  store.dispatch({ type: 'preset/delete', presetId: saved.presetId });
  assert.equal(store.getState().presets.length, 0);
  assert.equal(store.getState().currentScene.entities[0].characterSnapshot.slots.dress.assetId, 'dress_sundress');

  const projection = persistedProjection(store.getState(), () => new Date('2026-08-14T01:00:00.000Z'));
  assert.equal(projection.currentScene.entities.length, 1);
  assert.equal(Object.hasOwn(projection, 'ui'), false);
  assert.equal(Object.hasOwn(projection, 'designer'), false);
});

test('name limits preserve complete Unicode grapheme clusters', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset });
  const name = '👩‍👩‍👧‍👦'.repeat(30);
  const result = store.dispatch({ type: 'preset/save', name });
  assert.equal(result.ok, true);
  assert.equal(store.getState().presets[0].name, name);
});

test('custom colors are normalized, persisted, and unsafe CSS is rejected', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset });
  store.dispatch({ type: 'designer/setColor', slot: 'top', color: '#A1B2C3' });
  assert.equal(store.getState().designer.draft.slots.top.color, '#a1b2c3');
  const before = store.getState().designer.draft.slots.top.color;
  store.dispatch({ type: 'designer/setColor', slot: 'top', color: 'url(javascript:alert(1))' });
  assert.equal(store.getState().designer.draft.slots.top.color, before);
  const equipResult = store.dispatch({ type: 'designer/equip', assetId: 'top_blouse', color: 'linear-gradient(red, blue)' });
  assert.equal(equipResult.code, 'INVALID_COLOR');
  assert.equal(store.getState().designer.draft.slots.top.assetId, 'top_tshirt');

  const envelope = createDefaultEnvelope();
  envelope.presets = [{
    presetId: 'custom-color', name: 'Custom', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    baseDollId: 'doll_classic_a', skinTone: 'peach', slots: {
      hair: null, top: { assetId: 'top_tshirt', color: '#a1b2c3' }, bottom: null, dress: null, shoes: null, accessory: null
    }
  }];
  const sanitized = sanitizeEnvelope(envelope, getAsset);
  assert.equal(sanitized.envelope.presets[0].slots.top.color, '#a1b2c3');
});

test('shuffle creates a compatible deterministic outfit', () => {
  const values = [0.1, 0.2, 0.9, 0.1, 0.3, 0.4, 0.5, 0.2, 0.1];
  let cursor = 0;
  const store = createAppStore(createDefaultEnvelope(), { getAsset, assets: ASSETS, random: () => values[cursor++ % values.length] });
  store.dispatch({ type: 'designer/shuffle' });
  const slots = store.getState().designer.draft.slots;
  assert.ok(slots.hair);
  assert.ok(slots.shoes);
  assert.equal(Boolean(slots.dress), !(slots.top && slots.bottom));
});

test('store duplication selects a new independent entity', () => {
  let id = 0;
  const store = createAppStore(createDefaultEnvelope(), { getAsset, makeId: () => `copy-${++id}` });
  const result = store.dispatch({ type: 'scene/duplicateEntity', instanceId: 'sample-chair' });
  assert.equal(result.ok, true);
  assert.equal(store.getState().currentScene.entities.length, 4);
  assert.equal(store.getState().ui.selectedEntityId, 'copy-1');
  assert.equal(store.getState().currentScene.entities.at(-1).sourceId, 'prop_chair');
});

test('silk bow uses a valid color and survives save-load sanitization', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset, makeId: () => 'preset-bow' });
  store.dispatch({ type: 'designer/equip', assetId: 'accessory_bow' });
  store.dispatch({ type: 'preset/save', name: 'Bow Doll' });
  const saved = persistedProjection(store.getState());
  const restored = sanitizeEnvelope(saved, getAsset);
  assert.equal(saved.presets[0].slots.accessory.color, 'coral');
  assert.equal(restored.envelope.presets[0].slots.accessory.assetId, 'accessory_bow');
});

test('duplicate persisted IDs are skipped deterministically', () => {
  const envelope = createDefaultEnvelope();
  const stamp = new Date().toISOString();
  const preset = {
    presetId: 'same-preset', name: 'First', createdAt: stamp, updatedAt: stamp,
    baseDollId: 'doll_classic_a', skinTone: 'peach', slots: createRuntimeState(envelope).designer.draft.slots
  };
  envelope.presets = [preset, { ...preset, name: 'Second' }];
  envelope.currentScene = {
    sceneId: 'scene-duplicate', title: 'Current Scene', backgroundId: 'bg_bedroom', updatedAt: stamp,
    entities: [
      { instanceId: 'same-entity', kind: 'prop', sourceId: 'prop_chair', x: 500, y: 700, scale: 1, order: 1 },
      { instanceId: 'same-entity', kind: 'prop', sourceId: 'prop_plant', x: 700, y: 700, scale: 1, order: 2 }
    ]
  };
  const result = sanitizeEnvelope(envelope, getAsset);
  assert.deepEqual(result.envelope.presets.map((item) => item.name), ['First']);
  assert.deepEqual(result.envelope.currentScene.entities.map((item) => item.sourceId), ['prop_chair']);
  assert.equal(result.warnings.some((warning) => warning.includes('duplicate Dollbox')), true);
  assert.equal(result.warnings.some((warning) => warning.includes('duplicate scene')), true);
});

test('non-numeric persisted coordinates are rejected instead of moved to an edge', () => {
  const envelope = createDefaultEnvelope();
  envelope.currentScene = {
    sceneId: 'scene-invalid-point', title: 'Current Scene', backgroundId: 'bg_bedroom', updatedAt: new Date().toISOString(),
    entities: [{ instanceId: 'bad-point', kind: 'prop', sourceId: 'prop_chair', x: '', y: 700, scale: 1, order: 1 }]
  };
  const result = sanitizeEnvelope(envelope, getAsset);
  assert.equal(result.envelope.currentScene.entities.length, 0);
  assert.match(result.warnings[0], /invalid scene item/);
});

test('unknown persisted props remain recoverable and removable', () => {
  const envelope = createDefaultEnvelope();
  envelope.currentScene = {
    sceneId: 'scene-missing-asset', title: 'Current Scene', backgroundId: 'bg_bedroom', updatedAt: new Date().toISOString(),
    entities: [{ instanceId: 'missing-prop', kind: 'prop', sourceId: 'prop_retired', x: 500, y: 700, scale: 1, order: 1 }]
  };
  const result = sanitizeEnvelope(envelope, getAsset);
  assert.equal(result.envelope.currentScene.entities[0].sourceId, 'prop_retired');
  const store = createAppStore(result.envelope, { getAsset });
  assert.equal(store.dispatch({ type: 'scene/deleteEntity', instanceId: 'missing-prop' }).ok, true);
  assert.equal(store.getState().currentScene.entities.length, 0);
});

test('invalid or no-op commands do not notify or schedule persistence', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset });
  const events = [];
  store.subscribe((event) => events.push(event));
  assert.equal(store.dispatch({ type: 'scene/moveEntity', instanceId: 'missing', x: 1, y: 1 }).code, 'NO_CHANGE');
  assert.equal(store.dispatch({ type: 'scene/deleteEntity', instanceId: 'missing' }).code, 'NO_CHANGE');
  assert.equal(store.dispatch({ type: 'preset/rename', presetId: 'missing', name: 'No one' }).code, 'NO_CHANGE');
  assert.equal(store.dispatch({ type: 'designer/selectSlot', slot: 'not-a-slot' }).code, 'NO_CHANGE');
  assert.equal(events.length, 0);
});

test('generated ID collisions are retried before adding scene items', () => {
  const ids = ['sample-chair', 'unique-prop'];
  const store = createAppStore(createDefaultEnvelope(), { getAsset, makeId: () => ids.shift() });
  const result = store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_table', x: 800, y: 700 });
  assert.equal(result.ok, true);
  assert.equal(store.getState().currentScene.entities.at(-1).instanceId, 'unique-prop');
});

test('unsafe generated IDs are rejected before creating persisted scene records', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset, makeId: () => 'unsafe.id' });
  const result = store.dispatch({ type: 'scene/new' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ID_FAILED');
});

test('undo and redo navigate designer outfit mutations accurately', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset, assets: ASSETS });
  assert.equal(store.canUndo(), false);
  assert.equal(store.canRedo(), false);

  const initialTop = store.getState().designer.draft.slots.top.assetId;
  store.dispatch({ type: 'designer/equip', assetId: 'top_blouse' });
  assert.equal(store.getState().designer.draft.slots.top.assetId, 'top_blouse');
  assert.equal(store.canUndo(), true);
  assert.equal(store.canRedo(), false);

  store.dispatch({ type: 'designer/equip', assetId: 'dress_sundress' });
  assert.equal(store.getState().designer.draft.slots.dress.assetId, 'dress_sundress');
  assert.equal(store.getState().designer.draft.slots.top, null);

  // Undo dress equip -> restores blouse + bottom
  const undo1 = store.dispatch({ type: 'app/undo' });
  assert.equal(undo1.ok, true);
  assert.equal(store.getState().designer.draft.slots.top.assetId, 'top_blouse');
  assert.equal(store.getState().designer.draft.slots.dress, null);
  assert.equal(store.canRedo(), true);

  // Undo blouse equip -> restores initial top
  const undo2 = store.dispatch({ type: 'app/undo' });
  assert.equal(undo2.ok, true);
  assert.equal(store.getState().designer.draft.slots.top.assetId, initialTop);
  assert.equal(store.canUndo(), false);

  // Redo -> blouse restored
  const redo1 = store.dispatch({ type: 'app/redo' });
  assert.equal(redo1.ok, true);
  assert.equal(store.getState().designer.draft.slots.top.assetId, 'top_blouse');
  assert.equal(store.canUndo(), true);
  assert.equal(store.canRedo(), true);

  // Redo -> dress restored
  const redo2 = store.dispatch({ type: 'app/redo' });
  assert.equal(redo2.ok, true);
  assert.equal(store.getState().designer.draft.slots.dress.assetId, 'dress_sundress');
  assert.equal(store.canRedo(), false);
});

test('undo and redo navigate scene entity mutations and trigger persistence', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset, assets: ASSETS });
  const persistedEvents = [];
  store.subscribe((event) => { if (event.persist) persistedEvents.push(event); });

  const initialCount = store.getState().currentScene.entities.length;
  store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_table', x: 800, y: 700 });
  assert.equal(store.getState().currentScene.entities.length, initialCount + 1);
  const tableId = store.getState().currentScene.entities.at(-1).instanceId;

  store.dispatch({ type: 'scene/moveEntity', instanceId: tableId, x: 950, y: 720 });
  assert.equal(store.getState().currentScene.entities.find((e) => e.instanceId === tableId).x, 950);

  // Undo move
  persistedEvents.length = 0;
  store.dispatch({ type: 'app/undo' });
  assert.equal(store.getState().currentScene.entities.find((e) => e.instanceId === tableId).x, 800);
  assert.equal(persistedEvents.length, 1);

  // Undo spawn
  persistedEvents.length = 0;
  store.dispatch({ type: 'app/undo' });
  assert.equal(store.getState().currentScene.entities.length, initialCount);
  assert.equal(persistedEvents.length, 1);

  // Redo spawn
  persistedEvents.length = 0;
  store.dispatch({ type: 'app/redo' });
  assert.equal(store.getState().currentScene.entities.length, initialCount + 1);
  assert.equal(persistedEvents.length, 1);

  // New action clears redo stack
  store.dispatch({ type: 'scene/flipEntity', instanceId: tableId });
  assert.equal(store.canRedo(), false);
});

test('undo stack adheres to maxHistory bounds', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset, maxHistory: 3 });
  for (let i = 1; i <= 6; i += 1) {
    store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_plant', x: 100 * i, y: 500 });
  }
  let undoCount = 0;
  while (store.dispatch({ type: 'app/undo' }).ok) {
    undoCount += 1;
  }
  assert.equal(undoCount, 3);
});

test('scene library saves, updates, loads, duplicates, and deletes scenes', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset });
  store.dispatch({ type: 'scene/new' });
  store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_table', x: 400, y: 600 });
  
  // Save to library
  const saveRes = store.dispatch({ type: 'scene/saveToLibrary', name: 'Tea Party Scene' });
  assert.equal(saveRes.ok, true);
  assert.equal(store.getState().scenes.length, 1);
  assert.equal(store.getState().scenes[0].title, 'Tea Party Scene');
  assert.equal(store.getState().scenes[0].entities.length, 1);
  const savedSceneId = saveRes.sceneId;

  // Add another entity to active stage and update saved scene
  store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_plant', x: 600, y: 600 });
  assert.equal(store.getState().currentScene.entities.length, 2);
  const updateRes = store.dispatch({ type: 'scene/updateLibraryScene', sceneId: savedSceneId, name: 'Grand Tea Party' });
  assert.equal(updateRes.ok, true);
  assert.equal(store.getState().scenes[0].title, 'Grand Tea Party');
  assert.equal(store.getState().scenes[0].entities.length, 2);

  // Clear scene and reload from library
  store.dispatch({ type: 'scene/new' });
  assert.equal(store.getState().currentScene.entities.length, 0);
  const loadRes = store.dispatch({ type: 'scene/loadFromLibrary', sceneId: savedSceneId });
  assert.equal(loadRes.ok, true);
  assert.equal(store.getState().currentScene.entities.length, 2);

  // Duplicate scene in library
  const dupRes = store.dispatch({ type: 'scene/duplicateLibraryScene', sceneId: savedSceneId });
  assert.equal(dupRes.ok, true);
  assert.equal(store.getState().scenes.length, 2);
  assert.equal(store.getState().scenes[1].title, 'Grand Tea Party (Copy)');

  // Rename scene in library
  store.dispatch({ type: 'scene/renameLibraryScene', sceneId: savedSceneId, name: 'Royal Tea' });
  assert.equal(store.getState().scenes[0].title, 'Royal Tea');

  // Delete scene from library
  store.dispatch({ type: 'scene/deleteLibraryScene', sceneId: savedSceneId });
  assert.equal(store.getState().scenes.length, 1);
  assert.equal(store.getState().scenes[0].sceneId, dupRes.sceneId);
});

test('character expression changes correctly and persists', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset });
  store.dispatch({ type: 'preset/save', name: 'Puppet Emma' });
  const presetId = store.getState().presets[0].presetId;
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 500, y: 700 });
  const charId = store.getState().currentScene.entities[0].instanceId;

  // Set expression to smile
  store.dispatch({ type: 'scene/setDollExpression', instanceId: charId, expression: 'smile' });
  assert.equal(store.getState().currentScene.entities[0].expression, 'smile');

  // Set expression to talking
  store.dispatch({ type: 'scene/setDollExpression', instanceId: charId, expression: 'talking' });
  assert.equal(store.getState().currentScene.entities[0].expression, 'talking');

  // Set expression to o_mouth
  store.dispatch({ type: 'scene/setDollExpression', instanceId: charId, expression: 'o_mouth' });
  assert.equal(store.getState().currentScene.entities[0].expression, 'o_mouth');

  // Set expression to wide_open
  store.dispatch({ type: 'scene/setDollExpression', instanceId: charId, expression: 'wide_open' });
  assert.equal(store.getState().currentScene.entities[0].expression, 'wide_open');

  // Undo returns to o_mouth
  store.dispatch({ type: 'app/undo' });
  assert.equal(store.getState().currentScene.entities[0].expression, 'o_mouth');
});

test('all seven expressions round-trip through store, projection, JSON serialization, sanitization, and reload', () => {
  const allSeven = ['neutral', 'smile', 'happy', 'surprised', 'o_mouth', 'talking', 'wide_open'];
  
  for (const expr of allSeven) {
    const store = createAppStore(createDefaultEnvelope(), { getAsset });
    store.dispatch({ type: 'preset/save', name: 'Test Doll' });
    const presetId = store.getState().presets[0].presetId;
    store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 600, y: 700 });
    const instanceId = store.getState().currentScene.entities.find((e) => e.sourceId === presetId).instanceId;

    // 1. Dispatch expression (if testing neutral, first set happy so it is an active state change)
    if (expr === 'neutral') {
      store.dispatch({ type: 'scene/setDollExpression', instanceId, expression: 'happy' });
    }
    const res = store.dispatch({ type: 'scene/setDollExpression', instanceId, expression: expr });
    assert.equal(res.ok, true, `Should accept expression ${expr}`);
    const updatedEntity = store.getState().currentScene.entities.find((e) => e.instanceId === instanceId);
    assert.equal(updatedEntity.expression, expr);

    // 2. Persisted projection retains expression
    const proj = persistedProjection(store.getState());
    const projEntity = proj.currentScene.entities.find((e) => e.instanceId === instanceId);
    assert.equal(projEntity.expression, expr);

    // 3. JSON round-trip
    const serialized = JSON.stringify(proj);
    const parsed = JSON.parse(serialized);
    const parsedEntity = parsed.currentScene.entities.find((e) => e.instanceId === instanceId);
    assert.equal(parsedEntity.expression, expr);

    // 4. Schema sanitization preserves every one of the 7 expressions
    const sanitized = sanitizeEnvelope(parsed, getAsset);
    assert.equal(sanitized.warnings.length, 0);
    const sanitizedEntity = sanitized.envelope.currentScene.entities.find((e) => e.instanceId === instanceId);
    assert.equal(sanitizedEntity.expression, expr, `Expression ${expr} must survive reload sanitization`);
  }
});

test('invalid or unknown expressions safely fallback to neutral', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset });
  store.dispatch({ type: 'preset/save', name: 'Fallback Doll' });
  const presetId = store.getState().presets[0].presetId;
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 600, y: 700 });
  const instanceId = store.getState().currentScene.entities.find((e) => e.sourceId === presetId).instanceId;

  // Invalid expression rejected by store
  const invalidRes = store.dispatch({ type: 'scene/setDollExpression', instanceId, expression: 'angry_face' });
  assert.equal(invalidRes.ok, false);
  const currentEntity = store.getState().currentScene.entities.find((e) => e.instanceId === instanceId);
  assert.equal(currentEntity.expression, 'neutral');

  // Invalid expression in raw envelope sanitizes to default 'neutral'
  const rawEnvelope = {
    schemaVersion: 2,
    savedAt: new Date(0).toISOString(),
    settings: { reducedMotion: 'system', soundEnabled: false },
    presets: [{
      presetId: 'preset-1',
      name: 'Emma',
      baseDollId: 'doll_classic_a',
      skinTone: 'peach',
      slots: { hair: null, top: null, bottom: null, dress: null, shoes: null, accessory: null }
    }],
    scenes: [],
    currentScene: {
      sceneId: 'scene-1',
      title: 'Current Scene',
      backgroundId: 'bg_bedroom',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      entities: [{
        instanceId: 'char-1',
        kind: 'character',
        sourceId: 'preset-1',
        characterSnapshot: {
          baseDollId: 'doll_classic_a',
          skinTone: 'peach',
          slots: { hair: null, top: null, bottom: null, dress: null, shoes: null, accessory: null }
        },
        x: 800,
        y: 700,
        scale: 1,
        flipped: false,
        expression: 'unknown_nonexistent_expression',
        order: 1
      }]
    }
  };

  const sanitized = sanitizeEnvelope(rawEnvelope, getAsset);
  assert.equal(sanitized.envelope.currentScene.entities[0].expression, 'neutral');
});

test('sanitizeScene preserves valid createdAt timestamps', () => {
  const createdStamp = '2026-08-14T08:00:00.000Z';
  const updatedStamp = '2026-08-14T10:00:00.000Z';
  const candidate = {
    sceneId: 'test-created',
    title: 'Created Scene',
    backgroundId: 'bg_bedroom',
    createdAt: createdStamp,
    updatedAt: updatedStamp,
    entities: []
  };
  const sanitized = sanitizeEnvelope({ schemaVersion: 2, scenes: [candidate], presets: [] }, getAsset);
  assert.equal(sanitized.envelope.scenes[0].createdAt, createdStamp);
  assert.equal(sanitized.envelope.scenes[0].updatedAt, updatedStamp);
});

test('duplicateLibraryScene generates unique instance IDs for all scene entities', () => {
  let counter = 0;
  const store = createAppStore(createDefaultEnvelope(), {
    getAsset,
    makeId: () => `id-${++counter}`
  });
  store.dispatch({ type: 'scene/new' });
  store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_table', x: 400, y: 600 });
  store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_plant', x: 600, y: 600 });
  store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_chair', x: 800, y: 600 });
  const saveRes = store.dispatch({ type: 'scene/saveToLibrary', name: 'Multi Item' });
  
  const dupRes = store.dispatch({ type: 'scene/duplicateLibraryScene', sceneId: saveRes.sceneId });
  assert.equal(dupRes.ok, true);
  const dupScene = store.getState().scenes.find((s) => s.sceneId === dupRes.sceneId);
  const ids = dupScene.entities.map((e) => e.instanceId);
  assert.equal(ids.length, 3);
  assert.equal(new Set(ids).size, 3);
});

test('AppStore handles ui/message action and updates status message', () => {
  const store = createAppStore(createDefaultEnvelope());
  store.dispatch({ type: 'ui/message', message: 'Custom notification message.' });
  assert.equal(store.getState().ui.message, 'Custom notification message.');
});

test('AppStore uses injected clock and makeId consistently across scene operations', () => {
  const fixedTime = new Date('2026-08-15T12:30:00Z');
  let idCount = 500;
  const store = createAppStore(createDefaultEnvelope(), {
    getAsset,
    makeId: () => `injected-id-${++idCount}`,
    now: () => fixedTime
  });

  // 1. scene/new uses injected makeId and now
  store.dispatch({ type: 'scene/new' });
  assert.equal(store.getState().currentScene.sceneId, 'injected-id-501');
  assert.equal(store.getState().currentScene.updatedAt, fixedTime.toISOString());

  // 2. scene/setBackground uses injected now
  store.dispatch({ type: 'scene/setBackground', backgroundId: 'bg_park' });
  assert.equal(store.getState().currentScene.updatedAt, fixedTime.toISOString());

  // 3. scene/loadTemplate uses injected makeId and now
  store.dispatch({ type: 'scene/loadTemplate', templateId: 'template_tea_party' });
  assert.equal(store.getState().currentScene.updatedAt, fixedTime.toISOString());
  assert.ok(store.getState().currentScene.sceneId.startsWith('injected-id-'));
});
