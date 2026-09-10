import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppStore } from '../js/core/app-store.js';
import { createDefaultEnvelope, persistedProjection, sanitizeEnvelope } from '../js/core/state-schema.js';
import { getAsset } from '../js/core/asset-catalog.js';

test('papercraft switches are independent, survive persistence, and leave the outfit and scene unchanged', () => {
  const store = createAppStore();
  const before = store.getState();
  assert.equal(before.settings.clothingTabs, false);
  assert.equal(before.settings.cardboardFinish, true, 'cardboard finish is on for a new studio');
  store.dispatch({ type: 'settings/setPapercraft', setting: 'clothingTabs', enabled: true });
  assert.equal(store.getState().settings.cardboardFinish, true);
  store.dispatch({ type: 'settings/setPapercraft', setting: 'cardboardFinish', enabled: false });
  const saved = sanitizeEnvelope(persistedProjection(store.getState()), getAsset);
  assert.equal(saved.envelope.settings.clothingTabs, true);
  assert.equal(saved.envelope.settings.cardboardFinish, false, 'an explicit off survives a save and reload');
  assert.equal(store.getState().currentScene, before.currentScene);
  assert.equal(store.getState().designer, before.designer);
  store.dispatch({ type: 'settings/setPapercraft', setting: 'clothingTabs', enabled: false });
  assert.equal(store.getState().settings.clothingTabs, false);
  assert.equal(store.getState().settings.cardboardFinish, false);
});

test('projects without papercraft settings get cardboard on and tabs off; malformed switches cannot alter settings', () => {
  const envelope = createDefaultEnvelope();
  delete envelope.settings.clothingTabs;
  delete envelope.settings.cardboardFinish;
  const loaded = sanitizeEnvelope(envelope, getAsset).envelope;
  assert.equal(loaded.settings.clothingTabs, false);
  assert.equal(loaded.settings.cardboardFinish, true);
  const malformed = createDefaultEnvelope();
  malformed.settings.cardboardFinish = 'no';
  assert.equal(sanitizeEnvelope(malformed, getAsset).envelope.settings.cardboardFinish, true);
  const store = createAppStore(loaded);
  const before = store.getState();
  for (const action of [
    { setting: 'soundEnabled', enabled: true },
    { setting: 'clothingTabs', enabled: 'true' },
    { setting: '__proto__', enabled: true }
  ]) store.dispatch({ type: 'settings/setPapercraft', ...action });
  assert.equal(store.getState(), before);
});

test('sound effects switch persists and rejects non-boolean values', () => {
  const store = createAppStore();
  assert.equal(store.getState().settings.soundEnabled, false);
  store.dispatch({ type: 'settings/setSound', enabled: true });
  const saved = sanitizeEnvelope(persistedProjection(store.getState()), getAsset);
  assert.equal(saved.envelope.settings.soundEnabled, true);
  const before = store.getState();
  store.dispatch({ type: 'settings/setSound', enabled: 'false' });
  store.dispatch({ type: 'settings/setSound', enabled: true });
  assert.equal(store.getState(), before);
});
