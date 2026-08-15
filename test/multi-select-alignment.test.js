import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alignEntities,
  deleteEntities,
  flipEntities,
  getEntityVisualBox,
  moveEntities,
  scaleEntities,
  togglePinEntities
} from '../js/domain/scene-rules.js';
import { createAppStore } from '../js/core/app-store.js';
import { isAlignmentMode, ALIGNMENT_MODES } from '../js/domain/vocabulary.js';

const mockGetAsset = (id) => {
  if (id === 'prop_chair') return { id: 'prop_chair', name: 'Chair', displayWidth: 160, displayHeight: 220, groundAnchor: { x: 0.5, y: 0.95 } };
  if (id === 'prop_table') return { id: 'prop_table', name: 'Table', displayWidth: 300, displayHeight: 200, groundAnchor: { x: 0.5, y: 0.9 } };
  return { id, name: 'Item', displayWidth: 200, displayHeight: 200, groundAnchor: { x: 0.5, y: 0.92 } };
};

test('vocabulary defines all 8 alignment and distribution modes', () => {
  assert.equal(ALIGNMENT_MODES.length, 8);
  for (const mode of ['left', 'center', 'right', 'top', 'middle', 'bottom', 'distribute-h', 'distribute-v']) {
    assert.ok(isAlignmentMode(mode), `Expected ${mode} to be recognized`);
  }
  assert.equal(isAlignmentMode('diagonal'), false);
});

test('getEntityVisualBox computes accurate bounding boxes for characters, props, and bubbles', () => {
  const character = {
    instanceId: 'char-1',
    kind: 'character',
    x: 500,
    y: 700,
    scale: 1,
    order: 1
  };
  const charBox = getEntityVisualBox(character, mockGetAsset);
  assert.equal(charBox.centerX, 500);
  assert.equal(charBox.bottom, 700);
  assert.equal(charBox.top, 700 - 352.5);
  assert.equal(charBox.left, 500 - 235 / 2);
  assert.equal(charBox.right, 500 + 235 / 2);

  const prop = {
    instanceId: 'prop-1',
    kind: 'prop',
    sourceId: 'prop_chair',
    x: 800,
    y: 600,
    scale: 1.5,
    order: 2
  };
  const propBox = getEntityVisualBox(prop, mockGetAsset);
  assert.equal(propBox.width, 160 * 1.5);
  assert.equal(propBox.height, 220 * 1.5);
  assert.equal(propBox.bottom, 600 + (220 * 1.5) * (1 - 0.95));
});

test('alignEntities correctly aligns left, center, right, top, middle, bottom', () => {
  const scene = {
    sceneId: 'scene-1',
    title: 'Test Scene',
    backgroundId: 'bg_room',
    entities: [
      { instanceId: 'e1', kind: 'character', x: 400, y: 700, scale: 1, order: 1 },
      { instanceId: 'e2', kind: 'character', x: 700, y: 500, scale: 1, order: 2 },
      { instanceId: 'e3', kind: 'character', x: 1000, y: 800, scale: 1, order: 3 }
    ]
  };

  // Align left: should align all left edges to the leftmost entity's left edge
  const leftAligned = alignEntities(scene, ['e1', 'e2', 'e3'], 'left', mockGetAsset);
  const b1 = getEntityVisualBox(leftAligned.entities[0], mockGetAsset);
  const b2 = getEntityVisualBox(leftAligned.entities[1], mockGetAsset);
  const b3 = getEntityVisualBox(leftAligned.entities[2], mockGetAsset);
  assert.equal(Math.round(b1.left), Math.round(b2.left));
  assert.equal(Math.round(b1.left), Math.round(b3.left));

  // Align top: should align all top edges to topmost entity's top edge
  const topAligned = alignEntities(scene, ['e1', 'e2', 'e3'], 'top', mockGetAsset);
  const tb1 = getEntityVisualBox(topAligned.entities[0], mockGetAsset);
  const tb2 = getEntityVisualBox(topAligned.entities[1], mockGetAsset);
  const tb3 = getEntityVisualBox(topAligned.entities[2], mockGetAsset);
  assert.equal(Math.round(tb1.top), Math.round(tb2.top));
  assert.equal(Math.round(tb1.top), Math.round(tb3.top));

  // Align middle: vertical center alignment
  const midAligned = alignEntities(scene, ['e1', 'e2', 'e3'], 'middle', mockGetAsset);
  const mb1 = getEntityVisualBox(midAligned.entities[0], mockGetAsset);
  const mb2 = getEntityVisualBox(midAligned.entities[1], mockGetAsset);
  const mb3 = getEntityVisualBox(midAligned.entities[2], mockGetAsset);
  assert.equal(Math.round(mb1.centerY), Math.round(mb2.centerY));
  assert.equal(Math.round(mb1.centerY), Math.round(mb3.centerY));
});

