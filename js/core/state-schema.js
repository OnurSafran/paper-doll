import { isColorValue, isIrisColor, isPaletteToken, normalizeColorValue } from './palette.js';
import { cloneDraft, createDefaultFace, createStarterDraft, emptySlots, OUTFIT_SLOTS } from '../domain/outfit-rules.js';
import { clamp, clampPoint, clampScale, createEmptyScene, createSampleScene, getEntityBounds, reclampSceneEntities } from '../domain/scene-rules.js';
import {
  resolveMotionProfile,
  resolveSafeClipId,
  resolveSafePoseId
} from '../domain/animation-clips.js';
import { clampCameraX } from './coordinate-space.js';
import { hasValidDisplayName, normalizeDisplayName } from './text.js';
import {
  CAMERA_CONSTANTS,
  DEFAULT_ATTACH_JOINT,
  DEFAULT_BACKGROUND_ID,
  DEFAULT_BASE_DOLL_ID,
  DEFAULT_BUBBLE_STYLE,
  DEFAULT_BUBBLE_TEXT,
  DEFAULT_EXPRESSION,
  DEFAULT_EXPRESSION_INTENSITY,
  DEFAULT_IRIS_COLOR,
  DEFAULT_MOTION_CLIP_ID,
  DEFAULT_MOTION_INTENSITY,
  DEFAULT_PHASE_OFFSET,
  DEFAULT_PLAYBACK_RATE,
  DEFAULT_REDUCED_MOTION,
  DEFAULT_SCENE_ANIMATION_SETTINGS,
  DEFAULT_STAGE_WIDTH,
  DEFAULT_STATIC_POSE,
  FIT_FAMILIES,
  isAttachJoint,
  isBubbleStyle,
  isCustomAssetId,
  isEntityKind,
  isExpression,
  isExpressionIntensity,
  isFaceGroup,
  isFitFamily,
  isMotionClipId,
  isMotionIntensity,
  isPhaseOffset,
  isPlaybackRate,
  isPresentationStyle,
  isPropCollection,
  isReducedMotionOption,
  isStageWidth,
  isStaticPose,
  isValidId,
  LIMITS,
  STAGE_WIDTHS
} from '../domain/vocabulary.js';

export const SCHEMA_VERSION = 6;
export const STORAGE_KEY = 'paperDollStudio.state';

export function createDefaultEnvelope() {
  return {
    schemaVersion: SCHEMA_VERSION,
    revision: 1,
    savedAt: new Date(0).toISOString(),
    settings: { reducedMotion: DEFAULT_REDUCED_MOTION, soundEnabled: false },
    customAssets: [],
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
    customAssets: (envelope.customAssets || []).map(cloneCustomAsset),
    presets: (envelope.presets || []).map(clonePreset),
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
    customAssets: (state.customAssets || []).map(cloneCustomAsset),
    presets: state.presets.map(clonePreset),
    scenes: (state.scenes || []).map(cloneScene),
    currentScene: state.currentScene ? cloneScene(state.currentScene) : null
  };
}

export function cloneCustomAsset(asset) {
  if (!asset || typeof asset !== 'object') return null;
  return {
    ...asset,
    ...(Array.isArray(asset.collections) ? { collections: [...asset.collections] } : {}),
    ...(asset.groundAnchor ? { groundAnchor: { ...asset.groundAnchor } } : {})
  };
}

