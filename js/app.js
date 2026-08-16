/**
 * Paper Doll Studio - Application Bootstrap & Orchestrator
 */

import { ASSETS, getAsset } from './core/asset-catalog.js';
import { createAppStore } from './core/app-store.js';
import { clientToLogical } from './core/coordinate-space.js';
import { loadAssetSvg } from './core/svg-loader.js';
import { createProjectRepository, loadProject, STORAGE_KEY } from './services/project-repository.js';
import { applyMouthExpression, createExportService } from './services/export-service.js';
import { createVoicePuppetryService } from './services/voice-puppetry.js';
import { createDesignerView, previewCustomColor } from './features/designer/designer-view.js';
import { createPlayView, findSceneSkinSvg } from './features/play/play-view.js';
import { createSceneOutlineView } from './features/play/scene-outline-view.js';
import { createSceneBookView } from './features/scene-book/scene-book-view.js';
import { persistedProjection } from './core/state-schema.js';
import { classifyError, executeSafeTeardown } from './core/error-boundary.js';
import { DEFAULT_EXPRESSION, LIMITS } from './domain/vocabulary.js';
import {
  clearProjectBackup,
  formatProjectExportFilename,
  getAvailableBackup,
  mergeProjectEnvelopes,
  saveProjectBackup,
  serializeProjectExport,
  validateImportPayload
} from './services/project-portability.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let storageRef = null;
try { storageRef = window.localStorage; } catch { /* handled as unavailable */ }
const loaded = loadProject(storageRef, getAsset);
const store = createAppStore(loaded.envelope, { getAsset, assets: ASSETS });
const storage = createProjectRepository({
  storage: storageRef,
  initialRevision: loaded.envelope?.revision ?? 1,
  onStatus({ status, message }) {
    store.dispatch({ type: 'ui/storageStatus', status, message });
  }
});
const exportService = createExportService({ getAsset, loadAssetSvg });

let confirmQueue = Promise.resolve();

export function miniButton(label, title, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.title = title;
  button.setAttribute('aria-label', title);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

function showToast(message) {
  if (!message) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  $('#toast-region').append(toast);
  window.setTimeout(() => toast.remove(), 2900);
}

function askConfirm(title, message) {
  const show = () => new Promise((resolve) => {
    const dialog = $('#confirm-dialog');
    dialog.returnValue = '';
    $('#confirm-title').textContent = title;
    $('#confirm-message').textContent = message;
    const ok = $('#confirm-ok');
    const cancel = $('#confirm-cancel');
    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };
    const onClose = () => { cleanup(); resolve(dialog.returnValue === 'ok'); };
    function cleanup() {
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      dialog.removeEventListener('close', onClose);
      if (dialog.open) dialog.close();
    }
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
    dialog.addEventListener('close', onClose);
    dialog.showModal();
  });
  const result = confirmQueue.then(show, show);
  confirmQueue = result.then(() => undefined, () => undefined);
  return result;
}

const designerView = createDesignerView({
  store,
  $,
  $$,
  askConfirm,
  miniButton
});

const sceneOutlineView = createSceneOutlineView({
  store,
  $,
  $$,
  askConfirm,
  miniButton
});

const playView = createPlayView({
  store,
  $,
  $$,
  renderDollInto: designerView.renderDollInto,
  askConfirm,
  openSceneOutlineDialog: () => sceneOutlineView.openSceneOutlineDialog()
});

const sceneBookView = createSceneBookView({
  store,
  $,
  $$,
  askConfirm,
  miniButton
});

