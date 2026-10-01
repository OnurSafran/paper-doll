import { placeEntity, recoverSurfacePlacements, getPlacementTargets, sameTarget, legalContactPolygon } from './scene-placement.js';
import { nearestPoint } from './placement-geometry.js';
import {
  CAMERA_CONSTANTS,
  CHARACTER_DIMENSIONS,
  DEFAULT_BACKGROUND_ID,
  DEFAULT_BUBBLE_STYLE,
  DEFAULT_BUBBLE_TEXT,
  DEFAULT_EXPRESSION,
  DEFAULT_EXPRESSION_INTENSITY,
  DEFAULT_MOTION_CLIP_ID,
  DEFAULT_MOTION_INTENSITY,
  DEFAULT_PHASE_OFFSET,
  DEFAULT_SCENE_ANIMATION_SETTINGS,
  DEFAULT_STAGE_WIDTH,
  DEFAULT_STATIC_POSE,
  defaultMakeId,
  defaultNow,
  isAlignmentMode,
  isBubbleStyle,
  isExpression,
  isExpressionIntensity,
  isMotionClipId,
  isMotionIntensity,
  isPhaseOffset,
  isStaticPose,
  LIMITS
} from './vocabulary.js';

export const STAGE_WIDTH = LIMITS.STAGE_WIDTH;
export const STAGE_HEIGHT = LIMITS.STAGE_HEIGHT;
export const MIN_SCALE = LIMITS.MIN_SCALE;
export const MAX_SCALE = LIMITS.MAX_SCALE;
export const MAX_ENTITIES = LIMITS.MAX_ENTITIES;

export const CHARACTER_BASE_WIDTH = CHARACTER_DIMENSIONS.BASE_WIDTH;
export const CHARACTER_BASE_HEIGHT = CHARACTER_DIMENSIONS.BASE_HEIGHT;
export const CHARACTER_GROUND_ANCHOR = CHARACTER_DIMENSIONS.GROUND_ANCHOR;

// Bounded per-instance cache survives immutable position updates during dragging.
// Compare geometry inputs, not asset IDs: custom asset dimensions can change.
const entityBoundsCache = new Map();
const MAX_BOUNDS_CACHE_ENTRIES = 256;

export function getEntityBounds(entity, getAsset = (_id) => undefined) {
  const asset = entity?.kind === 'character' || entity?.kind === 'bubble'
    ? undefined : (typeof getAsset === 'function' ? getAsset(entity?.sourceId) : undefined);
  const inputs = [entity?.kind, entity?.scale, entity?.width,
    typeof entity?.text === 'string' ? entity.text.length : 10, entity?.bubbleStyle,
    asset?.displayWidth, asset?.displayHeight, asset?.groundAnchor?.x, asset?.groundAnchor?.y];
  const key = entity?.instanceId ?? entity;
  const cached = entityBoundsCache.get(key);
  if (cached && inputs.every((value, index) => Object.is(value, cached.inputs[index]))) {
    return { ...cached.bounds };
  }
  const bounds = calculateEntityBounds(entity, () => asset);
  if (entityBoundsCache.size >= MAX_BOUNDS_CACHE_ENTRIES) {
    entityBoundsCache.delete(entityBoundsCache.keys().next().value);
  }
  entityBoundsCache.set(key, { inputs, bounds });
  return { ...bounds };
}

function calculateEntityBounds(entity, getAsset) {
  const scale = clampScale(entity?.scale ?? 1);
  if (entity?.kind === 'character') {
    return {
      width: CHARACTER_BASE_WIDTH * scale,
      height: CHARACTER_BASE_HEIGHT * scale,
      anchorX: CHARACTER_GROUND_ANCHOR.x,
      anchorY: CHARACTER_GROUND_ANCHOR.y
    };
  }
  if (entity?.kind === 'bubble') {
    const bubbleWidth = Number(entity?.width) || LIMITS.DEFAULT_BUBBLE_WIDTH;
    const textLen = typeof entity?.text === 'string' ? entity.text.length : 10;
    const charsPerLine = Math.max(12, Math.floor(bubbleWidth / 11));
    const lines = Math.max(1, Math.ceil(textLen / charsPerLine));
    const baseHeight = Math.max(70, 36 + lines * 22 + (entity?.bubbleStyle === 'caption' ? 14 : 26));
    return {
      width: bubbleWidth * scale,
      height: baseHeight * scale,
      anchorX: 0.5,
      anchorY: 1.0
    };
  }
  const asset = typeof getAsset === 'function' ? getAsset(entity?.sourceId) : undefined;
  const displayWidth = asset?.displayWidth ?? 200;
  const displayHeight = asset?.displayHeight ?? 200;
  const anchorX = asset?.groundAnchor?.x ?? 0.5;
  const anchorY = asset?.groundAnchor?.y ?? 1.0;

  return {
    width: displayWidth * scale,
    height: displayHeight * scale,
    anchorX,
    anchorY
  };
}