export function sanitizeCustomAsset(candidate) {
  if (!candidate || typeof candidate !== 'object') return null;
  if (!isValidId(candidate.assetId)) return null;

  const rawName = candidate.name;
  if (!hasValidDisplayName(rawName, LIMITS.MAX_CUSTOM_ASSET_NAME_LENGTH)) return null;
  const name = normalizeDisplayName(rawName, LIMITS.MAX_CUSTOM_ASSET_NAME_LENGTH);

  const kind = candidate.kind;
  if (kind !== 'wearable' && kind !== 'prop') return null;

  let slot = undefined;
  if (kind === 'wearable') {
    if (!['top', 'bottom', 'dress', 'shoes', 'accessory', 'hair'].includes(candidate.slot)) {
      return null;
    }
    slot = candidate.slot;
  }

  const format = 'image/png';
  const logicalWidth = Number.isInteger(candidate.logicalWidth) && candidate.logicalWidth > 0
    ? candidate.logicalWidth
    : (kind === 'wearable' ? 300 : 500);
  const logicalHeight = Number.isInteger(candidate.logicalHeight) && candidate.logicalHeight > 0
    ? candidate.logicalHeight
    : (kind === 'wearable' ? 450 : 500);

  const pixelWidth = Number.isInteger(candidate.pixelWidth) && candidate.pixelWidth > 0
    ? candidate.pixelWidth
    : (kind === 'wearable' ? 600 : 1000);
  const pixelHeight = Number.isInteger(candidate.pixelHeight) && candidate.pixelHeight > 0
    ? candidate.pixelHeight
    : (kind === 'wearable' ? 900 : 1000);

  const expectedDimensions = kind === 'wearable'
    ? { logicalWidth: 300, logicalHeight: 450, pixelWidth: 600, pixelHeight: 900 }
    : { logicalWidth: 500, logicalHeight: 500, pixelWidth: 1000, pixelHeight: 1000 };
  if (logicalWidth !== expectedDimensions.logicalWidth || logicalHeight !== expectedDimensions.logicalHeight ||
    pixelWidth !== expectedDimensions.pixelWidth || pixelHeight !== expectedDimensions.pixelHeight) {
    return null;
  }

  const byteLength = typeof candidate.byteLength === 'number' && candidate.byteLength > 0 && candidate.byteLength <= LIMITS.MAX_CUSTOM_ASSET_BYTES
    ? candidate.byteLength
    : undefined;

  const sha256 = typeof candidate.sha256 === 'string' && candidate.sha256.length >= 8
    ? candidate.sha256
    : 'unknown';

  const createdAt = validDateString(candidate.createdAt) ? candidate.createdAt : new Date(0).toISOString();
  const updatedAt = validDateString(candidate.updatedAt) ? candidate.updatedAt : createdAt;
  const libraryVisible = candidate.libraryVisible !== false;
  const status = candidate.status === 'missing' || candidate.status === 'trashed' ? candidate.status : 'available';

  let displayWidth = undefined;
  let displayHeight = undefined;
  let groundAnchor = undefined;

  if (kind === 'prop') {
    displayWidth = typeof candidate.displayWidth === 'number' && candidate.displayWidth > 0
      ? Math.round(clamp(candidate.displayWidth, 40, 360))
      : 240;
    displayHeight = typeof candidate.displayHeight === 'number' && candidate.displayHeight > 0
      ? Math.round(clamp(candidate.displayHeight, 40, 360))
      : 240;
    const ax = typeof candidate.groundAnchor?.x === 'number' ? clamp(candidate.groundAnchor.x, 0, 1) : 0.5;
    const ay = typeof candidate.groundAnchor?.y === 'number' ? clamp(candidate.groundAnchor.y, 0, 1) : 1.0;
    groundAnchor = { x: ax, y: ay };
  }

  const supportedFitFamilies = kind === 'wearable'
    ? (Array.isArray(candidate.supportedFitFamilies) && candidate.supportedFitFamilies.filter(isFitFamily).length
      ? candidate.supportedFitFamilies.filter(isFitFamily)
      : [...FIT_FAMILIES])
    : undefined;
  const presentationStyles = kind === 'wearable'
    ? (Array.isArray(candidate.presentationStyles) && candidate.presentationStyles.filter((style) => isPresentationStyle(style) && style !== 'all').length
      ? candidate.presentationStyles.filter((style) => isPresentationStyle(style) && style !== 'all')
      : ['neutral', 'feminine', 'masculine'])
    : undefined;
  const collections = kind === 'prop' && Array.isArray(candidate.collections)
    ? [...new Set(candidate.collections.filter(isPropCollection))]
    : [];

  return {
    assetId: candidate.assetId,
    name,
    kind,
    ...(slot ? { slot } : {}),
    format,
    logicalWidth,
    logicalHeight,
    pixelWidth,
    pixelHeight,
    ...(byteLength != null ? { byteLength } : {}),
    sha256,
    createdAt,
    updatedAt,
    libraryVisible,
    status,
    collections,
    ...(kind === 'wearable' ? { supportedFitFamilies, presentationStyles } : {}),
    ...(kind === 'prop' ? { displayWidth, displayHeight, groundAnchor } : {})
  };
}