const voiceService = createVoicePuppetryService({
  onViseme(viseme) {
    const currentSelected = store.getState().ui.selectedEntityId;
    const targetCharacter = store.getState().currentScene.entities.find((e) =>
      e.kind === 'character' && (e.instanceId === currentSelected || !currentSelected)
    );
    if (targetCharacter) {
      const domEntity = findSceneSkinSvg(targetCharacter.instanceId);
      if (domEntity) {
        const baseFallback = targetCharacter.expression || DEFAULT_EXPRESSION;
        applyMouthExpression(domEntity, viseme === DEFAULT_EXPRESSION ? baseFallback : viseme);
      }
    }
  },
  onActiveChange(active) {
    store.dispatch({ type: 'ui/setVoicePuppetry', active });
    if (!active) {
      const state = store.getState();
      for (const entity of state.currentScene.entities) {
        if (entity.kind === 'character') {
          const domEntity = findSceneSkinSvg(entity.instanceId);
          if (domEntity) applyMouthExpression(domEntity, entity.expression || DEFAULT_EXPRESSION);
        }
      }
    }
  },
  onError() {
    showToast('Could not access microphone.');
  }
});

function toggleVoicePuppetry() {
  if (voiceService.isActive()) {
    voiceService.stop();
    showToast('🎙️ Voice Puppetry stopped.');
  } else {
    void voiceService.start().then(() => {
      if (voiceService.isActive()) {
        showToast('🎙️ Accurate Voice Puppetry active! Speak into mic to flap mouth.');
      }
    });
  }
}

function stopVoicePuppetry() {
  voiceService.stop();
}

function cancelPointerController() {
  playView.cancelPointerController();
}

const toastActions = new Set([
  'designer/equip', 'designer/clearOutfit', 'designer/shuffle', 'preset/save', 'preset/update', 'preset/delete',
  'scene/spawnCharacter', 'scene/spawnProp', 'scene/spawnBubble', 'scene/duplicateEntity', 'scene/deleteEntity', 'scene/deleteEntities', 'scene/new',
  'scene/togglePin', 'scene/togglePinEntities', 'scene/attachEntity', 'scene/detachEntity', 'scene/alignEntities',
  'scene/saveToLibrary', 'scene/duplicateCurrentToLibrary', 'scene/updateLibraryScene', 'scene/loadFromLibrary', 'scene/loadTemplate', 'scene/duplicateLibraryScene', 'scene/deleteLibraryScene',
  'project/importReplace', 'project/importMerge', 'project/restoreBackup',
  'app/undo', 'app/redo'
]);

store.subscribe(({ action, state, persist }) => {
  if (persist) storage.schedule(persistedProjection(state));
  if (toastActions.has(action.type)) showToast(state.ui.message);

  if (action.type === 'scene/setCameraX' || action.type === 'scene/panCamera') {
    playView.syncCamera(state);
    return;
  }

  if (action.type === 'ui/selectEntity' || action.type === 'ui/selectEntities' || action.type === 'ui/toggleEntitySelection' || action.type === 'ui/clearSelection') {
    const selectedSet = new Set(state.ui.selectedEntityIds || (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : []));
    for (const element of $$('.scene-entity-positioner')) {
      const isSelected = selectedSet.has(element.dataset.instanceId);
      const isPrimary = element.dataset.instanceId === state.ui.selectedEntityId;
      element.classList.toggle('is-selected', isPrimary || (isSelected && selectedSet.size === 1));
      element.classList.toggle('is-multi-selected', isSelected && selectedSet.size > 1);
    }
    playView.renderSelectedActions(state);
    playView.renderContextRing(state);
    if ($('#scene-outline-dialog')?.open) {
      sceneOutlineView.renderSceneOutline(state);
    }
    return;
  }
  if (action.type === 'scene/setDollExpression') {
    const targetId = action.instanceId ?? state.ui.selectedEntityId;
    const domSkin = findSceneSkinSvg(targetId);
    if (domSkin) applyMouthExpression(domSkin, action.expression);
    playView.renderSelectedActions(state);
    return;
  }
  if ($('#scene-outline-dialog')?.open) {
    sceneOutlineView.renderSceneOutline(state);
  }
  renderApp();
});

