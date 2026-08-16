import { equipWearable, clearOutfit, cloneDraft, createStarterDraft, removeSlot, setSlotColor } from '../domain/outfit-rules.js';
import {
  addEntity,
  alignEntities,
  attachEntity,
  clamp,
  createEmptyScene,
  deleteEntities,
  deleteEntity,
  detachEntity,
  duplicateEntity,
  flipEntities,
  flipEntity,
  getEntityBounds,
  moveEntities,
  moveEntity,
  reclampSceneEntities,
  reorderEntity,
  scaleEntities,
  scaleEntity,
  setBubbleStyle,
  setBubbleText,
  setBubbleWidth,
  setEntityPinned,
  togglePinEntities,
  touchScene
} from '../domain/scene-rules.js';
import { clampCameraX } from './coordinate-space.js';
import { instantiateSceneTemplate } from '../domain/scene-templates.js';
import { cloneCustomAsset, clonePreset, cloneScene, createRuntimeState, sanitizeCustomAsset } from './state-schema.js';
import { createAssetRegistry } from './asset-registry.js';
import { GARMENT_COLORS, HAIR_COLORS, isColorValue, isPaletteToken, normalizeColorValue } from './palette.js';
import { normalizeDisplayName, truncateGraphemes } from './text.js';
import {
  ALIGNMENT_MODES,
  BUBBLE_STYLES,
  CAMERA_CONSTANTS,
  DEFAULT_BUBBLE_STYLE,
  DEFAULT_BUBBLE_TEXT,
  DEFAULT_EXPRESSION,
  DEFAULT_STAGE_WIDTH,
  defaultMakeId,
  defaultNow,
  isAlignmentMode,
  isBubbleStyle,
  isCustomAssetId,
  isExpression,
  isOutfitSlot,
  isStageWidth,
  isValidId,
  LIMITS,
  OUTFIT_SLOTS,
  STAGE_WIDTHS
} from '../domain/vocabulary.js';

