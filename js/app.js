import { createAppStateEffects } from './app-state-effects.js';
import { createAppLifecycle } from './app-lifecycle.js';
import { createAppShellEvents } from './app-shell-events.js';
import { createAppSceneControls } from './app-scene-controls.js';
import { createAppProjectController } from './app-project-controller.js';
import { createAppShortcuts } from './app-shortcuts.js';
import { createAppRouter } from './app-router.js';
import { createAppDialogs } from './app-dialogs.js';
/**
 * Paper Doll Studio - Application Bootstrap & Orchestrator
 */

import { ASSETS, getAsset } from './core/asset-catalog.js';
import { createAppStore } from './core/app-store.js';
import { createAssetRegistry } from './core/asset-registry.js';

import { loadAssetSvg } from './core/svg-loader.js';
import { createProjectRepository, loadProject } from './services/project-repository.js';
import { createCustomArtRepository } from './services/custom-art-repository.js';
import { createExportService } from './services/export-service.js';
import { applyMouthExpression } from './core/mouth-expression.js';
import { createVoicePuppetryService } from './services/voice-puppetry.js';
import { createSceneAnimationService, resolveVoiceTargetCharacter } from './services/scene-animation-service.js';
import { createDesignerView } from './features/designer/designer-view.js';
import { createPaintView } from './features/paint/paint-view.js';
import { createPlayView, findSceneSkinSvg } from './features/play/play-view.js';
import { createSceneOutlineView } from './features/play/scene-outline-view.js';
import { createSceneBookView } from './features/scene-book/scene-book-view.js';
import { createWorldMapView } from './features/world-map/world-map-view.js';
import { enableDialogLightDismiss } from './core/dialog-dismiss.js';

import { createDisposableRegistry } from './core/error-boundary.js';
import { DEFAULT_EXPRESSION, DEFAULT_EXPRESSION_INTENSITY } from './domain/vocabulary.js';

import { initLanguage, getCurrentLanguage, t, updateDomTranslations } from './core/i18n.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let storageRef = null;
try { storageRef = window.localStorage; } catch { /* handled as unavailable */ }
const loaded = loadProject(storageRef, getAsset);
const customArtRepo = createCustomArtRepository();
const store = createAppStore(loaded.envelope, { getAsset, assets: ASSETS });
const getEffectiveAsset = (id) => createAssetRegistry(store ? store.getState().customAssets : loaded.envelope.customAssets).getAsset(id);
const getEffectiveAssetsByKind = (kind, options) => createAssetRegistry(store ? store.getState().customAssets : loaded.envelope.customAssets).assetsByKind(kind, options);
const storage = createProjectRepository({
  storage: storageRef,
  initialRevision: loaded.envelope?.revision ?? 1,
  onStatus({ status, message }) {
    store.dispatch({ type: 'ui/storageStatus', status, message });
  }
});
const exportService = createExportService({ getAsset: getEffectiveAsset, loadAssetSvg, customArtRepo });

export { enableDialogLightDismiss };

const { miniButton, showToast, askConfirm, showAlert, askPrompt } = createAppDialogs({
  $
});

const { modeFromHash, openPaintStudio, wireStaticEvents, renderApp } = createAppRouter({
  $,
  $$,
  store,
  get designerView() { return designerView; },
  get playView() { return playView; },
  get paintView() { return paintView; },
  get stopVoicePuppetry() { return stopVoicePuppetry; },
  get cancelPointerController() { return cancelPointerController; },
  get wireDesignerEvents() { return wireDesignerEvents; },
  get wireSceneEvents() { return wireSceneEvents; },
  get wireShellEvents() { return wireShellEvents; },
  get wireDropEvents() { return wireDropEvents; },
  get wireLifecycleEvents() { return wireLifecycleEvents; }
});

const { handleTabKeys, handleGlobalShortcuts } = createAppShortcuts({
  store,
  get worldMapView() { return worldMapView; }
});

