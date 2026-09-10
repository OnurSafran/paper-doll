import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaintCanvasController } from '../js/features/paint/paint-canvas-controller.js';

/**
 * iPad input on the Paint canvas: a resting palm or a second finger must not
 * paint or hijack a stroke, two fingers pinch the 1×/2× zoom, and Apple Pencil
 * pressure scales the brush around the slider size.
 */

const WIDTH = 60;
const HEIGHT = 90;

/** A canvas whose "pixels" are one version number: every stamp bumps it, putImageData restores it. */
function createPixelContext() {
  let version = 0;
  const stamps = [];
  return {
    canvas: { width: WIDTH, height: HEIGHT },
    stamps,
    save() {}, restore() {}, beginPath() {},
    arc(x, y, radius) { stamps.push({ x, y, radius }); },
    fill() { version = Math.min(255, version + 1); },
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(version) }),
    putImageData(image) { version = image.data[0] ?? version; }
  };
}

function createHarness() {
  const ctx = createPixelContext();
  const history = [];
  const boundsSizes = [];
  const stageProps = {};
  const state = { tool: 'brush', brushSize: 10, color: '#2d261e', mirror: false, zoom: 1 };
  const context = {
    session: {
      mirrorAxisX: WIDTH / 2,
      getState: () => state,
      setZoom(zoom) { state.zoom = zoom; },
      pushHistory(snapshot) { history.push(snapshot); },
      markDirty() {},
      canUndo: () => history.length > 0,
      canRedo: () => false,
      setColor() {},
      setTool() {}
    },
    canvas: {
      width: WIDTH,
      height: HEIGHT,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: WIDTH, height: HEIGHT }),
      setPointerCapture() {},
      releasePointerCapture() {}
    },
    ctx,
    pendingHistorySnapshot: null,
    pendingHistoryRect: null,
    pointerStart: null,
    pointerMode: null,
    selectionRect: null,
    selectionPixels: null,
    undoBtn: null,
    redoBtn: null,
    colorPicker: null,
    canvasStage: { style: { setProperty(key, value) { stageProps[key] = value; } } },
    zoomBtn: { textContent: '🔍 1×' },
    backingScale: () => 1,
    updatePaletteActive() {},
    updateUIFromState() {},
    includePendingRect() {},
    pointsBounds(points, size) { boundsSizes.push(size); return null; },
    shapeBounds() { return null; },
    floodBoundsRect() { return null; },
    scheduleLivePreview() {},
    flushLivePreview() {},
    updateLivePreview() {},
    announceStatus() {},
    saveService: { scheduleDraftCheckpoint() {} }
  };
  return { controller: createPaintCanvasController(context), ctx, history, boundsSizes, stageProps, state, context };
}

const pen = (x, y, extra = {}) => ({ pointerId: 1, pointerType: 'pen', button: 0, isPrimary: true, clientX: x, clientY: y, pressure: 0.5, ...extra });
const finger = (id, x, y, isPrimary = true) => ({ pointerId: id, pointerType: 'touch', button: 0, isPrimary, clientX: x, clientY: y });

function mockClock(t) {
  let now = 10_000;
  t.mock.method(performance, 'now', () => now);
  return { advance(ms) { now += ms; } };
}

test('a palm touching down mid-stroke neither paints nor steals the Pencil stroke', (t) => {
  mockClock(t);
  const { controller, ctx, history } = createHarness();
  controller.handlePointerDown(pen(10, 10));
  controller.handlePointerDown(finger(5, 40, 40));
  controller.handlePointerMove(finger(5, 45, 45));
  controller.handlePointerUp(finger(5, 45, 45));
  controller.handlePointerMove(pen(20, 20));
  controller.handlePointerUp(pen(20, 20));

  assert.equal(history.length, 1, 'the Pencil stroke commits exactly one undo step');
  assert.ok(ctx.stamps.every((stamp) => stamp.x <= 20 && stamp.y <= 20), 'no stamp lands under the palm');
});

