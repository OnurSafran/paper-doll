import test from 'node:test';
import assert from 'node:assert/strict';
import { PointerController } from '../js/core/pointer-controller.js';
import { createAssetRegistry } from '../js/core/asset-registry.js';
import { measureCharacterContacts } from '../js/core/character-measurement.js';
import { createBubbleSvg, measureBubble } from '../js/core/bubble-svg.js';
import { renderedCameraX } from '../js/core/coordinate-space.js';
import { createStagePointerController } from '../js/features/play/stage-pointer-controller.js';
import { sceneEntityRenderKey } from '../js/features/play/play-view.js';
import {
  createStageHitTester, entityLocalPoint, entityMaskKey, hitWithTolerance, meetBoxToUser, readPositionerGeometry
} from '../js/features/play/stage-hit-testing.js';
import { createStageHoverCursor } from '../js/features/play/stage-hover-cursor.js';
import { maskHit } from '../js/core/alpha-mask.js';
import { artworkRevision, entityArtworkRevisions } from '../js/domain/artwork-revision.js';
import { forgetCustomArtworkBottom, getCharacterContact } from '../js/domain/character-geometry.js';
import { getEntityBounds } from '../js/domain/scene-rules.js';

function pixels(width, height, alphaAt) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) data[(y * width + x) * 4 + 3] = alphaAt(x, y);
  return { width, height, data };
}

function fakePositioner(id, vars, z) {
  const visual = { style: { getPropertyValue: () => '' } };
  return {
    dataset: { instanceId: id },
    style: { zIndex: String(z), getPropertyValue: (name) => (name in vars ? String(vars[name]) : '') },
    classList: { contains: () => false },
    querySelector: (selector) => (selector === '.scene-entity-visual' ? visual : null)
  };
}

/** A registry built the way the app builds it, so descriptors have their real shape. */
const customRegistry = (sha256, extra = {}) => createAssetRegistry([
  { assetId: 'custom_prop_rev', kind: 'prop', name: 'Prop', sha256, displayWidth: 100, displayHeight: 100, ...extra },
  { assetId: 'custom_doll_rev', kind: 'wearable', slot: 'top', name: 'Doll', sha256, ...extra }
]);

// ---------------------------------------------------------------------------
// Pointer ownership

function controllerHarness(options = {}) {
  const listeners = new Map();
  const root = {
    captured: new Set(),
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: () => {},
    setPointerCapture(id) { this.captured.add(id); },
    hasPointerCapture(id) { return this.captured.has(id); },
    releasePointerCapture(id) { this.captured.delete(id); }
  };
  const log = [];
  const front = { id: 'front' };
  const behind = { id: 'behind' };
  const controller = new PointerController(root, {
    getId: (element) => element.id,
    resolveSubject: () => behind,
    onSelect: (id) => log.push(['select', id]),
    onStart: (id) => log.push(['start', id]),
    onPreview: (id, _subject, event) => log.push(['preview', id, event.clientX]),
    onCommit: (id, _subject, event) => log.push(['commit', id, event.clientX]),
    onCancel: (id) => log.push(['cancel', id]),
    ...options
  });
  const down = (extra = {}) => listeners.get('pointerdown')({ target: front, pointerId: 1, pointerType: 'touch', button: 0, isPrimary: true, clientX: 0, clientY: 0, ...extra });
  const move = (x, extra = {}) => listeners.get('pointermove')({ pointerId: 1, clientX: x, clientY: 0, preventDefault() {}, ...extra });
  const end = (type, x = 0, extra = {}) => listeners.get(type)({ type, pointerId: 1, clientX: x, clientY: 0, ...extra });
  return { controller, root, front, behind, log, down, move, end };
}

