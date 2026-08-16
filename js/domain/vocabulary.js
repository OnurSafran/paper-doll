/**
 * Centralized Domain Vocabulary and Schema Constants
 * Single authority for domain enums, expressions, slots, limits, and validation helpers.
 */

export const EXPRESSIONS = Object.freeze([
  'neutral',
  'smile',
  'happy',
  'surprised',
  'o_mouth',
  'talking',
  'wide_open'
]);

export const DEFAULT_EXPRESSION = 'neutral';

export function isExpression(value) {
  return typeof value === 'string' && EXPRESSIONS.includes(value);
}

export const OUTFIT_SLOTS = Object.freeze([
  'hair',
  'top',
  'bottom',
  'dress',
  'shoes',
  'accessory'
]);

export function isOutfitSlot(value) {
  return typeof value === 'string' && OUTFIT_SLOTS.includes(value);
}

export const ENTITY_KINDS = Object.freeze([
  'character',
  'prop',
  'bubble'
]);

export function isEntityKind(value) {
  return typeof value === 'string' && ENTITY_KINDS.includes(value);
}

export const BUBBLE_STYLES = Object.freeze([
  'speech',
  'thought',
  'shout',
  'caption'
]);

export const DEFAULT_BUBBLE_STYLE = 'speech';
export const DEFAULT_BUBBLE_TEXT = 'Hello!';

export function isBubbleStyle(value) {
  return typeof value === 'string' && BUBBLE_STYLES.includes(value);
}

export const ASSET_KINDS = Object.freeze([
  'doll',
  'wearable',
  'prop',
  'background'
]);

export function isAssetKind(value) {
  return typeof value === 'string' && ASSET_KINDS.includes(value);
}

export const REDUCED_MOTION_OPTIONS = Object.freeze([
  'system',
  'reduce',
  'full'
]);

export const DEFAULT_REDUCED_MOTION = 'system';

export function isReducedMotionOption(value) {
  return typeof value === 'string' && REDUCED_MOTION_OPTIONS.includes(value);
}

export const ALIGNMENT_MODES = Object.freeze([
  'left',
  'center',
  'right',
  'top',
  'middle',
  'bottom',
  'distribute-h',
  'distribute-v'
]);

export function isAlignmentMode(value) {
  return typeof value === 'string' && ALIGNMENT_MODES.includes(value);
}

export const ID_PATTERN = /^[A-Za-z0-9_-]{3,100}$/;

export function isValidId(value) {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

export const CUSTOM_ID_PREFIX = 'custom_';

export function isCustomAssetId(value) {
  return typeof value === 'string' && value.startsWith(CUSTOM_ID_PREFIX) && isValidId(value);
}

export const CUSTOM_ASSET_STATUSES = Object.freeze([
  'available',
  'missing',
  'trashed'
]);

export function isCustomAssetStatus(value) {
  return typeof value === 'string' && CUSTOM_ASSET_STATUSES.includes(value);
}

export const MVP_CUSTOM_WEARABLE_SLOTS = Object.freeze([
  'top',
  'bottom',
  'dress',
  'shoes',
  'accessory'
]);

export function isMvpCustomWearableSlot(value) {
  return typeof value === 'string' && MVP_CUSTOM_WEARABLE_SLOTS.includes(value);
}

export function defaultMakeId() {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultNow() {
  return new Date();
}

export const LIMITS = Object.freeze({
  MAX_PRESETS: 50,
  MAX_ENTITIES: 40,
  MAX_SCENES: 30,
  MAX_PRESET_NAME_LENGTH: 30,
  MAX_SCENE_TITLE_LENGTH: 40,
  MAX_BUBBLE_TEXT_LENGTH: 120,
  DEFAULT_BUBBLE_WIDTH: 240,
  MIN_BUBBLE_WIDTH: 140,
  MAX_BUBBLE_WIDTH: 420,
  MIN_ID_LENGTH: 3,
  MAX_ID_LENGTH: 100,
  MAX_IMPORT_BYTES: 5 * 1024 * 1024,
  MAX_CUSTOM_ASSETS: 30,
  MAX_CUSTOM_ASSET_BYTES: 2 * 1024 * 1024,
  MAX_TOTAL_CUSTOM_BYTES: 30 * 1024 * 1024,
  MAX_PACKAGE_BYTES: 45 * 1024 * 1024,
  MAX_CUSTOM_ASSET_NAME_LENGTH: 30,
  MIN_SCALE: 0.5,
  MAX_SCALE: 2.0,
  STAGE_WIDTH: 1600,
  STAGE_HEIGHT: 900,
  MAX_HISTORY: 50,
  AUTOSAVE_DEBOUNCE_MS: 400
});

export const STAGE_WIDTHS = Object.freeze([1600, 3200, 4800]);
export const DEFAULT_STAGE_WIDTH = 1600;
export const VIEWPORT_WIDTH = 1600;
export const VIEWPORT_HEIGHT = 900;

export function isStageWidth(value) {
  return typeof value === 'number' && STAGE_WIDTHS.includes(value);
}

export const CAMERA_CONSTANTS = Object.freeze({
  DEFAULT_CAMERA_X: 0,
  STEP: 300,
  EDGE_ZONE: 70,
  EDGE_SPEED: 18
});

export const CHARACTER_DIMENSIONS = Object.freeze({
  BASE_WIDTH: 235,
  BASE_HEIGHT: 352.5,
  GROUND_ANCHOR: Object.freeze({ x: 0.5, y: 1.0 })
});

export const CUSTOM_WEARABLE_DIMENSIONS = Object.freeze({
  LOGICAL_WIDTH: 300,
  LOGICAL_HEIGHT: 450,
  PIXEL_WIDTH: 600,
  PIXEL_HEIGHT: 900
});

export const CUSTOM_PROP_DIMENSIONS = Object.freeze({
  LOGICAL_WIDTH: 500,
  LOGICAL_HEIGHT: 500,
  PIXEL_WIDTH: 1000,
  PIXEL_HEIGHT: 1000
});

export const DEFAULT_BACKGROUND_ID = 'bg_bedroom';
export const DEFAULT_BASE_DOLL_ID = 'doll_classic_a';
export const DEFAULT_SKIN_TONE = 'peach';
export const DEFAULT_GARMENT_COLOR = 'coral';
