import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CAMERA_CONSTANTS,
  DEFAULT_STAGE_WIDTH,
  isStageWidth,
  LIMITS,
  STAGE_WIDTHS
} from '../js/domain/vocabulary.js';
import { clientToLogical, logicalToClient, clampCameraX } from '../js/core/coordinate-space.js';
import {
  addEntity,
  clampPoint,
  createEmptyScene,
  createSampleScene,
  getEntityBounds,
  moveEntity,
  reclampSceneEntities,
  scaleEntity
} from '../js/domain/scene-rules.js';
import { cloneScene, sanitizeScene } from '../js/core/state-schema.js';
import { createAppStore } from '../js/core/app-store.js';
import { getAsset } from '../js/core/asset-catalog.js';
import { createStarterDraft } from '../js/domain/outfit-rules.js';
import { createExportService } from '../js/services/export-service.js';
import { createCompositeSceneThumbnailSvg } from '../js/features/scene-book/scene-book-view.js';

test('Panoramic vocabulary defines valid stage widths and camera constants', () => {
  assert.deepEqual(STAGE_WIDTHS, [1600, 3200, 4800]);
  assert.equal(DEFAULT_STAGE_WIDTH, 1600);
  assert.equal(isStageWidth(1600), true);
  assert.equal(isStageWidth(3200), true);
  assert.equal(isStageWidth(4800), true);
  assert.equal(isStageWidth(2400), false);
  assert.equal(isStageWidth('3200'), false);
  assert.equal(isStageWidth(null), false);

  assert.equal(CAMERA_CONSTANTS.DEFAULT_CAMERA_X, 0);
  assert.ok(CAMERA_CONSTANTS.STEP > 0);
  assert.ok(CAMERA_CONSTANTS.EDGE_ZONE > 0);
  assert.ok(CAMERA_CONSTANTS.EDGE_SPEED > 0);
});

test('clampCameraX clamps camera position within [0, stageWidth - 1600]', () => {
  // 1600 stage: maxCameraX is 0
  assert.equal(clampCameraX(-50, 1600), 0);
  assert.equal(clampCameraX(0, 1600), 0);
  assert.equal(clampCameraX(500, 1600), 0);

  // 3200 stage: maxCameraX is 1600
  assert.equal(clampCameraX(-100, 3200), 0);
  assert.equal(clampCameraX(600, 3200), 600);
  assert.equal(clampCameraX(1600, 3200), 1600);
  assert.equal(clampCameraX(2000, 3200), 1600);

  // 4800 stage: maxCameraX is 3200
  assert.equal(clampCameraX(-20, 4800), 0);
  assert.equal(clampCameraX(2400, 4800), 2400);
  assert.equal(clampCameraX(3200, 4800), 3200);
  assert.equal(clampCameraX(5000, 4800), 3200);
});

test('clientToLogical and logicalToClient account for cameraX offset', () => {
  const stageRect = { left: 100, top: 50, width: 800, height: 450 }; // 0.5x scale
  const cameraX = 800;

  // Client coordinate (500, 275) is middle of viewport -> logical viewport center is (800, 450) + cameraX (800) = (1600, 450)
  const logical = clientToLogical(500, 275, stageRect, cameraX);
  assert.equal(logical.x, 1600);
  assert.equal(logical.y, 450);

  // Convert back
  const client = logicalToClient(logical.x, logical.y, stageRect, cameraX);
  assert.equal(client.x, 500);
  assert.equal(client.y, 275);
});

test('Scene factories and sanitization preserve and validate stageWidth and cameraX', () => {
  const empty = createEmptyScene('test-scene');
  assert.equal(empty.stageWidth, 1600);
  assert.equal(empty.cameraX, 0);

  const sample = createSampleScene(createStarterDraft());
  assert.equal(sample.stageWidth, 1600);
  assert.equal(sample.cameraX, 0);

  // Valid wide scene
  const wideCandidate = {
    sceneId: 'wide-scene',
    title: 'Wide Forest',
    backgroundId: 'bg_bedroom',
    stageWidth: 3200,
    cameraX: 650,
    entities: []
  };
  const sanitized = sanitizeScene(wideCandidate);
  assert.equal(sanitized.stageWidth, 3200);
  assert.equal(sanitized.cameraX, 650);

  // Invalid stage width falls back to 1600 and re-clamps cameraX
  const invalidCandidate = {
    sceneId: 'invalid-scene',
    title: 'Invalid Stage',
    backgroundId: 'bg_bedroom',
    stageWidth: 9999,
    cameraX: 1200,
    entities: []
  };
  const sanitizedInvalid = sanitizeScene(invalidCandidate);
  assert.equal(sanitizedInvalid.stageWidth, 1600);
  assert.equal(sanitizedInvalid.cameraX, 0); // clamped to max 0 for 1600
});