test('a touch drag that falls through to artwork behind commits when the finger lifts', () => {
  const previousFrame = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  try {
    const { controller, root, front, log, down, move, end } = controllerHarness();
    down();
    // The browser captured the pressed (transparent, foreground) button implicitly.
    // Re-targeting capture to the stage makes that button lose it; that must not end the drag.
    end('lostpointercapture', 0, { target: front });
    assert.equal(controller.session?.id, 'behind', 'implicit capture loss on the foreground target is not a cancel');
    move(20);
    end('pointerup', 24);
    assert.deepEqual(log, [['select', 'behind'], ['start', 'behind'], ['preview', 'behind', 24], ['commit', 'behind', 24]]);
    assert.equal(root.captured.size, 0, 'capture is released once the gesture ends');
    controller.destroy();
  } finally { globalThis.requestAnimationFrame = previousFrame; }
});

test('losing capture on the stage itself still cancels the drag', () => {
  const previousFrame = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  try {
    const { controller, root, log, down, move, end } = controllerHarness();
    down();
    move(20);
    end('lostpointercapture', 20, { target: root });
    assert.deepEqual(log.at(-1), ['cancel', 'behind']);
    assert.equal(controller.session, null);
    controller.destroy();
  } finally { globalThis.requestAnimationFrame = previousFrame; }
});

test('the stage takes capture on press, so a release outside it still reaches the controller', () => {
  const { controller, root, down, end } = controllerHarness();
  down({ pointerType: 'mouse' });
  assert.equal(root.captured.has(1), true, 'captured before any movement, not at the drag threshold');
  end('pointerup', 3);
  assert.equal(controller.session, null);
  assert.equal(root.captured.size, 0);
  controller.destroy();
});

test('a press after a release that never arrived starts a fresh gesture instead of being ignored', () => {
  const previousFrame = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  try {
    const { controller, log, down, move } = controllerHarness();
    down({ pointerType: 'mouse' });
    move(30);
    down({ pointerType: 'mouse' });
    assert.deepEqual(log.map(entry => entry[0]), ['select', 'start', 'cancel', 'select'], 'the stale drag is cancelled, then the new press selects');
    assert.equal(controller.session.dragging, false);
    controller.destroy();
  } finally { globalThis.requestAnimationFrame = previousFrame; }
});

test('a second pointer never disturbs the active gesture', () => {
  const { controller, log, down } = controllerHarness();
  down({ pointerType: 'touch' });
  down({ pointerType: 'touch', pointerId: 2 });
  assert.deepEqual(log, [['select', 'behind']]);
  assert.equal(controller.session.pointerId, 1);
  controller.destroy();
});

// ---------------------------------------------------------------------------
// Artwork revisions

test('registry descriptors expose their revision where artworkRevision reads it', () => {
  const registry = customRegistry('a'.repeat(64));
  assert.equal(registry.getAsset('custom_prop_rev').sha256, undefined, 'descriptors keep the digest under metadata');
  assert.equal(artworkRevision(registry.getAsset('custom_prop_rev')), 'a'.repeat(64));
  assert.equal(artworkRevision(registry.getAsset('doll_classic_a')), null, 'built-in artwork has no revision');
  assert.equal(artworkRevision({ sha256: 'flat' }), 'flat');
});

test('replacing custom artwork under the same ID changes every key that gates reuse', () => {
  const before = customRegistry('a'.repeat(64)).getAsset;
  const after = customRegistry('b'.repeat(64)).getAsset;
  const prop = { instanceId: 'p', kind: 'prop', sourceId: 'custom_prop_rev' };
  const doll = { instanceId: 'd', kind: 'character', expression: 'neutral', characterSnapshot: { baseDollId: 'doll_classic_a', slots: { top: { assetId: 'custom_doll_rev' } } } };
  for (const entity of [prop, doll]) {
    assert.notEqual(entityMaskKey(entity, before), entityMaskKey(entity, after), `${entity.kind} hit mask is rebuilt`);
    assert.notEqual(sceneEntityRenderKey(entity, before), sceneEntityRenderKey(entity, after), `${entity.kind} DOM is rebuilt`);
  }
  assert.equal(sceneEntityRenderKey(prop, before), sceneEntityRenderKey(prop, before), 'unchanged artwork keeps its element');
  assert.deepEqual(entityArtworkRevisions({ kind: 'prop', sourceId: 'prop_bicycle' }, before), [], 'built-ins contribute nothing');
});