test('alignEntities correctly distributes items evenly horizontally and vertically', () => {
  const scene = {
    sceneId: 'scene-dist',
    title: 'Distribution Test',
    backgroundId: 'bg_room',
    entities: [
      { instanceId: 'e1', kind: 'character', x: 200, y: 600, scale: 1, order: 1 },
      { instanceId: 'e2', kind: 'character', x: 400, y: 600, scale: 1, order: 2 },
      { instanceId: 'e3', kind: 'character', x: 1000, y: 600, scale: 1, order: 3 }
    ]
  };

  const distH = alignEntities(scene, ['e1', 'e2', 'e3'], 'distribute-h', mockGetAsset);
  const b1 = getEntityVisualBox(distH.entities[0], mockGetAsset);
  const b2 = getEntityVisualBox(distH.entities[1], mockGetAsset);
  const b3 = getEntityVisualBox(distH.entities[2], mockGetAsset);
  const gap1 = b2.left - b1.right;
  const gap2 = b3.left - b2.right;
  assert.ok(Math.abs(gap1 - gap2) <= 2, `Gaps should be equal: ${gap1} vs ${gap2}`);
});

test('batch domain operations: moveEntities, scaleEntities, flipEntities, deleteEntities, togglePinEntities', () => {
  const scene = {
    sceneId: 'scene-batch',
    title: 'Batch Ops',
    backgroundId: 'bg_room',
    entities: [
      { instanceId: 'e1', kind: 'character', x: 300, y: 600, scale: 1, flipped: false, pinned: false, order: 1 },
      { instanceId: 'e2', kind: 'character', x: 600, y: 600, scale: 1, flipped: false, pinned: true, order: 2 },
      { instanceId: 'e3', kind: 'character', x: 900, y: 600, scale: 1, flipped: true, pinned: false, order: 3 }
    ]
  };

  // Flip multiple
  const flipped = flipEntities(scene, ['e1', 'e3']);
  assert.equal(flipped.entities[0].flipped, true);
  assert.equal(flipped.entities[1].flipped, false);
  assert.equal(flipped.entities[2].flipped, false);

  // Scale multiple
  const scaled = scaleEntities(scene, ['e1', 'e3'], 0.2, mockGetAsset);
  assert.equal(scaled.entities[0].scale, 1.2);
  assert.equal(scaled.entities[2].scale, 1.2);

  // Toggle pin multiple (mixed pinned/unpinned -> both become pinned)
  const pinned = togglePinEntities(scene, ['e1', 'e2']);
  assert.equal(pinned.entities[0].pinned, true);
  assert.equal(pinned.entities[1].pinned, true);

  // Toggling again when both are pinned -> both become unpinned
  const unpinned = togglePinEntities(pinned, ['e1', 'e2']);
  assert.equal(unpinned.entities[0].pinned, false);
  assert.equal(unpinned.entities[1].pinned, false);

  // Delete multiple
  const deleted = deleteEntities(scene, ['e1', 'e3']);
  assert.equal(deleted.entities.length, 1);
  assert.equal(deleted.entities[0].instanceId, 'e2');
  assert.equal(deleted.entities[0].order, 1);
});

test('AppStore handles multi-selection, alignment, and batch actions with undo/redo atomicity', () => {
  const initialEnvelope = {
    version: 2,
    presets: [{ presetId: 'doll_a', name: 'Doll A', slots: {} }],
    scenes: [],
    currentScene: {
      sceneId: 'active-scene',
      title: 'Current Scene',
      backgroundId: 'bg_room',
      entities: [
        { instanceId: 'ent-1', kind: 'character', sourceId: 'doll_a', x: 300, y: 700, scale: 1, order: 1 },
        { instanceId: 'ent-2', kind: 'character', sourceId: 'doll_a', x: 600, y: 700, scale: 1, order: 2 },
        { instanceId: 'ent-3', kind: 'character', sourceId: 'doll_a', x: 900, y: 700, scale: 1, order: 3 }
      ]
    },
    designer: { draft: { slots: {} }, selectedSlot: 'top', dirty: false }
  };

  const store = createAppStore(initialEnvelope, { getAsset: mockGetAsset });

  // Select multiple entities
  store.dispatch({ type: 'ui/selectEntities', instanceIds: ['ent-1', 'ent-2', 'ent-3'] });
  assert.equal(store.getState().ui.selectedEntityIds.length, 3);
  assert.equal(store.getState().ui.selectedEntityId, 'ent-1');

  // Align center
  store.dispatch({ type: 'scene/alignEntities', alignment: 'center' });
  const e1 = store.getState().currentScene.entities[0];
  const e2 = store.getState().currentScene.entities[1];
  const e3 = store.getState().currentScene.entities[2];
  assert.equal(e1.x, e2.x);
  assert.equal(e1.x, e3.x);

  // Single Undo restores previous positions
  store.dispatch({ type: 'app/undo' });
  assert.equal(store.getState().currentScene.entities[0].x, 300);
  assert.equal(store.getState().currentScene.entities[1].x, 600);
  assert.equal(store.getState().currentScene.entities[2].x, 900);

  // Duplicate current scene to library
  store.dispatch({ type: 'scene/duplicateCurrentToLibrary' });
  assert.equal(store.getState().scenes.length, 1);
  assert.equal(store.getState().scenes[0].title, 'My Scene (Copy)');
  assert.equal(store.getState().scenes[0].entities.length, 3);
});

