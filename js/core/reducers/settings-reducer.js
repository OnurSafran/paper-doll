import { cloneCustomAsset, clonePreset, cloneScene } from '../state-schema.js';
import { createEmptyScene } from '../../domain/scene-rules.js';
import { createStarterDraft } from '../../domain/outfit-rules.js';
import { evaluateUnlockableBackgrounds } from '../../domain/world-map-catalog.js';
import { localizedMessage, nextUniqueId } from './reducer-helpers.js';

/** @param {import('../../types.js').AppState} state
 * @param {import('../../types.js').StoreAction} action */
export function settingsReducer(state, action, context) {
  switch (action.type) {
    case 'project/importReplace': {
      if (!action.envelope || !Array.isArray(action.envelope.presets)) return null;
      const env = action.envelope;
      const fallbackSceneId = env.currentScene ? null : nextUniqueId(context.makeId, []);
      if (!env.currentScene && !fallbackSceneId) return { state: localizedMessage('projectDialog.safeIdFailed', {}, state), result: { ok: false, code: 'ID_FAILED' } };
      const defaultKey = 'toasts.importReplacedWithBackup';
      return {
        state: localizedMessage(action.messageKey || defaultKey, action.messageParams || {}, {
          ...state,
          settings: { ...state.settings, ...env.settings },
          customAssets: (env.customAssets || []).map(cloneCustomAsset),
          presets: env.presets.map(clonePreset),
          scenes: (env.scenes || []).map(cloneScene),
          currentScene: env.currentScene ? cloneScene(env.currentScene) : createEmptyScene(fallbackSceneId, context.now),
          designer: { draft: createStarterDraft(), selectedSlot: 'top', editingPresetId: null, dirty: false },
          ui: { ...state.ui, selectedEntityId: null, selectedEntityIds: [], activeSceneLibraryId: null }
        }),
        persist: true,
        result: { ok: true }
      };
    }

    case 'project/importMerge': {
      if (!action.envelope || !Array.isArray(action.envelope.presets)) return null;
      const env = action.envelope;
      const defaultKey = 'projectDialog.merged';
      return {
        state: localizedMessage(action.messageKey || defaultKey, action.messageParams || {}, {
          ...state,
          settings: { ...state.settings, ...env.settings },
          customAssets: (env.customAssets || []).map(cloneCustomAsset),
          presets: env.presets.map(clonePreset),
          scenes: (env.scenes || []).map(cloneScene),
          currentScene: env.currentScene ? cloneScene(env.currentScene) : state.currentScene
        }),
        persist: true,
        result: { ok: true }
      };
    }

    case 'project/restoreBackup': {
      if (!action.envelope || !Array.isArray(action.envelope.presets)) return null;
      const env = action.envelope;
      const fallbackSceneId = env.currentScene ? null : nextUniqueId(context.makeId, []);
      if (!env.currentScene && !fallbackSceneId) return { state: localizedMessage('projectDialog.backupSafeIdFailed', {}, state), result: { ok: false, code: 'ID_FAILED' } };
      const defaultKey = 'toasts.backupRestored';
      return {
        state: localizedMessage(action.messageKey || defaultKey, action.messageParams || {}, {
          ...state,
          settings: { ...state.settings, ...env.settings },
          customAssets: (env.customAssets || []).map(cloneCustomAsset),
          presets: env.presets.map(clonePreset),
          scenes: (env.scenes || []).map(cloneScene),
          currentScene: env.currentScene ? cloneScene(env.currentScene) : createEmptyScene(fallbackSceneId, context.now),
          designer: { draft: createStarterDraft(), selectedSlot: 'top', editingPresetId: null, dirty: false },
          ui: { ...state.ui, selectedEntityId: null, selectedEntityIds: [], activeSceneLibraryId: null }
        }),
        persist: true,
        result: { ok: true }
      };
    }

    case 'settings/setReducedMotion': {
      const mode = action.mode;
      if (!['system', 'reduce', 'full'].includes(mode)) return null;
      return {
        state: {
          ...state,
          settings: {
            ...state.settings,
            reducedMotion: mode
          }
        },
        persist: true
      };
    }

    case 'settings/unlockStamp': {
      const stampId = action.stampId;
      if (!stampId || typeof stampId !== 'string' || stampId.length > 50) return null;
      const currentStamps = Array.isArray(state.settings?.stamps) ? state.settings.stamps : [];
      if (currentStamps.includes(stampId)) return null;
      const nextStamps = [...currentStamps, stampId];
      const nextSettings = { ...state.settings, stamps: nextStamps };
      const newlyEligible = evaluateUnlockableBackgrounds(nextSettings);
      const currentUnlocked = Array.isArray(state.settings?.unlockedBackgrounds) ? state.settings.unlockedBackgrounds : [];
      const nextUnlocked = [...new Set([...currentUnlocked, ...newlyEligible])];
      return {
        state: {
          ...state,
          settings: {
            ...state.settings,
            stamps: nextStamps,
            unlockedBackgrounds: nextUnlocked
          }
        },
        persist: true,
        result: { ok: true, unlockedStamps: nextStamps, newlyUnlockedBackgrounds: newlyEligible.filter((id) => !currentUnlocked.includes(id)) }
      };
    }

    case 'settings/unlockBackground': {
      const backgroundId = action.backgroundId;
      if (!backgroundId || typeof backgroundId !== 'string') return null;
      const currentUnlocked = Array.isArray(state.settings?.unlockedBackgrounds) ? state.settings.unlockedBackgrounds : [];
      if (currentUnlocked.includes(backgroundId)) return null;
      return {
        state: {
          ...state,
          settings: {
            ...state.settings,
            unlockedBackgrounds: [...currentUnlocked, backgroundId]
          }
        },
        persist: true
      };
    }

    default:
      return null;
  }
}
