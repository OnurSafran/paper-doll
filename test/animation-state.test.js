import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppStore } from '../js/core/app-store.js';
import {
  createDefaultEnvelope,
  createRuntimeState,
  persistedProjection,
  sanitizeEnvelope,
  SCHEMA_VERSION
} from '../js/core/state-schema.js';
import {
  DEFAULT_EXPRESSION_INTENSITY,
  DEFAULT_MOTION_CLIP_ID,
  DEFAULT_MOTION_INTENSITY,
  DEFAULT_PHASE_OFFSET,
  DEFAULT_STATIC_POSE
} from '../js/domain/vocabulary.js';

test('state schema version is bumped to 6 and envelope defaults are valid', () => {
  assert.equal(SCHEMA_VERSION, 6);
  const envelope = createDefaultEnvelope();
  assert.equal(envelope.schemaVersion, 6);
});

test('state schema migrates version 4 envelope to version 6 with safe animation defaults', () => {
  const v4Envelope = {
    schemaVersion: 4,
    revision: 1,
    savedAt: '2026-08-19T10:00:00.000Z',
    settings: { reducedMotion: 'system', soundEnabled: false },
    customAssets: [],
    presets: [],
    scenes: [
      {
        sceneId: 'scene_old_1',
        title: 'Old Scene',
        backgroundId: 'bg_bedroom',
        stageWidth: 1600,
        entities: [
          {
            instanceId: 'char_1',
            kind: 'character',
            sourceId: 'demo_emma',
            characterSnapshot: {
              baseDollId: 'doll_classic_a',
              skinTone: 'peach',
              face: { eyes: { assetId: 'face_eyes_classic_a', irisColor: 'cocoa' } },
              slots: {}
            },
            x: 800,
            y: 720,
            scale: 1,
            flipped: false,
            pinned: false,
            order: 1
          }
        ]
      }
    ],
    currentScene: null
  };

  const { envelope, warnings, migrated } = sanitizeEnvelope(v4Envelope);
  assert.equal(envelope.schemaVersion, 6);
  assert.equal(migrated, true);
  assert.ok(warnings.some((w) => w.includes('upgraded to character animation and pose schema')));

  const scene = envelope.scenes[0];
  assert.ok(scene.animationSettings);
  assert.equal(scene.animationSettings.enabled, false);
  assert.equal(scene.animationSettings.loop, true);

  const char = scene.entities[0];
  assert.equal(char.expressionIntensity, DEFAULT_EXPRESSION_INTENSITY);
  assert.equal(char.pose, DEFAULT_STATIC_POSE);
  assert.deepEqual(char.animation, {
    clipId: DEFAULT_MOTION_CLIP_ID,
    enabled: false,
    intensity: DEFAULT_MOTION_INTENSITY,
    phaseOffset: DEFAULT_PHASE_OFFSET
  });
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
