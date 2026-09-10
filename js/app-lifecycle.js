/** Storage lifecycle and repeatable runtime error recovery. */
import { STORAGE_KEY } from './services/project-repository.js';
import { classifyError, createDisposableRegistry, executeSafeTeardown } from './core/error-boundary.js';
import { t } from './core/i18n.js';

export function createAppLifecycle(context) {
  function wireLifecycleEvents() {
    const handleTeardownFlush = () => {
      context.cancelPointerController();
      context.paintView.cancelAsyncOperations?.();
      void context.paintView.flushDraftCheckpoint?.();
      context.exportService.cancel();
      context.sceneAnimationService.pause();
      context.customArtRepo.revokeAllTrackedUrls();
      if (context.store.getState().ui.voicePuppetryActive) {
        context.store.dispatch({ type: 'ui/setVoicePuppetry', active: false });
        context.stopVoicePuppetry();
      }
      context.storage.flush();
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        handleTeardownFlush();
      } else if (document.visibilityState === 'visible') {
        const state = context.store.getState();
        if (state.ui.mode === 'play' && state.currentScene?.animationSettings?.enabled) {
          context.sceneAnimationService.play();
        }
      }
    });
    window.addEventListener('pagehide', handleTeardownFlush);
    window.addEventListener('resize', context.cancelPointerController);
    window.addEventListener('beforeunload', () => context.storage.flush());
    window.addEventListener('storage', async (event) => {
      if (event.key === STORAGE_KEY) {
        const storageRev = context.storage.getStorageRevision();
        const baseRev = context.storage.getBaseRevision();
        if (storageRev != null && storageRev > baseRev) {
          const shouldReload = await context.askConfirm(
            t('sync.crossTabTitle'),
            t('sync.crossTabMessage')
          );
          if (shouldReload) {
            location.reload();
          } else {
            context.store.dispatch({
              type: 'ui/storageStatus',
              status: 'unsaved',
              message: t('sync.tabLocalState')
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

    context.$('#dismiss-error-btn')?.addEventListener('click', () => {
      const dialog = context.$('#error-boundary-dialog');
      if (dialog?.open) dialog.close();
    });
    context.$('#reload-error-btn')?.addEventListener('click', () => {
      location.reload();
    });
  }

  function handleTopLevelError(error, _source = 'runtime') {
    const code = classifyError(error);
    const recoveryDisposables = createDisposableRegistry();
    recoveryDisposables.register(context.cancelPointerController);
    recoveryDisposables.register(() => {
      if (context.store.getState().ui.voicePuppetryActive) {
        context.store.dispatch({ type: 'ui/setVoicePuppetry', active: false });
        context.stopVoicePuppetry();
      }
    });
    recoveryDisposables.register(() => context.sceneAnimationService.pause());
    recoveryDisposables.register(() => context.exportService.cancel());
    recoveryDisposables.register(() => context.storage?.cancel());
    recoveryDisposables.register(() => context.paintView.cancelAsyncOperations());
    try {
      const dialog = context.$('#error-boundary-dialog');
      const codeEl = context.$('#error-boundary-code');
      if (codeEl) codeEl.textContent = code;
      if (dialog && typeof dialog.showModal === 'function' && !dialog.open) {
        dialog.showModal();
      }
      context.store.dispatch({ type: 'ui/storageStatus', status: 'unsaved', message: t('sync.errorMessage') });
    } finally {
      // Rendering the error status may restart animation; cancel after notifying.
      executeSafeTeardown(recoveryDisposables);
    }
  }

  return { wireLifecycleEvents, handleTopLevelError };
}