wireStaticEvents();
playView.initPointerController();
const initialMode = modeFromHash();
store.dispatch({ type: 'ui/setMode', mode: initialMode });
if (!loaded.available || loaded.recovered === false) {
  store.dispatch({
    type: 'ui/storageStatus',
    status: 'unsaved',
    message: loaded.warnings[0] || 'Saved data could not be recovered cleanly; safe defaults were loaded.'
  });
} else if (loaded.warnings.length) {
  store.dispatch({ type: 'ui/storageStatus', status: 'saved', message: loaded.warnings.join(' ') });
}
renderApp();

function renderApp() {
  const state = store.getState();
  const designerActive = state.ui.mode === 'designer';
  $('#designer-screen').hidden = !designerActive;
  $('#play-screen').hidden = designerActive;
  document.title = `${designerActive ? 'Doll Designer' : 'Play Sandbox'} · Paper Doll Studio`;
  for (const link of $$('[data-mode-link]')) {
    if (link.dataset.modeLink === state.ui.mode) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  const undoBtn = $('#undo-button');
  const redoBtn = $('#redo-button');
  if (undoBtn) undoBtn.disabled = !store.canUndo();
  if (redoBtn) redoBtn.disabled = !store.canRedo();
  const saveStatus = $('#save-status');
  saveStatus.dataset.status = state.ui.storageStatus;
  saveStatus.textContent = ({ saved: 'Saved', saving: 'Saving…', unsaved: 'Not saved' })[state.ui.storageStatus] ?? 'Saved';
  saveStatus.title = state.ui.storageStatus === 'saved' ? 'Saved on this device' : saveStatus.textContent;
  const count = $('#dollbox-count');
  count.textContent = String(state.presets.length);
  count.setAttribute('aria-label', `${state.presets.length} saved doll${state.presets.length === 1 ? '' : 's'}`);
  const sceneLibCount = $('#scene-library-count');
  if (sceneLibCount) sceneLibCount.textContent = String(state.scenes?.length ?? 0);
  const voiceBtn = $('#voice-puppetry-btn');
  if (voiceBtn) voiceBtn.classList.toggle('voice-puppetry-active', Boolean(state.ui.voicePuppetryActive));
  $('#designer-status').textContent = state.ui.message;
  $('#play-status').textContent = state.ui.message;
  if (designerActive) {
    playView.bumpToken();
    void designerView.render(state);
  } else {
    designerView.bumpToken();
    void playView.render(state);
  }
}

function modeFromHash() {
  return location.hash === '#designer' ? 'designer' : 'play';
}

function wireStaticEvents() {
  window.addEventListener('hashchange', () => {
    cancelPointerController();
    if (store.getState().ui.voicePuppetryActive) {
      store.dispatch({ type: 'ui/setVoicePuppetry', active: false });
      stopVoicePuppetry();
    }
    store.dispatch({ type: 'ui/setMode', mode: modeFromHash() });
    $('#main-content').focus({ preventScroll: true });
  });

  $('#save-preset-form').addEventListener('submit', (event) => {
    event.preventDefault();
    store.dispatch({ type: 'preset/save', name: new FormData(event.currentTarget).get('dollName') });
  });
  $('#update-preset').addEventListener('click', () => store.dispatch({ type: 'preset/update', name: $('#doll-name').value }));
  $('#remove-piece').addEventListener('click', () => store.dispatch({ type: 'designer/remove' }));
  $('#shuffle-outfit').addEventListener('click', () => store.dispatch({ type: 'designer/shuffle' }));
  $('#clear-outfit').addEventListener('click', async () => {
    const dressed = ['top', 'bottom', 'dress', 'shoes', 'accessory'].some((slot) => store.getState().designer.draft.slots[slot]);
    if (!dressed || await askConfirm('Take off this outfit?', 'Hair and skin tone will stay. Clothing, shoes, and accessories will be removed.')) {
      store.dispatch({ type: 'designer/clearOutfit' });
    }
  });
  $('#custom-color').addEventListener('input', (event) => previewCustomColor(event.target.value, store.getState().designer.selectedSlot));
  $('#custom-color').addEventListener('change', (event) => {
    const slot = store.getState().designer.selectedSlot;
    store.dispatch({ type: 'designer/setColor', slot, color: event.target.value });
  });
  $('#reset-doll').addEventListener('click', async () => {
    if (!store.getState().designer.dirty || await askConfirm('Reset this doll?', 'Your current changes will be replaced by the starter outfit.')) {
      store.dispatch({ type: 'designer/reset' });
    }
  });
  $('#background-select').addEventListener('change', (event) => store.dispatch({ type: 'scene/setBackground', backgroundId: event.target.value }));
  $('#new-scene').addEventListener('click', async () => {
    const hasItems = store.getState().currentScene.entities.length > 0;
    if (!hasItems || await askConfirm('Start a new scene?', 'The current scene will be cleared on this device.')) {
      store.dispatch({ type: 'scene/new' });
    }
  });

  // Scene Library, Templates, Outline & Save Scene dialog wiring
  $('#scene-templates-btn')?.addEventListener('click', () => sceneBookView.openSceneTemplatesDialog());
  $('#close-scene-templates')?.addEventListener('click', () => $('#scene-templates-dialog')?.close());
  $('#scene-outline-btn')?.addEventListener('click', () => sceneOutlineView.openSceneOutlineDialog());
  $('#close-scene-outline')?.addEventListener('click', () => $('#scene-outline-dialog')?.close());
  $('#outline-select-all-btn')?.addEventListener('click', () => {
    const allIds = store.getState().currentScene.entities.map((e) => e.instanceId);
    store.dispatch({ type: 'ui/selectEntities', instanceIds: allIds });
  });
  $('#outline-deselect-btn')?.addEventListener('click', () => store.dispatch({ type: 'ui/clearSelection' }));
  $('#save-scene-copy-btn')?.addEventListener('click', () => store.dispatch({ type: 'scene/duplicateCurrentToLibrary' }));

  $('#scene-library-btn')?.addEventListener('click', () => sceneBookView.openSceneLibraryDialog());
  $('#close-scene-library')?.addEventListener('click', () => $('#scene-library-dialog')?.close());
  $('#save-scene-btn')?.addEventListener('click', () => sceneBookView.openSaveSceneDialog());
  $('#cancel-save-scene')?.addEventListener('click', () => $('#save-scene-dialog')?.close());
  $('#save-scene-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = $('#scene-title-input')?.value;
    store.dispatch({ type: 'scene/saveToLibrary', name: title });
    $('#save-scene-dialog')?.close();
  });
  $('#update-existing-scene')?.addEventListener('click', () => {
    const title = $('#scene-title-input')?.value;
    store.dispatch({ type: 'scene/updateLibraryScene', name: title });
    $('#save-scene-dialog')?.close();
  });

  // Alignment buttons wiring
  $('#alignment-controls')?.addEventListener('click', (event) => {
    const action = event.target.closest('button')?.dataset.action;
    if (action) void playView.handleEntityAction(action);
  });

  // Expression buttons wiring
  $('#character-expression-controls')?.addEventListener('click', (event) => {
    const expr = event.target.closest('button')?.dataset.expression;
    if (expr) store.dispatch({ type: 'scene/setDollExpression', expression: expr });
  });

  // Speech bubble controls & dialog wiring
  $('#bubble-controls')?.addEventListener('click', (event) => {
    const style = event.target.closest('button')?.dataset.bubbleStyle;
    if (style) store.dispatch({ type: 'scene/setBubbleStyle', bubbleStyle: style });
  });
  $('#bubble-text-input')?.addEventListener('input', (event) => {
    const count = $('#bubble-char-count');
    if (count) count.textContent = `${event.target.value.length}/120`;
  });
  $('#cancel-bubble-text')?.addEventListener('click', () => $('#bubble-text-dialog')?.close());
  $('#bubble-text-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = $('#bubble-text-input')?.value;
    store.dispatch({ type: 'scene/setBubbleText', text });
    $('#bubble-text-dialog')?.close();
  });

  // Voice Puppetry wiring
  $('#voice-puppetry-btn')?.addEventListener('click', () => void toggleVoicePuppetry());

  // Project Portability wiring
  $('#guide-menu-btn')?.addEventListener('click', () => $('#guide-dialog')?.showModal());
  $('#close-guide-dialog')?.addEventListener('click', () => $('#guide-dialog')?.close());
  $('#project-menu-btn')?.addEventListener('click', () => openProjectDialog());
  $('#close-project-dialog')?.addEventListener('click', () => $('#project-dialog')?.close());
  $('#export-project-btn')?.addEventListener('click', () => exportProjectJsonFile());
  $('#browse-project-file-btn')?.addEventListener('click', () => $('#project-file-input')?.click());
  $('#project-file-input')?.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (file) void handleProjectFile(file);
  });

  const importDropzone = $('#import-dropzone');
  if (importDropzone) {
    importDropzone.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      importDropzone.classList.add('is-drop-target');
    });
    importDropzone.addEventListener('dragleave', () => {
      importDropzone.classList.remove('is-drop-target');
    });
    importDropzone.addEventListener('drop', (event) => {
      event.preventDefault();
      importDropzone.classList.remove('is-drop-target');
      const file = event.dataTransfer.files?.[0];
      if (file) void handleProjectFile(file);
    });
  }

  $('#import-merge-btn')?.addEventListener('click', () => void executeImportMerge());
  $('#import-replace-btn')?.addEventListener('click', () => void executeImportReplace());
  $('#import-cancel-btn')?.addEventListener('click', () => {
    const previewCard = $('#import-preview-card');
    if (previewCard) previewCard.hidden = true;
    const fileInput = $('#project-file-input');
    if (fileInput) fileInput.value = '';
    pendingImportEnvelope = null;
  });

  $('#restore-backup-btn')?.addEventListener('click', () => void executeRestoreBackup());
  $('#dismiss-backup-btn')?.addEventListener('click', () => executeDismissBackup());

  // Global action buttons
  $('#undo-button')?.addEventListener('click', () => store.dispatch({ type: 'app/undo' }));
  $('#redo-button')?.addEventListener('click', () => store.dispatch({ type: 'app/redo' }));
  $('#export-scene-png')?.addEventListener('click', () => void exportSceneAsPng());
  $('#entity-actions').addEventListener('click', (event) => void playView.handleEntityAction(event.target.closest('button')?.dataset.action));
  $('#play-stage').addEventListener('keydown', playView.handleStageKeydown);
  document.addEventListener('keydown', handleTabKeys);
  document.addEventListener('keydown', handleGlobalShortcuts);

  // Drag & drop into designer
  const designerStage = $('.designer-stage');
  designerStage.addEventListener('dragover', (event) => {
    if (!Array.from(event.dataTransfer.types).includes('text/plain')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    designerStage.classList.add('is-drop-target');
  });
  designerStage.addEventListener('dragleave', (event) => {
    if (!designerStage.contains(event.relatedTarget)) designerStage.classList.remove('is-drop-target');
  });
  designerStage.addEventListener('drop', (event) => {
    event.preventDefault();
    designerStage.classList.remove('is-drop-target');
    const payload = event.dataTransfer.getData('text/plain');
    const match = payload.match(/^paper-doll-wearable:([a-z0-9_-]+)$/);
    if (match) store.dispatch({ type: 'designer/equip', assetId: match[1] });
  });

  // Drag & drop into play stage
  const playStage = $('#play-stage');
  playStage.addEventListener('dragover', (event) => {
    if (!Array.from(event.dataTransfer.types).includes('text/plain')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    playStage.classList.add('is-spawn-target');
  });
  playStage.addEventListener('dragleave', (event) => {
    if (!playStage.contains(event.relatedTarget)) playStage.classList.remove('is-spawn-target');
  });
  playStage.addEventListener('drop', (event) => {
    event.preventDefault();
    playStage.classList.remove('is-spawn-target');
    const match = event.dataTransfer.getData('text/plain').match(/^paper-doll-spawn:(character|prop|bubble):([a-zA-Z0-9_-]+)(?::(.*))?$/);
    if (!match) return;
    const cameraX = store.getState().currentScene.cameraX || 0;
    const point = clientToLogical(event.clientX, event.clientY, playStage.getBoundingClientRect(), cameraX);
    const hostElement = event.target.closest?.('.scene-entity-positioner');
    const targetEntityId = hostElement?.dataset?.instanceId;

    if (match[1] === 'character') store.dispatch({ type: 'scene/spawnCharacter', presetId: match[2], ...point });
    else if (match[1] === 'bubble') store.dispatch({ type: 'scene/spawnBubble', bubbleStyle: match[2], text: match[3] ? decodeURIComponent(match[3]) : 'Hello!', targetEntityId, ...point });
    else store.dispatch({ type: 'scene/spawnProp', assetId: match[2], targetEntityId, ...point });
  });

  const handleTeardownFlush = () => {
    cancelPointerController();
    exportService.cancel();
    if (store.getState().ui.voicePuppetryActive) {
      store.dispatch({ type: 'ui/setVoicePuppetry', active: false });
      stopVoicePuppetry();
    }
    storage.flush();
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      handleTeardownFlush();
    }
  });
  window.addEventListener('pagehide', handleTeardownFlush);
  window.addEventListener('resize', cancelPointerController);
  window.addEventListener('beforeunload', () => storage.flush());
  window.addEventListener('storage', async (event) => {
    if (event.key === STORAGE_KEY) {
      const storageRev = storage.getStorageRevision();
      const baseRev = storage.getBaseRevision();
      if (storageRev != null && storageRev > baseRev) {
        const shouldReload = await askConfirm(
          'Saved data changed in another tab',
          'Another tab updated this project. Would you like to reload this page to view the latest saved changes, or keep working in this tab?'
        );
        if (shouldReload) {
          location.reload();
        } else {
          store.dispatch({
            type: 'ui/storageStatus',
            status: 'unsaved',
            message: 'Working with tab-local state. Future saves require explicit confirmation to overwrite newer disk changes.'
          });
        }
      }
    }
  });

  window.addEventListener('error', (event) => {
    handleTopLevelError(event.error, 'error');
  });
  window.addEventListener('unhandledrejection', (event) => {
    handleTopLevelError(event.reason, 'unhandledrejection');
  });

  $('#dismiss-error-btn')?.addEventListener('click', () => {
    const dialog = $('#error-boundary-dialog');
    if (dialog?.open) dialog.close();
  });
  $('#reload-error-btn')?.addEventListener('click', () => {
    location.reload();
  });
}

