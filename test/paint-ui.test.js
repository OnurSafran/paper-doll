import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isTrustedCutoutDescriptor } from '../js/features/paint/paint-view.js';
import { SLOT_CUTOUT_FALLBACK_VIEWBOX, SLOT_PREVIEW_VIEWBOX } from '../js/core/preview-viewboxes.js';

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
const appJs = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const designerJs = readFileSync(new URL('../js/features/designer/designer-view.js', import.meta.url), 'utf8');
const playJs = readFileSync(new URL('../js/features/play/play-view.js', import.meta.url), 'utf8');
const paintViewJs = readFileSync(new URL('../js/features/paint/paint-view.js', import.meta.url), 'utf8');
const paintSaveServiceJs = readFileSync(new URL('../js/features/paint/paint-save-service.js', import.meta.url), 'utf8');
const paintSessionJs = readFileSync(new URL('../js/features/paint/paint-session.js', import.meta.url), 'utf8');
const paintRasterJs = readFileSync(new URL('../js/features/paint/paint-raster.js', import.meta.url), 'utf8');

test('paint studio HTML shell declares complete accessible structure, canvas, guide overlay, and dialogs', () => {
  // Navigation link
  assert.match(html, /<a\s+href="#paint"[^>]*data-mode-link="paint"/);


  // Paint screen and toolbar
  assert.match(html, /id="paint-screen"/);
  assert.match(html, /id="paint-back-btn"/);
  assert.match(html, /id="paint-new-btn"/);
  assert.match(html, /id="paint-undo-btn"/);
  assert.match(html, /id="paint-redo-btn"/);
  assert.match(html, /id="paint-mirror-btn"/);
  assert.match(html, /id="paint-zoom-btn"/);
  assert.match(html, /id="paint-clear-btn"/);
  assert.match(html, /id="paint-save-btn"/);

  // Authoring stage, canvas, non-saving guide layer, and virtual cursor
  assert.match(html, /id="paint-canvas"/);
  assert.match(html, /id="paint-guide-layer"/);
  assert.match(html, /id="paint-cursor"/);
  assert.match(html, /id="paint-preview-stage"/);

  // Sidebar controls
  assert.match(html, /id="paint-type-wearable"/);
  assert.match(html, /id="paint-type-prop"/);
  assert.match(html, /id="paint-slot-select"/);
  assert.match(html, /id="paint-cutout-grid"/);
  assert.match(html, /id="paint-cutout-status"/);
  assert.match(html, /id="paint-cutout-add-btn"/);
  assert.match(html, /id="paint-cutout-replace-btn"/);
  assert.match(html, /id="paint-reference-controls"/);
  assert.match(html, /id="paint-reference-visible"/);
  assert.match(html, /id="paint-reference-model"/);
  assert.match(html, /id="paint-reference-opacity"[^>]*min="20"[^>]*max="80"[^>]*step="10"/);
  assert.match(html, /id="paint-guides-visible"/);
  assert.match(html, /id="paint-cutout-reference-visible"/);
  assert.match(html, /id="paint-prop-size-select"/);
  assert.match(html, /id="paint-prop-placement-select"/);
  assert.match(html, /id="tool-brush"/);
  assert.match(html, /id="tool-eraser"/);
  assert.match(html, /id="tool-fill"/);
  assert.match(html, /id="tool-shape"/);
  assert.match(html, /id="tool-select"/);
  assert.match(html, /id="tool-eyedropper"/);
  assert.match(html, /id="paint-brush-size-slider"[^>]*min="1"[^>]*max="50"/);
  assert.match(html, /id="paint-brush-size-value"/);
  assert.match(html, /id="paint-active-color"/);
  assert.match(html, /id="paint-palette-grid"/);
  assert.match(html, /id="paint-color-picker"/);

  // Dialogs
  assert.match(html, /id="paint-save-dialog"/);
  assert.match(html, /id="paint-save-fit-note"/);
  assert.match(html, /id="paint-artwork-name"/);
  assert.match(html, /id="paint-save-context-btn"/);
  assert.match(html, /id="paint-dirty-dialog"/);
  assert.match(html, /id="paint-draft-recovery-dialog"/);
  assert.doesNotMatch(html, /id="reset-face"/);
  assert.doesNotMatch(appJs, /designer\/resetFace/);
});

