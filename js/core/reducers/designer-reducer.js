import { PACK_REGISTRY } from '../../packs/index.js';
import {
  clearFaceDetail,
  clearOutfit,
  cloneDraft,
  createStarterDraft,
  equipWearable,
  isFaceCompatible,
  removeSlot,
  resetFace,
  setBaseDoll,
  setFaceFeature,
  setIrisColor,
  setSlotColor
} from '../../domain/outfit-rules.js';
import {
  isColorValue,
  isIrisColor,
  isPaletteToken,
  normalizeColorValue
} from '../palette.js';
import {
  isCustomAssetId,
  isFaceGroup,
  isOutfitSlot,
  isPresentationStyle
} from '../../domain/vocabulary.js';
import { t } from '../i18n.js';
import { localizedMessage, shuffleDraft } from './reducer-helpers.js';

/** @param {import('../../types.js').AppState} state
 * @param {import('../../types.js').StoreAction} action */
export function designerReducer(state, action, context) {
  switch (action.type) {
    case 'designer/loadOutfit': {
      const pack = PACK_REGISTRY.getPacks().find((item) => item.outfits?.some((outfit) => outfit.id === action.outfitId));
      const outfit = pack?.outfits.find((item) => item.id === action.outfitId);
      if (!outfit || state.settings.hiddenPacks?.includes(pack.id)) return null;
      return { state: { ...state, designer: { ...state.designer, draft: cloneDraft(outfit), editingPresetId: null, dirty: true } }, persist: true, undoable: true, result: { ok: true } };
    }
    case 'designer/selectSlot':
      if (!isOutfitSlot(action.slot) || action.slot === state.designer.selectedSlot) return null;
      return { state: { ...state, designer: { ...state.designer, selectedSlot: action.slot } } };

    case 'designer/equip': {
      const asset = context.getAsset(action.assetId);
      if (action.color != null && !isColorValue(action.color)) {
        return { result: { ok: false, code: 'INVALID_COLOR' }, state: localizedMessage('designer.invalidColor', {}, state) };
      }
      const equipped = equipWearable(state.designer.draft, asset, action.color == null ? undefined : normalizeColorValue(action.color), context.getAsset);
      if (!equipped.changed) {
        const errorKey = equipped.code === 'INCOMPATIBLE_FIT' ? 'designer.incompatibleAsset' : (equipped.messageKey || 'designer.cannotEquip');
        const errorParams = equipped.code === 'INCOMPATIBLE_FIT'
          ? (asset?.id ? { assetId: asset.id } : { name: t('designer.unknownAsset') })
          : {};
        return { result: { ok: false, code: equipped.code || 'INVALID_ASSET' }, state: localizedMessage(errorKey, errorParams, state) };
      }
      const equippedParams = { assetId: asset.id, slotIds: equipped.clearedSlots || [] };
      return {
        state: localizedMessage(equipped.messageKey, equippedParams, {
          ...state,
          designer: { ...state.designer, draft: equipped.draft, selectedSlot: asset.slot, dirty: true }
        })
      };
    }

    case 'designer/remove': {
      const removed = removeSlot(state.designer.draft, action.slot ?? state.designer.selectedSlot);
      if (!removed.changed) return { state: localizedMessage(removed.messageKey || 'designer.nothingToRemove', {}, state) };
      return {
        state: localizedMessage(removed.messageKey, { slotIds: [removed.removedSlot] }, {
          ...state,
          designer: { ...state.designer, draft: removed.draft, dirty: true }
        })
      };
    }

    case 'designer/reset':
      return {
        state: localizedMessage('designer.starterRestored', {}, {
          ...state,
          designer: { draft: createStarterDraft(), selectedSlot: 'top', editingPresetId: null, dirty: false }
        })
      };

    case 'designer/clearOutfit':
      return {
        state: localizedMessage('designer.outfitCleared', {}, {
          ...state,
          designer: { ...state.designer, draft: clearOutfit(state.designer.draft), selectedSlot: 'top', dirty: true }
        })
      };

    case 'designer/shuffle': {
      const draft = shuffleDraft(state.designer.draft, context.assets.filter((asset) => !state.settings.hiddenPacks?.includes(asset.packId || asset.metadata?.dlc)), context.random);
      return {
        state: localizedMessage('designer.outfitShuffled', {}, {
          ...state,
          designer: { ...state.designer, draft, selectedSlot: draft.slots.dress ? 'dress' : 'top', dirty: true }
        })
      };
    }

    case 'designer/setSkin':
      if (!isPaletteToken(action.color) || action.color === state.designer.draft.skinTone) return null;
      return {
        state: {
          ...state,
          designer: {
            ...state.designer,
            draft: { ...cloneDraft(state.designer.draft), skinTone: action.color },
            dirty: true
          }
        }
      };

    case 'designer/setColor': {
      if (!isColorValue(action.color)) return null;
      const targetSlot = action.slot ?? state.designer.selectedSlot;
      if (!isOutfitSlot(targetSlot)) return null;
      const equippedItem = state.designer.draft.slots[targetSlot];
      if (!equippedItem) return null;
      if (isCustomAssetId(equippedItem.assetId)) return null;
      if (equippedItem.color === normalizeColorValue(action.color)) return null;
      return {
        state: {
          ...state,
          designer: {
            ...state.designer,
            draft: setSlotColor(state.designer.draft, targetSlot, normalizeColorValue(action.color)),
            dirty: true
          }
        }
      };
    }

    case 'designer/setActiveTab':
      if (action.tab !== 'wardrobe' && action.tab !== 'face') return null;
      return {
        state: {
          ...state,
          designer: { ...state.designer, activeTab: action.tab }
        }
      };

    case 'designer/selectFaceGroup':
      if (!isFaceGroup(action.group) || action.group === state.designer.selectedFaceGroup) return null;
      return {
        state: {
          ...state,
          designer: { ...state.designer, selectedFaceGroup: action.group }
        }
      };

    case 'designer/setFaceFeature': {
      if (!isFaceGroup(action.group)) return null;
      const faceAsset = context.getAsset(action.assetId);
      if (!isFaceCompatible(state.designer.draft, faceAsset, context.getAsset) || faceAsset.faceGroup !== action.group) {
        return { result: { ok: false, code: 'INVALID_FACE_ASSET' }, state: localizedMessage('designer.invalidFaceAsset', {}, state) };
      }
      const res = setFaceFeature(state.designer.draft, action.group, action.assetId, context.getAsset);
      if (!res.changed) return null;
      const asset = context.getAsset(action.assetId);
      const feedbackKey = res.mode === 'cleared'
        ? 'designer.faceDetailCleared'
        : res.mode === 'defaulted'
          ? 'designer.defaultFaceRestored'
          : 'designer.faceFeatureUpdated';
      const feedbackParams = res.mode === 'selected' ? { assetId: asset.id } : {};
      return {
        state: localizedMessage(feedbackKey, feedbackParams, {
          ...state,
          designer: {
            ...state.designer,
            draft: res.draft,
            selectedFaceGroup: action.group,
            dirty: true
          }
        })
      };
    }

    case 'designer/setIrisColor': {
      if (!isIrisColor(action.color)) return null;
      const res = setIrisColor(state.designer.draft, action.color);
      if (!res.changed) return null;
      return {
        state: localizedMessage('designer.irisColorUpdated', {}, {
          ...state,
          designer: {
            ...state.designer,
            draft: res.draft,
            dirty: true
          }
        })
      };
    }

    case 'designer/clearFaceDetail': {
      const res = clearFaceDetail(state.designer.draft);
      return {
        state: localizedMessage('designer.faceDetailCleared', {}, {
          ...state,
          designer: {
            ...state.designer,
            draft: res.draft,
            dirty: true
          }
        })
      };
    }

    case 'designer/resetFace': {
      const res = resetFace(state.designer.draft);
      return {
        state: localizedMessage('designer.defaultFaceRestored', {}, {
          ...state,
          designer: {
            ...state.designer,
            draft: res.draft,
            dirty: true
          }
        })
      };
    }

    case 'designer/setBaseDoll': {
      const res = setBaseDoll(state.designer.draft, action.baseDollId, context.getAsset);
      if (!res.changed) return null;
      const dollAsset = context.getAsset(action.baseDollId);
      const lifeStage = dollAsset?.lifeStages?.[0];
      const dollName = t(`models.${action.baseDollId}`) || (lifeStage && t(`lifeStages.${lifeStage}`)) || dollAsset?.name || t('designer.unknownAsset');
      const msgKey = res.incompatibleSlots.length > 0
        ? 'designer.baseDollChangedFit'
        : 'designer.baseDollChanged';
      return {
        state: localizedMessage(msgKey, { baseDollId: action.baseDollId, name: dollName }, {
          ...state,
          designer: {
            ...state.designer,
            draft: res.draft,
            dirty: true
          }
        })
      };
    }

    case 'designer/setStyleFilter': {
      if (!isPresentationStyle(action.style) || action.style === state.designer.selectedStyleFilter) return null;
      return {
        state: {
          ...state,
          designer: {
            ...state.designer,
            selectedStyleFilter: action.style
          }
        }
      };
    }

    default:
      return null;
  }
}
