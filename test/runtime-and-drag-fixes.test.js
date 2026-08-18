import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultEnvelope } from '../js/core/state-schema.js';
import { createAppStore } from '../js/core/app-store.js';
import { createDesignerView } from '../js/features/designer/designer-view.js';
import { createPlayView, getContextRingFocusAction } from '../js/features/play/play-view.js';
import { createSceneOutlineView } from '../js/features/play/scene-outline-view.js';
import { t } from '../js/core/i18n.js';
import { assetsByKind, getAsset } from '../js/core/asset-catalog.js';

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
    originContext: 'designer',
    baseDollId: 'doll_classic_a'
  });
});

test('Designer view does not rebuild Dollbox rows for unrelated renders', async () => {
  setupMockDom();
  const store = createAppStore(createDefaultEnvelope());
  const elements = {};
  const $ = (sel) => {
    if (!elements[sel]) elements[sel] = createMockElement(sel);
    return elements[sel];
  };
  const view = createDesignerView({ store, $, $$: () => [], askConfirm: async () => true, miniButton: () => createMockElement(), customArtRepo: {} });
  store.dispatch({ type: 'preset/save', name: 'One' });
  await view.render();
  const firstRow = elements['#dollbox-list'].children[0];
  store.dispatch({ type: 'designer/setSkin', color: 'honey' });
  await view.render();
  assert.equal(elements['#dollbox-list'].children[0], firstRow);
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
  const propsTab = tabs.find((t) => t.id === 'spawn-tab-props' || t.textContent === 'Props' || t.textContent === 'Eşyalar');
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

test('Play spawn tray lists custom props through the injected asset resolver', async () => {
  setupMockDom();
  const store = createAppStore(createDefaultEnvelope());
  const elements = {};
  const $ = (sel) => {
    if (!elements[sel]) elements[sel] = createMockElement(sel);
    return elements[sel];
  };
  const $$ = (sel) => [$(sel)];

  const customProp = {
    id: 'custom_painted_chair',
    name: 'My Painted Chair',
    kind: 'prop',
    custom: true,
    format: 'image/png',
    status: 'available',
    libraryVisible: true,
    viewBox: [0, 0, 300, 300],
    logicalWidth: 300,
    logicalHeight: 300
  };

  const playView = createPlayView({
    store,
    $,
    $$,
    renderDollInto: async () => {},
    askConfirm: async () => true,
    openSceneOutlineDialog: () => {},
    customArtRepo: {},
    openPaintStudio: () => {},
    getAsset: (id) => (id === customProp.id ? customProp : getAsset(id)),
    getAssetsByKind: (kind) => (kind === 'prop' ? [...assetsByKind(kind), customProp] : assetsByKind(kind))
  });

  await playView.render();
  const tabs = elements['#spawn-tabs']?.children || [];
  const propsTab = tabs.find((tab) => tab.id === 'spawn-tab-props');
  propsTab?._listeners?.click?.[0]?.({});
  await playView.render();

  const spawnItems = elements['#spawn-items']?.children || [];
  const customCard = spawnItems.find((card) => card.className?.includes('is-custom-spawn-item'));
  assert.ok(customCard, 'custom prop reaches the spawn tray');
  assert.ok(
    JSON.stringify(customCard).includes('My Painted Chair'),
    'custom prop card is labelled with the artwork name'
  );
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

test('Scene Outline labels each bubble style and resolves custom prop names', () => {
  setupMockDom();
  const store = createAppStore(createDefaultEnvelope());
  const elements = {};
  const $ = (sel) => {
    if (!elements[sel]) elements[sel] = createMockElement(sel);
    return elements[sel];
  };
  const getAsset = (id) => id === 'custom_prop_1' ? { id, name: 'Painted Lamp' } : undefined;
  const view = createSceneOutlineView({
    store,
    $,
    $$: () => [],
    askConfirm: async () => true,
    miniButton: () => createMockElement('button'),
    getAsset
  });

  view.renderSceneOutline({
    currentScene: {
      entities: [
        { instanceId: 'speech', kind: 'bubble', bubbleStyle: 'speech', text: 'Hi', order: 1 },
        { instanceId: 'thought', kind: 'bubble', bubbleStyle: 'thought', text: 'Hmm', order: 2 },
        { instanceId: 'shout', kind: 'bubble', bubbleStyle: 'shout', text: 'Hey', order: 3 },
        { instanceId: 'caption', kind: 'bubble', bubbleStyle: 'caption', text: 'Scene', order: 4 },
        { instanceId: 'custom-prop', kind: 'prop', sourceId: 'custom_prop_1', order: 5 }
      ]
    },
    presets: [],
    ui: {}
  });

  const rows = elements['#scene-outline-list'].children;
  assert.equal(rows.length, 5);
  const titles = rows.map((row) => row.children[2].children[0].textContent);
  assert.ok(titles.includes(`${t('play.bubbleSpeech')}: "Hi"`));
  assert.ok(titles.includes(`${t('play.bubbleThought')}: "Hmm"`));
  assert.ok(titles.includes(`${t('play.bubbleShout')}: "Hey"`));
  assert.ok(titles.includes(`${t('play.bubbleCaption')}: "Scene"`));
  assert.ok(titles.includes('Painted Lamp'));
});

test('Play restores context-ring action focus after a ring rebuild', () => {
  const activeElement = {
    dataset: { action: 'larger' },
    closest: (selector) => selector === '.context-ring' ? {} : null
  };
  assert.equal(getContextRingFocusAction(activeElement), 'larger');
  assert.equal(getContextRingFocusAction({ dataset: { action: 'larger' }, closest: () => null }), null);
});

test('Play stage shortcuts ignore browser modifiers and report pinned keyboard moves', () => {
  const store = createAppStore({
    ...createDefaultEnvelope(),
    currentScene: {
      sceneId: 'keyboard-scene',
      title: 'Keyboard',
      backgroundId: 'bg_bedroom',
      stageWidth: 1600,
      cameraX: 0,
      entities: [{
        instanceId: 'pinned-prop',
        kind: 'prop',
        sourceId: 'prop_chair',
        x: 800,
        y: 770,
        scale: 1,
        pinned: true,
        order: 1
      }]
    }
  });
  const view = createPlayView({
    store,
    $: () => createMockElement(),
    $$: () => [],
    renderDollInto: async () => {},
    askConfirm: async () => true,
    openSceneOutlineDialog: () => {},
    customArtRepo: {}
  });
  store.dispatch({ type: 'ui/selectEntity', instanceId: 'pinned-prop' });

  const event = {
    key: 'd',
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: { matches: () => false },
    preventDefault: () => { throw new Error('Ctrl+D should remain a browser shortcut'); }
  };
  assert.doesNotThrow(() => view.handleStageKeydown(event));
  assert.equal(store.getState().currentScene.entities.length, 1);

  view.handleStageKeydown({
    key: 'ArrowRight',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: { matches: () => false },
    preventDefault: () => {}
  });
  assert.equal(store.getState().currentScene.entities[0].x, 800);
  assert.equal(store.getState().ui.message, t('play.pinnedMoveBlocked'));
});
