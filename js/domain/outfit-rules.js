import {
  DEFAULT_BASE_DOLL_ID,
  DEFAULT_GARMENT_COLOR,
  DEFAULT_IRIS_COLOR,
  DEFAULT_SKIN_TONE,
  FACE_GROUPS,
  isFaceGroup,
  isOutfitSlot,
  OUTFIT_SLOTS
} from './vocabulary.js';

export { OUTFIT_SLOTS, isOutfitSlot, FACE_GROUPS, isFaceGroup };

export const DEFAULT_FACE_BY_DOLL = Object.freeze({
  doll_classic_a: Object.freeze({
    eyes: Object.freeze({ assetId: 'eyes_classic', irisColor: 'cocoa' }),
    eyebrows: Object.freeze({ assetId: 'brows_soft' }),
    nose: Object.freeze({ assetId: 'nose_dot' }),
    mouth: Object.freeze({ assetId: 'mouth_gentle_smile' }),
    detail: null
  }),
  doll_classic_b: Object.freeze({
    eyes: Object.freeze({ assetId: 'eyes_sparkle', irisColor: 'cocoa' }),
    eyebrows: Object.freeze({ assetId: 'brows_soft' }),
    nose: Object.freeze({ assetId: 'nose_dot' }),
    mouth: Object.freeze({ assetId: 'mouth_gentle_smile' }),
    detail: Object.freeze({ assetId: 'detail_blush' })
  }),
  doll_chibi_a: Object.freeze({
    eyes: Object.freeze({ assetId: 'eyes_round', irisColor: 'cocoa' }),
    eyebrows: Object.freeze({ assetId: 'brows_soft' }),
    nose: Object.freeze({ assetId: 'nose_button' }),
    mouth: Object.freeze({ assetId: 'mouth_gentle_smile' }),
    detail: Object.freeze({ assetId: 'detail_blush' })
  }),
  doll_baby_a: Object.freeze({
    eyes: Object.freeze({ assetId: 'eyes_round', irisColor: 'cocoa' }),
    eyebrows: Object.freeze({ assetId: 'brows_soft' }),
    nose: Object.freeze({ assetId: 'nose_button' }),
    mouth: Object.freeze({ assetId: 'mouth_gentle_smile' }),
    detail: Object.freeze({ assetId: 'detail_blush' })
  }),
  doll_adult_a: Object.freeze({
    eyes: Object.freeze({ assetId: 'eyes_classic', irisColor: 'cocoa' }),
    eyebrows: Object.freeze({ assetId: 'brows_soft' }),
    nose: Object.freeze({ assetId: 'nose_dot' }),
    mouth: Object.freeze({ assetId: 'mouth_gentle_smile' }),
    detail: null
  }),
  doll_elder_a: Object.freeze({
    eyes: Object.freeze({ assetId: 'eyes_classic', irisColor: 'cocoa' }),
    eyebrows: Object.freeze({ assetId: 'brows_soft' }),
    nose: Object.freeze({ assetId: 'nose_dot' }),
    mouth: Object.freeze({ assetId: 'mouth_gentle_smile' }),
    detail: null
  })
});

export function createDefaultFace(baseDollId = DEFAULT_BASE_DOLL_ID) {
  const template = DEFAULT_FACE_BY_DOLL[baseDollId] || DEFAULT_FACE_BY_DOLL[DEFAULT_BASE_DOLL_ID];
  return {
    eyes: template.eyes ? { ...template.eyes } : { assetId: 'eyes_classic', irisColor: DEFAULT_IRIS_COLOR },
    eyebrows: template.eyebrows ? { ...template.eyebrows } : { assetId: 'brows_soft' },
    nose: template.nose ? { ...template.nose } : { assetId: 'nose_dot' },
    mouth: template.mouth ? { ...template.mouth } : { assetId: 'mouth_gentle_smile' },
    detail: template.detail ? { ...template.detail } : null
  };
}

export function isDefaultFace(face, baseDollId = DEFAULT_BASE_DOLL_ID) {
  const expected = createDefaultFace(baseDollId);
  return FACE_GROUPS.every((group) => {
    const actual = face?.[group];
    const target = expected[group];
    if (!actual || !target) return actual == null && target == null;
    return actual.assetId === target.assetId &&
      (group !== 'eyes' || actual.irisColor === target.irisColor);
  });
}

export function cloneFace(face, fallbackBaseDollId = DEFAULT_BASE_DOLL_ID) {
  const fallback = createDefaultFace(fallbackBaseDollId);
  if (!face || typeof face !== 'object') return fallback;
  return {
    eyes: face.eyes ? { ...face.eyes } : fallback.eyes,
    eyebrows: face.eyebrows ? { ...face.eyebrows } : fallback.eyebrows,
    nose: face.nose ? { ...face.nose } : fallback.nose,
    mouth: face.mouth ? { ...face.mouth } : fallback.mouth,
    detail: face.detail ? { ...face.detail } : null
  };
}

export function emptySlots() {
  return Object.fromEntries(OUTFIT_SLOTS.map((slot) => [slot, null]));
}

export function createStarterDraft() {
  return {
    baseDollId: DEFAULT_BASE_DOLL_ID,
    skinTone: DEFAULT_SKIN_TONE,
    face: createDefaultFace(DEFAULT_BASE_DOLL_ID),
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
    face: cloneFace(draft.face, draft.baseDollId),
    slots: Object.fromEntries(
      OUTFIT_SLOTS.map((slot) => [slot, draft.slots?.[slot] ? { ...draft.slots[slot] } : null])
    )
  };
}

