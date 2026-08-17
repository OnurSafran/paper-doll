import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
const js = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const exportJs = readFileSync(new URL('../js/services/export-service.js', import.meta.url), 'utf8');
const playJs = readFileSync(new URL('../js/features/play/play-view.js', import.meta.url), 'utf8');
const designerJs = readFileSync(new URL('../js/features/designer/designer-view.js', import.meta.url), 'utf8');
const sceneBookJs = readFileSync(new URL('../js/features/scene-book/scene-book-view.js', import.meta.url), 'utf8');

test('app shell keeps unique IDs and no remote runtime dependencies', () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.doesNotMatch(html, /<(?:script|link|img)\b[^>]+(?:src|href)="https?:\/\//i);
});

test('stage-first UI exposes the visual spawner and derived scene HUD hooks', () => {
  for (const id of ['spawn-items', 'play-stage', 'scene-name-chip', 'scene-count-chip']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(css, /grid-template-areas:\s*"scene spawn"/);
  assert.match(css, /\.spawn-list\s*{[^}]*grid-template-columns:\s*repeat\(2/s);
});

test('responsive UI preserves a non-drag layout path on narrow screens', () => {
  assert.match(css, /@media \(max-width: 920px\)[\s\S]*\.designer-grid, \.play-grid\s*{\s*display: flex;\s*flex-direction: column;/);
  assert.match(playJs, /spawn-item/);
});

test('cross-tab recovery ignores temporary write keys', () => {
  assert.match(js, /event\.key === STORAGE_KEY/);
  assert.doesNotMatch(js, /event\.key\?\.startsWith/);
});

test('tabs and top scene actions retain 44 pixel targets', () => {
  assert.match(css, /\.tab-list button\s*{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.top-entity-actions button\s*{[^}]*min-width:\s*44px[^}]*min-height:\s*44px/s);
});

test('pointer cancellation remains safe across mixed cached module versions', () => {
  assert.match(js, /function cancelPointerController\(\)/);
  assert.match(playJs, /typeof cancel === 'function'/);
  assert.doesNotMatch(playJs, /pointerController\?\.cancel\(\)/);
  assert.match(playJs, /pointer-controller\.js\?v=2/);
  assert.match(html, /js\/app\.js\?v=4/);
});

test('Designer uses one viewport workspace with a deliberate scrolling rail', () => {
  assert.match(html, /class="designer-sidebar"/);
  assert.doesNotMatch(html, /class="stage-caption"/);
  assert.match(css, /#designer-screen\s*{[^}]*height:\s*calc\(100dvh - var\(--app-header-height\)\)[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.designer-sidebar\s*{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /--app-header-height:\s*58px/);
});

test('history controls and export button expose accessible semantics and touch targets', () => {
  assert.match(html, /id="undo-button"[^>]*disabled/);
  assert.match(html, /id="redo-button"[^>]*disabled/);
  assert.match(html, /id="export-scene-png"/);
  assert.match(css, /\.history-btn\s*{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.history-btn\s*{[^}]*min-width:\s*44px/s);
  assert.match(js, /store\.dispatch\(\{\s*type:\s*'app\/undo'\s*\}\)/);
  assert.match(js, /store\.dispatch\(\{\s*type:\s*'app\/redo'\s*\}\)/);
  assert.match(js, /exportSceneAsPng/);
});

test('scene library and character expression controls expose dialogs and accessible handlers', () => {
  assert.match(html, /id="scene-library-btn"/);
  assert.match(html, /id="save-scene-btn"/);
  assert.match(html, /id="voice-puppetry-btn"/);
  assert.match(html, /id="scene-library-dialog"/);
  assert.match(html, /id="save-scene-dialog"/);
  assert.match(html, /id="character-expression-controls"/);
  assert.match(css, /\.library-dialog\s*{/);
  assert.match(css, /\.scene-card\s*{/);
  assert.match(css, /\.expression-buttons\s*{/);
  assert.match(js, /scene\/saveToLibrary/);
  assert.match(sceneBookJs, /scene\/loadFromLibrary/);
  assert.match(js, /scene\/setDollExpression/);
  assert.match(js, /toggleVoicePuppetry/);
  assert.match(css, /\.expression-buttons button\s*{[^}]*min-width:\s*44px[^}]*min-height:\s*44px/s);
  assert.match(css, /\.scene-card-actions button\s*{[^}]*min-height:\s*44px/s);
});

test('dialogs, export coordinates, drag cleanup, and voice puppetry enforce safety contracts', () => {
  // Dialog resets returnValue before opening
  assert.match(html, /id="confirm-dialog"/);
  assert.match(html, /id="confirm-ok"/);
  assert.match(html, /id="confirm-cancel"/);
  assert.match(js, /dialog\.returnValue\s*=\s*'';\s*\$\('#confirm-title'\)/);

  // PNG export accurately offsets props and characters without NaN
  assert.match(exportJs, /ctx\.drawImage\(\s*propImg,\s*-renderW\s*\*\s*bounds\.anchorX,\s*-renderH\s*\*\s*bounds\.anchorY,\s*renderW,\s*renderH\s*\)/);
  assert.match(exportJs, /createExportDollSvg\(entity\.characterSnapshot,\s*entity\.expression\s*\|\|\s*(DEFAULT_EXPRESSION|'neutral')/);

  // Pointer drag cleans up is-dragging class
  assert.match(playJs, /onCommit\(instanceId,\s*element,\s*event\)\s*{\s*element\?\.classList\?\.remove\('is-dragging'\)/);
  assert.match(playJs, /onCancel\(instanceId,\s*element\)\s*{\s*element\?\.classList\?\.remove\('is-dragging'\)/);

  // Voice puppetry stops on navigation and page visibility changes
  assert.match(js, /stopVoicePuppetry\(\)/);
});

test('project portability and backup controls expose accessible dialogs, dropzones, and handlers', () => {
  assert.match(html, /id="project-menu-btn"/);
  assert.match(html, /id="project-dialog"/);
  assert.match(html, /id="export-project-btn"/);
  assert.match(html, /id="import-dropzone"/);
  assert.match(html, /id="project-file-input"/);
  assert.match(html, /id="import-merge-btn"/);
  assert.match(html, /id="import-replace-btn"/);
  assert.match(html, /id="restore-backup-btn"/);
  assert.match(html, /id="project-hard-reset-btn"/);
  assert.match(html, /id="footer-hard-reset-btn"/);
  assert.match(html, /class="app-footer"/);
  assert.match(css, /\.project-dialog\s*{/);
  assert.match(css, /\.import-dropzone\s*{/);
  assert.match(css, /\.import-preview-card\s*{/);
  assert.match(css, /\.app-footer\s*{/);
  assert.match(js, /openProjectDialog/);
  assert.match(js, /exportProjectJsonFile/);
  assert.match(js, /handleProjectFile/);
  assert.match(js, /handleHardResetAction/);
  assert.match(js, /window\.hardRefresh/);
});

test('scene stickiness and pinning expose accessible HUD controls, visual badge, and keyboard shortcuts', () => {
  assert.match(html, /id="pin-item-btn"/);
  assert.match(html, /id="detach-item-btn"/);
  assert.match(html, /data-action="togglePin"/);
  assert.match(html, /data-action="detach"/);
  assert.match(css, /\.scene-entity-positioner\.is-pinned\s*{/);
  assert.match(css, /\.pinned-badge\s*{/);
  assert.match(playJs, /action === 'togglePin'/);
  assert.match(playJs, /action === 'detach'/);
  assert.match(playJs, /event\.key\.toLowerCase\(\)\s*===\s*'p'/);
});

test('speech bubbles and captions expose accessible controls, spawner tabs, dialogs, and SVG rendering', () => {
  assert.match(html, /id="bubble-controls"/);
  assert.match(html, /id="edit-bubble-text-btn"/);
  assert.match(html, /data-bubble-style="speech"/);
  assert.match(html, /data-bubble-style="thought"/);
  assert.match(html, /data-bubble-style="shout"/);
  assert.match(html, /data-bubble-style="caption"/);
  assert.match(html, /id="bubble-text-dialog"/);
  assert.match(html, /id="bubble-text-input"/);
  assert.match(html, /id="bubble-char-count"/);

  assert.match(css, /\.scene-entity-positioner\.is-bubble-entity\s*{/);
  assert.match(css, /\.bubble-style-buttons\s*{/);
  assert.match(css, /\.bubble-style-buttons button\.is-selected-bubble-style\s*{/);

  assert.match(playJs, /spawnTab === 'bubbles'/);
  assert.match(playJs, /action === 'editBubbleText'/);
  assert.match(playJs, /openEditBubbleDialog/);

  assert.match(exportJs, /export function createBubbleSvg/);
  assert.match(exportJs, /export function wrapBubbleText/);
});

test('multi-select, alignment controls, scene outline, and templates expose accessible UI and dialogs', () => {
  // Topbar and actions
  assert.match(html, /id="scene-templates-btn"/);
  assert.match(html, /id="scene-outline-btn"/);
  assert.match(html, /id="save-scene-copy-btn"/);
  assert.match(html, /id="alignment-controls"/);
  assert.match(html, /data-action="alignLeft"/);
  assert.match(html, /data-action="alignCenter"/);
  assert.match(html, /data-action="alignRight"/);
  assert.match(html, /data-action="alignTop"/);
  assert.match(html, /data-action="alignMiddle"/);
  assert.match(html, /data-action="alignBottom"/);
  assert.match(html, /data-action="distributeH"/);
  assert.match(html, /data-action="distributeV"/);

  // Dialogs
  assert.match(html, /id="scene-templates-dialog"/);
  assert.match(html, /id="scene-templates-grid"/);
  assert.match(html, /id="scene-outline-dialog"/);
  assert.match(html, /id="scene-outline-list"/);
  assert.match(html, /id="outline-select-all-btn"/);
  assert.match(html, /id="outline-deselect-btn"/);

  // CSS Styles
  assert.match(css, /\.scene-entity-positioner\.is-multi-selected\s*{/);
  assert.match(css, /\.alignment-buttons\s*{/);
  assert.match(css, /\.alignment-buttons button\s*{[^}]*min-height:\s*40px/s);
  assert.match(css, /\.template-card\s*{/);
  assert.match(css, /\.template-badge\s*{/);
  assert.match(css, /\.outline-dialog\s*{/);
  assert.match(css, /\.outline-row\s*{/);

  // JS wiring & Keyboard handler
  assert.match(playJs, /event\.key\.toLowerCase\(\)\s*===\s*'o'/);
  assert.match(playJs, /action\.startsWith\('align'\)\s*\|\|\s*action\s*===\s*'distributeH'/);
  assert.match(js, /openSceneTemplatesDialog/);
  assert.match(js, /openSceneOutlineDialog/);
  assert.match(js, /duplicateCurrentToLibrary/);
});

test('panoramic stages and camera navigation expose accessible HUD, slider, minimap, and CSS rules', () => {
  // DOM Elements
  assert.match(html, /id="stage-width-select"/);
  assert.match(html, /id="scene-world"/);
  assert.match(html, /id="camera-hud"/);
  assert.match(html, /id="camera-pan-left"/);
  assert.match(html, /id="camera-slider"/);
  assert.match(html, /id="camera-pan-right"/);
  assert.match(html, /id="stage-minimap"/);
  assert.match(html, /id="minimap-lens"/);
  assert.match(html, /id="minimap-entities"/);

  // CSS rules
  assert.match(css, /\.scene-world\s*{[^}]*transform:\s*translate3d/s);
  assert.match(css, /\.camera-hud\s*{/);
  assert.match(css, /\.camera-pan-btn\s*{[^}]*min-width:\s*44px/s);
  assert.match(css, /\.stage-minimap\s*{/);
  assert.match(css, /\.minimap-lens\s*{/);

  // JS wiring & Reducers
  assert.match(playJs, /scene\/setStageWidth/);
  assert.match(playJs, /scene\/setCameraX/);
  assert.match(playJs, /scene\/panCamera/);
  assert.match(playJs, /CAMERA_CONSTANTS\.EDGE_ZONE/);
  assert.match(playJs, /minimap\.addEventListener\('keydown'/);
  assert.match(playJs, /minimap-bg-panel/);
  assert.match(playJs, /function syncCamera\(/);
  assert.match(playJs, /entityRoot\.replaceChildren\(stagedEntities\);\s*renderCameraHud\(state\);/);
  assert.match(js, /clientToLogical\(event\.clientX, event\.clientY, playStage\.getBoundingClientRect\(\), cameraX\)/);
});

