import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetRegistry } from '../js/core/asset-registry.js';
import { createAppStore } from '../js/core/app-store.js';
import { createDefaultEnvelope, sanitizeScene } from '../js/core/state-schema.js';
import { addEntity, createEmptyScene, moveEntity, moveEntities, scaleEntity, flipEntity } from '../js/domain/scene-rules.js';
import { changePlacementBackground, getPlacementRegions, getPlacementTargets, placeEntity, projectLocal, usesPlacementDrag } from '../js/domain/scene-placement.js';
import { previewStageSize } from '../js/domain/stage-sizing.js';
import { getPlacementChoices } from '../js/features/play/placement-controls.js';
import { createStagePointerController } from '../js/features/play/stage-pointer-controller.js';
import { SCENE_TEMPLATES } from '../js/domain/scene-templates.js';

const getAsset = createAssetRegistry().getAsset;
const item = (scene, id) => scene.entities.find(e => e.instanceId === id);
function room(backgroundId = 'bg_bedroom', stageWidth = 3200) {
  let scene = changePlacementBackground({ ...createEmptyScene('test'), stageWidth }, backgroundId, getAsset);
  scene = addEntity(scene, { instanceId: 'table', kind: 'prop', sourceId: 'prop_table', x: 1400, y: 780 }, getAsset);
  return scene;
}
function withTea(scene) {
  return addEntity(scene, { instanceId: 'tea', kind: 'prop', sourceId: 'prop_tea_set', x: 1000, y: 800 }, getAsset);
}
const storeFor = scene => createAppStore({ ...createDefaultEnvelope(), currentScene: scene }, { getAsset });

test('Loading room templates activates authored placement and outdoor templates retain free placement', () => {
  for (const template of SCENE_TEMPLATES) {
    const store = storeFor(room());
    const before = store.getState().currentScene;
    store.dispatch({ type: 'scene/loadTemplate', templateId: template.id });
    const loaded = store.getState().currentScene;
    const profiled = getPlacementRegions(loaded, getAsset).length > 0;
    assert.equal(loaded.placementMode, profiled ? 'room' : 'free', template.id);
    if (profiled) {
      for (const character of loaded.entities.filter(e => e.kind === 'character' && !e.attachedTo)) {
        assert.equal(character.placement.kind, 'floor', template.id);
        const moved = item(placeEntity(loaded, character.instanceId, { x: character.x, y: 0 }, getAsset), character.instanceId);
        const floorTop = Math.min(...getPlacementRegions(loaded, getAsset).find(r => r.kind === 'floor').polygon.map(p => p[1]));
        assert.ok(moved.y >= floorTop, `${template.id}: character stays below the floor trim`);
        assert.equal(moved.placement.kind, 'floor');
      }
    }
    store.dispatch({ type: 'app/undo' });
    assert.deepEqual(store.getState().currentScene, before);
  }
});

test('Drag, arrow and group movement cross both panorama seams without contact gaps', () => {
  for (const backgroundId of ['bg_bedroom', 'bg_atelier', 'bg_cafe', 'fh_living_room']) {
    let scene = room(backgroundId, 4800);
    for (const x of [1532, 1580, 1600, 1620, 1668, 3180, 3200, 3220]) {
      for (const next of [placeEntity(scene, 'table', { x, y: 780 }, getAsset, { transfer: true }), moveEntity(scene, 'table', x, 780, getAsset), moveEntities(scene, [{ instanceId: 'table', x, y: 780 }], getAsset)]) {
        assert.equal(item(next, 'table').x, x, `${backgroundId}: ${x}`);
      }
    }
    scene = addEntity(scene, { instanceId: 'chair', kind: 'prop', sourceId: 'prop_chair', x: 1200, y: 780 }, getAsset);
    const next = moveEntities(scene, [{ instanceId: 'table', x: 1700, y: 780 }, { instanceId: 'chair', x: 1500, y: 780 }], getAsset);
    assert.equal(item(next, 'table').x, 1700);
    assert.equal(item(next, 'chair').x, 1500);
    assert.equal(getPlacementRegions(scene, getAsset).length, 2);
  }
});

test('Wall art can cross tiled wall joins while staying fully on the wall', () => {
  let scene = room();
  scene = addEntity(scene, { instanceId: 'picture', kind: 'prop', sourceId: 'prop_painting', x: 1400, y: 300 }, getAsset);
  assert.equal(item(moveEntity(scene, 'picture', 1600, 300, getAsset), 'picture').x, 1600);
});

