import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetRegistry } from '../js/core/asset-registry.js';
import { sanitizeScene } from '../js/core/state-schema.js';
import { addEntity, createEmptyScene, flipEntity, scaleEntity } from '../js/domain/scene-rules.js';
import { changePlacementBackground, placeEntity, projectLocal } from '../js/domain/scene-placement.js';

const getAsset = createAssetRegistry().getAsset;
const item = (scene, id) => scene.entities.find(entity => entity.instanceId === id);

test('new everyday props can be spawned, doubled, flipped and restored in a room', () => {
  let scene = changePlacementBackground(createEmptyScene('audit'), 'bg_atelier', getAsset);
  for (const [index, sourceId] of ['prop_watering_can', 'prop_puppy', 'prop_beach_ball', 'prop_paint_palette'].entries()) {
    scene = addEntity(scene, { instanceId: sourceId, kind: 'prop', sourceId, x: 250 + index * 300, y: 810 }, getAsset);
    assert.equal(item(scene, sourceId).placement.kind, 'floor');
    scene = scaleEntity(scene, sourceId, 2, getAsset);
    scene = flipEntity(scene, sourceId, getAsset);
    assert.equal(item(scene, sourceId).scale, 2);
    assert.equal(item(scene, sourceId).flipped, true);
  }
  const restored = sanitizeScene(JSON.parse(JSON.stringify(scene)), getAsset);
  const geometry = entities => entities.map(({ sourceId, x, y, scale, flipped, placement }) => ({ sourceId, x, y, scale, flipped, placement }));
  assert.deepEqual(geometry(restored.entities), geometry(scene.entities));
});

test('watering can and palette fit a table surface and keep their support after transforms and reload', () => {
  for (const sourceId of ['prop_watering_can', 'prop_paint_palette']) {
    let scene = changePlacementBackground(createEmptyScene('audit'), 'bg_atelier', getAsset);
    scene = addEntity(scene, { instanceId: 'table', kind: 'prop', sourceId: 'prop_table', x: 800, y: 810 }, getAsset);
    scene = scaleEntity(scene, 'table', 2, getAsset);
    scene = addEntity(scene, { instanceId: 'tool', kind: 'prop', sourceId, x: 500, y: 810 }, getAsset);
    scene = placeEntity(scene, 'tool', projectLocal(item(scene, 'table'), { x: .5, y: .1929 }, getAsset), getAsset, { target: { kind: 'surface', hostId: 'table', surfaceId: 'tabletop' } });
    assert.equal(item(scene, 'tool').placement.kind, 'surface', sourceId);
    scene = flipEntity(scene, 'tool', getAsset);
    const restored = sanitizeScene(JSON.parse(JSON.stringify(scene)), getAsset);
    assert.deepEqual(item(restored, 'tool'), item(scene, 'tool'));
    assert.equal(item(restored, 'tool').attachedTo, 'table');
    assert.equal(item(restored, 'tool').flipped, true);
  }
});
