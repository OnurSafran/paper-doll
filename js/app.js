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

import { ASSETS } from './core/asset-catalog.js';
import { createAppStore } from './core/app-store.js';
import { createAssetRegistry } from './core/asset-registry.js';
import { getVisiblePackManifests, PACK_REGISTRY } from './packs/index.js';

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
const loaded = loadProject(storageRef, PACK_REGISTRY.getAsset);
const visiblePackIds = PACK_REGISTRY.getPackIds().filter((id) => !loaded.envelope.settings?.hiddenPacks?.includes(id));
const builtInAssetRegistry = createAssetRegistry([], { packRegistry: PACK_REGISTRY, visiblePackIds });
const customArtRepo = createCustomArtRepository();
const store = createAppStore(loaded.envelope, {
  getAsset: builtInAssetRegistry.getAsset,
  assets: PACK_REGISTRY.getPacks().flatMap((manifest) => manifest.assets)
});
const getEffectiveAssetRegistry = () => createAssetRegistry(
  store ? store.getState().customAssets : loaded.envelope.customAssets,
  {
    packRegistry: PACK_REGISTRY,
    visiblePackIds: PACK_REGISTRY.getPackIds().filter((id) => !store?.getState()?.settings?.hiddenPacks?.includes(id))
  }
);
const getEffectiveAsset = (id) => getEffectiveAssetRegistry().getAsset(id);
const getEffectiveAssetsByKind = (kind, options = {}) => getEffectiveAssetRegistry().assetsByKind(kind, { packId: ['prop', 'background', 'wearable'].includes(kind) ? store.getState().ui.packFilter || 'all' : 'all', ...options });
const storage = createProjectRepository({
  storage: storageRef,
  initialRevision: loaded.envelope?.revision ?? 1,
  onStatus({ status, message, messageKey, messageParams }) {
    store.dispatch({ type: 'ui/storageStatus', status, message, messageKey, messageParams });
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

const { openProjectDialog, exportProjectJsonFile, handleProjectFile, executeImportMerge, executeImportReplace, executeRestoreBackup, executeDismissBackup, executeFactoryReset } = createAppProjectController({
  $,
  storageRef,
  customArtRepo,
  store,
  storage,
  get showToast() { return showToast; },
  get askConfirm() { return askConfirm; },
  get showAlert() { return showAlert; },
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
  get showAlert() { return showAlert; },
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
  get executeDismissBackup() { return executeDismissBackup; },
  get executeFactoryReset() { return executeFactoryReset; }
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
  getAsset: getEffectiveAsset,
  assetRegistry: {
    assetsByKind: (kind, options) => getEffectiveAssetsByKind(kind, options),
    getOfferedWearables: (...args) => getEffectiveAssetRegistry().getOfferedWearables(...args).filter((asset) => !asset.custom),
    facesByGroup: (...args) => getEffectiveAssetRegistry().facesByGroup(...args)
  }
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
      return getEffectiveAssetsByKind('wearable').filter((asset) => asset.slot === slot);
    },
    wearablesBySlot: (slot) => ASSETS.filter((asset) => asset.kind === 'wearable' && asset.slot === slot).concat(
      getEffectiveAssetRegistry().assetsByKind('wearable')
        .filter((asset) => asset.packId !== 'core' && !asset.custom && asset.slot === slot)
    ),
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

function renderPackControls() {
  const visiblePacks = getVisiblePackManifests(PACK_REGISTRY.getPacks(), store.getState().settings.hiddenPacks);
  for (const select of document.querySelectorAll('select[data-pack-picker]')) {
    const value = store.getState().ui.packFilter || 'all';
    select.replaceChildren(new Option(t('pack_family_home.allPacks'), 'all'), ...visiblePacks.map((pack) => new Option(t(pack.nameKey) || 'Core', pack.id)));
    /** @type {HTMLSelectElement} */ (select).value = visiblePacks.some((pack) => pack.id === value) ? value : 'all';
  }
  const outfits = $('#family-outfit-picker');
  if (outfits) outfits.replaceChildren(new Option(t('pack_family_home.chooseOutfit'), ''), ...visiblePacks.flatMap((pack) => (pack.outfits || []).map((outfit) => new Option(t(outfit.nameKey), outfit.id))));
}
for (const select of document.querySelectorAll('select[data-pack-picker]')) select.addEventListener('change', () => store.dispatch({ type: 'ui/setPackFilter', packId: /** @type {HTMLSelectElement} */ (select).value }));
$('#family-outfit-picker')?.addEventListener('change', (event) => {
  if (event.target.value) store.dispatch({ type: 'designer/loadOutfit', outfitId: event.target.value });
  event.target.value = '';
});
store.subscribe(renderPackControls);
window.addEventListener('languagechange', renderPackControls);


// Initialize language on startup (defaults to Turkish 'tr')
initLanguage();
updateDomTranslations();
renderPackControls();

function updateLangButtonUI() {
  const current = getCurrentLanguage();
  const textEl = $('#current-lang-text');
  if (textEl) textEl.textContent = current.toUpperCase();
  for (const button of document.querySelectorAll('#settings-language-group [data-lang]')) {
    button.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (button).dataset.lang === current));
  }
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
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      for (const key of keys) await caches.delete(key);
    } catch { /* ignore */ }
  }
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.update()));
    } catch { /* ignore */ }
  }
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_v', Date.now().toString());
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
};

// hardRefresh appends ?_v= to bypass the HTTP cache; drop it after boot so
// later reloads and bookmarks keep the canonical URL.
try {
  const bootUrl = new URL(window.location.href);
  if (bootUrl.searchParams.has('_v')) {
    bootUrl.searchParams.delete('_v');
    window.history.replaceState(window.history.state, '', bootUrl.toString());
  }
} catch { /* ignore */ }

export { miniButton };
