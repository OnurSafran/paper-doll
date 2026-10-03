import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppStore } from '../js/core/app-store.js';
import { createDefaultEnvelope } from '../js/core/state-schema.js';
import { getAsset } from '../js/core/asset-catalog.js';
import { createEmptyScene, addEntity } from '../js/domain/scene-rules.js';
import { createStagePointerController } from '../js/features/play/stage-pointer-controller.js';
import { createCameraController } from '../js/features/play/camera-controller.js';
import { createSelectionInspectorController } from '../js/features/play/selection-inspector-controller.js';
import { createAppStateEffects } from '../js/app-state-effects.js';
import { getWheelPanDelta } from '../js/features/play/play-view.js';
import { t } from '../js/core/i18n.js';

function element() {
  const listeners = new Map();
  const classes = new Set();
  const captured = new Set();
  return {
    dataset: {}, listeners,
    style: { setProperty() {} },
    classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
    addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); },
    removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
    emit(type, event = {}) { for (const listener of [...(listeners.get(type) || [])]) listener({ type, target: this, ...event }); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 450 }),
    querySelector: () => null,
    setPointerCapture: id => captured.add(id),
    hasPointerCapture: id => captured.has(id),
    releasePointerCapture: id => captured.delete(id),
    focus() {},
    get listenerCount() { return [...listeners.values()].reduce((count, set) => count + set.size, 0); }
  };
}

function pointerFixture(testContext) {
  const previous = { request: globalThis.requestAnimationFrame, cancel: globalThis.cancelAnimationFrame };
  const frames = new Map();
  let nextFrame = 0;
  globalThis.requestAnimationFrame = callback => { frames.set(++nextFrame, callback); return nextFrame; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  testContext.after(() => { globalThis.requestAnimationFrame = previous.request; globalThis.cancelAnimationFrame = previous.cancel; });
  const stage = element();
  let scene = { ...createEmptyScene('input-test'), stageWidth: 4800, placementMode: 'free' };
  for (const [instanceId, pinned] of [['pinned', true], ['movable', false]]) {
    scene = addEntity(scene, { instanceId, pinned, kind: 'prop', sourceId: 'prop_chair', x: 500, y: 750 }, getAsset);
  }
  const store = createAppStore({ ...createDefaultEnvelope(), currentScene: scene }, { getAsset });
  const nodes = new Map(scene.entities.map(entity => {
    const node = element();
    node.dataset.instanceId = entity.instanceId;
    node.classList.add('scene-entity-positioner');
    if (entity.pinned) node.classList.add('is-pinned');
    node.closest = selector => selector === '.scene-entity-positioner' || selector === '#scene-world' ? node : null;
    return [entity.instanceId, node];
  }));
  stage.querySelector = selector => [...nodes].find(([id]) => selector.includes(`"${id}"`))?.[1] || null;
  const pans = [];
  let renders = 0;
  const context = {
    store, getAsset, $: selector => selector === '#play-stage' ? stage : null,
    initCameraControls() {}, stopEdgePan() {}, startEdgePan: direction => pans.push(direction),
    render: () => { renders++; }, playRenderToken: 0
  };
  const controller = createStagePointerController(context);
  controller.initPointerController();
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); };
  function press(id) { stage.emit('pointerdown', { target: nodes.get(id), pointerId: 1, pointerType: 'mouse', button: 0, clientX: 250, clientY: 350 }); }
  function move() { stage.emit('pointermove', { target: nodes.get('pinned'), pointerId: 1, pointerType: 'mouse', clientX: 790, clientY: 350, preventDefault() {} }); flush(); }
  return { controller, context, stage, store, nodes, pans, frames, flush, press, move, get renders() { return renders; } };
}