export function sanitizeEnvelope(value, getAsset = () => undefined) {
  const defaults = createDefaultEnvelope();
  const warnings = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { envelope: defaults, warnings: ['Saved data was not an object.'], recovered: false };
  }
  const migrationWarnings = [];
  value = migrateEnvelope(value, migrationWarnings);
  warnings.push(...migrationWarnings);
  if (value.schemaVersion !== SCHEMA_VERSION) {
    warnings.push(`Unsupported schema version ${String(value.schemaVersion)}; safe defaults loaded.`);
    return { envelope: defaults, warnings, recovered: false };
  }

  // 1. Sanitize customAssets
  const customAssets = [];
  const customAssetIds = new Set();
  let totalCustomBytes = 0;

  for (const candidate of Array.isArray(value.customAssets) ? value.customAssets : []) {
    if (customAssets.length >= LIMITS.MAX_CUSTOM_ASSETS) {
      warnings.push(`Custom artwork limit (${LIMITS.MAX_CUSTOM_ASSETS}) reached; extra items were skipped.`);
      break;
    }
    const sanitized = sanitizeCustomAsset(candidate);
    if (sanitized && !customAssetIds.has(sanitized.assetId)) {
      if (sanitized.byteLength && totalCustomBytes + sanitized.byteLength > LIMITS.MAX_TOTAL_CUSTOM_BYTES) {
        warnings.push(`Total custom artwork byte limit (${LIMITS.MAX_TOTAL_CUSTOM_BYTES}) reached.`);
        break;
      }
      totalCustomBytes += sanitized.byteLength || 0;
      customAssetIds.add(sanitized.assetId);
      customAssets.push(sanitized);
    } else if (sanitized) {
      warnings.push('A duplicate custom artwork was skipped.');
    } else {
      warnings.push('An invalid custom artwork was skipped.');
    }
  }

  const customMap = new Map(customAssets.map((c) => [c.assetId, c]));
  const effectiveGetAsset = (id) => customMap.get(id) || getAsset(id);

  // 2. Sanitize presets
  const presets = [];
  const presetIds = new Set();
  for (const candidate of Array.isArray(value.presets) ? value.presets : []) {
    if (presets.length >= LIMITS.MAX_PRESETS) break;
    const preset = sanitizePreset(candidate, effectiveGetAsset, warnings);
    if (preset && !presetIds.has(preset.presetId)) {
      presetIds.add(preset.presetId);
      presets.push(preset);
    } else if (preset) warnings.push('A duplicate Dollbox preset was skipped.');
    else warnings.push('An invalid Dollbox preset was skipped.');
  }

  // 3. Sanitize scenes
  const scenes = [];
  const sceneIds = new Set();
  for (const candidate of Array.isArray(value.scenes) ? value.scenes : []) {
    if (scenes.length >= LIMITS.MAX_SCENES) break;
    const scene = sanitizeScene(candidate, effectiveGetAsset, warnings);
    if (scene && !sceneIds.has(scene.sceneId)) {
      sceneIds.add(scene.sceneId);
      scenes.push(scene);
    } else if (scene) warnings.push('A duplicate library scene was skipped.');
  }

  const currentScene = sanitizeScene(value.currentScene, effectiveGetAsset, warnings);
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
      customAssets,
      presets,
      scenes,
      currentScene
    },
    warnings,
    migrated: migrationWarnings.length > 0,
    recovered: warnings.length === migrationWarnings.length
  };
}


export function sanitizePreset(candidate, getAsset = () => undefined, warnings = []) {
  if (!candidate || typeof candidate !== 'object') return null;
  if (!validId(candidate.presetId) || !validPresetName(candidate.name)) return null;
  const dollAsset = getAsset(candidate.baseDollId);
  const isValidDoll = candidate.baseDollId === DEFAULT_BASE_DOLL_ID || (dollAsset && dollAsset.kind === 'doll');
  if (!isValidDoll || !isPaletteToken(candidate.skinTone)) return null;
  const draft = sanitizeDraft(candidate, getAsset, warnings);
  if (!draft) return null;
  return {
    presetId: candidate.presetId,
    name: normalizeDisplayName(candidate.name, LIMITS.MAX_PRESET_NAME_LENGTH),
    createdAt: validDateString(candidate.createdAt) ? candidate.createdAt : new Date(0).toISOString(),
    updatedAt: validDateString(candidate.updatedAt) ? candidate.updatedAt : new Date(0).toISOString(),
    ...draft
  };
}

