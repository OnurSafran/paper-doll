import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrayPointerDrag } from '../js/features/play/tray-pointer-drag.js';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function harness(tc, { overStage = true, ghostShown = true } = {}) {
  const saved = ['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'navigator'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]);
  tc.after(() => { for (const [k, d] of saved) d ? Object.defineProperty(globalThis, k, d) : delete globalThis[k]; });

  const listeners = new Map();
  const counts = () => [...listeners.values()].reduce((n, set) => n + set.size, 0);
  const target = (map) => ({
    addEventListener: (type, fn) => { if (!map.has(type)) map.set(type, new Set()); map.get(type).add(fn); },
    removeEventListener: (type, fn) => map.get(type)?.delete(fn)
  });
  const fire = (map, type, event) => { for (const fn of [...(map.get(type) ?? [])]) fn(event); };

  const win = { ...target(listeners), innerHeight: 800, innerWidth: 400 };
  const classes = new Set();
  const bodyKids = [];
  const scroller = { scrollTop: 0, scrollHeight: 2400, clientHeight: 800, parentElement: null };
  const stage = {
    classes: new Set(), parentElement: scroller,
    classList: { toggle(c, on) { on ? stage.classes.add(c) : stage.classes.delete(c); }, remove(c) { stage.classes.delete(c); } },
    closest: () => null
  };
  const docListeners = new Map();
  const state = { overStage };
  globalThis.window = win;
  globalThis.document = {
    ...target(docListeners),
    body: {
      classList: { add: c => classes.add(c), remove: c => classes.delete(c) },
      append: (n) => bodyKids.push(n)
    },
    createElement: () => ({
      className: '', hidden: false, style: {}, children: [],
      setAttribute() {}, replaceChildren(...kids) { this.children = kids; },
      remove() { const i = bodyKids.indexOf(this); if (i >= 0) bodyKids.splice(i, 1); }
    }),
    elementFromPoint: () => state.overStage ? stage : { closest: () => null },
    scrollingElement: scroller
  };
  Object.defineProperty(globalThis, 'getComputedStyle', { value: () => ({ overflowY: 'auto' }), configurable: true, writable: true });
  Object.defineProperty(globalThis, 'navigator', { value: { vibrate() {} }, configurable: true, writable: true });
  const frames = [];
  globalThis.requestAnimationFrame = (fn) => frames.push(fn);
  globalThis.cancelAnimationFrame = () => {};

  const log = [];
  const calls = () => log.filter(e => e[0] !== 'end');
  const preview = {
    begin: (id) => { log.push(['begin', id]); return true; },
    over: (p) => log.push(['over', p.clientX, p.clientY]),
    leave: () => log.push(['leave']),
    drop: (p) => log.push(['drop', p.clientX, p.clientY]),
    end: () => log.push(['end']),
    ghostShown: () => ghostShown
  };
  const cardListeners = new Map();
  const card = {
    ...target(cardListeners),
    classList: { add: c => classes.add(`card:${c}`), remove: c => classes.delete(`card:${c}`) },
    querySelector: () => ({ cloneNode: () => ({ cloned: true }) }),
    setPointerCapture() {}, releasePointerCapture() {}
  };
  const pointer = createTrayPointerDrag({ $: s => s === '#play-stage' ? stage : null, preview });
  pointer.attach(card, 'prop_cat');
  const down = (type, x, y, extra = {}) => fire(cardListeners, 'pointerdown', { isPrimary: true, pointerId: 1, pointerType: type, button: 0, clientX: x, clientY: y, ...extra });
  const winEvent = (type, x, y, extra = {}) => fire(listeners, type, { pointerId: 1, clientX: x, clientY: y, ...extra });
  const click = () => { const e = { stopped: false, preventDefault() {}, stopImmediatePropagation() { this.stopped = true; } }; fire(cardListeners, 'click', e); return e.stopped; };
  return { pointer, log, calls, classes, bodyKids, down, winEvent, click, counts, stage, scroller, frames, win, state };
}

test('Mouse: dragging past the slop picks the piece up, floats it off the stage and drops on release', (tc) => {
  const h = harness(tc, { overStage: false });
  h.down('mouse', 100, 700);
  h.winEvent('pointermove', 102, 701);
  assert.deepEqual(h.calls(), [], 'a click-sized wobble is not a drag');
  h.winEvent('pointermove', 140, 650);
  assert.deepEqual(h.calls()[0], ['begin', 'prop_cat']);
  assert.equal(h.bodyKids.length, 1, 'a floating copy follows the pointer');
  assert.equal(h.bodyKids[0].hidden, false, 'visible while off the stage');
  assert.ok(h.classes.has('is-tray-dragging'));
  h.state.overStage = true;
  h.winEvent('pointermove', 400, 300);
  assert.equal(h.bodyKids[0].hidden, true, 'the real ghost replaces the copy on the stage');
  h.winEvent('pointerup', 400, 300);
  assert.deepEqual(h.log.filter(e => e[0] === 'drop'), [['drop', 400, 300]]);
  assert.equal(h.bodyKids.length, 0);
  assert.equal(h.classes.has('is-tray-dragging'), false);
  assert.equal(h.click(), true, 'the click after a drag must not also add the prop');
  assert.equal(h.counts(), 0, 'no listeners linger');
});

test('Touch: a press picks the piece up above the finger; swiping first leaves the tray to scroll', async (tc) => {
  const h = harness(tc);
  h.down('touch', 200, 600);
  h.winEvent('pointermove', 200, 640);
  await wait(260);
  assert.deepEqual(h.calls(), [], 'moving before the hold means scrolling, not carrying');
  assert.equal(h.counts(), 0);

  h.down('touch', 200, 600);
  await wait(260);
  assert.deepEqual(h.calls()[0], ['begin', 'prop_cat']);
  assert.deepEqual(h.log.at(-1), ['over', 200, 536], 'judged 64px above the finger so the hand does not hide it');
  h.winEvent('pointerup', 200, 600);
  assert.deepEqual(h.log.filter(e => e[0] === 'drop'), [['drop', 200, 536]]);
});

test('Touch: a quick tap is left to the click handler', async (tc) => {
  const h = harness(tc);
  h.down('touch', 50, 50);
  h.winEvent('pointerup', 50, 50);
  await wait(260);
  assert.deepEqual(h.calls(), []);
  assert.equal(h.click(), false);
});

test('Releasing off the stage drops nothing and still ends cleanly', async (tc) => {
  const h = harness(tc, { overStage: false });
  h.down('touch', 200, 700);
  await wait(260);
  h.winEvent('pointerup', 200, 700);
  assert.equal(h.log.some(e => e[0] === 'drop'), false);
  assert.deepEqual(h.log.at(-1), ['end']);
  assert.equal(h.click(), true, 'a held-then-released piece never adds itself');
});

test('Every exit tears everything down: cancel, Escape, blur, hidden tab', async (tc) => {
  for (const exit of ['pointercancel', 'escape', 'blur', 'hidden']) {
    const h = harness(tc);
    h.down('mouse', 10, 10);
    h.winEvent('pointermove', 80, 80);
    assert.equal(h.bodyKids.length, 1, exit);
    if (exit === 'pointercancel') h.winEvent('pointercancel', 80, 80);
    if (exit === 'escape') h.winEvent('keydown', 0, 0, { key: 'Escape' });
    if (exit === 'blur') h.winEvent('blur', 0, 0);
    if (exit === 'hidden') h.pointer.cancel();
    assert.equal(h.bodyKids.length, 0, `${exit}: floater removed`);
    assert.equal(h.classes.size, 0, `${exit}: no classes left on body or card`);
    assert.equal(h.log.some(e => e[0] === 'drop'), false, exit);
    assert.deepEqual(h.log.at(-1), ['end'], exit);
    assert.equal(h.counts(), 0, `${exit}: no listeners left`);
  }
});

test('Holding near the bottom edge scrolls the page so the stage can be reached', async (tc) => {
  const h = harness(tc);
  h.down('touch', 200, 790);
  await wait(260);
  assert.equal(h.scroller.scrollTop, 0);
  h.frames.shift()();
  assert.ok(h.scroller.scrollTop > 10, 'scrolled down');
  h.win.innerHeight = 800;
  h.winEvent('pointermove', 200, 10);
  const before = h.scroller.scrollTop;
  h.frames.shift()();
  assert.ok(h.scroller.scrollTop < before, 'and up near the top edge');
  h.winEvent('pointerup', 200, 10);
});
