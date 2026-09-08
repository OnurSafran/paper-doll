import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldMapView } from '../js/features/world-map/world-map-view.js';
import { WORLD_MAP_LANDMARKS } from '../js/domain/world-map-catalog.js';

// Small DOM fixture for exercising the controller's public UI event handlers.
function setup(t, { width = 600, height = 450, renderDollInto } = {}) {
  const frames = new Map();
  let nextFrame = 0;
  class Element {
    constructor() {
      this.dataset = {};
      // Custom properties are read back through `style.getPropertyValue`, the
      // same way the real CSSStyleDeclaration exposes them.
      const customProps = new Map();
      this.style = {
        setProperty: (name, value) => customProps.set(name, String(value)),
        getPropertyValue: (name) => customProps.get(name) ?? '',
        removeProperty: (name) => customProps.delete(name)
      };
      this.attrs = {};
      this.childNodes = [];
      this.listeners = {};
      this.classes = new Set();
      this.classList = {
        add: (...names) => names.forEach((name) => this.classes.add(name)),
        remove: (...names) => names.forEach((name) => this.classes.delete(name)),
        contains: (name) => this.classes.has(name),
        toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name)
      };
    }
    setAttribute(name, value) { this.attrs[name] = value; }
    removeAttribute(name) { delete this.attrs[name]; }
    replaceChildren(...nodes) { this.childNodes = nodes; }
    appendChild(node) { this.childNodes.push(node); }
    getBoundingClientRect() { return { width: 100, left: 0 }; }
    querySelector(selector) { return this.parts?.[selector] || null; }
    querySelectorAll() { return this.childNodes; }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    emit(name, event = {}) {
      for (const fn of this.listeners[name] || []) fn(event);
      this[`on${name}`]?.(event);
    }
    focus() { this.emit('focus'); }
    showModal() { this.open = true; }
    close() { this.open = false; this.emit('close'); }
  }
  const timers = new Map();
  let nextTimer = 0;
  t.mock.method(globalThis, 'setTimeout', (fn) => { timers.set(++nextTimer, fn); return nextTimer; });
  const windowListeners = {};
  const mockWindow = {
    listeners: windowListeners,
    addEventListener(name, fn) { (windowListeners[name] ||= []).push(fn); },
    removeEventListener(name, fn) {
      if (windowListeners[name]) {
        windowListeners[name] = windowListeners[name].filter((f) => f !== fn);
      }
    },
    matchMedia: () => ({ matches: false })
  };
  const globals = { document: { createElement: () => new Element() },
    window: mockWindow,
    requestAnimationFrame: (fn) => { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame: (id) => frames.delete(id) };
  for (const [key, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => original ? Object.defineProperty(globalThis, key, original) : delete globalThis[key]);
  }
  const nodes = new Map();
  const add = (selector) => { const el = new Element(); nodes.set(selector, el); return el; };
  for (const id of ['world-map-dialog', 'open-world-map-btn', 'world-map-camera',
    'world-map-minimap', 'world-map-minimap-dots', 'world-map-minimap-window',
    'world-map-pan-left', 'world-map-pan-right', 'world-map-zoom-toggle',
    'world-map-preview-dock', 'active-doll-marker', 'active-marker-doll-slot']) add(`#${id}`);
  const svg = add('.world-map-svg');
  Object.defineProperty(svg, 'clientWidth', { get: () => parseFloat(svg.style.width) || 1200 });
  const camera = nodes.get('#world-map-camera');
  Object.assign(camera, { clientWidth: width, clientHeight: height, scrollLeft: 0 });
  const dock = nodes.get('#world-map-preview-dock');
  dock.parts = Object.fromEntries(['.dock-title', '.dock-action-area', '.dock-thumb-container'].map((s) => [s, new Element()]));
  const landmarks = [];
  for (const lm of WORLD_MAP_LANDMARKS) {
    add(`.map-landmark-anchor[data-landmark-id="${lm.id}"]`);
    const body = add(`#landmark-${lm.id}`);
    landmarks.push(body);
    const egg = add(`#landmark-${lm.id} .easter-egg-trigger`);
    body.parts = { '.easter-egg-trigger': egg };
  }
  const state = { currentScene: { backgroundId: 'bg_bedroom', entities: [] },
    designer: { draft: { name: 'first doll' } }, settings: { stamps: [], soundEnabled: false } };
  const store = { getState: () => state, dispatch(action) {
    if (action.type === 'settings/unlockStamp') {
      if (state.settings.stamps.includes(action.stampId)) return { ok: false };
      state.settings.stamps.push(action.stampId);
    }
    if (action.type === 'scene/setBackground') state.currentScene.backgroundId = action.backgroundId;
    return { ok: true };
  } };
  const $ = (selector) => nodes.get(selector) || null;
  const view = createWorldMapView({ store, $, $$: () => landmarks, renderDollInto,
    getAsset: (id) => ({ id, name: id, path: `${id}.svg` }) });
  view.openWorldMapDialog();
  return { view, $, state, frames, camera, svg, dock, timers, Element, mockWindow };
}