export function sanitizeDraft(candidate, getAsset = () => undefined, warnings = []) {
  if (!candidate) return null;
  const dollAsset = getAsset(candidate.baseDollId);
  const isValidDoll = candidate.baseDollId === DEFAULT_BASE_DOLL_ID || (dollAsset && dollAsset.kind === 'doll');
  if (!isValidDoll || !isPaletteToken(candidate.skinTone)) return null;
  const baseDollId = candidate.baseDollId || DEFAULT_BASE_DOLL_ID;
  const defaultFace = createDefaultFace(baseDollId);

  let face = defaultFace;
  if (candidate.face && typeof candidate.face === 'object') {
    face = {
      eyes: sanitizeFaceFeature('eyes', candidate.face.eyes, defaultFace.eyes, getAsset, baseDollId, warnings),
      eyebrows: sanitizeFaceFeature('eyebrows', candidate.face.eyebrows, defaultFace.eyebrows, getAsset, baseDollId, warnings),
      nose: sanitizeFaceFeature('nose', candidate.face.nose, defaultFace.nose, getAsset, baseDollId, warnings),
      mouth: sanitizeFaceFeature('mouth', candidate.face.mouth, defaultFace.mouth, getAsset, baseDollId, warnings),
      detail: candidate.face.detail ? sanitizeFaceFeature('detail', candidate.face.detail, null, getAsset, baseDollId, warnings) : null
    };
  }

  const slots = emptySlots();
  for (const slot of OUTFIT_SLOTS) {
    const item = candidate.slots?.[slot];
    if (item == null) continue;
    const asset = getAsset(item.assetId);
    if (asset && asset.kind === 'wearable' && asset.slot === slot) {
      slots[slot] = { assetId: item.assetId, color: isColorValue(item.color) ? normalizeColorValue(item.color) : 'coral' };
    } else if (!asset && isCustomAssetId(item.assetId)) {
      // Retain placeholder reference for missing custom art
      slots[slot] = { assetId: item.assetId, color: isColorValue(item.color) ? normalizeColorValue(item.color) : 'coral' };
    }
  }
  if (slots.dress) {
    slots.top = null;
    slots.bottom = null;
  }
  return { baseDollId, skinTone: candidate.skinTone, face, slots };
}

function sanitizeFaceFeature(group, item, fallback, getAsset, baseDollId, warnings = []) {
  if (!item || typeof item !== 'object' || !validId(item.assetId)) {
    if (item != null) warnings.push(`Invalid face feature for ${group}; the approved default was restored.`);
    return fallback ? { ...fallback } : null;
  }
  const asset = getAsset(item.assetId);
  const doll = getAsset(baseDollId);
  const fitFamily = doll?.fitFamily;
  if (!asset || asset.kind !== 'face' || asset.faceGroup !== group ||
    (fitFamily && asset.supportedFitFamilies && !asset.supportedFitFamilies.includes(fitFamily))) {
    warnings.push(`Invalid face feature for ${group}; the approved default was restored.`);
    return fallback ? { ...fallback } : null;
  }
  if (group === 'eyes') {
    const irisColor = isIrisColor(item.irisColor) ? item.irisColor : (fallback?.irisColor || DEFAULT_IRIS_COLOR);
    return { assetId: item.assetId, irisColor };
  }
  return { assetId: item.assetId };
}

