import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppStore } from '../js/core/app-store.js';
import {
  createDefaultEnvelope,
  sanitizeEnvelope,
  SCHEMA_VERSION
} from '../js/core/state-schema.js';
import {
  evaluateClipAtTime,
  evaluateAttachedEntityTransform,
  evaluateProceduralBlink
} from '../js/domain/motion-evaluator.js';
import {
  PLAYBACK_RATES,
  ATTACH_JOINTS,
  DEFAULT_ATTACH_JOINT,
  DEFAULT_PLAYBACK_RATE,
  isPlaybackRate,
  isAttachJoint
} from '../js/domain/vocabulary.js';
import { instantiateSceneTemplate, SCENE_TEMPLATES } from '../js/domain/scene-templates.js';
import { createSceneAnimationService } from '../js/services/scene-animation-service.js';
import { createExportService } from '../js/services/export-service.js';

test('Vocabulary: playback rates, attach joints, and validators', () => {
  assert.equal(isPlaybackRate(0.5), true);
  assert.equal(isPlaybackRate(1.0), true);
  assert.equal(isPlaybackRate(1.5), true);
  assert.equal(isPlaybackRate(2.0), true);
  assert.equal(isPlaybackRate(0), false);
  assert.equal(isPlaybackRate(-1), false);
  assert.equal(isPlaybackRate(10.0), false);

  assert.equal(isAttachJoint('root'), true);
  assert.equal(isAttachJoint('head'), true);
  assert.equal(isAttachJoint('armLeft'), true);
  assert.equal(isAttachJoint('armRight'), true);
  assert.equal(isAttachJoint('legLeft'), true);
  assert.equal(isAttachJoint('legRight'), true);
  assert.equal(isAttachJoint('elbow'), false);
});

test('Motion Evaluator: Procedural eye blinking is deterministic and respects reduced motion', () => {
  const blinkActive = evaluateProceduralBlink('char_1', 1000, { reducedMotion: false });
  assert.ok(blinkActive.scaleY >= 0.05 && blinkActive.scaleY <= 1.0);
  assert.equal(typeof blinkActive.isBlinking, 'boolean');

  // Deterministic for same ID & time
  const blinkRepeat = evaluateProceduralBlink('char_1', 1000, { reducedMotion: false });
  assert.equal(blinkActive.scaleY, blinkRepeat.scaleY);

  // Reduced motion forces scaleY = 1.0 and isBlinking = false
  const blinkReduced = evaluateProceduralBlink('char_1', 1000, { reducedMotion: true });
  assert.equal(blinkReduced.scaleY, 1.0);
  assert.equal(blinkReduced.isBlinking, false);
});

test('Motion Evaluator: Attached entity kinematics evaluates joints with scale and flip', () => {
  const hostEntity = {
    instanceId: 'host_doll',
    x: 800,
    y: 700,
    scale: 1.0,
    flipped: false,
    characterSnapshot: { baseDollId: 'classic_emma' }
  };
  const hostDollAsset = {
    id: 'classic_emma',
    kind: 'doll',
    pivots: {
      head: { x: 150, y: 90 },
      armRight: { x: 174, y: 120 }
    }
  };

  const attachedProp = {
    instanceId: 'prop_hat',
    attachedTo: 'host_doll',
    attachJoint: 'head',
    attachOffset: { dx: 0, dy: -200 }
  };

  const hostPoseRest = {
    root: { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 },
    head: { x: 0, y: 0, rotate: 10, scaleX: 1, scaleY: 1 }
  };

  const transform = evaluateAttachedEntityTransform(attachedProp, hostEntity, hostPoseRest, hostDollAsset);
  assert.ok(Number.isFinite(transform.tx));
  assert.ok(Number.isFinite(transform.ty));
  assert.ok(Number.isFinite(transform.rot));
  assert.equal(transform.rot, 10);

  // Test fallback to root when joint is 'root' or unknown
  const rootAttached = {
    instanceId: 'prop_balloon',
    attachedTo: 'host_doll',
    attachJoint: 'root',
    attachOffset: { dx: 50, dy: -50 }
  };
  const hostPoseRotated = {
    root: { x: 15, y: -20, rotate: 5, scaleX: 1, scaleY: 1 }
  };
  const rootTransform = evaluateAttachedEntityTransform(rootAttached, hostEntity, hostPoseRotated, hostDollAsset);
  assert.ok(Number.isFinite(rootTransform.tx));
  assert.ok(Number.isFinite(rootTransform.ty));
  assert.equal(rootTransform.rot, 5);
});