test('touches right after Pencil use are ignored as a resting palm, then work again', (t) => {
  const clock = mockClock(t);
  const { controller, ctx, history } = createHarness();
  controller.handlePointerDown(pen(10, 10));
  controller.handlePointerUp(pen(10, 10));
  const stampsAfterPen = ctx.stamps.length;

  clock.advance(1000);
  controller.handlePointerDown(finger(5, 40, 40));
  controller.handlePointerMove(finger(5, 50, 50));
  controller.handlePointerUp(finger(5, 50, 50));
  assert.equal(ctx.stamps.length, stampsAfterPen, 'a palm between Pencil strokes does not paint');
  assert.equal(history.length, 1);

  clock.advance(5000);
  controller.handlePointerDown(finger(6, 40, 40));
  controller.handlePointerUp(finger(6, 40, 40));
  assert.equal(history.length, 2, 'finger painting resumes once the Pencil has been idle');
});

test('a palm that lands before the Pencil is reverted when the Pencil arrives', (t) => {
  mockClock(t);
  const { controller, ctx, history } = createHarness();
  controller.handlePointerDown(finger(5, 40, 40));
  const palmVersion = ctx.getImageData(0, 0, 1, 1).data[0];
  assert.ok(palmVersion > 0, 'the palm dab painted before the Pencil came down');

  controller.handlePointerDown(pen(10, 10));
  controller.handlePointerMove(pen(20, 20));
  controller.handlePointerUp(pen(20, 20));
  controller.handlePointerUp(finger(5, 40, 40));

  assert.equal(history.length, 1, 'only the Pencil stroke is committed');
});

test('two fingers pinch the canvas zoom instead of painting', (t) => {
  mockClock(t);
  const { controller, ctx, history, stageProps, state, context } = createHarness();
  controller.handlePointerDown(finger(1, 10, 10));
  controller.handlePointerDown(finger(2, 30, 10, false));
  assert.equal(ctx.getImageData(0, 0, 1, 1).data[0], 0, "the first finger's dab is reverted");

  controller.handlePointerMove(finger(2, 60, 10, false));
  assert.equal(state.zoom, 2);
  assert.equal(stageProps['--paint-zoom'], '2');
  assert.equal(context.zoomBtn.textContent, '🔍 2×');

  controller.handlePointerMove(finger(2, 14, 10, false));
  assert.equal(state.zoom, 1);
  assert.equal(stageProps['--paint-zoom'], '1');

  controller.handlePointerUp(finger(2, 14, 10, false));
  controller.handlePointerMove(finger(1, 20, 20));
  controller.handlePointerUp(finger(1, 20, 20));
  assert.equal(history.length, 0, 'a pinch never creates an undo step');

  controller.handlePointerDown(finger(3, 40, 40));
  controller.handlePointerUp(finger(3, 40, 40));
  assert.equal(history.length, 1, 'a later single finger paints normally');
});

test('Apple Pencil pressure scales the brush around the slider size', (t) => {
  mockClock(t);
  const { controller, boundsSizes } = createHarness();
  const strokeSize = (event) => {
    controller.handlePointerDown(event);
    controller.handlePointerUp(event);
    return boundsSizes.at(-1);
  };

  assert.equal(strokeSize(pen(10, 10, { pressure: 0.5 })), 10, 'normal pressure paints at the slider size');
  assert.equal(strokeSize(pen(10, 10, { pressure: 1 })), 16, 'full pressure caps at 1.6×');
  assert.equal(strokeSize(pen(10, 10, { pressure: 0.05 })), 3, 'a feather touch floors at 0.3×');
  assert.equal(strokeSize(pen(10, 10, { pressure: 0 })), 10, 'pens without pressure keep the slider size');
  assert.equal(strokeSize({ ...pen(10, 10, { pressure: 1 }), pointerType: 'mouse' }), 10, 'mice ignore pressure');
});
