import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPaintSaveService } from '../js/features/paint/paint-save-service.js';
import { TRANSLATIONS } from '../js/core/i18n.js';

function loadCssBundle(entryPath = '../css/app.css') {
  const entryUrl = new URL(entryPath, import.meta.url);
  const entryContent = readFileSync(entryUrl, 'utf8');
  return entryContent.replace(/@import\s+['"]([^'"]+)['"];/g, (_, relativeImport) => {
    const importedUrl = new URL(relativeImport, entryUrl);
    return readFileSync(importedUrl, 'utf8');
  });
}

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = loadCssBundle();
const playJs = readFileSync(new URL('../js/features/play/play-view.js', import.meta.url), 'utf8');
const paintJs = readFileSync(new URL('../js/features/paint/paint-view.js', import.meta.url), 'utf8');

test('Issue 1: Paint studio crops prop pixels on save eliminating transparent offset', async () => {
  let savedMetadata = null;
  const mockCustomArtRepo = {
    computeSha256: async () => 'mocksha256',
    saveArtwork: async (assetId, blob, metadata) => {
      savedMetadata = metadata;
      return { ok: true };
    },
    clearDraft: async () => {}
  };

  const mockStore = {
    dispatch: (action) => {
      if (action.type === 'customAsset/add') return { ok: true };
      return { ok: true };
    }
  };

  const mockSession = {
    getState: () => ({
      name: 'Test Star Prop',
      itemType: 'prop',
      slot: 'custom',
      propSize: 'medium',
      propPlacement: 'surface',
      originContext: 'play'
    }),
    setName: () => {},
    markDirty: () => {},
    logicalWidth: 400,
    logicalHeight: 400
  };

  // Mock a 400x400 canvas with a 50x50 colored box in the center (from 150,150 to 200,200)
  const mockCtx = {
    getImageData: () => {
      const data = new Uint8ClampedArray(400 * 400 * 4);
      for (let y = 150; y < 200; y++) {
        for (let x = 150; x < 200; x++) {
          const idx = (y * 400 + x) * 4;
          data[idx] = 255;
          data[idx + 1] = 100;
          data[idx + 2] = 50;
          data[idx + 3] = 255;
        }
      }
      return { data, width: 400, height: 400 };
    },
    drawImage: () => {}
  };

  const mockCanvas = {
    width: 400,
    height: 400,
    getContext: () => mockCtx,
    toBlob: (cb) => cb(new Blob(['fake-png-data'], { type: 'image/png' }))
  };

  // Polyfill document.createElement for canvas in node test environment
  const hadDocument = 'document' in globalThis;
  const originalDocument = globalThis.document;
  const originalCreateElement = globalThis.document?.createElement;
  try {
    globalThis.document = globalThis.document || {};
    globalThis.document.createElement = (tag) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => mockCtx,
          toBlob: (cb) => cb(new Blob(['cropped-png-data'], { type: 'image/png' }))
        };
      }
      return originalCreateElement ? originalCreateElement(tag) : {};
    };

    const saveService = createPaintSaveService({
      rootElement: { querySelector: () => null },
      store: mockStore,
      getSession: () => mockSession,
      getCanvasState: () => ({ canvas: mockCanvas, ctx: mockCtx }),
      customArtRepo: mockCustomArtRepo,
      announceStatus: () => {}
    });

    await saveService.commitSave(false);

    assert.ok(savedMetadata);
    assert.equal(savedMetadata.name, 'Test Star Prop');
    assert.equal(savedMetadata.kind, 'prop');
    // Bounds were 150..199 -> width 50, height 50
    assert.equal(savedMetadata.pixelWidth, 50);
    assert.equal(savedMetadata.pixelHeight, 50);
  } finally {
    if (!hadDocument) {
      delete globalThis.document;
    } else {
      globalThis.document = originalDocument;
      if (originalCreateElement) {
        globalThis.document.createElement = originalCreateElement;
      } else {
        delete globalThis.document.createElement;
      }
    }
  }
});