export function createEmptyScene(id = defaultMakeId(), now = defaultNow) {
  return {
    sceneId: id,
    title: 'Current Scene',
    backgroundId: DEFAULT_BACKGROUND_ID,
    stageWidth: DEFAULT_STAGE_WIDTH,
    cameraX: CAMERA_CONSTANTS.DEFAULT_CAMERA_X,
    animationSettings: { ...DEFAULT_SCENE_ANIMATION_SETTINGS },
    updatedAt: now().toISOString(),
    entities: []
  };
}

export function createSampleScene(characterSnapshot, now = defaultNow) {
  return {
    sceneId: 'sample-scene',
    title: 'Welcome Scene',
    backgroundId: DEFAULT_BACKGROUND_ID,
    stageWidth: DEFAULT_STAGE_WIDTH,
    cameraX: CAMERA_CONSTANTS.DEFAULT_CAMERA_X,
    animationSettings: { ...DEFAULT_SCENE_ANIMATION_SETTINGS },
    updatedAt: now().toISOString(),
    entities: [
      {
        instanceId: 'sample-emma',
        kind: 'character',
        sourceId: 'demo_emma',
        characterSnapshot,
        x: 720,
        y: 750,
        scale: 1,
        flipped: false,
        expression: DEFAULT_EXPRESSION,
        expressionIntensity: DEFAULT_EXPRESSION_INTENSITY,
        pose: DEFAULT_STATIC_POSE,
        animation: {
          clipId: DEFAULT_MOTION_CLIP_ID,
          enabled: false,
          intensity: DEFAULT_MOTION_INTENSITY,
          phaseOffset: DEFAULT_PHASE_OFFSET
        },
        order: 2
      },
      {
        instanceId: 'sample-chair', kind: 'prop', sourceId: 'prop_chair',
        x: 1040, y: 770, scale: 1.1, flipped: false, order: 1
      },
      {
        instanceId: 'sample-plant', kind: 'prop', sourceId: 'prop_plant',
        x: 1280, y: 760, scale: 0.9, flipped: false, order: 3
      }
    ]
  };
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

/** @param {number} x
 * @param {number} y
 * @param {Object} bounds
 * @param {number} stageWidth */
export function clampPoint(x, y, bounds = null, stageWidth = STAGE_WIDTH) {
  const currentStageWidth = Number(stageWidth) || STAGE_WIDTH;
  if (!bounds) {
    return {
      x: Math.round(clamp(Number(x), 30, currentStageWidth - 30)),
      y: Math.round(clamp(Number(y), 80, STAGE_HEIGHT - 10))
    };
  }

  const width = Math.max(0, Number(bounds.width) || 0);
  const height = Math.max(0, Number(bounds.height) || 0);
  const ax = Number.isFinite(bounds.anchorX) ? bounds.anchorX : 0.5;
  const ay = Number.isFinite(bounds.anchorY) ? bounds.anchorY : 1.0;

  const minX = Math.round(width * ax);
  const maxX = Math.round(currentStageWidth - width * (1 - ax));
  const minY = Math.round(height * ay);
  const maxY = Math.round(STAGE_HEIGHT - height * (1 - ay));

  const safeMinX = minX <= maxX ? minX : Math.round(currentStageWidth / 2);
  const safeMaxX = minX <= maxX ? maxX : Math.round(currentStageWidth / 2);
  const safeMinY = minY <= maxY ? minY : Math.round(STAGE_HEIGHT / 2);
  const safeMaxY = minY <= maxY ? maxY : Math.round(STAGE_HEIGHT / 2);

  return {
    x: Math.round(clamp(Number(x), safeMinX, safeMaxX)),
    y: Math.round(clamp(Number(y), safeMinY, safeMaxY))
  };
}

export function clampEntityPoint(x, y, entity, getAsset, stageWidth = STAGE_WIDTH) {
  const bounds = getEntityBounds(entity, getAsset);
  return clampPoint(x, y, { ...bounds, anchorX: entity.flipped ? 1 - bounds.anchorX : bounds.anchorX }, stageWidth);
}

export function clampScale(scale) {
  return Math.round(clamp(Number(scale), MIN_SCALE, MAX_SCALE) * 100) / 100;
}

export function addEntity(scene, entity, getAsset = (_id) => undefined) {
  if (scene.entities.length >= MAX_ENTITIES || scene.entities.some((item) => item.instanceId === entity.instanceId)) return scene;
  const stageWidth = scene?.stageWidth || STAGE_WIDTH;
  const point = clampEntityPoint(entity.x ?? stageWidth / 2, entity.y ?? 720, entity, getAsset, stageWidth);
  const parent = entity.attachedTo ? scene.entities.find((e) => e.instanceId === entity.attachedTo) : null;
  const attachOffset = parent
    ? { dx: Math.round(point.x - parent.x), dy: Math.round(point.y - parent.y) }
    : (entity.attachOffset ? { ...entity.attachOffset } : null);

  const next = {
    ...entity,
    ...(entity.kind === 'character' ? {
      expression: isExpression(entity.expression) ? entity.expression : DEFAULT_EXPRESSION,
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
    } : {}),
    ...(entity.kind === 'bubble' ? {
      text: entity.text || DEFAULT_BUBBLE_TEXT,
      bubbleStyle: isBubbleStyle(entity.bubbleStyle) ? entity.bubbleStyle : DEFAULT_BUBBLE_STYLE,
      width: Number(entity.width) || LIMITS.DEFAULT_BUBBLE_WIDTH
    } : {}),
    ...point,
    scale: clampScale(entity.scale ?? 1),
    flipped: Boolean(entity.flipped),
    pinned: Boolean(entity.pinned),
    attachedTo: parent ? parent.instanceId : (entity.attachedTo ?? null),
    attachOffset,
    order: scene.entities.length + 1
  };
  let result = { ...scene, entities: [...scene.entities, next] };
  if (scene.placementMode === 'room' && !next.attachedTo && next.kind !== 'bubble') {
    const placed = placeEntity(result, next.instanceId, next, getAsset);
    result = placed === result ? { ...result, entities: result.entities.map(e => e === next ? { ...e, placement: { kind: 'free', reason: 'no-valid-target' } } : e) } : placed;
  }
  return touchScene(result);
}

export function updateEntity(scene, instanceId, updater) {
  let changed = false;
  const entities = scene.entities.map((entity) => {
    if (entity.instanceId !== instanceId) return entity;
    const next = updater(entity);
    if (next !== entity) changed = true;
    return next;
  });
  return changed ? touchScene({ ...scene, entities }) : scene;
}

export function setEntityPinned(scene, instanceId, pinned) {
  return updateEntity(scene, instanceId, (entity) => {
    if (Boolean(entity.pinned) === Boolean(pinned)) return entity;
    if (pinned && entity.placement?.kind !== 'surface') {
      return { ...entity, pinned: true, attachedTo: null, attachOffset: null };
    }
    return { ...entity, pinned: Boolean(pinned) };
  });
}

export function getAttachedDescendants(scene, parentInstanceId) {
  const descendants = [];
  const queue = [parentInstanceId];
  while (queue.length > 0) {
    const currentId = queue.shift();
    const children = scene.entities.filter((e) => e.attachedTo === currentId);
    for (const child of children) {
      descendants.push(child);
      queue.push(child.instanceId);
    }
  }
  return descendants;
}

export function attachEntity(scene, childInstanceId, parentInstanceId, _getAsset = (_id) => undefined) {
  const child = scene.entities.find((e) => e.instanceId === childInstanceId);
  const parent = scene.entities.find((e) => e.instanceId === parentInstanceId);
  if (!child || !parent || child.pinned || childInstanceId === parentInstanceId) return scene;

  const descendantsOfChild = getAttachedDescendants(scene, childInstanceId);
  if (descendantsOfChild.some(e => e.placement?.kind === 'surface')) return scene;
  if (descendantsOfChild.some((d) => d.instanceId === parentInstanceId)) {
    return scene;
  }

  const offset = { dx: Math.round(child.x - parent.x), dy: Math.round(child.y - parent.y) };
  return updateEntity(scene, childInstanceId, (entity) => ({
    ...entity,
    ...(entity.placement?.kind === 'surface' ? { placement: { kind: 'free', reason: 'legacy' } } : {}),
    attachedTo: parentInstanceId,
    attachOffset: offset
  }));
}

export function detachEntity(scene, childInstanceId) {
  return updateEntity(scene, childInstanceId, (entity) => {
    if (!entity.attachedTo) return entity;
    return { ...entity, ...(entity.placement?.kind === 'surface' ? { placement: { kind: 'free', reason: 'support-missing' } } : {}), attachedTo: null, attachOffset: null };
  });
}

export function getEntityAllowedRange(entity, getAsset = (_id) => undefined, stageWidth = STAGE_WIDTH) {
  const currentStageWidth = Number(stageWidth) || STAGE_WIDTH;
  const bounds = getEntityBounds(entity, getAsset);
  const width = Math.max(0, Number(bounds.width) || 0);
  const height = Math.max(0, Number(bounds.height) || 0);
  const originalAnchorX = Number.isFinite(bounds.anchorX) ? bounds.anchorX : 0.5;
  const ax = entity.flipped ? 1 - originalAnchorX : originalAnchorX;
  const ay = Number.isFinite(bounds.anchorY) ? bounds.anchorY : 1.0;

  const minX = Math.round(width * ax);
  const maxX = Math.round(currentStageWidth - width * (1 - ax));
  const minY = Math.round(height * ay);
  const maxY = Math.round(STAGE_HEIGHT - height * (1 - ay));

  return {
    minX: minX <= maxX ? minX : Math.round(currentStageWidth / 2),
    maxX: minX <= maxX ? maxX : Math.round(currentStageWidth / 2),
    minY: minY <= maxY ? minY : Math.round(STAGE_HEIGHT / 2),
    maxY: minY <= maxY ? maxY : Math.round(STAGE_HEIGHT / 2)
  };
}

export function getCompoundEntityRange(scene, instanceId, getAsset = (_id) => undefined) {
  const stageWidth = scene?.stageWidth || STAGE_WIDTH;
  const root = scene?.entities?.find((e) => e.instanceId === instanceId);
  if (!root) return { minX: 0, maxX: stageWidth, minY: 0, maxY: STAGE_HEIGHT };
  const descendants = getAttachedDescendants(scene, instanceId);
  if (descendants.length === 0) {
    return getEntityAllowedRange(root, getAsset, stageWidth);
  }
  let compoundMinX = -Infinity;
  let compoundMaxX = Infinity;
  let compoundMinY = -Infinity;
  let compoundMaxY = Infinity;

  const group = [root, ...descendants];
  for (const entity of group) {
    const relX = entity.x - root.x;
    const relY = entity.y - root.y;
    const range = getEntityAllowedRange(entity, getAsset, stageWidth);

    compoundMinX = Math.max(compoundMinX, range.minX - relX);
    compoundMaxX = Math.min(compoundMaxX, range.maxX - relX);
    compoundMinY = Math.max(compoundMinY, range.minY - relY);
    compoundMaxY = Math.min(compoundMaxY, range.maxY - relY);
  }

  const safeMinX = compoundMinX <= compoundMaxX ? compoundMinX : Math.round((compoundMinX + compoundMaxX) / 2);
  const safeMaxX = compoundMinX <= compoundMaxX ? compoundMaxX : safeMinX;
  const safeMinY = compoundMinY <= compoundMaxY ? compoundMinY : Math.round((compoundMinY + compoundMaxY) / 2);
  const safeMaxY = compoundMinY <= compoundMaxY ? compoundMaxY : safeMinY;

  return { minX: safeMinX, maxX: safeMaxX, minY: safeMinY, maxY: safeMaxY };
}

export function clampCompoundEntityPoint(x, y, scene, instanceId, getAsset = (_id) => undefined) {
  const range = getCompoundEntityRange(scene, instanceId, getAsset);
  return {
    x: Math.round(clamp(Number(x), range.minX, range.maxX)),
    y: Math.round(clamp(Number(y), range.minY, range.maxY))
  };
}

export function moveEntity(scene, instanceId, targetX, targetY, getAsset = (_id) => undefined) {
  const root = scene.entities.find((e) => e.instanceId === instanceId);
  if (!root || root.pinned) return scene;

  if ((scene.placementMode === 'room' && root.placement?.kind !== 'free' && !root.attachedTo && root.kind !== 'bubble') || root.placement?.kind === 'surface') return placeEntity(scene, instanceId, { x: targetX, y: targetY }, getAsset);
  const descendants = getAttachedDescendants(scene, instanceId);

  // If root has attached descendants, perform compound boundary clamping and move the entire tree
  if (descendants.length > 0) {
    const range = getCompoundEntityRange(scene, instanceId, getAsset);
    const clampedRootX = Math.round(clamp(Number(targetX), range.minX, range.maxX));
    const clampedRootY = Math.round(clamp(Number(targetY), range.minY, range.maxY));

    const deltaX = clampedRootX - root.x;
    const deltaY = clampedRootY - root.y;
    if (deltaX === 0 && deltaY === 0) return scene;

    const parent = root.attachedTo ? scene.entities.find((e) => e.instanceId === root.attachedTo) : null;
    const nextAttachOffset = parent
      ? { dx: Math.round(clampedRootX - parent.x), dy: Math.round(clampedRootY - parent.y) }
      : root.attachOffset;

    const descendantIds = new Set(descendants.map((d) => d.instanceId));
    const nextEntities = scene.entities.map((entity) => {
      if (entity.instanceId === instanceId) {
        return { ...entity, x: clampedRootX, y: clampedRootY, attachOffset: nextAttachOffset };
      }
      if (descendantIds.has(entity.instanceId)) {
        return { ...entity, x: entity.x + deltaX, y: entity.y + deltaY };
      }
      return entity;
    });

    return touchScene({ ...scene, entities: nextEntities });
  }

  // Single entity move
  const range = getEntityAllowedRange(root, getAsset, scene?.stageWidth || STAGE_WIDTH);
  const clampedX = Math.round(clamp(Number(targetX), range.minX, range.maxX));
  const clampedY = Math.round(clamp(Number(targetY), range.minY, range.maxY));

  if (root.x === clampedX && root.y === clampedY) return scene;

  // If this entity is an attached child, update its attachOffset relative to its parent
  const parent = root.attachedTo ? scene.entities.find((e) => e.instanceId === root.attachedTo) : null;
  const nextAttachOffset = parent
    ? { dx: Math.round(clampedX - parent.x), dy: Math.round(clampedY - parent.y) }
    : root.attachOffset;

  return updateEntity(scene, instanceId, (entity) => ({
    ...entity,
    x: clampedX,
    y: clampedY,
    attachOffset: nextAttachOffset
  }));
}

export function scaleEntity(scene, instanceId, scale, getAsset = (_id) => undefined) {
  const nextScale = clampScale(scale);
  const target = scene.entities.find((e) => e.instanceId === instanceId);
  if (!target || target.pinned || target.scale === nextScale) return scene;

  if (target.placement?.kind === 'surface' || getAttachedDescendants(scene, instanceId).some(e => e.placement?.kind === 'surface') || (scene.placementMode === 'room' && target.placement && target.placement.kind !== 'free')) return transformPlacedEntity(scene, instanceId, { scale: nextScale }, getAsset);
  const scaledEntity = { ...target, scale: nextScale };
  const point = clampEntityPoint(target.x, target.y, scaledEntity, getAsset, scene?.stageWidth || STAGE_WIDTH);
  const deltaX = point.x - target.x;
  const deltaY = point.y - target.y;

  const parent = target.attachedTo ? scene.entities.find((e) => e.instanceId === target.attachedTo) : null;
  const nextAttachOffset = parent
    ? { dx: Math.round(point.x - parent.x), dy: Math.round(point.y - parent.y) }
    : target.attachOffset;

  const descendants = (deltaX !== 0 || deltaY !== 0) ? getAttachedDescendants(scene, instanceId) : [];
  const descendantIds = new Set(descendants.map((d) => d.instanceId));

  const nextEntities = scene.entities.map((entity) => {
    if (entity.instanceId === instanceId) {
      return { ...scaledEntity, ...point, attachOffset: nextAttachOffset };
    }
    if (descendantIds.has(entity.instanceId)) {
      return { ...entity, x: entity.x + deltaX, y: entity.y + deltaY };
    }
    return entity;
  });

  return touchScene({ ...scene, entities: nextEntities });
}

export function flipEntity(scene, instanceId, getAsset = (_id) => undefined) {
  const target = scene.entities.find(e => e.instanceId === instanceId);
  if (!target) return scene;
  return transformPlacedEntity(scene, instanceId, { flipped: !target.flipped }, getAsset);
}

export function reorderEntity(scene, instanceId, direction) {
  if (scene.placementMode === 'room') return scene;
  const ordered = [...scene.entities].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((entity) => entity.instanceId === instanceId);
  const target = clamp(index + Math.sign(direction), 0, ordered.length - 1);
  if (index < 0 || target === index) return scene;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  const orderMap = new Map(ordered.map((entity, position) => [entity.instanceId, position + 1]));
  return touchScene({
    ...scene,
    entities: scene.entities.map((entity) => ({ ...entity, order: orderMap.get(entity.instanceId) }))
  });
}

export function deleteEntity(scene, instanceId, getAsset = (_id) => undefined) {
  const entities = scene.entities
    .filter((entity) => entity.instanceId !== instanceId)
    .map((entity) => {
      // Detach children when their parent is deleted
      if (entity.attachedTo === instanceId) {
        return { ...entity, ...(entity.placement?.kind === 'surface' ? { placement: { kind: 'free', reason: 'support-missing' } } : {}), attachedTo: null, attachOffset: null };
      }
      return entity;
    });

  if (entities.length === scene.entities.length) return scene;
  const result = touchScene({
    ...scene,
    entities: entities
      .sort((a, b) => a.order - b.order)
      .map((entity, index) => ({ ...entity, order: index + 1 }))
  });
  return recoverDeletedSupports(result, getAsset);
}

export function duplicateEntity(scene, instanceId, newInstanceId, getAsset = (_id) => undefined, makeId = defaultMakeId, withContents = false) {
  const source = scene.entities.find((entity) => entity.instanceId === instanceId);
  if (!source || scene.entities.length >= MAX_ENTITIES) return scene;
  const supported = scene.entities.filter(e => e.attachedTo === instanceId && e.placement?.kind === 'surface');
  if (supported.length && withContents) {
    const descendants = getAttachedDescendants(scene, instanceId);
    if (scene.entities.length + descendants.length + 1 > MAX_ENTITIES) return scene;
    const ids = new Map([[instanceId, newInstanceId]]), used = new Set(scene.entities.map(e => e.instanceId));
    if (!newInstanceId || used.has(newInstanceId)) return scene;
    used.add(newInstanceId);
    for (const e of descendants) { const id = makeId(); if (typeof id !== 'string' || !id || used.has(id)) return scene; ids.set(e.instanceId, id); used.add(id); }
    const copies = [source, ...descendants].map((e, index) => ({ ...e, instanceId: ids.get(e.instanceId), x: e.x + 55, y: e.y + 35, pinned: false, attachedTo: ids.get(e.attachedTo) || null, attachOffset: e.attachOffset ? { ...e.attachOffset } : null, placement: e.placement ? globalThis.structuredClone(e.placement) : undefined, order: scene.entities.length + index + 1 }));
    let proposal = { ...scene, entities: [...scene.entities, ...copies] };
    proposal = moveEntity(proposal, newInstanceId, copies[0].x, copies[0].y, getAsset);
    const recovered = recoverSurfacePlacements(proposal, getAsset);
    if (copies.some(e => e.placement?.kind === 'surface' && recovered.entities.find(r => r.instanceId === e.instanceId)?.placement?.kind !== 'surface')) return scene;
    return touchScene(recovered);
  }
  const duplicate = {
    ...source,
    instanceId: newInstanceId,
    placement: scene.placementMode === 'room' ? undefined : { kind: 'free', reason: 'legacy' },
    x: source.x + 55,
    y: source.y + 35,
    pinned: false,
    attachedTo: null,
    attachOffset: null,
    ...(source.characterSnapshot
      ? { characterSnapshot: {
          ...source.characterSnapshot,
          slots: Object.fromEntries(Object.entries(source.characterSnapshot.slots).map(([slot, value]) => [slot, value ? { ...value } : null]))
        } }
      : {})
  };
  if (source.placement?.kind === 'surface') {
    duplicate.order = scene.entities.length + 1;
    const proposal = { ...scene, entities: [...scene.entities, { ...duplicate, placement: globalThis.structuredClone(source.placement), attachedTo: source.attachedTo }] };
    const placed = placeEntity(proposal, newInstanceId, duplicate, getAsset, { target: { kind: 'surface', hostId: source.attachedTo, surfaceId: source.placement.surfaceId } });
    return placed === proposal ? scene : touchScene(placed);
  }
  return addEntity(scene, duplicate, getAsset);
}

export function setBubbleText(scene, instanceId, text) {
  const normalized = typeof text === 'string' ? text.trim().slice(0, LIMITS.MAX_BUBBLE_TEXT_LENGTH) : '';
  if (!normalized) return scene;
  return updateEntity(scene, instanceId, (entity) => {
    if (entity.kind !== 'bubble' || entity.text === normalized) return entity;
    return { ...entity, text: normalized };
  });
}

export function setBubbleStyle(scene, instanceId, bubbleStyle) {
  if (!isBubbleStyle(bubbleStyle)) return scene;
  return updateEntity(scene, instanceId, (entity) => {
    if (entity.kind !== 'bubble' || entity.bubbleStyle === bubbleStyle) return entity;
    return { ...entity, bubbleStyle };
  });
}

export function setBubbleWidth(scene, instanceId, width) {
  const clampedWidth = Math.round(clamp(Number(width) || LIMITS.DEFAULT_BUBBLE_WIDTH, LIMITS.MIN_BUBBLE_WIDTH, LIMITS.MAX_BUBBLE_WIDTH));
  return updateEntity(scene, instanceId, (entity) => {
    if (entity.kind !== 'bubble' || entity.width === clampedWidth) return entity;
    return { ...entity, width: clampedWidth };
  });
}

export function getEntityVisualBox(entity, getAsset = (_id) => undefined) {
  const bounds = getEntityBounds(entity, getAsset);
  const anchorX = entity.flipped ? 1 - bounds.anchorX : bounds.anchorX;
  const left = entity.x - bounds.width * anchorX;
  const right = entity.x + bounds.width * (1 - anchorX);
  const top = entity.y - bounds.height * bounds.anchorY;
  const bottom = entity.y + bounds.height * (1 - bounds.anchorY);
  return {
    left,
    right,
    top,
    bottom,
    width: bounds.width,
    height: bounds.height,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
    anchorX,
    anchorY: bounds.anchorY
  };
}

export function alignEntities(scene, instanceIds, alignmentMode, getAsset = (_id) => undefined) {
  const placementAware = scene.placementMode === 'room' || scene.entities.some(e => instanceIds.includes(e.instanceId) && e.placement?.kind === 'surface');
  if (placementAware) {
    const supports = scene.entities.filter(e => instanceIds.includes(e.instanceId)).map(e => JSON.stringify([e.placement?.kind, e.placement?.regionId, e.attachedTo, e.placement?.surfaceId]));
    if (new Set(supports).size > 1) return scene;
  }
  if (!isAlignmentMode(alignmentMode) || !Array.isArray(instanceIds) || instanceIds.length < 2) return scene;
  const idSet = new Set(instanceIds);
  const targets = scene.entities.filter((e) => idSet.has(e.instanceId) && !e.pinned);
  if (targets.length < 2) return scene;

  const boxes = targets.map((entity) => ({
    entity,
    box: getEntityVisualBox(entity, getAsset)
  }));

  const groupLeft = Math.min(...boxes.map((b) => b.box.left));
  const groupRight = Math.max(...boxes.map((b) => b.box.right));
  const groupTop = Math.min(...boxes.map((b) => b.box.top));
  const groupBottom = Math.max(...boxes.map((b) => b.box.bottom));
  const groupCenterX = (groupLeft + groupRight) / 2;
  const groupCenterY = (groupTop + groupBottom) / 2;

  let moves = [];

  if (alignmentMode === 'left') {
    moves = boxes.map(({ entity, box }) => ({
      instanceId: entity.instanceId,
      x: groupLeft + box.width * box.anchorX,
      y: entity.y
    }));
  } else if (alignmentMode === 'center') {
    moves = boxes.map(({ entity, box }) => ({
      instanceId: entity.instanceId,
      x: groupCenterX - box.width * (0.5 - box.anchorX),
      y: entity.y
    }));
  } else if (alignmentMode === 'right') {
    moves = boxes.map(({ entity, box }) => ({
      instanceId: entity.instanceId,
      x: groupRight - box.width * (1 - box.anchorX),
      y: entity.y
    }));
  } else if (alignmentMode === 'top') {
    moves = boxes.map(({ entity, box }) => ({
      instanceId: entity.instanceId,
      x: entity.x,
      y: groupTop + box.height * box.anchorY
    }));
  } else if (alignmentMode === 'middle') {
    moves = boxes.map(({ entity, box }) => ({
      instanceId: entity.instanceId,
      x: entity.x,
      y: groupCenterY - box.height * (0.5 - box.anchorY)
    }));
  } else if (alignmentMode === 'bottom') {
    moves = boxes.map(({ entity, box }) => ({
      instanceId: entity.instanceId,
      x: entity.x,
      y: groupBottom - box.height * (1 - box.anchorY)
    }));
  } else if (alignmentMode === 'distribute-h') {
    if (boxes.length < 3) return scene;
    const sorted = [...boxes].sort((a, b) => a.box.centerX - b.box.centerX);
    const minCenter = sorted[0].box.centerX;
    const maxCenter = sorted[sorted.length - 1].box.centerX;
    const span = maxCenter - minCenter;
    const step = span / (sorted.length - 1);
    moves = sorted.map(({ entity, box }, idx) => {
      if (idx === 0 || idx === sorted.length - 1) {
        return { instanceId: entity.instanceId, x: entity.x, y: entity.y };
      }
      const targetCenter = minCenter + idx * step;
      return {
        instanceId: entity.instanceId,
        x: targetCenter - box.width * (0.5 - box.anchorX),
        y: entity.y
      };
    });
  } else if (alignmentMode === 'distribute-v') {
    if (boxes.length < 3) return scene;
    const sorted = [...boxes].sort((a, b) => a.box.centerY - b.box.centerY);
    const minCenter = sorted[0].box.centerY;
    const maxCenter = sorted[sorted.length - 1].box.centerY;
    const span = maxCenter - minCenter;
    const step = span / (sorted.length - 1);
    moves = sorted.map(({ entity, box }, idx) => {
      if (idx === 0 || idx === sorted.length - 1) {
        return { instanceId: entity.instanceId, x: entity.x, y: entity.y };
      }
      const targetCenter = minCenter + idx * step;
      return {
        instanceId: entity.instanceId,
        x: entity.x,
        y: targetCenter - box.height * (0.5 - box.anchorY)
      };
    });
  }

  let current = scene;
  for (const move of moves) {
    current = moveEntity(current, move.instanceId, move.x, move.y, getAsset);
    const result = current.entities.find(e => e.instanceId === move.instanceId);
    if (placementAware && Math.hypot(result.x - move.x, result.y - move.y) > .01) return scene;
  }
  return current;
}

export function moveEntities(scene, moves, getAsset = (_id) => undefined) {
  if (!Array.isArray(moves) || moves.length === 0) return scene;
  const moveIds = new Set(moves.map((m) => m?.instanceId));
  const rootsToMove = moves.filter((m) => {
    const entity = scene.entities.find((e) => e.instanceId === m?.instanceId);
    if (!entity || !entity.attachedTo) return true;
    let curr = entity;
    while (curr?.attachedTo) {
      if (moveIds.has(curr.attachedTo)) return false;
      curr = scene.entities.find((e) => e.instanceId === curr.attachedTo);
    }
    return true;
  });

  let current = scene;
  const constrained = scene.placementMode === 'room' || rootsToMove.some(m => scene.entities.find(e => e.instanceId === m.instanceId)?.placement?.kind === 'surface');
  for (const move of rootsToMove) {
    if (move?.instanceId && Number.isFinite(move.x) && Number.isFinite(move.y)) {
      current = moveEntity(current, move.instanceId, move.x, move.y, getAsset);
      const moved = current.entities.find(e => e.instanceId === move.instanceId);
      if (constrained && moved && Math.hypot(moved.x - move.x, moved.y - move.y) > .01) return scene;
    }
  }
  return current;
}

export function scaleEntities(scene, instanceIds, delta, getAsset = (_id) => undefined) {
  if (!Array.isArray(instanceIds) || instanceIds.length === 0 || !Number.isFinite(delta)) return scene;
  let current = scene;
  for (const id of instanceIds) {
    const entity = current.entities.find((e) => e.instanceId === id);
    if (entity && !entity.pinned) {
      current = scaleEntity(current, id, entity.scale + delta, getAsset);
    }
  }
  return current;
}

export function flipEntities(scene, instanceIds, getAsset = (_id) => undefined) {
  if (!Array.isArray(instanceIds) || instanceIds.length === 0) return scene;
  return [...new Set(instanceIds)].reduce((next, id) => flipEntity(next, id, getAsset), scene);
}

export function deleteEntities(scene, instanceIds, getAsset = (_id) => undefined) {
  if (!Array.isArray(instanceIds) || instanceIds.length === 0) return scene;
  const idSet = new Set(instanceIds);
  const remaining = scene.entities
    .filter((e) => !idSet.has(e.instanceId))
    .map((e) => {
      if (e.attachedTo && idSet.has(e.attachedTo)) {
        return { ...e, ...(e.placement?.kind === 'surface' ? { placement: { kind: 'free', reason: 'support-missing' } } : {}), attachedTo: null, attachOffset: null };
      }
      return e;
    });
  if (remaining.length === scene.entities.length) return scene;
  return recoverDeletedSupports(touchScene({
    ...scene,
    entities: remaining
      .sort((a, b) => a.order - b.order)
      .map((e, index) => ({ ...e, order: index + 1 }))
  }), getAsset);
}

export function togglePinEntities(scene, instanceIds, forcedPinned = null) {
  if (!Array.isArray(instanceIds) || instanceIds.length === 0) return scene;
  const idSet = new Set(instanceIds);
  const targets = scene.entities.filter((e) => idSet.has(e.instanceId));
  if (targets.length === 0) return scene;
  const allPinned = forcedPinned !== null
    ? forcedPinned
    : targets.every((e) => e.pinned);
  const nextPinned = forcedPinned !== null ? forcedPinned : !allPinned;
  let current = scene;
  for (const id of instanceIds) {
    current = setEntityPinned(current, id, nextPinned);
  }
  return current;
}

/** @param {Object} scene
 * @param {number} targetStageWidth
 * @param {(id: string) => any} getAsset */
export function reclampSceneEntities(scene, targetStageWidth = STAGE_WIDTH, getAsset = (_id) => undefined) {
  if (!scene || !Array.isArray(scene.entities)) return scene;
  let nextScene = { ...scene, stageWidth: targetStageWidth };
  for (const entity of nextScene.entities) {
    if (!entity.attachedTo) {
      nextScene = entity.pinned
        ? reclampPinnedEntityTree(nextScene, entity.instanceId, getAsset)
        : moveEntity(nextScene, entity.instanceId, entity.x, entity.y, getAsset);
    }
  }
  return nextScene;
}

function reclampPinnedEntityTree(scene, instanceId, getAsset) {
  const root = scene.entities.find((entity) => entity.instanceId === instanceId);
  if (!root) return scene;
  const descendants = getAttachedDescendants(scene, instanceId);
  const range = getCompoundEntityRange(scene, instanceId, getAsset);
  const clampedRootX = Math.round(clamp(root.x, range.minX, range.maxX));
  const clampedRootY = Math.round(clamp(root.y, range.minY, range.maxY));
  const deltaX = clampedRootX - root.x;
  const deltaY = clampedRootY - root.y;
  if (deltaX === 0 && deltaY === 0) return scene;

  const descendantIds = new Set(descendants.map((entity) => entity.instanceId));
  return touchScene({
    ...scene,
    entities: scene.entities.map((entity) => {
      if (entity.instanceId === instanceId) return { ...entity, x: clampedRootX, y: clampedRootY };
      if (descendantIds.has(entity.instanceId)) return { ...entity, x: entity.x + deltaX, y: entity.y + deltaY };
      return entity;
    })
  });
}

export function touchScene(scene, now = defaultNow) {
  return { ...scene, updatedAt: now().toISOString() };
}

function transformPlacedEntity(scene, instanceId, changes, getAsset) {
  const target = scene.entities.find(e => e.instanceId === instanceId);
  if (!target || target.pinned) return scene;
  const proposal = { ...scene, entities: scene.entities.map(e => e === target ? { ...e, ...changes } : e) };
  const affected = new Set([instanceId, ...getAttachedDescendants(scene, instanceId).map(e => e.instanceId)]);
  const next = recoverSurfacePlacements(proposal, getAsset, [], affected);
  // A transform is atomic: never detach a child or push an assembly outside its target.
  for (const e of next.entities) {
    if (!affected.has(e.instanceId)) continue;
    // Stage bounds still apply when floor/wall constraints are relaxed.
    const bounds = getEntityBounds(e, getAsset);
    const anchorX = e.flipped ? 1 - bounds.anchorX : bounds.anchorX;
    if (e.x - bounds.width * anchorX < -.01 ||
        e.x + bounds.width * (1 - anchorX) > (scene.stageWidth || STAGE_WIDTH) + .01 ||
        e.y - bounds.height * bounds.anchorY < -.01 ||
        e.y + bounds.height * (1 - bounds.anchorY) > STAGE_HEIGHT + .01) return scene;
    const before = scene.entities.find(old => old.instanceId === e.instanceId);
    if (before.placement && before.placement.kind !== 'free' && e.placement?.kind !== before.placement.kind) return scene;
    if (e.placement?.kind === 'surface' || (scene.placementMode === 'room' && ['floor', 'wall'].includes(e.placement?.kind))) {
      const t = getPlacementTargets(next, e, getAsset).find(t => sameTarget(e, t));
      const p = t && nearestPoint(legalContactPolygon(next, e, t, getAsset), e);
      if (!p || Math.hypot(p.x - e.x, p.y - e.y) > .01) return scene;
    }
  }
  return touchScene(next);
}

function recoverDeletedSupports(scene, getAsset) {
  let next = scene;
  for (const e of scene.entities) {
    if (e.placement?.reason !== 'support-missing' || e.pinned) continue;
    next = placeEntity(next, e.instanceId, e, getAsset);
  }
  return next;
}
