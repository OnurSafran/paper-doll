/** Application routing and active view presentation. */
import { t, translateMessage } from './core/i18n.js';

export function createAppRouter(context) {
  let pendingPaintContext = null;

  function openPaintStudio(options = {}) {
    pendingPaintContext = options;
    location.hash = '#paint';
  }

  function renderApp() {
    const state = context.store.getState();
    const designerActive = state.ui.mode === 'designer';
    const paintActive = state.ui.mode === 'paint';
    const playActive = state.ui.mode === 'play';

    context.$('#designer-screen').hidden = !designerActive;
    context.$('#paint-screen').hidden = !paintActive;
    context.$('#play-screen').hidden = !playActive;

    const sectionName = paintActive ? t('paint.title') : designerActive ? t('designer.title') : t('play.title');
    document.title = `${sectionName} · ${t('app.title')}`;
    for (const link of context.$$('[data-mode-link]')) {
      if (link.dataset.modeLink === state.ui.mode) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    const undoBtn = context.$('#undo-button');
    const redoBtn = context.$('#redo-button');
    if (undoBtn) undoBtn.disabled = !context.store.canUndo();
    if (redoBtn) redoBtn.disabled = !context.store.canRedo();
    const saveStatus = context.$('#save-status');
    saveStatus.dataset.status = state.ui.storageStatus;
    const statusTexts = {
      saved: t('header.statusSaved'),
      saving: t('header.statusSaving'),
      unsaved: t('header.statusUnsaved')
    };
    saveStatus.textContent = statusTexts[state.ui.storageStatus] ?? t('header.statusSaved');
    saveStatus.title = state.ui.storageStatus === 'saved' ? t('header.savedDevice') : saveStatus.textContent;
    const count = context.$('#dollbox-count');
    count.textContent = String(state.presets.length);
    count.setAttribute('aria-label', t('nav.dollboxCountAria', { count: state.presets.length }));
    const sceneLibCount = context.$('#scene-library-count');
    if (sceneLibCount) sceneLibCount.textContent = String(state.scenes?.length ?? 0);
    const voiceBtn = context.$('#voice-puppetry-btn');
    if (voiceBtn) voiceBtn.classList.toggle('voice-puppetry-active', Boolean(state.ui.voicePuppetryActive));
    const uiMessage = state.ui.messageKey ? translateMessage(state.ui.messageKey, state.ui.messageParams || {}) : state.ui.message;
    context.$('#designer-status').textContent = uiMessage;
    context.$('#play-status').textContent = uiMessage;
    if (paintActive) {
      context.designerView.bumpToken();
      context.playView.bumpToken();
    } else if (designerActive) {
      context.playView.bumpToken();
      void context.designerView.render(state);
    } else {
      context.designerView.bumpToken();
      void context.playView.render(state);
    }
  }

  function modeFromHash() {
    if (location.hash === '#paint') return 'paint';
    return location.hash === '#designer' ? 'designer' : 'play';
  }

  function wireStaticEvents() {
    window.addEventListener('hashchange', () => {
      context.cancelPointerController();
      if (context.store.getState().ui.voicePuppetryActive) {
        context.store.dispatch({ type: 'ui/setVoicePuppetry', active: false });
        context.stopVoicePuppetry();
      }
      const nextMode = modeFromHash();
      context.store.dispatch({ type: 'ui/setMode', mode: nextMode });
      if (nextMode === 'paint') {
        const options = pendingPaintContext || {
          itemType: 'wearable',
          slot: context.store.getState().designer?.selectedSlot || 'top',
          originContext: 'designer'
        };
        pendingPaintContext = null;
        context.paintView.openSession(options);
        if (options.editAssetId) {
          void context.paintView.editCopyOfArtwork?.(options.editAssetId);
        }
      }
      context.$('#main-content').focus({ preventScroll: true });
    });

    context.wireDesignerEvents();
    context.wireSceneEvents();
    context.wireShellEvents();
    context.wireDropEvents();
    context.wireLifecycleEvents();
  }

  return { modeFromHash, openPaintStudio, wireStaticEvents, renderApp };
}