test('deselection pathways: ui/clearSelection, individual toggle off, and null selection', () => {
  const store = createAppStore({
    version: 2,
    presets: [{ presetId: 'doll_a', name: 'Doll A', slots: {} }],
    scenes: [],
    currentScene: {
      sceneId: 'active-scene',
      title: 'Current Scene',
      backgroundId: 'bg_room',
      entities: [
        { instanceId: 'ent-1', kind: 'character', sourceId: 'doll_a', x: 300, y: 700, scale: 1, order: 1 },
        { instanceId: 'ent-2', kind: 'character', sourceId: 'doll_a', x: 600, y: 700, scale: 1, order: 2 }
      ]
    },
    designer: { draft: { slots: {} }, selectedSlot: 'top', dirty: false }
  }, { getAsset: mockGetAsset });

  // 1. Direct clearSelection
  store.dispatch({ type: 'ui/selectEntities', instanceIds: ['ent-1', 'ent-2'] });
  assert.equal(store.getState().ui.selectedEntityIds.length, 2);
  store.dispatch({ type: 'ui/clearSelection' });
  assert.equal(store.getState().ui.selectedEntityId, null);
  assert.equal(store.getState().ui.selectedEntityIds.length, 0);

  // 2. SelectEntity with null
  store.dispatch({ type: 'ui/selectEntity', instanceId: 'ent-1' });
  assert.equal(store.getState().ui.selectedEntityId, 'ent-1');
  assert.deepEqual(store.getState().ui.selectedEntityIds, ['ent-1']);
  store.dispatch({ type: 'ui/selectEntity', instanceId: null });
  assert.equal(store.getState().ui.selectedEntityId, null);
  assert.deepEqual(store.getState().ui.selectedEntityIds, []);

  // 3. Toggle off the single selected entity
  store.dispatch({ type: 'ui/selectEntity', instanceId: 'ent-2' });
  store.dispatch({ type: 'ui/toggleEntitySelection', instanceId: 'ent-2' });
  assert.equal(store.getState().ui.selectedEntityId, null);
  assert.deepEqual(store.getState().ui.selectedEntityIds, []);

  // 4. Toggle off one of two items updates selectedEntityId to remaining item
  store.dispatch({ type: 'ui/selectEntities', instanceIds: ['ent-1', 'ent-2'] });
  store.dispatch({ type: 'ui/toggleEntitySelection', instanceId: 'ent-2' });
  assert.equal(store.getState().ui.selectedEntityId, 'ent-1');
  assert.deepEqual(store.getState().ui.selectedEntityIds, ['ent-1']);
});

test('moveEntities avoids double-displacement when parent and child are both in moves list', () => {
  const scene = {
    sceneId: 'scene-attached',
    title: 'Attached Group Move',
    backgroundId: 'bg_room',
    entities: [
      // Child entity listed BEFORE parent in entities array
      {
        instanceId: 'bubble-child',
        kind: 'bubble',
        sourceId: 'bubble',
        x: 600,
        y: 350,
        scale: 1,
        order: 1,
        attachedTo: 'parent-doll',
        attachOffset: { dx: 0, dy: -350 }
      },
      {
        instanceId: 'parent-doll',
        kind: 'character',
        sourceId: 'doll_a',
        x: 600,
        y: 700,
        scale: 1,
        order: 2,
        attachedTo: null,
        attachOffset: null
      }
    ]
  };

  // Move both by +100 x
  const moves = [
    { instanceId: 'bubble-child', x: 700, y: 350 },
    { instanceId: 'parent-doll', x: 700, y: 700 }
  ];

  const result = moveEntities(scene, moves, mockGetAsset);
  const child = result.entities.find((e) => e.instanceId === 'bubble-child');
  const parent = result.entities.find((e) => e.instanceId === 'parent-doll');

  assert.equal(parent.x, 700);
  assert.equal(parent.y, 700);
  assert.equal(child.x, 700, 'Child must move exactly by +100 without double-displacement');
  assert.equal(child.y, 350);
  assert.deepEqual(child.attachOffset, { dx: 0, dy: -350 });
});

