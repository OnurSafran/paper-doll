import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addEntity,
  clampPoint,
  createEmptyScene,
  deleteEntity,
  duplicateEntity,
  getEntityBounds,
  moveEntity,
  reorderEntity,
  scaleEntity
} from '../js/domain/scene-rules.js';
import { getAsset } from '../js/core/asset-catalog.js';

function propEntity(id, sourceId = 'prop_chair', x = 800, y = 700, scale = 1) {
  return { instanceId: id, kind: 'prop', sourceId, x, y, scale };
}

function charEntity(id, x = 800, y = 700, scale = 1) {
  return {
    instanceId: id,
    kind: 'character',
    sourceId: 'preset-1',
    characterSnapshot: { baseDollId: 'doll_classic_a', skinTone: 'peach', slots: {} },
    x,
    y,
    scale
  };
}

test('points clamp inside the reachable logical stage with default fallback bounds', () => {
  assert.deepEqual(clampPoint(-100, 4000), { x: 30, y: 890 });
  assert.deepEqual(clampPoint(800.4, 440.6), { x: 800, y: 441 });
});

// Clamping keeps the whole envelope on stage; expectations follow catalog geometry.
const minPoint = (b) => ({ x: Math.round(b.width * b.anchorX), y: Math.round(b.height * b.anchorY) });
const maxPoint = (b) => ({ x: Math.round(1600 - b.width * (1 - b.anchorX)), y: Math.round(900 - b.height * (1 - b.anchorY)) });

test('asset-aware clamping keeps characters fully within 1600x900 stage at all scales', () => {
  // The envelope is the full 235-unit width and ends at the measured foot contact (y 410).
  const bounds1 = getEntityBounds(charEntity('c1', 800, 700, 1.0), getAsset);
  assert.equal(bounds1.width, 235);
  assert.equal(bounds1.height, 410 * 235 / 300);
  assert.deepEqual(clampPoint(-500, -500, bounds1), { x: 118, y: 321 });
  assert.deepEqual(clampPoint(5000, 5000, bounds1), { x: 1483, y: 900 });
  for (const scale of [0.5, 1, 2]) {
    const bounds = getEntityBounds(charEntity(`c${scale}`, 800, 700, scale), getAsset);
    assert.deepEqual(clampPoint(-500, -500, bounds), minPoint(bounds));
    assert.deepEqual(clampPoint(5000, 5000, bounds), maxPoint(bounds));
  }
});

for (const sourceId of ['prop_lamp', 'prop_rug']) {
  test(`asset-aware clamping for ${sourceId} at all scales`, () => {
    const asset = getAsset(sourceId);
    for (const scale of [0.5, 1, 2]) {
      const bounds = getEntityBounds(propEntity(`${sourceId}-${scale}`, sourceId, 800, 700, scale), getAsset);
      assert.equal(bounds.width, asset.displayWidth * scale);
      assert.equal(bounds.height, asset.displayHeight * scale);
      assert.deepEqual(clampPoint(-500, -500, bounds), minPoint(bounds));
      assert.deepEqual(clampPoint(5000, 5000, bounds), maxPoint(bounds));
    }
  });
}

test('scaling up an entity near boundary automatically re-clamps within stage', () => {
  const rug = getAsset('prop_rug');
  const x = Math.ceil(rug.displayWidth / 2) + 2;
  const y = Math.ceil(rug.displayHeight) + 2;
  let scene = addEntity(createEmptyScene('scene-1'), propEntity('rug', 'prop_rug', x, y, 1.0), getAsset);
  assert.equal(scene.entities[0].x, x);
  assert.equal(scene.entities[0].y, y);

  scene = scaleEntity(scene, 'rug', 2.0, getAsset);
  const scaledRug = scene.entities[0];
  assert.equal(scaledRug.scale, 2.0);
  assert.equal(scaledRug.x, Math.round(rug.displayWidth));
  assert.equal(scaledRug.y, Math.round(rug.displayHeight * 2));
});

test('move and scale clamp at asset boundaries', () => {
  const lamp = getAsset('prop_lamp');
  let scene = addEntity(createEmptyScene('scene-1'), propEntity('lamp', 'prop_lamp', 800, 700), getAsset);
  scene = moveEntity(scene, 'lamp', 5000, -10, getAsset);
  assert.equal(scene.entities[0].x, Math.round(1600 - lamp.displayWidth / 2));
  assert.equal(scene.entities[0].y, Math.round(lamp.displayHeight));

  scene = scaleEntity(scene, 'lamp', 12, getAsset); // clamps to scale 2
  const item = scene.entities[0];
  assert.equal(item.scale, 2);
  assert.equal(item.x, Math.round(1600 - lamp.displayWidth));
  assert.equal(item.y, Math.round(lamp.displayHeight * 2));
});

test('entities receive stable contiguous order', () => {
  let scene = createEmptyScene('scene-1');
  scene = addEntity(scene, propEntity('a'));
  scene = addEntity(scene, propEntity('b'));
  scene = addEntity(scene, propEntity('c'));
  assert.deepEqual(scene.entities.map((item) => item.order), [1, 2, 3]);
  scene = reorderEntity(scene, 'a', 1);
  assert.equal(scene.entities.find((item) => item.instanceId === 'a').order, 2);
  assert.equal(scene.entities.find((item) => item.instanceId === 'b').order, 1);
});

test('duplicate instance IDs are rejected at the domain boundary', () => {
  const scene = addEntity(createEmptyScene('scene-1'), propEntity('a'));
  assert.equal(addEntity(scene, propEntity('a', 'prop_chair', 300, 400)), scene);
});

test('no-op entity updates preserve scene identity', () => {
  const scene = addEntity(createEmptyScene('scene-1'), propEntity('a', 'prop_chair', 800, 700));
  assert.equal(moveEntity(scene, 'missing', 100, 100, getAsset), scene);
  assert.equal(moveEntity(scene, 'a', 800, 700, getAsset), scene);
  assert.equal(scaleEntity(scene, 'a', 1, getAsset), scene);
});

test('delete normalizes remaining order', () => {
  let scene = createEmptyScene('scene-1');
  for (const id of ['a', 'b', 'c']) scene = addEntity(scene, propEntity(id));
  scene = deleteEntity(scene, 'b');
  assert.deepEqual(scene.entities.map((item) => [item.instanceId, item.order]), [['a', 1], ['c', 2]]);
});

test('duplicate creates an offset independent scene instance clamped to boundaries', () => {
  let scene = addEntity(createEmptyScene('scene-1'), propEntity('a', 'prop_chair', 500, 600), getAsset);
  scene = duplicateEntity(scene, 'a', 'b', getAsset);
  assert.equal(scene.entities.length, 2);
  assert.deepEqual(scene.entities.map((item) => item.instanceId), ['a', 'b']);
  assert.deepEqual([scene.entities[1].x, scene.entities[1].y, scene.entities[1].order], [555, 635, 2]);
});
