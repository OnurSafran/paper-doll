import { clampCameraX } from './coordinate-space.js';
import { cloneCustomAsset, createRuntimeState } from './state-schema.js';
import { cloneDraft } from '../domain/outfit-rules.js';
import { createAssetRegistry } from './asset-registry.js';
import { t } from './i18n.js';
import {
  DEFAULT_STAGE_WIDTH,
  defaultMakeId,
  defaultNow,
  LIMITS
} from '../domain/vocabulary.js';

import { uiReducer } from './reducers/ui-reducer.js';
import { designerReducer } from './reducers/designer-reducer.js';
import { presetReducer } from './reducers/preset-reducer.js';
import { sceneReducer } from './reducers/scene-reducer.js';
import { customAssetReducer } from './reducers/custom-asset-reducer.js';
import { settingsReducer } from './reducers/settings-reducer.js';
import { validateActionPayload } from './reducers/action-validator.js';

export {
  validateActionPayload,
  uiReducer,
  designerReducer,
  presetReducer,
  sceneReducer,
  customAssetReducer,
  settingsReducer
};

const domainReducers = {
  ui: uiReducer,
  designer: designerReducer,
  preset: presetReducer,
  scene: sceneReducer,
  customAsset: customAssetReducer,
  settings: settingsReducer,
  project: settingsReducer
};