function handleTopLevelError(error, source = 'runtime') {
  const code = classifyError(error);
  executeSafeTeardown({
    cancelPointer: cancelPointerController,
    stopAudio: () => {
      if (store.getState().ui.voicePuppetryActive) {
        store.dispatch({ type: 'ui/setVoicePuppetry', active: false });
        stopVoicePuppetry();
      }
    },
    cancelExport: () => exportService.cancel(),
    cancelStorage: () => storage?.cancel()
  });

  const dialog = $('#error-boundary-dialog');
  const codeEl = $('#error-boundary-code');
  if (codeEl) codeEl.textContent = code;
  if (dialog && typeof dialog.showModal === 'function' && !dialog.open) {
    dialog.showModal();
  }
  store.dispatch({ type: 'ui/storageStatus', status: 'unsaved', message: 'An error occurred. Saved project data was preserved.' });
}

function handleTabKeys(event) {
  const tab = event.target.closest('[role="tab"]');
  if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const list = tab.closest('[role="tablist"]');
  if (!list) return;
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const index = tabs.indexOf(tab);
  if (index === -1) return;
  event.preventDefault();
  let nextIndex = index;
  if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
  else if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = tabs.length - 1;
  tabs[nextIndex]?.focus();
  tabs[nextIndex]?.click();
}

