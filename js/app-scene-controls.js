/** Scene dialogs, animation controls, and image export actions. */
import { enableDialogFocusRestoration, enableDialogLightDismiss } from './core/dialog-dismiss.js';
import { t } from './core/i18n.js';

export function createAppSceneControls(context) {
  function wireSceneEvents() {
    context.$('#background-select').addEventListener('change', (event) => context.store.dispatch({ type: 'scene/setBackground', backgroundId: event.target.value }));
    context.$('#new-scene').addEventListener('click', async () => {
      const hasItems = context.store.getState().currentScene.entities.length > 0;
      if (!hasItems || await context.askConfirm(t('play.newSceneTitle'), t('play.newSceneMessage'))) {
        context.store.dispatch({ type: 'scene/new' });
      }
    });

    // World Map dialog wiring
    context.$('#open-world-map-btn')?.addEventListener('click', () => context.worldMapView.openWorldMapDialog());
    context.$('#close-world-map')?.addEventListener('click', () => context.worldMapView.closeWorldMapDialog());

    // Scene Library, Templates, Outline & Save Scene dialog wiring
    context.$('#scene-templates-btn')?.addEventListener('click', () => context.sceneBookView.openSceneTemplatesDialog());
    context.$('#close-scene-templates')?.addEventListener('click', () => context.$('#scene-templates-dialog')?.close());
    context.$('#scene-outline-btn')?.addEventListener('click', () => context.sceneOutlineView.openSceneOutlineDialog());
    context.$('#close-scene-outline')?.addEventListener('click', () => context.$('#scene-outline-dialog')?.close());
    context.$('#outline-select-all-btn')?.addEventListener('click', () => {
      const allIds = context.store.getState().currentScene.entities.map((e) => e.instanceId);
      context.store.dispatch({ type: 'ui/selectEntities', instanceIds: allIds });
    });
    context.$('#outline-deselect-btn')?.addEventListener('click', () => context.store.dispatch({ type: 'ui/clearSelection' }));
    context.$('#save-scene-copy-btn')?.addEventListener('click', () => context.store.dispatch({ type: 'scene/duplicateCurrentToLibrary' }));

    context.$('#scene-library-btn')?.addEventListener('click', () => context.sceneBookView.openSceneLibraryDialog());
    context.$('#close-scene-library')?.addEventListener('click', () => context.$('#scene-library-dialog')?.close());
    context.$('#clear-all-scenes-btn')?.addEventListener('click', async () => {
      const scenes = context.store.getState().scenes || [];
      if (scenes.length === 0) return;
      const confirmed = await context.askConfirm(
        t('sceneBook.clearAllScenesTitle'),
        t('sceneBook.clearAllScenesMessage', { count: scenes.length }),
        {
          okText: t('common.delete'),
          cancelText: t('common.cancel'),
          danger: true
        }
      );
      if (confirmed) {
        context.store.dispatch({ type: 'scene/clearLibraryScenes' });
        void context.sceneBookView.renderSceneLibrary();
      }
    });
    context.$('#save-scene-btn')?.addEventListener('click', () => context.sceneBookView.openSaveSceneDialog());
    context.$('#cancel-save-scene')?.addEventListener('click', () => context.$('#save-scene-dialog')?.close());
    context.$('#save-scene-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const title = context.$('#scene-title-input')?.value;
      context.store.dispatch({ type: 'scene/saveToLibrary', name: title });
      context.$('#save-scene-dialog')?.close();
    });
    context.$('#update-existing-scene')?.addEventListener('click', () => {
      const title = context.$('#scene-title-input')?.value;
      context.store.dispatch({ type: 'scene/updateLibraryScene', name: title });
      context.$('#save-scene-dialog')?.close();
    });

    // Light-dismiss wiring for library dialogs (outside click closes dialog)
    context.$$('dialog[closedby="any"], dialog.library-dialog').forEach(enableDialogLightDismiss);
    context.$$('dialog').filter((dialog) => dialog.id !== 'world-map-dialog').forEach((dialog) => enableDialogFocusRestoration(dialog, '#main-content'));

    // Alignment buttons wiring
    context.$('#alignment-controls')?.addEventListener('click', (event) => {
      const action = event.target.closest('button')?.dataset.action;
      if (action) void context.playView.handleEntityAction(action);
    });

    // Expression buttons wiring
    context.$('#character-expression-controls')?.addEventListener('click', (event) => {
      const expr = event.target.closest('button')?.dataset.expression;
      if (expr) context.store.dispatch({ type: 'scene/setDollExpression', expression: expr });
    });

    // Expression Intensity buttons wiring
    context.$('#character-expression-intensity-controls')?.addEventListener('click', (event) => {
      const intensity = event.target.closest('button')?.dataset.expressionIntensity;
      if (intensity !== undefined) {
        context.store.dispatch({ type: 'scene/setDollExpressionIntensity', expressionIntensity: Number(intensity) });
      }
    });

    // Static Pose buttons wiring
    context.$('#character-pose-controls')?.addEventListener('click', (event) => {
      const pose = event.target.closest('button')?.dataset.pose;
      if (pose) context.store.dispatch({ type: 'scene/setDollPose', pose });
    });

    // Animation Clip buttons wiring
    context.$('#character-animation-clip-controls')?.addEventListener('click', (event) => {
      const clipId = event.target.closest('button')?.dataset.clipId;
      if (clipId) {
        context.store.dispatch({
          type: 'scene/setDollAnimation',
          animation: {
            clipId,
            enabled: clipId !== 'none'
          }
        });
      }
    });

    // Motion Intensity buttons wiring
    context.$('#character-motion-intensity-controls')?.addEventListener('click', (event) => {
      const intensity = event.target.closest('button')?.dataset.motionIntensity;
      if (intensity !== undefined) {
        context.store.dispatch({
          type: 'scene/setDollAnimation',
          animation: {
            intensity: Number(intensity)
          }
        });
      }
    });

    // Phase Offset buttons wiring
    context.$('#character-phase-offset-controls')?.addEventListener('click', (event) => {
      const offset = event.target.closest('button')?.dataset.phaseOffset;
      if (offset !== undefined) {
        context.store.dispatch({
          type: 'scene/setDollAnimation',
          animation: {
            phaseOffset: Number(offset)
          }
        });
      }
    });

    // Motion Preference (Reduced Motion mode) buttons in the Settings dialog
    context.$('#settings-motion-group')?.addEventListener('click', (event) => {
      const mode = event.target.closest('button')?.dataset.motionMode;
      if (mode) {
        context.store.dispatch({ type: 'settings/setReducedMotion', mode });
      }
    });

    // Animation Transport Controls wiring
    context.$('#play-animation-btn')?.addEventListener('click', () => {
      context.store.dispatch({ type: 'scene/toggleScenePlayback' });
    });
    context.$('#loop-animation-btn')?.addEventListener('click', () => {
      context.store.dispatch({ type: 'scene/toggleSceneLoop' });
    });
    context.$('#reset-animation-btn')?.addEventListener('click', () => {
      context.sceneAnimationService.reset();
    });
    context.$('#scene-playback-rate-controls')?.addEventListener('click', (event) => {
      const rate = event.target.closest('button')?.dataset.playbackRate;
      if (rate !== undefined) {
        context.store.dispatch({ type: 'scene/setPlaybackRate', playbackRate: Number(rate) });
      }
    });

    // Attached entity joint selection wiring
    context.$('#attach-joint-controls')?.addEventListener('click', (event) => {
      const joint = event.target.closest('button')?.dataset.attachJoint;
      if (joint) {
        context.store.dispatch({ type: 'scene/setAttachJoint', attachJoint: joint });
      }
    });

    // Rhythm synchronization wiring
    context.$('#rhythm-sync-controls')?.addEventListener('click', (event) => {
      const mode = event.target.closest('button')?.dataset.rhythmMode;
      if (mode) {
        context.store.dispatch({ type: 'scene/syncCharacterBeats', mode });
      }
    });

    // Speech bubble controls & dialog wiring
    context.$('#bubble-controls')?.addEventListener('click', (event) => {
      const style = event.target.closest('button')?.dataset.bubbleStyle;
      if (style) context.store.dispatch({ type: 'scene/setBubbleStyle', bubbleStyle: style });
    });
    context.$('#bubble-text-input')?.addEventListener('input', (event) => {
      const count = context.$('#bubble-char-count');
      if (count) count.textContent = `${event.target.value.length}/120`;
    });
    context.$('#cancel-bubble-text')?.addEventListener('click', () => context.$('#bubble-text-dialog')?.close());
    context.$('#bubble-text-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = context.$('#bubble-text-input')?.value;
      context.store.dispatch({ type: 'scene/setBubbleText', text });
      context.$('#bubble-text-dialog')?.close();
    });

    // Voice Puppetry wiring
    context.$('#voice-puppetry-btn')?.addEventListener('click', () => void context.toggleVoicePuppetry());

    // Language Toggle wiring
  }

  async function exportSceneAsPng() {
    const state = context.store.getState();
    const result = await context.exportService.exportSceneAndDownload(state.currentScene);
    if (result.ok) {
      context.showToast(t('toasts.sceneExportedPng'));
    } else {
      context.showToast(result.message || t('toasts.sceneExportFailed'));
    }
  }

  async function exportCurrentFrameAsPng() {
    const state = context.store.getState();
    const isPlaying = context.sceneAnimationService.isPlaying();
    const elapsedMs = isPlaying ? context.sceneAnimationService.getElapsedMs() : 0;
    const result = await context.exportService.exportSceneAndDownload(state.currentScene, {
      animationTimeMs: elapsedMs,
      playbackEnabled: isPlaying
    });
    if (result.ok) {
      context.showToast(t('toasts.sceneExportedPng'));
    } else {
      context.showToast(result.message || t('toasts.sceneExportFailed'));
    }
  }

  return { wireSceneEvents, exportSceneAsPng, exportCurrentFrameAsPng };
}
