import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppStore } from '../js/core/app-store.js';
import {
  createDefaultEnvelope,
  createRuntimeState,
  persistedProjection,
  sanitizeEnvelope,
  SCHEMA_VERSION,
  APP_VERSION
} from '../js/core/state-schema.js';

test('state schema version is unified with APP_VERSION and envelope defaults are valid', () => {
  assert.equal(SCHEMA_VERSION, APP_VERSION);
  const envelope = createDefaultEnvelope();
  assert.equal(envelope.schemaVersion, SCHEMA_VERSION);
  assert.equal(envelope.appVersion, APP_VERSION);
});

test('older animation saves are discarded at the paper-stage boundary', () => {
  const result = sanitizeEnvelope({ schemaVersion: 4, scenes: [{ sceneId: 'old', entities: [] }] });
  assert.equal(result.envelope.schemaVersion, SCHEMA_VERSION);
  assert.equal(result.envelope.appVersion, APP_VERSION);
  assert.equal(result.resetRequired, true);
  assert.equal(result.migrated, false);
  assert.deepEqual(result.envelope.scenes, []);
});

test('AppStore handles animation, pose, and expression intensity actions with undo and redo', () => {
  const store = createAppStore(createDefaultEnvelope());

  store.dispatch({ type: 'preset/save', name: 'Emma' });
  const presetId = store.getState().presets[0].presetId;

  // Spawn a character into current scene
  store.dispatch({
    type: 'scene/spawnCharacter',
    presetId,
    x: 800,
    y: 720
  });

  const spawned = store.getState().currentScene.entities.find((e) => e.sourceId === presetId);
  assert.ok(spawned, 'Character should be spawned into scene');
  const spawnedId = spawned.instanceId;

  const char0 = store.getState().currentScene.entities.find((e) => e.instanceId === spawnedId);
  assert.equal(char0.expressionIntensity, 0.65);
  assert.equal(char0.pose, 'rest');
  assert.equal(char0.animation.clipId, 'none');

  // 1. Change expression intensity
  store.dispatch({ type: 'scene/setDollExpressionIntensity', instanceId: spawnedId, expressionIntensity: 1.0 });
  let char = store.getState().currentScene.entities.find((e) => e.instanceId === spawnedId);
  assert.equal(char.expressionIntensity, 1.0);

  // 2. Change static pose
  store.dispatch({ type: 'scene/setDollPose', instanceId: spawnedId, pose: 'lean_left' });
  char = store.getState().currentScene.entities.find((e) => e.instanceId === spawnedId);
  assert.equal(char.pose, 'lean_left');

  // 3. Set animation clip and phase offset
  store.dispatch({
    type: 'scene/setDollAnimation',
    instanceId: spawnedId,
    animation: { clipId: 'happy_bounce', enabled: true, intensity: 1.2, phaseOffset: 0.25 }
  });
  char = store.getState().currentScene.entities.find((e) => e.instanceId === spawnedId);
  assert.deepEqual(char.animation, {
    clipId: 'happy_bounce',
    enabled: true,
    intensity: 1.2,
    phaseOffset: 0.25
  });

  // 4. Toggle scene playback and loop
  assert.equal(store.getState().currentScene.animationSettings.enabled, true, 'Active clip auto-enables scene playback');
  store.dispatch({ type: 'scene/toggleScenePlayback' });
  assert.equal(store.getState().currentScene.animationSettings.enabled, false);

  store.dispatch({ type: 'scene/toggleSceneLoop' });
  assert.equal(store.getState().currentScene.animationSettings.loop, false);

  // Test Undo stack
  assert.ok(store.canUndo());
  store.dispatch({ type: 'app/undo' }); // undo toggleSceneLoop
  assert.equal(store.getState().currentScene.animationSettings.loop, true);

  store.dispatch({ type: 'app/undo' }); // undo toggleScenePlayback
  assert.equal(store.getState().currentScene.animationSettings.enabled, true);

  store.dispatch({ type: 'app/undo' }); // undo setDollAnimation
  char = store.getState().currentScene.entities.find((e) => e.instanceId === spawnedId);
  assert.equal(char.animation.clipId, 'none');
  assert.equal(store.getState().currentScene.animationSettings.enabled, false);

  store.dispatch({ type: 'app/undo' }); // undo setDollPose
  char = store.getState().currentScene.entities.find((e) => e.instanceId === spawnedId);
  assert.equal(char.pose, 'rest');

  // Test Redo
  assert.ok(store.canRedo());
  store.dispatch({ type: 'app/redo' }); // redo setDollPose
  char = store.getState().currentScene.entities.find((e) => e.instanceId === spawnedId);
  assert.equal(char.pose, 'lean_left');
});