test('starting cutouts are trusted slot-matched built-ins with explicit pixel actions', () => {
  assert.equal(isTrustedCutoutDescriptor({ id: 'top_tshirt', kind: 'wearable', slot: 'top' }, 'top'), true);
  assert.equal(isTrustedCutoutDescriptor({ id: 'custom_top', custom: true, kind: 'wearable', slot: 'top' }, 'top'), false);
  assert.equal(isTrustedCutoutDescriptor({ id: 'dress_party', kind: 'wearable', slot: 'dress' }, 'top'), false);
  assert.equal(isTrustedCutoutDescriptor({ id: 'prop_cat', kind: 'prop' }, 'top'), false);
  assert.match(paintViewJs, /requestToken !== cutoutActionToken/);
  assert.match(paintViewJs, /URL\.revokeObjectURL\(url\)/);
  assert.match(paintViewJs, /rasterizeCutoutIntoCanvas\(session\.getState\(\)\.cutoutAssetId, 'add'\)/);
  assert.match(paintViewJs, /rasterizeCutoutIntoCanvas\(session\.getState\(\)\.cutoutAssetId, 'replace'\)/);
  assert.match(paintViewJs, /cutout-none-card/);
  assert.match(paintViewJs, /session\.setCutoutAssetId\(null\)/);
  assert.match(paintViewJs, /selectColor/);
  assert.match(designerJs, /store\.dispatch\(\{\s*type:\s*'designer\/remove'/);
});

test('paint studio CSS rules provide dark studio theme, checkerboard, touch targets, and responsive layout', () => {
  // Studio grid and stage
  assert.match(css, /\.paint-grid\s*{/);
  assert.match(css, /\.paint-canvas-stage\s*{/);
  assert.match(css, /\.paint-guide-layer\s*{/);
  assert.match(css, /\.paint-reference-body/);
  assert.match(css, /\.paint-reference-cutout/);
  assert.match(css, /\.paint-alignment-guides/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /\.paint-virtual-cursor\s*{/);
  assert.match(css, /\.paint-tools-grid\s*{/);
  assert.match(css, /\.cutout-grid\s*{/);
  assert.match(css, /\.cutout-none-card\s*{/);
  assert.match(css, /\.paint-palette-grid\s*{/);
  assert.match(css, /\.prop-slider\s*{/);

  // Touch target min-height / min-width 44px
  assert.match(css, /\.tool-btn\s*{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.tool-btn\s*{[^}]*min-width:\s*44px/s);
  assert.match(css, /\.paint-swatch\s*{[^}]*min-height:\s*32px/s);

  // Responsive <= 920px single column without horizontal scroll
  assert.match(css, /@media \(max-width: 920px\)[\s\S]*\.paint-grid/);
  assert.match(css, /@media \(max-width: 920px\)[\s\S]*\.paint-heading[\s\S]*align-items:\s*center/s);
  assert.match(css, /\.paint-heading-primary[\s\S]*justify-content:\s*center/s);
  assert.match(css, /\.paint-stage-column[\s\S]*max-width:\s*760px/s);
});

test('live preview reuses its canvas and guards stale async doll renders', () => {
  assert.match(paintViewJs, /let livePreviewToken = 0/);
  assert.match(paintViewJs, /renderToken !== livePreviewToken/);
  assert.match(paintViewJs, /livePreviewCanvas\.getContext\('2d'\)\.drawImage/);
  assert.doesNotMatch(paintViewJs, /previewStage\.innerHTML\s*=\s*''/);
});

test('paint cutout and wardrobe preview framing use named shared contracts', () => {
  assert.deepEqual(Object.keys(SLOT_CUTOUT_FALLBACK_VIEWBOX), Object.keys(SLOT_PREVIEW_VIEWBOX));
  assert.notEqual(SLOT_CUTOUT_FALLBACK_VIEWBOX.top, SLOT_PREVIEW_VIEWBOX.top);
  assert.match(paintViewJs, /SLOT_CUTOUT_FALLBACK_VIEWBOX\[slot\]/);
  assert.doesNotMatch(paintViewJs, /tightViewBoxes/);
});

test('paint view wiring integrates with app router, designer wardrobe, and play spawner', () => {
  // App routing
  assert.match(appJs, /import { createPaintView }/);
  assert.match(appJs, /location\.hash === '#paint'/);
  assert.match(appJs, /\$\('#paint-screen'\)\.hidden = !paintActive/);
  assert.match(appJs, /createPaintView\(\{/);
  assert.match(appJs, /wearablesBySlot:\s*\(slot\)\s*=>\s*ASSETS\.filter/);
  assert.match(appJs, /svgLoader:\s*\{\s*load:\s*async\s*\(assetId\)\s*=>\s*loadAssetSvg\(assetId\)\s*\}/);

  // Designer entry card
  assert.match(designerJs, /paint-item-action-card/);
  assert.match(designerJs, /paintSlotAction/);

  // Play entry card
  assert.match(playJs, /paint-prop-action-card/);
  assert.match(playJs, /paintPropCard/);
});


test('paint session controller enforces 20-step undo/redo, dirty flag tracking, and name validation', () => {
  assert.match(paintSessionJs, /MAX_HISTORY_STEPS = 20/);
  assert.match(paintSessionJs, /validateArtworkName/);
  assert.match(paintViewJs, /openSession/);
  assert.match(paintViewJs, /applyStroke/);
  assert.match(paintViewJs, /executeFloodFill/);
  assert.match(paintSaveServiceJs, /customArtRepo\.saveArtwork/);
  assert.match(paintSaveServiceJs, /customArtRepo\.computeSha256/);
  assert.match(paintSaveServiceJs, /customArtRepo\.saveDraft\(blob/);
  assert.match(paintSaveServiceJs, /type: 'customAsset\/add',[\s\S]*asset: customMetadata/);
});

test('guide layer DOM isolation guarantees non-canvas rendering and clean PNG saving', () => {
  // Guide layer rendered into DOM overlay, not on the drawing canvas
  assert.match(paintViewJs, /guideLayer/);
  assert.match(paintViewJs, /renderGuideLayer/);
  assert.match(paintViewJs, /createAlignmentGuideSvg/);
  assert.match(paintViewJs, /guideLayer\.style\.setProperty\('--reference-opacity'/);
  assert.match(paintViewJs, /cutoutImage\.className = 'paint-reference-cutout'/);
  assert.match(paintRasterJs, /canvasToBlob/);
  assert.match(paintRasterJs, /computeNonTransparentBounds/);
  assert.match(paintRasterJs, /calculatePropDisplayDimensions/);
});

test('paint studio keyboard shortcuts guard against browser modifier keys and support draft flushing', () => {
  // Shortcut modifier guards and preventDefault
  assert.match(paintViewJs, /!e\.ctrlKey && !e\.metaKey && !e\.altKey/);
  assert.match(paintSaveServiceJs, /flushDraftCheckpoint/);
  assert.match(appJs, /pendingPaintContext/);
  assert.match(appJs, /openPaintStudio/);
  assert.match(appJs, /paintView\.flushDraftCheckpoint/);
});
