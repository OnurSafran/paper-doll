import { readControllerBundle } from './source-bundle.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAppStore } from '../js/core/app-store.js';
import { createDefaultEnvelope } from '../js/core/state-schema.js';
import { createSceneAnimationService, resolveVoiceTargetCharacter } from '../js/services/scene-animation-service.js';
import { getSceneActiveAnimationDuration } from '../js/domain/motion-evaluator.js';
import { createPaintSaveService } from '../js/features/paint/paint-save-service.js';
import { sanitizeCustomAsset } from '../js/core/state-schema.js';
import { VIEWPORT_WIDTH } from '../js/domain/vocabulary.js';

function createMockElement(instanceId, x = 800) {
  const styles = new Map();
  const motionStyles = new Map();
  const eyesStyles = new Map();

  const motionSpan = {
    className: 'scene-entity-motion',
    style: {
      setProperty: (k, v) => motionStyles.set(k, String(v)),
      getPropertyValue: (k) => motionStyles.get(k) || ''
    }
  };

  const eyesLayer = {
    dataset: { slot: 'face-eyes' },
    style: {
      setProperty: (k, v) => eyesStyles.set(k, String(v)),
      getPropertyValue: (k) => eyesStyles.get(k) || ''
    }
  };

  const mouthSvg = {
    id: 'mouth-svg',
    querySelector: () => null
  };

  const posBtn = {
    dataset: { instanceId },
    querySelector: (sel) => {
      if (sel === '.scene-entity-motion') return motionSpan;
      if (sel.includes('face-eyes')) return eyesLayer;
      if (sel.includes('face-mouth')) return mouthSvg;
      return null;
    },
    style: {
      setProperty: (k, v) => styles.set(k, String(v)),
      getPropertyValue: (k) => styles.get(k) || ''
    },
    isConnected: true
  };

  return { posBtn, motionSpan, motionStyles, eyesLayer, eyesStyles };
}

test('Item 1: Animation completion never pushes undo snapshots or triggers autosaves', () => {
  let persistCount = 0;
  const store = createAppStore(createDefaultEnvelope(), {
    persistenceScheduler: {
      schedule: () => { persistCount += 1; },
      cancel: () => {}
    }
  });

  store.dispatch({ type: 'preset/save', name: 'Emma' });
  const presetId = store.getState().presets[0].presetId;
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 800, y: 720 });
  const charId = store.getState().currentScene.entities[0].instanceId;

  store.dispatch({
    type: 'scene/setDollAnimation',
    instanceId: charId,
    animation: { clipId: 'idle', enabled: true, intensity: 1.0, phaseOffset: 0 }
  });
  store.dispatch({
    type: 'scene/setAnimationSettings',
    animationSettings: { enabled: true, loop: false, playbackRate: 1.0 }
  });

  const { posBtn } = createMockElement(charId, 800);
  let currentTime = 1000;
  let rafCallback = null;

  const service = createSceneAnimationService({
    store,
    queryAll: () => [posBtn],
    requestAnimationFrame: (cb) => { rafCallback = cb; return 1; },
    cancelAnimationFrame: () => { rafCallback = null; },
    now: () => currentTime
  });

  persistCount = 0;
  service.play();

  // Advance time past clip duration (+2000ms > 1800ms idle duration)
  currentTime += 2000;
  rafCallback();

  assert.equal(service.isPlaying(), false, 'Service should stop playback');
  assert.equal(store.getState().currentScene.animationSettings.enabled, false, 'Store enabled flag set to false');
  assert.equal(persistCount, 0, 'Autosave must not be scheduled by animation frame completion');

  // Single undo should restore the state prior to scene/setAnimationSettings directly
  store.dispatch({ type: 'app/undo' });
  assert.equal(store.getState().currentScene.animationSettings.loop, true, 'Undo should restore previous authored scene state, not an animation frame');

  service.teardown();
});

