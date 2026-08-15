import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addEntity,
  clampEntityPoint,
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

test('asset-aware clamping keeps characters fully within 1600x900 stage at all scales', () => {
  // Character base: width 235, height 352.5, anchor: (0.5, 1.0)
  
  // Scale 1.0
  const char1 = charEntity('c1', 800, 700, 1.0);
  const bounds1 = getEntityBounds(char1, getAsset);
  assert.deepEqual(clampPoint(-500, -500, bounds1), { x: 118, y: 353 });
  assert.deepEqual(clampPoint(5000, 5000, bounds1), { x: 1483, y: 900 });

  // Min scale 0.5
  const charHalf = charEntity('c05', 800, 700, 0.5);
  const boundsHalf = getEntityBounds(charHalf, getAsset);
  assert.deepEqual(clampPoint(-500, -500, boundsHalf), { x: 59, y: 176 });
  assert.deepEqual(clampPoint(5000, 5000, boundsHalf), { x: 1541, y: 900 });

  // Max scale 2.0
  const charMax = charEntity('c2', 800, 700, 2.0);
  const boundsMax = getEntityBounds(charMax, getAsset);
  assert.deepEqual(clampPoint(-500, -500, boundsMax), { x: 235, y: 705 });
  assert.deepEqual(clampPoint(5000, 5000, boundsMax), { x: 1365, y: 900 });
});

test('asset-aware clamping for floor lamp (prop_lamp) at all scales', () => {
  // Floor lamp: displayWidth 160, displayHeight 360, groundAnchor (0.5, 1.0)

  // Scale 1.0
  const lamp1 = propEntity('lamp1', 'prop_lamp', 800, 700, 1.0);
  const bounds1 = getEntityBounds(lamp1, getAsset);
  assert.deepEqual(clampPoint(-500, -500, bounds1), { x: 80, y: 360 });
  assert.deepEqual(clampPoint(5000, 5000, bounds1), { x: 1520, y: 900 });

  // Scale 0.5 (min scale)
  const lampHalf = propEntity('lampHalf', 'prop_lamp', 800, 700, 0.5);
  const boundsHalf = getEntityBounds(lampHalf, getAsset);
  assert.deepEqual(clampPoint(-500, -500, boundsHalf), { x: 40, y: 180 });
  assert.deepEqual(clampPoint(5000, 5000, boundsHalf), { x: 1560, y: 900 });

  // Scale 2.0 (max scale)
  const lampMax = propEntity('lampMax', 'prop_lamp', 800, 700, 2.0);
  const boundsMax = getEntityBounds(lampMax, getAsset);
  assert.deepEqual(clampPoint(-500, -500, boundsMax), { x: 160, y: 720 });
  assert.deepEqual(clampPoint(5000, 5000, boundsMax), { x: 1440, y: 900 });
});

test('asset-aware clamping for pastel rug (prop_rug) at all scales', () => {
  // Pastel rug: displayWidth 380, displayHeight 140, groundAnchor (0.5, 1.0)

  // Scale 1.0
  const rug1 = propEntity('rug1', 'prop_rug', 800, 700, 1.0);
  const bounds1 = getEntityBounds(rug1, getAsset);
  assert.deepEqual(clampPoint(-500, -500, bounds1), { x: 190, y: 140 });
  assert.deepEqual(clampPoint(5000, 5000, bounds1), { x: 1410, y: 900 });

  // Scale 0.5 (min scale)
  const rugHalf = propEntity('rugHalf', 'prop_rug', 800, 700, 0.5);
  const boundsHalf = getEntityBounds(rugHalf, getAsset);
  assert.deepEqual(clampPoint(-500, -500, boundsHalf), { x: 95, y: 70 });
  assert.deepEqual(clampPoint(5000, 5000, boundsHalf), { x: 1505, y: 900 });

  // Scale 2.0 (max scale)
  const rugMax = propEntity('rugMax', 'prop_rug', 800, 700, 2.0);
  const boundsMax = getEntityBounds(rugMax, getAsset);
  assert.deepEqual(clampPoint(-500, -500, boundsMax), { x: 380, y: 280 });
  assert.deepEqual(clampPoint(5000, 5000, boundsMax), { x: 1220, y: 900 });
});

test('scaling up an entity near boundary automatically re-clamps within stage', () => {
  let scene = addEntity(createEmptyScene('scene-1'), propEntity('rug', 'prop_rug', 200, 200, 1.0), getAsset);
  
  // rug at scale 1.0 is at (200, 200) - valid since minX=190, minY=140
  assert.equal(scene.entities[0].x, 200);
  assert.equal(scene.entities[0].y, 200);

  // Now scale to 2.0 (minX becomes 380, minY becomes 280)
  scene = scaleEntity(scene, 'rug', 2.0, getAsset);
  const scaledRug = scene.entities[0];
  assert.equal(scaledRug.scale, 2.0);
  assert.equal(scaledRug.x, 380);
  assert.equal(scaledRug.y, 280);
});

test('move and scale clamp at asset boundaries', () => {
  let scene = addEntity(createEmptyScene('scene-1'), propEntity('lamp', 'prop_lamp', 800, 700), getAsset);
  scene = moveEntity(scene, 'lamp', 5000, -10, getAsset);
  assert.equal(scene.entities[0].x, 1520);
  assert.equal(scene.entities[0].y, 360);

  scene = scaleEntity(scene, 'lamp', 12, getAsset); // clamps to scale 2
  const item = scene.entities[0];
  assert.equal(item.scale, 2);
  assert.equal(item.x, 1440);
  assert.equal(item.y, 720);
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