test('the hit tester rebuilds a custom prop mask when its artwork is replaced, using real registry data', async () => {
  let registry = customRegistry('a'.repeat(64));
  let decodes = 0;
  let columns = 3;
  const tester = createStageHitTester({
    getAsset: (id) => registry.getAsset(id),
    customArtRepo: { getTrackedObjectUrl: async () => 'blob:custom' },
    rasterizeImage: async () => { decodes += 1; return pixels(10, 10, x => x < columns ? 255 : 0); }
  });
  const entity = { kind: 'prop', sourceId: 'custom_prop_rev' };
  const element = fakePositioner('custom', { '--x': 100, '--y': 100, '--entity-width': 10, '--entity-height': 10 }, 1);
  await tester.prepare(entity, element);
  assert.equal(tester.hitTest(element, { x: 101, y: 95 }), false);
  registry = customRegistry('b'.repeat(64));
  columns = 7;
  await tester.prepare(entity, element);
  assert.equal(decodes, 2, 'the replaced artwork is decoded again');
  assert.equal(tester.hitTest(element, { x: 101, y: 95 }), true);
  await tester.prepare(entity, element);
  assert.equal(decodes, 2, 'an unchanged revision reuses the mask');
});

test('a replaced custom doll is remeasured instead of keeping the previous artwork contact', async () => {
  const snapshot = { kind: 'custom_full', baseDollId: 'custom_doll_rev', slots: {} };
  const bottomRow = { value: 134 }; // the old artwork ended at row 134 of 450
  const repo = { getTrackedObjectUrl: async () => 'blob:doll' };
  const rasterizeImage = async () => pixels(300, 450, (_x, y) => y === bottomRow.value ? 255 : 0);
  const withRegistry = (registry) => ({ customArtRepo: repo, rasterizeImage, getAsset: registry.getAsset });
  const v1 = customRegistry('a'.repeat(64));
  const v2 = customRegistry('b'.repeat(64));
  try {
    await measureCharacterContacts(snapshot, withRegistry(v1));
    assert.equal(getCharacterContact(snapshot, v1.getAsset).y, 135);
    assert.equal(getEntityBounds({ instanceId: 'c', kind: 'character', scale: 1, characterSnapshot: snapshot }, v1.getAsset).contactY, 135);

    // Import replace / backup restore: same ID, new pixels.
    assert.equal(getCharacterContact(snapshot, v2.getAsset).source, 'unavailable', 'a new revision reads as unmeasured until measured');
    bottomRow.value = 314;
    await measureCharacterContacts(snapshot, withRegistry(v2));
    assert.equal(getCharacterContact(snapshot, v2.getAsset).y, 315);
    assert.equal(getEntityBounds({ instanceId: 'c', kind: 'character', scale: 1, characterSnapshot: snapshot }, v2.getAsset).contactY, 315, 'bounds follow the new contact');
  } finally { forgetCustomArtworkBottom('custom_doll_rev'); }
});

// ---------------------------------------------------------------------------
// Edge tolerance never outranks exact artwork

