import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultEnvelope } from '../js/core/state-schema.js';
import { createAppStore } from '../js/core/app-store.js';
import { createDesignerView } from '../js/features/designer/designer-view.js';
import { createPlayView, getContextRingFocusAction, sceneEntityRenderKey } from '../js/features/play/play-view.js';
import { createSceneOutlineView } from '../js/features/play/scene-outline-view.js';
import { createTraySpawnerView } from '../js/features/play/tray-spawner-view.js';
import { createSceneEntityView } from '../js/features/play/scene-entity-view.js';
import { getCurrentLanguage, setLanguage, t } from '../js/core/i18n.js';
import { assetsByKind, getAsset } from '../js/core/asset-catalog.js';

function createMockElement(tagName = 'div') {
  const el = {
    tagName,
    className: { baseVal: '' },
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
    prepend: (...nodes) => { el.children.unshift(...nodes); },
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

test('Play character render keys change when the language changes', () => {
  const originalLanguage = getCurrentLanguage();
  const entity = {
    kind: 'character',
    sourceId: 'preset-1',
    characterSnapshot: { baseDollId: 'doll_classic_a', slots: {} },
    expression: 'neutral'
  };

  try {
    setLanguage('tr');
    const turkishKey = sceneEntityRenderKey(entity);
    setLanguage('en');
    const englishKey = sceneEntityRenderKey(entity);
    assert.notEqual(turkishKey, englishKey);
  } finally {
    setLanguage(originalLanguage);
  }
});

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

  const trayActions = elements['#play-pack-filter']?.children || [];
  const paintPropCard = trayActions.find((c) => c.className?.includes('paint-prop-action-card'));
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

test('cached Play tray clicks use the latest camera and entity count for props, dolls and bubbles', () => {
  setupMockDom();
  const store = createAppStore(createDefaultEnvelope(), { getAsset });
  store.dispatch({ type: 'scene/new' });
  store.dispatch({ type: 'scene/setPlacementMode', placementMode: 'free' });
  store.dispatch({ type: 'scene/setStageWidth', stageWidth: 4800 });
  store.dispatch({ type: 'preset/save', name: 'Tray doll' });
  const elements = {};
  const $ = selector => elements[selector] ||= createMockElement();
  let token = 0;
  const context = {
    store, $, getAsset, getAssetsByKind: assetsByKind,
    nextSpawnPoint: (count, cameraX) => ({ x: cameraX + 650 + count * 10, y: 690 }),
    renderDollInto: async () => {},
    get playRenderToken() { return token; },
    render: () => tray.renderSpawnTray(store.getState(), ++token)
  };
  const tray = createTraySpawnerView(context);
  for (const tab of ['props', 'characters', 'bubbles']) {
    context.render();
    $('#spawn-tabs').children.find(button => button.id === `spawn-tab-${tab}`)._listeners.click[0]();
    const card = $('#spawn-items').children[0];
    store.dispatch({ type: 'scene/setCameraX', cameraX: tab === 'characters' ? 1600 : 2400 });
    for (let i = 0; i < 2; i++) {
      const scene = store.getState().currentScene;
      const expectedX = context.nextSpawnPoint(scene.entities.length, scene.cameraX).x;
      context.render();
      assert.equal($('#spawn-items').children[0], card, 'unrelated scene changes keep cached cards');
      card._listeners.click[0]();
      assert.equal(store.getState().currentScene.entities.at(-1).x, expectedX, `${tab} click ${i} uses live scene`);
    }
  }
});

test('pending Play doll thumbnails survive unrelated stage renders', async () => {
  setupMockDom();
  const store = createAppStore(createDefaultEnvelope());
  store.dispatch({ type: 'preset/save', name: 'Loading doll' });
  const elements = {};
  const $ = selector => elements[selector] ||= createMockElement();
  let finish;
  let token = 0;
  const context = {
    store, $, getAsset, getAssetsByKind: assetsByKind,
    renderDollInto: thumb => new Promise(resolve => { finish = () => { thumb.append(createMockElement('svg')); resolve(); }; }),
    get playRenderToken() { return token; },
    render: () => tray.renderSpawnTray(store.getState(), ++token)
  };
  const tray = createTraySpawnerView(context);
  context.render();
  $('#spawn-tabs').children.find(button => button.id === 'spawn-tab-characters')._listeners.click[0]();
  const thumb = $('#spawn-items').children[0].children[0];
  context.render();
  finish();
  await Promise.resolve();
  assert.equal(thumb.children.length, 1, 'cached card retains the completed artwork');
});

test('Enter on a different focused entity leaves native activation free to select it', () => {
  setupMockDom();
  const store = createAppStore(createDefaultEnvelope(), { getAsset });
  const { instanceId } = store.dispatch({ type: 'scene/spawnBubble', text: 'Selected bubble' });
  let opened = 0;
  const dialog = { showModal: () => { opened++; } };
  const input = { focus() {}, select() {} };
  const view = createPlayView({ store, $: selector => selector === '#bubble-text-dialog' ? dialog : selector === '#bubble-text-input' ? input : createMockElement(), $$: () => [], renderDollInto: async () => {} });
  let prevented = false;
  const event = focusedId => ({
    key: 'Enter', preventDefault: () => { prevented = true; },
    target: { matches: () => false, closest: selector => selector === '.scene-entity-positioner' && focusedId ? { dataset: { instanceId: focusedId } } : null }
  });
  for (const focusedId of ['another-bubble', 'another-prop']) {
    view.handleStageKeydown(event(focusedId));
    assert.equal(opened, 0);
    assert.equal(prevented, false, 'native Enter activation remains available');
  }
  view.handleStageKeydown(event(instanceId));
  assert.equal(opened, 1);
  assert.equal(prevented, true);
});

test('patching pinned props, dolls and bubbles refreshes their accessible labels', () => {
  setupMockDom();
  const store = createAppStore(createDefaultEnvelope(), { getAsset });
  const view = createSceneEntityView({ store, getAsset, sceneEntityRenderKey });
  for (const entity of [
    { kind: 'prop', sourceId: 'prop_chair' },
    { kind: 'character', sourceId: 'demo_emma', characterSnapshot: { baseDollId: 'doll_classic_a', slots: {} } },
    { kind: 'bubble', sourceId: 'bubble', text: 'Hello', bubbleStyle: 'speech', width: 240 }
  ]) {
    const full = { ...entity, instanceId: 'label-test', x: 800, y: 700, scale: 1 };
    const element = createMockElement();
    view.patchSceneEntity(element, full, false, false);
    const label = element.dataset['aria-label'];
    view.patchSceneEntity(element, { ...full, pinned: true }, false, false);
    assert.equal(element.dataset['aria-label'], `${t('play.pinned')} ${label}`);
    view.patchSceneEntity(element, full, false, false);
    assert.equal(element.dataset['aria-label'], label);
  }
});

test('Play rendering restores entity focus without stealing focus moved to another control', async () => {
  setupMockDom();
  const queued = [];
  globalThis.requestAnimationFrame = callback => { queued.push(callback); return queued.length; };
  const store = createAppStore(createDefaultEnvelope(), { getAsset });
  store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_chair', x: 800, y: 700 });
  const entity = store.getState().currentScene.entities[0];
  const elements = {};
  const $ = selector => elements[selector] ||= createMockElement();
  const original = createMockElement('button');
  original.isConnected = true;
  original.dataset = { instanceId: entity.instanceId, renderKey: sceneEntityRenderKey(entity, getAsset) };
  $('#scene-entities').children = [original];
  $('#scene-background').dataset.renderKey = `${store.getState().currentScene.backgroundId}:1600`;
  let target = original;
  let restored = 0;
  original.focus = () => { restored++; };
  $('#scene-entities').querySelectorAll = () => [target];
  const view = createPlayView({ store, $, $$: () => [], getAsset, renderDollInto: async () => {} });
  document.activeElement = original;
  await view.render();
  queued.splice(0).forEach(callback => callback());
  assert.equal(restored, 1, 'unchanged entity retains focus');
  await view.render();
  document.activeElement = createMockElement('button');
  queued.splice(0).forEach(callback => callback());
  assert.equal(restored, 1, 'a newly focused control keeps focus');
  document.activeElement = original;
  await view.render();
  original.isConnected = false;
  document.activeElement = document.body;
  target = createMockElement('button');
  target.dataset.instanceId = entity.instanceId;
  target.focus = () => { restored++; };
  queued.splice(0).forEach(callback => callback());
  assert.equal(restored, 2, 'a replaced entity regains focus lost during replacement');
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
