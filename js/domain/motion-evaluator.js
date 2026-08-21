/**
 * Pure Motion and Pose Evaluator
 * High-performance, zero-dependency keyframe interpolation and composite character pose evaluation.
 */

import {
  getMotionClip,
  getStaticPoseTransform,
  resolveMotionProfile,
  resolveSafeClipId,
  resolveSafePoseId
} from './animation-clips.js';
import { hasRigidWearableForLimb } from '../core/asset-catalog.js';
import {
  CHARACTER_DIMENSIONS,
  DEFAULT_ATTACH_JOINT,
  DEFAULT_EXPRESSION,
  DEFAULT_EXPRESSION_INTENSITY,
  DEFAULT_MOTION_CLIP_ID,
  DEFAULT_MOTION_INTENSITY,
  DEFAULT_PHASE_OFFSET,
  DEFAULT_STATIC_POSE
} from './vocabulary.js';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Smooth cosine interpolation between two values (ease-in-out).
 */
export function smoothCosine(t) {
  return (1 - Math.cos(clamp(t, 0, 1) * Math.PI)) / 2;
}

function stringHash(str) {
  let hash = 0;
  if (!str) return hash;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Evaluates a numeric property from sorted keyframes at normalized time [0, 1].
 */
export function interpolateKeyframes(keyframes, normalizedTime, property, defaultValue = 0) {
  if (!Array.isArray(keyframes) || keyframes.length === 0) {
    return defaultValue;
  }
  if (keyframes.length === 1) {
    return keyframes[0][property] ?? defaultValue;
  }

  const t = clamp(Number.isFinite(normalizedTime) ? normalizedTime : 0, 0, 1);

  if (t <= keyframes[0].at) {
    return keyframes[0][property] ?? defaultValue;
  }
  const lastIndex = keyframes.length - 1;
  if (t >= keyframes[lastIndex].at) {
    return keyframes[lastIndex][property] ?? defaultValue;
  }

  // Fast linear scan across small keyframe lists
  for (let i = 0; i < lastIndex; i += 1) {
    const k0 = keyframes[i];
    const k1 = keyframes[i + 1];
    if (t >= k0.at && t <= k1.at) {
      const span = k1.at - k0.at;
      if (span <= 0) return k1[property] ?? defaultValue;
      const progress = (t - k0.at) / span;
      const eased = smoothCosine(progress);
      const v0 = k0[property] ?? defaultValue;
      const v1 = k1[property] ?? defaultValue;
      return v0 + (v1 - v0) * eased;
    }
  }

  return keyframes[lastIndex][property] ?? defaultValue;
}

function evaluateTransformChannel(frames, normalizedTime, intensity = 1) {
  if (!frames || frames.length === 0) {
    return { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 };
  }
  const rawX = interpolateKeyframes(frames, normalizedTime, 'x', 0);
  const rawY = interpolateKeyframes(frames, normalizedTime, 'y', 0);
  const rawRot = interpolateKeyframes(frames, normalizedTime, 'rotate', 0);
  const rawScaleX = interpolateKeyframes(frames, normalizedTime, 'scaleX', 1);
  const rawScaleY = interpolateKeyframes(frames, normalizedTime, 'scaleY', 1);

  return {
    x: rawX * intensity,
    y: rawY * intensity,
    rotate: rawRot * intensity,
    scaleX: 1 + (rawScaleX - 1) * intensity,
    scaleY: 1 + (rawScaleY - 1) * intensity
  };
}

/**
 * Evaluates motion clip channels at a specific timestamp.
 */
export function evaluateClipAtTime(clip, timeMs, options = {}) {
  const effectiveClip = clip || getMotionClip(DEFAULT_MOTION_CLIP_ID);
  const durationMs = effectiveClip.durationMs || 1000;
  const rawTime = Number.isFinite(timeMs) ? timeMs : 0;
  const phaseOffset = Number.isFinite(options.phaseOffset) ? options.phaseOffset : DEFAULT_PHASE_OFFSET;
  const intensity = Number.isFinite(options.intensity) ? clamp(options.intensity, 0, 3) : DEFAULT_MOTION_INTENSITY;
  const isLooping = options.loop !== false;

  let normalized;
  if (isLooping) {
    normalized = ((((rawTime / durationMs) + phaseOffset) % 1.0) + 1.0) % 1.0;
  } else {
    const rawProgress = (rawTime / durationMs) + phaseOffset;
    normalized = clamp(rawProgress, 0, 1);
  }

  const root = evaluateTransformChannel(effectiveClip.channels?.root, normalized, intensity);
  const head = evaluateTransformChannel(effectiveClip.channels?.head, normalized, intensity);
  const armLeft = evaluateTransformChannel(effectiveClip.channels?.armLeft, normalized, intensity);
  const armRight = evaluateTransformChannel(effectiveClip.channels?.armRight, normalized, intensity);
  const legLeft = evaluateTransformChannel(effectiveClip.channels?.legLeft, normalized, intensity);
  const legRight = evaluateTransformChannel(effectiveClip.channels?.legRight, normalized, intensity);

  const exprFrames = effectiveClip.channels?.expression;
  const intensityMultiplier = exprFrames
    ? interpolateKeyframes(exprFrames, normalized, 'intensityMultiplier', 1.0)
    : 1.0;

  const expression = {
    intensityMultiplier
  };

  return {
    normalizedTime: normalized,
    root,
    head,
    armLeft,
    armRight,
    legLeft,
    legRight,
    expression
  };
}

/**
 * Evaluates full composite character pose combining static pose, root/head/limb motion, and expression modulation.
 */
export function evaluateCharacterPose(characterEntity, timeMs = 0, options = {}) {
  const entity = characterEntity || {};
  const motionProfile = options.motionProfile || resolveMotionProfile(entity);
  const rawPose = entity.pose || DEFAULT_STATIC_POSE;
  const staticPoseName = options.fallbackLegacy === false ? rawPose : resolveSafePoseId(rawPose, motionProfile);
  const staticTransform = getStaticPoseTransform(staticPoseName);
  const staticRoot = staticTransform.root || staticTransform;
  const staticHead = staticTransform.head || { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 };
  const staticArmLeft = staticTransform.armLeft || { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 };
  const staticArmRight = staticTransform.armRight || { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 };
  const staticLegLeft = staticTransform.legLeft || { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 };
  const staticLegRight = staticTransform.legRight || { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 };

  const anim = entity.animation;
  const rawClipId = anim?.clipId;
  const safeClipId = options.fallbackLegacy === false ? rawClipId : resolveSafeClipId(rawClipId, motionProfile);
  const isAnimEnabled = Boolean(anim?.enabled && safeClipId && safeClipId !== 'none' && options.playbackEnabled !== false);

  let rootX = staticRoot.x ?? 0;
  let rootY = staticRoot.y ?? 0;
  let rootRotate = staticRoot.rotate ?? 0;
  let rootScaleX = staticRoot.scaleX ?? 1;
  let rootScaleY = staticRoot.scaleY ?? 1;

  let headX = staticHead.x ?? 0;
  let headY = staticHead.y ?? 0;
  let headRotate = staticHead.rotate ?? 0;
  let headScaleX = staticHead.scaleX ?? 1;
  let headScaleY = staticHead.scaleY ?? 1;

  let armLeftX = staticArmLeft.x ?? 0;
  let armLeftY = staticArmLeft.y ?? 0;
  let armLeftRotate = staticArmLeft.rotate ?? 0;
  let armLeftScaleX = staticArmLeft.scaleX ?? 1;
  let armLeftScaleY = staticArmLeft.scaleY ?? 1;

  let armRightX = staticArmRight.x ?? 0;
  let armRightY = staticArmRight.y ?? 0;
  let armRightRotate = staticArmRight.rotate ?? 0;
  let armRightScaleX = staticArmRight.scaleX ?? 1;
  let armRightScaleY = staticArmRight.scaleY ?? 1;

  let legLeftX = staticLegLeft.x ?? 0;
  let legLeftY = staticLegLeft.y ?? 0;
  let legLeftRotate = staticLegLeft.rotate ?? 0;
  let legLeftScaleX = staticLegLeft.scaleX ?? 1;
  let legLeftScaleY = staticLegLeft.scaleY ?? 1;

  let legRightX = staticLegRight.x ?? 0;
  let legRightY = staticLegRight.y ?? 0;
  let legRightRotate = staticLegRight.rotate ?? 0;
  let legRightScaleX = staticLegRight.scaleX ?? 1;
  let legRightScaleY = staticLegRight.scaleY ?? 1;

  let exprMultiplier = 1.0;

  if (isAnimEnabled) {
    const clip = getMotionClip(safeClipId);
    const clipEval = evaluateClipAtTime(clip, timeMs, {
      intensity: anim.intensity ?? DEFAULT_MOTION_INTENSITY,
      phaseOffset: anim.phaseOffset ?? DEFAULT_PHASE_OFFSET,
      loop: options.loop !== false
    });

    rootX += clipEval.root.x;
    rootY += clipEval.root.y;
    rootRotate += clipEval.root.rotate;
    rootScaleX *= clipEval.root.scaleX;
    rootScaleY *= clipEval.root.scaleY;

    headX += clipEval.head.x;
    headY += clipEval.head.y;
    headRotate += clipEval.head.rotate;
    headScaleX *= clipEval.head.scaleX;
    headScaleY *= clipEval.head.scaleY;

    armLeftX += clipEval.armLeft.x;
    armLeftY += clipEval.armLeft.y;
    armLeftRotate += clipEval.armLeft.rotate;
    armLeftScaleX *= clipEval.armLeft.scaleX;
    armLeftScaleY *= clipEval.armLeft.scaleY;

    armRightX += clipEval.armRight.x;
    armRightY += clipEval.armRight.y;
    armRightRotate += clipEval.armRight.rotate;
    armRightScaleX *= clipEval.armRight.scaleX;
    armRightScaleY *= clipEval.armRight.scaleY;

    legLeftX += clipEval.legLeft.x;
    legLeftY += clipEval.legLeft.y;
    legLeftRotate += clipEval.legLeft.rotate;
    legLeftScaleX *= clipEval.legLeft.scaleX;
    legLeftScaleY *= clipEval.legLeft.scaleY;

    legRightX += clipEval.legRight.x;
    legRightY += clipEval.legRight.y;
    legRightRotate += clipEval.legRight.rotate;
    legRightScaleX *= clipEval.legRight.scaleX;
    legRightScaleY *= clipEval.legRight.scaleY;

    exprMultiplier = clipEval.expression.intensityMultiplier;
  }

  // If root profile (full-body custom art), suppress head transforms completely
  if (motionProfile === 'root') {
    headX = 0;
    headY = 0;
    headRotate = 0;
    headScaleX = 1;
    headScaleY = 1;
  }

  // Rigid fallback: suppress limb channel deformations if garments covering limbs are rigid
  const draft = entity.characterSnapshot;
  const hasRigidArms = draft && (typeof options.hasRigidWearableForLimb === 'function'
    ? options.hasRigidWearableForLimb(draft, 'armLeft')
    : hasRigidWearableForLimb(draft, 'armLeft', options.getAsset));
  const hasRigidLegs = draft && (typeof options.hasRigidWearableForLimb === 'function'
    ? options.hasRigidWearableForLimb(draft, 'legLeft')
    : hasRigidWearableForLimb(draft, 'legLeft', options.getAsset));

  if (hasRigidArms || motionProfile === 'root') {
    armLeftX = 0; armLeftY = 0; armLeftRotate = 0; armLeftScaleX = 1; armLeftScaleY = 1;
    armRightX = 0; armRightY = 0; armRightRotate = 0; armRightScaleX = 1; armRightScaleY = 1;
  }
  if (hasRigidLegs || motionProfile === 'root') {
    legLeftX = 0; legLeftY = 0; legLeftRotate = 0; legLeftScaleX = 1; legLeftScaleY = 1;
    legRightX = 0; legRightY = 0; legRightRotate = 0; legRightScaleX = 1; legRightScaleY = 1;
  }

  const baseExpr = entity.expression || DEFAULT_EXPRESSION;
  const baseIntensity = Number.isFinite(entity.expressionIntensity)
    ? clamp(entity.expressionIntensity, 0, 1)
    : DEFAULT_EXPRESSION_INTENSITY;

  const effectiveIntensity = clamp(baseIntensity * exprMultiplier, 0, 1);

  return {
    root: {
      x: rootX,
      y: rootY,
      rotate: rootRotate,
      scaleX: rootScaleX,
      scaleY: rootScaleY
    },
    head: {
      x: headX,
      y: headY,
      rotate: headRotate,
      scaleX: headScaleX,
      scaleY: headScaleY
    },
    armLeft: {
      x: armLeftX,
      y: armLeftY,
      rotate: armLeftRotate,
      scaleX: armLeftScaleX,
      scaleY: armLeftScaleY
    },
    armRight: {
      x: armRightX,
      y: armRightY,
      rotate: armRightRotate,
      scaleX: armRightScaleX,
      scaleY: armRightScaleY
    },
    legLeft: {
      x: legLeftX,
      y: legLeftY,
      rotate: legLeftRotate,
      scaleX: legLeftScaleX,
      scaleY: legLeftScaleY
    },
    legRight: {
      x: legRightX,
      y: legRightY,
      rotate: legRightRotate,
      scaleX: legRightScaleX,
      scaleY: legRightScaleY
    },
    expression: baseExpr,
    expressionIntensity: effectiveIntensity,
    isAnimated: isAnimEnabled
  };
}

/**
 * Resolves effective motion boolean from user preference and system media query.
 */
export function resolveEffectiveMotion(userReducedMotionSetting, systemPrefersReducedMotion = false) {
  if (userReducedMotionSetting === 'reduce') return false;
  if (userReducedMotionSetting === 'full') return true;
  return !systemPrefersReducedMotion;
}

/**
 * Evaluates subtle procedural eye blinking scale for modular doll face layers.
 */
export function evaluateProceduralBlink(instanceId, timeMs = 0, options = {}) {
  if (options.reducedMotion) {
    return { scaleY: 1.0, isBlinking: false };
  }
  const t = Number.isFinite(timeMs) ? timeMs : 0;
  const seed = stringHash(instanceId || 'doll');
  const period = 3600 + (seed % 1800); // 3.6s - 5.4s
  const offset = (seed * 97) % 1000;
  const cycleTime = ((t + offset) % period + period) % period;
  const blinkDuration = 130; // ms

  if (cycleTime < blinkDuration) {
    const half = blinkDuration * 0.4;
    let scaleY = 1.0;
    if (cycleTime < half) {
      const p = cycleTime / half;
      scaleY = 1.0 - 0.95 * smoothCosine(p);
    } else {
      const p = (cycleTime - half) / (blinkDuration - half);
      scaleY = 0.05 + 0.95 * smoothCosine(p);
    }
    return { scaleY: Math.max(0.05, Math.min(1.0, scaleY)), isBlinking: true };
  }
  return { scaleY: 1.0, isBlinking: false };
}

/**
 * Computes forward kinematic transform for attached props and speech bubbles tracking host joint channels.
 */
export function evaluateAttachedEntityTransform(attachedEntity, hostEntity, hostPose, hostDollAsset = null) {
  if (!attachedEntity || !hostEntity || !hostPose) {
    return { tx: 0, ty: 0, rot: 0 };
  }

  const hostScale = Number.isFinite(hostEntity.scale) ? hostEntity.scale : 1.0;
  const hostFlipped = Boolean(hostEntity.flipped);
  const flipSign = hostFlipped ? -1 : 1;

  const rawOffset = attachedEntity.attachOffset;
  const dx = Number.isFinite(rawOffset?.dx) ? rawOffset.dx : 0;
  const dy = Number.isFinite(rawOffset?.dy) ? rawOffset.dy : 0;

  const attachJoint = attachedEntity.attachJoint || DEFAULT_ATTACH_JOINT;
  const rootPose = hostPose.root || { x: 0, y: 0, rotate: 0 };
  const rootRotRad = (flipSign * (rootPose.rotate || 0)) * (Math.PI / 180);

  if (attachJoint === 'root' || !hostPose[attachJoint]) {
    const rootScaleX = rootPose.scaleX ?? 1.0;
    const rootScaleY = rootPose.scaleY ?? 1.0;
    const scaledDx = dx * rootScaleX;
    const scaledDy = dy * rootScaleY;

    const cosR = Math.cos(rootRotRad);
    const sinR = Math.sin(rootRotRad);
    const rotatedDx = scaledDx * cosR - scaledDy * sinR;
    const rotatedDy = scaledDx * sinR + scaledDy * cosR;

    const tx = (rootPose.x * flipSign * hostScale) + (rotatedDx - dx);
    const ty = (rootPose.y * hostScale) + (rotatedDy - dy);
    const rot = flipSign * (rootPose.rotate || 0);

    return { tx, ty, rot };
  }

  const defaultPivots = {
    head: { x: 150, y: 90 },
    armLeft: { x: 126, y: 120 },
    armRight: { x: 174, y: 120 },
    legLeft: { x: 138, y: 230 },
    legRight: { x: 162, y: 230 }
  };

  const pivotPropMap = {
    head: 'headPivot',
    armLeft: 'shoulderLeftPivot',
    armRight: 'shoulderRightPivot',
    legLeft: 'hipLeftPivot',
    legRight: 'hipRightPivot'
  };
  const propName = pivotPropMap[attachJoint] || `${attachJoint}Pivot`;
  const assetPivot = hostDollAsset?.[propName] || hostDollAsset?.pivots?.[attachJoint] || defaultPivots[attachJoint] || { x: 150, y: 225 };
  const pivotRelX = (assetPivot.x - 150) * (235 / 300) * hostScale * flipSign;
  const pivotRelY = (assetPivot.y - 450) * (352.5 / 450) * hostScale;

  const jointPose = hostPose[attachJoint] || { x: 0, y: 0, rotate: 0 };
  const totalRotDeg = flipSign * ((rootPose.rotate || 0) + (jointPose.rotate || 0));
  const totalRotRad = totalRotDeg * (Math.PI / 180);

  const jointScaleX = (rootPose.scaleX ?? 1.0) * (jointPose.scaleX ?? 1.0);
  const jointScaleY = (rootPose.scaleY ?? 1.0) * (jointPose.scaleY ?? 1.0);

  const relToPivotX = (dx - pivotRelX) * jointScaleX;
  const relToPivotY = (dy - pivotRelY) * jointScaleY;

  const cosJ = Math.cos(totalRotRad);
  const sinJ = Math.sin(totalRotRad);
  const rotAroundPivotX = relToPivotX * cosJ - relToPivotY * sinJ;
  const rotAroundPivotY = relToPivotX * sinJ + relToPivotY * cosJ;

  const jointWorldTx = (rootPose.x + ((jointPose.x || 0) * (235 / 300))) * flipSign * hostScale;
  const jointWorldTy = (rootPose.y + ((jointPose.y || 0) * (352.5 / 450))) * hostScale;

  const tx = pivotRelX + rotAroundPivotX + jointWorldTx - dx;
  const ty = pivotRelY + rotAroundPivotY + jointWorldTy - dy;
  const rot = totalRotDeg;

  return { tx, ty, rot };
}

/**
 * Recursively resolves the total kinematic transform for any attached entity in a scene DAG.
 */
export function resolveEntityAttachmentTransform(
  entity,
  allEntitiesMap,
  characterPoses,
  getAssetFn = () => undefined,
  memoMap = new Map(),
  visited = new Set()
) {
  if (!entity || !entity.attachedTo) {
    return { tx: 0, ty: 0, rot: 0 };
  }
  if (memoMap.has(entity.instanceId)) {
    return memoMap.get(entity.instanceId);
  }
  if (visited.has(entity.instanceId)) {
    return { tx: 0, ty: 0, rot: 0 }; // Cycle safety
  }
  visited.add(entity.instanceId);

  const parent = allEntitiesMap.get(entity.attachedTo);
  if (!parent) {
    const result = { tx: 0, ty: 0, rot: 0 };
    memoMap.set(entity.instanceId, result);
    return result;
  }

  if (parent.kind === 'character') {
    const hostPose = characterPoses.get(parent.instanceId) || evaluateCharacterPose(parent, 0, { playbackEnabled: false, getAsset: getAssetFn });
    const hostDollId = parent.characterSnapshot?.baseDollId || parent.sourceId;
    const hostAsset = typeof getAssetFn === 'function' ? getAssetFn(hostDollId) : undefined;
    const result = evaluateAttachedEntityTransform(entity, parent, hostPose, hostAsset);
    memoMap.set(entity.instanceId, result);
    return result;
  }

  // Parent is prop / bubble / non-character: recursively evaluate parent's transform
  const parentTransform = resolveEntityAttachmentTransform(
    parent,
    allEntitiesMap,
    characterPoses,
    getAssetFn,
    memoMap,
    visited
  );

  const rawOffset = entity.attachOffset;
  const dx = Number.isFinite(rawOffset?.dx) ? rawOffset.dx : (entity.x - parent.x);
  const dy = Number.isFinite(rawOffset?.dy) ? rawOffset.dy : (entity.y - parent.y);

  const rotRad = (parentTransform.rot || 0) * (Math.PI / 180);
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);
  const rotatedDx = dx * cosR - dy * sinR;
  const rotatedDy = dx * sinR + dy * cosR;

  const result = {
    tx: (parentTransform.tx || 0) + (rotatedDx - dx),
    ty: (parentTransform.ty || 0) + (rotatedDy - dy),
    rot: parentTransform.rot || 0
  };

  memoMap.set(entity.instanceId, result);
  return result;
}

/**
 * Calculates the maximum runtime duration (in ms) required for all active,
 * non-looping animation clips in a scene to complete a single playthrough.
 */
export function getSceneActiveAnimationDuration(sceneSnapshot) {
  if (!sceneSnapshot?.entities || !Array.isArray(sceneSnapshot.entities)) return 0;
  let maxDuration = 0;
  for (const entity of sceneSnapshot.entities) {
    if (entity.kind !== 'character') continue;
    const anim = entity.animation;
    if (!anim?.enabled || !anim.clipId || anim.clipId === 'none') continue;
    const profile = resolveMotionProfile(entity);
    const safeClipId = resolveSafeClipId(anim.clipId, profile);
    if (!safeClipId || safeClipId === 'none') continue;
    const clip = getMotionClip(safeClipId);
    const duration = clip?.durationMs || 1000;
    const phaseOffset = anim.phaseOffset ?? DEFAULT_PHASE_OFFSET;
    const finishTime = duration * Math.max(0, 1 - phaseOffset);
    if (finishTime > maxDuration) {
      maxDuration = finishTime;
    }
  }
  return maxDuration || 1000;
}

