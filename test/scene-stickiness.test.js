import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachEntity,
  createEmptyScene,
  deleteEntity,
  detachEntity,
  duplicateEntity,
  flipEntity,
  getAttachedDescendants,
  moveEntity,
  scaleEntity,
  setEntityPinned
} from '../js/domain/scene-rules.js';
import { createAppStore } from '../js/core/app-store.js';
import { getAsset } from '../js/core/asset-catalog.js';
import { createDefaultEnvelope, sanitizeScene } from '../js/core/state-schema.js';
import { createStarterDraft } from '../js/domain/outfit-rules.js';

test('sanitizeScene validates pinned boolean and finite attachOffset', () => {
  const rawScene = {
    sceneId: 'test-scene',
    entities: [
      {
        instanceId: 'doll-1',
        kind: 'character',
        sourceId: 'demo_emma',
        characterSnapshot: createStarterDraft(),
        x: 800,
        y: 700,
        scale: 1,
        pinned: true
      },
      {
        instanceId: 'prop-1',
        kind: 'prop',
        sourceId: 'prop_chair',
        x: 900,
        y: 720,
        scale: 1,
        pinned: false,
        attachedTo: 'doll-1',
        attachOffset: { dx: 999, dy: 999 }
      }
    ]
  };

  const sanitized = sanitizeScene(rawScene, getAsset);
  assert.equal(sanitized.entities[0].pinned, true);
  assert.equal(sanitized.entities[0].attachedTo, null);

  assert.equal(sanitized.entities[1].pinned, false);
  assert.equal(sanitized.entities[1].attachedTo, 'doll-1');
  assert.deepEqual(sanitized.entities[1].attachOffset, { dx: 100, dy: 20 });
});

test('sanitizeScene rejects self-attachment and breaks circular attachment cycles', () => {
  const cyclicScene = {
    sceneId: 'cyclic-scene',
    entities: [
      {
        instanceId: 'ent-a',
        kind: 'prop',
        sourceId: 'prop_table',
        x: 400,
        y: 500,
        attachedTo: 'ent-b',
        attachOffset: { dx: -100, dy: 0 }
      },
      {
        instanceId: 'ent-b',
        kind: 'prop',
        sourceId: 'prop_chair',
        x: 500,
        y: 500,
        attachedTo: 'ent-a', // Cycle: A -> B -> A
        attachOffset: { dx: 100, dy: 0 }
      },
      {
        instanceId: 'ent-c',
        kind: 'prop',
        sourceId: 'prop_plant',
        x: 600,
        y: 500,
        attachedTo: 'ent-c', // Self-attachment: C -> C
        attachOffset: { dx: 0, dy: 0 }
      },
      {
        instanceId: 'ent-d',
        kind: 'prop',
        sourceId: 'prop_lamp',
        x: 700,
        y: 500,
        attachedTo: 'missing-parent', // Dangling reference
        attachOffset: { dx: 50, dy: 50 }
      }
    ]
  };

  const warnings = [];
  const sanitized = sanitizeScene(cyclicScene, getAsset, warnings);

  // Self-attachment broken
  const entC = sanitized.entities.find((e) => e.instanceId === 'ent-c');
  assert.equal(entC.attachedTo, null);

  // Dangling reference cleared
  const entD = sanitized.entities.find((e) => e.instanceId === 'ent-d');
  assert.equal(entD.attachedTo, null);

  // Cycle broken: either A or B is detached cleanly
  const entA = sanitized.entities.find((e) => e.instanceId === 'ent-a');
  const entB = sanitized.entities.find((e) => e.instanceId === 'ent-b');
  assert.ok(entA.attachedTo === null || entB.attachedTo === null);
  assert.ok(warnings.some((w) => w.includes('circular attachment')));
});

