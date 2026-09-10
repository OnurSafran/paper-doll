import {
  addEntity,
  alignEntities,
  attachEntity,
  clamp,
  createEmptyScene,
  deleteEntities,
  deleteEntity,
  detachEntity,
  duplicateEntity,
  flipEntities,
  flipEntity,
  getEntityBounds,
  moveEntities,
  moveEntity,
  reclampSceneEntities,
  reorderEntity,
  scaleEntities,
  scaleEntity,
  setBubbleStyle,
  setBubbleText,
  setBubbleWidth,
  setEntityPinned,
  togglePinEntities,
  touchScene
} from '../../domain/scene-rules.js';
import { clampCameraX } from '../coordinate-space.js';
import { instantiateSceneTemplate } from '../../domain/scene-templates.js';
import { resolveMotionProfile, resolveSafeClipId, resolveSafePoseId } from '../../domain/animation-clips.js';
import { cloneScene } from '../state-schema.js';
import { cloneDraft, createStarterDraft } from '../../domain/outfit-rules.js';
import { t } from '../i18n.js';
import { normalizeDisplayName, truncateGraphemes } from '../text.js';
import {
  DEFAULT_BUBBLE_STYLE,
  DEFAULT_BUBBLE_TEXT,
  DEFAULT_MOTION_CLIP_ID,
  DEFAULT_MOTION_INTENSITY,
  DEFAULT_PHASE_OFFSET,
  DEFAULT_PLAYBACK_RATE,
  DEFAULT_SCENE_ANIMATION_SETTINGS,
  DEFAULT_STAGE_WIDTH,
  isAlignmentMode,
  isAttachJoint,
  isBubbleStyle,
  isExpression,
  isExpressionIntensity,
  isMotionIntensity,
  isPhaseOffset,
  isPlaybackRate,
  isStageWidth,
  LIMITS
} from '../../domain/vocabulary.js';
import { getLandmarkByBackgroundId, isLandmarkUnlocked } from '../../domain/world-map-catalog.js';
import { localizedMessage, nextUniqueId } from './reducer-helpers.js';

/** @param {import('../../types.js').AppState} state
 * @param {import('../../types.js').StoreAction} action */