test('pinned drag attempts select and explain the restriction without preview, capture or edge panning', testContext => {
  const f = pointerFixture(testContext);
  const before = f.store.getState().currentScene;
  f.press('pinned');
  f.move();
  assert.equal(f.store.getState().ui.selectedEntityId, 'pinned');
  assert.equal(f.store.getState().ui.message, t('play.pinnedMoveBlocked'));
  assert.deepEqual(f.pans, []);
  assert.equal(f.context.activeDragInstanceId, undefined);
  assert.equal(f.stage.hasPointerCapture(1), false);
  f.stage.emit('pointerup', { pointerId: 1, clientX: 790, clientY: 350 });
  assert.equal(f.store.getState().currentScene, before);
});

test('a mixed selection drags only from a movable anchor and never moves pinned members', testContext => {
  const f = pointerFixture(testContext);
  f.store.dispatch({ type: 'ui/selectEntities', instanceIds: ['pinned', 'movable'] });
  f.press('pinned');
  f.move();
  assert.deepEqual(f.pans, []);
  f.press('movable');
  f.move();
  assert.equal(f.context.activeDragInstanceId, 'movable');
  assert.deepEqual(f.pans, [1]);
  f.stage.emit('pointerup', { pointerId: 1, clientX: 790, clientY: 350 });
  const entities = f.store.getState().currentScene.entities;
  assert.equal(entities.find(entity => entity.instanceId === 'pinned').x, 500);
  assert.ok(entities.find(entity => entity.instanceId === 'movable').x > 500);
});

test('stage initialization is idempotent and destroy cancels input, removes listeners and permits a fresh controller', testContext => {
  const f = pointerFixture(testContext);
  const initialListeners = f.stage.listenerCount;
  f.controller.initPointerController();
  assert.equal(f.stage.listenerCount, initialListeners);
  f.press('movable');
  f.move();
  f.controller.destroy();
  assert.equal(f.stage.listenerCount, 0);
  assert.equal(f.stage.hasPointerCapture(1), false);
  assert.equal(f.frames.size, 0);
  assert.equal(f.context.activeDragInstanceId, null);
  const renders = f.renders;
  f.stage.emit('pointerdown', { pointerId: 2, button: 0, target: f.nodes.get('movable') });
  f.stage.emit('dblclick', { target: f.nodes.get('movable') });
  assert.equal(f.renders, renders);
  f.controller.destroy();
  f.controller.initPointerController();
  assert.equal(f.stage.listenerCount, initialListeners);
  f.controller.destroy();
});

test('wheel panning accepts shifted horizontal input, normalizes units and preserves zoom and vertical scrolling', () => {
  assert.equal(getWheelPanDelta({ shiftKey: true, deltaX: 120, deltaY: 0 }), 120);
  assert.equal(getWheelPanDelta({ shiftKey: true, deltaX: 0, deltaY: -120 }), -120);
  assert.equal(getWheelPanDelta({ deltaMode: 1, deltaX: 3, deltaY: 0 }), 48);
  assert.equal(getWheelPanDelta({ deltaMode: 2, deltaX: 1, deltaY: 0 }, 800), 800);
  assert.equal(getWheelPanDelta({ ctrlKey: true, deltaX: 120, deltaY: 0 }), 0);
  assert.equal(getWheelPanDelta({ metaKey: true, shiftKey: true, deltaY: 120 }), 0);
  assert.equal(getWheelPanDelta({ deltaX: 1, deltaY: 30 }), 0);
});