test('State Schema: v5 to v6 migration upgrades animation settings and presets', () => {
  const v5Envelope = {
    schemaVersion: 5,
    revision: 1,
    savedAt: new Date().toISOString(),
    settings: { reducedMotion: 'system', soundEnabled: false },
    presets: [],
    scenes: [
      {
        sceneId: 'scene_1',
        title: 'Old Scene',
        backgroundId: 'bg_park',
        stageWidth: 1600,
        cameraX: 0,
        animationSettings: { enabled: true, loop: true },
        entities: [
          {
            instanceId: 'ent_1',
            kind: 'prop',
            sourceId: 'prop_book',
            x: 200,
            y: 300,
            scale: 1,
            flipped: false,
            pinned: false,
            attachedTo: 'char_1',
            attachOffset: { dx: 10, dy: 10 }
          }
        ]
      }
    ],
    currentScene: null
  };

  const { envelope, warnings, migrated } = sanitizeEnvelope(v5Envelope);
  assert.equal(envelope.schemaVersion, SCHEMA_VERSION);
  assert.equal(migrated, true);
  assert.equal(envelope.scenes[0].animationSettings.playbackRate, DEFAULT_PLAYBACK_RATE);
  assert.equal(envelope.scenes[0].entities[0].attachJoint, DEFAULT_ATTACH_JOINT);
});

test('AppStore: scene/setPlaybackRate updates playback rate and persists', () => {
  const store = createAppStore(createDefaultEnvelope());
  assert.equal(store.getState().currentScene.animationSettings.playbackRate, 1.0);

  store.dispatch({ type: 'scene/setPlaybackRate', playbackRate: 1.5 });
  assert.equal(store.getState().currentScene.animationSettings.playbackRate, 1.5);

  // Invalid rates rejected
  store.dispatch({ type: 'scene/setPlaybackRate', playbackRate: 99.0 });
  assert.equal(store.getState().currentScene.animationSettings.playbackRate, 1.5);
});

test('AppStore: scene/syncCharacterBeats aligns rhythm across scene characters', () => {
  const store = createAppStore(createDefaultEnvelope());
  store.dispatch({ type: 'preset/save', name: 'Emma' });
  const presetId = store.getState().presets[0].presetId;

  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 500, y: 700 });
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 700, y: 700 });
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 900, y: 700 });

  // Mode 'sync': all phases set to 0
  store.dispatch({ type: 'scene/syncCharacterBeats', mode: 'sync' });
  const charsSync = store.getState().currentScene.entities.filter((e) => e.kind === 'character');
  assert.equal(charsSync[0].animation.phaseOffset, 0);
  assert.equal(charsSync[1].animation.phaseOffset, 0);
  assert.equal(charsSync[2].animation.phaseOffset, 0);

  // Mode 'alternate': 0, 0.5, 0
  store.dispatch({ type: 'scene/syncCharacterBeats', mode: 'alternate' });
  const charsAlt = store.getState().currentScene.entities.filter((e) => e.kind === 'character');
  assert.equal(charsAlt[0].animation.phaseOffset, 0);
  assert.equal(charsAlt[1].animation.phaseOffset, 0.5);
  assert.equal(charsAlt[2].animation.phaseOffset, 0);

  // Mode 'wave': 0, 0.25, 0.5
  store.dispatch({ type: 'scene/syncCharacterBeats', mode: 'wave' });
  const charsWave = store.getState().currentScene.entities.filter((e) => e.kind === 'character');
  assert.equal(charsWave[0].animation.phaseOffset, 0);
  assert.equal(charsWave[1].animation.phaseOffset, 0.25);
  assert.equal(charsWave[2].animation.phaseOffset, 0.5);
});