test('a front entity edge fringe cannot take a click from visible artwork behind it', async () => {
  const columns = { front: [0, 20], back: [0, 100] };
  const assets = Object.fromEntries(Object.keys(columns).map(id => [id, { id, kind: 'prop', viewBox: [0, 0, 100, 100], displayWidth: 100, displayHeight: 100 }]));
  const tester = createStageHitTester({
    getAsset: id => assets[id],
    loadSvg: async id => ({ id }),
    rasterize: async (sources, _rect, width, height) => {
      const [from, to] = columns[sources[0].svg.id];
      return pixels(Math.round(width), Math.round(height), x => (x / width * 100 >= from && x / width * 100 < to ? 255 : 0));
    }
  });
  const vars = { '--x': 850, '--y': 500, '--entity-width': 100, '--entity-height': 100 };
  const back = fakePositioner('back', vars, 1);
  const front = fakePositioner('front', vars, 2);
  await tester.prepare({ kind: 'prop', sourceId: 'back' }, back);
  await tester.prepare({ kind: 'prop', sourceId: 'front' }, front);
  const stage = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 900 }), querySelectorAll: () => [back, front] };
  const at = (x) => tester.resolve(stage, x, 450)?.dataset.instanceId ?? null;
  assert.equal(at(819), 'front', 'on the front artwork');
  assert.equal(at(822), 'back', 'two pixels past the front edge is the back artwork, not the front fringe');
  assert.equal(at(901), 'back', 'a near miss of the back artwork still forgives its edge');
  assert.equal(at(910), null);
  // Without exact artwork anywhere, the fringe still forgives a near miss of the front entity.
  columns.back = [50, 60];
  const sparse = createStageHitTester({ getAsset: id => assets[id], loadSvg: async id => ({ id }), rasterize: async (s, _r, w, h) => {
    const [from, to] = columns[s[0].svg.id];
    return pixels(Math.round(w), Math.round(h), x => (x / w * 100 >= from && x / w * 100 < to ? 255 : 0));
  } });
  const sparseFront = fakePositioner('front', vars, 2);
  await sparse.prepare({ kind: 'prop', sourceId: 'front' }, sparseFront);
  assert.equal(sparse.resolve({ ...stage, querySelectorAll: () => [sparseFront] }, 822, 450), sparseFront);
});

// ---------------------------------------------------------------------------
// Rendered camera

function easingStage({ rendered, stored }) {
  const world = { getBoundingClientRect: () => ({ left: -rendered, top: 0, width: 3200, height: 900 }) };
  const stage = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 900 }),
    querySelector: (selector) => (selector === '#scene-world' ? world : null)
  };
  return { stage, stored };
}

test('the rendered camera follows the world while it eases and equals the stored camera at rest', () => {
  const rect = { left: 0, top: 0, width: 1600, height: 900 };
  const { stage } = easingStage({ rendered: 250, stored: 400 });
  assert.equal(renderedCameraX(stage, 400, rect), 250, 'mid-transition');
  assert.equal(renderedCameraX(easingStage({ rendered: 399.9999, stored: 400 }).stage, 400, rect), 400, 'layout noise at rest is ignored');
  assert.equal(renderedCameraX({ getBoundingClientRect: () => rect, querySelector: () => null }, 400, rect), 400, 'no world: stored camera');
  const half = { left: 100, top: 0, width: 800, height: 450 };
  const scaled = { getBoundingClientRect: () => half, querySelector: () => ({ getBoundingClientRect: () => ({ left: 100 - 125, top: 0, width: 1600, height: 450 }) }) };
  assert.equal(renderedCameraX(scaled, 0, half), 250, 'client pixels convert to logical units at any stage size');
});

test('pointer input resolves entities and drop points through the rendered camera', () => {
  const { stage } = easingStage({ rendered: 250, stored: 400 });
  const seen = [];
  const { stagePointAt } = createStagePointerController({
    $: () => stage,
    store: { getState: () => ({ currentScene: { cameraX: 400 } }) },
    hitTester: { resolve: (_stage, x, y, cameraX) => { seen.push([x, y, cameraX]); return { dataset: { instanceId: 'visible' } }; } }
  });
  const event = { clientX: 300, clientY: 200, target: { closest: () => null, ...stage } };
  Object.assign(event.target, { closest: () => null });
  const { point, element } = stagePointAt({ ...event, target: Object.assign(stage, { closest: (selector) => (selector === '#scene-world' ? {} : null), classList: { contains: () => false } }) });
  assert.deepEqual(seen, [[300, 200, 250]], 'the hit tester maps with the camera the user sees');
  assert.equal(point.x, 300 + 250, 'drops land where the visible world is');
  assert.equal(element.dataset.instanceId, 'visible');
});

// ---------------------------------------------------------------------------
// Bubble geometry

