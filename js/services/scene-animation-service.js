/**
 * Scene Animation Service
 * Single authority for scene playback clock, high-performance DOM transform updates,
 * viewport culling, reduced-motion runtime resolution, and voice priority.
 */

import {
  evaluateAttachedEntityTransform,
  evaluateCharacterPose,
  evaluateProceduralBlink,
  getSceneActiveAnimationDuration,
  resolveEffectiveMotion,
  resolveEntityAttachmentTransform
} from '../domain/motion-evaluator.js';
import { applyMouthExpression } from '../core/mouth-expression.js';
import { getAsset as getBuiltinAsset, hasRigidWearableForLimb } from '../core/asset-catalog.js';
import { DEFAULT_EXPRESSION, DEFAULT_EXPRESSION_INTENSITY, DEFAULT_REDUCED_MOTION, DEFAULT_STAGE_WIDTH, VIEWPORT_WIDTH } from '../domain/vocabulary.js';

export function resolveVoiceTargetCharacter(scene, selectedEntityId) {
  if (!scene?.entities || !Array.isArray(scene.entities)) return null;
  if (selectedEntityId) {
    const selectedChar = scene.entities.find((e) => e.instanceId === selectedEntityId && e.kind === 'character');
    if (selectedChar) return selectedChar;
  }
  return scene.entities.find((e) => e.kind === 'character') || null;
}

function applyPosePropertiesToMotionElement(motionEl, pose) {
  if (!motionEl || !pose) return;
  motionEl.style.setProperty('--motion-tx', String(Math.round(pose.root.x * 10) / 10));
  motionEl.style.setProperty('--motion-ty', String(Math.round(pose.root.y * 10) / 10));
  motionEl.style.setProperty('--motion-rot', String(Math.round(pose.root.rotate * 10) / 10));
  motionEl.style.setProperty('--motion-scale-x', String(Math.round(pose.root.scaleX * 100) / 100));
  motionEl.style.setProperty('--motion-scale-y', String(Math.round(pose.root.scaleY * 100) / 100));

  if (pose.head) {
    motionEl.style.setProperty('--motion-head-tx', String(Math.round(pose.head.x * 10) / 10));
    motionEl.style.setProperty('--motion-head-ty', String(Math.round(pose.head.y * 10) / 10));
    motionEl.style.setProperty('--motion-head-rot', String(Math.round(pose.head.rotate * 10) / 10));
    motionEl.style.setProperty('--motion-head-scale-x', String(Math.round(pose.head.scaleX * 100) / 100));
    motionEl.style.setProperty('--motion-head-scale-y', String(Math.round(pose.head.scaleY * 100) / 100));
  }

  if (pose.armLeft) {
    motionEl.style.setProperty('--motion-arm-left-tx', String(Math.round(pose.armLeft.x * 10) / 10));
    motionEl.style.setProperty('--motion-arm-left-ty', String(Math.round(pose.armLeft.y * 10) / 10));
    motionEl.style.setProperty('--motion-arm-left-rot', String(Math.round(pose.armLeft.rotate * 10) / 10));
    motionEl.style.setProperty('--motion-arm-left-scale-x', String(Math.round(pose.armLeft.scaleX * 100) / 100));
    motionEl.style.setProperty('--motion-arm-left-scale-y', String(Math.round(pose.armLeft.scaleY * 100) / 100));
  }

  if (pose.armRight) {
    motionEl.style.setProperty('--motion-arm-right-tx', String(Math.round(pose.armRight.x * 10) / 10));
    motionEl.style.setProperty('--motion-arm-right-ty', String(Math.round(pose.armRight.y * 10) / 10));
    motionEl.style.setProperty('--motion-arm-right-rot', String(Math.round(pose.armRight.rotate * 10) / 10));
    motionEl.style.setProperty('--motion-arm-right-scale-x', String(Math.round(pose.armRight.scaleX * 100) / 100));
    motionEl.style.setProperty('--motion-arm-right-scale-y', String(Math.round(pose.armRight.scaleY * 100) / 100));
  }

  if (pose.legLeft) {
    motionEl.style.setProperty('--motion-leg-left-tx', String(Math.round(pose.legLeft.x * 10) / 10));
    motionEl.style.setProperty('--motion-leg-left-ty', String(Math.round(pose.legLeft.y * 10) / 10));
    motionEl.style.setProperty('--motion-leg-left-rot', String(Math.round(pose.legLeft.rotate * 10) / 10));
    motionEl.style.setProperty('--motion-leg-left-scale-x', String(Math.round(pose.legLeft.scaleX * 100) / 100));
    motionEl.style.setProperty('--motion-leg-left-scale-y', String(Math.round(pose.legLeft.scaleY * 100) / 100));
  }

  if (pose.legRight) {
    motionEl.style.setProperty('--motion-leg-right-tx', String(Math.round(pose.legRight.x * 10) / 10));
    motionEl.style.setProperty('--motion-leg-right-ty', String(Math.round(pose.legRight.y * 10) / 10));
    motionEl.style.setProperty('--motion-leg-right-rot', String(Math.round(pose.legRight.rotate * 10) / 10));
    motionEl.style.setProperty('--motion-leg-right-scale-x', String(Math.round(pose.legRight.scaleX * 100) / 100));
    motionEl.style.setProperty('--motion-leg-right-scale-y', String(Math.round(pose.legRight.scaleY * 100) / 100));
  }
}