export function createAppStore(envelope, options = {}) {
  let state = createRuntimeState(envelope);
  const listeners = new Set();
  const getAssetOption = options.getAsset ?? (() => undefined);
  const makeId = options.makeId ?? defaultMakeId;
  const now = options.now ?? defaultNow;
  const assets = options.assets ?? [];
  const random = options.random ?? Math.random;
  const maxHistory = options.maxHistory ?? LIMITS.MAX_HISTORY;

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

  function dispatch(action) {
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
          message: 'Action undone.'
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
          message: 'Action redone.'
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
    const cameraOnlyAction = action.type === 'scene/setCameraX' || action.type === 'scene/panCamera';

    if (domainChanged && !cameraOnlyAction) {
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

function removeCustomAssetReferences(state, assetIds) {
  const targetIds = new Set(assetIds);
  const draft = cloneDraft(state.designer.draft);
  for (const [slotKey, slotItem] of Object.entries(draft.slots)) {
    if (targetIds.has(slotItem?.assetId)) draft.slots[slotKey] = null;
  }

  const nextPresets = state.presets.map((preset) => {
    let changed = false;
    const pDraft = cloneDraft(preset);
    for (const [slotKey, slotItem] of Object.entries(pDraft.slots)) {
      if (targetIds.has(slotItem?.assetId)) {
        pDraft.slots[slotKey] = null;
        changed = true;
      }
    }
    return changed ? { ...preset, ...pDraft } : preset;
  });

  const filterSceneEntities = (entities) => entities
    .filter((entity) => !(entity.kind === 'prop' && targetIds.has(entity.sourceId)))
    .map((entity) => {
      if (entity.kind !== 'character' || !entity.characterSnapshot) return entity;
      const characterSnapshot = cloneDraft(entity.characterSnapshot);
      let changed = false;
      for (const [slotKey, slotItem] of Object.entries(characterSnapshot.slots)) {
        if (targetIds.has(slotItem?.assetId)) {
          characterSnapshot.slots[slotKey] = null;
          changed = true;
        }
      }
      return changed ? { ...entity, characterSnapshot } : entity;
    });

  const nextCurrentScene = state.currentScene ? {
    ...state.currentScene,
    entities: filterSceneEntities(state.currentScene.entities)
  } : null;
  const nextScenes = state.scenes.map((scene) => ({
    ...scene,
    entities: filterSceneEntities(scene.entities)
  }));
  const selectedIds = (state.ui.selectedEntityIds || []).filter((id) =>
    nextCurrentScene?.entities.some((entity) => entity.instanceId === id)
  );

  return {
    customAssets: state.customAssets.filter((asset) => !targetIds.has(asset.assetId)),
    presets: nextPresets,
    scenes: nextScenes,
    currentScene: nextCurrentScene,
    designer: { ...state.designer, draft, dirty: true },
    ui: {
      ...state.ui,
      selectedEntityId: selectedIds.includes(state.ui.selectedEntityId) ? state.ui.selectedEntityId : (selectedIds.at(-1) ?? null),
      selectedEntityIds: selectedIds
    }
  };
}

function reduce(state, action, context) {
  const message = (text, next = state) => ({ ...next, ui: { ...next.ui, message: text } });
  switch (action.type) {
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
      return { state: { ...state, ui: { ...state.ui, storageStatus: action.status, message: action.message ?? state.ui.message } } };

    case 'designer/selectSlot':
      if (!isOutfitSlot(action.slot) || action.slot === state.designer.selectedSlot) return null;
      return { state: { ...state, designer: { ...state.designer, selectedSlot: action.slot } } };

    case 'designer/equip': { 
      const asset = context.getAsset(action.assetId);
      if (asset && asset.custom) {
        const draft = cloneDraft(state.designer.draft);
        draft.slots[asset.slot] = { assetId: asset.id, color: 'coral' };
        if (asset.slot === 'dress') {
          draft.slots.top = null;
          draft.slots.bottom = null;
        } else if (asset.slot === 'top' || asset.slot === 'bottom') {
          draft.slots.dress = null;
        }
        return {
          state: message(`Equipped ${asset.name}.`, {
            ...state,
            designer: { ...state.designer, draft, selectedSlot: asset.slot, dirty: true }
          })
        };
      }
      if (action.color != null && !isColorValue(action.color)) {
        return { result: { ok: false, code: 'INVALID_COLOR' }, state: message('That color could not be used.') };
      }
      const equipped = equipWearable(state.designer.draft, asset, action.color == null ? undefined : normalizeColorValue(action.color));
      if (!equipped.changed) return { result: { ok: false, code: 'INVALID_ASSET' }, state: message(equipped.message) };
      return {
        state: message(equipped.message, {
          ...state,
          designer: { ...state.designer, draft: equipped.draft, selectedSlot: asset.slot, dirty: true }
        })
      };
    }

    case 'designer/remove': { 
      const removed = removeSlot(state.designer.draft, action.slot ?? state.designer.selectedSlot);
      if (!removed.changed) return { state: message(removed.message) };
      return {
        state: message(removed.message, {
          ...state,
          designer: { ...state.designer, draft: removed.draft, dirty: true }
        })
      };
    }

    case 'designer/reset':
      return {
        state: message('Starter doll restored.', {
          ...state,
          designer: { draft: createStarterDraft(), selectedSlot: 'top', editingPresetId: null, dirty: false }
        })
      };

    case 'designer/clearOutfit':
      return {
        state: message('Outfit cleared. Hair and skin tone stayed in place.', {
          ...state,
          designer: { ...state.designer, draft: clearOutfit(state.designer.draft), selectedSlot: 'top', dirty: true }
        })
      };

    case 'designer/shuffle': { 
      const draft = shuffleDraft(state.designer.draft, context.assets, context.random);
      return {
        state: message('Fresh outfit shuffled! Try another or fine-tune the colors.', {
          ...state,
          designer: { ...state.designer, draft, selectedSlot: draft.slots.dress ? 'dress' : 'top', dirty: true }
        })
      };
    }

    case 'designer/setBaseDoll': {
      const asset = context.getAsset(action.baseDollId);
      if (!asset || asset.kind !== 'doll' || action.baseDollId === state.designer.draft.baseDollId) return null;
      return {
        state: {
          ...state,
          designer: {
            ...state.designer,
            draft: { ...cloneDraft(state.designer.draft), baseDollId: action.baseDollId },
            dirty: true
          }
        }
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

    case 'preset/save': {
      const name = normalizeDisplayName(action.name, LIMITS.MAX_PRESET_NAME_LENGTH);
      if (!name) return { state: message('Enter a doll name before saving.'), result: { ok: false, code: 'INVALID_NAME' } };
      if (state.presets.length >= LIMITS.MAX_PRESETS) return { state: message('Dollbox is full. Delete a preset before saving.'), result: { ok: false, code: 'LIMIT' } };
      const presetId = nextUniqueId(context.makeId, state.presets.map((preset) => preset.presetId));
      if (!presetId) return { state: message('The doll could not be assigned a safe ID. Try saving again.'), result: { ok: false, code: 'ID_FAILED' } };
      const stamp = context.now().toISOString();
      const preset = {
        presetId,
        name,
        createdAt: stamp,
        updatedAt: stamp,
        ...cloneDraft(state.designer.draft)
      };
      return {
        state: message(`${name} saved to Dollbox.`, {
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
      if (index < 0) return { state: message('That Dollbox preset no longer exists.'), result: { ok: false, code: 'NOT_FOUND' } };
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
        state: message(`${name} updated.`, { ...state, presets, designer: { ...state.designer, dirty: false } }),
        persist: true
      };
    }

    case 'preset/load': {
      const preset = state.presets.find((item) => item.presetId === action.presetId);
      if (!preset) return null;
      return {
        state: message(`${preset.name} opened in Designer.`, {
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
      return { state: message('Doll renamed.', { ...state, presets }), persist: true };
    }

    case 'preset/delete': {
      const presets = state.presets.filter((preset) => preset.presetId !== action.presetId);
      if (presets.length === state.presets.length) return null;
      const editing = state.designer.editingPresetId === action.presetId;
      return {
        state: message('Doll removed from Dollbox. Scene copies are unchanged.', {
          ...state,
          presets,
          designer: editing ? { ...state.designer, editingPresetId: null } : state.designer
        }),
        persist: true
      };
    }

    case 'scene/setBackground':
      if (context.getAsset(action.backgroundId)?.kind !== 'background') return null;
      if (state.currentScene.backgroundId === action.backgroundId) return null;
      return {
        state: { ...state, currentScene: touchScene({ ...state.currentScene, backgroundId: action.backgroundId }, context.now) },
        persist: true
      };

    case 'scene/setStageWidth': {
      if (!isStageWidth(action.stageWidth)) return null;
      const currentWidth = state.currentScene.stageWidth || DEFAULT_STAGE_WIDTH;
      if (currentWidth === action.stageWidth) return null;
      let nextScene = { ...state.currentScene, stageWidth: action.stageWidth };
      if (action.stageWidth < currentWidth) {
        nextScene = reclampSceneEntities(nextScene, action.stageWidth, context.getAsset);
      }
      nextScene.cameraX = clampCameraX(nextScene.cameraX, action.stageWidth);
      return {
        state: message(`Stage width set to ${action.stageWidth}px.`, {
          ...state,
          currentScene: touchScene(nextScene, context.now)
        }),
        persist: true
      };
    }

    case 'scene/setCameraX': {
      const stageWidth = state.currentScene.stageWidth || DEFAULT_STAGE_WIDTH;
      const clampedX = clampCameraX(action.cameraX, stageWidth);
      if ((state.currentScene.cameraX || 0) === clampedX) return null;
      return {
        state: {
          ...state,
          currentScene: touchScene({ ...state.currentScene, cameraX: clampedX }, context.now)
        },
        persist: true
      };
    }

    case 'scene/panCamera': {
      const stageWidth = state.currentScene.stageWidth || DEFAULT_STAGE_WIDTH;
      const delta = Number(action.deltaX) || 0;
      if (delta === 0) return null;
      const currentX = state.currentScene.cameraX || 0;
      const clampedX = clampCameraX(currentX + delta, stageWidth);
      if (currentX === clampedX) return null;
      return {
        state: {
          ...state,
          currentScene: touchScene({ ...state.currentScene, cameraX: clampedX }, context.now)
        },
        persist: true
      };
    }

    case 'scene/spawnCharacter': { 
      if (state.currentScene.entities.length >= LIMITS.MAX_ENTITIES) return { state: message('Scene is full.'), result: { ok: false, code: 'LIMIT' } };
      const preset = state.presets.find((item) => item.presetId === action.presetId);
      if (!preset) return null;
      const instanceId = nextUniqueId(context.makeId, state.currentScene.entities.map((entity) => entity.instanceId));
      if (!instanceId) return { state: message('The scene item could not be assigned a safe ID. Try again.'), result: { ok: false, code: 'ID_FAILED' } };
      const scene = addEntity(state.currentScene, {
        instanceId,
        kind: 'character',
        sourceId: preset.presetId,
        characterSnapshot: cloneDraft(preset),
        x: action.x,
        y: action.y
      }, context.getAsset);
      return { state: message(`${preset.name} added to the scene.`, { ...state, currentScene: scene }), persist: true };
    }

    case 'scene/spawnProp': {
      const asset = context.getAsset(action.assetId);
      if (!asset || asset.kind !== 'prop') return null;
      if (state.currentScene.entities.length >= LIMITS.MAX_ENTITIES) return { state: message('Scene is full.'), result: { ok: false, code: 'LIMIT' } };
      const instanceId = nextUniqueId(context.makeId, state.currentScene.entities.map((entity) => entity.instanceId));
      if (!instanceId) return { state: message('The scene item could not be assigned a safe ID. Try again.'), result: { ok: false, code: 'ID_FAILED' } };

      const targetId = action.targetEntityId ?? null;
      const target = targetId ? state.currentScene.entities.find((e) => e.instanceId === targetId) : null;
      const attachedTo = target ? target.instanceId : null;
      let spawnX = action.x ?? (target ? target.x : 800);
      let spawnY = action.y ?? (target ? target.y - 40 : 720);
      const attachOffset = target ? { dx: Math.round(spawnX - target.x), dy: Math.round(spawnY - target.y) } : null;

      const scene = addEntity(state.currentScene, {
        instanceId, kind: 'prop', sourceId: asset.id, x: spawnX, y: spawnY, attachedTo, attachOffset
      }, context.getAsset);
      return { state: message(`${asset.name} added to the scene.`, { ...state, currentScene: scene }), persist: true };
    }

    case 'scene/spawnBubble': {
      if (state.currentScene.entities.length >= LIMITS.MAX_ENTITIES) return { state: message('Scene is full.'), result: { ok: false, code: 'LIMIT' } };
      const instanceId = nextUniqueId(context.makeId, state.currentScene.entities.map((entity) => entity.instanceId));
      if (!instanceId) return { state: message('The speech bubble could not be assigned a safe ID. Try again.'), result: { ok: false, code: 'ID_FAILED' } };

      const text = typeof action.text === 'string' ? (normalizeDisplayName(action.text, LIMITS.MAX_BUBBLE_TEXT_LENGTH) || DEFAULT_BUBBLE_TEXT) : DEFAULT_BUBBLE_TEXT;
      const bubbleStyle = isBubbleStyle(action.bubbleStyle) ? action.bubbleStyle : DEFAULT_BUBBLE_STYLE;
      const width = Math.round(clamp(Number(action.width) || LIMITS.DEFAULT_BUBBLE_WIDTH, LIMITS.MIN_BUBBLE_WIDTH, LIMITS.MAX_BUBBLE_WIDTH));

      const targetId = action.targetEntityId ?? (action.x == null && action.y == null ? state.ui.selectedEntityId : null);
      const target = targetId ? state.currentScene.entities.find((e) => e.instanceId === targetId) : null;

      let spawnX = action.x;
      let spawnY = action.y;
      let attachedTo = null;
      let attachOffset = null;

      if (target) {
        if (spawnX == null && spawnY == null) {
          const targetBounds = getEntityBounds(target, context.getAsset);
          spawnX = target.x;
          spawnY = Math.round(target.y - targetBounds.height - 15);
        }
        attachedTo = target.instanceId;
        attachOffset = { dx: Math.round(spawnX - target.x), dy: Math.round(spawnY - target.y) };
      } else {
        spawnX = spawnX ?? 800;
        spawnY = spawnY ?? 350;
      }

      const scene = addEntity(state.currentScene, {
        instanceId,
        kind: 'bubble',
        sourceId: 'bubble',
        text,
        bubbleStyle,
        width,
        x: spawnX,
        y: spawnY,
        attachedTo,
        attachOffset
      }, context.getAsset);

      return {
        state: message('Speech bubble added to the scene.', {
          ...state,
          currentScene: scene,
          ui: { ...state.ui, selectedEntityId: instanceId }
        }),
        persist: true,
        result: { ok: true, instanceId }
      };
    }

    case 'scene/setBubbleText': {
      const instanceId = action.instanceId ?? state.ui.selectedEntityId;
      if (!instanceId) return null;
      const text = normalizeDisplayName(action.text, LIMITS.MAX_BUBBLE_TEXT_LENGTH);
      if (!text) return null;
      const scene = setBubbleText(state.currentScene, instanceId, text);
      return scene === state.currentScene ? null : { state: { ...state, currentScene: scene }, persist: true };
    }

    case 'scene/setBubbleStyle': {
      const instanceId = action.instanceId ?? state.ui.selectedEntityId;
      if (!instanceId || !isBubbleStyle(action.bubbleStyle)) return null;
      const scene = setBubbleStyle(state.currentScene, instanceId, action.bubbleStyle);
      return scene === state.currentScene ? null : { state: { ...state, currentScene: scene }, persist: true };
    }

    case 'scene/setBubbleWidth': {
      const instanceId = action.instanceId ?? state.ui.selectedEntityId;
      if (!instanceId) return null;
      const scene = setBubbleWidth(state.currentScene, instanceId, action.width);
      return scene === state.currentScene ? null : { state: { ...state, currentScene: scene }, persist: true };
    }

    case 'scene/moveEntity': {
      const scene = moveEntity(state.currentScene, action.instanceId, action.x, action.y, context.getAsset);
      return scene === state.currentScene ? null : { state: { ...state, currentScene: scene }, persist: true };
    }
    case 'scene/flipEntity': {
      const scene = flipEntity(state.currentScene, action.instanceId);
      return scene === state.currentScene ? null : { state: { ...state, currentScene: scene }, persist: true };
    }
    case 'scene/scaleEntity': {
      const scene = scaleEntity(state.currentScene, action.instanceId, action.scale, context.getAsset);
      return scene === state.currentScene ? null : { state: { ...state, currentScene: scene }, persist: true };
    }
    case 'scene/reorderEntity': {
      const scene = reorderEntity(state.currentScene, action.instanceId, action.direction);
      return scene === state.currentScene ? null : { state: { ...state, currentScene: scene }, persist: true };
    }
    case 'scene/deleteEntity': {
      const scene = deleteEntity(state.currentScene, action.instanceId);
      if (scene === state.currentScene) return null;
      const remainingSelected = (state.ui.selectedEntityIds || []).filter((id) => id !== action.instanceId);
      return {
        state: message('Item removed from the scene.', {
          ...state,
          currentScene: scene,
          ui: {
            ...state.ui,
            selectedEntityId: state.ui.selectedEntityId === action.instanceId ? (remainingSelected[0] || null) : state.ui.selectedEntityId,
            selectedEntityIds: remainingSelected
          }
        }),
        persist: true
      };
    }
    case 'scene/deleteEntities': {
      const targetIds = Array.isArray(action.instanceIds) && action.instanceIds.length > 0
        ? action.instanceIds
        : (state.ui.selectedEntityIds.length > 0 ? state.ui.selectedEntityIds : (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : []));
      if (!targetIds.length) return null;
      const scene = deleteEntities(state.currentScene, targetIds);
      if (scene === state.currentScene) return null;
      const idSet = new Set(targetIds);
      const remainingSelected = (state.ui.selectedEntityIds || []).filter((id) => !idSet.has(id));
      return {
        state: message(`${targetIds.length} item${targetIds.length === 1 ? '' : 's'} removed from scene.`, {
          ...state,
          currentScene: scene,
          ui: {
            ...state.ui,
            selectedEntityId: remainingSelected[0] || null,
            selectedEntityIds: remainingSelected
          }
        }),
        persist: true
      };
    }
    case 'scene/alignEntities': {
      if (!isAlignmentMode(action.alignment)) return null;
      const targetIds = Array.isArray(action.instanceIds) && action.instanceIds.length >= 2
        ? action.instanceIds
        : (state.ui.selectedEntityIds.length >= 2 ? state.ui.selectedEntityIds : state.currentScene.entities.map((e) => e.instanceId));
      const scene = alignEntities(state.currentScene, targetIds, action.alignment, context.getAsset);
      return scene === state.currentScene ? null : {
        state: message(`Aligned items (${action.alignment}).`, { ...state, currentScene: scene }),
        persist: true
      };
    }
    case 'scene/moveEntities': {
      const scene = moveEntities(state.currentScene, action.moves, context.getAsset);
      return scene === state.currentScene ? null : { state: { ...state, currentScene: scene }, persist: true };
    }
    case 'scene/scaleEntities': {
      const targetIds = Array.isArray(action.instanceIds) && action.instanceIds.length > 0
        ? action.instanceIds
        : (state.ui.selectedEntityIds.length > 0 ? state.ui.selectedEntityIds : (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : []));
      if (!targetIds.length || !Number.isFinite(action.delta)) return null;
      const scene = scaleEntities(state.currentScene, targetIds, action.delta, context.getAsset);
      return scene === state.currentScene ? null : { state: { ...state, currentScene: scene }, persist: true };
    }
    case 'scene/flipEntities': {
      const targetIds = Array.isArray(action.instanceIds) && action.instanceIds.length > 0
        ? action.instanceIds
        : (state.ui.selectedEntityIds.length > 0 ? state.ui.selectedEntityIds : (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : []));
      if (!targetIds.length) return null;
      const scene = flipEntities(state.currentScene, targetIds);
      return scene === state.currentScene ? null : { state: { ...state, currentScene: scene }, persist: true };
    }
    case 'scene/togglePin': {
      const instanceId = action.instanceId ?? state.ui.selectedEntityId;
      const target = state.currentScene.entities.find((e) => e.instanceId === instanceId);
      if (!target) return null;
      const nextPinned = !target.pinned;
      const scene = setEntityPinned(state.currentScene, instanceId, nextPinned);
      return {
        state: message(nextPinned ? 'Item pinned to scene.' : 'Item unpinned.', {
          ...state,
          currentScene: scene
        }),
        persist: true
      };
    }
    case 'scene/togglePinEntities': {
      const targetIds = Array.isArray(action.instanceIds) && action.instanceIds.length > 0
        ? action.instanceIds
        : (state.ui.selectedEntityIds.length > 0 ? state.ui.selectedEntityIds : (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : []));
      if (!targetIds.length) return null;
      const scene = togglePinEntities(state.currentScene, targetIds, action.pinned);
      return scene === state.currentScene ? null : {
        state: message('Scene item pinning updated.', { ...state, currentScene: scene }),
        persist: true
      };
    }
    case 'scene/attachEntity': {
      const childId = action.childInstanceId ?? state.ui.selectedEntityId;
      const parentId = action.parentInstanceId;
      if (!childId || !parentId) return null;
      const scene = attachEntity(state.currentScene, childId, parentId);
      if (scene === state.currentScene) return null;
      return {
        state: message('Item attached.', { ...state, currentScene: scene }),
        persist: true
      };
    }
    case 'scene/detachEntity': {
      const childId = action.instanceId ?? state.ui.selectedEntityId;
      if (!childId) return null;
      const scene = detachEntity(state.currentScene, childId);
      if (scene === state.currentScene) return null;
      return {
        state: message('Item detached.', { ...state, currentScene: scene }),
        persist: true
      };
    }
    case 'scene/duplicateEntity': {
      if (state.currentScene.entities.length >= LIMITS.MAX_ENTITIES || !state.currentScene.entities.some((entity) => entity.instanceId === action.instanceId)) {
        return { state: message('That item could not be duplicated.'), result: { ok: false, code: 'LIMIT_OR_NOT_FOUND' } };
      }
      const instanceId = nextUniqueId(context.makeId, state.currentScene.entities.map((entity) => entity.instanceId));
      if (!instanceId) return { state: message('The duplicate could not be assigned a safe ID. Try again.'), result: { ok: false, code: 'ID_FAILED' } };
      const scene = duplicateEntity(state.currentScene, action.instanceId, instanceId, context.getAsset);
      const duplicate = scene.entities.at(-1);
      return {
        state: message('Scene item duplicated.', {
          ...state,
          currentScene: scene,
          ui: { ...state.ui, selectedEntityId: duplicate.instanceId, selectedEntityIds: [duplicate.instanceId] }
        }),
        persist: true,
        result: { ok: true, instanceId: duplicate.instanceId }
      };
    }
    case 'scene/duplicateCurrentToLibrary': {
      if (state.scenes.length >= LIMITS.MAX_SCENES) {
        return { state: message('Scene library is full.'), result: { ok: false, code: 'LIMIT' } };
      }
      const sceneId = nextUniqueId(context.makeId, state.scenes.map((s) => s.sceneId));
      if (!sceneId) return { state: message('Could not assign a safe scene ID. Try again.'), result: { ok: false, code: 'ID_FAILED' } };
      const stamp = context.now().toISOString();
      const baseTitle = state.currentScene.title !== 'Current Scene' ? state.currentScene.title : 'My Scene';
      const title = truncateGraphemes(action.name || `${baseTitle} (Copy)`, LIMITS.MAX_SCENE_TITLE_LENGTH);
      const entityIdMap = new Map();
      for (const e of state.currentScene.entities) {
        const instanceId = nextUniqueId(context.makeId, [...entityIdMap.values()]);
        if (!instanceId) {
          return {
            state: message('Could not assign safe item IDs to scene copy. Try again.'),
            result: { ok: false, code: 'ID_FAILED' }
          };
        }
        entityIdMap.set(e.instanceId, instanceId);
      }
      const clonedEntities = state.currentScene.entities.map((e) => ({
        ...e,
        instanceId: entityIdMap.get(e.instanceId),
        attachedTo: e.attachedTo ? (entityIdMap.get(e.attachedTo) ?? null) : null,
        attachOffset: e.attachOffset ? { ...e.attachOffset } : null,
        characterSnapshot: e.characterSnapshot ? cloneDraft(e.characterSnapshot) : undefined
      }));
      const clonedScene = {
        ...cloneScene(state.currentScene),
        sceneId,
        title,
        createdAt: stamp,
        updatedAt: stamp,
        entities: clonedEntities
      };
      return {
        state: message(`"${title}" saved as copy in Scene Book.`, {
          ...state,
          scenes: [...state.scenes, clonedScene],
          ui: { ...state.ui, activeSceneLibraryId: sceneId }
        }),
        persist: true,
        result: { ok: true, sceneId }
      };
    }
    case 'scene/loadTemplate': {
      const templateScene = instantiateSceneTemplate(action.templateId, context.makeId, state.designer.draft || createStarterDraft(), context.now);
      if (!templateScene) return { state: message('The template could not be assigned safe IDs. Try again.'), result: { ok: false, code: 'ID_FAILED' } };
      return {
        state: message(`Loaded template "${templateScene.title}".`, {
          ...state,
          currentScene: templateScene,
          ui: { ...state.ui, selectedEntityId: null, selectedEntityIds: [], activeSceneLibraryId: null }
        }),
        persist: true,
        result: { ok: true }
      };
    }
    case 'scene/new': {
      const sceneId = nextUniqueId(context.makeId, []);
      if (!sceneId) return { state: message('The new scene could not be assigned a safe ID. Try again.'), result: { ok: false, code: 'ID_FAILED' } };
      return {
        state: message('A new scene is ready.', { ...state, currentScene: createEmptyScene(sceneId, context.now), ui: { ...state.ui, selectedEntityId: null, selectedEntityIds: [], activeSceneLibraryId: null } }),
        persist: true
      };
    }
    case 'ui/setVoicePuppetry':
      return {
        state: { ...state, ui: { ...state.ui, voicePuppetryActive: Boolean(action.active) } }
      };
    case 'ui/message':
      return {
        state: message(action.message ?? '', state)
      };
    case 'scene/setDollExpression': {
      if (!isExpression(action.expression)) return null;
      const targetId = action.instanceId ?? state.ui.selectedEntityId;
      const entity = state.currentScene.entities.find((e) => e.instanceId === targetId && e.kind === 'character');
      if (!entity || entity.expression === action.expression) return null;
      const updatedEntities = state.currentScene.entities.map((e) => e.instanceId === targetId ? { ...e, expression: action.expression } : e);
      return {
        state: {
          ...state,
          currentScene: touchScene({ ...state.currentScene, entities: updatedEntities }, context.now)
        },
        persist: true
      };
    }
    case 'scene/saveToLibrary': {
      const title = normalizeDisplayName(action.name, LIMITS.MAX_SCENE_TITLE_LENGTH) ?? (state.currentScene.title !== 'Current Scene' ? state.currentScene.title : 'My Scene');
      if (!title) return { state: message('Please enter a scene title.'), result: { ok: false, code: 'INVALID_NAME' } };
      if (state.scenes.length >= LIMITS.MAX_SCENES) return { state: message(`Scene library is full (max ${LIMITS.MAX_SCENES} scenes). Delete a scene first.`), result: { ok: false, code: 'LIMIT' } };
      const sceneId = nextUniqueId(context.makeId, state.scenes.map((s) => s.sceneId));
      if (!sceneId) return { state: message('Could not assign a scene ID. Try again.'), result: { ok: false, code: 'ID_FAILED' } };
      const stamp = context.now().toISOString();
      const clonedCurrent = cloneScene(state.currentScene);
      const savedScene = {
        ...clonedCurrent,
        sceneId,
        title,
        createdAt: stamp,
        updatedAt: stamp
      };
      return {
        state: message(`"${title}" saved to Scene Library.`, {
          ...state,
          scenes: [...state.scenes, savedScene],
          currentScene: { ...state.currentScene, title, sceneId },
          ui: { ...state.ui, activeSceneLibraryId: sceneId }
        }),
        persist: true,
        result: { ok: true, sceneId }
      };
    }
    case 'scene/updateLibraryScene': {
      const id = action.sceneId ?? state.ui.activeSceneLibraryId ?? state.currentScene.sceneId;
      const index = state.scenes.findIndex((s) => s.sceneId === id);
      if (index < 0) return { state: message('That saved scene no longer exists in your library.'), result: { ok: false, code: 'NOT_FOUND' } };
      const title = normalizeDisplayName(action.name, LIMITS.MAX_SCENE_TITLE_LENGTH) ?? state.scenes[index].title;
      const stamp = context.now().toISOString();
      const clonedCurrent = cloneScene(state.currentScene);
      const updated = {
        ...clonedCurrent,
        sceneId: id,
        title,
        createdAt: state.scenes[index].createdAt || stamp,
        updatedAt: stamp
      };
      const scenes = [...state.scenes];
      scenes[index] = updated;
      return {
        state: message(`"${title}" updated.`, {
          ...state,
          scenes,
          currentScene: { ...state.currentScene, title }
        }),
        persist: true,
        result: { ok: true }
      };
    }
    case 'scene/loadFromLibrary': {
      const found = state.scenes.find((s) => s.sceneId === action.sceneId);
      if (!found) return { state: message('That saved scene was not found.'), result: { ok: false, code: 'NOT_FOUND' } };
      const loadedScene = cloneScene(found);
      return {
        state: message(`"${found.title}" loaded to stage.`, {
          ...state,
          currentScene: loadedScene,
          ui: { ...state.ui, activeSceneLibraryId: found.sceneId, selectedEntityId: null, selectedEntityIds: [] }
        }),
        persist: true,
        result: { ok: true }
      };
    }
    case 'scene/renameLibraryScene': {
      const title = normalizeDisplayName(action.name, LIMITS.MAX_SCENE_TITLE_LENGTH);
      if (!title) return null;
      const target = state.scenes.find((s) => s.sceneId === action.sceneId);
      if (!target) return null;
      const stamp = context.now().toISOString();
      const scenes = state.scenes.map((s) => s.sceneId === action.sceneId ? { ...s, title, updatedAt: stamp } : s);
      const activeCurrent = state.currentScene.sceneId === action.sceneId
        ? { ...state.currentScene, title }
        : state.currentScene;
      return {
        state: message('Scene renamed.', { ...state, scenes, currentScene: activeCurrent }),
        persist: true
      };
    }
    case 'scene/duplicateLibraryScene': {
      if (state.scenes.length >= LIMITS.MAX_SCENES) return { state: message('Scene library is full.'), result: { ok: false, code: 'LIMIT' } };
      const original = state.scenes.find((s) => s.sceneId === action.sceneId);
      if (!original) return null;
      const sceneId = nextUniqueId(context.makeId, state.scenes.map((s) => s.sceneId));
      if (!sceneId) {
        return {
          state: message('The scene copy could not be assigned a safe ID. Try again.'),
          result: { ok: false, code: 'ID_FAILED' }
        };
      }
      const stamp = context.now().toISOString();
      const entityIdMap = new Map();
      for (const e of original.entities) {
        const instanceId = nextUniqueId(context.makeId, [...entityIdMap.values()]);
        if (!instanceId) {
          return {
            state: message('The scene copy could not be assigned safe item IDs. Try again.'),
            result: { ok: false, code: 'ID_FAILED' }
          };
        }
        entityIdMap.set(e.instanceId, instanceId);
      }
      const clonedEntities = original.entities.map((e) => ({
        ...e,
        instanceId: entityIdMap.get(e.instanceId),
        attachedTo: e.attachedTo ? (entityIdMap.get(e.attachedTo) ?? null) : null,
        attachOffset: e.attachOffset ? { ...e.attachOffset } : null,
        characterSnapshot: e.characterSnapshot ? cloneDraft(e.characterSnapshot) : undefined
      }));
      const cloned = {
        ...original,
        sceneId,
        title: truncateGraphemes(`${original.title} (Copy)`, LIMITS.MAX_SCENE_TITLE_LENGTH),
        createdAt: stamp,
        updatedAt: stamp,
        entities: clonedEntities
      };
      return {
        state: message(`"${cloned.title}" duplicated.`, { ...state, scenes: [...state.scenes, cloned] }),
        persist: true,
        result: { ok: true, sceneId }
      };
    }
    case 'scene/deleteLibraryScene': {
      const scenes = state.scenes.filter((s) => s.sceneId !== action.sceneId);
      if (scenes.length === state.scenes.length) return null;
      return {
        state: message('Scene removed from library. Active stage is unchanged.', {
          ...state,
          scenes,
          ui: {
            ...state.ui,
            activeSceneLibraryId: state.ui.activeSceneLibraryId === action.sceneId ? null : state.ui.activeSceneLibraryId
          }
        }),
        persist: true
      };
    }
    case 'customAsset/add': {
      const sanitized = sanitizeCustomAsset(action.asset);
      if (!sanitized) return { state: message('Invalid custom artwork metadata.'), result: { ok: false, code: 'INVALID_METADATA' } };
      const existingIndex = state.customAssets.findIndex((a) => a.assetId === sanitized.assetId);
      if (existingIndex < 0 && state.customAssets.length >= LIMITS.MAX_CUSTOM_ASSETS) {
        return { state: message(`Custom art library limit (${LIMITS.MAX_CUSTOM_ASSETS}) reached. Delete an item first.`), result: { ok: false, code: 'LIMIT' } };
      }
      const currentBytes = state.customAssets.reduce((sum, asset, index) => sum + (index === existingIndex ? 0 : (asset.byteLength || 0)), 0);
      if (sanitized.byteLength && currentBytes + sanitized.byteLength > LIMITS.MAX_TOTAL_CUSTOM_BYTES) {
        return { state: message(`Custom art storage limit (${LIMITS.MAX_TOTAL_CUSTOM_BYTES} bytes) reached.`, state), result: { ok: false, code: 'BYTE_LIMIT' } };
      }
      let nextCustoms;
      if (existingIndex >= 0) {
        nextCustoms = [...state.customAssets];
        nextCustoms[existingIndex] = sanitized;
      } else {
        nextCustoms = [...state.customAssets, sanitized];
      }
      return {
        state: message(`"${sanitized.name}" added to My Art.`, { ...state, customAssets: nextCustoms }),
        persist: true,
        result: { ok: true, assetId: sanitized.assetId }
      };
    }

    case 'customAsset/rename': {
      const name = normalizeDisplayName(action.name, LIMITS.MAX_CUSTOM_ASSET_NAME_LENGTH);
      if (!name) return null;
      const index = state.customAssets.findIndex((a) => a.assetId === action.assetId);
      if (index < 0) return null;
      const updated = { ...state.customAssets[index], name, updatedAt: context.now().toISOString() };
      const nextCustoms = [...state.customAssets];
      nextCustoms[index] = updated;
      return {
        state: message(`Artwork renamed to "${name}".`, { ...state, customAssets: nextCustoms }),
        persist: true,
        result: { ok: true }
      };
    }

    case 'customAsset/remove': {
      const index = state.customAssets.findIndex((a) => a.assetId === action.assetId);
      if (index < 0) return null;
      const target = state.customAssets[index];
      const updated = { ...target, status: 'trashed', libraryVisible: false, updatedAt: context.now().toISOString() };
      const nextCustoms = [...state.customAssets];
      nextCustoms[index] = updated;
      return {
        state: message(`"${target.name}" removed from My Art. Referenced dolls and scenes retain placeholders.`, {
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
      const updated = { ...target, status: 'available', libraryVisible: true, updatedAt: context.now().toISOString() };
      const nextCustoms = [...state.customAssets];
      nextCustoms[index] = updated;
      return {
        state: message(`"${target.name}" restored to My Art.`, {
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
        state: message(`"${target.name}" and its uses were deleted.`, {
          ...state,
          ...next
        }),
        persist: true,
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
        state: message(`${targetIds.length} trashed artwork item${targetIds.length === 1 ? '' : 's'} permanently deleted.`, {
          ...state,
          ...next
        }),
        persist: true,
        result: { ok: true, assetIds: targetIds }
      };
    }

    case 'project/importReplace': {
      if (!action.envelope || !Array.isArray(action.envelope.presets)) return null;
      const env = action.envelope;
      const fallbackSceneId = env.currentScene ? null : nextUniqueId(context.makeId, []);
      if (!env.currentScene && !fallbackSceneId) return { state: message('The imported project could not be assigned a safe scene ID. Try again.'), result: { ok: false, code: 'ID_FAILED' } };
      return {
        state: message(action.message ?? 'Project loaded. Previous data backed up.', {
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
      return {
        state: message(action.message ?? 'Project items merged into studio.', {
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
      if (!env.currentScene && !fallbackSceneId) return { state: message('The backup could not be assigned a safe scene ID. Try again.'), result: { ok: false, code: 'ID_FAILED' } };
      return {
        state: message(action.message ?? 'Previous project backup restored.', {
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
    default:
      return null;
  }
}

function shuffleDraft(current, assets, random) {
  const draft = cloneDraft(current);
  const bySlot = (slot) => assets.filter((asset) => asset.kind === 'wearable' && asset.slot === slot);
  const choose = (items) => items[Math.min(items.length - 1, Math.floor(random() * items.length))];
  const colors = (slot) => slot === 'hair' ? HAIR_COLORS : GARMENT_COLORS;
  const equip = (slot) => {
    const asset = choose(bySlot(slot));
    const color = choose(colors(slot));
    if (asset) draft.slots[slot] = { assetId: asset.id, color };
  };

  for (const slot of OUTFIT_SLOTS) draft.slots[slot] = null;
  equip('hair');
  if (random() < 0.42) equip('dress');
  else { equip('top'); equip('bottom'); }
  equip('shoes');
  if (random() < 0.78) equip('accessory');
  return draft;
}

function nextUniqueId(makeId, usedIds) {
  const used = new Set(usedIds);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = makeId();
    if (isValidId(candidate) && !used.has(candidate)) return candidate;
  }
  return null;
}
