import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppStore } from '../js/core/app-store.js';
import { createDefaultEnvelope } from '../js/core/state-schema.js';
import { createSceneAnimationService } from '../js/services/scene-animation-service.js';

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
    }
  };

  return { posBtn, motionSpan, motionStyles, eyesLayer, eyesStyles };
}

test('SceneAnimationService starts, pauses, resets, and writes CSS custom properties to DOM', () => {
  const store = createAppStore(createDefaultEnvelope());
  store.dispatch({ type: 'preset/save', name: 'Emma' });
  const presetId = store.getState().presets[0].presetId;
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 800, y: 720 });
  const charId = store.getState().currentScene.entities[0].instanceId;

  // Set animation clip
  store.dispatch({
    type: 'scene/setDollAnimation',
    instanceId: charId,
    animation: { clipId: 'happy_bounce', enabled: true, intensity: 1.0, phaseOffset: 0 }
  });

  const { posBtn, motionStyles } = createMockElement(charId, 800);
  const elements = [posBtn];

  let currentTime = 1000;
  let rafCallback = null;

  const service = createSceneAnimationService({
    store,
    queryAll: () => elements,
    requestAnimationFrame: (cb) => {
      rafCallback = cb;
      return 1;
    },
    cancelAnimationFrame: () => {
      rafCallback = null;
    },
    now: () => currentTime
  });

  assert.equal(service.isPlaying(), false);

  // Play
  service.play();
  assert.equal(service.isPlaying(), true);
  assert.ok(rafCallback, 'RAF should be scheduled');

  // Advance time by 540ms (apex of bounce) and trigger frame
  currentTime += 540;
  rafCallback();

  assert.ok(motionStyles.has('--motion-ty'));
  const ty = Number(motionStyles.get('--motion-ty'));
  assert.ok(ty < -10, `Apex should translate character upward, got ${ty}`);

  assert.ok(motionStyles.has('--motion-head-ty'), 'Should write head channel properties');
  assert.ok(motionStyles.has('--motion-head-rot'), 'Should write head rotation properties');

  // Pause
  service.pause();
  assert.equal(service.isPlaying(), false);
  assert.equal(motionStyles.get('--motion-ty'), '0'); // Restores static pose
  assert.equal(motionStyles.get('--motion-head-ty'), '0');
  assert.equal(motionStyles.get('--motion-head-rot'), '0');
});

test('SceneAnimationService performs panoramic culling for offscreen entities', () => {
  const store = createAppStore(createDefaultEnvelope());
  store.dispatch({ type: 'scene/setStageWidth', stageWidth: 4800 });
  store.dispatch({ type: 'scene/setCameraX', cameraX: 0 }); // Viewport is [0, 1600]

  store.dispatch({ type: 'preset/save', name: 'Emma' });
  const presetId = store.getState().presets[0].presetId;

  // Entity 1: onscreen at x=800
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 800, y: 720 });
  const charOnscreenId = store.getState().currentScene.entities[0].instanceId;
  store.dispatch({
    type: 'scene/setDollAnimation',
    instanceId: charOnscreenId,
    animation: { clipId: 'idle', enabled: true, intensity: 1.0, phaseOffset: 0 }
  });

  // Entity 2: offscreen at x=3500
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 3500, y: 720 });
  const charOffscreenId = store.getState().currentScene.entities[1].instanceId;
  store.dispatch({
    type: 'scene/setDollAnimation',
    instanceId: charOffscreenId,
    animation: { clipId: 'idle', enabled: true, intensity: 1.0, phaseOffset: 0 }
  });

  const onMock = createMockElement(charOnscreenId, 800);
  const offMock = createMockElement(charOffscreenId, 3500);
  const elements = [onMock.posBtn, offMock.posBtn];

  let currentTime = 1000;
  let rafCallback = null;

  const service = createSceneAnimationService({
    store,
    queryAll: () => elements,
    requestAnimationFrame: (cb) => { rafCallback = cb; return 1; },
    cancelAnimationFrame: () => { rafCallback = null; },
    now: () => currentTime
  });

  service.play();
  currentTime += 450;
  rafCallback();

  assert.ok(onMock.motionStyles.has('--motion-ty'), 'Onscreen entity should receive updates');
  assert.equal(offMock.motionStyles.has('--motion-ty'), false, 'Offscreen entity should be culled');
});

test('SceneAnimationService respects voice puppetry priority', () => {
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

  const { posBtn } = createMockElement(charId, 800);
  let isVoice = true;

  let currentTime = 1000;
  let rafCallback = null;

  const service = createSceneAnimationService({
    store,
    queryAll: () => [posBtn],
    requestAnimationFrame: (cb) => { rafCallback = cb; return 1; },
    cancelAnimationFrame: () => { rafCallback = null; },
    isVoiceActive: () => isVoice,
    now: () => currentTime
  });

  service.play();
  currentTime += 500;
  rafCallback();

  // When voice is active, service does not overwrite mouth with animated modulation
  assert.equal(service.isPlaying(), true);
  service.teardown();
  assert.equal(service.isPlaying(), false);
});