function handleGlobalShortcuts(event) {
  if (event.target.matches('input, textarea, select, [contenteditable="true"]') || document.querySelector('dialog[open]')) return;
  const isMac = typeof navigator !== 'undefined' && (/Mac|iPod|iPhone|iPad/.test(navigator.platform) || /Macintosh/.test(navigator.userAgent));
  const modifier = isMac ? event.metaKey : event.ctrlKey;
  if (!modifier || event.altKey) return;
  const key = event.key.toLowerCase();
  if (key === 'z') {
    event.preventDefault();
    if (event.shiftKey) store.dispatch({ type: 'app/redo' });
    else store.dispatch({ type: 'app/undo' });
  } else if (key === 'y' && !isMac) {
    event.preventDefault();
    store.dispatch({ type: 'app/redo' });
  }
}

async function exportSceneAsPng() {
  const state = store.getState();
  const result = await exportService.exportSceneAndDownload(state.currentScene);
  if (result.ok) {
    showToast('📸 Scene exported as PNG image!');
  } else {
    showToast(result.message || 'Could not export scene image.');
  }
}

let pendingImportEnvelope = null;

function openProjectDialog() {
  const state = store.getState();
  const statsContainer = $('#project-export-stats');
  if (statsContainer) {
    const dollCount = state.presets.length;
    const sceneCount = state.scenes.length;
    const entityCount = state.currentScene?.entities?.length ?? 0;
    statsContainer.replaceChildren(
      Object.assign(document.createElement('span'), { className: 'stat-chip', textContent: `👗 ${dollCount} Doll${dollCount === 1 ? '' : 's'}` }),
      Object.assign(document.createElement('span'), { className: 'stat-chip', textContent: `📚 ${sceneCount} Scene${sceneCount === 1 ? '' : 's'}` }),
      Object.assign(document.createElement('span'), { className: 'stat-chip', textContent: `🎭 ${entityCount} Stage item${entityCount === 1 ? '' : 's'}` })
    );
  }

  const backupSection = $('#project-backup-section');
  const backupRes = getAvailableBackup(storageRef, getAsset);
  if (backupSection) {
    if (backupRes.available) {
      backupSection.hidden = false;
      const backupTime = $('#backup-timestamp');
      const backupDetails = $('#backup-details');
      if (backupTime) backupTime.textContent = `Backup from ${new Date(backupRes.backedUpAt).toLocaleString()}`;
      if (backupDetails) backupDetails.textContent = `${backupRes.summary.presetCount} dolls · ${backupRes.summary.sceneCount} scenes`;
    } else {
      backupSection.hidden = true;
    }
  }

  const previewCard = $('#import-preview-card');
  if (previewCard) previewCard.hidden = true;
  const fileInput = $('#project-file-input');
  if (fileInput) fileInput.value = '';
  pendingImportEnvelope = null;

  $('#project-dialog')?.showModal();
}

