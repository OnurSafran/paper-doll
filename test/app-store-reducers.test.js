import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAppStore,
  validateActionPayload,
  uiReducer,
  designerReducer,
  presetReducer,
  sceneReducer,
  customAssetReducer,
  settingsReducer
} from '../js/core/app-store.js';
import { createStarterDraft } from '../js/domain/outfit-rules.js';
import { shuffleDraft } from '../js/core/reducers/reducer-helpers.js';

test('dispatch ignores inherited domain names and rejects malformed actions without changing state', () => {
  const store = createAppStore();
  const initial = store.getState();
  for (const action of [null, undefined, {}, 'scene/new']) {
    assert.equal(store.dispatch(action).code, 'INVALID_PAYLOAD');
  }
  for (const type of ['constructor/action', 'toString/action', '__proto__/action']) {
    assert.equal(store.dispatch({ type }).code, 'NO_CHANGE');
  }
  assert.equal(store.getState(), initial);
  assert.equal(store.canUndo(), false);
  assert.equal(validateActionPayload({ type: '__proto__' }).valid, true);
});

test('selection toggles preserve the most recently selected item as primary', () => {
  const store = createAppStore();
  store.dispatch({ type: 'ui/selectEntity', instanceId: 'first' });
  store.dispatch({ type: 'ui/toggleEntitySelection', instanceId: 'second' });
  assert.equal(store.getState().ui.selectedEntityId, 'second');
  store.dispatch({ type: 'ui/toggleEntitySelection', instanceId: 'third' });
  store.dispatch({ type: 'ui/toggleEntitySelection', instanceId: 'third' });
  assert.equal(store.getState().ui.selectedEntityId, 'second');
});

test('strict action validation rejects non-finite geometry and malformed selection IDs', () => {
  const store = createAppStore(undefined, { strictValidation: true });
  for (const action of [
    { type: 'scene/moveEntity', instanceId: 'item', x: Infinity, y: 10 },
    { type: 'scene/scaleEntity', instanceId: 'item', scale: NaN },
    { type: 'ui/selectEntities', instanceIds: [42] },
    { type: 'ui/selectEntities', instanceIds: false }
  ]) assert.equal(store.dispatch(action).code, 'INVALID_PAYLOAD');
});

test('validateActionPayload verifies store action contracts correctly', () => {
  // Invalid action shapes
  assert.equal(validateActionPayload(null).valid, false);
  assert.equal(validateActionPayload('invalid').valid, false);
  assert.equal(validateActionPayload({}).valid, false);

  // Valid and invalid ui actions
  assert.equal(validateActionPayload({ type: 'ui/setMode', mode: 'play' }).valid, true);
  assert.equal(validateActionPayload({ type: 'ui/setMode', mode: 'invalid_mode' }).valid, false);

  // Valid and invalid designer actions
  assert.equal(validateActionPayload({ type: 'designer/selectSlot', slot: 'top' }).valid, true);
  assert.equal(validateActionPayload({ type: 'designer/selectSlot', slot: 'not_a_slot' }).valid, false);
  assert.equal(validateActionPayload({ type: 'designer/equip', assetId: 'top_shirt' }).valid, true);
  assert.equal(validateActionPayload({ type: 'designer/equip', assetId: 123 }).valid, false);

  // Valid and invalid scene actions
  assert.equal(validateActionPayload({ type: 'scene/setStageWidth', stageWidth: 3200 }).valid, true);
  assert.equal(validateActionPayload({ type: 'scene/setStageWidth', stageWidth: 9999 }).valid, false);
  assert.equal(validateActionPayload({ type: 'scene/panCamera', deltaX: 400 }).valid, true);
  assert.equal(validateActionPayload({ type: 'scene/panCamera', deltaX: 'not_a_number' }).valid, false);

  // Unknown action passes gracefully
  assert.equal(validateActionPayload({ type: 'custom/unknown' }).valid, true);
});

test('individual slice reducers can be invoked in isolation', () => {
  const initialState = {
    settings: { reducedMotion: 'system', soundEnabled: false, stamps: [], unlockedBackgrounds: [] },
    customAssets: [],
    presets: [],
    scenes: [],
    currentScene: {
      sceneId: 'test-scene',
      title: 'Test',
      stageWidth: 1600,
      cameraX: 0,
      backgroundId: 'bg_bedroom',
      entities: []
    },
    designer: {
      draft: createStarterDraft(),
      selectedSlot: 'top',
      editingPresetId: null,
      dirty: false
    },
    ui: {
      mode: 'designer',
      selectedEntityId: null,
      selectedEntityIds: [],
      storageStatus: 'saved'
    }
  };

  // uiReducer
  const uiResult = uiReducer(initialState, { type: 'ui/setMode', mode: 'play' });
  assert.equal(uiResult?.state.ui.mode, 'play');

  // settingsReducer
  const settingsResult = settingsReducer(initialState, { type: 'settings/setReducedMotion', mode: 'reduce' });
  assert.equal(settingsResult?.state.settings.reducedMotion, 'reduce');
  assert.equal(settingsResult?.persist, true);

  // Unhandled action returns null
  assert.equal(uiReducer(initialState, { type: 'designer/selectSlot', slot: 'top' }), null);
});

test('createAppStore with strictValidation rejects invalid action payloads immediately', () => {
  const store = createAppStore(undefined, { strictValidation: true });
  const result = store.dispatch({ type: 'designer/selectSlot', slot: 'invalid-slot' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_PAYLOAD');
  assert.match(result.reason, /invalid for type/);
});

test('shuffleDraft equips dress if bottom slot is missing or empty', () => {
  const assets = [
    { id: 'dress_1', kind: 'wearable', slot: 'dress', supportedFitFamilies: ['teen'] },
    { id: 'top_1', kind: 'wearable', slot: 'top', supportedFitFamilies: ['teen'] }
  ];
  const draft = createStarterDraft();
  const shuffled = shuffleDraft(draft, assets, () => 0.9);
  assert.equal(shuffled.slots.dress?.assetId, 'dress_1');
  assert.equal(shuffled.slots.top, null);
  assert.equal(shuffled.slots.bottom, null);
});