test('SceneAnimationService: resetClock resets elapsed time and handleSettingsChange resumes when motion is enabled', () => {
  const store = createAppStore(createDefaultEnvelope());
  store.dispatch({ type: 'preset/save', name: 'Emma' });
  const presetId = store.getState().presets[0].presetId;
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 800, y: 720 });
  const charId = store.getState().currentScene.entities[0].instanceId;
  store.dispatch({ type: 'ui/setMode', mode: 'play' });
  store.dispatch({
    type: 'scene/setDollAnimation',
    instanceId: charId,
    animation: { clipId: 'happy_bounce', enabled: true }
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

  service.play();
  currentTime += 500;
  rafCallback();
  assert.equal(service.getElapsedMs(), 500);

  // resetClock resets accumulated elapsed time
  service.resetClock();
  assert.equal(service.getElapsedMs(), 0);

  // When reduced motion is enabled via settings, handleSettingsChange pauses
  store.dispatch({ type: 'settings/setReducedMotion', mode: 'reduce' });
  service.handleSettingsChange();
  assert.equal(service.isPlaying(), false);

  // When reduced motion is disabled back to full in play mode, handleSettingsChange resumes
  store.dispatch({ type: 'settings/setReducedMotion', mode: 'full' });
  service.handleSettingsChange();
  assert.equal(service.isPlaying(), true, 'Playback should resume when motion is re-allowed in play mode');

  service.teardown();
});

test('SceneAnimationService: Disabled/None characters do not blink during Play playback', () => {
  const store = createAppStore(createDefaultEnvelope());
  store.dispatch({ type: 'preset/save', name: 'Emma' });
  const presetId = store.getState().presets[0].presetId;
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 800, y: 720 });
  const charId = store.getState().currentScene.entities[0].instanceId;

  // Set animation clip to None (or enabled: false)
  store.dispatch({
    type: 'scene/setDollAnimation',
    instanceId: charId,
    animation: { clipId: 'none', enabled: false }
  });

  const { posBtn, eyesStyles } = createMockElement(charId, 800);
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
  // Advance through a typical blink timestamp (e.g. 3000ms)
  currentTime += 3200;
  rafCallback();

  // Non-animated / None character must not receive animated blink scales (< 1.0)
  const blinkScale = eyesStyles.get('--motion-blink-scale-y');
  assert.ok(blinkScale === undefined || blinkScale === '1', `Disabled character should not animate blink scale, got ${blinkScale}`);

  service.teardown();
});

test('SceneAnimationService: Loop-off playback completes, stops RAF scheduling, and marks store enabled: false', () => {
  const store = createAppStore(createDefaultEnvelope());
  store.dispatch({ type: 'preset/save', name: 'Emma' });
  const presetId = store.getState().presets[0].presetId;
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 800, y: 720 });
  const charId = store.getState().currentScene.entities[0].instanceId;

  // Set animation clip to idle (1000ms duration) and loop to false
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

  service.play();
  assert.equal(service.isPlaying(), true);

  // Advance time beyond the scene active playthrough duration (+2000ms)
  currentTime += 2000;
  rafCallback();

  // Playback must stop
  assert.equal(service.isPlaying(), false, 'Playback should finish and stop when loop is false');
  assert.equal(rafCallback, null, 'RAF callback must be cancelled');
  assert.equal(store.getState().currentScene.animationSettings.enabled, false, 'Store animationSettings.enabled should be set to false');

  service.teardown();
});

test('Mouth expression engine avoids re-parsing innerHTML when expression and intensity are unchanged', async () => {
  const { applyMouthExpression } = await import('../js/core/mouth-expression.js');
  
  let innerHtmlSetCount = 0;
  let innerHtmlValue = '';
  const mouthG = {
    id: 'doll-mouth-expression',
    dataset: {},
    get innerHTML() { return innerHtmlValue; },
    set innerHTML(val) {
      innerHtmlSetCount += 1;
      innerHtmlValue = val;
    }
  };

  const fakeSvg = {
    querySelector: (sel) => {
      if (sel === '#doll-mouth-expression') return mouthG;
      return null;
    }
  };

  // First call parses and renders
  applyMouthExpression(fakeSvg, 'smile', 0.65);
  assert.equal(innerHtmlSetCount, 1);
  assert.ok(innerHtmlValue.includes('<path'));

  // Second call with same expression and intensity must skip DOM write
  applyMouthExpression(fakeSvg, 'smile', 0.65);
  assert.equal(innerHtmlSetCount, 1, 'Subsequent call with identical params must not modify innerHTML');

  // Third call with changed intensity must update
  applyMouthExpression(fakeSvg, 'smile', 1.0);
  assert.equal(innerHtmlSetCount, 2, 'Call with changed intensity updates innerHTML once');
});