export function sanitizeScene(candidate, getAsset = () => undefined, warnings = []) {
  if (candidate == null) return null;
  if (typeof candidate !== 'object' || !validId(candidate.sceneId)) {
    warnings.push('The current scene was invalid and was not restored.');
    return null;
  }
  const candidateStageWidth = isStageWidth(candidate.stageWidth) ? candidate.stageWidth : DEFAULT_STAGE_WIDTH;
  const entities = [];
  const entityIds = new Set();
  for (const item of Array.isArray(candidate.entities) ? candidate.entities : []) {
    if (entities.length >= LIMITS.MAX_ENTITIES) break;
    const entity = sanitizeEntity(item, getAsset, candidateStageWidth, warnings);
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
    } else {
      const parent = entityMap.get(entity.attachedTo);
      entity.attachOffset = { dx: entity.x - parent.x, dy: entity.y - parent.y };
    }
  }

  entities.sort((a, b) => a.order - b.order).forEach((entity, index) => { entity.order = index + 1; });
  const stageWidth = isStageWidth(candidate.stageWidth) ? candidate.stageWidth : DEFAULT_STAGE_WIDTH;
  const cameraX = clampCameraX(candidate.cameraX ?? CAMERA_CONSTANTS.DEFAULT_CAMERA_X, stageWidth);

  const rawAnimationSettings = candidate.animationSettings;
  const animationSettings = rawAnimationSettings && typeof rawAnimationSettings === 'object'
    ? {
        enabled: Boolean(rawAnimationSettings.enabled),
        loop: rawAnimationSettings.loop !== false,
        playbackRate: isPlaybackRate(rawAnimationSettings.playbackRate) ? rawAnimationSettings.playbackRate : DEFAULT_PLAYBACK_RATE
      }
    : { ...DEFAULT_SCENE_ANIMATION_SETTINGS };

  const sanitizedScene = {
    sceneId: candidate.sceneId,
    title: validName(candidate.title) ? normalizeDisplayName(candidate.title, LIMITS.MAX_SCENE_TITLE_LENGTH) : 'Current Scene',
    backgroundId: getAsset(candidate.backgroundId)?.kind === 'background' ? candidate.backgroundId : DEFAULT_BACKGROUND_ID,
    stageWidth,
    cameraX,
    animationSettings,
    createdAt: validDateString(candidate.createdAt) ? candidate.createdAt : (validDateString(candidate.updatedAt) ? candidate.updatedAt : new Date(0).toISOString()),
    updatedAt: validDateString(candidate.updatedAt) ? candidate.updatedAt : new Date(0).toISOString(),
    entities
  };

  const reclamped = reclampSceneEntities(sanitizedScene, stageWidth, getAsset);
  return { ...reclamped, updatedAt: sanitizedScene.updatedAt };
}