export function sceneReducer(state, action, context) {
  switch (action.type) {
    case 'scene/setBackground': {
      if (context.getAsset(action.backgroundId)?.kind !== 'background') return null;
      if (state.currentScene.backgroundId === action.backgroundId) return null;
      const landmark = getLandmarkByBackgroundId(action.backgroundId);
      if (landmark && !isLandmarkUnlocked(landmark, state.settings)) return null;
      return {
        state: { ...state, currentScene: touchScene({ ...state.currentScene, backgroundId: action.backgroundId }, context.now) },
        persist: true
      };
    }

    case 'scene/setStageWidth': {
      if (!isStageWidth(action.stageWidth)) return null;
      const currentWidth = state.currentScene.stageWidth || DEFAULT_STAGE_WIDTH;
      if (currentWidth === action.stageWidth) return null;
      let nextScene = { ...state.currentScene, stageWidth: action.stageWidth };
      if (action.stageWidth < currentWidth) {
        nextScene = reclampSceneEntities(nextScene, action.stageWidth, context.getAsset);
      }
      nextScene.cameraX = clampCameraX(nextScene.cameraX, action.stageWidth);
      return {
        state: localizedMessage('play.statusStageWidth', { width: action.stageWidth }, {
          ...state,
          currentScene: touchScene(nextScene, context.now)
        }),
        persist: true
      };
    }

    case 'scene/setCameraX': {
      const stageWidth = state.currentScene.stageWidth || DEFAULT_STAGE_WIDTH;
      const clampedX = clampCameraX(action.cameraX, stageWidth);
      if ((state.currentScene.cameraX || 0) === clampedX) return null;
      return {
        state: {
          ...state,
          currentScene: touchScene({ ...state.currentScene, cameraX: clampedX }, context.now)
        },
        persist: true
      };
    }

    case 'scene/panCamera': {
      const stageWidth = state.currentScene.stageWidth || DEFAULT_STAGE_WIDTH;
      const delta = Number(action.deltaX) || 0;
      if (delta === 0) return null;
      const currentX = state.currentScene.cameraX || 0;
      const clampedX = clampCameraX(currentX + delta, stageWidth);
      if (currentX === clampedX) return null;
      return {
        state: {
          ...state,
          currentScene: touchScene({ ...state.currentScene, cameraX: clampedX }, context.now)
        },
        persist: true
      };
    }

    case 'scene/spawnCharacter': {
      if (state.currentScene.entities.length >= LIMITS.MAX_ENTITIES) return { state: localizedMessage('play.statusSceneFull', {}, state), result: { ok: false, code: 'LIMIT' } };
      const preset = state.presets.find((item) => item.presetId === action.presetId);
      if (!preset) return null;
      const instanceId = nextUniqueId(context.makeId, state.currentScene.entities.map((entity) => entity.instanceId));
      if (!instanceId) return { state: localizedMessage('play.statusSafeId', {}, state), result: { ok: false, code: 'ID_FAILED' } };
      const scene = addEntity(state.currentScene, {
        instanceId,
        kind: 'character',
        sourceId: preset.presetId,
        characterSnapshot: cloneDraft(preset),
        x: action.x,
        y: action.y
      }, context.getAsset);
      return { state: localizedMessage('play.statusCharacterAdded', { name: preset.name }, { ...state, currentScene: scene }), persist: true };
    }

    case 'scene/spawnProp': {
      const asset = context.getAsset(action.assetId);
      if (!asset || asset.kind !== 'prop') return null;
      if (state.currentScene.entities.length >= LIMITS.MAX_ENTITIES) return { state: localizedMessage('play.statusSceneFull', {}, state), result: { ok: false, code: 'LIMIT' } };
      const instanceId = nextUniqueId(context.makeId, state.currentScene.entities.map((entity) => entity.instanceId));
      if (!instanceId) return { state: localizedMessage('play.statusSafeId', {}, state), result: { ok: false, code: 'ID_FAILED' } };

      const targetId = action.targetEntityId ?? null;
      const target = targetId ? state.currentScene.entities.find((e) => e.instanceId === targetId) : null;
      const attachedTo = target ? target.instanceId : null;
      let spawnX = action.x ?? (target ? target.x : 800);
      let spawnY = action.y ?? (target ? target.y - 40 : 720);
      const attachOffset = target ? { dx: Math.round(spawnX - target.x), dy: Math.round(spawnY - target.y) } : null;

      const scene = addEntity(state.currentScene, {
        instanceId, kind: 'prop', sourceId: asset.id, x: spawnX, y: spawnY, attachedTo, attachOffset
      }, context.getAsset);
      return { state: localizedMessage('play.statusPropAdded', { assetId: asset.id }, { ...state, currentScene: scene }), persist: true };
    }

    case 'scene/spawnBubble': {
      if (state.currentScene.entities.length >= LIMITS.MAX_ENTITIES) return { state: localizedMessage('play.statusSceneFull', {}, state), result: { ok: false, code: 'LIMIT' } };
      const instanceId = nextUniqueId(context.makeId, state.currentScene.entities.map((entity) => entity.instanceId));
      if (!instanceId) return { state: localizedMessage('play.statusBubbleId', {}, state), result: { ok: false, code: 'ID_FAILED' } };

      const text = typeof action.text === 'string' ? (normalizeDisplayName(action.text, LIMITS.MAX_BUBBLE_TEXT_LENGTH) || DEFAULT_BUBBLE_TEXT) : DEFAULT_BUBBLE_TEXT;
      const bubbleStyle = isBubbleStyle(action.bubbleStyle) ? action.bubbleStyle : DEFAULT_BUBBLE_STYLE;
      const width = Math.round(clamp(Number(action.width) || LIMITS.DEFAULT_BUBBLE_WIDTH, LIMITS.MIN_BUBBLE_WIDTH, LIMITS.MAX_BUBBLE_WIDTH));

      const targetId = action.targetEntityId ?? (action.x == null && action.y == null ? state.ui.selectedEntityId : null);
      const target = targetId ? state.currentScene.entities.find((e) => e.instanceId === targetId) : null;

      let spawnX = action.x;
      let spawnY = action.y;
      let attachedTo = null;
      let attachOffset = null;

      if (target) {
        if (spawnX == null && spawnY == null) {
          const targetBounds = getEntityBounds(target, context.getAsset);
          spawnX = target.x;
          spawnY = Math.round(target.y - targetBounds.height - 15);
        }
        attachedTo = target.instanceId;
        attachOffset = { dx: Math.round(spawnX - target.x), dy: Math.round(spawnY - target.y) };
      } else {
        spawnX = spawnX ?? 800;
        spawnY = spawnY ?? 350;
      }

      const scene = addEntity(state.currentScene, {
        instanceId,
        kind: 'bubble',
        sourceId: 'bubble',
        text,
        bubbleStyle,
        width,
        x: spawnX,
        y: spawnY,
        attachedTo,
        attachOffset
      }, context.getAsset);

      return {
        state: localizedMessage('play.statusBubbleAdded', {}, {
          ...state,
          currentScene: scene,
          ui: { ...state.ui, selectedEntityId: instanceId }
        }),
        persist: true,
        result: { ok: true, instanceId }
      };
    }

    case 'scene/setBubbleText': {
      const instanceId = action.instanceId ?? state.ui.selectedEntityId;
      if (!instanceId) return null;
      const text = normalizeDisplayName(action.text, LIMITS.MAX_BUBBLE_TEXT_LENGTH);
      if (!text) return null;
      const scene = setBubbleText(state.currentScene, instanceId, text);
      return scene === state.currentScene ? null : { state: { ...state, currentScene: scene }, persist: true };
    }

    case 'scene/setBubbleStyle': {
      const instanceId = action.instanceId ?? state.ui.selectedEntityId;
      if (!instanceId || !isBubbleStyle(action.bubbleStyle)) return null;
      const scene = setBubbleStyle(state.currentScene, instanceId, action.bubbleStyle);
      return scene === state.currentScene ? null : { state: { ...state, currentScene: scene }, persist: true };
    }

    case 'scene/setBubbleWidth': {
      const instanceId = action.instanceId ?? state.ui.selectedEntityId;
      if (!instanceId) return null;
      const scene = setBubbleWidth(state.currentScene, instanceId, action.width);
      return scene === state.currentScene ? null : { state: { ...state, currentScene: scene }, persist: true };
    }

    case 'scene/moveEntity': {
      const scene = moveEntity(state.currentScene, action.instanceId, action.x, action.y, context.getAsset);
      return scene === state.currentScene ? null : { state: { ...state, currentScene: scene }, persist: true };
    }

    case 'scene/flipEntity': {
      const scene = flipEntity(state.currentScene, action.instanceId);
      return scene === state.currentScene ? null : { state: { ...state, currentScene: scene }, persist: true };
    }

    case 'scene/scaleEntity': {
      const scene = scaleEntity(state.currentScene, action.instanceId, action.scale, context.getAsset);
      return scene === state.currentScene ? null : { state: { ...state, currentScene: scene }, persist: true };
    }

    case 'scene/reorderEntity': {
      const scene = reorderEntity(state.currentScene, action.instanceId, action.direction);
      return scene === state.currentScene ? null : { state: { ...state, currentScene: scene }, persist: true };
    }

    case 'scene/deleteEntity': {
      const scene = deleteEntity(state.currentScene, action.instanceId);
      if (scene === state.currentScene) return null;
      const remainingSelected = (state.ui.selectedEntityIds || []).filter((id) => id !== action.instanceId);
      return {
        state: localizedMessage('play.statusItemRemoved', {}, {
          ...state,
          currentScene: scene,
          ui: {
            ...state.ui,
            selectedEntityId: state.ui.selectedEntityId === action.instanceId ? (remainingSelected[0] || null) : state.ui.selectedEntityId,
            selectedEntityIds: remainingSelected
          }
        }),
        persist: true
      };
    }

    case 'scene/deleteEntities': {
      const targetIds = Array.isArray(action.instanceIds) && action.instanceIds.length > 0
        ? action.instanceIds
        : (state.ui.selectedEntityIds.length > 0 ? state.ui.selectedEntityIds : (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : []));
      if (!targetIds.length) return null;
      const scene = deleteEntities(state.currentScene, targetIds);
      if (scene === state.currentScene) return null;
      const idSet = new Set(targetIds);
      const remainingSelected = (state.ui.selectedEntityIds || []).filter((id) => !idSet.has(id));
      return {
        state: localizedMessage('play.statusItemsRemoved', { count: targetIds.length }, {
          ...state,
          currentScene: scene,
          ui: {
            ...state.ui,
            selectedEntityId: remainingSelected[0] || null,
            selectedEntityIds: remainingSelected
          }
        }),
        persist: true
      };
    }

    case 'scene/alignEntities': {
      if (!isAlignmentMode(action.alignment)) return null;
      const targetIds = Array.isArray(action.instanceIds) && action.instanceIds.length >= 2
        ? action.instanceIds
        : (state.ui.selectedEntityIds.length >= 2 ? state.ui.selectedEntityIds : state.currentScene.entities.map((e) => e.instanceId));
      const scene = alignEntities(state.currentScene, targetIds, action.alignment, context.getAsset);
      return scene === state.currentScene ? null : {
        state: localizedMessage('play.statusItemsAligned', { alignment: t(`play.alignmentModes.${action.alignment}`) }, { ...state, currentScene: scene }),
        persist: true
      };
    }

    case 'scene/moveEntities': {
      const scene = moveEntities(state.currentScene, action.moves, context.getAsset);
      return scene === state.currentScene ? null : { state: { ...state, currentScene: scene }, persist: true };
    }

    case 'scene/scaleEntities': {
      const targetIds = Array.isArray(action.instanceIds) && action.instanceIds.length > 0
        ? action.instanceIds
        : (state.ui.selectedEntityIds.length > 0 ? state.ui.selectedEntityIds : (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : []));
      if (!targetIds.length || !Number.isFinite(action.delta)) return null;
      const scene = scaleEntities(state.currentScene, targetIds, action.delta, context.getAsset);
      return scene === state.currentScene ? null : { state: { ...state, currentScene: scene }, persist: true };
    }

    case 'scene/flipEntities': {
      const targetIds = Array.isArray(action.instanceIds) && action.instanceIds.length > 0
        ? action.instanceIds
        : (state.ui.selectedEntityIds.length > 0 ? state.ui.selectedEntityIds : (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : []));
      if (!targetIds.length) return null;
      const scene = flipEntities(state.currentScene, targetIds);
      return scene === state.currentScene ? null : { state: { ...state, currentScene: scene }, persist: true };
    }

    case 'scene/togglePin': {
      const instanceId = action.instanceId ?? state.ui.selectedEntityId;
      const target = state.currentScene.entities.find((e) => e.instanceId === instanceId);
      if (!target) return null;
      const nextPinned = !target.pinned;
      const scene = setEntityPinned(state.currentScene, instanceId, nextPinned);
      return {
        state: localizedMessage(nextPinned ? 'play.statusItemPinned' : 'play.statusItemUnpinned', {}, {
          ...state,
          currentScene: scene
        }),
        persist: true
      };
    }

    case 'scene/togglePinEntities': {
      const targetIds = Array.isArray(action.instanceIds) && action.instanceIds.length > 0
        ? action.instanceIds
        : (state.ui.selectedEntityIds.length > 0 ? state.ui.selectedEntityIds : (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : []));
      if (!targetIds.length) return null;
      const scene = togglePinEntities(state.currentScene, targetIds, action.pinned);
      return scene === state.currentScene ? null : {
        state: localizedMessage('play.statusPinningUpdated', {}, { ...state, currentScene: scene }),
        persist: true
      };
    }

    case 'scene/attachEntity': {
      const childId = action.childInstanceId ?? state.ui.selectedEntityId;
      const parentId = action.parentInstanceId;
      if (!childId || !parentId) return null;
      const scene = attachEntity(state.currentScene, childId, parentId);
      if (scene === state.currentScene) return null;
      return {
        state: localizedMessage('play.statusItemAttached', {}, { ...state, currentScene: scene }),
        persist: true
      };
    }

    case 'scene/detachEntity': {
      const childId = action.instanceId ?? state.ui.selectedEntityId;
      if (!childId) return null;
      const scene = detachEntity(state.currentScene, childId);
      if (scene === state.currentScene) return null;
      return {
        state: localizedMessage('play.statusItemDetached', {}, { ...state, currentScene: scene }),
        persist: true
      };
    }

    case 'scene/duplicateEntity': {
      if (state.currentScene.entities.length >= LIMITS.MAX_ENTITIES || !state.currentScene.entities.some((entity) => entity.instanceId === action.instanceId)) {
        return { state: localizedMessage('play.statusDuplicateFailed', {}, state), result: { ok: false, code: 'LIMIT_OR_NOT_FOUND' } };
      }
      const instanceId = nextUniqueId(context.makeId, state.currentScene.entities.map((entity) => entity.instanceId));
      if (!instanceId) return { state: localizedMessage('play.statusDuplicateId', {}, state), result: { ok: false, code: 'ID_FAILED' } };
      const scene = duplicateEntity(state.currentScene, action.instanceId, instanceId, context.getAsset);
      const duplicate = scene.entities.at(-1);
      return {
        state: localizedMessage('play.statusItemDuplicated', {}, {
          ...state,
          currentScene: scene,
          ui: { ...state.ui, selectedEntityId: duplicate.instanceId, selectedEntityIds: [duplicate.instanceId] }
        }),
        persist: true,
        result: { ok: true, instanceId: duplicate.instanceId }
      };
    }

    case 'scene/duplicateCurrentToLibrary': {
      if (state.scenes.length >= LIMITS.MAX_SCENES) {
        return { state: localizedMessage('play.statusSceneLibraryFullShort', {}, state), result: { ok: false, code: 'LIMIT' } };
      }
      const sceneId = nextUniqueId(context.makeId, state.scenes.map((s) => s.sceneId));
      if (!sceneId) return { state: localizedMessage('play.statusSceneId', {}, state), result: { ok: false, code: 'ID_FAILED' } };
      const stamp = context.now().toISOString();
      const baseTitle = state.currentScene.title !== 'Current Scene' ? state.currentScene.title : 'My Scene';
      const title = truncateGraphemes(action.name || `${baseTitle} (Copy)`, LIMITS.MAX_SCENE_TITLE_LENGTH);
      const entityIdMap = new Map();
      for (const e of state.currentScene.entities) {
        const instanceId = nextUniqueId(context.makeId, [...entityIdMap.values()]);
        if (!instanceId) {
          return {
            state: localizedMessage('play.statusSceneCopyId', {}, state),
            result: { ok: false, code: 'ID_FAILED' }
          };
        }
        entityIdMap.set(e.instanceId, instanceId);
      }
      const clonedEntities = state.currentScene.entities.map((e) => ({
        ...e,
        instanceId: entityIdMap.get(e.instanceId),
        attachedTo: e.attachedTo ? (entityIdMap.get(e.attachedTo) ?? null) : null,
        attachOffset: e.attachOffset ? { ...e.attachOffset } : null,
        characterSnapshot: e.characterSnapshot ? cloneDraft(e.characterSnapshot) : undefined
      }));
      const clonedScene = {
        ...cloneScene(state.currentScene),
        sceneId,
        title,
        createdAt: stamp,
        updatedAt: stamp,
        entities: clonedEntities
      };
      return {
        state: localizedMessage('play.statusSceneSavedCopy', { title }, {
          ...state,
          scenes: [...state.scenes, clonedScene],
          ui: { ...state.ui, activeSceneLibraryId: sceneId }
        }),
        persist: true,
        result: { ok: true, sceneId }
      };
    }

    case 'scene/loadTemplate': {
      const templateScene = instantiateSceneTemplate(action.templateId, context.makeId, state.designer.draft || createStarterDraft(), context.now);
      if (!templateScene) return { state: localizedMessage('play.statusSceneId', {}, state), result: { ok: false, code: 'ID_FAILED' } };
      return {
        state: localizedMessage('play.statusTemplateLoaded', { title: templateScene.title }, {
          ...state,
          currentScene: templateScene,
          ui: { ...state.ui, selectedEntityId: null, selectedEntityIds: [], activeSceneLibraryId: null }
        }),
        persist: true,
        result: { ok: true }
      };
    }

    case 'scene/new': {
      const sceneId = nextUniqueId(context.makeId, []);
      if (!sceneId) return { state: localizedMessage('play.statusSceneId', {}, state), result: { ok: false, code: 'ID_FAILED' } };
      return {
        state: localizedMessage('play.statusNewScene', {}, { ...state, currentScene: createEmptyScene(sceneId, context.now), ui: { ...state.ui, selectedEntityId: null, selectedEntityIds: [], activeSceneLibraryId: null } }),
        persist: true
      };
    }

    case 'scene/setDollExpression': {
      if (!isExpression(action.expression)) return null;
      const targetIds = action.instanceIds || (action.instanceId ? [action.instanceId] : (state.ui.selectedEntityIds?.length ? state.ui.selectedEntityIds : (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : [])));
      const idSet = new Set(targetIds);
      const targetEntities = state.currentScene.entities.filter((e) => idSet.has(e.instanceId) && e.kind === 'character');
      if (targetEntities.length === 0) return null;
      if (targetEntities.every((e) => e.expression === action.expression)) return null;
      const updatedEntities = state.currentScene.entities.map((e) => idSet.has(e.instanceId) && e.kind === 'character' ? { ...e, expression: action.expression } : e);
      return {
        state: {
          ...state,
          currentScene: touchScene({ ...state.currentScene, entities: updatedEntities }, context.now)
        },
        persist: true
      };
    }

    case 'scene/setDollExpressionIntensity': {
      if (!isExpressionIntensity(action.expressionIntensity)) return null;
      const targetIds = action.instanceIds || (action.instanceId ? [action.instanceId] : (state.ui.selectedEntityIds?.length ? state.ui.selectedEntityIds : (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : [])));
      const idSet = new Set(targetIds);
      const targetEntities = state.currentScene.entities.filter((e) => idSet.has(e.instanceId) && e.kind === 'character');
      if (targetEntities.length === 0) return null;
      if (targetEntities.every((e) => e.expressionIntensity === action.expressionIntensity)) return null;
      const updatedEntities = state.currentScene.entities.map((e) => idSet.has(e.instanceId) && e.kind === 'character' ? { ...e, expressionIntensity: action.expressionIntensity } : e);
      return {
        state: {
          ...state,
          currentScene: touchScene({ ...state.currentScene, entities: updatedEntities }, context.now)
        },
        persist: true
      };
    }

    case 'scene/setDollPose': {
      const targetIds = action.instanceIds || (action.instanceId ? [action.instanceId] : (state.ui.selectedEntityIds?.length ? state.ui.selectedEntityIds : (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : [])));
      const idSet = new Set(targetIds);
      const targetEntities = state.currentScene.entities.filter((e) => idSet.has(e.instanceId) && e.kind === 'character');
      if (targetEntities.length === 0) return null;
      let hasChange = false;
      const updatedEntities = state.currentScene.entities.map((e) => {
        if (!idSet.has(e.instanceId) || e.kind !== 'character') return e;
        const motionProfile = resolveMotionProfile(e);
        const safePose = resolveSafePoseId(action.pose, motionProfile);
        if (!safePose || e.pose === safePose) return e;
        hasChange = true;
        return { ...e, pose: safePose };
      });
      if (!hasChange) return null;
      return {
        state: {
          ...state,
          currentScene: touchScene({ ...state.currentScene, entities: updatedEntities }, context.now)
        },
        persist: true
      };
    }

    case 'scene/setDollAnimation': {
      const raw = action.animation;
      if (!raw || typeof raw !== 'object') return null;
      const targetIds = action.instanceIds || (action.instanceId ? [action.instanceId] : (state.ui.selectedEntityIds?.length ? state.ui.selectedEntityIds : (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : [])));
      const idSet = new Set(targetIds);
      const targetEntities = state.currentScene.entities.filter((e) => idSet.has(e.instanceId) && e.kind === 'character');
      if (targetEntities.length === 0) return null;
      let anyAutoPlay = false;
      const updatedEntities = state.currentScene.entities.map((entity) => {
        if (!idSet.has(entity.instanceId) || entity.kind !== 'character') return entity;
        const motionProfile = resolveMotionProfile(entity);
        const rawCandidate = raw.clipId !== undefined ? raw.clipId : (entity.animation?.clipId ?? DEFAULT_MOTION_CLIP_ID);
        const clipId = resolveSafeClipId(rawCandidate, motionProfile);
        const enabled = raw.enabled !== undefined
          ? Boolean(raw.enabled)
          : (raw.clipId !== undefined ? clipId !== 'none' : (entity.animation?.enabled ?? false));
        const animation = {
          clipId,
          enabled,
          intensity: isMotionIntensity(raw.intensity) ? raw.intensity : (entity.animation?.intensity ?? DEFAULT_MOTION_INTENSITY),
          phaseOffset: isPhaseOffset(raw.phaseOffset) ? raw.phaseOffset : (entity.animation?.phaseOffset ?? DEFAULT_PHASE_OFFSET)
        };
        if (animation.enabled && animation.clipId !== 'none') anyAutoPlay = true;
        return { ...entity, animation };
      });
      const currentAnimSettings = state.currentScene.animationSettings || DEFAULT_SCENE_ANIMATION_SETTINGS;
      const nextAnimationSettings = anyAutoPlay && !currentAnimSettings.enabled
        ? { ...currentAnimSettings, enabled: true }
        : currentAnimSettings;
      return {
        state: {
          ...state,
          currentScene: touchScene({ ...state.currentScene, entities: updatedEntities, animationSettings: nextAnimationSettings }, context.now)
        },
        persist: true
      };
    }

    case 'scene/setAnimationSettings': {
      const raw = action.animationSettings;
      if (!raw || typeof raw !== 'object') return null;
      const current = state.currentScene.animationSettings || DEFAULT_SCENE_ANIMATION_SETTINGS;
      const animationSettings = {
        enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : current.enabled,
        loop: raw.loop !== undefined ? Boolean(raw.loop) : current.loop,
        playbackRate: isPlaybackRate(raw.playbackRate) ? raw.playbackRate : (current.playbackRate ?? DEFAULT_PLAYBACK_RATE)
      };
      return {
        state: {
          ...state,
          currentScene: touchScene({ ...state.currentScene, animationSettings }, context.now)
        },
        persist: true
      };
    }

    case 'scene/setPlaybackRate': {
      const rawRate = Number(action.playbackRate);
      if (!isPlaybackRate(rawRate)) return null;
      const current = state.currentScene.animationSettings || DEFAULT_SCENE_ANIMATION_SETTINGS;
      const animationSettings = {
        ...current,
        playbackRate: rawRate
      };
      return {
        state: {
          ...state,
          currentScene: touchScene({ ...state.currentScene, animationSettings }, context.now)
        },
        persist: true
      };
    }

    case 'scene/syncCharacterBeats': {
      const mode = action.mode || 'sync';
      const targetIds = action.instanceIds || (state.ui.selectedEntityIds?.length ? state.ui.selectedEntityIds : (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : null));
      const chars = state.currentScene.entities.filter((e) => e.kind === 'character');
      if (chars.length === 0) return null;

      const targetSet = targetIds ? new Set(targetIds) : null;
      let charIndex = 0;
      const updatedEntities = state.currentScene.entities.map((e) => {
        if (e.kind !== 'character') return e;
        const isTarget = !targetSet || targetSet.has(e.instanceId);
        if (!isTarget) return e;

        let phaseOffset = 0;
        if (mode === 'alternate') {
          phaseOffset = (charIndex % 2) === 1 ? 0.5 : 0;
        } else if (mode === 'wave') {
          phaseOffset = ((charIndex % 4) * 0.25);
        }
        charIndex += 1;

        const currentAnim = e.animation || {
          clipId: DEFAULT_MOTION_CLIP_ID,
          enabled: false,
          intensity: DEFAULT_MOTION_INTENSITY,
          phaseOffset: DEFAULT_PHASE_OFFSET
        };

        return {
          ...e,
          animation: {
            ...currentAnim,
            phaseOffset
          }
        };
      });

      return {
        state: {
          ...state,
          currentScene: touchScene({ ...state.currentScene, entities: updatedEntities }, context.now)
        },
        persist: true
      };
    }

    case 'scene/setAttachJoint': {
      const instanceId = action.instanceId || state.ui.selectedEntityId;
      const attachJoint = action.attachJoint;
      if (!instanceId || !isAttachJoint(attachJoint)) return null;
      const entity = state.currentScene.entities.find((e) => e.instanceId === instanceId);
      if (!entity || !entity.attachedTo) return null;
      const parent = state.currentScene.entities.find((e) => e.instanceId === entity.attachedTo);
      const parentProfile = parent?.kind === 'character' ? resolveMotionProfile(parent) : 'root';
      const effectiveJoint = parentProfile === 'root' ? 'root' : attachJoint;

      const updatedEntities = state.currentScene.entities.map((e) => e.instanceId === instanceId ? { ...e, attachJoint: effectiveJoint } : e);
      return {
        state: {
          ...state,
          currentScene: touchScene({ ...state.currentScene, entities: updatedEntities }, context.now)
        },
        persist: true
      };
    }

    case 'scene/toggleScenePlayback': {
      const current = state.currentScene.animationSettings || DEFAULT_SCENE_ANIMATION_SETTINGS;
      const animationSettings = {
        ...current,
        enabled: !current.enabled
      };
      return {
        state: {
          ...state,
          currentScene: touchScene({ ...state.currentScene, animationSettings }, context.now)
        },
        persist: true
      };
    }

    case 'scene/toggleSceneLoop': {
      const current = state.currentScene.animationSettings || DEFAULT_SCENE_ANIMATION_SETTINGS;
      const animationSettings = {
        ...current,
        loop: !current.loop
      };
      return {
        state: {
          ...state,
          currentScene: touchScene({ ...state.currentScene, animationSettings }, context.now)
        },
        persist: true
      };
    }

    case 'scene/playbackFinished': {
      const current = state.currentScene.animationSettings || DEFAULT_SCENE_ANIMATION_SETTINGS;
      if (!current.enabled) return null;
      const animationSettings = {
        ...current,
        enabled: false
      };
      return {
        state: {
          ...state,
          currentScene: {
            ...state.currentScene,
            animationSettings
          }
        },
        persist: false
      };
    }

    case 'scene/saveToLibrary': {
      const title = normalizeDisplayName(action.name, LIMITS.MAX_SCENE_TITLE_LENGTH) ?? (state.currentScene.title !== 'Current Scene' ? state.currentScene.title : 'My Scene');
      if (!title) return { state: localizedMessage('play.statusSceneTitleRequired', {}, state), result: { ok: false, code: 'INVALID_NAME' } };
      if (state.scenes.length >= LIMITS.MAX_SCENES) return { state: localizedMessage('play.statusSceneLibraryFull', {}, state), result: { ok: false, code: 'LIMIT' } };
      const sceneId = nextUniqueId(context.makeId, state.scenes.map((s) => s.sceneId));
      if (!sceneId) return { state: localizedMessage('play.statusSceneId', {}, state), result: { ok: false, code: 'ID_FAILED' } };
      const stamp = context.now().toISOString();
      const clonedCurrent = cloneScene(state.currentScene);
      const savedScene = {
        ...clonedCurrent,
        sceneId,
        title,
        createdAt: stamp,
        updatedAt: stamp
      };
      return {
        state: localizedMessage('play.statusSceneSaved', { title }, {
          ...state,
          scenes: [...state.scenes, savedScene],
          currentScene: { ...state.currentScene, title, sceneId },
          ui: { ...state.ui, activeSceneLibraryId: sceneId }
        }),
        persist: true,
        result: { ok: true, sceneId }
      };
    }

    case 'scene/updateLibraryScene': {
      const id = action.sceneId ?? state.ui.activeSceneLibraryId ?? state.currentScene.sceneId;
      const index = state.scenes.findIndex((s) => s.sceneId === id);
      if (index < 0) return { state: localizedMessage('play.statusSavedSceneMissing', {}, state), result: { ok: false, code: 'NOT_FOUND' } };
      const title = normalizeDisplayName(action.name, LIMITS.MAX_SCENE_TITLE_LENGTH) ?? state.scenes[index].title;
      const stamp = context.now().toISOString();
      const clonedCurrent = cloneScene(state.currentScene);
      const updated = {
        ...clonedCurrent,
        sceneId: id,
        title,
        createdAt: state.scenes[index].createdAt || stamp,
        updatedAt: stamp
      };
      const scenes = [...state.scenes];
      scenes[index] = updated;
      return {
        state: localizedMessage('play.statusSceneUpdated', { title }, {
          ...state,
          scenes,
          currentScene: { ...state.currentScene, title }
        }),
        persist: true,
        result: { ok: true }
      };
    }

    case 'scene/loadFromLibrary': {
      const found = state.scenes.find((s) => s.sceneId === action.sceneId);
      if (!found) return { state: localizedMessage('play.statusSavedSceneMissing', {}, state), result: { ok: false, code: 'NOT_FOUND' } };
      const loadedScene = cloneScene(found);
      return {
        state: localizedMessage('play.statusSceneLoaded', { title: found.title }, {
          ...state,
          currentScene: loadedScene,
          ui: { ...state.ui, activeSceneLibraryId: found.sceneId, selectedEntityId: null, selectedEntityIds: [] }
        }),
        persist: true,
        result: { ok: true }
      };
    }

    case 'scene/renameLibraryScene': {
      const title = normalizeDisplayName(action.name, LIMITS.MAX_SCENE_TITLE_LENGTH);
      if (!title) return null;
      const target = state.scenes.find((s) => s.sceneId === action.sceneId);
      if (!target) return null;
      const stamp = context.now().toISOString();
      const scenes = state.scenes.map((s) => s.sceneId === action.sceneId ? { ...s, title, updatedAt: stamp } : s);
      const activeCurrent = state.currentScene.sceneId === action.sceneId
        ? { ...state.currentScene, title }
        : state.currentScene;
      return {
        state: localizedMessage('play.statusSceneRenamed', {}, { ...state, scenes, currentScene: activeCurrent }),
        persist: true
      };
    }

    case 'scene/duplicateLibraryScene': {
      if (state.scenes.length >= LIMITS.MAX_SCENES) return { state: localizedMessage('play.statusSceneLibraryFull', {}, state), result: { ok: false, code: 'LIMIT' } };
      const original = state.scenes.find((s) => s.sceneId === action.sceneId);
      if (!original) return null;
      const sceneId = nextUniqueId(context.makeId, state.scenes.map((s) => s.sceneId));
      if (!sceneId) {
        return {
          state: localizedMessage('play.statusSceneId', {}, state),
          result: { ok: false, code: 'ID_FAILED' }
        };
      }
      const stamp = context.now().toISOString();
      const entityIdMap = new Map();
      for (const e of original.entities) {
        const instanceId = nextUniqueId(context.makeId, [...entityIdMap.values()]);
        if (!instanceId) {
          return {
            state: localizedMessage('play.statusSafeId', {}, state),
            result: { ok: false, code: 'ID_FAILED' }
          };
        }
        entityIdMap.set(e.instanceId, instanceId);
      }
      const clonedEntities = original.entities.map((e) => ({
        ...e,
        instanceId: entityIdMap.get(e.instanceId),
        attachedTo: e.attachedTo ? (entityIdMap.get(e.attachedTo) ?? null) : null,
        attachOffset: e.attachOffset ? { ...e.attachOffset } : null,
        characterSnapshot: e.characterSnapshot ? cloneDraft(e.characterSnapshot) : undefined
      }));
      const cloned = {
        ...original,
        sceneId,
        title: truncateGraphemes(`${original.title} (Copy)`, LIMITS.MAX_SCENE_TITLE_LENGTH),
        createdAt: stamp,
        updatedAt: stamp,
        entities: clonedEntities
      };
      return {
        state: localizedMessage('play.statusSceneDuplicated', { title: cloned.title }, { ...state, scenes: [...state.scenes, cloned] }),
        persist: true,
        result: { ok: true, sceneId }
      };
    }

    case 'scene/deleteLibraryScene': {
      const scenes = state.scenes.filter((s) => s.sceneId !== action.sceneId);
      if (scenes.length === state.scenes.length) return null;
      return {
        state: localizedMessage('play.statusSceneRemoved', {}, {
          ...state,
          scenes,
          ui: {
            ...state.ui,
            activeSceneLibraryId: state.ui.activeSceneLibraryId === action.sceneId ? null : state.ui.activeSceneLibraryId
          }
        }),
        persist: true
      };
    }

    case 'scene/clearLibraryScenes': {
      if (state.scenes.length === 0) return null;
      return {
        state: localizedMessage('toasts.allScenesCleared', {}, {
          ...state,
          scenes: [],
          ui: {
            ...state.ui,
            activeSceneLibraryId: null
          }
        }),
        persist: true,
        result: { ok: true }
      };
    }

    default:
      return null;
  }
}