test('AppStore: scene/setDollAnimation auto-enables scene playback for active clips', () => {
  const store = createAppStore(createDefaultEnvelope());
  store.dispatch({ type: 'preset/save', name: 'Emma' });
  const presetId = store.getState().presets[0].presetId;
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 600, y: 700 });
  const charId = store.getState().currentScene.entities.find((e) => e.kind === 'character').instanceId;

  assert.equal(store.getState().currentScene.animationSettings.enabled, false);

  store.dispatch({
    type: 'scene/setDollAnimation',
    instanceId: charId,
    animation: { clipId: 'dance', enabled: true, intensity: 1.0 }
  });

  const doll = store.getState().currentScene.entities.find((e) => e.instanceId === charId);
  assert.equal(doll.animation.clipId, 'sway', 'Legacy dance clip should safely normalize to sway');
  assert.equal(doll.animation.enabled, true);
  assert.equal(store.getState().currentScene.animationSettings.enabled, true, 'Scene animation should auto-play on active clip selection');
});

test('AppStore: scene/setAttachJoint updates attachment joint on props', () => {
  const store = createAppStore(createDefaultEnvelope());
  store.dispatch({ type: 'preset/save', name: 'Emma' });
  const presetId = store.getState().presets[0].presetId;
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 600, y: 700 });
  const charId = store.getState().currentScene.entities.find((e) => e.kind === 'character').instanceId;

  store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_flower_bouquet', x: 650, y: 650 });
  const propId = store.getState().currentScene.entities.find((e) => e.kind === 'prop').instanceId;

  store.dispatch({ type: 'scene/attachEntity', childInstanceId: propId, parentInstanceId: charId });
  assert.equal(store.getState().currentScene.entities.find((e) => e.instanceId === propId).attachedTo, charId);

  store.dispatch({ type: 'scene/setAttachJoint', instanceId: propId, attachJoint: 'armRight' });
  assert.equal(store.getState().currentScene.entities.find((e) => e.instanceId === propId).attachJoint, 'armRight');
});

test('Scene Templates: instantiateSceneTemplate normalizes animationSettings and character animation structures', () => {
  const template = SCENE_TEMPLATES[0];
  const scene = instantiateSceneTemplate(template);

  assert.ok(scene, 'Scene should be instantiated');
  assert.ok(scene.animationSettings, 'Scene must have animationSettings');
  assert.equal(scene.animationSettings.enabled, false);
  assert.equal(scene.animationSettings.loop, true);
  assert.equal(scene.animationSettings.playbackRate, 1.0);
  assert.equal(scene.cameraX, 0);
  assert.ok(scene.stageWidth > 0);

  const char = scene.entities.find((e) => e.kind === 'character');
  assert.ok(char, 'Should contain character entity');
  assert.ok(char.animation, 'Character entity must have animation object');
  assert.equal(char.animation.clipId, 'none');
  assert.equal(char.animation.enabled, false);
  assert.equal(char.pose, 'rest');
  assert.ok(Number.isFinite(char.expressionIntensity));

  const prop = scene.entities.find((e) => e.kind === 'prop');
  if (prop) {
    assert.equal(prop.attachJoint, DEFAULT_ATTACH_JOINT);
  }
});

