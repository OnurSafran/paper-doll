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
  isStageWidth,
  isStaticPose,
  LIMITS,
  STAGE_WIDTHS
} from './vocabulary.js';

export const STAGE_WIDTH = LIMITS.STAGE_WIDTH;
export const STAGE_HEIGHT = LIMITS.STAGE_HEIGHT;
export const MIN_SCALE = LIMITS.MIN_SCALE;
export const MAX_SCALE = LIMITS.MAX_SCALE;
export const MAX_ENTITIES = LIMITS.MAX_ENTITIES;

export const CHARACTER_BASE_WIDTH = CHARACTER_DIMENSIONS.BASE_WIDTH;
export const CHARACTER_BASE_HEIGHT = CHARACTER_DIMENSIONS.BASE_HEIGHT;
export const CHARACTER_GROUND_ANCHOR = CHARACTER_DIMENSIONS.GROUND_ANCHOR;

export function getEntityBounds(entity, getAsset = () => undefined) {
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
  return clampPoint(x, y, bounds, stageWidth);
}

export function clampScale(scale) {
  return Math.round(clamp(Number(scale), MIN_SCALE, MAX_SCALE) * 100) / 100;
}

export function addEntity(scene, entity, getAsset = () => undefined) {
  if (scene.entities.length >= MAX_ENTITIES || scene.entities.some((item) => item.instanceId === entity.instanceId)) return scene;
  const bounds = getEntityBounds(entity, getAsset);
  const stageWidth = scene?.stageWidth || STAGE_WIDTH;
  const point = clampPoint(entity.x ?? stageWidth / 2, entity.y ?? 720, bounds, stageWidth);
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
  return touchScene({ ...scene, entities: [...scene.entities, next] });
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
    if (pinned) {
      return { ...entity, pinned: true, attachedTo: null, attachOffset: null };
    }
    return { ...entity, pinned: false };
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

export function attachEntity(scene, childInstanceId, parentInstanceId, getAsset = () => undefined) {
  const child = scene.entities.find((e) => e.instanceId === childInstanceId);
  const parent = scene.entities.find((e) => e.instanceId === parentInstanceId);
  if (!child || !parent || child.pinned || childInstanceId === parentInstanceId) return scene;

  const descendantsOfChild = getAttachedDescendants(scene, childInstanceId);
  if (descendantsOfChild.some((d) => d.instanceId === parentInstanceId)) {
    return scene;
  }

  const offset = { dx: Math.round(child.x - parent.x), dy: Math.round(child.y - parent.y) };
  return updateEntity(scene, childInstanceId, (entity) => ({
    ...entity,
    attachedTo: parentInstanceId,
    attachOffset: offset
  }));
}

export function detachEntity(scene, childInstanceId) {
  return updateEntity(scene, childInstanceId, (entity) => {
    if (!entity.attachedTo) return entity;
    return { ...entity, attachedTo: null, attachOffset: null };
  });
}

export function getEntityAllowedRange(entity, getAsset = () => undefined, stageWidth = STAGE_WIDTH) {
  const currentStageWidth = Number(stageWidth) || STAGE_WIDTH;
  const bounds = getEntityBounds(entity, getAsset);
  const width = Math.max(0, Number(bounds.width) || 0);
  const height = Math.max(0, Number(bounds.height) || 0);
  const ax = Number.isFinite(bounds.anchorX) ? bounds.anchorX : 0.5;
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

export function getCompoundEntityRange(scene, instanceId, getAsset = () => undefined) {
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

export function clampCompoundEntityPoint(x, y, scene, instanceId, getAsset = () => undefined) {
  const range = getCompoundEntityRange(scene, instanceId, getAsset);
  return {
    x: Math.round(clamp(Number(x), range.minX, range.maxX)),
    y: Math.round(clamp(Number(y), range.minY, range.maxY))
  };
}

export function moveEntity(scene, instanceId, targetX, targetY, getAsset = () => undefined) {
  const root = scene.entities.find((e) => e.instanceId === instanceId);
  if (!root || root.pinned) return scene;

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

export function scaleEntity(scene, instanceId, scale, getAsset = () => undefined) {
  const nextScale = clampScale(scale);
  const target = scene.entities.find((e) => e.instanceId === instanceId);
  if (!target || target.pinned || target.scale === nextScale) return scene;

  const scaledEntity = { ...target, scale: nextScale };
  const bounds = getEntityBounds(scaledEntity, getAsset);
  const point = clampPoint(target.x, target.y, bounds, scene?.stageWidth || STAGE_WIDTH);
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

export function flipEntity(scene, instanceId) {
  return updateEntity(scene, instanceId, (entity) => {
    if (entity.pinned) return entity;
    return { ...entity, flipped: !entity.flipped };
  });
}

export function reorderEntity(scene, instanceId, direction) {
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

export function deleteEntity(scene, instanceId) {
  const entities = scene.entities
    .filter((entity) => entity.instanceId !== instanceId)
    .map((entity) => {
      // Detach children when their parent is deleted
      if (entity.attachedTo === instanceId) {
        return { ...entity, attachedTo: null, attachOffset: null };
      }
      return entity;
    });

  if (entities.length === scene.entities.length) return scene;
  return touchScene({
    ...scene,
    entities: entities
      .sort((a, b) => a.order - b.order)
      .map((entity, index) => ({ ...entity, order: index + 1 }))
  });
}

export function duplicateEntity(scene, instanceId, newInstanceId, getAsset = () => undefined) {
  const source = scene.entities.find((entity) => entity.instanceId === instanceId);
  if (!source || scene.entities.length >= MAX_ENTITIES) return scene;
  const duplicate = {
    ...source,
    instanceId: newInstanceId,
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

export function getEntityVisualBox(entity, getAsset = () => undefined) {
  const bounds = getEntityBounds(entity, getAsset);
  const left = entity.x - bounds.width * bounds.anchorX;
  const right = entity.x + bounds.width * (1 - bounds.anchorX);
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
    anchorX: bounds.anchorX,
    anchorY: bounds.anchorY
  };
}

export function alignEntities(scene, instanceIds, alignmentMode, getAsset = () => undefined) {
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
  }
  return current;
}

export function moveEntities(scene, moves, getAsset = () => undefined) {
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
  for (const move of rootsToMove) {
    if (move?.instanceId && Number.isFinite(move.x) && Number.isFinite(move.y)) {
      current = moveEntity(current, move.instanceId, move.x, move.y, getAsset);
    }
  }
  return current;
}

export function scaleEntities(scene, instanceIds, delta, getAsset = () => undefined) {
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

export function flipEntities(scene, instanceIds) {
  if (!Array.isArray(instanceIds) || instanceIds.length === 0) return scene;
  const idSet = new Set(instanceIds);
  let changed = false;
  const nextEntities = scene.entities.map((e) => {
    if (idSet.has(e.instanceId) && !e.pinned) {
      changed = true;
      return { ...e, flipped: !e.flipped };
    }
    return e;
  });
  return changed ? touchScene({ ...scene, entities: nextEntities }) : scene;
}

export function deleteEntities(scene, instanceIds) {
  if (!Array.isArray(instanceIds) || instanceIds.length === 0) return scene;
  const idSet = new Set(instanceIds);
  const remaining = scene.entities
    .filter((e) => !idSet.has(e.instanceId))
    .map((e) => {
      if (e.attachedTo && idSet.has(e.attachedTo)) {
        return { ...e, attachedTo: null, attachOffset: null };
      }
      return e;
    });
  if (remaining.length === scene.entities.length) return scene;
  return touchScene({
    ...scene,
    entities: remaining
      .sort((a, b) => a.order - b.order)
      .map((e, index) => ({ ...e, order: index + 1 }))
  });
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

export function reclampSceneEntities(scene, targetStageWidth = STAGE_WIDTH, getAsset = () => undefined) {
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