const keyEvent = (key) => ({ key, preventDefault() {}, stopPropagation() {} });

test('collecting an egg synchronizes the preview and minimap, including repeat taps', (t) => {
  const { $, state } = setup(t);
  const tapCafe = () => $('#landmark-cafe .easter-egg-trigger').emit('keydown', keyEvent('Enter'));
  const selectedDot = () => $('#world-map-minimap-dots').childNodes.find((dot) => dot.classList.contains('is-selected'));
  tapCafe();
  assert.equal(selectedDot().dataset.landmarkId, 'cafe');
  $('#landmark-bedroom').emit('keydown', keyEvent('Enter'));
  tapCafe();
  assert.equal(selectedDot().dataset.landmarkId, 'cafe');
  assert.deepEqual(state.settings.stamps, ['kitten']);
});

test('locked eggs cannot be collected with the keyboard and leave the tab order', (t) => {
  const landmark = WORLD_MAP_LANDMARKS.find((lm) => lm.id === 'cafe');
  const original = landmark.unlockedByDefault;
  landmark.unlockedByDefault = false;
  t.after(() => { landmark.unlockedByDefault = original; });
  const { $, state } = setup(t);
  const egg = $('#landmark-cafe .easter-egg-trigger');
  egg.emit('keydown', keyEvent('Enter'));
  assert.deepEqual(state.settings.stamps, []);
  assert.equal(egg.attrs.tabindex, '-1');
  assert.equal(egg.attrs['aria-disabled'], 'true');
});

test('short wide cameras show the full map height without vertical cropping', (t) => {
  const { svg, camera } = setup(t, { width: 1000, height: 250 });
  assert.ok(parseFloat(svg.style.height) <= camera.clientHeight);
});

test('native dialog dismissal cancels pending camera animation', (t) => {
  const { $, frames } = setup(t);
  $('#world-map-pan-right').emit('click');
  assert.ok(frames.size > 0);
  $('#world-map-dialog').close();
  assert.equal(frames.size, 0);
});

test('touch and wheel input interrupt camera glide', (t) => {
  const { $, frames, camera } = setup(t);
  for (const [name, event] of [['wheel', {}], ['pointerdown', { pointerType: 'touch', button: 0 }]]) {
    $('#world-map-pan-right').emit('click');
    assert.ok(frames.size > 0);
    camera.emit(name, event);
    assert.equal(frames.size, 0, `${name} cancels the animation fighting native scrolling`);
  }
});

test('camera respects the explicit reduced-motion preference', (t) => {
  const { $, state, frames, camera } = setup(t);
  state.settings.reducedMotion = 'reduce';
  $('#world-map-pan-right').emit('click');
  assert.equal(frames.size, 0);
  assert.ok(camera.scrollLeft > 0);
});

test('the world lies back on a tilt and turns with the direction of the pan', (t) => {
  const { $, camera, svg } = setup(t);
  const tiltOf = (el) => parseFloat(el.style.getPropertyValue('--map-tilt'));
  const spinOf = (el) => parseFloat(el.style.getPropertyValue('--map-spin'));

  assert.ok(tiltOf(camera) > 0, 'the map opens tilted back like a chart on a table');
  assert.equal(spinOf(camera), 0, 'and at rest');

  // Scrolling right turns the world one way...
  camera.scrollLeft = 320;
  camera.emit('scroll', {});
  const rightward = spinOf(camera);
  assert.ok(rightward > 0, 'panning right spins the world right');

  // ...scrolling back turns it the other, and the parallax band follows the
  // camera rather than the raw scroll pixels.
  camera.scrollLeft = 0;
  camera.emit('scroll', {});
  assert.ok(spinOf(camera) < 0, 'panning left spins the world left');
  assert.equal(svg.style.getPropertyValue('--map-drift'), '0');
});

test('the spin is capped so a fast flick cannot roll the map over', (t) => {
  const { $, camera } = setup(t);
  camera.scrollLeft = 100000;
  camera.emit('scroll', {});
  assert.ok(Math.abs(parseFloat(camera.style.getPropertyValue('--map-spin'))) <= 7);
});

test('reduced motion keeps the map flat, still and un-parallaxed', (t) => {
  const { $, state, camera, svg } = setup(t);
  state.settings.reducedMotion = 'reduce';
  camera.scrollLeft = 480;
  camera.emit('scroll', {});
  assert.equal(camera.style.getPropertyValue('--map-tilt'), '0deg');
  assert.equal(camera.style.getPropertyValue('--map-spin'), '0deg');
  assert.equal(svg.style.getPropertyValue('--map-drift'), '0');
});

test('closing the map invalidates an unfinished doll render', async (t) => {
  let finish;
  const { $, view, state } = setup(t, { renderDollInto: async (container) => {
    await new Promise((resolve) => { finish = resolve; });
    container.replaceChildren({ name: 'old doll' });
  } });
  view.closeWorldMapDialog();
  state.designer.draft = null;
  view.openWorldMapDialog();
  finish();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual($('#active-marker-doll-slot').childNodes, []);
});

