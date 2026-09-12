import { PACK_REGISTRY } from '../../packs/index.js';
import { message } from './reducer-helpers.js';

/** @param {import('../../types.js').AppState} state
 * @param {import('../../types.js').StoreAction} action */
export function uiReducer(state, action) {
  switch (action.type) {
    case 'ui/setPackFilter':
      if (action.packId !== 'all' && !PACK_REGISTRY.getPack(action.packId)) return null;
      return { state: { ...state, ui: { ...state.ui, packFilter: action.packId } } };
    case 'ui/setMode':
      if (!['designer', 'paint', 'play'].includes(action.mode)) return null;
      return { state: { ...state, ui: { ...state.ui, mode: action.mode, selectedEntityId: null, selectedEntityIds: [] } } };

    case 'ui/selectEntity': {
      const id = action.instanceId;
      if (!id) {
        return {
          state: { ...state, ui: { ...state.ui, selectedEntityId: null, selectedEntityIds: [] } }
        };
      }
      return {
        state: { ...state, ui: { ...state.ui, selectedEntityId: id, selectedEntityIds: [id] } }
      };
    }

    case 'ui/selectEntities': {
      const ids = Array.isArray(action.instanceIds) ? action.instanceIds : [];
      return {
        state: {
          ...state,
          ui: {
            ...state.ui,
            selectedEntityId: ids[0] ?? null,
            selectedEntityIds: [...ids]
          }
        }
      };
    }

    case 'ui/toggleEntitySelection': {
      const id = action.instanceId;
      if (!id) return null;
      const current = new Set(state.ui.selectedEntityIds || []);
      if (current.has(id)) {
        current.delete(id);
      } else {
        current.add(id);
      }
      const nextIds = [...current];
      return {
        state: {
          ...state,
          ui: {
            ...state.ui,
            selectedEntityId: nextIds.at(-1) ?? null,
            selectedEntityIds: nextIds
          }
        }
      };
    }

    case 'ui/clearSelection':
      return {
        state: { ...state, ui: { ...state.ui, selectedEntityId: null, selectedEntityIds: [] } }
      };

    case 'ui/storageStatus':
      return {
        state: {
          ...state,
          ui: {
            ...state.ui,
            storageStatus: action.status ?? state.ui.storageStatus,
            message: action.message ?? state.ui.message,
            messageKey: action.messageKey ?? null,
            messageParams: action.messageParams ?? null
          }
        }
      };

    case 'ui/setVoicePuppetry':
      return {
        state: { ...state, ui: { ...state.ui, voicePuppetryActive: Boolean(action.active) } }
      };

    case 'ui/message':
      return {
        state: message(action.message ?? '', state)
      };

    default:
      return null;
  }
}