test('failed artwork metadata commit cleans up the saved binary', async () => {
  let deletedAssetId = null;
  const mockCustomArtRepo = {
    computeSha256: async () => 'mocksha256',
    saveArtwork: async () => ({ ok: true }),
    deleteArtwork: async (assetId) => {
      deletedAssetId = assetId;
      return { ok: true };
    }
  };
  const mockSession = {
    getState: () => ({
      name: 'Failed Shirt',
      itemType: 'wearable',
      slot: 'top',
      originContext: 'designer'
    }),
    setName: () => {},
    markDirty: () => {},
    logicalWidth: 300,
    logicalHeight: 450
  };
  const mockCanvas = {
    width: 2,
    height: 2,
    toBlob: (callback) => callback(new Blob(['png'], { type: 'image/png' }))
  };

  const saveService = createPaintSaveService({
    rootElement: { querySelector: () => null },
    store: { dispatch: () => ({ ok: false, code: 'LIMIT' }) },
    getSession: () => mockSession,
    getCanvasState: () => ({ canvas: mockCanvas, ctx: {} }),
    customArtRepo: mockCustomArtRepo,
    showAlert: async () => {},
    announceStatus: () => {}
  });

  await saveService.commitSave(false);

  assert.match(deletedAssetId, /^custom_/);
});

test('Issue 1: Scene entity positioner and visual use dynamic anchor variables in CSS and play-view', () => {
  assert.match(playJs, /--anchor-x/);
  assert.match(playJs, /--anchor-y/);
  assert.match(css, /var\(--anchor-x,\s*0\.5\)/);
  assert.match(css, /var\(--anchor-y,\s*1\)/);
  assert.match(css, /\.scene-custom-prop-img/);
});

test('Issue 2: Selection cancel/delete and deselect buttons exist in HTML, JS, and i18n', () => {
  // HTML / JS elements
  assert.match(playJs, /'deselect'/);
  assert.match(html, /id="paint-selection-options"/);
  assert.match(html, /id="paint-selection-delete-btn"/);
  assert.match(html, /id="paint-selection-cancel-btn"/);
  assert.match(html, /id="paint-selection-flip-btn"/);
  assert.match(html, /id="paint-selection-duplicate-btn"/);

  // i18n Turkish keys
  assert.ok(TRANSLATIONS.tr.play.deselectItem);
  assert.ok(TRANSLATIONS.tr.paint.cancelSelectionBtn);
  assert.ok(TRANSLATIONS.tr.paint.deleteSelectionBtn);
  assert.ok(TRANSLATIONS.tr.paint.flipSelectionBtn);
  assert.ok(TRANSLATIONS.tr.paint.duplicateSelectionBtn);

  // i18n English keys
  assert.ok(TRANSLATIONS.en.play.deselectItem);
  assert.ok(TRANSLATIONS.en.paint.cancelSelectionBtn);
  assert.ok(TRANSLATIONS.en.paint.deleteSelectionBtn);
  assert.ok(TRANSLATIONS.en.paint.flipSelectionBtn);
  assert.ok(TRANSLATIONS.en.paint.duplicateSelectionBtn);

  // Paint view bindings
  assert.match(paintJs, /selectionDeleteBtn/);
  assert.match(paintJs, /selectionCancelBtn/);
  assert.match(paintJs, /selectionFlipBtn/);
  assert.match(paintJs, /selectionDuplicateBtn/);

  // Play view deselect handling
  assert.match(playJs, /action === 'deselect'/);
});

test('Issue 3: Play inspector panel exists below stage and contains expression and bubble controls', () => {
  // HTML structure
  assert.match(html, /class="play-stage-column"/);
  assert.match(html, /id="play-inspector-panel"/);
  assert.match(html, /id="inspector-tabs"/);
  assert.match(html, /id="inspector-tab-expressions"/);
  assert.match(html, /id="inspector-tab-motion"/);
  assert.match(html, /id="inspector-tab-joints"/);
  assert.match(html, /id="inspector-tab-bubble"/);

  // Expressions and bubble controls are inside the inspector panel
  const inspectorPanelStart = html.indexOf('id="play-inspector-panel"');
  const inspectorPanelContent = html.slice(inspectorPanelStart, html.indexOf('</aside>', inspectorPanelStart));
  assert.match(inspectorPanelContent, /id="character-expression-controls"/);
  assert.match(inspectorPanelContent, /id="character-pose-controls"/);
  assert.match(inspectorPanelContent, /id="character-animation-clip-controls"/);
  assert.match(inspectorPanelContent, /id="bubble-controls"/);

  // CSS inspector panel styling
  assert.match(css, /\.play-inspector-panel/);
  assert.match(css, /\.inspector-tabs/);

  // Play view tabs logic
  assert.match(playJs, /initInspectorTabs/);
  assert.match(playJs, /activeInspectorTab/);
});