test('duplicateCurrentToLibrary assigns fresh entity instance IDs to cloned library scene', () => {
  const store = createAppStore({
    version: 2,
    presets: [{ presetId: 'doll_a', name: 'Doll A', slots: {} }],
    scenes: [],
    currentScene: {
      sceneId: 'active-stage',
      title: 'Active Stage',
      backgroundId: 'bg_room',
      entities: [
        { instanceId: 'stage-char', kind: 'character', sourceId: 'doll_a', x: 500, y: 700, scale: 1, order: 1 },
        { instanceId: 'stage-bubble', kind: 'bubble', sourceId: 'bubble', x: 500, y: 350, scale: 1, order: 2, attachedTo: 'stage-char', attachOffset: { dx: 0, dy: -350 } }
      ]
    },
    designer: { draft: { slots: {} }, selectedSlot: 'top', dirty: false }
  }, { getAsset: mockGetAsset });

  store.dispatch({ type: 'scene/duplicateCurrentToLibrary' });
  const savedScene = store.getState().scenes[0];
  assert.ok(savedScene);
  assert.notEqual(savedScene.entities[0].instanceId, 'stage-char', 'Saved library copy must have fresh instance IDs');
  assert.notEqual(savedScene.entities[1].instanceId, 'stage-bubble');
  assert.equal(savedScene.entities[1].attachedTo, savedScene.entities[0].instanceId, 'Attachment reference must be remapped to new instance ID');
});

test('Scene and project replacement actions clear both single and multi-selection state', () => {
  const store = createAppStore({
    schemaVersion: 2,
    presets: [{ presetId: 'doll_a', name: 'Doll A', slots: {} }],
    scenes: [{
      sceneId: 'lib-scene-1',
      title: 'Saved Library Scene',
      backgroundId: 'bg_park',
      entities: [{ instanceId: 'lib-ent-1', kind: 'prop', sourceId: 'prop_chair', x: 400, y: 500, scale: 1, order: 1 }]
    }],
    currentScene: {
      sceneId: 'current-1',
      title: 'Current Stage',
      backgroundId: 'bg_bedroom',
      entities: [
        { instanceId: 'e-1', kind: 'prop', sourceId: 'prop_lamp', x: 200, y: 300, scale: 1, order: 1 },
        { instanceId: 'e-2', kind: 'prop', sourceId: 'prop_rug', x: 500, y: 600, scale: 1, order: 2 }
      ]
    }
  }, { getAsset: mockGetAsset });

  // 1. Establish multi-selection on active stage
  store.dispatch({ type: 'ui/selectEntities', instanceIds: ['e-1', 'e-2'] });
  assert.deepEqual(store.getState().ui.selectedEntityIds, ['e-1', 'e-2']);
  assert.equal(store.getState().ui.selectedEntityId, 'e-1');

  // 2. Load scene from library -> selection must be fully cleared
  store.dispatch({ type: 'scene/loadFromLibrary', sceneId: 'lib-scene-1' });
  assert.equal(store.getState().ui.selectedEntityId, null);
  assert.deepEqual(store.getState().ui.selectedEntityIds, []);

  // 3. Establish multi-selection again
  store.dispatch({ type: 'ui/selectEntities', instanceIds: ['lib-ent-1'] });
  assert.equal(store.getState().ui.selectedEntityId, 'lib-ent-1');

  // 4. Import Replace -> selection must be fully cleared
  store.dispatch({
    type: 'project/importReplace',
    envelope: {
      schemaVersion: 2,
      presets: [],
      scenes: [],
      currentScene: { sceneId: 'imported-scene', title: 'Imported', backgroundId: 'bg_park', entities: [] }
    }
  });
  assert.equal(store.getState().ui.selectedEntityId, null);
  assert.deepEqual(store.getState().ui.selectedEntityIds, []);

  // 5. Restore Backup -> selection must be fully cleared
  store.dispatch({
    type: 'project/restoreBackup',
    envelope: {
      schemaVersion: 2,
      presets: [],
      scenes: [],
      currentScene: { sceneId: 'restored-scene', title: 'Restored', backgroundId: 'bg_park', entities: [] }
    }
  });
  assert.equal(store.getState().ui.selectedEntityId, null);
  assert.deepEqual(store.getState().ui.selectedEntityIds, []);
});


