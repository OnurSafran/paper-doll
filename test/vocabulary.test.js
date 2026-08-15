import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSET_KINDS,
  CHARACTER_DIMENSIONS,
  DEFAULT_BACKGROUND_ID,
  DEFAULT_BASE_DOLL_ID,
  DEFAULT_EXPRESSION,
  DEFAULT_GARMENT_COLOR,
  DEFAULT_REDUCED_MOTION,
  DEFAULT_SKIN_TONE,
  ENTITY_KINDS,
  EXPRESSIONS,
  isAssetKind,
  isEntityKind,
  isExpression,
  isOutfitSlot,
  isReducedMotionOption,
  LIMITS,
  OUTFIT_SLOTS,
  REDUCED_MOTION_OPTIONS
} from '../js/domain/vocabulary.js';

test('domain vocabulary defines all 7 expressions and predicate helper', () => {
  assert.equal(EXPRESSIONS.length, 7);
  assert.deepEqual([...EXPRESSIONS], ['neutral', 'smile', 'happy', 'surprised', 'o_mouth', 'talking', 'wide_open']);
  assert.equal(DEFAULT_EXPRESSION, 'neutral');
  assert.ok(Object.isFrozen(EXPRESSIONS));

  for (const expr of EXPRESSIONS) {
    assert.equal(isExpression(expr), true);
  }
  assert.equal(isExpression('angry'), false);
  assert.equal(isExpression(null), false);
  assert.equal(isExpression(123), false);
});

test('domain vocabulary defines outfit slots and predicate helper', () => {
  assert.equal(OUTFIT_SLOTS.length, 6);
  assert.deepEqual([...OUTFIT_SLOTS], ['hair', 'top', 'bottom', 'dress', 'shoes', 'accessory']);
  assert.ok(Object.isFrozen(OUTFIT_SLOTS));

  for (const slot of OUTFIT_SLOTS) {
    assert.equal(isOutfitSlot(slot), true);
  }
  assert.equal(isOutfitSlot('wings'), false);
  assert.equal(isOutfitSlot(undefined), false);
});

test('domain vocabulary defines entity kinds and asset kinds', () => {
  assert.deepEqual([...ENTITY_KINDS], ['character', 'prop', 'bubble']);
  assert.ok(Object.isFrozen(ENTITY_KINDS));
  assert.equal(isEntityKind('character'), true);
  assert.equal(isEntityKind('prop'), true);
  assert.equal(isEntityKind('bubble'), true);
  assert.equal(isEntityKind('background'), false);

  assert.deepEqual([...ASSET_KINDS], ['doll', 'wearable', 'prop', 'background']);
  assert.ok(Object.isFrozen(ASSET_KINDS));
  assert.equal(isAssetKind('doll'), true);
  assert.equal(isAssetKind('wearable'), true);
  assert.equal(isAssetKind('prop'), true);
  assert.equal(isAssetKind('background'), true);
  assert.equal(isAssetKind('sound'), false);
});

test('domain vocabulary defines reduced motion options and defaults', () => {
  assert.deepEqual([...REDUCED_MOTION_OPTIONS], ['system', 'reduce', 'full']);
  assert.equal(DEFAULT_REDUCED_MOTION, 'system');
  assert.ok(Object.isFrozen(REDUCED_MOTION_OPTIONS));
  assert.equal(isReducedMotionOption('system'), true);
  assert.equal(isReducedMotionOption('reduce'), true);
  assert.equal(isReducedMotionOption('full'), true);
  assert.equal(isReducedMotionOption('none'), false);
});

test('domain limits are complete, frozen, and positive numbers', () => {
  assert.ok(Object.isFrozen(LIMITS));
  assert.equal(LIMITS.MAX_PRESETS, 50);
  assert.equal(LIMITS.MAX_ENTITIES, 40);
  assert.equal(LIMITS.MAX_SCENES, 30);
  assert.equal(LIMITS.MAX_PRESET_NAME_LENGTH, 30);
  assert.equal(LIMITS.MAX_SCENE_TITLE_LENGTH, 40);
  assert.equal(LIMITS.MIN_ID_LENGTH, 3);
  assert.equal(LIMITS.MAX_ID_LENGTH, 100);
  assert.equal(LIMITS.MIN_SCALE, 0.5);
  assert.equal(LIMITS.MAX_SCALE, 2.0);
  assert.equal(LIMITS.STAGE_WIDTH, 1600);
  assert.equal(LIMITS.STAGE_HEIGHT, 900);
  assert.equal(LIMITS.MAX_HISTORY, 50);
  assert.equal(LIMITS.AUTOSAVE_DEBOUNCE_MS, 400);
});

test('character dimensions and default IDs are valid', () => {
  assert.ok(Object.isFrozen(CHARACTER_DIMENSIONS));
  assert.ok(Object.isFrozen(CHARACTER_DIMENSIONS.GROUND_ANCHOR));
  assert.equal(CHARACTER_DIMENSIONS.BASE_WIDTH, 235);
  assert.equal(CHARACTER_DIMENSIONS.BASE_HEIGHT, 352.5);
  assert.deepEqual(CHARACTER_DIMENSIONS.GROUND_ANCHOR, { x: 0.5, y: 1.0 });

  assert.equal(DEFAULT_BACKGROUND_ID, 'bg_bedroom');
  assert.equal(DEFAULT_BASE_DOLL_ID, 'doll_classic_a');
  assert.equal(DEFAULT_SKIN_TONE, 'peach');
  assert.equal(DEFAULT_GARMENT_COLOR, 'coral');
});