function exportProjectJsonFile() {
  try {
    const state = store.getState();
    const jsonStr = serializeProjectExport(state);
    const filename = formatProjectExportFilename();
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 6000);
    showToast('📦 Project downloaded as JSON!');
  } catch {
    showToast('Could not export project JSON.');
  }
}

async function handleProjectFile(file) {
  if (!file) return;
  if (file.size > LIMITS.MAX_IMPORT_BYTES) {
    showToast('Project file exceeds the maximum allowed size (5MB).');
    return;
  }
  try {
    const text = await file.text();
    const res = validateImportPayload(text, getAsset);
    if (!res.ok) {
      showToast(res.error || 'Could not parse project file.');
      return;
    }
    pendingImportEnvelope = res.envelope;

    const previewCard = $('#import-preview-card');
    const filenameEl = $('#import-filename');
    const badgesEl = $('#import-summary-badges');
    const warningsEl = $('#import-warnings-box');

    if (filenameEl) filenameEl.textContent = file.name || 'project.json';
    if (badgesEl) {
      badgesEl.replaceChildren(
        Object.assign(document.createElement('span'), { className: 'stat-chip', textContent: `👗 ${res.summary.presetCount} Dolls` }),
        Object.assign(document.createElement('span'), { className: 'stat-chip', textContent: `📚 ${res.summary.sceneCount} Scenes` }),
        Object.assign(document.createElement('span'), { className: 'stat-chip', textContent: res.summary.hasCurrentScene ? `🎭 Active Stage (${res.summary.currentSceneEntityCount} items)` : '🎭 Empty stage' })
      );
    }

    if (warningsEl) {
      if (res.warnings.length > 0) {
        warningsEl.hidden = false;
        warningsEl.textContent = `Note: ${res.warnings.join(' ')}`;
      } else {
        warningsEl.hidden = true;
      }
    }

    if (previewCard) previewCard.hidden = false;
  } catch {
    showToast('Error reading project file.');
  }
}