test('setEntityPinned locks entity against movement and detaches from parent', () => {
  const scene = {
    ...createEmptyScene(),
    entities: [{
      instanceId: 'rug-1',
      kind: 'prop',
      sourceId: 'prop_rug',
      x: 800,
      y: 750,
      scale: 1,
      order: 1,
      pinned: false
    }]
  };

  // 1. Pin entity
  const pinnedScene = setEntityPinned(scene, 'rug-1', true);
  assert.equal(pinnedScene.entities[0].pinned, true);

  // 2. Attempting to move pinned entity is a no-op
  const moved = moveEntity(pinnedScene, 'rug-1', 400, 400, getAsset);
  assert.equal(moved.entities[0].x, 800);
  assert.equal(moved.entities[0].y, 750);

  // 3. Unpin entity allows movement again
  const unpinnedScene = setEntityPinned(pinnedScene, 'rug-1', false);
  assert.equal(unpinnedScene.entities[0].pinned, false);
  const movedAfterUnpin = moveEntity(unpinnedScene, 'rug-1', 400, 400, getAsset);
  assert.equal(movedAfterUnpin.entities[0].x, 400);
});

test('attachEntity calculates exact offset and prevents cycle creation', () => {
  const scene = {
    ...createEmptyScene(),
    entities: [
      {
        instanceId: 'char-1',
        kind: 'character',
        sourceId: 'demo_emma',
        characterSnapshot: createStarterDraft(),
        x: 500,
        y: 600,
        scale: 1,
        order: 1
      },
      {
        instanceId: 'prop-hat',
        kind: 'prop',
        sourceId: 'prop_plant',
        x: 520,
        y: 450,
        scale: 1,
        order: 2
      }
    ]
  };

  // 1. Attach hat to character
  const attached = attachEntity(scene, 'prop-hat', 'char-1');
  const hat = attached.entities.find((e) => e.instanceId === 'prop-hat');
  assert.equal(hat.attachedTo, 'char-1');
  assert.deepEqual(hat.attachOffset, { dx: 20, dy: -150 });

  // 2. Prevent attaching parent to child (cycle prevention)
  const cyclicAttempt = attachEntity(attached, 'char-1', 'prop-hat');
  assert.equal(cyclicAttempt, attached); // unchanged

  // 3. Detach entity
  const detached = detachEntity(attached, 'prop-hat');
  const detachedHat = detached.entities.find((e) => e.instanceId === 'prop-hat');
  assert.equal(detachedHat.attachedTo, null);
  assert.equal(detachedHat.attachOffset, null);
  assert.equal(detachedHat.x, 520);
  assert.equal(detachedHat.y, 450);
});

test('moveEntity propagates delta to attached children and enforces compound boundary clamping', () => {
  const scene = {
    ...createEmptyScene(),
    entities: [
      {
        instanceId: 'host-doll',
        kind: 'character',
        sourceId: 'demo_emma',
        characterSnapshot: createStarterDraft(),
        x: 800,
        y: 600,
        scale: 1,
        order: 1
      },
      {
        instanceId: 'child-prop',
        kind: 'prop',
        sourceId: 'prop_chair',
        x: 950,
        y: 620,
        scale: 1,
        order: 2,
        attachedTo: 'host-doll',
        attachOffset: { dx: 150, dy: 20 }
      }
    ]
  };

  // 1. Normal move shifts host and child by exact delta (dx = +100, dy = -50)
  const moved = moveEntity(scene, 'host-doll', 900, 550, getAsset);
  const host = moved.entities.find((e) => e.instanceId === 'host-doll');
  const child = moved.entities.find((e) => e.instanceId === 'child-prop');

  assert.equal(host.x, 900);
  assert.equal(host.y, 550);
  assert.equal(child.x, 1050); // 950 + 100
  assert.equal(child.y, 570); // 620 - 50

  // 2. Compound boundary clamping: child is 150px to the right of host.
  // When attempting to move host to the extreme right edge (x = 1600),
  // compound clamping stops host early so child does NOT clip past stage right edge!
  const extremeRightMove = moveEntity(scene, 'host-doll', 1600, 600, getAsset);
  const clampedHost = extremeRightMove.entities.find((e) => e.instanceId === 'host-doll');
  const clampedChild = extremeRightMove.entities.find((e) => e.instanceId === 'child-prop');

  assert.ok(clampedHost.x < 1600); // Host stopped early to protect child
  assert.ok(clampedChild.x <= 1600); // Child safely within stage
});