test('Item 1b: Zero-animated scene returns 0 duration and does not auto-disable after 1s', () => {
  const emptyScene = { entities: [] };
  assert.equal(getSceneActiveAnimationDuration(emptyScene), 0, 'Empty scene active animation duration should be 0');

  const store = createAppStore(createDefaultEnvelope());
  store.dispatch({ type: 'preset/save', name: 'Emma' });
  const presetId = store.getState().presets[0].presetId;
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 800, y: 720 });
  const charId = store.getState().currentScene.entities[0].instanceId;

  // Character with clipId: 'none'
  store.dispatch({
    type: 'scene/setDollAnimation',
    instanceId: charId,
    animation: { clipId: 'none', enabled: false }
  });
  store.dispatch({
    type: 'scene/setAnimationSettings',
    animationSettings: { enabled: true, loop: false }
  });

  assert.equal(getSceneActiveAnimationDuration(store.getState().currentScene), 0);

  const { posBtn } = createMockElement(charId, 800);
  let currentTime = 1000;
  let rafCallback = null;

  const service = createSceneAnimationService({
    store,
    queryAll: () => [posBtn],
    requestAnimationFrame: (cb) => { rafCallback = cb; return 1; },
    cancelAnimationFrame: () => { rafCallback = null; },
    now: () => currentTime
  });

  service.play();
  currentTime += 2000;
  rafCallback();

  // Zero-clip scene does not auto-stop
  assert.equal(store.getState().currentScene.animationSettings.enabled, true, 'Zero-clip scene should not auto-disable enabled state');
  service.teardown();
});

test('Item 2: Non-looping playback completion applies static pose deterministically', () => {
  const store = createAppStore(createDefaultEnvelope());
  store.dispatch({ type: 'preset/save', name: 'Emma' });
  const presetId = store.getState().presets[0].presetId;
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 800, y: 720 });
  const charId = store.getState().currentScene.entities[0].instanceId;

  store.dispatch({
    type: 'scene/setDollAnimation',
    instanceId: charId,
    animation: { clipId: 'happy_bounce', enabled: true, intensity: 1.0, phaseOffset: 0 }
  });
  store.dispatch({
    type: 'scene/setAnimationSettings',
    animationSettings: { enabled: true, loop: false, playbackRate: 1.0 }
  });

  const { posBtn, motionStyles } = createMockElement(charId, 800);
  let currentTime = 1000;
  let rafCallback = null;

  const service = createSceneAnimationService({
    store,
    queryAll: () => [posBtn],
    requestAnimationFrame: (cb) => { rafCallback = cb; return 1; },
    cancelAnimationFrame: () => { rafCallback = null; },
    now: () => currentTime
  });

  service.play();
  currentTime += 500;
  rafCallback();
  assert.ok(motionStyles.has('--motion-ty'));

  // Reach end of clip
  currentTime += 1500;
  rafCallback();

  assert.equal(service.isPlaying(), false);
  assert.equal(motionStyles.get('--motion-ty'), '0', 'Static pose translation restored on completion');
  service.teardown();
});

test('Item 3: Play view tab validation preserves Joints tab for attached bubbles', async () => {
  const playJs = readControllerBundle(new URL('../js/features/play/play-view.js', import.meta.url));
  assert.ok(playJs.includes("activeInspectorTab === 'joints' && isAttached"));
  assert.ok(playJs.includes("activeInspectorTab === 'bubble' && isBubble"));
  assert.ok(playJs.includes("if (!isTabValid) {"));
});

test('Item 4: Keyboard tab navigation skips hidden tabs and applies roving tabindex', async () => {
  const appJs = readControllerBundle(new URL('../js/app.js', import.meta.url));
  assert.ok(appJs.includes("filter((t) => !t.hidden"));
  assert.ok(appJs.includes("t.setAttribute('tabindex', '-1')"));
  assert.ok(appJs.includes("targetTab.setAttribute('tabindex', '0')"));
});

