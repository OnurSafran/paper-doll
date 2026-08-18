import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultEnvelope } from '../js/core/state-schema.js';
import { createAppStore } from '../js/core/app-store.js';
import { createDesignerView } from '../js/features/designer/designer-view.js';
import { getCurrentLanguage, setLanguage } from '../js/core/i18n.js';

/**
 * The Dollbox skips re-rendering when its signature is unchanged, which keeps
 * preset previews off the hot path. The signature must still change whenever the
 * rendered output would differ:
 *
 *  - `preset/update` keeps the same id and name while replacing the whole draft,
 *    so appearance-only edits must not leave a stale card image.
 *  - the row actions are localized, so a language switch must invalidate it too.
 */

function createMockElement(tagName = 'div') {
  const el = {
    tagName,
    dataset: {},
    style: { setProperty() {}, removeProperty() {} },
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    children: [],
    childNodes: [],
    append(...nodes) { el.children.push(...nodes); },
    appendChild(node) { el.children.push(node); return node; },
    replaceChildren(...nodes) { el.children = [...nodes]; },
    removeChild() {}, remove() {},
    setAttribute(k, v) { el.dataset[k] = v; },
    getAttribute: () => null,
    removeAttribute() {},
    addEventListener(type, fn) {
      el._listeners = el._listeners || {};
      el._listeners[type] = el._listeners[type] || [];
      el._listeners[type].push(fn);
    },
    removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 450, right: 300, bottom: 450 }),
    focus() {}, matches: () => false, closest: () => null
  };
  return el;
}

function setupMockDom() {
  globalThis.window = globalThis;
  globalThis.document = {
    createElement: (tag) => createMockElement(tag),
    createElementNS: (_ns, tag) => createMockElement(tag),
    createDocumentFragment: () => createMockElement('fragment'),
    querySelector: () => createMockElement(),
    querySelectorAll: () => [],
    getElementById: () => createMockElement(),
    body: createMockElement('body'),
    activeElement: null,
    documentElement: createMockElement('html')
  };
  globalThis.location = { hash: '' };
  globalThis.CSS = { escape: (s) => s };
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}

function createHarness() {
  const store = createAppStore(createDefaultEnvelope());
  const elements = {};
  const $ = (sel) => {
    if (!elements[sel]) elements[sel] = createMockElement(sel);
    return elements[sel];
  };
  const view = createDesignerView({
    store,
    $,
    $$: (sel) => [$(sel)],
    askConfirm: async () => true,
    askPrompt: async () => null,
    miniButton: () => createMockElement('button'),
    customArtRepo: {},
    openPaintStudio: () => {}
  });
  return { store, elements, view, list: () => elements['#dollbox-list'] };
}

test('Dollbox re-renders when preset/update replaces the draft under the same name', async () => {
  setupMockDom();
  const { store, view, list } = createHarness();

  store.dispatch({ type: 'designer/equip', assetId: 'top_tee' });
  store.dispatch({ type: 'preset/save', name: 'Ayla' });
  await view.render();

  const firstRow = list().children[0];
  assert.ok(firstRow, 'a preset row should be rendered');

  // Same preset id, same name, different outfit.
  const preset = store.getState().presets[0];
  store.dispatch({ type: 'designer/equip', assetId: 'bottom_skirt' });
  store.dispatch({ type: 'preset/update', presetId: preset.presetId, name: preset.name });
  await view.render();

  const updatedPreset = store.getState().presets[0];
  assert.equal(updatedPreset.presetId, preset.presetId, 'id is unchanged');
  assert.equal(updatedPreset.name, preset.name, 'name is unchanged');
  assert.notEqual(updatedPreset.updatedAt, preset.updatedAt, 'updatedAt advances on update');

  const secondRow = list().children[0];
  assert.notEqual(secondRow, firstRow,
    'the Dollbox row must be rebuilt after preset/update, otherwise the card keeps the old artwork');
});

test('Dollbox re-renders on language change so row actions are translated', async () => {
  setupMockDom();
  const original = getCurrentLanguage();
  const { store, view, list } = createHarness();

  try {
    setLanguage('tr');
    store.dispatch({ type: 'preset/save', name: 'Ayla' });
    await view.render();
    const turkishRow = list().children[0];
    assert.ok(turkishRow, 'a preset row should be rendered');

    setLanguage('en');
    await view.render();
    const englishRow = list().children[0];

    assert.notEqual(englishRow, turkishRow,
      'the Dollbox must be rebuilt on language change, otherwise action labels stay in the previous language');
  } finally {
    setLanguage(original);
  }
});

test('Dollbox skips rebuilding when nothing relevant changed', async () => {
  setupMockDom();
  const { store, view, list } = createHarness();

  store.dispatch({ type: 'preset/save', name: 'Ayla' });
  await view.render();
  const firstRow = list().children[0];

  // A designer-only change does not touch presets, so the collection is reused.
  store.dispatch({ type: 'designer/selectSlot', slot: 'shoes' });
  await view.render();

  assert.equal(list().children[0], firstRow,
    'unrelated state changes must not rebuild every preset preview');
});