test('Current saves with old floor tile IDs retain positions and normalize support references', () => {
  let scene = withTea(room('bg_bedroom', 4800));
  scene = moveEntity(scene, 'table', 3200, 780, getAsset);
  const point = projectLocal(item(scene, 'table'), { x: .5, y: .39 }, getAsset);
  scene = placeEntity(scene, 'tea', point, getAsset, { transfer: true });
  scene = { ...scene, entities: scene.entities.map(e => e.instanceId === 'table' ? { ...e, placement: { kind: 'floor', regionId: 'floor:2' } } : e) };
  const loaded = sanitizeScene(scene, getAsset);
  assert.equal(item(loaded, 'table').x, 3200);
  assert.equal(item(loaded, 'table').placement.regionId, 'floor:0');
  assert.equal(item(loaded, 'tea').attachedTo, 'table');
  const moved = moveEntity(loaded, 'table', 1600, 780, getAsset);
  for (const next of [scaleEntity(moved, 'table', 1.1, getAsset), flipEntity(moved, 'table', getAsset)]) assert.equal(item(next, 'tea').placement.kind, 'surface');
  assert.deepEqual(previewStageSize(moved, 3200, getAsset).removedIds, []);
});

test('Disconnected authored regions remain independent and reflect with their artwork', () => {
  const lookup = id => id === 'islands' ? { backgroundWidth: 1600, placementProfile: { regions: [{ id: 'island', kind: 'floor', polygon: [[100, 700], [700, 700], [700, 900], [100, 900]] }] } } : getAsset(id);
  const regions = getPlacementRegions({ backgroundId: 'islands', stageWidth: 3200 }, lookup);
  assert.equal(regions.length, 2);
  assert.equal(Math.min(...regions[1].polygon.map(p => p[0])), 2500);
  assert.equal(Math.max(...regions[1].polygon.map(p => p[0])), 3100);
});

test('Free backgrounds acquire and release tabletop support without snapping to an old floor', () => {
  let scene = withTea(room('bg_park', 1600));
  assert.equal(usesPlacementDrag(scene, item(scene, 'tea'), getAsset), true);
  const point = projectLocal(item(scene, 'table'), { x: .5, y: .39 }, getAsset);
  scene = placeEntity(scene, 'tea', point, getAsset, { transfer: true });
  assert.equal(item(scene, 'tea').placement.kind, 'surface');
  scene = placeEntity(scene, 'tea', { x: 700, y: 400 }, getAsset, { transfer: true });
  assert.equal(item(scene, 'tea').placement.kind, 'free');
  assert.equal(item(scene, 'tea').attachedTo, null);
  assert.deepEqual({ x: item(scene, 'tea').x, y: item(scene, 'tea').y }, { x: 700, y: 400 });
});

test('Tray drops use support rules, reject incompatible hosts, and commit once with undo', () => {
  for (const backgroundId of ['bg_bedroom', 'bg_park']) {
    const scene = room(backgroundId, 1600), store = storeFor(scene);
    const point = projectLocal(item(scene, 'table'), { x: .5, y: .39 }, getAsset);
    store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_tea_set', targetEntityId: 'table', transfer: true, ...point });
    const tea = store.getState().currentScene.entities.at(-1);
    assert.equal(tea.placement.kind, 'surface');
    assert.equal(tea.attachedTo, 'table');
    assert.ok(tea.placement.localPoint);
    store.dispatch({ type: 'app/undo' });
    assert.equal(store.getState().currentScene.entities.length, 1);
    store.dispatch({ type: 'app/redo' });
    assert.equal(store.getState().currentScene.entities.at(-1).attachedTo, 'table');
    store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_chair', targetEntityId: 'table', transfer: true, ...point });
    assert.equal(store.getState().currentScene.entities.at(-1).attachedTo, null);
  }
});

test('Dropping outside a tabletop falls back to the floor rather than attaching to its furniture', () => {
  const store = storeFor(room('bg_bedroom', 1600));
  store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_tea_set', targetEntityId: 'table', transfer: true, x: 1400, y: 780 });
  assert.equal(store.getState().currentScene.entities.at(-1).placement.kind, 'floor');
  assert.equal(store.getState().currentScene.entities.at(-1).attachedTo, null);
});

