import { sanitizeCustomAsset } from '../state-schema.js';
import { normalizeDisplayName } from '../text.js';
import { isPropCollection, LIMITS } from '../../domain/vocabulary.js';
import { localizedMessage, removeCustomAssetReferences } from './reducer-helpers.js';

/** @param {import('../../types.js').AppState} state
 * @param {import('../../types.js').StoreAction} action */
export function customAssetReducer(state, action, context) {
  switch (action.type) {
    case 'customAsset/add': {
      const sanitized = sanitizeCustomAsset(action.asset);
      if (!sanitized) return { state: localizedMessage('paint.invalidMetadata', {}, state), result: { ok: false, code: 'INVALID_METADATA' } };
      const existingIndex = state.customAssets.findIndex((a) => a.assetId === sanitized.assetId);
      if (existingIndex < 0 && state.customAssets.length >= LIMITS.MAX_CUSTOM_ASSETS) {
        return { state: localizedMessage('paint.libraryLimit', { limit: LIMITS.MAX_CUSTOM_ASSETS }, state), result: { ok: false, code: 'LIMIT' } };
      }
      const currentBytes = state.customAssets.reduce((sum, asset, index) => sum + (index === existingIndex ? 0 : (asset.byteLength || 0)), 0);
      if (sanitized.byteLength && currentBytes + sanitized.byteLength > LIMITS.MAX_TOTAL_CUSTOM_BYTES) {
        return { state: localizedMessage('paint.storageLimit', { limit: LIMITS.MAX_TOTAL_CUSTOM_BYTES }, state), result: { ok: false, code: 'BYTE_LIMIT' } };
      }
      let nextCustoms;
      if (existingIndex >= 0) {
        nextCustoms = [...state.customAssets];
        nextCustoms[existingIndex] = sanitized;
      } else {
        nextCustoms = [...state.customAssets, sanitized];
      }
      return {
        state: localizedMessage('paint.assetAdded', { name: sanitized.name }, { ...state, customAssets: nextCustoms }),
        persist: true,
        result: { ok: true, assetId: sanitized.assetId }
      };
    }

    case 'customAsset/rename': {
      const name = normalizeDisplayName(action.name, LIMITS.MAX_CUSTOM_ASSET_NAME_LENGTH);
      if (!name) return null;
      const index = state.customAssets.findIndex((a) => a.assetId === action.assetId);
      if (index < 0) return null;
      /** @type {import('../../types.js').CustomAsset} */
      const updated = { ...state.customAssets[index], name, updatedAt: context.now().toISOString() };
      const nextCustoms = [...state.customAssets];
      nextCustoms[index] = updated;
      return {
        state: localizedMessage('paint.assetRenamed', { name }, { ...state, customAssets: nextCustoms }),
        persist: true,
        result: { ok: true }
      };
    }

    case 'customAsset/setCollections': {
      const index = state.customAssets.findIndex((a) => a.assetId === action.assetId);
      if (index < 0 || state.customAssets[index].kind !== 'prop' || !Array.isArray(action.collections)) {
        return { state: localizedMessage('paint.invalidCollections', {}, state), result: { ok: false, code: 'INVALID_COLLECTIONS' } };
      }
      const collections = [...new Set(action.collections.filter(isPropCollection))];
      /** @type {import('../../types.js').CustomAsset} */
      const updated = { ...state.customAssets[index], collections, updatedAt: context.now().toISOString() };
      const nextCustoms = [...state.customAssets];
      nextCustoms[index] = updated;
      return {
        state: localizedMessage('paint.collectionsUpdated', {}, { ...state, customAssets: nextCustoms }),
        persist: true,
        result: { ok: true }
      };
    }

    case 'customAsset/remove': {
      const index = state.customAssets.findIndex((a) => a.assetId === action.assetId);
      if (index < 0) return null;
      const target = state.customAssets[index];
      /** @type {import('../../types.js').CustomAsset} */
      const updated = { ...target, status: 'trashed', libraryVisible: false, updatedAt: context.now().toISOString() };
      const nextCustoms = [...state.customAssets];
      nextCustoms[index] = updated;
      return {
        state: localizedMessage('paint.removedToTrash', { name: target.name }, {
          ...state,
          customAssets: nextCustoms
        }),
        persist: true,
        result: { ok: true }
      };
    }

    case 'customAsset/restore': {
      const index = state.customAssets.findIndex((a) => a.assetId === action.assetId);
      if (index < 0) return null;
      const target = state.customAssets[index];
      /** @type {import('../../types.js').CustomAsset} */
      const updated = { ...target, status: 'available', libraryVisible: true, updatedAt: context.now().toISOString() };
      const nextCustoms = [...state.customAssets];
      nextCustoms[index] = updated;
      return {
        state: localizedMessage('paint.assetRestored', { name: target.name }, {
          ...state,
          customAssets: nextCustoms
        }),
        persist: true,
        result: { ok: true }
      };
    }

    case 'customAsset/deleteWithUses': {
      const targetId = action.assetId;
      const target = state.customAssets.find((a) => a.assetId === targetId);
      if (!target) return null;
      const next = removeCustomAssetReferences(state, [targetId]);

      return {
        state: localizedMessage('paint.deletedWithUses', { name: target.name }, {
          ...state,
          ...next
        }),
        persist: true,
        // The backing binary is already moved/deleted by the caller, so undoing
        // this metadata change would recreate references to missing artwork.
        clearHistory: true,
        result: { ok: true }
      };
    }

    case 'customAsset/purgeTrash': {
      const trashedIds = state.customAssets
        .filter((asset) => asset.status === 'trashed' || asset.libraryVisible === false)
        .map((asset) => asset.assetId);
      const requestedIds = Array.isArray(action.assetIds) ? new Set(action.assetIds) : null;
      const targetIds = requestedIds ? trashedIds.filter((id) => requestedIds.has(id)) : trashedIds;
      if (targetIds.length === 0) return null;
      const next = removeCustomAssetReferences(state, targetIds);
      return {
        state: localizedMessage('paint.trashPurged', { count: targetIds.length }, {
          ...state,
          ...next
        }),
        persist: true,
        // Purged trash binaries cannot be restored by the app undo stack.
        clearHistory: true,
        result: { ok: true, assetIds: targetIds }
      };
    }

    case 'customAsset/clearAll': {
      if (state.customAssets.length === 0) return null;
      const allIds = state.customAssets.map((asset) => asset.assetId);
      const next = removeCustomAssetReferences(state, allIds);
      return {
        state: localizedMessage('toasts.allArtworkCleared', {}, {
          ...state,
          ...next,
          customAssets: []
        }),
        persist: true,
        clearHistory: true,
        result: { ok: true, count: allIds.length }
      };
    }

    default:
      return null;
  }
}
