import { isColorValue, isPaletteToken, normalizeColorValue } from './palette.js';
import { cloneDraft, createStarterDraft, emptySlots, OUTFIT_SLOTS } from '../domain/outfit-rules.js';
import { clamp, clampPoint, clampScale, createEmptyScene, createSampleScene, getEntityBounds } from '../domain/scene-rules.js';
import { hasValidDisplayName, normalizeDisplayName } from './text.js';
import {
  DEFAULT_BACKGROUND_ID,
  DEFAULT_BASE_DOLL_ID,
  DEFAULT_BUBBLE_STYLE,
  DEFAULT_BUBBLE_TEXT,
  DEFAULT_EXPRESSION,
  DEFAULT_REDUCED_MOTION,
  isBubbleStyle,
  isEntityKind,
  isExpression,
  isReducedMotionOption,
  isValidId,
  LIMITS
} from '../domain/vocabulary.js';

export const SCHEMA_VERSION = 2;
export const STORAGE_KEY = 'paperDollStudio.state';

export function createDefaultEnvelope() {
  return {
    schemaVersion: SCHEMA_VERSION,
    revision: 1,
    savedAt: new Date(0).toISOString(),
    settings: { reducedMotion: DEFAULT_REDUCED_MOTION, soundEnabled: false },
    presets: [],
    scenes: [],
    currentScene: null
  };
}

export function createRuntimeState(envelope = createDefaultEnvelope()) {
  return {
    schemaVersion: SCHEMA_VERSION,
    revision: Number.isInteger(envelope?.revision) && envelope.revision >= 1 ? envelope.revision : 1,
    settings: { ...envelope.settings },
    presets: envelope.presets.map(clonePreset),
    scenes: (envelope.scenes || []).map(cloneScene),
    currentScene: envelope.currentScene ? cloneScene(envelope.currentScene) : createSampleScene(createStarterDraft()),
    designer: {
      draft: createStarterDraft(),
      selectedSlot: 'top',
      editingPresetId: null,
      dirty: false
    },
    ui: {
      mode: 'designer',
      selectedEntityId: null,
      selectedEntityIds: [],
      message: 'Choose an item to begin.',
      storageStatus: 'saved',
      activeSceneLibraryId: null,
      voicePuppetryActive: false
    }
  };
}

export function persistedProjection(state, now = () => new Date(), revision = state.revision ?? 1) {
  return {
    schemaVersion: SCHEMA_VERSION,
    revision: Number.isInteger(revision) && revision >= 1 ? revision : 1,
    savedAt: now().toISOString(),
    settings: { ...state.settings },
    presets: state.presets.map(clonePreset),
    scenes: (state.scenes || []).map(cloneScene),
    currentScene: state.currentScene ? cloneScene(state.currentScene) : null
  };
}

export function sanitizeEnvelope(value, getAsset = () => undefined) {
  const defaults = createDefaultEnvelope();
  const warnings = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { envelope: defaults, warnings: ['Saved data was not an object.'], recovered: false };
  }
  value = migrateEnvelope(value, warnings);
  if (value.schemaVersion !== SCHEMA_VERSION) {
    warnings.push(`Unsupported schema version ${String(value.schemaVersion)}; safe defaults loaded.`);
    return { envelope: defaults, warnings, recovered: false };
  }

  const presets = [];
  const presetIds = new Set();
  for (const candidate of Array.isArray(value.presets) ? value.presets : []) {
    if (presets.length >= LIMITS.MAX_PRESETS) break;
    const preset = sanitizePreset(candidate, getAsset);
    if (preset && !presetIds.has(preset.presetId)) {
      presetIds.add(preset.presetId);
      presets.push(preset);
    } else if (preset) warnings.push('A duplicate Dollbox preset was skipped.');
    else warnings.push('An invalid Dollbox preset was skipped.');
  }

  const scenes = [];
  const sceneIds = new Set();
  for (const candidate of Array.isArray(value.scenes) ? value.scenes : []) {
    if (scenes.length >= LIMITS.MAX_SCENES) break;
    const scene = sanitizeScene(candidate, getAsset, warnings);
    if (scene && !sceneIds.has(scene.sceneId)) {
      sceneIds.add(scene.sceneId);
      scenes.push(scene);
    } else if (scene) warnings.push('A duplicate library scene was skipped.');
  }

  const currentScene = sanitizeScene(value.currentScene, getAsset, warnings);
  const revision = Number.isInteger(value?.revision) && value.revision >= 1 ? value.revision : 1;
  return {
    envelope: {
      schemaVersion: SCHEMA_VERSION,
      revision,
      savedAt: validDateString(value.savedAt) ? value.savedAt : defaults.savedAt,
      settings: {
        reducedMotion: isReducedMotionOption(value.settings?.reducedMotion)
          ? value.settings.reducedMotion
          : DEFAULT_REDUCED_MOTION,
        soundEnabled: Boolean(value.settings?.soundEnabled)
      },
      presets,
      scenes,
      currentScene
    },
    warnings,
    recovered: warnings.length === 0
  };
}