const { openProjectDialog, exportProjectJsonFile, handleProjectFile, executeImportMerge, executeImportReplace, executeRestoreBackup, executeDismissBackup } = createAppProjectController({
  $,
  storageRef,
  customArtRepo,
  store,
  storage,
  get showToast() { return showToast; },
  get askConfirm() { return askConfirm; },
  get pendingImportEnvelope() { return pendingImportEnvelope; }, set pendingImportEnvelope(value) { pendingImportEnvelope = value; }
});

const { wireSceneEvents, exportSceneAsPng, exportCurrentFrameAsPng } = createAppSceneControls({
  $,
  $$,
  store,
  exportService,
  get showToast() { return showToast; },
  get askConfirm() { return askConfirm; },
  get sceneOutlineView() { return sceneOutlineView; },
  get worldMapView() { return worldMapView; },
  get playView() { return playView; },
  get sceneBookView() { return sceneBookView; },
  get sceneAnimationService() { return sceneAnimationService; },
  get toggleVoicePuppetry() { return toggleVoicePuppetry; }
});

const { wireDesignerEvents, wireShellEvents, wireDropEvents } = createAppShellEvents({
  $,
  $$,
  store,
  get showToast() { return showToast; },
  get askConfirm() { return askConfirm; },
  get playView() { return playView; },
  get handleTabKeys() { return handleTabKeys; },
  get handleGlobalShortcuts() { return handleGlobalShortcuts; },
  get exportSceneAsPng() { return exportSceneAsPng; },
  get exportCurrentFrameAsPng() { return exportCurrentFrameAsPng; },
  get pendingImportEnvelope() { return pendingImportEnvelope; }, set pendingImportEnvelope(value) { pendingImportEnvelope = value; },
  get openProjectDialog() { return openProjectDialog; },
  get exportProjectJsonFile() { return exportProjectJsonFile; },
  get handleProjectFile() { return handleProjectFile; },
  get executeImportMerge() { return executeImportMerge; },
  get executeImportReplace() { return executeImportReplace; },
  get executeRestoreBackup() { return executeRestoreBackup; },
  get executeDismissBackup() { return executeDismissBackup; }
});

const { wireLifecycleEvents } = createAppLifecycle({
  $,
  customArtRepo,
  store,
  storage,
  exportService,
  get askConfirm() { return askConfirm; },
  get paintView() { return paintView; },
  get sceneAnimationService() { return sceneAnimationService; },
  get stopVoicePuppetry() { return stopVoicePuppetry; },
  get cancelPointerController() { return cancelPointerController; }
});

const { handleStoreChange } = createAppStateEffects({
  $,
  $$,
  storage,
  get showToast() { return showToast; },
  get sceneOutlineView() { return sceneOutlineView; },
  get playView() { return playView; },
  get sceneAnimationService() { return sceneAnimationService; },
  get renderApp() { return renderApp; }
});

const designerView = createDesignerView({
  store,
  $,
  $$,
  askConfirm,
  askPrompt,
  miniButton,
  customArtRepo,
  openPaintStudio,
  getAsset: getEffectiveAsset
});

const sceneOutlineView = createSceneOutlineView({
  store,
  $,
  $$,
  askConfirm,
  miniButton,
  getAsset: getEffectiveAsset
});

const worldMapView = createWorldMapView({
  store,
  $,
  $$,
  renderDollInto: designerView.renderDollInto,
  customArtRepo,
  getAsset: getEffectiveAsset
});

const playView = createPlayView({
  store,
  $,
  $$,
  renderDollInto: designerView.renderDollInto,
  askConfirm,
  openSceneOutlineDialog: () => sceneOutlineView.openSceneOutlineDialog(),
  openWorldMapDialog: () => worldMapView.openWorldMapDialog(),
  customArtRepo,
  openPaintStudio,
  getAsset: getEffectiveAsset,
  getAssetsByKind: getEffectiveAssetsByKind,
  invalidateAnimationDomCache: () => sceneAnimationService?.invalidateDomCache?.()
});

const sceneBookView = createSceneBookView({
  store,
  $,
  $$,
  askConfirm,
  askPrompt,
  miniButton,
  customArtRepo,
  getAsset: getEffectiveAsset
});