test('sanitizing existing scenes repairs pinned wide-stage coordinates', () => {
  const scene = sanitizeScene({
    sceneId: 'existing-wide-scene',
    title: 'Existing scene',
    backgroundId: 'bg_bedroom',
    stageWidth: 1600,
    cameraX: 0,
    updatedAt: '2026-08-01T00:00:00.000Z',
    entities: [{
      instanceId: 'pinned-chair',
      kind: 'prop',
      sourceId: 'prop_chair',
      x: 1599,
      y: 770,
      scale: 1,
      pinned: true,
      order: 1
    }]
  }, getAsset);

  assert.equal(scene.updatedAt, '2026-08-01T00:00:00.000Z');
  assert.ok(scene.entities[0].x <= 1480);
});

test('addEntity and clampPoint clamp coordinates against dynamic stageWidth', () => {
  const wideScene = {
    sceneId: 'wide-1',
    title: 'Wide',
    backgroundId: 'bg_bedroom',
    stageWidth: 3200,
    cameraX: 0,
    entities: []
  };

  const dollEntity = {
    instanceId: 'doll-1',
    kind: 'character',
    sourceId: 'demo_emma',
    characterSnapshot: createStarterDraft(),
    x: 2800,
    y: 720
  };

  const sceneWithDoll = addEntity(wideScene, dollEntity);
  assert.equal(sceneWithDoll.entities.length, 1);
  assert.equal(sceneWithDoll.entities[0].x, 2800); // within 3200 boundary

  // Placed beyond 3200
  const clampedPoint = clampPoint(3500, 720, getEntityBounds(dollEntity), 3200);
  assert.ok(clampedPoint.x <= 3200);
  assert.ok(clampedPoint.x > 3000);
});

test('AppStore handles scene/setStageWidth, reclamping, and undo/redo', () => {
  const store = createAppStore({
    presets: [{ presetId: 'preset-1', name: 'Doll 1', ...createStarterDraft() }],
    scenes: [],
    currentScene: {
      sceneId: 'scene-1',
      title: 'Current',
      backgroundId: 'bg_bedroom',
      stageWidth: 1600,
      cameraX: 0,
      entities: []
    }
  });

  // 1. Expand to 3200
  store.dispatch({ type: 'scene/setStageWidth', stageWidth: 3200 });
  assert.equal(store.getState().currentScene.stageWidth, 3200);

  // 2. Spawn doll in extended region
  store.dispatch({ type: 'scene/spawnCharacter', presetId: 'preset-1', x: 2600, y: 720 });
  const entity = store.getState().currentScene.entities[0];
  assert.ok(entity);
  assert.equal(entity.x, 2600);

  // 3. Pan camera
  store.dispatch({ type: 'scene/setCameraX', cameraX: 1200 });
  assert.equal(store.getState().currentScene.cameraX, 1200);

  // 4. Downsize back to 1600 -> entity must be safely reclamped inside 1600
  store.dispatch({ type: 'scene/setStageWidth', stageWidth: 1600 });
  const downsizedScene = store.getState().currentScene;
  assert.equal(downsizedScene.stageWidth, 1600);
  assert.equal(downsizedScene.cameraX, 0); // camera reclamped to 0
  const reclampedEntity = downsizedScene.entities[0];
  assert.ok(reclampedEntity.x <= 1600, `Entity at ${reclampedEntity.x} should be <= 1600`);

  // 5. Undo restores 3200 stage and original entity position
  store.dispatch({ type: 'app/undo' });
  const undoneScene = store.getState().currentScene;
  assert.equal(undoneScene.stageWidth, 3200);
});

test('downsizing also reclamps pinned entities without unpinning them', () => {
  const store = createAppStore({
    presets: [],
    scenes: [],
    currentScene: {
      sceneId: 'pinned-wide-scene',
      title: 'Wide',
      backgroundId: 'bg_bedroom',
      stageWidth: 3200,
      cameraX: 0,
      entities: [{
        instanceId: 'pinned-chair',
        kind: 'prop',
        sourceId: 'prop_chair',
        x: 2800,
        y: 770,
        scale: 1,
        pinned: true,
        order: 1
      }]
    }
  }, { getAsset });

  store.dispatch({ type: 'scene/setStageWidth', stageWidth: 1600 });
  const entity = store.getState().currentScene.entities[0];
  assert.equal(entity.pinned, true);
  assert.equal(entity.x, 1480);
});

test('AppStore handles scene/panCamera with delta clamping', () => {
  const store = createAppStore({
    presets: [],
    scenes: [],
    currentScene: {
      sceneId: 'scene-1',
      title: 'Current',
      backgroundId: 'bg_bedroom',
      stageWidth: 4800,
      cameraX: 1000,
      entities: []
    }
  });

  store.dispatch({ type: 'scene/panCamera', deltaX: 400 });
  assert.equal(store.getState().currentScene.cameraX, 1400);

  store.dispatch({ type: 'scene/panCamera', deltaX: -1000 });
  assert.equal(store.getState().currentScene.cameraX, 400);

  // Pan past 0
  store.dispatch({ type: 'scene/panCamera', deltaX: -1000 });
  assert.equal(store.getState().currentScene.cameraX, 0);

  // Pan past max (4800 - 1600 = 3200)
  store.dispatch({ type: 'scene/panCamera', deltaX: 5000 });
  assert.equal(store.getState().currentScene.cameraX, 3200);
  assert.equal(store.canUndo(), false, 'camera navigation should not consume undo history');
});

