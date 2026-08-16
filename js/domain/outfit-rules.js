import {
  DEFAULT_BASE_DOLL_ID,
  DEFAULT_GARMENT_COLOR,
  DEFAULT_SKIN_TONE,
  isOutfitSlot,
  OUTFIT_SLOTS
} from './vocabulary.js';

export { OUTFIT_SLOTS, isOutfitSlot };

export function emptySlots() {
  return Object.fromEntries(OUTFIT_SLOTS.map((slot) => [slot, null]));
}

export function createStarterDraft() {
  return {
    baseDollId: DEFAULT_BASE_DOLL_ID,
    skinTone: DEFAULT_SKIN_TONE,
    slots: {
      ...emptySlots(),
      hair: { assetId: 'hair_ponytail', color: 'brown' },
      top: { assetId: 'top_tshirt', color: 'coral' },
      bottom: { assetId: 'bottom_jeans', color: 'denim' },
      shoes: { assetId: 'shoes_sneakers', color: 'cream' }
    }
  };
}

export function cloneDraft(draft) {
  return {
    baseDollId: draft.baseDollId,
    skinTone: draft.skinTone,
    slots: Object.fromEntries(
      OUTFIT_SLOTS.map((slot) => [slot, draft.slots?.[slot] ? { ...draft.slots[slot] } : null])
    )
  };
}

export function equipWearable(draft, asset, color) {
  if (!asset || asset.kind !== 'wearable' || !isOutfitSlot(asset.slot)) {
    return { draft, changed: false, message: 'That item cannot be equipped.' };
  }

  const next = cloneDraft(draft);
  const cleared = [];

  if (asset.slot === 'dress') {
    for (const slot of ['top', 'bottom']) {
      if (next.slots[slot]) cleared.push(slot);
      next.slots[slot] = null;
    }
  } else if ((asset.slot === 'top' || asset.slot === 'bottom') && next.slots.dress) {
    next.slots.dress = null;
    cleared.push('dress');
  }

  next.slots[asset.slot] = {
    assetId: asset.id,
    color: color ?? asset.defaultColors?.primary ?? DEFAULT_GARMENT_COLOR
  };

  const replacement = cleared.length ? ` Replaced ${cleared.join(' and ')}.` : '';
  return { draft: next, changed: true, message: `${asset.name} equipped.${replacement}` };
}

export function removeSlot(draft, slot) {
  if (!OUTFIT_SLOTS.includes(slot) || !draft.slots?.[slot]) {
    return { draft, changed: false, message: 'Nothing to remove.' };
  }

  const next = cloneDraft(draft);
  next.slots[slot] = null;
  return { draft: next, changed: true, message: `${slotLabel(slot)} removed.` };
}

export function clearOutfit(draft) {
  const next = cloneDraft(draft);
  for (const slot of ['top', 'bottom', 'dress', 'shoes', 'accessory']) next.slots[slot] = null;
  return next;
}

export function setSlotColor(draft, slot, color) {
  if (!OUTFIT_SLOTS.includes(slot) || !draft.slots?.[slot]) return draft;
  const next = cloneDraft(draft);
  next.slots[slot].color = color;
  return next;
}

export function slotLabel(slot) {
  return ({ hair: 'Hair', top: 'Top', bottom: 'Bottom', dress: 'Dress', shoes: 'Shoes', accessory: 'Accessory' })[slot] ?? slot;
}

/**
 * Counts all occurrences and affected records of a custom asset across
 * Designer draft, Dollbox presets, active scene, and Scene Book.
 */
export function countAssetUses(assetId, state = {}) {
  if (!assetId) {
    return {
      totalUses: 0,
      dollCount: 0,
      sceneCount: 0,
      inDesignerDraft: false,
      presets: [],
      scenes: [],
      currentSceneUses: 0,
      formattedSummary: 'Not currently in use'
    };
  }

  let totalUses = 0;
  const uniqueDolls = new Set();
  const uniqueScenes = new Set();

  // 1. Designer draft
  let inDesignerDraft = false;
  if (state.designer?.draft?.slots) {
    for (const slot of Object.values(state.designer.draft.slots)) {
      if (slot?.assetId === assetId) {
        totalUses += 1;
        inDesignerDraft = true;
        uniqueDolls.add('designer_draft');
      }
    }
  }

  // 2. Dollbox presets
  const presets = [];
  for (const preset of state.presets || []) {
    let presetUses = 0;
    for (const slot of Object.values(preset.slots || {})) {
      if (slot?.assetId === assetId) {
        presetUses += 1;
        totalUses += 1;
      }
    }
    if (presetUses > 0) {
      uniqueDolls.add(`preset:${preset.presetId}`);
      presets.push({ presetId: preset.presetId, name: preset.name, count: presetUses });
    }
  }

  // 3. Current scene
  let currentSceneUses = 0;
  if (state.currentScene?.entities) {
    for (const entity of state.currentScene.entities) {
      if (entity.kind === 'prop' && entity.sourceId === assetId) {
        totalUses += 1;
        currentSceneUses += 1;
      } else if (entity.kind === 'character' && entity.characterSnapshot?.slots) {
        for (const slot of Object.values(entity.characterSnapshot.slots)) {
          if (slot?.assetId === assetId) {
            totalUses += 1;
            currentSceneUses += 1;
            uniqueDolls.add(`current_character:${entity.instanceId}`);
          }
        }
      }
    }
    if (currentSceneUses > 0) {
      uniqueScenes.add('current_scene');
    }
  }

  // 4. Saved scenes in Scene Book
  const scenes = [];
  for (const scene of state.scenes || []) {
    let sceneUses = 0;
    for (const entity of scene.entities || []) {
      if (entity.kind === 'prop' && entity.sourceId === assetId) {
        totalUses += 1;
        sceneUses += 1;
      } else if (entity.kind === 'character' && entity.characterSnapshot?.slots) {
        for (const slot of Object.values(entity.characterSnapshot.slots)) {
          if (slot?.assetId === assetId) {
            totalUses += 1;
            sceneUses += 1;
            uniqueDolls.add(`scene_${scene.sceneId}_character:${entity.instanceId}`);
          }
        }
      }
    }
    if (sceneUses > 0) {
      uniqueScenes.add(`scene:${scene.sceneId}`);
      scenes.push({ sceneId: scene.sceneId, title: scene.title, count: sceneUses });
    }
  }

  const dollCount = uniqueDolls.size;
  const sceneCount = uniqueScenes.size;

  let formattedSummary = 'Not currently in use';
  if (totalUses > 0) {
    const parts = [];
    if (dollCount > 0) parts.push(`${dollCount} doll${dollCount === 1 ? '' : 's'}`);
    if (sceneCount > 0) parts.push(`${sceneCount} scene${sceneCount === 1 ? '' : 's'}`);
    formattedSummary = `Used ${totalUses} time${totalUses === 1 ? '' : 's'} across ${parts.join(' and ')}`;
  }

  return {
    totalUses,
    dollCount,
    sceneCount,
    inDesignerDraft,
    presets,
    scenes,
    currentSceneUses,
    formattedSummary
  };
}