export function sanitizePreset(candidate, getAsset = () => undefined) {
  if (!candidate || typeof candidate !== 'object') return null;
  if (!validId(candidate.presetId) || !validPresetName(candidate.name)) return null;
  const dollAsset = getAsset(candidate.baseDollId);
  const isValidDoll = candidate.baseDollId === DEFAULT_BASE_DOLL_ID || (dollAsset && dollAsset.kind === 'doll');
  if (!isValidDoll || !isPaletteToken(candidate.skinTone)) return null;
  const draft = sanitizeDraft(candidate, getAsset);
  if (!draft) return null;
  return {
    presetId: candidate.presetId,
    name: normalizeDisplayName(candidate.name, LIMITS.MAX_PRESET_NAME_LENGTH),
    createdAt: validDateString(candidate.createdAt) ? candidate.createdAt : new Date(0).toISOString(),
    updatedAt: validDateString(candidate.updatedAt) ? candidate.updatedAt : new Date(0).toISOString(),
    ...draft
  };
}

export function sanitizeDraft(candidate, getAsset = () => undefined) {
  if (!candidate) return null;
  const dollAsset = getAsset(candidate.baseDollId);
  const isValidDoll = candidate.baseDollId === DEFAULT_BASE_DOLL_ID || (dollAsset && dollAsset.kind === 'doll');
  if (!isValidDoll || !isPaletteToken(candidate.skinTone)) return null;
  const baseDollId = candidate.baseDollId || DEFAULT_BASE_DOLL_ID;
  const slots = emptySlots();
  for (const slot of OUTFIT_SLOTS) {
    const item = candidate.slots?.[slot];
    if (item == null) continue;
    const asset = getAsset(item.assetId);
    if (!asset || asset.kind !== 'wearable' || asset.slot !== slot || !isColorValue(item.color)) continue;
    slots[slot] = { assetId: item.assetId, color: normalizeColorValue(item.color) };
  }
  if (slots.dress) {
    slots.top = null;
    slots.bottom = null;
  }
  return { baseDollId, skinTone: candidate.skinTone, slots };
}

export function sanitizeScene(candidate, getAsset = () => undefined, warnings = []) {
  if (candidate == null) return null;
  if (typeof candidate !== 'object' || !validId(candidate.sceneId)) {
    warnings.push('The current scene was invalid and was not restored.');
    return null;
  }
  const entities = [];
  const entityIds = new Set();
  for (const item of Array.isArray(candidate.entities) ? candidate.entities : []) {
    if (entities.length >= LIMITS.MAX_ENTITIES) break;
    const entity = sanitizeEntity(item, getAsset);
    if (entity && !entityIds.has(entity.instanceId)) {
      entityIds.add(entity.instanceId);
      entities.push(entity);
    } else if (entity) warnings.push('A duplicate scene item was skipped.');
    else warnings.push('An invalid scene item was skipped.');
  }

  // Validate attachment graph (DAG, no self-attachment, no cycles, no dangling references)
  const entityMap = new Map(entities.map((e) => [e.instanceId, e]));
  for (const entity of entities) {
    if (!entity.attachedTo) continue;
    if (!entityMap.has(entity.attachedTo) || entity.attachedTo === entity.instanceId) {
      entity.attachedTo = null;
      entity.attachOffset = null;
      continue;
    }
    // Cycle detection
    const visited = new Set([entity.instanceId]);
    let curr = entityMap.get(entity.attachedTo);
    let hasCycle = false;
    while (curr && curr.attachedTo) {
      if (visited.has(curr.instanceId)) {
        hasCycle = true;
        break;
      }
      visited.add(curr.instanceId);
      curr = entityMap.get(curr.attachedTo);
    }
    if (hasCycle) {
      entity.attachedTo = null;
      entity.attachOffset = null;
      warnings.push('A circular attachment reference was detached.');
    } else if (!entity.attachOffset) {
      const parent = entityMap.get(entity.attachedTo);
      entity.attachOffset = { dx: entity.x - parent.x, dy: entity.y - parent.y };
    }
  }

  entities.sort((a, b) => a.order - b.order).forEach((entity, index) => { entity.order = index + 1; });
  return {
    sceneId: candidate.sceneId,
    title: validName(candidate.title) ? normalizeDisplayName(candidate.title, LIMITS.MAX_SCENE_TITLE_LENGTH) : 'Current Scene',
    backgroundId: getAsset(candidate.backgroundId)?.kind === 'background' ? candidate.backgroundId : DEFAULT_BACKGROUND_ID,
    createdAt: validDateString(candidate.createdAt) ? candidate.createdAt : (validDateString(candidate.updatedAt) ? candidate.updatedAt : new Date(0).toISOString()),
    updatedAt: validDateString(candidate.updatedAt) ? candidate.updatedAt : new Date(0).toISOString(),
    entities
  };
}

