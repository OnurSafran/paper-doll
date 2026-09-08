import { translateMessage } from '../i18n.js';
import { cloneCustomAsset, cloneScene } from '../state-schema.js';
import { cloneDraft } from '../../domain/outfit-rules.js';
import { GARMENT_COLORS, HAIR_COLORS, IRIS_COLORS } from '../palette.js';
import {
  DEFAULT_BASE_DOLL_ID,
  DEFAULT_IRIS_COLOR,
  isValidId,
  OUTFIT_SLOTS
} from '../../domain/vocabulary.js';

/** @param {string} text
 * @param {import('../../types.js').AppState} state */
export function message(text, state) {
  return {
    ...state,
    ui: { ...state.ui, message: text, messageKey: null, messageParams: null }
  };
}

/** @param {string} key
 * @param {Record<string, any>} params
 * @param {import('../../types.js').AppState} state */
export function localizedMessage(key, params = {}, state) {
  return {
    ...state,
    ui: {
      ...state.ui,
      message: translateMessage(key, params),
      messageKey: key,
      messageParams: { ...params }
    }
  };
}

export function nextUniqueId(makeId, usedIds) {
  const used = new Set(usedIds);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = makeId();
    if (isValidId(candidate) && !used.has(candidate)) return candidate;
  }
  return null;
}

export function removeCustomAssetReferences(state, assetIds) {
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

export function shuffleDraft(current, assets, random) {
  const draft = cloneDraft(current);
  const doll = assets.find((a) => a.id === draft.baseDollId) || assets.find((a) => a.id === DEFAULT_BASE_DOLL_ID);
  const targetFit = doll?.fitFamily || 'teen';

  const bySlot = (slot) => assets.filter((asset) => {
    if (asset.kind !== 'wearable' || asset.slot !== slot) return false;
    return !asset.supportedFitFamilies || asset.supportedFitFamilies.includes(targetFit);
  });
  const choose = (items) => (items.length ? items[Math.min(items.length - 1, Math.floor(random() * items.length))] : null);
  const colors = (slot) => (slot === 'hair' ? HAIR_COLORS : GARMENT_COLORS);
  const equip = (slot) => {
    const available = bySlot(slot);
    if (!available.length) return;
    const asset = choose(available);
    const color = choose(colors(slot));
    if (asset) draft.slots[slot] = { assetId: asset.id, color };
  };

  for (const slot of OUTFIT_SLOTS) draft.slots[slot] = null;
  equip('hair');
  const availableDresses = bySlot('dress');
  const availableTops = bySlot('top');
  const availableBottoms = bySlot('bottom');

  if (availableDresses.length && (!availableTops.length || random() < 0.42)) {
    equip('dress');
  } else {
    equip('top');
    equip('bottom');
  }
  equip('shoes');
  if (random() < 0.78) equip('accessory');

  // Also randomize face features within catalog
  const faceByGroup = (group) => assets.filter((asset) => asset.kind === 'face' && asset.faceGroup === group);
  const randomEyes = choose(faceByGroup('eyes'));
  const randomIris = choose(IRIS_COLORS);
  const randomBrows = choose(faceByGroup('eyebrows'));
  const randomNose = choose(faceByGroup('nose'));
  const randomMouth = choose(faceByGroup('mouth'));
  const randomDetail = random() < 0.6 ? choose(faceByGroup('detail')) : null;

  if (randomEyes) draft.face.eyes = { assetId: randomEyes.id, irisColor: randomIris || DEFAULT_IRIS_COLOR };
  if (randomBrows) draft.face.eyebrows = { assetId: randomBrows.id };
  if (randomNose) draft.face.nose = { assetId: randomNose.id };
  if (randomMouth) draft.face.mouth = { assetId: randomMouth.id };
  draft.face.detail = randomDetail ? { assetId: randomDetail.id } : null;

  return draft;
}
