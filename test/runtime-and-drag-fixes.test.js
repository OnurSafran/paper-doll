import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultEnvelope } from '../js/core/state-schema.js';
import { createAppStore } from '../js/core/app-store.js';
import { createDesignerView } from '../js/features/designer/designer-view.js';
import { createPlayView } from '../js/features/play/play-view.js';

function createMockElement(tagName = 'div') {
  const el = {
    tagName,
    dataset: {},
    style: {
      setProperty: () => {},
      removeProperty: () => {}
    },
    classList: {
      add: () => {},
      remove: () => {},
      toggle: () => {},
      contains: () => false
    },
    children: [],
    childNodes: [],
    append: (...nodes) => { el.children.push(...nodes); },
    appendChild: (node) => { el.children.push(node); return node; },
    replaceChildren: (...nodes) => { el.children = [...nodes]; },
    removeChild: () => {},
    remove: () => {},
    setAttribute: (k, v) => { el.dataset[k] = v; },
    removeAttribute: () => {},
    getAttribute: () => null,
    addEventListener: (type, fn) => {
      el._listeners = el._listeners || {};
      el._listeners[type] = el._listeners[type] || [];
      el._listeners[type].push(fn);
    },
    removeEventListener: () => {},
    querySelector: () => createMockElement(),
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
    focus: () => {},
    matches: () => false,
    closest: () => el
  };
  return el;
}

function setupMockDom() {
  globalThis.Option = function (text, val, defaultSel, sel) {
    return { text, value: val, defaultSelected: defaultSel, selected: sel };
  };
  globalThis.window = globalThis;
  globalThis.document = {
    createElement: (tag) => createMockElement(tag),
    createElementNS: (ns, tag) => createMockElement(tag),
    createDocumentFragment: () => createMockElement('fragment'),
    querySelector: () => createMockElement(),
    querySelectorAll: () => [createMockElement()],
    getElementById: () => createMockElement(),
    body: createMockElement('body'),
    activeElement: null
  };
  globalThis.location = { hash: '' };
  globalThis.CSS = { escape: (s) => s };
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}

test('Designer view + Paint item button invokes openPaintStudio without ReferenceError', async () => {
  setupMockDom();
  const store = createAppStore(createDefaultEnvelope());
  const elements = {};
  const $ = (sel) => {
    if (!elements[sel]) elements[sel] = createMockElement(sel);
    return elements[sel];
  };
  const $$ = (sel) => [$(sel)];

  let paintOptions = null;
  const designerView = createDesignerView({
    store,
    $,
    $$,
    askConfirm: async () => true,
    miniButton: () => createMockElement(),
    customArtRepo: {},
    openPaintStudio: (opts) => { paintOptions = opts; }
  });

  await designerView.render();
  const wardrobeItems = elements['#wardrobe-items']?.children || [];
  const paintBtn = wardrobeItems.find((c) => c.className?.includes('paint-item-action-card'));
  assert.ok(paintBtn, 'Paint button exists in wardrobe');

  // Trigger click on paint button
  assert.doesNotThrow(() => {
    paintBtn._listeners?.click?.[0]?.({});
  });
  assert.deepEqual(paintOptions, {
    itemType: 'wearable',
    slot: 'top',
    originContext: 'designer'
  });
});

test('Play view + Paint Prop button invokes openPaintStudio without ReferenceError', async () => {
  setupMockDom();
  const store = createAppStore(createDefaultEnvelope());
  const elements = {};
  const $ = (sel) => {
    if (!elements[sel]) elements[sel] = createMockElement(sel);
    return elements[sel];
  };
  const $$ = (sel) => [$(sel)];

  let paintOptions = null;
  const playView = createPlayView({
    store,
    $,
    $$,
    renderDollInto: async () => {},
    askConfirm: async () => true,
    openSceneOutlineDialog: () => {},
    customArtRepo: {},
    openPaintStudio: (opts) => { paintOptions = opts; }
  });

  await playView.render();
  // Switch to props tab
  const tabs = elements['#spawn-tabs']?.children || [];
  const propsTab = tabs.find((t) => t.textContent === 'Props');
  propsTab?._listeners?.click?.[0]?.({});

  const spawnItems = elements['#spawn-items']?.children || [];
  const paintPropCard = spawnItems.find((c) => c.className?.includes('paint-prop-action-card'));
  assert.ok(paintPropCard, 'Paint Prop card exists in spawn tray');

  assert.doesNotThrow(() => {
    paintPropCard._listeners?.click?.[0]?.({});
  });
  assert.deepEqual(paintOptions, {
    itemType: 'prop',
    originContext: 'play'
  });
});

test('Spawning a prop when a doll is selected does NOT silently attach the prop to the doll', () => {
  const envelope = createDefaultEnvelope();
  const store = createAppStore(envelope, {
    getAsset: (id) => (id === 'bg_bedroom' ? { id, kind: 'background' } : { id, kind: 'prop', displayWidth: 100, displayHeight: 100 })
  });
  store.dispatch({ type: 'scene/new' });
  store.dispatch({ type: 'preset/save', name: 'Emma' });
  const presetId = store.getState().presets[0].presetId;

  // Spawn doll and select it
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 800, y: 700 });
  const dollId = store.getState().currentScene.entities[0].instanceId;
  store.dispatch({ type: 'ui/selectEntity', instanceId: dollId });
  assert.equal(store.getState().ui.selectedEntityId, dollId);

  // Spawn a prop without explicit targetEntityId (e.g. from Paint Studio or spawner tray)
  store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_table' });

  const scene = store.getState().currentScene;
  const prop = scene.entities.find((e) => e.kind === 'prop');
  assert.ok(prop, 'Prop spawned');
  assert.equal(prop.attachedTo, null, 'Prop should NOT be attached to selected doll');
  assert.equal(prop.attachOffset, null, 'Prop should have no attach offset');
});

test('Spawning a prop with explicit targetEntityId correctly attaches to target', () => {
  const envelope = createDefaultEnvelope();
  const store = createAppStore(envelope, {
    getAsset: (id) => (id === 'bg_bedroom' ? { id, kind: 'background' } : { id, kind: 'prop', displayWidth: 100, displayHeight: 100 })
  });
  store.dispatch({ type: 'scene/new' });
  store.dispatch({ type: 'preset/save', name: 'Emma' });
  const presetId = store.getState().presets[0].presetId;

  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 800, y: 700 });
  const dollId = store.getState().currentScene.entities[0].instanceId;

  // Spawn with explicit targetEntityId (e.g. dropped onto doll)
  store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_table', x: 820, y: 680, targetEntityId: dollId });

  const scene = store.getState().currentScene;
  const prop = scene.entities.find((e) => e.kind === 'prop');
  assert.ok(prop, 'Prop spawned');
  assert.equal(prop.attachedTo, dollId, 'Prop attached to specified target');
  assert.deepEqual(prop.attachOffset, { dx: 20, dy: -20 });
});