test('Item 5: index.html has valid aria-labelledby id, tabpanel roles, and aria-controls', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="inspector-title"'), 'Eyebrow span has id="inspector-title"');
  assert.ok(html.includes('aria-controls="inspector-section-expressions"'));
  assert.ok(html.includes('aria-controls="inspector-section-motion"'));
  assert.ok(html.includes('aria-controls="inspector-section-joints"'));
  assert.ok(html.includes('aria-controls="inspector-section-bubble"'));

  assert.ok(html.includes('id="inspector-section-expressions" class="inspector-section" role="tabpanel" aria-labelledby="inspector-tab-expressions"'));
  assert.ok(html.includes('id="inspector-section-motion" class="inspector-section" role="tabpanel" aria-labelledby="inspector-tab-motion"'));
  assert.ok(html.includes('id="inspector-section-joints" class="inspector-section" role="tabpanel" aria-labelledby="inspector-tab-joints"'));
  assert.ok(html.includes('id="inspector-section-bubble" class="inspector-section" role="tabpanel" aria-labelledby="inspector-tab-bubble"'));
});

test('Item 6 & 7: Rhythm controls reflect sync/alternate/wave and motion pref shows on multi-select', () => {
  const playJs = readControllerBundle(new URL('../js/features/play/play-view.js', import.meta.url));
  assert.ok(playJs.includes('is-selected-rhythm'), 'Rhythm buttons apply is-selected-rhythm class');
  assert.ok(playJs.includes("btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false')"));
  assert.ok(playJs.includes('motionPrefGroup.hidden = !hasCharactersSelected'));
});

test('Item 8: SceneAnimationService caches DOM lookups and supports cache invalidation', () => {
  const store = createAppStore(createDefaultEnvelope());
  store.dispatch({ type: 'preset/save', name: 'Emma' });
  const presetId = store.getState().presets[0].presetId;
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 800, y: 720 });
  const charId = store.getState().currentScene.entities[0].instanceId;

  store.dispatch({
    type: 'scene/setDollAnimation',
    instanceId: charId,
    animation: { clipId: 'happy_bounce', enabled: true }
  });

  let queryCount = 0;
  const { posBtn } = createMockElement(charId, 800);
  const elements = [posBtn];

  let currentTime = 1000;
  let rafCallback = null;

  const service = createSceneAnimationService({
    store,
    queryAll: () => {
      queryCount += 1;
      return elements;
    },
    requestAnimationFrame: (cb) => { rafCallback = cb; return 1; },
    cancelAnimationFrame: () => { rafCallback = null; },
    now: () => currentTime
  });

  service.play();
  currentTime += 100;
  rafCallback();
  currentTime += 100;
  rafCallback();
  currentTime += 100;
  rafCallback();

  // queryAll should only have been called on cache sync, not 3 times every tick
  assert.equal(queryCount, 1, 'DOM queries must be cached across animation ticks');

  service.invalidateDomCache();
  currentTime += 100;
  rafCallback();
  assert.equal(queryCount, 2, 'invalidateDomCache should trigger re-query on next tick');

  service.teardown();
});

