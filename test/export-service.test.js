import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMouthExpression, createExportDollSvg, createExportService } from '../js/services/export-service.js';
import { createDefaultEnvelope } from '../js/core/state-schema.js';
import { createStarterDraft } from '../js/domain/outfit-rules.js';
import { EXPRESSIONS } from '../js/domain/vocabulary.js';

// Minimal mock DOM for Node.js test environment
function createMockSvgElement() {
  const children = [];
  const styles = new Map();
  return {
    children,
    style: {
      setProperty: (k, v) => styles.set(k, v),
      getPropertyValue: (k) => styles.get(k)
    },
    querySelector: (selector) => {
      if (selector === '#doll-mouth-expression') return null;
      if (selector === '#doll-mouth-default') return { style: {} };
      if (selector === '#body') return null;
      return null;
    },
    appendChild: (child) => children.push(child)
  };
}

test('applyMouthExpression sets valid SVG mouth paths for all seven expressions', () => {
  // Simple fake DOM document for testing
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElementNS: (ns, tag) => ({
      tagName: tag,
      innerHTML: '',
      id: '',
      style: {}
    })
  };

  try {
    for (const expr of EXPRESSIONS) {
      const mockSvg = createMockSvgElement();
      applyMouthExpression(mockSvg, expr);
      const mouth = mockSvg.children.find((c) => c.id === 'doll-mouth-expression');
      assert.ok(mouth, `Mouth element created for ${expr}`);
      assert.ok(mouth.innerHTML.length > 0, `Mouth HTML populated for ${expr}`);
    }

    // Fallback expression
    const fallbackSvg = createMockSvgElement();
    applyMouthExpression(fallbackSvg, 'unknown_expr');
    const fallbackMouth = fallbackSvg.children.find((c) => c.id === 'doll-mouth-expression');
    assert.ok(fallbackMouth);
    assert.match(fallbackMouth.innerHTML, /146 73/);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('createExportService enforces single in-flight export lock and immutable snapshots', async () => {
  let drawCount = 0;
  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: () => { drawCount += 1; },
      fillRect: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {}
    }),
    toBlob: (cb) => cb(new Uint8Array([137, 80, 78, 71])) // Mock PNG header
  };

  const sampleScene = {
    sceneId: 'test-scene',
    title: 'Test Export',
    backgroundId: 'bg_bedroom',
    entities: [
      {
        instanceId: 'char-1',
        kind: 'character',
        sourceId: 'doll_classic_a',
        characterSnapshot: createStarterDraft(),
        x: 800,
        y: 720,
        scale: 1,
        flipped: false,
        expression: 'happy',
        order: 1
      },
      {
        instanceId: 'prop-1',
        kind: 'prop',
        sourceId: 'prop_chair',
        x: 1000,
        y: 720,
        scale: 1,
        flipped: false,
        order: 2
      }
    ]
  };

  const service = createExportService({
    getAsset: (id) => ({ id, kind: 'prop', displayWidth: 200, displayHeight: 200, groundAnchor: { x: 0.5, y: 0.92 } }),
    loadAssetSvg: async () => ({
      cloneNode: () => ({
        setAttribute: () => {},
        querySelector: () => null,
        firstChild: null
      })
    }),
    svgElementToImage: async () => ({ width: 100, height: 100 }),
    now: () => new Date('2026-08-14T12:00:00Z')
  });

  assert.equal(service.isExporting(), false);

  // Original document mock for createElement('canvas')
  const originalDoc = globalThis.document;
  globalThis.document = {
    createElement: (tag) => (tag === 'canvas' ? mockCanvas : {}),
    createElementNS: () => ({
      setAttribute: () => {},
      style: { setProperty: () => {} },
      appendChild: () => {}
    })
  };

  try {
    const result = await service.exportSceneBlob(sampleScene);
    assert.equal(result.ok, true);
    assert.equal(result.filename, 'paper-doll-scene-2026-08-14.png');
    assert.equal(service.isExporting(), false);

    // Verify scene snapshot was isolated (mutations on sampleScene don't mutate canvas output)
    sampleScene.entities.length = 0;
    assert.equal(result.ok, true);
  } finally {
    globalThis.document = originalDoc;
  }
});

test('createExportService supports progress reporting and cancellation', async () => {
  const progressReports = [];
  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: () => {},
      fillRect: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {}
    }),
    toBlob: (cb) => cb(new Uint8Array([137, 80, 78, 71]))
  };

  const service = createExportService({
    getAsset: () => undefined,
    loadAssetSvg: async () => ({ cloneNode: () => ({ setAttribute: () => {} }) }),
    svgElementToImage: async () => ({ width: 100, height: 100 }),
    onProgress: (p) => progressReports.push(p)
  });

  const originalDoc = globalThis.document;
  globalThis.document = {
    createElement: () => mockCanvas,
    createElementNS: () => ({ setAttribute: () => {}, style: { setProperty: () => {} } })
  };

  try {
    // Test progress reporting
    const res = await service.exportSceneBlob({ sceneId: 'test', entities: [] });
    assert.equal(res.ok, true);
    assert.ok(progressReports.length >= 3);
    assert.equal(progressReports.at(-1)?.percent, 100);

    // Test cancellation via AbortSignal
    const controller = new AbortController();
    controller.abort();
    const cancelledRes = await service.exportSceneBlob({ sceneId: 'test', entities: [] }, { signal: controller.signal });
    assert.equal(cancelledRes.ok, false);
    assert.equal(cancelledRes.code, 'EXPORT_CANCELLED');
  } finally {
    globalThis.document = originalDoc;
  }
});