test('moving attached child directly updates its offset relative to parent', () => {
  const scene = {
    ...createEmptyScene(),
    entities: [
      {
        instanceId: 'parent-doll',
        kind: 'character',
        sourceId: 'demo_emma',
        characterSnapshot: createStarterDraft(),
        x: 800,
        y: 700,
        scale: 1,
        order: 1
      },
      {
        instanceId: 'child-prop',
        kind: 'prop',
        sourceId: 'prop_table',
        x: 850,
        y: 700,
        scale: 1,
        order: 2,
        attachedTo: 'parent-doll',
        attachOffset: { dx: 50, dy: 0 }
      }
    ]
  };

  // Move child prop directly to x=900
  const moved = moveEntity(scene, 'child-prop', 900, 700, getAsset);
  const parent = moved.entities.find((e) => e.instanceId === 'parent-doll');
  const child = moved.entities.find((e) => e.instanceId === 'child-prop');

  assert.equal(parent.x, 800); // parent unmoved
  assert.equal(child.x, 900);
  assert.deepEqual(child.attachOffset, { dx: 100, dy: 0 }); // offset updated
});

test('deleteEntity on parent automatically detaches children in place', () => {
  const scene = {
    ...createEmptyScene(),
    entities: [
      {
        instanceId: 'parent-char',
        kind: 'character',
        sourceId: 'demo_emma',
        characterSnapshot: createStarterDraft(),
        x: 700,
        y: 700,
        scale: 1,
        order: 1
      },
      {
        instanceId: 'attached-prop',
        kind: 'prop',
        sourceId: 'prop_plant',
        x: 750,
        y: 680,
        scale: 1,
        order: 2,
        attachedTo: 'parent-char',
        attachOffset: { dx: 50, dy: -20 }
      }
    ]
  };

  const deleted = deleteEntity(scene, 'parent-char');
  assert.equal(deleted.entities.length, 1);
  const remainingProp = deleted.entities[0];
  assert.equal(remainingProp.instanceId, 'attached-prop');
  assert.equal(remainingProp.attachedTo, null);
  assert.equal(remainingProp.attachOffset, null);
  assert.equal(remainingProp.x, 750);
  assert.equal(remainingProp.y, 680);
});

test('AppStore handles scene/togglePin, scene/attachEntity, scene/detachEntity with undo/redo', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset });
  store.dispatch({ type: 'scene/new' });
  store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_rug', x: 800, y: 700 });
  const rugId = store.getState().currentScene.entities[0].instanceId;

  // 1. Test Pin
  store.dispatch({ type: 'scene/togglePin', instanceId: rugId });
  assert.equal(store.getState().currentScene.entities[0].pinned, true);

  // Undo Pin
  store.dispatch({ type: 'app/undo' });
  assert.equal(store.getState().currentScene.entities[0].pinned, false);

  // Redo Pin
  store.dispatch({ type: 'app/redo' });
  assert.equal(store.getState().currentScene.entities[0].pinned, true);

  // Unpin
  store.dispatch({ type: 'scene/togglePin', instanceId: rugId });
  assert.equal(store.getState().currentScene.entities[0].pinned, false);

  // 2. Test Attach & Detach
  store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_plant', x: 850, y: 700 });
  const plantId = store.getState().currentScene.entities[1].instanceId;

  store.dispatch({ type: 'scene/attachEntity', childInstanceId: plantId, parentInstanceId: rugId });
  assert.equal(store.getState().currentScene.entities[1].attachedTo, rugId);

  // Detach
  store.dispatch({ type: 'scene/detachEntity', instanceId: plantId });
  assert.equal(store.getState().currentScene.entities[1].attachedTo, null);

  // Undo Detach -> attached again
  store.dispatch({ type: 'app/undo' });
  assert.equal(store.getState().currentScene.entities[1].attachedTo, rugId);
});