test('minimap slider supports Home and End without changing the selected destination', (t) => {
  const { $, state, camera, svg } = setup(t);
  state.settings.reducedMotion = 'reduce';
  const minimap = $('#world-map-minimap');
  minimap.emit('keydown', keyEvent('End'));
  assert.equal(camera.scrollLeft, svg.clientWidth - camera.clientWidth);
  minimap.emit('keydown', keyEvent('Home'));
  assert.equal(camera.scrollLeft, 0);
  assert.ok($('#landmark-bedroom').classList.contains('is-active-landmark'));
});

test('retriggered egg animations finish naturally instead of being cut off by an old timer', (t) => {
  const { $, timers, Element } = setup(t);
  const egg = $('#landmark-cafe .easter-egg-trigger');
  const sprite = new Element();
  egg.appendChild(sprite);
  egg.emit('keydown', keyEvent('Enter'));
  const oldCallbacks = [...timers.values()];
  egg.emit('keydown', keyEvent('Enter'));
  for (const fn of oldCallbacks) fn();
  assert.ok(sprite.classList.contains('is-triggered'), 'the second animation keeps playing');
  sprite.emit('animationend', { target: sprite });
  assert.equal(sprite.classList.contains('is-triggered'), false);
});

test('reduced motion suppresses egg movement while still awarding the stamp', (t) => {
  const { $, state, Element } = setup(t);
  state.settings.reducedMotion = 'reduce';
  const egg = $('#landmark-cafe .easter-egg-trigger');
  const sprite = new Element();
  egg.appendChild(sprite);
  egg.emit('keydown', keyEvent('Enter'));
  assert.equal(sprite.classList.contains('is-triggered'), false);
  assert.deepEqual(state.settings.stamps, ['kitten']);
});

test('renderActiveDollMarker selects character matching state.ui.selectedEntityId over first character', async (t) => {
  let renderedDraft = null;
  const renderDollInto = async (container, draft) => {
    renderedDraft = draft;
  };
  const { view, state } = setup(t, { renderDollInto });
  state.currentScene.entities = [
    { instanceId: 'char-1', kind: 'character', characterSnapshot: { name: 'Doll 1' } },
    { instanceId: 'char-2', kind: 'character', characterSnapshot: { name: 'Doll 2' } }
  ];
  state.ui = { selectedEntityId: 'char-2' };
  view.closeWorldMapDialog();
  view.openWorldMapDialog();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(renderedDraft?.name, 'Doll 2');
});

test('view.teardown() and view.destroy() remove window languagechange listener', (t) => {
  const { view, mockWindow } = setup(t);
  assert.equal(mockWindow.listeners['languagechange']?.length, 1);
  view.teardown();
  assert.equal(mockWindow.listeners['languagechange']?.length, 0);
});


test('explicit map close restores the actual opener once when the native close event arrives', (t) => {
  const { view, $, Element } = setup(t);
  view.closeWorldMapDialog();
  const opener = new Element();
  let openerFocus = 0;
  let fallbackFocus = 0;
  opener.focus = () => { openerFocus++; };
  $('#open-world-map-btn').focus = () => { fallbackFocus++; };
  document.activeElement = opener;
  document.contains = (el) => el === opener;
  const dialog = $('#world-map-dialog');
  dialog.close = () => { dialog.open = false; };
  view.openWorldMapDialog();
  view.closeWorldMapDialog();
  dialog.emit('close');
  assert.equal(openerFocus, 1);
  assert.equal(fallbackFocus, 0);
});

test('vertical wheel turns the world, normalizes line input and preserves pinch zoom', (t) => {
  const { camera } = setup(t);
  let prevented = 0;
  camera.emit('wheel', { deltaX: 0, deltaY: 3, deltaMode: 1, preventDefault() { prevented++; } });
  assert.equal(camera.scrollLeft, 48);
  assert.equal(prevented, 1);
  camera.emit('wheel', { ctrlKey: true, deltaY: 100, preventDefault() { prevented++; } });
  assert.equal(camera.scrollLeft, 48);
  assert.equal(prevented, 1);
});

test('wheel clamps at both world edges and leaves fit mode stationary', (t) => {
  const { $, camera, svg } = setup(t);
  const wheel = (deltaY) => camera.emit('wheel', { deltaY, preventDefault() {} });
  wheel(100000);
  assert.equal(camera.scrollLeft, svg.clientWidth - camera.clientWidth);
  wheel(-100000);
  assert.equal(camera.scrollLeft, 0);
  $('#world-map-zoom-toggle').emit('click');
  wheel(100);
  assert.equal(camera.scrollLeft, 0);
});

test('destinations follow the curved horizon and restore catalog positions in fit mode', (t) => {
  const { $, camera } = setup(t);
  const anchor = $('.map-landmark-anchor[data-landmark-id="cafe"]');
  const initial = anchor.attrs.transform;
  camera.scrollLeft = 200;
  camera.emit('scroll');
  assert.notEqual(anchor.attrs.transform, initial);
  $('#world-map-zoom-toggle').emit('click');
  assert.equal(anchor.attrs.transform, 'translate(450, 300) scale(1, 1)');
});
