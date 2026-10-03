import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetRegistry } from '../js/core/asset-registry.js';
import { createEmptyScene, addEntity } from '../js/domain/scene-rules.js';
import { createAppStore } from '../js/core/app-store.js';
import { createDefaultEnvelope } from '../js/core/state-schema.js';
import { createStagePointerController } from '../js/features/play/stage-pointer-controller.js';

const getAsset = createAssetRegistry().getAsset;

function setup(t) {
  const previous = { requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  t.after(() => Object.assign(globalThis, previous));
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  const scene = addEntity(createEmptyScene('test'), { instanceId: 'tea', kind: 'prop', sourceId: 'prop_tea_set', x: 800, y: 780 }, getAsset);
  const store = createAppStore({ ...createDefaultEnvelope(), currentScene: scene }, { getAsset });
  store.dispatch({ type: 'ui/selectEntity', instanceId: 'tea' });
  const screen = { listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; }, removeEventListener(type) { delete this.listeners[type]; } };
  const stage = { dataset: {}, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 900 }), querySelector: () => null };
  const controller = createStagePointerController({
    store, getAsset, initCameraControls() {}, stopEdgePan() {}, startEdgePan() {}, render() {}, playRenderToken: 0,
    $: selector => selector === '#play-stage' ? stage : selector === '#play-screen' ? screen : null
  });
  controller.initPointerController();
  return { store, screen, controller };
}
/** A click target inside the named region (matched by the selectors the controller asks about). */
const inside = region => ({ closest: selector => selector.includes(region) ? {} : null });
const blank = { closest: () => null };

test('Clicking blank space beside the stage clears the selection, like a click on empty stage', (t) => {
  const { store, screen } = setup(t);
  assert.equal(store.getState().ui.selectedEntityId, 'tea');
  screen.listeners.pointerdown({ target: blank });
  assert.equal(store.getState().ui.selectedEntityId, null);
  assert.deepEqual(store.getState().ui.selectedEntityIds, []);
});

test('Header save, export, scene-menu and template controls clear the selection too', (t) => {
  for (const region of ['.scene-meta-actions', '.screen-heading', '.play-stage-column']) {
    const { store, screen } = setup(t);
    screen.listeners.pointerdown({ target: inside(region) });
    assert.equal(store.getState().ui.selectedEntityId, null, region);
  }
});

test('Tools that act on the selection keep it', (t) => {
  for (const region of ['#play-stage', '.context-ring', '.play-rail', '.play-stage-controls', '.scene-picker-group']) {
    const { store, screen } = setup(t);
    screen.listeners.pointerdown({ target: inside(region) });
    assert.equal(store.getState().ui.selectedEntityId, 'tea', region);
  }
});

test('The outside-click listener is removed on destroy', (t) => {
  const { screen, controller } = setup(t);
  assert.equal(typeof screen.listeners.pointerdown, 'function');
  controller.destroy();
  assert.equal(screen.listeners.pointerdown, undefined);
});
