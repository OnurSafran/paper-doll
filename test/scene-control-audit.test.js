import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createAppStore } from '../js/core/app-store.js';
import { createDefaultEnvelope, sanitizeScene } from '../js/core/state-schema.js';
import { getAsset } from '../js/core/asset-catalog.js';
import { createEmptyScene, addEntity, alignEntities, setEntityPinned } from '../js/domain/scene-rules.js';
import { setPlacementMode, placeEntity } from '../js/domain/scene-placement.js';
import { createSelectionHudController, sceneControlDisabledReason } from '../js/features/play/selection-hud-controller.js';

function fixture() {
  let scene = setPlacementMode(createEmptyScene('audit'), 'room', getAsset);
  scene = addEntity(scene, { instanceId: 'chair', kind: 'prop', sourceId: 'prop_chair', x: 600, y: 780 }, getAsset);
  scene = addEntity(scene, { instanceId: 'table', kind: 'prop', sourceId: 'prop_table', x: 1000, y: 780 }, getAsset);
  scene = addEntity(scene, { instanceId: 'tea', kind: 'prop', sourceId: 'prop_tea_set', x: 1100, y: 800 }, getAsset);
  return scene;
}
function controls(scene = fixture()) {
  const store = createAppStore({ ...createDefaultEnvelope(), currentScene: scene }, { getAsset });
  store.dispatch({ type: 'ui/selectEntity', instanceId: 'chair' });
  const hud = createSelectionHudController({ store, getAsset, $: () => null, askConfirm: async () => true });
  return { store, hud };
}

test('bubble creation selects the new bubble exclusively, from empty, single and multi selections', () => {
  for (const selection of [[], ['chair'], ['chair', 'table']]) {
    const { store, hud } = controls();
    store.dispatch({ type: 'ui/selectEntities', instanceIds: selection });
    const result = store.dispatch({ type: 'scene/spawnBubble', text: 'Hello' });
    assert.deepEqual(store.getState().ui.selectedEntityIds, [result.instanceId]);
    assert.equal(store.getState().ui.selectedEntityId, result.instanceId);
    assert.equal(sceneControlDisabledReason(store.getState().currentScene, [result.instanceId], 'flip'), null);
    assert.equal(typeof hud.handleEntityAction, 'function');
  }
});

for (const action of ['flip', 'smaller', 'larger', 'togglePin', 'duplicate', 'delete']) {
  test(`toolbar ${action} changes a room entity and survives undo/redo and reload`, async () => {
    const { store, hud } = controls();
    const before = store.getState().currentScene;
    await hud.handleEntityAction(action);
    const after = store.getState().currentScene;
    assert.notDeepEqual(after.entities, before.entities);
    const restored = sanitizeScene(JSON.parse(JSON.stringify(after)), getAsset);
    assert.deepEqual(restored.entities, sanitizeScene(after, getAsset).entities);
    store.dispatch({ type: 'app/undo' });
    assert.deepEqual(store.getState().currentScene.entities, before.entities);
    store.dispatch({ type: 'app/redo' });
    assert.deepEqual(store.getState().currentScene.entities, after.entities);
  });
}

test('pinned transforms and invalid alignment/distribution show why the action is unavailable', async () => {
  const scene = setEntityPinned(fixture(), 'chair', true);
  const { store, hud } = controls(scene);
  const before = store.getState().currentScene;
  for (const action of ['flip', 'smaller', 'larger']) {
    assert.equal(sceneControlDisabledReason(scene, ['chair'], action), 'play.pinnedMoveBlocked');
    await hud.handleEntityAction(action);
    assert.equal(store.getState().currentScene, before);
    assert.ok(store.getState().ui.message);
  }
  assert.equal(sceneControlDisabledReason(fixture(), ['chair', 'table'], 'alignLeft'), null);
  assert.equal(sceneControlDisabledReason(fixture(), ['chair', 'table'], 'distributeH'), 'placement.distributionUnavailable');
  let furnished = placeEntity(fixture(), 'tea', { x: 1000, y: 640 }, getAsset, { transfer: true });
  assert.equal(furnished.entities.find(e => e.instanceId === 'tea').placement.kind, 'surface');
  assert.equal(sceneControlDisabledReason(furnished, ['chair', 'tea'], 'alignLeft'), 'placement.alignmentUnavailable');
  furnished = setEntityPinned(furnished, 'tea', true);
  assert.equal(sceneControlDisabledReason(furnished, ['chair', 'table', 'tea'], 'alignLeft'), null);
  const aligned = alignEntities(furnished, ['chair', 'table', 'tea'], 'center', getAsset);
  assert.notEqual(aligned, furnished, 'pinned items on other supports do not block movable items');
});

test('supported prop detachment works through toolbar and undo restores the support', async () => {
  const scene = placeEntity(fixture(), 'tea', { x: 1000, y: 640 }, getAsset, { transfer: true });
  const { store, hud } = controls(scene);
  store.dispatch({ type: 'ui/selectEntity', instanceId: 'tea' });
  await hud.handleEntityAction('detach');
  assert.equal(store.getState().currentScene.entities.find(e => e.instanceId === 'tea').attachedTo, null);
  store.dispatch({ type: 'app/undo' });
  assert.equal(store.getState().currentScene.entities.find(e => e.instanceId === 'tea').attachedTo, 'table');
});

test('SVG requests refresh stale artwork with code and retain an offline fallback', async () => {
  const handlers = {}, cached = { status: 200, artwork: 'old' }, fresh = { status: 200, artwork: 'new', clone() { return this; } };
  const requests = [], writes = [];
  let offline = false;
  runInNewContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), {
    URL, Promise,
    self: { addEventListener: (name, handler) => { handlers[name] = handler; }, skipWaiting() {}, clients: { claim() {} } },
    caches: { match: async () => cached, open: async () => ({ put: async (request, response) => writes.push([request, response]) }) },
    fetch: async (request, options) => { requests.push(options); if (offline) throw new Error('offline'); return fresh; }
  });
  async function request() {
    let response;
    handlers.fetch({ request: { method: 'GET', mode: 'cors', url: 'https://studio.test/assets/props/chair.svg' }, respondWith(value) { response = value; } });
    return response;
  }
  assert.equal(await request(), fresh);
  assert.equal(requests[0].cache, 'no-store');
  assert.equal(writes[0][1], fresh);
  offline = true;
  assert.equal(await request(), cached);
});
