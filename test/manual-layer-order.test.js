import test from 'node:test';
import assert from 'node:assert/strict';
import { getAsset } from '../js/core/asset-catalog.js';
import { createAppStore } from '../js/core/app-store.js';
import { createDefaultEnvelope, sanitizeScene, cloneScene } from '../js/core/state-schema.js';
import { createEmptyScene, addEntity, reorderEntity, setEntityLayer, moveEntity } from '../js/domain/scene-rules.js';
import { setPlacementMode, placeEntity, orderedSceneEntities } from '../js/domain/scene-placement.js';

const ids = scene => orderedSceneEntities(scene, getAsset).map(entity => entity.instanceId);
function room() {
  let scene = setPlacementMode(createEmptyScene('layers'), 'room', getAsset);
  scene = addEntity(scene, { instanceId: 'table', kind: 'prop', sourceId: 'prop_table', x: 800, y: 780 }, getAsset);
  scene = addEntity(scene, { instanceId: 'tea', kind: 'prop', sourceId: 'prop_tea_set', x: 800, y: 800 }, getAsset);
  scene = placeEntity(scene, 'tea', { x: 800, y: 640 }, getAsset, { transfer: true });
  return addEntity(scene, { instanceId: 'rug', kind: 'prop', sourceId: 'prop_rug', x: 800, y: 850 }, getAsset);
}

test('front/back starts from visible room depth and preserves placement and attachments', () => {
  const scene = room();
  assert.deepEqual(ids(scene), ['rug', 'table', 'tea']);
  const front = reorderEntity(scene, 'rug', 1, getAsset);
  assert.deepEqual(ids(front), ['table', 'rug', 'tea']);
  assert.equal(front.placementMode, 'room');
  assert.equal(front.layerOrderMode, 'manual');
  for (const entity of scene.entities) {
    const reordered = front.entities.find(item => item.instanceId === entity.instanceId);
    assert.deepEqual({ ...reordered, order: entity.order }, entity);
  }
  assert.deepEqual(ids(reorderEntity(front, 'rug', -1, getAsset)), ids(scene));
  const moved = moveEntity(front, 'table', 1100, 800, getAsset);
  assert.deepEqual(ids(moved), ids(front));
  assert.equal(moved.entities.find(entity => entity.instanceId === 'tea').attachedTo, 'table');
});

test('manual layers survive save/reload and clone without changing support geometry', () => {
  const scene = reorderEntity(room(), 'tea', -1, getAsset);
  assert.deepEqual(ids(scene), ['rug', 'tea', 'table']);
  for (const restored of [sanitizeScene(JSON.parse(JSON.stringify(scene)), getAsset), cloneScene(scene)]) {
    assert.deepEqual(ids(restored), ids(scene));
    assert.equal(restored.layerOrderMode, 'manual');
    assert.equal(restored.placementMode, 'room');
    const tea = restored.entities.find(entity => entity.instanceId === 'tea');
    assert.equal(tea.attachedTo, 'table');
    assert.equal(tea.placement.kind, 'surface');
  }
});

test('front/back commits one undo entry and redo restores manual layers', () => {
  const scene = room();
  const store = createAppStore({ ...createDefaultEnvelope(), currentScene: scene }, { getAsset });
  store.dispatch({ type: 'scene/reorderEntity', instanceId: 'rug', direction: 1 });
  assert.deepEqual(ids(store.getState().currentScene), ['table', 'rug', 'tea']);
  store.dispatch({ type: 'app/undo' });
  assert.deepEqual(ids(store.getState().currentScene), ids(scene));
  assert.notEqual(store.getState().currentScene.layerOrderMode, 'manual');
  store.dispatch({ type: 'app/redo' });
  assert.deepEqual(ids(store.getState().currentScene), ['table', 'rug', 'tea']);
  assert.equal(store.getState().currentScene.layerOrderMode, 'manual');
});

test('boundary and invalid reorders leave automatic depth unchanged', () => {
  const scene = room();
  for (const [id, direction] of [['rug', -1], ['tea', 1], ['missing', 1], ['table', 0], ['table', NaN]]) {
    assert.equal(reorderEntity(scene, id, direction, getAsset), scene);
  }
});

test('a layer drop moves across multiple rows and preserves every other relative layer', () => {
  const scene = room();
  const front = setEntityLayer(scene, 'rug', 2, getAsset);
  assert.deepEqual(ids(front), ['table', 'tea', 'rug']);
  assert.equal(front.layerOrderMode, 'manual');
  assert.deepEqual(ids(setEntityLayer(front, 'rug', 0, getAsset)), ids(scene));
  for (const entity of scene.entities) {
    assert.deepEqual({ ...front.entities.find(item => item.instanceId === entity.instanceId), order: entity.order }, entity);
  }
  for (const target of [-1, 3, 0.5, NaN]) assert.equal(setEntityLayer(scene, 'rug', target, getAsset), scene);
  assert.equal(setEntityLayer(scene, 'missing', 1, getAsset), scene);
  assert.equal(setEntityLayer(scene, 'rug', 0, getAsset), scene);
});

test('a multi-row layer drop, including a pinned item, creates one undo entry', () => {
  const scene = room();
  scene.entities.find(entity => entity.instanceId === 'rug').pinned = true;
  const store = createAppStore({ ...createDefaultEnvelope(), currentScene: scene }, { getAsset, strictValidation: true });
  store.dispatch({ type: 'scene/setEntityLayer', instanceId: 'rug', layerIndex: 2 });
  assert.deepEqual(ids(store.getState().currentScene), ['table', 'tea', 'rug']);
  assert.equal(store.getState().currentScene.entities.find(entity => entity.instanceId === 'rug').pinned, true);
  store.dispatch({ type: 'app/undo' });
  assert.deepEqual(ids(store.getState().currentScene), ids(scene));
  assert.equal(store.dispatch({ type: 'app/undo' }).code, 'NOTHING_TO_UNDO');
  store.dispatch({ type: 'app/redo' });
  assert.deepEqual(ids(store.getState().currentScene), ['table', 'tea', 'rug']);
  assert.equal(store.dispatch({ type: 'scene/setEntityLayer', instanceId: 'rug', layerIndex: NaN }).code, 'INVALID_PAYLOAD');
});