test('duplicateLibraryScene maps internal attachedTo references to newly generated instance IDs', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset });
  store.dispatch({ type: 'scene/new' });
  store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_rug', x: 800, y: 700 });
  store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_plant', x: 850, y: 700 });

  const rugId = store.getState().currentScene.entities[0].instanceId;
  const plantId = store.getState().currentScene.entities[1].instanceId;

  store.dispatch({ type: 'scene/attachEntity', childInstanceId: plantId, parentInstanceId: rugId });
  assert.equal(store.getState().currentScene.entities[1].attachedTo, rugId);

  // Save to Scene Book
  const saveRes = store.dispatch({ type: 'scene/saveToLibrary', name: 'Cozy Room' });
  const savedSceneId = saveRes.sceneId;

  // Duplicate the scene in Library
  const dupRes = store.dispatch({ type: 'scene/duplicateLibraryScene', sceneId: savedSceneId });
  assert.equal(dupRes.ok, true);

  const duplicatedScene = store.getState().scenes.find((s) => s.sceneId === dupRes.sceneId);
  assert.ok(duplicatedScene);
  assert.equal(duplicatedScene.entities.length, 2);

  const dupRug = duplicatedScene.entities[0];
  const dupPlant = duplicatedScene.entities[1];

  // Plant in duplicated scene MUST point to the new Rug's instanceId, NOT the old rugId
  assert.notEqual(dupRug.instanceId, rugId);
  assert.notEqual(dupPlant.instanceId, plantId);
  assert.equal(dupPlant.attachedTo, dupRug.instanceId);
  assert.deepEqual(dupPlant.attachOffset, { dx: 50, dy: 0 });
});

test('moving intermediate parent in a 3-level hierarchy updates its offset to grandparent while moving child', () => {
  const scene = {
    ...createEmptyScene(),
    entities: [
      {
        instanceId: 'grandparent',
        kind: 'prop',
        sourceId: 'prop_rug',
        x: 800,
        y: 700,
        scale: 1,
        order: 1
      },
      {
        instanceId: 'parent',
        kind: 'prop',
        sourceId: 'prop_table',
        x: 850,
        y: 700,
        scale: 1,
        order: 2,
        attachedTo: 'grandparent',
        attachOffset: { dx: 50, dy: 0 }
      },
      {
        instanceId: 'child',
        kind: 'prop',
        sourceId: 'prop_plant',
        x: 870,
        y: 650,
        scale: 1,
        order: 3,
        attachedTo: 'parent',
        attachOffset: { dx: 20, dy: -50 }
      }
    ]
  };

  // Move intermediate 'parent' directly by dx = +30 (from x=850 to x=880)
  const moved = moveEntity(scene, 'parent', 880, 700, getAsset);
  const gp = moved.entities.find((e) => e.instanceId === 'grandparent');
  const p = moved.entities.find((e) => e.instanceId === 'parent');
  const c = moved.entities.find((e) => e.instanceId === 'child');

  assert.equal(gp.x, 800); // grandparent unchanged
  assert.equal(p.x, 880);  // parent moved to 880
  assert.deepEqual(p.attachOffset, { dx: 80, dy: 0 }); // offset relative to grandparent updated!
  assert.equal(c.x, 900);  // child moved along with parent (870 + 30 = 900)
  assert.deepEqual(c.attachOffset, { dx: 20, dy: -50 }); // offset relative to parent intact!
});

