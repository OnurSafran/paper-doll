import {
  isAlignmentMode,
  isAttachJoint,
  isBubbleStyle,
  isExpression,
  isExpressionIntensity,
  isFaceGroup,
  isOutfitSlot,
  isPlaybackRate,
  isPresentationStyle,
  isStageWidth
} from '../../domain/vocabulary.js';
import { isColorValue, isIrisColor, isPaletteToken } from '../palette.js';

export const ACTION_PAYLOAD_VALIDATORS = {
  'ui/setMode': (action) => ['designer', 'paint', 'play'].includes(action.mode),
  'ui/selectEntity': (action) => action.instanceId === null || action.instanceId === undefined || typeof action.instanceId === 'string',
  'ui/selectEntities': (action) => action.instanceIds == null || (Array.isArray(action.instanceIds) && action.instanceIds.every((id) => typeof id === 'string')),
  'ui/toggleEntitySelection': (action) => typeof action.instanceId === 'string',
  'ui/storageStatus': (action) => !action.status || typeof action.status === 'string',
  'ui/setVoicePuppetry': (action) => typeof action.active === 'boolean',

  'designer/selectSlot': (action) => isOutfitSlot(action.slot),
  'designer/equip': (action) => typeof action.assetId === 'string' && (action.color == null || isColorValue(action.color)),
  'designer/remove': (action) => action.slot == null || isOutfitSlot(action.slot),
  'designer/setSkin': (action) => isPaletteToken(action.color),
  'designer/setColor': (action) => isColorValue(action.color) && (action.slot == null || isOutfitSlot(action.slot)),
  'designer/setActiveTab': (action) => action.tab === 'wardrobe' || action.tab === 'face',
  'designer/selectFaceGroup': (action) => isFaceGroup(action.group),
  'designer/setFaceFeature': (action) => isFaceGroup(action.group) && typeof action.assetId === 'string',
  'designer/setIrisColor': (action) => isIrisColor(action.color),
  'designer/setBaseDoll': (action) => typeof action.baseDollId === 'string',
  'designer/setStyleFilter': (action) => isPresentationStyle(action.style),

  'preset/save': (action) => typeof action.name === 'string',
  'preset/rename': (action) => typeof action.name === 'string' && typeof action.presetId === 'string',
  'preset/delete': (action) => typeof action.presetId === 'string',
  'preset/load': (action) => typeof action.presetId === 'string',

  'scene/setBackground': (action) => typeof action.backgroundId === 'string',
  'scene/setStageWidth': (action) => isStageWidth(action.stageWidth),
  'scene/setCameraX': (action) => typeof action.cameraX === 'number' && Number.isFinite(action.cameraX),
  'scene/panCamera': (action) => typeof action.deltaX === 'number' && Number.isFinite(action.deltaX),
  'scene/spawnCharacter': (action) => typeof action.presetId === 'string',
  'scene/spawnProp': (action) => typeof action.assetId === 'string',
  'scene/spawnBubble': (action) => !action.bubbleStyle || isBubbleStyle(action.bubbleStyle),
  'scene/setBubbleText': (action) => typeof action.text === 'string',
  'scene/setBubbleStyle': (action) => isBubbleStyle(action.bubbleStyle),
  'scene/moveEntity': (action) => typeof action.instanceId === 'string' && Number.isFinite(action.x) && Number.isFinite(action.y),
  'scene/scaleEntity': (action) => typeof action.instanceId === 'string' && Number.isFinite(action.scale),
  'scene/alignEntities': (action) => isAlignmentMode(action.alignment),
  'scene/setDollExpression': (action) => isExpression(action.expression),
  'scene/setDollExpressionIntensity': (action) => isExpressionIntensity(action.expressionIntensity),
  'scene/setPlaybackRate': (action) => isPlaybackRate(Number(action.playbackRate)),
  'scene/setAttachJoint': (action) => isAttachJoint(action.attachJoint),

  'customAsset/add': (action) => Boolean(action.asset && typeof action.asset === 'object'),
  'customAsset/rename': (action) => typeof action.assetId === 'string' && typeof action.name === 'string',
  'customAsset/setCollections': (action) => typeof action.assetId === 'string' && Array.isArray(action.collections),
  'customAsset/remove': (action) => typeof action.assetId === 'string',
  'customAsset/restore': (action) => typeof action.assetId === 'string',
  'customAsset/deleteWithUses': (action) => typeof action.assetId === 'string',

  'settings/setReducedMotion': (action) => ['system', 'reduce', 'full'].includes(action.mode),
  'settings/unlockStamp': (action) => typeof action.stampId === 'string' && action.stampId.length > 0 && action.stampId.length <= 50,
  'settings/unlockBackground': (action) => typeof action.backgroundId === 'string'
};

export function validateActionPayload(action) {
  if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
    return { valid: false, reason: 'Action must be an object with a string type' };
  }
  const validator = Object.hasOwn(ACTION_PAYLOAD_VALIDATORS, action.type) ? ACTION_PAYLOAD_VALIDATORS[action.type] : null;
  if (!validator) {
    return { valid: true };
  }
  try {
    const isValid = Boolean(validator(action));
    return {
      valid: isValid,
      reason: isValid ? null : `Action payload invalid for type "${action.type}"`
    };
  } catch (err) {
    return {
      valid: false,
      reason: `Validation error for "${action.type}": ${err?.message || 'unknown'}`
    };
  }
}