test('Authored furniture holds small props while excluding characters and large furniture', () => {
  for (const [hostId, childId] of [['prop_table', 'fh_cocoa'], ['prop_bookshelf', 'fh_bottle'], ['prop_bench', 'fh_books'], ['fh_storage', 'fh_reading_lamp'], ['fh_high_chair', 'fh_bottle']]) {
    let scene = changePlacementBackground(createEmptyScene('test'), 'fh_living_room', getAsset);
    scene = addEntity(scene, { instanceId: 'host', kind: 'prop', sourceId: hostId, x: 800, y: 800 }, getAsset);
    scene = addEntity(scene, { instanceId: 'child', kind: 'prop', sourceId: childId, x: 1000, y: 800 }, getAsset);
    const target = getAsset(hostId).supportSurfaces[0];
    scene = placeEntity(scene, 'child', { x: 800, y: 600 }, getAsset, { target: { kind: 'surface', hostId: 'host', surfaceId: target.id } });
    assert.equal(item(scene, 'child').attachedTo, 'host', hostId);
    assert.equal(getPlacementTargets(scene, { instanceId: 'doll', kind: 'character' }, getAsset).some(t => t.kind === 'surface'), false);
    assert.equal(getPlacementTargets(scene, { instanceId: 'chair', kind: 'prop', sourceId: 'prop_chair' }, getAsset).some(t => t.kind === 'surface'), false);
    assert.equal(item(sanitizeScene(scene, getAsset), 'child').placement.kind, 'surface');
  }
});

test('Family indoor rooms constrain contacts below their trim across the whole panorama', () => {
  for (const id of ['fh_living_room', 'fh_nursery', 'fh_shared_bedroom']) {
    const scene = room(id, 4800);
    assert.equal(scene.placementMode, 'room');
    assert.ok(item(moveEntity(scene, 'table', 3200, 10, getAsset), 'table').y > 660);
  }
});

test('Secondary placement actions omit the current logical floor, pinned items and impossible supports', () => {
  const scene = withTea(room());
  assert.equal(getPlacementChoices(scene, item(scene, 'table'), getAsset).length, 0);
  assert.equal(getPlacementChoices(scene, item(scene, 'tea'), getAsset).length, 1);
  assert.equal(getPlacementChoices(scene, { ...item(scene, 'tea'), pinned: true }, getAsset).length, 0);
});

test('Real stage pointer release acquires support on a free background; cancel preserves the scene', () => {
  const previous = { document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  const store = storeFor(withTea(room('bg_park', 1600)));
  const listeners = {};
  const nodes = new Map(store.getState().currentScene.entities.map(e => [e.instanceId, { dataset: { instanceId: e.instanceId }, style: { setProperty() {} }, classList: { add() {}, remove() {} }, closest() { return this; } }]));
  const stage = { dataset: {}, addEventListener: (type, fn) => { listeners[type] = fn; }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 900 }), querySelector: selector => nodes.get(selector.match(/data-instance-id="([^"]+)"/)?.[1]) || null };
  const svgNode = () => ({ setAttribute() {}, append() {}, remove() {} });
  globalThis.document = { createElementNS: svgNode };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  const controller = createStagePointerController({ store, getAsset, $: selector => selector === '#play-stage' ? stage : selector === '#scene-world' ? { append() {} } : null, initCameraControls() {}, stopEdgePan() {}, startEdgePan() {}, render: async () => {}, playRenderToken: 0 });
  try {
    controller.initPointerController();
    const event = (type, x, y) => ({ type, target: nodes.get('tea'), pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y, preventDefault() {} });
    const point = projectLocal(item(store.getState().currentScene, 'table'), { x: .5, y: .39 }, getAsset);
    listeners.pointerdown(event('pointerdown', 1000, 800));
    // Sparse pointer events must still preserve the initial grab offset.
    listeners.pointermove(event('pointermove', point.x, point.y));
    listeners.pointerup(event('pointerup', point.x, point.y));
    assert.equal(item(store.getState().currentScene, 'tea').placement.kind, 'surface');
    const before = store.getState().currentScene;
    listeners.pointerdown(event('pointerdown', point.x, point.y));
    listeners.pointermove(event('pointermove', point.x + 10, point.y));
    listeners.pointercancel(event('pointercancel', 700, 400));
    assert.equal(store.getState().currentScene, before);
  } finally {
    Object.assign(globalThis, previous);
  }
});