const paintView = createPaintView({
  rootElement: document,
  store,
  customArtRepo,
  askConfirm,
  showAlert,
  assetRegistry: {
    getAsset: (id) => getEffectiveAsset(id),
    getCategoryAssets: (category, slot) => {
      if (category !== 'wardrobe') return [];
      // Starting cutouts are catalog SVGs. Custom PNGs are already artwork,
      // and do not have an SVG loader path suitable for rasterization here.
      return ASSETS.filter((asset) => asset.kind === 'wearable' && asset.slot === slot);
    },
    wearablesBySlot: (slot) => ASSETS.filter((asset) => asset.kind === 'wearable' && asset.slot === slot),
    getAllCustomAssets: () => store.getState().customAssets || []
  },
  svgLoader: { load: async (assetId) => loadAssetSvg(assetId) },
  onNavigate(targetMode) {
    location.hash = `#${targetMode}`;
  }
});

const voiceService = createVoicePuppetryService({
  onViseme(viseme) {
    const state = store.getState();
    const targetCharacter = resolveVoiceTargetCharacter(state.currentScene, state.ui.selectedEntityId);
    if (targetCharacter) {
      const domEntity = findSceneSkinSvg(targetCharacter.instanceId, $$);
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
          const domEntity = findSceneSkinSvg(entity.instanceId, $$);
          if (domEntity) {
            applyMouthExpression(domEntity, entity.expression || DEFAULT_EXPRESSION, entity.expressionIntensity ?? DEFAULT_EXPRESSION_INTENSITY);
          }
        }
      }
      sceneAnimationService.applyStaticPoseToDom();
    }
  },
  onError() {
    showToast(t('toasts.micError'));
  }
});

const sceneAnimationService = createSceneAnimationService({
  store,
  queryAll: (sel) => $$(sel),
  isVoiceActive: () => voiceService.isActive()
});

const appDisposables = createDisposableRegistry();
appDisposables.register(playView);
appDisposables.register(paintView);
appDisposables.register(worldMapView);
appDisposables.register(sceneAnimationService);
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) appDisposables.disposeAll();
});

function toggleVoicePuppetry() {
  if (voiceService.isActive()) {
    voiceService.stop();
    showToast(t('toasts.voiceStopped'));
  } else {
    void voiceService.start().then(() => {
      if (voiceService.isActive()) {
        showToast(t('toasts.voiceActive'));
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

store.subscribe(handleStoreChange);

// Initialize language on startup (defaults to Turkish 'tr')
initLanguage();
updateDomTranslations();

function updateLangButtonUI() {
  const current = getCurrentLanguage();
  const textEl = $('#current-lang-text');
  if (textEl) textEl.textContent = current.toUpperCase();
}
updateLangButtonUI();

window.addEventListener('languagechange', () => {
  updateLangButtonUI();
  paintView.refreshLanguage?.();
  if ($('#scene-outline-dialog')?.open) {
    sceneOutlineView.renderSceneOutline(store.getState());
  }
  if ($('#scene-library-dialog')?.open) {
    sceneBookView.renderSceneLibrary();
  }
  if ($('#scene-templates-dialog')?.open) {
    sceneBookView.renderSceneTemplates();
  }
  renderApp();
  if ($('#project-dialog')?.open) openProjectDialog();
});

wireStaticEvents();
playView.initPointerController();
const initialMode = modeFromHash();
store.dispatch({ type: 'ui/setMode', mode: initialMode });
if (initialMode === 'paint') {
  paintView.openSession({
    itemType: 'wearable',
    slot: store.getState().designer?.selectedSlot || 'top',
    originContext: 'designer'
  });
}
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

let pendingImportEnvelope = null;

window.hardRefresh = async function hardRefresh() {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) await reg.unregister();
    } catch { /* ignore */ }
  }
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      for (const key of keys) await caches.delete(key);
    } catch { /* ignore */ }
  }
  window.location.reload();
};

export { miniButton };
