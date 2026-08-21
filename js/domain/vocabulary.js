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

export const EXPRESSION_INTENSITY_LEVELS = Object.freeze({
  subtle: 0.35,
  normal: 0.65,
  amplified: 1.0
});

export const DEFAULT_EXPRESSION_INTENSITY = 0.65;

export function isExpressionIntensity(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

export const POSE_SUPPORT_LEVELS = Object.freeze([
  'rigid',
  'basic',
  'full'
]);

export const DEFAULT_POSE_SUPPORT = 'rigid';

export function isPoseSupportLevel(value) {
  return typeof value === 'string' && POSE_SUPPORT_LEVELS.includes(value);
}

export const STATIC_POSES = Object.freeze([
  'rest',
  'lean_left',
  'lean_right',
  'look_left',
  'look_right',
  'tilt_left',
  'tilt_right',
  'wave',
  'point',
  'hands_on_hips',
  'arms_up'
]);

export const SAFE_STATIC_POSES = Object.freeze([
  'rest',
  'lean_left',
  'lean_right',
  'look_left',
  'look_right',
  'tilt_left',
  'tilt_right'
]);

export const DEFAULT_STATIC_POSE = 'rest';

export function isStaticPose(value) {
  return typeof value === 'string' && STATIC_POSES.includes(value);
}

export function isSafeStaticPose(value) {
  return typeof value === 'string' && SAFE_STATIC_POSES.includes(value);
}

export const MOTION_CLIP_IDS = Object.freeze([
  'none',
  'idle',
  'happy_bounce',
  'nod',
  'sway',
  'curious_tilt',
  'look_around',
  'wave',
  'point',
  'clap',
  'jump',
  'dance',
  'hello',
  'celebrate'
]);

export const SAFE_MOTION_CLIP_IDS = Object.freeze([
  'none',
  'idle',
  'happy_bounce',
  'sway',
  'hello',
  'celebrate',
  'nod',
  'look_around'
]);

export const DEFAULT_MOTION_CLIP_ID = 'none';

export function isMotionClipId(value) {
  return typeof value === 'string' && MOTION_CLIP_IDS.includes(value);
}

export function isSafeMotionClipId(value) {
  return typeof value === 'string' && SAFE_MOTION_CLIP_IDS.includes(value);
}

export const MOTION_PROFILES = Object.freeze([
  'root',
  'root-head'
]);

export const DEFAULT_MOTION_PROFILE = 'root-head';

export function isMotionProfile(value) {
  return typeof value === 'string' && MOTION_PROFILES.includes(value);
}

export const POSE_CHANNELS = Object.freeze([
  'root',
  'head',
  'armLeft',
  'armRight',
  'legLeft',
  'legRight',
  'expression'
]);

export const MOTION_INTENSITY_LEVELS = Object.freeze({
  subtle: 0.5,
  normal: 1.0,
  strong: 1.5
});

export const DEFAULT_MOTION_INTENSITY = 1.0;

export function isMotionIntensity(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.1 && value <= 3.0;
}

export const PHASE_OFFSETS = Object.freeze([
  0,
  0.25,
  0.5,
  0.75
]);

export const DEFAULT_PHASE_OFFSET = 0;

export function isPhaseOffset(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

export const PLAYBACK_RATES = Object.freeze([
  0.5,
  0.75,
  1.0,
  1.25,
  1.5,
  2.0
]);

export const DEFAULT_PLAYBACK_RATE = 1.0;

export function isPlaybackRate(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.25 && value <= 4.0;
}

export const ATTACH_JOINTS = Object.freeze([
  'root',
  'head',
  'armLeft',
  'armRight',
  'legLeft',
  'legRight'
]);

export const DEFAULT_ATTACH_JOINT = 'root';

export function isAttachJoint(value) {
  return typeof value === 'string' && ATTACH_JOINTS.includes(value);
}


export const DEFAULT_SCENE_ANIMATION_SETTINGS = Object.freeze({
  enabled: false,
  loop: true,
  playbackRate: 1.0
});


export const OUTFIT_SLOTS = Object.freeze([
  'hair',
  'top',
  'bottom',
  'dress',
  'shoes',
  'accessory'
]);

export const REFERENCE_DOLL_IDS = Object.freeze([
  'doll_classic_a', 'doll_classic_b', 'doll_chibi_a', 'doll_baby_a', 'doll_adult_a', 'doll_elder_a'
]);

export function isOutfitSlot(value) {
  return typeof value === 'string' && OUTFIT_SLOTS.includes(value);
}

/**
 * Slots emptied by "take off". Hair is deliberately excluded: it reads as part of
 * the character rather than the outfit, so clearing an outfit leaves it in place.
 */
export const CLEARABLE_OUTFIT_SLOTS = Object.freeze(OUTFIT_SLOTS.filter((slot) => slot !== 'hair'));

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

/** Translation key for a bubble style's display name. Unknown styles fall back to the default style. */
export function bubbleStyleLabelKey(style) {
  return `play.bubble${capitalize(isBubbleStyle(style) ? style : DEFAULT_BUBBLE_STYLE)}`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export const FACE_GROUPS = Object.freeze([
  'eyes',
  'eyebrows',
  'nose',
  'mouth',
  'detail'
]);

export function isFaceGroup(value) {
  return typeof value === 'string' && FACE_GROUPS.includes(value);
}

export const FIT_FAMILIES = Object.freeze([
  'baby',
  'child',
  'teen',
  'adult',
  'elder'
]);

export function isFitFamily(value) {
  return typeof value === 'string' && FIT_FAMILIES.includes(value);
}

export const PRESENTATION_STYLES = Object.freeze([
  'all',
  'neutral',
  'feminine',
  'masculine',
  'unsorted'
]);

export function isPresentationStyle(value) {
  return typeof value === 'string' && PRESENTATION_STYLES.includes(value);
}

export const ASSET_KINDS = Object.freeze([
  'doll',
  'wearable',
  'prop',
  'background',
  'face'
]);

export function isAssetKind(value) {
  return typeof value === 'string' && ASSET_KINDS.includes(value);
}

export const PROP_COLLECTION_IDS = Object.freeze([
  'home',
  'outdoors',
  'creative',
  'fun'
]);

export function isPropCollection(value) {
  return typeof value === 'string' && PROP_COLLECTION_IDS.includes(value);
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
export const DEFAULT_IRIS_COLOR = 'cocoa';