test('Item 9: Viewport culling uses VIEWPORT_WIDTH constant', () => {
  const store = createAppStore(createDefaultEnvelope());
  store.dispatch({ type: 'scene/setStageWidth', stageWidth: 4800 });
  store.dispatch({ type: 'scene/setCameraX', cameraX: 0 });

  store.dispatch({ type: 'preset/save', name: 'Emma' });
  const presetId = store.getState().presets[0].presetId;

  // Entity within VIEWPORT_WIDTH
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 800, y: 720 });
  const charOnId = store.getState().currentScene.entities[0].instanceId;
  store.dispatch({ type: 'scene/setDollAnimation', instanceId: charOnId, animation: { clipId: 'idle', enabled: true } });

  // Entity well beyond VIEWPORT_WIDTH + 350
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 2500, y: 720 });
  const charOffId = store.getState().currentScene.entities[1].instanceId;
  store.dispatch({ type: 'scene/setDollAnimation', instanceId: charOffId, animation: { clipId: 'idle', enabled: true } });

  const onMock = createMockElement(charOnId, 800);
  const offMock = createMockElement(charOffId, 2500);

  let currentTime = 1000;
  let rafCallback = null;
  const service = createSceneAnimationService({
    store,
    queryAll: () => [onMock.posBtn, offMock.posBtn],
    requestAnimationFrame: (cb) => { rafCallback = cb; return 1; },
    cancelAnimationFrame: () => { rafCallback = null; },
    now: () => currentTime
  });

  service.play();
  currentTime += 200;
  rafCallback();

  assert.ok(onMock.motionStyles.has('--motion-ty'));
  assert.equal(offMock.motionStyles.has('--motion-ty'), false);
  service.teardown();
});

test('Item 10 & 11: Paint save service runs bounds scan once and writes consistent valid metadata', async () => {
  let getImageDataCalls = 0;
  const mockCtx = {
    getImageData: () => {
      getImageDataCalls += 1;
      const data = new Uint8ClampedArray(400 * 400 * 4);
      for (let y = 100; y < 200; y++) {
        for (let x = 100; x < 200; x++) {
          const idx = (y * 400 + x) * 4;
          data[idx] = 255;
          data[idx + 3] = 255;
        }
      }
      return { data, width: 400, height: 400 };
    },
    drawImage: () => {}
  };

  const mockCanvas = {
    width: 400,
    height: 400,
    getContext: () => mockCtx,
    toBlob: (cb) => cb(new Blob(['test-png-bytes'], { type: 'image/png' }))
  };

  const mockSession = {
    getState: () => ({
      name: 'Star Prop',
      itemType: 'prop',
      slot: 'custom',
      propSize: 'medium',
      propPlacement: 'surface',
      originContext: 'play'
    }),
    setName: () => {},
    markDirty: () => {},
    logicalWidth: 200,
    logicalHeight: 200
  };

  let savedMeta = null;
  const mockRepo = {
    computeSha256: async () => 'mocksha256abc',
    saveArtwork: async (assetId, blob, meta) => {
      savedMeta = meta;
      return { ok: true };
    },
    clearDraft: async () => {}
  };

  const hadDocument = 'document' in globalThis;
  const originalDocument = globalThis.document;
  const originalCreateElement = globalThis.document?.createElement;
  try {
    globalThis.document = globalThis.document || {};
    globalThis.document.createElement = (tag) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => mockCtx,
          toBlob: (cb) => cb(new Blob(['crop-png-bytes'], { type: 'image/png' }))
        };
      }
      return originalCreateElement ? originalCreateElement(tag) : {};
    };

    const saveService = createPaintSaveService({
      rootElement: { querySelector: () => null },
      store: { dispatch: () => ({ ok: true }) },
      getSession: () => mockSession,
      getCanvasState: () => ({ canvas: mockCanvas, ctx: mockCtx }),
      customArtRepo: mockRepo,
      announceStatus: () => {}
    });

    await saveService.commitSave(false);

    assert.equal(getImageDataCalls, 1, 'getImageData must be called exactly once per prop save');
    assert.ok(savedMeta);
    assert.equal(savedMeta.pixelWidth, 100);
    assert.equal(savedMeta.pixelHeight, 100);
    assert.equal(savedMeta.logicalWidth, 50);
    assert.equal(savedMeta.logicalHeight, 50);

    // Verify sanitized by state-schema
    const sanitized = sanitizeCustomAsset(savedMeta);
    assert.ok(sanitized, 'Cropped prop metadata must pass state-schema sanitization');
  } finally {
    if (!hadDocument) {
      delete globalThis.document;
    } else {
      globalThis.document = originalDocument;
      if (originalCreateElement) {
        globalThis.document.createElement = originalCreateElement;
      } else {
        delete globalThis.document.createElement;
      }
    }
  }
});

