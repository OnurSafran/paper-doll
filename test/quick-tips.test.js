import test from 'node:test';
import assert from 'node:assert/strict';
import { wireQuickTips, QUICK_TIP_KEYS } from '../js/features/quick-tips.js';
import { getCurrentLanguage, setLanguage, t } from '../js/core/i18n.js';

function setup(ctx, reducedMotion = false) {
  ctx.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const language = getCurrentLanguage();
  const win = new globalThis.EventTarget();
  const doc = new globalThis.EventTarget();
  const motion = new globalThis.EventTarget();
  motion.matches = reducedMotion;
  win.matchMedia = () => motion;
  doc.hidden = false;
  doc.documentElement = {};
  doc.querySelectorAll = () => [];
  doc.querySelector = () => null;
  const nodes = Object.fromEntries(['quick-tips', 'quick-tip-chip', 'quick-tip-text'].map((id) => {
    const node = new globalThis.EventTarget();
    const classes = new Set();
    node.classList = {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      toggle: (name, on) => on ? classes.add(name) : classes.delete(name),
      contains: (name) => classes.has(name)
    };
    node.attributes = {};
    node.setAttribute = (key, value) => { node.attributes[key] = value; };
    node.firstElementChild = {};
    node.getClientRects = () => [{}];
    node.contains = (target) => Object.values(nodes).includes(target);
    return [id, node];
  }));
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  globalThis.window = win;
  globalThis.document = doc;
  function restoreGlobals() {
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
    else delete globalThis.window;
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument);
    else delete globalThis.document;
  }
  setLanguage('en');
  let opened = 0;
  let topic;
  let state = { ui: { mode: 'play' } };
  const subscribers = new Set();
  const store = {
    getState: () => state,
    subscribe: (listener) => { subscribers.add(listener); return () => subscribers.delete(listener); }
  };
  const dispose = wireQuickTips({ $: (selector) => nodes[selector.slice(1)], store }, (value) => { opened++; topic = value; });
  ctx.after(() => { dispose(); setLanguage(language); restoreGlobals(); });
  const tick = () => { ctx.mock.timers.tick(7500); ctx.mock.timers.tick(200); };
  const setMode = (mode) => {
    state = { ui: { mode } };
    for (const listener of subscribers) listener({ state });
  };
  return { nodes, win, doc, motion, tick, opened: () => opened, topic: () => topic, setMode, dispose, subscribers };
}

test('tips rotate, open the guide, and translate immediately during a pending fade', (ctx) => {
  const { nodes, tick, opened } = setup(ctx);
  const text = nodes['quick-tip-text'];
  assert.equal(text.textContent, t(QUICK_TIP_KEYS[0]));
  tick();
  assert.equal(text.textContent, t(QUICK_TIP_KEYS[1]));
  ctx.mock.timers.tick(7500);
  assert.ok(text.classList.contains('tip-fade-out'));
  setLanguage('tr');
  assert.equal(text.textContent, t(QUICK_TIP_KEYS[1]));
  assert.equal(text.classList.contains('tip-fade-out'), false);
  ctx.mock.timers.tick(200);
  assert.equal(text.textContent, t(QUICK_TIP_KEYS[1]));
  assert.ok(nodes['quick-tip-chip'].title.includes(text.textContent));
  nodes['quick-tip-chip'].dispatchEvent(new Event('click'));
  assert.equal(opened(), 1);
});

test('hover, focus, and hidden tabs hold the current hint and rotation resumes automatically', (ctx) => {
  const { nodes, doc, tick } = setup(ctx);
  const group = nodes['quick-tips'];
  const text = nodes['quick-tip-text'];
  const first = text.textContent;
  for (const [enter, leave] of [['mouseenter', 'mouseleave'], ['focusin', 'focusout']]) {
    // Interrupt a fade too: a tip being read must stay visible.
    ctx.mock.timers.tick(7500);
    group.dispatchEvent(new Event(enter));
    tick();
    assert.equal(text.textContent, first);
    assert.equal(text.classList.contains('tip-fade-out'), false);
    group.dispatchEvent(new Event(leave));
  }
  doc.hidden = true;
  doc.dispatchEvent(new Event('visibilitychange'));
  tick();
  assert.equal(text.textContent, first);
  doc.hidden = false;
  doc.dispatchEvent(new Event('visibilitychange'));
  tick();
  assert.equal(text.textContent, t(QUICK_TIP_KEYS[1]));
});

test('reduced motion rotates automatically without a fade; hidden chips and open dialogs do not advance', (ctx) => {
  const { nodes, doc, motion, tick } = setup(ctx, true);
  const text = nodes['quick-tip-text'];
  const first = text.textContent;
  nodes['quick-tips'].getClientRects = () => [];
  tick();
  assert.equal(text.textContent, first);
  nodes['quick-tips'].getClientRects = () => [{}];
  doc.querySelector = () => ({});
  tick();
  assert.equal(text.textContent, first);
  doc.querySelector = () => null;
  tick();
  assert.equal(text.textContent, t(QUICK_TIP_KEYS[1]));
  assert.equal(text.classList.contains('tip-fade-out'), false);
  motion.matches = false;
  motion.dispatchEvent(new Event('change'));
  tick();
  assert.equal(text.textContent, t(QUICK_TIP_KEYS[2]));
});

test('all rotating tips have English and Turkish copy', () => {
  const language = getCurrentLanguage();
  try {
    for (const lang of ['en', 'tr']) {
      setLanguage(lang);
      for (const key of QUICK_TIP_KEYS) assert.ok(t(key), `${lang}: ${key}`);
    }
  } finally { setLanguage(language); }
});

test('tips follow the current studio mode, cancel old fades, and open matching persistent help', (ctx) => {
  const { nodes, tick, topic, setMode, dispose, subscribers } = setup(ctx);
  const text = nodes['quick-tip-text'];
  const click = () => nodes['quick-tip-chip'].dispatchEvent(new Event('click'));
  click();
  assert.equal(topic().target, 'guide-feature-play');
  assert.equal(topic().tab, 'features');
  tick(); tick();
  click();
  assert.equal(topic().target, 'guide-tip-layers');
  assert.equal(topic().tab, 'tips');
  ctx.mock.timers.tick(7500);
  setMode('paint');
  assert.equal(text.textContent, t('header.quickTips.undo'));
  ctx.mock.timers.tick(200);
  assert.equal(text.textContent, t('header.quickTips.undo'));
  tick();
  assert.equal(text.textContent, t('header.quickTips.paint'));
  click();
  assert.equal(topic().target, 'guide-feature-paint');
  tick();
  assert.equal(text.textContent, t('header.quickTips.undo'));
  setMode('designer');
  tick();
  assert.equal(text.textContent, t('header.quickTips.designer'));
  click();
  assert.equal(topic().target, 'guide-feature-designer');
  const current = text.textContent;
  dispose();
  assert.equal(subscribers.size, 0);
  tick();
  assert.equal(text.textContent, current);
});