test('ExportService: renderSceneToCanvas supports animationTimeMs and attached kinematics', async () => {
  const originalDoc = globalThis.document;
  const createMockNode = (tag) => {
    const attrs = new Map();
    const styles = new Map();
    const children = [];
    return {
      tagName: tag,
      children,
      setAttribute: (k, v) => attrs.set(k, v),
      getAttribute: (k) => attrs.get(k),
      style: {
        setProperty: (k, v) => styles.set(k, v),
        getPropertyValue: (k) => styles.get(k)
      },
      appendChild: (child) => children.push(child),
      cloneNode: () => createMockNode(tag),
      querySelector: () => null
    };
  };

  globalThis.document = {
    createElementNS: (ns, tag) => createMockNode(tag)
  };

  try {
    const exportService = createExportService({
      loadAssetSvg: async () => ({
        cloneNode: () => ({
          querySelector: () => null,
          firstChild: null
        })
      }),
      svgElementToImage: async () => ({ width: 100, height: 100 })
    });

    const sceneSnapshot = {
      sceneId: 'test_scene',
      backgroundId: 'bg_room',
      stageWidth: 1600,
      entities: [
        {
          instanceId: 'char_1',
          kind: 'character',
          sourceId: 'demo_emma',
          characterSnapshot: { baseDollId: 'classic_emma', wearables: {}, face: {} },
          x: 800,
          y: 700,
          scale: 1,
          flipped: false,
          pose: 'wave',
          expression: 'smile',
          expressionIntensity: 1.0,
          animation: { clipId: 'happy_bounce', enabled: true, intensity: 1.0, phaseOffset: 0 },
          order: 1
        },
        {
          instanceId: 'prop_1',
          kind: 'prop',
          sourceId: 'prop_balloon',
          x: 850,
          y: 600,
          scale: 1,
          flipped: false,
          attachedTo: 'char_1',
          attachJoint: 'armRight',
          attachOffset: { dx: 50, dy: -100 },
          order: 2
        }
      ]
    };

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        drawImage: () => {},
        fillRect: () => {},
        setLineDash: () => {},
        strokeRect: () => {},
        fillText: () => {}
      })
    };

    const rendered = await exportService.renderSceneToCanvas(sceneSnapshot, mockCanvas, null, {
      animationTimeMs: 1500,
      playbackEnabled: true
    });
    assert.ok(rendered);
    assert.equal(rendered.width, 1600);
  } finally {
    globalThis.document = originalDoc;
  }
});

test('Motion Evaluator: evaluateClipAtTime supports loop: false clamping vs loop: true wrapping', () => {
  const clip = {
    id: 'test_clip',
    durationMs: 1000,
    channels: {
      root: [{ time: 0, x: 0 }, { time: 1, x: 100 }]
    }
  };

  // Loop = true wraps modulo 1
  const evalLoop = evaluateClipAtTime(clip, 1500, { loop: true });
  assert.equal(evalLoop.normalizedTime, 0.5);

  // Loop = false clamps to 1.0 at or beyond duration
  const evalNoLoop = evaluateClipAtTime(clip, 1500, { loop: false });
  assert.equal(evalNoLoop.normalizedTime, 1.0);
  assert.equal(evalNoLoop.root.x, 100);
});

test('Motion Evaluator: evaluateAttachedEntityTransform incorporates root and joint scaling', () => {
  const hostEntity = {
    instanceId: 'char_scale',
    x: 500,
    y: 500,
    scale: 1.0,
    flipped: false
  };
  const hostPoseScaled = {
    root: { x: 0, y: 0, rotate: 0, scaleX: 1.5, scaleY: 2.0 },
    head: { x: 0, y: 0, rotate: 0, scaleX: 1.0, scaleY: 1.0 }
  };
  const attachedProp = {
    instanceId: 'prop_scaled',
    attachedTo: 'char_scale',
    attachJoint: 'root',
    attachOffset: { dx: 100, dy: 100 }
  };

  const transform = evaluateAttachedEntityTransform(attachedProp, hostEntity, hostPoseScaled, null);
  // dx scaled by 1.5 -> 150, rotatedDx - dx = 50
  // dy scaled by 2.0 -> 200, rotatedDy - dy = 100
  assert.equal(transform.tx, 50);
  assert.equal(transform.ty, 100);
});

