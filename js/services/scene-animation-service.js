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
import { getAsset as getBuiltinAsset } from '../core/asset-catalog.js';
import { DEFAULT_EXPRESSION, DEFAULT_EXPRESSION_INTENSITY, DEFAULT_STAGE_WIDTH } from '../domain/vocabulary.js';

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

  let isPlaying = false;
  let rafId = null;
  let accumulatedElapsedMs = 0;
  let lastTickTime = 0;
  let systemPrefersReducedMotion = false;
  let mediaQueryList = null;
  let mediaQueryHandler = null;

  // Recycled cache maps to prevent per-frame garbage collection
  const elementsByInstanceId = new Map();
  const characterPoses = new Map();
  const characterEntities = new Map();
  const allEntitiesMap = new Map();
  const attachedTransformMemo = new Map();

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
    // Best-effort media query listener
  }

  function getEffectiveMotionAllowed() {
    const userSetting = store?.getState()?.settings?.reducedMotion || 'system';
    return resolveEffectiveMotion(userSetting, systemPrefersReducedMotion);
  }

  function getElapsedMs() {
    return accumulatedElapsedMs;
  }

  function tick() {
    if (!isPlaying) return;

    if (!getEffectiveMotionAllowed()) {
      pause();
      applyStaticPoseToDom();
      return;
    }

    const state = store?.getState();
    if (!state || !state.currentScene) {
      rafId = raf(tick);
      return;
    }

    const now = clockNow();
    const delta = Math.max(0, now - lastTickTime);
    lastTickTime = now;
    const playbackRate = Number.isFinite(state.currentScene.animationSettings?.playbackRate)
      ? state.currentScene.animationSettings.playbackRate
      : 1.0;
    accumulatedElapsedMs += delta * playbackRate;

    const isLooping = state.currentScene.animationSettings?.loop !== false;
    if (!isLooping) {
      const maxDuration = getSceneActiveAnimationDuration(state.currentScene);
      if (accumulatedElapsedMs >= maxDuration) {
        accumulatedElapsedMs = maxDuration;
        updateDomTransforms(state, maxDuration);
        pause();
        store?.dispatch({
          type: 'scene/setAnimationSettings',
          animationSettings: {
            ...(state.currentScene.animationSettings || {}),
            enabled: false
          }
        });
        return;
      }
    }

    updateDomTransforms(state, accumulatedElapsedMs);
    rafId = raf(tick);
  }

  function updateDomTransforms(state, elapsedMs) {
    const scene = state.currentScene;
    const stageWidth = scene.stageWidth || DEFAULT_STAGE_WIDTH;
    const cameraX = scene.cameraX || 0;
    const isWideStage = stageWidth > 1600;
    const viewportLeft = cameraX - 350;
    const viewportRight = cameraX + 1600 + 350;
    const isLooping = scene.animationSettings?.loop !== false;

    elementsByInstanceId.clear();
    const positionerElements = queryAll('.scene-entity-positioner');
    for (const el of positionerElements) {
      const id = el.dataset?.instanceId;
      if (id) elementsByInstanceId.set(id, el);
    }

    const voiceActive = isVoiceActive();
    const primarySelectedId = state.ui?.selectedEntityId;
    const voiceTargetId = primarySelectedId || scene.entities.find((e) => e.kind === 'character')?.instanceId;

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

      const el = elementsByInstanceId.get(entity.instanceId);
      if (!el) continue;

      const isOffscreen = isWideStage && (entity.x < viewportLeft || entity.x > viewportRight);
      const pose = evaluateCharacterPose(entity, elapsedMs, { playbackEnabled: isPlaying, loop: isLooping, getAsset: getAssetFn });
      characterPoses.set(entity.instanceId, pose);

      if (isOffscreen) continue;

      const motionEl = el.querySelector('.scene-entity-motion');
      if (motionEl) {
        applyPosePropertiesToMotionElement(motionEl, pose);
      }

      // Procedural secondary micro-motion: eye blinking (only for animated characters)
      const eyesLayer = el.querySelector('.doll-layer[data-slot="face-eyes"]');
      if (eyesLayer) {
        if (pose.isAnimated) {
          const blink = evaluateProceduralBlink(entity.instanceId, elapsedMs, {
            reducedMotion: !getEffectiveMotionAllowed()
          });
          eyesLayer.style.setProperty('--motion-blink-scale-y', String(Math.round(blink.scaleY * 100) / 100));
        } else if (eyesLayer.style.getPropertyValue?.('--motion-blink-scale-y') !== '1') {
          eyesLayer.style.setProperty('--motion-blink-scale-y', '1');
        }
      }

      // Voice priority: voice puppetry controls mouth when speaking
      const isOverriddenByVoice = voiceActive && entity.instanceId === voiceTargetId;
      if (!isOverriddenByVoice && pose.isAnimated) {
        const mouthSvg = el.querySelector('[data-slot="face-mouth"] svg') || el.querySelector('[data-slot="skin"] svg');
        if (mouthSvg) {
          applyMouthExpression(mouthSvg, pose.expression, pose.expressionIntensity);
        }
      }
    }

    // Dynamic attached props and speech bubbles kinematics (recursive for nested DAG)
    for (const entity of scene.entities) {
      if (!entity.attachedTo) continue;
      const el = elementsByInstanceId.get(entity.instanceId);
      if (!el) continue;

      const attachedTransform = resolveEntityAttachmentTransform(
        entity,
        allEntitiesMap,
        characterPoses,
        getAssetFn,
        attachedTransformMemo
      );

      el.style.setProperty('--motion-attached-tx', String(Math.round(attachedTransform.tx * 10) / 10));
      el.style.setProperty('--motion-attached-ty', String(Math.round(attachedTransform.ty * 10) / 10));
      el.style.setProperty('--motion-attached-rot', String(Math.round(attachedTransform.rot * 10) / 10));
    }
  }

  function applyStaticPoseToDom() {
    const state = store?.getState();
    if (!state || !state.currentScene) return;

    elementsByInstanceId.clear();
    const positionerElements = queryAll('.scene-entity-positioner');
    for (const el of positionerElements) {
      const id = el.dataset?.instanceId;
      if (id) elementsByInstanceId.set(id, el);
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

      const el = elementsByInstanceId.get(entity.instanceId);
      if (!el) continue;

      const staticPose = evaluateCharacterPose(entity, 0, { playbackEnabled: false, getAsset: getAssetFn });
      characterPoses.set(entity.instanceId, staticPose);

      const motionEl = el.querySelector('.scene-entity-motion');
      if (motionEl) {
        applyPosePropertiesToMotionElement(motionEl, staticPose);
      }

      const eyesLayer = el.querySelector('.doll-layer[data-slot="face-eyes"]');
      if (eyesLayer) {
        eyesLayer.style.setProperty('--motion-blink-scale-y', '1');
      }

      const mouthSvg = el.querySelector('[data-slot="face-mouth"] svg') || el.querySelector('[data-slot="skin"] svg');
      if (mouthSvg) {
        applyMouthExpression(mouthSvg, entity.expression || DEFAULT_EXPRESSION, entity.expressionIntensity ?? DEFAULT_EXPRESSION_INTENSITY);
      }
    }

    // Static attached entity transforms (recursive for nested DAG)
    for (const entity of state.currentScene.entities) {
      if (!entity.attachedTo) continue;
      const el = elementsByInstanceId.get(entity.instanceId);
      if (!el) continue;

      const attachedTransform = resolveEntityAttachmentTransform(
        entity,
        allEntitiesMap,
        characterPoses,
        getAssetFn,
        attachedTransformMemo
      );

      el.style.setProperty('--motion-attached-tx', String(Math.round(attachedTransform.tx * 10) / 10));
      el.style.setProperty('--motion-attached-ty', String(Math.round(attachedTransform.ty * 10) / 10));
      el.style.setProperty('--motion-attached-rot', String(Math.round(attachedTransform.rot * 10) / 10));
    }
  }

  function play(options = {}) {
    if (isPlaying) return;
    if (!getEffectiveMotionAllowed()) {
      applyStaticPoseToDom();
      return;
    }
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
    }
    applyStaticPoseToDom();
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
    teardown
  };
}