test('a bubble occupies exactly the box it draws', () => {
  const samples = [
    ['Hello!', 'speech', 240],
    ['This is a much longer sentence with several words in it to wrap around', 'speech', 240],
    ['A B C D E F G H I J K L M N O P Q R S T U V W X Y Z A B C', 'caption', 200],
    ['Several short words that should wrap onto a few lines nicely', 'thought', 200],
    ['Boom boom boom', 'shout', 180]
  ];
  for (const [text, bubbleStyle, width] of samples) {
    const entity = { instanceId: `bubble-${bubbleStyle}-${text.length}`, kind: 'bubble', text, bubbleStyle, width, scale: 1.5 };
    const svg = createBubbleSvg(entity);
    const bounds = getEntityBounds(entity);
    assert.equal(measureBubble(entity).totalHeight, Number(svg.getAttribute('height')), `${bubbleStyle}: measurement matches the SVG`);
    assert.equal(bounds.width, Number(svg.getAttribute('width')) * 1.5);
    assert.equal(bounds.height, Number(svg.getAttribute('height')) * 1.5, `${bubbleStyle}: entity box matches the artwork`);
  }
});

test('cached bubble bounds follow edits to wrapped text of the same length', () => {
  const base = { instanceId: 'bubble-same-length', kind: 'bubble', width: 200, scale: 1 };
  const wraps = getEntityBounds({ ...base, text: 'aa bb cc dd ee ff gg hh ii jj kk' });
  const oneWord = getEntityBounds({ ...base, text: 'x'.repeat(32) });
  assert.ok(wraps.height > oneWord.height, 'same length, different wrapping, different height');
});

// ---------------------------------------------------------------------------
// Painted-bounds rejection never changes a hit result

test('rejecting outside painted bounds agrees with sampling the mask, across flips, attachment and letterboxing', async () => {
  // A small off-center blob in a wide, non-square asset: most of the box is empty.
  const asset = { id: 'blob', kind: 'prop', viewBox: [0, 0, 200, 100], displayWidth: 200, displayHeight: 100 };
  const tester = createStageHitTester({
    getAsset: () => asset, loadSvg: async () => ({}),
    rasterize: async (_s, _r, width, height) => pixels(width, height, (x, y) => Math.hypot(x / width * 200 - 150, y / height * 100 - 30) < 12 ? 255 : 0)
  });
  const tolerance = { x: 2.5, y: 2.5 };
  for (const variant of [
    {}, { flip: -1 }, { rot: 30 }, { flip: -1, rot: -45, tx: 40, ty: -15 },
    { ax: 0.2, ay: 0.7, flip: -1 }, { height: 160 }, { width: 100, height: 300, rot: 90 }
  ]) {
    const vars = {
      '--x': 800, '--y': 500, '--entity-width': variant.width ?? 200, '--entity-height': variant.height ?? 100,
      '--anchor-x': variant.ax ?? 0.5, '--anchor-y': variant.ay ?? 1,
      '--motion-attached-tx': variant.tx ?? 0, '--motion-attached-ty': variant.ty ?? 0, '--motion-attached-rot': variant.rot ?? 0
    };
    const element = fakePositioner('blob', vars, 1);
    element.querySelector('.scene-entity-visual').style.getPropertyValue = () => String(variant.flip ?? 1);
    const { mask } = await tester.prepare({ kind: 'prop', sourceId: 'blob' }, element);
    const geometry = readPositionerGeometry(element);
    let hits = 0;
    for (let y = 300; y <= 700; y += 4) {
      for (let x = 550; x <= 1050; x += 4) {
        const point = { x, y };
        const expected = hitWithTolerance(point, tolerance, (sample) => {
          const user = meetBoxToUser(entityLocalPoint(sample, geometry), geometry.width, geometry.height, mask.rect);
          return Boolean(user) && maskHit(mask, user.x, user.y);
        });
        hits += expected ? 1 : 0;
        assert.equal(tester.hitTest(element, point, tolerance), expected, `${JSON.stringify(variant)} at ${x},${y}`);
      }
    }
    assert.ok(hits > 0, `${JSON.stringify(variant)}: the blob is reachable, so the comparison is meaningful`);
  }
});

