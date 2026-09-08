/** Persistence, selection patches, and animation effects for store changes. */
import { applyMouthExpression } from './core/mouth-expression.js';
import { findSceneSkinSvg } from './features/play/play-view.js';
import { persistedProjection } from './core/state-schema.js';
import { DEFAULT_EXPRESSION_INTENSITY } from './domain/vocabulary.js';
import { translateMessage } from './core/i18n.js';

export function createAppStateEffects(context) {
  const toastActions = new Set([
    'designer/equip', 'designer/clearOutfit', 'designer/shuffle', 'preset/save', 'preset/update', 'preset/delete',
    'scene/spawnCharacter', 'scene/spawnProp', 'scene/spawnBubble', 'scene/duplicateEntity', 'scene/deleteEntity', 'scene/deleteEntities', 'scene/new',
    'scene/togglePin', 'scene/togglePinEntities', 'scene/attachEntity', 'scene/detachEntity', 'scene/alignEntities',
    'scene/saveToLibrary', 'scene/duplicateCurrentToLibrary', 'scene/updateLibraryScene', 'scene/loadFromLibrary', 'scene/loadTemplate', 'scene/duplicateLibraryScene', 'scene/deleteLibraryScene',
    'project/importReplace', 'project/importMerge', 'project/restoreBackup',
    'app/undo', 'app/redo'
  ]);

  function handleStoreChange({ action, previousState, state, persist }) {
    if (persist) context.storage.schedule(persistedProjection(state));
    if (toastActions.has(action.type)) {
      context.showToast(state.ui.messageKey ? translateMessage(state.ui.messageKey, state.ui.messageParams || {}) : state.ui.message);
    }

    if (action.type === 'scene/setCameraX' || action.type === 'scene/panCamera') {
      context.playView.syncCamera(state);
      return;
    }

    if (action.type === 'ui/selectEntity' || action.type === 'ui/selectEntities' || action.type === 'ui/toggleEntitySelection' || action.type === 'ui/clearSelection') {
      const selectedSet = new Set(state.ui.selectedEntityIds || (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : []));
      for (const element of context.$$('.scene-entity-positioner')) {
        const isSelected = selectedSet.has(element.dataset.instanceId);
        const isPrimary = element.dataset.instanceId === state.ui.selectedEntityId;
        element.classList.toggle('is-selected', isPrimary || (isSelected && selectedSet.size === 1));
        element.classList.toggle('is-multi-selected', isSelected && selectedSet.size > 1);
      }
      context.playView.renderSelectedActions(state);
      context.playView.renderContextRing(state);
      if (context.$('#scene-outline-dialog')?.open) {
        context.sceneOutlineView.renderSceneOutline(state);
      }
      return;
    }
    if (action.type === 'scene/setDollExpression') {
      const targetIds = action.instanceIds || (action.instanceId ? [action.instanceId] : (state.ui.selectedEntityIds?.length ? state.ui.selectedEntityIds : (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : [])));
      for (const targetId of targetIds) {
        const entity = state.currentScene?.entities?.find((e) => e.instanceId === targetId);
        const domSkin = findSceneSkinSvg(targetId, context.$$);
        if (domSkin && entity) {
          applyMouthExpression(domSkin, action.expression, entity.expressionIntensity ?? DEFAULT_EXPRESSION_INTENSITY);
        }
      }
      context.playView.renderSelectedActions(state);
      return;
    }
    if (action.type === 'scene/setAnimationSettings' || action.type === 'scene/toggleScenePlayback' || action.type === 'scene/playbackFinished') {
      context.playView.renderSelectedActions(state);
      if (action.type === 'scene/playbackFinished') return;
    }
    if (action.type === 'scene/toggleSceneLoop') {
      context.playView.renderSelectedActions(state);
      return;
    }
    if (action.type === 'scene/setDollExpressionIntensity' || action.type === 'scene/setDollPose' || action.type === 'scene/setDollAnimation') {
      context.playView.renderSelectedActions(state);
      context.sceneAnimationService.applyStaticPoseToDom();
    }
    if (
      action.type === 'settings/setReducedMotion' ||
      action.type === 'project/importReplace' ||
      action.type === 'project/importMerge' ||
      action.type === 'project/restoreBackup'
    ) {
      context.sceneAnimationService.handleSettingsChange();
      context.playView.renderSelectedActions(state);
    }

    // Sync global playback with current scene and mode
    const currentSceneEnabled = Boolean(state.currentScene?.animationSettings?.enabled);
    const isPlayMode = state.ui.mode === 'play';
    const motionAllowed = context.sceneAnimationService.getEffectiveMotionAllowed ? context.sceneAnimationService.getEffectiveMotionAllowed() : true;
    const shouldAnimate = isPlayMode && currentSceneEnabled && motionAllowed;

    const enteredPlay = previousState.ui.mode !== 'play' && isPlayMode;
    const sceneChanged = previousState.currentScene?.sceneId !== state.currentScene?.sceneId;
    const toggledPlayOn = action.type === 'scene/toggleScenePlayback' && currentSceneEnabled;

    if (enteredPlay || sceneChanged || toggledPlayOn) {
      context.sceneAnimationService.resetClock();
    }

    if (shouldAnimate && !context.sceneAnimationService.isPlaying()) {
      context.sceneAnimationService.play();
    } else if (!shouldAnimate && context.sceneAnimationService.isPlaying()) {
      context.sceneAnimationService.pause();
    }

    if (context.$('#scene-outline-dialog')?.open) {
      context.sceneOutlineView.renderSceneOutline(state);
    }
    context.renderApp();
  }

  return { handleStoreChange };
}
