import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetRegistry } from '../js/core/asset-registry.js';
import { createEmptyScene, addEntity } from '../js/domain/scene-rules.js';
import { changePlacementBackground, placeEntity, getPlacementGuides } from '../js/domain/scene-placement.js';

const registry = createAssetRegistry();
const getAsset = registry.getAsset;
const item = (scene, id) => scene.entities.find(e => e.instanceId === id);

test('Every built-in and pack prop declares explicit placement rules', () => {
  const missing = registry.assetsByKind('prop').filter(asset => !asset.placementRules).map(asset => asset.id);
  assert.deepEqual(missing, [], 'props without rules can rest anywhere in Room mode');
});

test('Every prop has a valid contact anchor and a footprint that fits its artwork', () => {
  for (const asset of registry.assetsByKind('prop')) {
    const { x, y } = asset.groundAnchor;
    assert.equal(x >= 0 && x <= 1 && y >= 0 && y <= 1, true, `${asset.id} anchor`);
    const { width, depth } = asset.placementRules.contactFootprint;
    assert.equal(width > 0 && width <= 1 && depth > 0 && depth <= 1, true, `${asset.id} footprint`);
    if (asset.placementRules.allowedTargets.includes('wall')) assert.equal(y >= .4 && y <= .6, true, `${asset.id} wall anchor is central`);
  }
});

test('Small family props rest on the floor or a surface, and hangings go on the wall', () => {
  const room = changePlacementBackground(createEmptyScene('test'), 'fh_living_room', getAsset);
  assert.equal(room.placementMode, 'room');
  for (const id of ['fh_teddy', 'fh_blocks']) {
    assert.deepEqual(getAsset(id).placementRules.allowedTargets, ['floor', 'surface'], id);
    const scene = addEntity(room, { instanceId: 'piece', kind: 'prop', sourceId: id, x: 800, y: 780 }, getAsset);
    // Dropped high on the wall, a floor-capable prop is pulled back to the floor, never left on the wall.
    const dropped = placeEntity(scene, 'piece', { x: 800, y: 200 }, getAsset, { transfer: true });
    assert.equal(item(dropped, 'piece').placement.kind, 'floor', id);
    assert.equal(item(dropped, 'piece').y >= 660, true, `${id} stays below the wall seam`);
  }
  const frame = addEntity(room, { instanceId: 'frame', kind: 'prop', sourceId: 'fh_family_frame', x: 800, y: 300 }, getAsset);
  assert.equal(item(frame, 'frame').placement.kind, 'wall');
  const lowered = placeEntity(frame, 'frame', { x: 800, y: 840 }, getAsset, { transfer: true });
  assert.equal(item(lowered, 'frame').placement.kind, 'wall', 'a wall hanging cannot be dragged onto the floor');
  assert.equal(item(lowered, 'frame').y < 660, true);
});

test('Previously unconstrained core props now follow room rules', () => {
  const room = changePlacementBackground(createEmptyScene('test'), 'bg_bedroom', getAsset);
  const bear = addEntity(room, { instanceId: 'cat', kind: 'prop', sourceId: 'prop_cat', x: 800, y: 780 }, getAsset);
  assert.equal(getPlacementGuides(bear, item(bear, 'cat'), getAsset).some(g => g.kind === 'floor'), true);
  const kite = addEntity(room, { instanceId: 'kite', kind: 'prop', sourceId: 'prop_kite', x: 800, y: 300 }, getAsset);
  assert.equal(item(kite, 'kite').placement.kind, 'wall');
});