function sanitizeEntity(item, getAsset, stageWidth = DEFAULT_STAGE_WIDTH, warnings = []) {
  if (!item || typeof item !== 'object' || !validId(item.instanceId)) return null;
  if (!isEntityKind(item.kind)) return null;
  const sourceAsset = getAsset(item.sourceId);
  const isCustomProp = item.kind === 'prop' && isCustomAssetId(item.sourceId);
  if (item.kind === 'prop' && (!validId(item.sourceId) || (!isCustomProp && sourceAsset && sourceAsset.kind !== 'prop'))) return null;
  const characterSnapshot = item.kind === 'character' && validId(item.sourceId)
    ? sanitizeDraft(item.characterSnapshot, getAsset, warnings)
    : null;
  if (item.kind === 'character' && (!validId(item.sourceId) || !characterSnapshot)) return null;
  if (!Number.isFinite(item.x) || !Number.isFinite(item.y)) return null;
  const isBubble = item.kind === 'bubble';
  const text = isBubble ? (normalizeDisplayName(item.text, LIMITS.MAX_BUBBLE_TEXT_LENGTH) || DEFAULT_BUBBLE_TEXT) : undefined;
  const bubbleStyle = isBubble ? (isBubbleStyle(item.bubbleStyle) ? item.bubbleStyle : DEFAULT_BUBBLE_STYLE) : undefined;
  const width = isBubble ? Math.round(clamp(Number(item.width) || LIMITS.DEFAULT_BUBBLE_WIDTH, LIMITS.MIN_BUBBLE_WIDTH, LIMITS.MAX_BUBBLE_WIDTH)) : undefined;

  const scale = clampScale(item.scale == null ? 1 : Number(item.scale));
  const bounds = getEntityBounds({ ...item, scale, text, bubbleStyle, width }, getAsset);
  const point = clampPoint(item.x, item.y, bounds, stageWidth);
  const pinned = Boolean(item.pinned);
  const attachedTo = !pinned && validId(item.attachedTo) ? item.attachedTo : null;
  const attachOffset = attachedTo && item.attachOffset && Number.isFinite(item.attachOffset.dx) && Number.isFinite(item.attachOffset.dy)
    ? { dx: Math.round(item.attachOffset.dx), dy: Math.round(item.attachOffset.dy) }
    : null;
  const attachJoint = attachedTo && isAttachJoint(item.attachJoint) ? item.attachJoint : DEFAULT_ATTACH_JOINT;

  let expression = undefined;
  let expressionIntensity = undefined;
  let pose = undefined;
  let animation = undefined;

  if (item.kind === 'character') {
    const motionProfile = resolveMotionProfile(item);
    expression = isExpression(item.expression) ? item.expression : DEFAULT_EXPRESSION;
    expressionIntensity = isExpressionIntensity(item.expressionIntensity) ? item.expressionIntensity : DEFAULT_EXPRESSION_INTENSITY;
    pose = resolveSafePoseId(item.pose, motionProfile);

    const rawAnim = item.animation;
    animation = rawAnim && typeof rawAnim === 'object'
      ? {
          clipId: resolveSafeClipId(rawAnim.clipId, motionProfile),
          enabled: Boolean(rawAnim.enabled),
          intensity: isMotionIntensity(rawAnim.intensity) ? rawAnim.intensity : DEFAULT_MOTION_INTENSITY,
          phaseOffset: isPhaseOffset(rawAnim.phaseOffset) ? rawAnim.phaseOffset : DEFAULT_PHASE_OFFSET
        }
      : {
          clipId: DEFAULT_MOTION_CLIP_ID,
          enabled: false,
          intensity: DEFAULT_MOTION_INTENSITY,
          phaseOffset: DEFAULT_PHASE_OFFSET
        };
  }

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
    ...(attachedTo ? { attachJoint } : {}),
    ...(item.kind === 'character' ? { expression, expressionIntensity, pose, animation } : {}),
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
    animationSettings: scene.animationSettings
      ? { ...scene.animationSettings }
      : { ...DEFAULT_SCENE_ANIMATION_SETTINGS },
    entities: scene.entities.map((entity) => ({
      ...entity,
      attachOffset: entity.attachOffset ? { ...entity.attachOffset } : null,
      ...(entity.attachJoint ? { attachJoint: entity.attachJoint } : {}),
      ...(entity.characterSnapshot ? { characterSnapshot: cloneDraft(entity.characterSnapshot) } : {}),
      ...(entity.animation ? { animation: { ...entity.animation } } : {})
    }))
  };
}