export function isWearableCompatible(draft, asset, getAsset = () => undefined) {
  if (!asset) return true;
  if (asset.kind && asset.kind !== 'wearable') return false;
  if (asset.slot && !isOutfitSlot(asset.slot)) return false;
  const doll = getAsset(draft?.baseDollId);
  const fitFamily = doll?.fitFamily;
  return !fitFamily || !asset.supportedFitFamilies || asset.supportedFitFamilies.includes(fitFamily);
}

export function isFaceCompatible(draft, asset, getAsset = () => undefined) {
  if (!asset || asset.kind !== 'face' || !isFaceGroup(asset.faceGroup)) return false;
  const doll = getAsset(draft?.baseDollId);
  const fitFamily = doll?.fitFamily;
  return !fitFamily || !asset.supportedFitFamilies || asset.supportedFitFamilies.includes(fitFamily);
}

export function equipWearable(draft, asset, color, getAsset = () => undefined) {
  if (!asset || asset.kind !== 'wearable' || !isOutfitSlot(asset.slot)) {
    return { draft, changed: false, message: 'That item cannot be equipped.' };
  }
  if (!isWearableCompatible(draft, asset, getAsset)) {
    return { draft, changed: false, code: 'INCOMPATIBLE_FIT', message: 'That item does not fit this model.' };
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

export function setFaceFeature(draft, group, assetId, getAsset = () => undefined) {
  if (!isFaceGroup(group)) return { draft, changed: false };
  const asset = getAsset(assetId);
  if (asset && (asset.kind !== 'face' || asset.faceGroup !== group || !isFaceCompatible(draft, asset, getAsset))) {
    return { draft, changed: false, code: 'INVALID_FACE_ASSET' };
  }
  const next = cloneDraft(draft);
  if (group === 'eyes') {
    const currentIris = next.face.eyes?.irisColor || DEFAULT_IRIS_COLOR;
    next.face.eyes = { assetId, irisColor: currentIris };
  } else if (group === 'detail') {
    next.face.detail = assetId ? { assetId } : null;
  } else {
    next.face[group] = { assetId };
  }
  return { draft: next, changed: true };
}

export function setIrisColor(draft, color) {
  const next = cloneDraft(draft);
  const currentEyesAsset = next.face.eyes?.assetId || 'eyes_classic';
  next.face.eyes = { assetId: currentEyesAsset, irisColor: color };
  return { draft: next, changed: true };
}

export function clearFaceDetail(draft) {
  const next = cloneDraft(draft);
  next.face.detail = null;
  return { draft: next, changed: true };
}

export function resetFace(draft) {
  const next = cloneDraft(draft);
  next.face = createDefaultFace(next.baseDollId);
  return { draft: next, changed: true };
}

export function setBaseDoll(draft, nextBaseDollId, getAsset = () => undefined) {
  const dollAsset = getAsset(nextBaseDollId);
  if (!dollAsset || dollAsset.kind !== 'doll' || nextBaseDollId === draft.baseDollId) {
    return { draft, changed: false, incompatibleSlots: [] };
  }
  const next = cloneDraft(draft);
  next.baseDollId = nextBaseDollId;
  const targetFit = dollAsset.fitFamily || 'teen';
  const incompatibleSlots = [];

  for (const slot of OUTFIT_SLOTS) {
    const item = next.slots[slot];
    if (!item) continue;
    const asset = getAsset(item.assetId);
    if (asset && asset.supportedFitFamilies && !asset.supportedFitFamilies.includes(targetFit)) {
      incompatibleSlots.push(slot);
    }
  }

  return { draft: next, changed: true, incompatibleSlots };
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

  const scanFace = (face, onHit) => {
    if (!face || typeof face !== 'object') return;
    for (const group of FACE_GROUPS) {
      if (face[group]?.assetId === assetId) {
        onHit();
      }
    }
  };

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
  if (state.designer?.draft?.face) {
    scanFace(state.designer.draft.face, () => {
      totalUses += 1;
      inDesignerDraft = true;
      uniqueDolls.add('designer_draft');
    });
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
    if (preset.face) {
      scanFace(preset.face, () => {
        presetUses += 1;
        totalUses += 1;
      });
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
      } else if (entity.kind === 'character') {
        if (entity.characterSnapshot?.slots) {
          for (const slot of Object.values(entity.characterSnapshot.slots)) {
            if (slot?.assetId === assetId) {
              totalUses += 1;
              currentSceneUses += 1;
              uniqueDolls.add(`current_character:${entity.instanceId}`);
            }
          }
        }
        if (entity.characterSnapshot?.face) {
          scanFace(entity.characterSnapshot.face, () => {
            totalUses += 1;
            currentSceneUses += 1;
            uniqueDolls.add(`current_character:${entity.instanceId}`);
          });
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
      } else if (entity.kind === 'character') {
        if (entity.characterSnapshot?.slots) {
          for (const slot of Object.values(entity.characterSnapshot.slots)) {
            if (slot?.assetId === assetId) {
              totalUses += 1;
              sceneUses += 1;
              uniqueDolls.add(`scene_${scene.sceneId}_character:${entity.instanceId}`);
            }
          }
        }
        if (entity.characterSnapshot?.face) {
          scanFace(entity.characterSnapshot.face, () => {
            totalUses += 1;
            sceneUses += 1;
            uniqueDolls.add(`scene_${scene.sceneId}_character:${entity.instanceId}`);
          });
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
