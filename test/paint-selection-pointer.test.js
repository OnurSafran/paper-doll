import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaintView } from '../js/features/paint/paint-view.js';

/**
 * Regression coverage for the select tool's pointer path.
 *
 * The original defect: `handlePointerDown` set `lastPointerPos` only for
 * brush/eraser/shape, while `handlePointerMove` returned early unless it was
 * set. Every marquee drag therefore committed the zero-area rectangle built at
 * pointerdown, and the tool appeared inert to pointer input while still working
 * from the keyboard.
 */

const WIDTH = 600;
const HEIGHT = 900;

function createStubContext() {
  return {
    canvas: { width: WIDTH, height: HEIGHT },
    save() {}, restore() {}, beginPath() {}, arc() {}, fill() {}, stroke() {},
    moveTo() {}, lineTo() {}, ellipse() {}, fillRect() {}, strokeRect() {},
    clearRect() {}, translate() {}, scale() {}, drawImage() {},
    getImageData: (x, y, w, h) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(Math.max(0, w) * Math.max(0, h) * 4)
    }),
    putImageData() {}
  };
}

function createStubElement(tagName = 'div') {
  const el = {
    tagName,
    width: 0,
    height: 0,
    value: '',
    checked: false,
    hidden: false,
    open: false,
    dataset: {},
    attributes: {},
    style: { setProperty() {}, removeProperty() {} },
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    children: [],
    _listeners: {},
    append(...nodes) { el.children.push(...nodes); },
    appendChild(node) { el.children.push(node); return node; },
    insertBefore(node) { el.children.unshift(node); return node; },
    replaceChildren(...nodes) { el.children = [...nodes]; },
    remove() {}, removeChild() {},
    setAttribute(key, value) { el.attributes[key] = String(value); },
    getAttribute(key) { return el.attributes[key] ?? null; },
    removeAttribute(key) { delete el.attributes[key]; },
    addEventListener(type, fn) {
      el._listeners[type] = el._listeners[type] || [];
      el._listeners[type].push(fn);
    },
    removeEventListener() {},
    dispatch(type, event) { for (const fn of el._listeners[type] || []) fn(event); },
    querySelector: () => null,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: WIDTH, height: HEIGHT, right: WIDTH, bottom: HEIGHT }),
    getContext: () => createStubContext(),
    setPointerCapture() {}, releasePointerCapture() {},
    focus() {}, select() {}, click() {}, showModal() {}, close() {},
    closest: () => null,
    matches: () => false
  };
  return el;
}

function createStubRoot() {
  const registry = new Map();
  const get = (selector) => {
    if (!registry.has(selector)) {
      const el = createStubElement(selector === '#paint-canvas' ? 'canvas' : 'div');
      if (selector === '#paint-canvas') {
        el.width = WIDTH;
        el.height = HEIGHT;
        const ctx = createStubContext();
        el.getContext = () => ctx;
      }
      registry.set(selector, el);
    }
    return registry.get(selector);
  };
  return {
    registry,
    querySelector: get,
    querySelectorAll: () => []
  };
}

function withStubDocument(run) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousRaf = globalThis.requestAnimationFrame;
  globalThis.document = {
    createElement: (tag) => createStubElement(tag),
    createElementNS: (_ns, tag) => createStubElement(tag),
    activeElement: null,
    documentElement: createStubElement('html')
  };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };
  try {
    return run();
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
    globalThis.requestAnimationFrame = previousRaf;
  }
}

function pointerEvent(x, y) {
  return { clientX: x, clientY: y, pointerId: 1, button: 0, pointerType: 'pen', preventDefault() {} };
}

test('paint select tool builds a non-zero marquee from pointer drag', () => {
  withStubDocument(() => {
    const root = createStubRoot();
    const view = createPaintView({ rootElement: root, store: { getState: () => ({ customAssets: [] }), dispatch: () => ({ ok: true }) } });
    view.resetCanvas({ itemType: 'wearable', slot: 'top' });

    const canvas = root.querySelector('#paint-canvas');
    const outline = root.querySelector('#paint-selection-outline');

    const widths = [];
    const heights = [];
    outline.style.width = '';
    Object.defineProperty(outline.style, 'width', {
      set(value) { widths.push(value); },
      get() { return widths[widths.length - 1] ?? ''; },
      configurable: true
    });
    Object.defineProperty(outline.style, 'height', {
      set(value) { heights.push(value); },
      get() { return heights[heights.length - 1] ?? ''; },
      configurable: true
    });

    // Switch to the select tool the same way the toolbar does.
    const toolbar = root.querySelector('#paint-tools-toolbar');
    toolbar.dispatch('click', { target: { closest: () => ({ dataset: { tool: 'select' } }) } });
    assert.equal(view.getSessionState().tool, 'select', 'select tool should be active');

    canvas.dispatch('pointerdown', pointerEvent(10, 20));
    canvas.dispatch('pointermove', pointerEvent(120, 200));
    canvas.dispatch('pointerup', pointerEvent(120, 200));

    const finalWidth = Number.parseFloat(widths[widths.length - 1]);
    const finalHeight = Number.parseFloat(heights[heights.length - 1]);

    assert.ok(finalWidth > 0, `marquee width should be non-zero, got "${widths[widths.length - 1]}"`);
    assert.ok(finalHeight > 0, `marquee height should be non-zero, got "${heights[heights.length - 1]}"`);
  });
});

test('paint select tool tracks pointer movement rather than freezing at pointerdown', () => {
  withStubDocument(() => {
    const root = createStubRoot();
    const view = createPaintView({ rootElement: root, store: { getState: () => ({ customAssets: [] }), dispatch: () => ({ ok: true }) } });
    view.resetCanvas({ itemType: 'wearable', slot: 'top' });

    const canvas = root.querySelector('#paint-canvas');
    const outline = root.querySelector('#paint-selection-outline');
    const observed = [];
    Object.defineProperty(outline.style, 'width', {
      set(value) { observed.push(Number.parseFloat(value)); },
      get() { return observed[observed.length - 1] ?? 0; },
      configurable: true
    });

    const toolbar = root.querySelector('#paint-tools-toolbar');
    toolbar.dispatch('click', { target: { closest: () => ({ dataset: { tool: 'select' } }) } });

    canvas.dispatch('pointerdown', pointerEvent(10, 10));
    canvas.dispatch('pointermove', pointerEvent(60, 60));
    const afterFirstMove = observed[observed.length - 1];
    canvas.dispatch('pointermove', pointerEvent(200, 200));
    const afterSecondMove = observed[observed.length - 1];
    canvas.dispatch('pointerup', pointerEvent(200, 200));

    assert.ok(afterSecondMove > afterFirstMove,
      `marquee should grow with the pointer (${afterFirstMove} -> ${afterSecondMove})`);
  });
});