test('camera wheel input pans in stage units and camera teardown removes all owned listeners', () => {
  const stage = element(), minimap = element(), width = element();
  let scene = { stageWidth: 4800, cameraX: 0 };
  let prevented = 0;
  const camera = createCameraController({
    $: selector => ({ '#play-stage': stage, '#stage-minimap': minimap, '#stage-width-select': width })[selector],
    store: { getState: () => ({ currentScene: scene }), dispatch: action => { if (action.type === 'scene/panCamera') scene = { ...scene, cameraX: scene.cameraX + action.deltaX }; } },
    getWheelPanDelta
  });
  camera.initCameraControls();
  stage.emit('wheel', { deltaX: 100, deltaY: 0, preventDefault() { prevented++; } });
  assert.equal(scene.cameraX, 200, '100 CSS pixels pan 200 units on an 800px stage');
  stage.emit('wheel', { ctrlKey: true, deltaX: 100, deltaY: 0, preventDefault() { prevented++; } });
  assert.equal(prevented, 1);
  minimap.emit('pointerdown', { pointerId: 7, button: 0, clientX: 400 });
  assert.equal(minimap.hasPointerCapture(7), true);
  camera.destroy();
  assert.equal(minimap.hasPointerCapture(7), false);
  assert.equal(stage.listenerCount + minimap.listenerCount + width.listenerCount, 0);
  camera.initCameraControls();
  stage.emit('wheel', { deltaX: 100, deltaY: 0, preventDefault() {} });
  assert.equal(scene.cameraX, 400, 'reinitialization installs exactly one wheel handler');
  camera.destroy();
});

test('inspector teardown removes tab and rail listeners and allows a new view to bind', () => {
  const tabs = element(), toggle = element();
  toggle.setAttribute = () => {};
  const state = { ui: {}, currentScene: { entities: [] } };
  const context = { $: selector => ({ '#inspector-tabs': tabs, '#scene-tray-toggle': toggle })[selector] || null, $$: () => [], store: { getState: () => state } };
  const first = createSelectionInspectorController(context);
  first.renderSelectedActions();
  first.renderSelectedActions();
  assert.equal(tabs.listenerCount + toggle.listenerCount, 2);
  first.destroy();
  first.destroy();
  assert.equal(tabs.listenerCount + toggle.listenerCount, 0);
  assert.equal(tabs.dataset.bound, undefined);
  assert.equal(toggle.dataset.bound, undefined);
  const second = createSelectionInspectorController(context);
  second.renderSelectedActions();
  assert.equal(tabs.listenerCount + toggle.listenerCount, 2);
  second.destroy();
});

test('Play messages reach the shared toast and accessible announcement path', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset });
  const before = store.getState();
  store.dispatch({ type: 'ui/message', message: t('play.pinnedMoveBlocked') });
  const shown = [];
  const effects = createAppStateEffects({
    showToast: message => shown.push(message), renderApp() {}, $: () => null,
    sceneAnimationService: { getEffectiveMotionAllowed: () => true, isPlaying: () => false }
  });
  effects.handleStoreChange({ action: { type: 'ui/message' }, previousState: before, state: store.getState(), persist: false });
  assert.deepEqual(shown, [t('play.pinnedMoveBlocked')]);
});

test('delayed transparent-artwork focus correction respects a newly focused control', async testContext => {
  const f = pointerFixture(testContext);
  const previous = globalThis.document;
  const body = element(), toolbarButton = element();
  globalThis.document = { body, activeElement: body };
  testContext.after(() => { globalThis.document = previous; });
  f.stage.closest = () => null;
  f.nodes.get('movable').isConnected = true;
  let focused = 0;
  f.nodes.get('movable').focus = () => { focused++; };
  f.context.hitTester = { resolve: () => f.nodes.get('movable') };
  f.stage.emit('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 250, clientY: 350 });
  document.activeElement = toolbarButton;
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(focused, 0);
  f.controller.destroy();
});

test('destroyed stage controllers cannot apply delayed focus to a reinitialized stage', async testContext => {
  const f = pointerFixture(testContext);
  const previous = globalThis.document;
  const body = element();
  globalThis.document = { body, activeElement: body };
  testContext.after(() => { globalThis.document = previous; });
  f.stage.closest = () => null;
  const resolved = f.nodes.get('movable');
  resolved.isConnected = true;
  let focused = 0;
  resolved.focus = () => { focused++; };
  f.context.hitTester = { resolve: () => resolved };
  f.stage.emit('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 250, clientY: 350 });
  f.controller.destroy();
  f.controller.initPointerController();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(focused, 0);
  f.controller.destroy();
});