test('wide-stage scaling uses the active stage width', () => {
  const scene = {
    sceneId: 'scale-wide',
    title: 'Wide',
    backgroundId: 'bg_bedroom',
    stageWidth: 3200,
    cameraX: 0,
    entities: [{
      instanceId: 'wide-chair',
      kind: 'prop',
      sourceId: 'prop_chair',
      x: 3000,
      y: 770,
      scale: 1,
      pinned: false,
      order: 1
    }]
  };

  const scaled = scaleEntity(scene, 'wide-chair', 2, getAsset);
  assert.ok(scaled.entities[0].x > 1600);
  assert.equal(scaled.entities[0].x, 2960);
});

test('undo and redo preserve the latest camera position without adding camera history', () => {
  const store = createAppStore({
    presets: [],
    scenes: [],
    currentScene: {
      sceneId: 'camera-history-scene',
      title: 'Wide',
      backgroundId: 'bg_bedroom',
      stageWidth: 3200,
      cameraX: 0,
      entities: []
    }
  }, { getAsset });

  store.dispatch({ type: 'scene/setCameraX', cameraX: 800 });
  store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_chair', x: 2400, y: 770 });
  store.dispatch({ type: 'scene/setCameraX', cameraX: 1200 });
  store.dispatch({ type: 'app/undo' });
  assert.equal(store.getState().currentScene.entities.length, 0);
  assert.equal(store.getState().currentScene.cameraX, 1200);

  store.dispatch({ type: 'app/redo' });
  assert.equal(store.getState().currentScene.entities.length, 1);
  assert.equal(store.getState().currentScene.cameraX, 1200);
});

test('Export service creates canvas with panoramic dimensions and tiles background', async () => {
  const exportService = createExportService({
    loadAssetSvg: async () => {
      const el = {
        cloneNode: () => el,
        setAttribute: () => {},
        getAttribute: () => '0 0 800 500'
      };
      return el;
    },
    svgElementToImage: async () => ({ width: 1600, height: 900 })
  });

  const drawnCalls = [];
  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: (...args) => drawnCalls.push(args),
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {}
    })
  };

  const wideScene = {
    sceneId: 'export-wide',
    title: 'Wide Export',
    backgroundId: 'bg_bedroom',
    stageWidth: 3200,
    cameraX: 0,
    entities: []
  };

  await exportService.renderSceneToCanvas(wideScene, fakeCanvas);
  assert.equal(fakeCanvas.width, 3200);
  assert.equal(fakeCanvas.height, 900);
  // Background drawn 2 times for 3200 width (at x=0 and x=1600)
  const bgDraws = drawnCalls.filter((call) => call[3] === 1600 && call[4] === 900);
  assert.equal(bgDraws.length, 2);
  assert.equal(bgDraws[0][1], 0); // x=0
  assert.equal(bgDraws[1][1], 1600); // x=1600
});

test('Scene Book composite thumbnail SVG creates wide viewBox and tiled background', async () => {
  globalThis.document = {
    createElementNS(ns, tag) {
      const attrs = new Map();
      const children = [];
      const node = {
        tagName: tag,
        style: { setProperty() {} },
        className: '',
        setAttribute(name, val) { attrs.set(name, String(val)); },
        getAttribute(name) { return attrs.get(name) ?? null; },
        appendChild(child) {
          if (child && child.parentNode) {
            const idx = child.parentNode.children.indexOf(child);
            if (idx >= 0) child.parentNode.children.splice(idx, 1);
          }
          if (child) child.parentNode = node;
          children.push(child);
          return child;
        },
        removeChild(child) {
          const idx = children.indexOf(child);
          if (idx >= 0) children.splice(idx, 1);
          if (child) child.parentNode = null;
          return child;
        },
        append(...nodes) {
          for (const n of nodes) node.appendChild(n);
        },
        replaceChildren(...nodes) {
          children.length = 0;
          for (const n of nodes) node.appendChild(n);
        },
        get firstChild() { return children[0] ?? null; },
        get children() { return children; },
        querySelector() { return null; },
        cloneNode() {
          const cloned = globalThis.document.createElementNS(ns, tag);
          for (const [k, v] of attrs) cloned.setAttribute(k, v);
          for (const c of children) cloned.appendChild(c.cloneNode?.() || c);
          return cloned;
        }
      };
      return node;
    }
  };

  const wideScene = {
    sceneId: 'thumb-wide',
    title: 'Wide Thumb',
    backgroundId: 'bg_bedroom',
    stageWidth: 4800,
    cameraX: 0,
    entities: []
  };

  const fakeLoadSvg = async () => {
    const el = globalThis.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('viewBox', '0 0 800 500');
    return el;
  };

  const svg = await createCompositeSceneThumbnailSvg(wideScene, { loadAssetSvg: fakeLoadSvg });
  assert.equal(svg.getAttribute('viewBox'), '0 0 4800 900');
});