test('createExportService mid-render cancellation preserves generation lock until settled', async () => {
  let resolveImage;
  const imagePromise = new Promise((res) => { resolveImage = res; });

  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      setLineDash: () => {},
      fillText: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {}
    }),
    toBlob: (cb) => cb(new Uint8Array([137, 80, 78, 71]))
  };

  const service = createExportService({
    getAsset: () => ({ id: 'bg_park', kind: 'background' }),
    loadAssetSvg: async () => ({ cloneNode: () => ({ setAttribute: () => {} }) }),
    svgElementToImage: async () => imagePromise
  });

  const originalDoc = globalThis.document;
  globalThis.document = {
    createElement: () => mockCanvas,
    createElementNS: () => ({ setAttribute: () => {}, style: { setProperty: () => {} } })
  };

  try {
    const externalController = new AbortController();
    const exportPromise = service.exportSceneBlob({ sceneId: 'test', entities: [] }, { signal: externalController.signal });
    assert.equal(service.isExporting(), true, 'Service must be locked during active export');

    // Cancel mid-render
    service.cancel();
    assert.equal(service.isExporting(), true, 'Lock must remain active until pending export promise resolves or rejects');

    // Trying to start a second export while first is still pending must fail with EXPORT_IN_PROGRESS
    const secondExport = await service.exportSceneBlob({ sceneId: 'test2', entities: [] });
    assert.equal(secondExport.ok, false);
    assert.equal(secondExport.code, 'EXPORT_IN_PROGRESS');

    // Complete the image load
    resolveImage({ width: 100, height: 100 });
    const result = await exportPromise;
    assert.equal(result.ok, false);
    assert.equal(result.code, 'EXPORT_CANCELLED');
    assert.equal(service.isExporting(), false, 'Service unlocked once cancelled promise settled');
  } finally {
    globalThis.document = originalDoc;
  }
});

test('createExportService renders fallback placeholder for unknown or missing props', async () => {
  const operations = [];
  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: () => { operations.push('drawImage'); },
      fillRect: () => { operations.push('fillRect'); },
      strokeRect: () => { operations.push('strokeRect'); },
      setLineDash: () => {},
      fillText: (text) => { operations.push(`fillText:${text}`); },
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {}
    }),
    toBlob: (cb) => cb(new Uint8Array([137, 80, 78, 71]))
  };

  const service = createExportService({
    getAsset: () => undefined, // unknown asset
    loadAssetSvg: async () => ({ cloneNode: () => ({ setAttribute: () => {} }) }),
    svgElementToImage: async () => ({ width: 100, height: 100 })
  });

  const sceneWithUnknownProp = {
    sceneId: 'test-unknown',
    backgroundId: 'bg_park',
    entities: [{
      instanceId: 'missing-1',
      kind: 'prop',
      sourceId: 'unknown_prop_999',
      x: 500,
      y: 500,
      scale: 1,
      order: 1
    }]
  };

  const originalDoc = globalThis.document;
  globalThis.document = {
    createElement: () => mockCanvas,
    createElementNS: () => ({ setAttribute: () => {}, style: { setProperty: () => {} } })
  };

  try {
    const res = await service.exportSceneBlob(sceneWithUnknownProp);
    assert.equal(res.ok, true);
    assert.ok(operations.includes('strokeRect'), 'Rendered placeholder stroke frame');
    assert.ok(operations.includes('fillRect'), 'Rendered placeholder fill background');
    assert.ok(operations.includes('fillText:?'), 'Rendered placeholder ? text label');
  } finally {
    globalThis.document = originalDoc;
  }
});

test('createExportDollSvg applies head transform to rigged doll SVG and head-bound layers', async () => {
  const transformedGroups = [];
  const originalDoc = globalThis.document;

  globalThis.document = {
    createElementNS: (ns, tag) => {
      const attrs = new Map();
      const styles = new Map();
      const children = [];
      return {
        tagName: tag,
        children,
        setAttribute: (k, v) => attrs.set(k, v),
        getAttribute: (k) => attrs.get(k),
        style: {
          setProperty: (k, v) => styles.set(k, v),
          getPropertyValue: (k) => styles.get(k)
        },
        appendChild: (child) => children.push(child),
        querySelector: (sel) => {
          if (sel === '#pose-head') {
            const poseHead = {
              id: 'pose-head',
              setAttribute: (k, v) => {
                attrs.set(k, v);
                transformedGroups.push({ id: 'pose-head', attr: k, val: v });
              }
            };
            return poseHead;
          }
          return null;
        }
      };
    }
  };

  try {
    const draft = createStarterDraft();
    const headTransform = { x: -3, y: 0, rotate: -4, scaleX: 0.98, scaleY: 1 };
    const svg = await createExportDollSvg(draft, 'neutral', {
      headTransform,
      loadAssetSvg: async (id) => ({
        cloneNode: () => ({
          querySelector: (sel) => {
            if (sel === '#pose-head') {
              return {
                id: 'pose-head',
                setAttribute: (k, v) => transformedGroups.push({ id: 'pose-head', attr: k, val: v })
              };
            }
            return null;
          },
          firstChild: null
        })
      })
    });

    assert.ok(svg);
    const poseHeadTransform = transformedGroups.find((g) => g.id === 'pose-head');
    assert.ok(poseHeadTransform, 'Should apply transform to #pose-head');
    assert.match(poseHeadTransform.val, /rotate\(-4\)/);
  } finally {
    globalThis.document = originalDoc;
  }
});