function sanitizeEntity(item, getAsset) {
  if (!item || typeof item !== 'object' || !validId(item.instanceId)) return null;
  if (!isEntityKind(item.kind)) return null;
  const sourceAsset = getAsset(item.sourceId);
  if (item.kind === 'prop' && (!validId(item.sourceId) || (sourceAsset && sourceAsset.kind !== 'prop'))) return null;
  if (item.kind === 'character' && (!validId(item.sourceId) || !sanitizeDraft(item.characterSnapshot, getAsset))) return null;
  if (!Number.isFinite(item.x) || !Number.isFinite(item.y)) return null;
  const characterSnapshot = item.kind === 'character' ? sanitizeDraft(item.characterSnapshot, getAsset) : null;
  const isBubble = item.kind === 'bubble';
  const text = isBubble ? (normalizeDisplayName(item.text, LIMITS.MAX_BUBBLE_TEXT_LENGTH) || DEFAULT_BUBBLE_TEXT) : undefined;
  const bubbleStyle = isBubble ? (isBubbleStyle(item.bubbleStyle) ? item.bubbleStyle : DEFAULT_BUBBLE_STYLE) : undefined;
  const width = isBubble ? Math.round(clamp(Number(item.width) || LIMITS.DEFAULT_BUBBLE_WIDTH, LIMITS.MIN_BUBBLE_WIDTH, LIMITS.MAX_BUBBLE_WIDTH)) : undefined;

  const scale = clampScale(item.scale == null ? 1 : Number(item.scale));
  const bounds = getEntityBounds({ ...item, scale, text, bubbleStyle, width }, getAsset);
  const point = clampPoint(item.x, item.y, bounds);
  const pinned = Boolean(item.pinned);
  const attachedTo = !pinned && validId(item.attachedTo) ? item.attachedTo : null;
  const attachOffset = attachedTo && item.attachOffset && Number.isFinite(item.attachOffset.dx) && Number.isFinite(item.attachOffset.dy)
    ? { dx: Math.round(item.attachOffset.dx), dy: Math.round(item.attachOffset.dy) }
    : null;

  return {
    instanceId: item.instanceId,
    kind: item.kind,
    sourceId: String(item.sourceId || (isBubble ? 'bubble' : '')),
    ...(characterSnapshot ? { characterSnapshot } : {}),
    ...(isBubble ? { text, bubbleStyle, width } : {}),
    ...point,
    scale,
    flipped: Boolean(item.flipped),
    pinned,
    attachedTo,
    attachOffset,
    ...(item.kind === 'character' ? { expression: isExpression(item.expression) ? item.expression : DEFAULT_EXPRESSION } : {}),
    order: Number.isInteger(item.order) ? item.order : 1
  };
}

function validId(value) {
  return isValidId(value);
}

function validName(value) {
  return hasValidDisplayName(value, LIMITS.MAX_SCENE_TITLE_LENGTH);
}

function validPresetName(value) {
  return hasValidDisplayName(value, LIMITS.MAX_PRESET_NAME_LENGTH);
}

function validDateString(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

export function clonePreset(preset) {
  return { ...preset, ...cloneDraft(preset) };
}

export function cloneScene(scene) {
  return {
    ...scene,
    entities: scene.entities.map((entity) => ({
      ...entity,
      attachOffset: entity.attachOffset ? { ...entity.attachOffset } : null,
      ...(entity.characterSnapshot ? { characterSnapshot: cloneDraft(entity.characterSnapshot) } : {})
    }))
  };
}

function migrateEnvelope(value, warnings) {
  if (value.schemaVersion === 1) {
    warnings.push('Saved data was upgraded to the custom-color schema.');
    return { ...value, schemaVersion: 2 };
  }
  return value;
}