// ---------------------------------------------------------------------------
// Hover cursor

function hoverHarness({ artwork = true, hovered = { classList: { contains: () => false } } } = {}) {
  const stageEl = { dataset: {} };
  const frames = [];
  const calls = { resolve: 0, writes: 0 };
  let writes = 0;
  Object.defineProperty(stageEl.dataset, 'cursor', { configurable: true, enumerable: true, get() { return this._c; }, set(value) { this._c = value; writes += 1; } });
  const state = { artwork, hovered };
  const hover = createStageHoverCursor({
    stageEl,
    isArtworkEvent: () => state.artwork,
    resolve: () => { calls.resolve += 1; return state.hovered; },
    schedule: (callback) => frames.push(callback),
    cancel: (handle) => { frames[handle - 1] = null; }
  });
  const runFrame = () => { const callback = frames.shift(); callback?.(); };
  return { hover, stageEl, state, calls, frames, runFrame, get writes() { return writes; } };
}
const mouse = (x = 0, extra = {}) => ({ clientX: x, clientY: 0, target: {}, pointerType: 'mouse', ...extra });

test('hover resolves at most once per frame however many moves arrive', () => {
  const h = hoverHarness();
  for (let x = 0; x < 50; x += 1) h.hover.onMove(mouse(x));
  assert.equal(h.frames.length, 1, 'one frame is scheduled for all of them');
  assert.equal(h.calls.resolve, 0, 'moves alone do no hit testing');
  h.runFrame();
  assert.equal(h.calls.resolve, 1);
  assert.equal(h.stageEl.dataset.cursor, 'grab');
});

test('the stage is written only when the cursor changes', () => {
  const h = hoverHarness();
  h.hover.onMove(mouse(1)); h.runFrame();
  h.hover.onMove(mouse(2)); h.runFrame();
  h.hover.onMove(mouse(3)); h.runFrame();
  assert.equal(h.writes, 1, 'three frames over the same artwork write once');
  h.state.hovered = null;
  h.hover.onMove(mouse(4)); h.runFrame();
  assert.equal(h.stageEl.dataset.cursor, undefined, 'transparent space returns to the normal cursor');
});

test('hover ignores touch, stage UI, pinned entities and drags', () => {
  const h = hoverHarness();
  h.hover.onMove(mouse(1, { pointerType: 'touch' }));
  assert.equal(h.frames.length, 0, 'touch never schedules work');

  h.state.artwork = false;
  h.hover.onMove(mouse(2)); h.runFrame();
  assert.equal(h.calls.resolve, 0, 'stage controls are not hit tested');
  assert.equal(h.stageEl.dataset.cursor, undefined);

  h.state.artwork = true;
  h.state.hovered = { classList: { contains: (name) => name === 'is-pinned' } };
  h.hover.onMove(mouse(3)); h.runFrame();
  assert.equal(h.stageEl.dataset.cursor, undefined, 'pinned art cannot be grabbed');

  h.state.hovered = { classList: { contains: () => false } };
  h.hover.setDragging(true);
  assert.equal(h.stageEl.dataset.cursor, 'grabbing');
  const resolved = h.calls.resolve;
  h.hover.onMove(mouse(4));
  assert.equal(h.frames.length, 0, 'no hit testing while the stage owns a drag');
  h.hover.setDragging(false);
  assert.equal(h.stageEl.dataset.cursor, undefined);
  h.runFrame();
  assert.equal(h.calls.resolve, resolved + 1, 'the cursor is re-evaluated once the drag ends');
  assert.equal(h.stageEl.dataset.cursor, 'grab');
});

test('leaving the stage clears the cursor and cancels the pending frame', () => {
  const h = hoverHarness();
  h.hover.onMove(mouse(1)); h.runFrame();
  h.hover.onMove(mouse(2));
  h.hover.clear();
  assert.equal(h.stageEl.dataset.cursor, undefined);
  h.runFrame();
  assert.equal(h.calls.resolve, 1, 'the cancelled frame never resolves');
});