export function createAppStore(envelope, options = {}) {
  /** @type {import('../types.js').AppState} */
  let state = createRuntimeState(envelope);
  const listeners = new Set();
  const getAssetOption = options.getAsset ?? ((_id) => undefined);
  const makeId = options.makeId ?? defaultMakeId;
  const now = options.now ?? defaultNow;
  const assets = options.assets ?? [];
  const random = options.random ?? Math.random;
  const maxHistory = options.maxHistory ?? LIMITS.MAX_HISTORY;
  const strictValidation = options.strictValidation ?? false;

  const undoStack = [];
  const redoStack = [];

  function getEffectiveAsset(id) {
    const custom = (state.customAssets || []).find((a) => a.assetId === id);
    if (custom) {
      const reg = createAssetRegistry(state.customAssets);
      return reg.getAsset(id);
    }
    return getAssetOption(id);
  }

  /** @param {import('../types.js').StoreAction} action */
  function dispatch(action) {
    if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
      return { ok: false, code: 'INVALID_PAYLOAD' };
    }
    if (strictValidation) {
      const validation = validateActionPayload(action);
      if (!validation.valid) {
        return { ok: false, code: 'INVALID_PAYLOAD', reason: validation.reason };
      }
    }

    const previousState = state;
    if (action.type === 'app/undo') {
      if (undoStack.length === 0) return { ok: false, code: 'NOTHING_TO_UNDO' };
      const prevSnapshot = undoStack.pop();
      redoStack.push(snapshotDomain(state));
      const willPersist = prevSnapshot.presets !== state.presets ||
        prevSnapshot.scenes !== state.scenes ||
        prevSnapshot.currentScene !== state.currentScene ||
        prevSnapshot.customAssets !== state.customAssets;
      const remainingSelectedIds = (state.ui.selectedEntityIds || []).filter((id) =>
        prevSnapshot.currentScene?.entities?.some((e) => e.instanceId === id)
      );
      const selectedStillExists = prevSnapshot.currentScene?.entities?.some((e) => e.instanceId === state.ui.selectedEntityId);
      state = {
        ...state,
        designer: {
          ...state.designer,
          draft: cloneDraft(prevSnapshot.designer.draft),
          selectedSlot: prevSnapshot.designer.selectedSlot,
          editingPresetId: prevSnapshot.designer.editingPresetId,
          dirty: prevSnapshot.designer.dirty
        },
        customAssets: (prevSnapshot.customAssets || []).map(cloneCustomAsset),
        presets: prevSnapshot.presets,
        scenes: prevSnapshot.scenes,
        currentScene: restoreSceneForHistory(prevSnapshot.currentScene, state.currentScene),
        ui: {
          ...state.ui,
          selectedEntityId: selectedStillExists ? state.ui.selectedEntityId : (remainingSelectedIds[0] || null),
          selectedEntityIds: remainingSelectedIds,
          message: t('app.actionUndone'),
          messageKey: 'app.actionUndone',
          messageParams: {}
        }
      };
      for (const listener of listeners) {
        listener({ action, previousState, state, persist: willPersist });
      }
      return { ok: true, undone: true };
    }

    if (action.type === 'app/redo') {
      if (redoStack.length === 0) return { ok: false, code: 'NOTHING_TO_REDO' };
      const nextSnapshot = redoStack.pop();
      undoStack.push(snapshotDomain(state));
      const willPersist = nextSnapshot.presets !== state.presets ||
        nextSnapshot.scenes !== state.scenes ||
        nextSnapshot.currentScene !== state.currentScene ||
        nextSnapshot.customAssets !== state.customAssets;
      const remainingSelectedIds = (state.ui.selectedEntityIds || []).filter((id) =>
        nextSnapshot.currentScene?.entities?.some((e) => e.instanceId === id)
      );
      const selectedStillExists = nextSnapshot.currentScene?.entities?.some((e) => e.instanceId === state.ui.selectedEntityId);
      state = {
        ...state,
        designer: {
          ...state.designer,
          draft: cloneDraft(nextSnapshot.designer.draft),
          selectedSlot: nextSnapshot.designer.selectedSlot,
          editingPresetId: nextSnapshot.designer.editingPresetId,
          dirty: nextSnapshot.designer.dirty
        },
        customAssets: (nextSnapshot.customAssets || []).map(cloneCustomAsset),
        presets: nextSnapshot.presets,
        scenes: nextSnapshot.scenes,
        currentScene: restoreSceneForHistory(nextSnapshot.currentScene, state.currentScene),
        ui: {
          ...state.ui,
          selectedEntityId: selectedStillExists ? state.ui.selectedEntityId : (remainingSelectedIds[0] || null),
          selectedEntityIds: remainingSelectedIds,
          message: t('app.actionRedone'),
          messageKey: 'app.actionRedone',
          messageParams: {}
        }
      };
      for (const listener of listeners) {
        listener({ action, previousState, state, persist: willPersist });
      }
      return { ok: true, redone: true };
    }

    const result = reduce(state, action, { getAsset: getEffectiveAsset, makeId, now, assets, random });
    if (!result || result.state === state) return result?.result ?? { ok: false, code: 'NO_CHANGE' };

    const domainChanged = previousState.designer.draft !== result.state.designer.draft ||
      previousState.presets !== result.state.presets ||
      previousState.scenes !== result.state.scenes ||
      previousState.currentScene !== result.state.currentScene ||
      previousState.customAssets !== result.state.customAssets;
    const nonUndoAction = action.type === 'scene/setCameraX' || action.type === 'scene/panCamera' || action.type === 'scene/playbackFinished';

    if (domainChanged && !nonUndoAction) {
      undoStack.push(snapshotDomain(previousState));
      if (undoStack.length > maxHistory) undoStack.shift();
      redoStack.length = 0;
    }

    state = result.state;
    for (const listener of listeners) {
      listener({ action, previousState, state, persist: Boolean(result.persist) });
    }
    return result.result ?? { ok: true };
  }

  return {
    getState: () => state,
    dispatch,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

function snapshotDomain(state) {
  return {
    designer: {
      draft: cloneDraft(state.designer.draft),
      editingPresetId: state.designer.editingPresetId,
      selectedSlot: state.designer.selectedSlot,
      dirty: state.designer.dirty
    },
    customAssets: (state.customAssets || []).map(cloneCustomAsset),
    presets: state.presets,
    scenes: state.scenes,
    currentScene: state.currentScene
  };
}

function restoreSceneForHistory(snapshotScene, currentScene) {
  if (!snapshotScene) return snapshotScene;
  return {
    ...snapshotScene,
    cameraX: clampCameraX(currentScene?.cameraX ?? snapshotScene.cameraX, snapshotScene.stageWidth || DEFAULT_STAGE_WIDTH)
  };
}

function reduce(state, action, context) {
  if (!action || typeof action.type !== 'string') return null;
  const slashIndex = action.type.indexOf('/');
  if (slashIndex === -1) return null;
  const prefix = action.type.slice(0, slashIndex);
  const reducer = Object.hasOwn(domainReducers, prefix) ? domainReducers[prefix] : null;
  if (reducer) {
    return reducer(state, action, context);
  }
  return null;
}