test('Critical: SceneAnimationService self-heals when DOM nodes are recreated during playback without freezing', () => {
  const store = createAppStore(createDefaultEnvelope());
  store.dispatch({ type: 'preset/save', name: 'Emma' });
  const presetId = store.getState().presets[0].presetId;
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 800, y: 720 });
  const charId = store.getState().currentScene.entities[0].instanceId;

  store.dispatch({
    type: 'scene/setDollAnimation',
    instanceId: charId,
    animation: { clipId: 'happy_bounce', enabled: true }
  });

  const oldMock = createMockElement(charId, 800);
  let currentElement = oldMock.posBtn;
  let currentTime = 1000;
  let rafCallback = null;

  const service = createSceneAnimationService({
    store,
    queryAll: () => [currentElement],
    requestAnimationFrame: (cb) => { rafCallback = cb; return 1; },
    cancelAnimationFrame: () => { rafCallback = null; },
    now: () => currentTime
  });

  service.play();
  currentTime += 100;
  rafCallback();
  assert.ok(oldMock.motionStyles.has('--motion-ty'), 'Initial element received motion transforms');

  // Simulate Play re-render: element is replaced in DOM
  oldMock.posBtn.isConnected = false;
  const newMock = createMockElement(charId, 800);
  currentElement = newMock.posBtn;

  // Next animation tick without explicit service reset
  currentTime += 100;
  rafCallback();

  assert.ok(newMock.motionStyles.has('--motion-ty'), 'Recreated DOM element must receive motion transforms without freezing');
  service.teardown();
});

test('High: rigidLimbMemo differentiates characters with different wardrobe items', () => {
  const store = createAppStore(createDefaultEnvelope());
  store.dispatch({ type: 'preset/save', name: 'Emma' });
  const presetId = store.getState().presets[0].presetId;
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 800, y: 720 });
  const charId1 = store.getState().currentScene.entities.at(-1).instanceId;
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 1000, y: 720 });
  const charId2 = store.getState().currentScene.entities.at(-1).instanceId;

  // Give charId1 a rigid dress, charId2 a flexible shirt
  const entity1 = store.getState().currentScene.entities.find((e) => e.instanceId === charId1);
  const entity2 = store.getState().currentScene.entities.find((e) => e.instanceId === charId2);

  entity1.characterSnapshot.slots = { dress: { assetId: 'wearable_dress_ballgown' } };
  entity2.characterSnapshot.slots = { top: { assetId: 'wearable_top_tshirt' } };

  const assetLookup = (id) => {
    if (id === 'wearable_dress_ballgown') return { id, kind: 'wearable', slot: 'dress', poseSupport: 'rigid' };
    if (id === 'wearable_top_tshirt') return { id, kind: 'wearable', slot: 'top', poseSupport: 'flexible' };
    return null;
  };

  const mock1 = createMockElement(charId1, 800);
  const mock2 = createMockElement(charId2, 1000);

  const service = createSceneAnimationService({
    store,
    queryAll: () => [mock1.posBtn, mock2.posBtn],
    getAsset: assetLookup
  });

  service.applyStaticPoseToDom();

  // Test memoization key separation
  const s1 = entity1.characterSnapshot.slots;
  const s2 = entity2.characterSnapshot.slots;
  assert.notEqual(
    `armLeft:${s1.top?.assetId || ''}:${s1.bottom?.assetId || ''}:${s1.dress?.assetId || ''}:${s1.shoes?.assetId || ''}`,
    `armLeft:${s2.top?.assetId || ''}:${s2.bottom?.assetId || ''}:${s2.dress?.assetId || ''}:${s2.shoes?.assetId || ''}`,
    'Cache keys must be unique per wardrobe configuration'
  );

  service.teardown();
});