function migrateEnvelope(value, warnings) {
  if (value.schemaVersion === 1) {
    warnings.push('Saved data was upgraded to the custom-color schema.');
    value = { ...value, schemaVersion: 2 };
  }
  if (value.schemaVersion === 2) {
    warnings.push('Saved data was upgraded to custom-assets schema.');
    value = {
      ...value,
      schemaVersion: 3,
      customAssets: Array.isArray(value.customAssets) ? value.customAssets : []
    };
  }
  if (value.schemaVersion === 3) {
    warnings.push('Saved data was upgraded to modular character face schema.');
    const presets = Array.isArray(value.presets)
      ? value.presets.map((preset) => ({
          ...preset,
          face: preset.face ? { ...preset.face } : createDefaultFace(preset.baseDollId)
        }))
      : [];

    const migrateSceneEntities = (entities) => {
      if (!Array.isArray(entities)) return [];
      return entities.map((entity) => {
        if (entity.kind === 'character' && entity.characterSnapshot) {
          return {
            ...entity,
            characterSnapshot: {
              ...entity.characterSnapshot,
              face: entity.characterSnapshot.face ? { ...entity.characterSnapshot.face } : createDefaultFace(entity.characterSnapshot.baseDollId)
            }
          };
        }
        return entity;
      });
    };

    const scenes = Array.isArray(value.scenes)
      ? value.scenes.map((scene) => ({
          ...scene,
          entities: migrateSceneEntities(scene.entities)
        }))
      : [];

    const currentScene = value.currentScene
      ? {
          ...value.currentScene,
          entities: migrateSceneEntities(value.currentScene.entities)
        }
      : null;

    value = {
      ...value,
      schemaVersion: 4,
      presets,
      scenes,
      currentScene
    };
  }
  if (value.schemaVersion === 4) {
    warnings.push('Saved data was upgraded to character animation and pose schema.');
    const migrateSceneEntitiesV5 = (entities) => {
      if (!Array.isArray(entities)) return [];
      return entities.map((entity) => {
        if (entity.kind === 'character') {
          return {
            ...entity,
            expressionIntensity: isExpressionIntensity(entity.expressionIntensity) ? entity.expressionIntensity : DEFAULT_EXPRESSION_INTENSITY,
            pose: isStaticPose(entity.pose) ? entity.pose : DEFAULT_STATIC_POSE,
            animation: entity.animation && typeof entity.animation === 'object'
              ? {
                  clipId: isMotionClipId(entity.animation.clipId) ? entity.animation.clipId : DEFAULT_MOTION_CLIP_ID,
                  enabled: Boolean(entity.animation.enabled),
                  intensity: isMotionIntensity(entity.animation.intensity) ? entity.animation.intensity : DEFAULT_MOTION_INTENSITY,
                  phaseOffset: isPhaseOffset(entity.animation.phaseOffset) ? entity.animation.phaseOffset : DEFAULT_PHASE_OFFSET
                }
              : {
                  clipId: DEFAULT_MOTION_CLIP_ID,
                  enabled: false,
                  intensity: DEFAULT_MOTION_INTENSITY,
                  phaseOffset: DEFAULT_PHASE_OFFSET
                }
          };
        }
        return entity;
      });
    };

    const scenes = Array.isArray(value.scenes)
      ? value.scenes.map((scene) => ({
          ...scene,
          animationSettings: scene.animationSettings ? { ...scene.animationSettings } : { ...DEFAULT_SCENE_ANIMATION_SETTINGS },
          entities: migrateSceneEntitiesV5(scene.entities)
        }))
      : [];

    const currentScene = value.currentScene
      ? {
          ...value.currentScene,
          animationSettings: value.currentScene.animationSettings ? { ...value.currentScene.animationSettings } : { ...DEFAULT_SCENE_ANIMATION_SETTINGS },
          entities: migrateSceneEntitiesV5(value.currentScene.entities)
        }
      : null;

    value = {
      ...value,
      schemaVersion: 5,
      presets: Array.isArray(value.presets) ? value.presets : [],
      scenes,
      currentScene
    };
  }
  if (value.schemaVersion === 5) {
    warnings.push('Saved data was upgraded to animation expansion and choreography schema.');
    const migrateSceneEntitiesV6 = (entities) => {
      if (!Array.isArray(entities)) return [];
      return entities.map((entity) => {
        if (entity.attachedTo) {
          return {
            ...entity,
            attachJoint: isAttachJoint(entity.attachJoint) ? entity.attachJoint : DEFAULT_ATTACH_JOINT
          };
        }
        return entity;
      });
    };

    const scenes = Array.isArray(value.scenes)
      ? value.scenes.map((scene) => ({
          ...scene,
          animationSettings: {
            ...DEFAULT_SCENE_ANIMATION_SETTINGS,
            ...(scene.animationSettings || {}),
            playbackRate: isPlaybackRate(scene.animationSettings?.playbackRate) ? scene.animationSettings.playbackRate : DEFAULT_PLAYBACK_RATE
          },
          entities: migrateSceneEntitiesV6(scene.entities)
        }))
      : [];

    const currentScene = value.currentScene
      ? {
          ...value.currentScene,
          animationSettings: {
            ...DEFAULT_SCENE_ANIMATION_SETTINGS,
            ...(value.currentScene.animationSettings || {}),
            playbackRate: isPlaybackRate(value.currentScene.animationSettings?.playbackRate) ? value.currentScene.animationSettings.playbackRate : DEFAULT_PLAYBACK_RATE
          },
          entities: migrateSceneEntitiesV6(value.currentScene.entities)
        }
      : null;

    return {
      ...value,
      schemaVersion: 6,
      presets: Array.isArray(value.presets) ? value.presets : [],
      scenes,
      currentScene
    };
  }
  return value;
}
