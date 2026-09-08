import { cloneDraft } from '../../domain/outfit-rules.js';
import { normalizeDisplayName } from '../text.js';
import { LIMITS } from '../../domain/vocabulary.js';
import { localizedMessage, nextUniqueId } from './reducer-helpers.js';

/** @param {import('../../types.js').AppState} state
 * @param {import('../../types.js').StoreAction} action */
export function presetReducer(state, action, context) {
  switch (action.type) {
    case 'preset/save': {
      const name = normalizeDisplayName(action.name, LIMITS.MAX_PRESET_NAME_LENGTH);
      if (!name) return { state: localizedMessage('designer.enterName', {}, state), result: { ok: false, code: 'INVALID_NAME' } };
      if (state.presets.length >= LIMITS.MAX_PRESETS) return { state: localizedMessage('designer.dollboxFull', {}, state), result: { ok: false, code: 'LIMIT' } };
      const presetId = nextUniqueId(context.makeId, state.presets.map((preset) => preset.presetId));
      if (!presetId) return { state: localizedMessage('designer.safeIdFailed', {}, state), result: { ok: false, code: 'ID_FAILED' } };
      const stamp = context.now().toISOString();
      const preset = {
        presetId,
        name,
        createdAt: stamp,
        updatedAt: stamp,
        ...cloneDraft(state.designer.draft)
      };
      return {
        state: localizedMessage('designer.dollSaved', { name }, {
          ...state,
          presets: [...state.presets, preset],
          designer: { ...state.designer, editingPresetId: preset.presetId, dirty: false }
        }),
        persist: true,
        result: { ok: true, presetId: preset.presetId }
      };
    }

    case 'preset/update': {
      const id = action.presetId ?? state.designer.editingPresetId;
      const index = state.presets.findIndex((preset) => preset.presetId === id);
      if (index < 0) return { state: localizedMessage('designer.presetMissing', {}, state), result: { ok: false, code: 'NOT_FOUND' } };
      const name = normalizeDisplayName(action.name, LIMITS.MAX_PRESET_NAME_LENGTH) ?? state.presets[index].name;
      const updated = {
        ...state.presets[index],
        ...cloneDraft(state.designer.draft),
        name,
        updatedAt: context.now().toISOString()
      };
      const presets = [...state.presets];
      presets[index] = updated;
      return {
        state: localizedMessage('designer.presetUpdated', { name }, { ...state, presets, designer: { ...state.designer, dirty: false } }),
        persist: true
      };
    }

    case 'preset/load': {
      const preset = state.presets.find((item) => item.presetId === action.presetId);
      if (!preset) return null;
      return {
        state: localizedMessage('designer.presetOpened', { name: preset.name }, {
          ...state,
          designer: { draft: cloneDraft(preset), selectedSlot: 'top', editingPresetId: preset.presetId, dirty: false }
        })
      };
    }

    case 'preset/rename': {
      const name = normalizeDisplayName(action.name, LIMITS.MAX_PRESET_NAME_LENGTH);
      if (!name) return null;
      if (!state.presets.some((preset) => preset.presetId === action.presetId)) return null;
      const presets = state.presets.map((preset) => preset.presetId === action.presetId
        ? { ...preset, name, updatedAt: context.now().toISOString() }
        : preset);
      return { state: localizedMessage('designer.dollRenamed', {}, { ...state, presets }), persist: true };
    }

    case 'preset/delete': {
      const presets = state.presets.filter((preset) => preset.presetId !== action.presetId);
      if (presets.length === state.presets.length) return null;
      const editing = state.designer.editingPresetId === action.presetId;
      return {
        state: localizedMessage('designer.dollRemoved', {}, {
          ...state,
          presets,
          designer: editing ? { ...state.designer, editingPresetId: null } : state.designer
        }),
        persist: true
      };
    }

    default:
      return null;
  }
}