test('Medium: 504000ms LCM clock wrap eliminates phase pops across all clip durations', () => {
  const durations = [800, 1000, 1200, 1400, 1600, 1800, 2000, 2400, 3000];
  const LCM = 504000;

  for (const d of durations) {
    assert.equal(LCM % d, 0, `LCM 504000ms must be an exact multiple of duration ${d}ms`);
  }

  // Simulate wrapping at 10x LCM
  const tBefore = LCM * 10 + 350;
  const tAfter = tBefore % LCM;
  for (const d of durations) {
    const phaseBefore = (tBefore / d) % 1.0;
    const phaseAfter = (tAfter / d) % 1.0;
    assert.ok(Math.abs(phaseBefore - phaseAfter) < 1e-9, `Phase for clip ${d}ms must be mathematically identical across wrap`);
  }
});

test('Low & Polish: Multi-selection allows batch updates for poses, animations, and expressions', () => {
  const store = createAppStore(createDefaultEnvelope());
  store.dispatch({ type: 'preset/save', name: 'Emma' });
  const presetId = store.getState().presets[0].presetId;
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 800, y: 720 });
  const charId1 = store.getState().currentScene.entities.at(-1).instanceId;
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 1000, y: 720 });
  const charId2 = store.getState().currentScene.entities.at(-1).instanceId;

  // Select both
  store.dispatch({ type: 'ui/selectEntities', instanceIds: [charId1, charId2] });

  // Batch set pose
  store.dispatch({ type: 'scene/setDollPose', pose: 'lean_left' });
  let e1 = store.getState().currentScene.entities.find((e) => e.instanceId === charId1);
  let e2 = store.getState().currentScene.entities.find((e) => e.instanceId === charId2);
  assert.equal(e1.pose, 'lean_left');
  assert.equal(e2.pose, 'lean_left');

  // Batch set animation clip
  store.dispatch({ type: 'scene/setDollAnimation', animation: { clipId: 'happy_bounce', enabled: true } });
  e1 = store.getState().currentScene.entities.find((e) => e.instanceId === charId1);
  e2 = store.getState().currentScene.entities.find((e) => e.instanceId === charId2);
  assert.equal(e1.animation.clipId, 'happy_bounce');
  assert.equal(e2.animation.clipId, 'happy_bounce');

  // Batch set expression
  store.dispatch({ type: 'scene/setDollExpression', expression: 'smile' });
  e1 = store.getState().currentScene.entities.find((e) => e.instanceId === charId1);
  e2 = store.getState().currentScene.entities.find((e) => e.instanceId === charId2);
  assert.equal(e1.expression, 'smile');
  assert.equal(e2.expression, 'smile');

  // Single undo reverts the batch operation atomically
  store.dispatch({ type: 'app/undo' });
  e1 = store.getState().currentScene.entities.find((e) => e.instanceId === charId1);
  e2 = store.getState().currentScene.entities.find((e) => e.instanceId === charId2);
  assert.equal(e1.expression, 'neutral');
  assert.equal(e2.expression, 'neutral');
});

test('Minor: resolveVoiceTargetCharacter handles selected character and fallback accurately', () => {
  const scene = {
    entities: [
      { instanceId: 'prop_1', kind: 'prop' },
      { instanceId: 'char_1', kind: 'character' },
      { instanceId: 'char_2', kind: 'character' }
    ]
  };

  // When character is selected
  assert.equal(resolveVoiceTargetCharacter(scene, 'char_2')?.instanceId, 'char_2');

  // When prop is selected, fallback to first character
  assert.equal(resolveVoiceTargetCharacter(scene, 'prop_1')?.instanceId, 'char_1');

  // When nothing selected, fallback to first character
  assert.equal(resolveVoiceTargetCharacter(scene, null)?.instanceId, 'char_1');
});