export function createSceneAnimationService(options = {}) {
  const store = options.store;
  const getAssetFn = options.getAsset ?? getBuiltinAsset;
  const queryAll = options.queryAll ?? ((sel) => globalThis.document?.querySelectorAll?.(sel) || []);
  const raf = options.requestAnimationFrame ?? ((cb) => (globalThis.requestAnimationFrame ? globalThis.requestAnimationFrame(cb) : setTimeout(cb, 16)));
  const cancelRaf = options.cancelAnimationFrame ?? ((id) => (globalThis.cancelAnimationFrame ? globalThis.cancelAnimationFrame(id) : clearTimeout(id)));
  const matchMedia = options.matchMedia ?? ((q) => globalThis.matchMedia?.(q));
  const clockNow = options.now ?? (() => (globalThis.performance?.now ? globalThis.performance.now() : Date.now()));
  const isVoiceActive = options.isVoiceActive ?? (() => false);
  const stageViewportWidth = options.viewportWidth ?? VIEWPORT_WIDTH;

  let isPlaying = false;
  let rafId = null;
  let accumulatedElapsedMs = 0;
  let lastTickTime = 0;
  let systemPrefersReducedMotion = false;
  let mediaQueryList = null;
  let mediaQueryHandler = null;

  // Recycled cache maps to prevent per-frame garbage collection
  const domCacheByInstanceId = new Map();
  let domCacheValid = false;
  const characterPoses = new Map();
  const characterEntities = new Map();
  const allEntitiesMap = new Map();
  const attachedTransformMemo = new Map();
  const rigidLimbMemo = new Map();

  function invalidateDomCache() {
    domCacheValid = false;
    domCacheByInstanceId.clear();
    rigidLimbMemo.clear();
  }

  function syncDomCache() {
    domCacheByInstanceId.clear();
    const positionerElements = queryAll('.scene-entity-positioner');
    for (const el of positionerElements) {
      const id = el.dataset?.instanceId;
      if (id) {
        domCacheByInstanceId.set(id, {
          positioner: el,
          motionEl: el.querySelector('.scene-entity-motion'),
          eyesLayer: el.querySelector('[data-slot="face-eyes"]'),
          mouthSvg: el.querySelector('#mouth-svg, svg[data-layer="face-mouth"], .mouth-layer-svg')
        });
      }
    }
    domCacheValid = true;
  }

  function getCachedDomRecord(instanceId) {
    if (!domCacheValid) {
      syncDomCache();
    }
    const record = domCacheByInstanceId.get(instanceId);
    if (record && record.positioner && record.positioner.isConnected === false) {
      syncDomCache();
      return domCacheByInstanceId.get(instanceId);
    }
    return record;
  }

  function getRigidWearableForLimbCached(draft, limb) {
    if (!draft) return false;
    const slots = draft.slots || {};
    const topId = slots.top?.assetId || '';
    const bottomId = slots.bottom?.assetId || '';
    const dressId = slots.dress?.assetId || '';
    const shoesId = slots.shoes?.assetId || '';
    const cacheKey = `${limb}:${topId}:${bottomId}:${dressId}:${shoesId}`;
    if (rigidLimbMemo.has(cacheKey)) {
      return rigidLimbMemo.get(cacheKey);
    }
    const result = hasRigidWearableForLimb(draft, limb, getAssetFn);
    rigidLimbMemo.set(cacheKey, result);
    return result;
  }

  // Track system prefers-reduced-motion
  try {
    if (matchMedia) {
      mediaQueryList = matchMedia('(prefers-reduced-motion: reduce)');
      systemPrefersReducedMotion = Boolean(mediaQueryList?.matches);
      mediaQueryHandler = (e) => {
        systemPrefersReducedMotion = Boolean(e.matches);
        handleSettingsChange();
      };
      if (typeof mediaQueryList?.addEventListener === 'function') {
        mediaQueryList.addEventListener('change', mediaQueryHandler);
      } else if (typeof mediaQueryList?.addListener === 'function') {
        mediaQueryList.addListener(mediaQueryHandler);
      }
    }
  } catch {
    // Non-browser or mock environments
  }

  function getEffectiveMotionAllowed() {
    const userPref = store?.getState()?.settings?.reducedMotion || DEFAULT_REDUCED_MOTION;
    return Boolean(resolveEffectiveMotion(userPref, systemPrefersReducedMotion));
  }

  function getElapsedMs() {
    return accumulatedElapsedMs;
  }

  // Least Common Multiple of all motion clip durations (800, 1000, 1200, 1400, 1600, 1800, 2000, 2400, 3000 ms)
  const CLIP_DURATION_LCM_MS = 504000;

  function tick() {
    if (!isPlaying) return;
    const now = clockNow();
    const delta = Math.max(0, now - lastTickTime);
    lastTickTime = now;

    const state = store?.getState();
    if (!state?.currentScene) {
      pause();
      return;
    }

    const playbackRate = state.currentScene.animationSettings?.playbackRate ?? DEFAULT_PLAYBACK_RATE;
    accumulatedElapsedMs += delta * playbackRate;

    const isLooping = state.currentScene.animationSettings?.loop !== false;
    if (!isLooping) {
      const maxDuration = getSceneActiveAnimationDuration(state.currentScene);
      if (maxDuration > 0 && accumulatedElapsedMs >= maxDuration) {
        accumulatedElapsedMs = maxDuration;
        pause();
        store?.dispatch({ type: 'scene/playbackFinished' });
        return;
      }
    } else if (accumulatedElapsedMs >= CLIP_DURATION_LCM_MS * 10) {
      // Periodic modulo wrapping at integer multiples of duration LCM to preserve float precision without phase jump
      accumulatedElapsedMs = accumulatedElapsedMs % CLIP_DURATION_LCM_MS;
    }

    updateDomTransforms(state, accumulatedElapsedMs);
    rafId = raf(tick);
  }

  function updateDomTransforms(state, elapsedMs) {
    const scene = state.currentScene;
    const stageWidth = scene.stageWidth || DEFAULT_STAGE_WIDTH;
    const cameraX = scene.cameraX || 0;
    const isWideStage = stageWidth > stageViewportWidth;
    const viewportLeft = cameraX - 350;
    const viewportRight = cameraX + stageViewportWidth + 350;
    const isLooping = scene.animationSettings?.loop !== false;

    if (!domCacheValid) {
      syncDomCache();
    }

    const voiceActive = isVoiceActive();
    const targetVoiceChar = resolveVoiceTargetCharacter(scene, state.ui?.selectedEntityId);
    const voiceTargetId = targetVoiceChar?.instanceId;

    characterPoses.clear();
    characterEntities.clear();
    allEntitiesMap.clear();
    attachedTransformMemo.clear();

    for (const e of scene.entities) {
      allEntitiesMap.set(e.instanceId, e);
    }

    for (const entity of scene.entities) {
      if (entity.kind !== 'character') continue;
      characterEntities.set(entity.instanceId, entity);

      const cachedDom = getCachedDomRecord(entity.instanceId);
      if (!cachedDom?.positioner) continue;

      const isOffscreen = isWideStage && (entity.x < viewportLeft || entity.x > viewportRight);
      const pose = evaluateCharacterPose(entity, elapsedMs, {
        playbackEnabled: isPlaying,
        loop: isLooping,
        getAsset: getAssetFn,
        hasRigidWearableForLimb: getRigidWearableForLimbCached
      });
      characterPoses.set(entity.instanceId, pose);

      if (isOffscreen) continue;

      if (cachedDom.motionEl) {
        applyPosePropertiesToMotionElement(cachedDom.motionEl, pose);
      }

      // Procedural secondary micro-motion: eye blinking (only for animated characters)
      if (cachedDom.eyesLayer) {
        if (pose.isAnimated) {
          const blink = evaluateProceduralBlink(entity.instanceId, elapsedMs, {
            reducedMotion: !getEffectiveMotionAllowed()
          });
          cachedDom.eyesLayer.style.setProperty('--motion-blink-scale-y', String(Math.round(blink.scaleY * 100) / 100));
        } else if (cachedDom.eyesLayer.style.getPropertyValue?.('--motion-blink-scale-y') !== '1') {
          cachedDom.eyesLayer.style.setProperty('--motion-blink-scale-y', '1');
        }
      }

      // Voice priority: voice puppetry controls mouth when speaking
      const isOverriddenByVoice = voiceActive && entity.instanceId === voiceTargetId;
      if (!isOverriddenByVoice && pose.isAnimated) {
        if (cachedDom.mouthSvg) {
          applyMouthExpression(cachedDom.mouthSvg, pose.expression, pose.expressionIntensity);
        }
      }
    }

    // Dynamic attached props and speech bubbles kinematics (recursive for nested DAG)
    for (const entity of scene.entities) {
      if (!entity.attachedTo) continue;
      const cachedDom = getCachedDomRecord(entity.instanceId);
      if (!cachedDom?.positioner) continue;

      const attachedTransform = resolveEntityAttachmentTransform(
        entity,
        allEntitiesMap,
        characterPoses,
        getAssetFn,
        attachedTransformMemo
      );

      cachedDom.positioner.style.setProperty('--motion-attached-tx', String(Math.round(attachedTransform.tx * 10) / 10));
      cachedDom.positioner.style.setProperty('--motion-attached-ty', String(Math.round(attachedTransform.ty * 10) / 10));
      cachedDom.positioner.style.setProperty('--motion-attached-rot', String(Math.round(attachedTransform.rot * 10) / 10));
    }
  }

  function applyStaticPoseToDom() {
    const state = store?.getState();
    if (!state || !state.currentScene) return;

    if (!domCacheValid) {
      syncDomCache();
    }

    characterEntities.clear();
    characterPoses.clear();
    allEntitiesMap.clear();
    attachedTransformMemo.clear();

    for (const e of state.currentScene.entities) {
      allEntitiesMap.set(e.instanceId, e);
    }

    for (const entity of state.currentScene.entities) {
      if (entity.kind !== 'character') continue;
      characterEntities.set(entity.instanceId, entity);

      const cachedDom = getCachedDomRecord(entity.instanceId);
      if (!cachedDom?.positioner) continue;

      const staticPose = evaluateCharacterPose(entity, 0, {
        playbackEnabled: false,
        getAsset: getAssetFn,
        hasRigidWearableForLimb: getRigidWearableForLimbCached
      });
      characterPoses.set(entity.instanceId, staticPose);

      if (cachedDom.motionEl) {
        applyPosePropertiesToMotionElement(cachedDom.motionEl, staticPose);
      }

      if (cachedDom.eyesLayer) {
        cachedDom.eyesLayer.style.setProperty('--motion-blink-scale-y', '1');
      }

      if (cachedDom.mouthSvg) {
        applyMouthExpression(cachedDom.mouthSvg, entity.expression || DEFAULT_EXPRESSION, entity.expressionIntensity ?? DEFAULT_EXPRESSION_INTENSITY);
      }
    }

    // Static attached entity transforms (recursive for nested DAG)
    for (const entity of state.currentScene.entities) {
      if (!entity.attachedTo) continue;
      const cachedDom = getCachedDomRecord(entity.instanceId);
      if (!cachedDom?.positioner) continue;

      const attachedTransform = resolveEntityAttachmentTransform(
        entity,
        allEntitiesMap,
        characterPoses,
        getAssetFn,
        attachedTransformMemo
      );

      cachedDom.positioner.style.setProperty('--motion-attached-tx', String(Math.round(attachedTransform.tx * 10) / 10));
      cachedDom.positioner.style.setProperty('--motion-attached-ty', String(Math.round(attachedTransform.ty * 10) / 10));
      cachedDom.positioner.style.setProperty('--motion-attached-rot', String(Math.round(attachedTransform.rot * 10) / 10));
    }
  }

  function play(options = {}) {
    if (isPlaying) return;
    if (!getEffectiveMotionAllowed()) {
      applyStaticPoseToDom();
      return;
    }
    invalidateDomCache();
    if (options?.resetClock) {
      accumulatedElapsedMs = 0;
    }
    isPlaying = true;
    lastTickTime = clockNow();
    if (rafId) cancelRaf(rafId);
    rafId = raf(tick);
  }

  function pause() {
    if (!isPlaying) return;
    isPlaying = false;
    if (rafId) {
      cancelRaf(rafId);
      rafId = null;
    }
    invalidateDomCache();
    applyStaticPoseToDom();
  }

  function resetClock() {
    accumulatedElapsedMs = 0;
    lastTickTime = clockNow();
  }

  function reset() {
    const wasPlaying = isPlaying;
    accumulatedElapsedMs = 0;
    lastTickTime = clockNow();
    invalidateDomCache();
    applyStaticPoseToDom();
    if (!wasPlaying && rafId) {
      cancelRaf(rafId);
      rafId = null;
    }
  }

  function toggle() {
    if (isPlaying) pause();
    else play();
  }

  function handleSettingsChange() {
    const motionAllowed = getEffectiveMotionAllowed();
    const state = store?.getState();
    const shouldPlay = motionAllowed && state?.ui?.mode === 'play' && Boolean(state?.currentScene?.animationSettings?.enabled);
    if (shouldPlay && !isPlaying) {
      play();
    } else if (!motionAllowed && isPlaying) {
      pause();
    } else {
      applyStaticPoseToDom();
    }
  }

  function teardown() {
    isPlaying = false;
    accumulatedElapsedMs = 0;
    if (rafId) {
      cancelRaf(rafId);
      rafId = null;
    }
    if (mediaQueryList && mediaQueryHandler) {
      try {
        if (typeof mediaQueryList.removeEventListener === 'function') {
          mediaQueryList.removeEventListener('change', mediaQueryHandler);
        } else if (typeof mediaQueryList.removeListener === 'function') {
          mediaQueryList.removeListener(mediaQueryHandler);
        }
      } catch {
        // Best effort
      }
    }
    invalidateDomCache();
    applyStaticPoseToDom();
  }

  return {
    isPlaying: () => isPlaying,
    getEffectiveMotionAllowed,
    getElapsedMs,
    play,
    pause,
    reset,
    resetClock,
    toggle,
    handleSettingsChange,
    applyStaticPoseToDom,
    invalidateDomCache,
    teardown
  };
}