async function executeImportMerge() {
  if (!pendingImportEnvelope) return;
  const currentEnv = persistedProjection(store.getState());
  const merged = mergeProjectEnvelopes(currentEnv, pendingImportEnvelope);
  store.dispatch({
    type: 'project/importMerge',
    envelope: merged.envelope,
    message: `Merged ${merged.stats.addedPresets} dolls and ${merged.stats.addedScenes} scenes into studio.`
  });
  $('#project-dialog')?.close();
}

async function executeImportReplace() {
  if (!pendingImportEnvelope) return;
  const confirmed = await askConfirm(
    'Replace entire studio?',
    'All current dolls and scenes will be replaced by the imported project. An automatic backup will be created so you can restore at any time.'
  );
  if (!confirmed) return;

  const currentEnv = persistedProjection(store.getState());
  const backupResult = saveProjectBackup(storageRef, currentEnv);
  if (!backupResult.ok) {
    const proceedAnyway = await askConfirm(
      'Backup creation failed',
      `Could not create an automatic safety backup (${backupResult.error || 'Storage issue'}). If you proceed, your current studio cannot be restored. Do you still want to replace everything?`
    );
    if (!proceedAnyway) return;
  }

  store.dispatch({
    type: 'project/importReplace',
    envelope: pendingImportEnvelope,
    message: backupResult.ok
      ? 'Project loaded successfully. Previous studio was backed up.'
      : 'Project loaded successfully without backup.'
  });
  $('#project-dialog')?.close();
}

async function executeRestoreBackup() {
  const backup = getAvailableBackup(storageRef, getAsset);
  if (!backup.available) {
    showToast('No backup found.');
    return;
  }
  const confirmed = await askConfirm(
    'Restore previous backup?',
    'This will replace your active studio with the backed-up project snapshot.'
  );
  if (!confirmed) return;

  store.dispatch({
    type: 'project/restoreBackup',
    envelope: backup.envelope,
    message: 'Previous project backup restored.'
  });

  const saveResult = storage.flush({ force: true });
  if (saveResult?.ok) {
    clearProjectBackup(storageRef);
  }
  $('#project-dialog')?.close();
}

function executeDismissBackup() {
  clearProjectBackup(storageRef);
  const backupSection = $('#project-backup-section');
  if (backupSection) backupSection.hidden = true;
  showToast('Backup dismissed.');
}