test('scaling an entity near stage boundary propagates reclamping shift to attached children', () => {
  const scene = {
    sceneId: 'scale-test',
    entities: [
      {
        instanceId: 'doll-edge',
        kind: 'character',
        sourceId: 'demo_emma',
        characterSnapshot: createStarterDraft(),
        x: 1460,
        y: 800,
        scale: 1,
        order: 1
      },
      {
        instanceId: 'hat-child',
        kind: 'prop',
        sourceId: 'prop_plant',
        x: 1460,
        y: 500,
        scale: 1,
        order: 2,
        attachedTo: 'doll-edge',
        attachOffset: { dx: 0, dy: -300 }
      }
    ]
  };

  // Scaling up character to 2.0 pushes character left from 1460 to keep within stage boundary
  const scaled = scaleEntity(scene, 'doll-edge', 2.0, getAsset);
  const doll = scaled.entities.find((e) => e.instanceId === 'doll-edge');
  const hat = scaled.entities.find((e) => e.instanceId === 'hat-child');

  assert.equal(doll.scale, 2.0);
  assert.ok(doll.x < 1460, 'Doll reclamped to stay within 1600 width');
  const shift = doll.x - 1460;
  assert.equal(hat.x, 1460 + shift, 'Hat child shifted by exact same delta');
});

test('AppStore handles scene/spawnProp with targetEntityId to automatically attach prop to host', () => {
  const envelope = createDefaultEnvelope();
  const store = createAppStore(envelope, {
    getAsset: (id) => (id === 'bg_bedroom' ? { id, kind: 'background' } : { id, kind: 'prop', displayWidth: 100, displayHeight: 100 })
  });
  store.dispatch({ type: 'scene/new' });
  store.dispatch({ type: 'preset/save', name: 'Emma' });
  const presetId = store.getState().presets[0].presetId;

  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 800, y: 700 });
  const dollId = store.getState().currentScene.entities[0].instanceId;

  // Spawn prop targeting doll
  store.dispatch({
    type: 'scene/spawnProp',
    assetId: 'prop_table',
    x: 820,
    y: 680,
    targetEntityId: dollId
  });

  const scene = store.getState().currentScene;
  assert.equal(scene.entities.length, 2);
  const prop = scene.entities.find((e) => e.kind === 'prop');
  assert.ok(prop, 'Prop spawned');
  assert.equal(prop.attachedTo, dollId, 'Prop attached to doll');
  assert.deepEqual(prop.attachOffset, { dx: 20, dy: -20 });
});

test('Single-item scaleEntity, flipEntity, and moveEntity strictly preserve pinned entities unchanged', () => {
  const scene = {
    ...createEmptyScene('pinned-test'),
    entities: [
      {
        instanceId: 'pinned-lamp',
        kind: 'prop',
        sourceId: 'prop_lamp',
        x: 400,
        y: 500,
        scale: 1.0,
        flipped: false,
        pinned: true,
        order: 1
      },
      {
        instanceId: 'unpinned-table',
        kind: 'prop',
        sourceId: 'prop_table',
        x: 800,
        y: 700,
        scale: 1.0,
        flipped: false,
        pinned: false,
        order: 2
      }
    ]
  };

  // 1. Attempt to move pinned entity -> no change
  const moved = moveEntity(scene, 'pinned-lamp', 600, 600, getAsset);
  assert.equal(moved.entities[0].x, 400);
  assert.equal(moved.entities[0].y, 500);

  // 2. Attempt to scale pinned entity -> no change
  const scaled = scaleEntity(scene, 'pinned-lamp', 1.5, getAsset);
  assert.equal(scaled.entities[0].scale, 1.0);

  // 3. Attempt to flip pinned entity -> no change
  const flipped = flipEntity(scene, 'pinned-lamp');
  assert.equal(flipped.entities[0].flipped, false);

  // 4. Unpinned entity still scales and flips normally
  const scaledUnpinned = scaleEntity(scene, 'unpinned-table', 1.5, getAsset);
  assert.equal(scaledUnpinned.entities[1].scale, 1.5);
  const flippedUnpinned = flipEntity(scene, 'unpinned-table');
  assert.equal(flippedUnpinned.entities[1].flipped, true);
});

