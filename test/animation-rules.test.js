import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_EXPRESSION_INTENSITY,
  DEFAULT_MOTION_CLIP_ID,
  DEFAULT_MOTION_INTENSITY,
  DEFAULT_PHASE_OFFSET,
  DEFAULT_STATIC_POSE,
  EXPRESSION_INTENSITY_LEVELS,
  isExpressionIntensity,
  isMotionClipId,
  isMotionIntensity,
  isPhaseOffset,
  isStaticPose,
  MOTION_CLIP_IDS,
  MOTION_INTENSITY_LEVELS,
  PHASE_OFFSETS,
  STATIC_POSES
} from '../js/domain/vocabulary.js';
import { getMotionClip, getStaticPoseTransform, MOTION_CLIPS, STATIC_POSE_TRANSFORMS } from '../js/domain/animation-clips.js';
import {
  evaluateCharacterPose,
  evaluateClipAtTime,
  interpolateKeyframes,
  resolveEffectiveMotion,
  smoothCosine
} from '../js/domain/motion-evaluator.js';

test('animation vocabulary defines expression intensities, static poses, motion clips, and predicates', () => {
  assert.equal(DEFAULT_EXPRESSION_INTENSITY, 0.65);
  assert.deepEqual(EXPRESSION_INTENSITY_LEVELS, { subtle: 0.35, normal: 0.65, amplified: 1.0 });
  assert.equal(isExpressionIntensity(0.35), true);
  assert.equal(isExpressionIntensity(0.65), true);
  assert.equal(isExpressionIntensity(1.0), true);
  assert.equal(isExpressionIntensity(-0.1), false);
  assert.equal(isExpressionIntensity(1.2), false);
  assert.equal(isExpressionIntensity('0.5'), false);

  assert.equal(DEFAULT_STATIC_POSE, 'rest');
  assert.deepEqual([...STATIC_POSES], ['rest', 'lean_left', 'lean_right', 'look_left', 'look_right', 'tilt_left', 'tilt_right', 'wave', 'point', 'hands_on_hips', 'arms_up']);
  assert.equal(isStaticPose('rest'), true);
  assert.equal(isStaticPose('lean_left'), true);
  assert.equal(isStaticPose('tilt_left'), true);
  assert.equal(isStaticPose('look_right'), true);
  assert.equal(isStaticPose('wave'), true);
  assert.equal(isStaticPose('point'), true);
  assert.equal(isStaticPose('hands_on_hips'), true);
  assert.equal(isStaticPose('arms_up'), true);
  assert.equal(isStaticPose('unknown_pose'), false);

  assert.equal(DEFAULT_MOTION_CLIP_ID, 'none');
  assert.deepEqual([...MOTION_CLIP_IDS], ['none', 'idle', 'happy_bounce', 'nod', 'sway', 'curious_tilt', 'look_around', 'wave', 'point', 'clap', 'jump', 'dance', 'hello', 'celebrate']);
  assert.equal(isMotionClipId('idle'), true);
  assert.equal(isMotionClipId('happy_bounce'), true);
  assert.equal(isMotionClipId('curious_tilt'), true);
  assert.equal(isMotionClipId('look_around'), true);
  assert.equal(isMotionClipId('hello'), true);
  assert.equal(isMotionClipId('celebrate'), true);
  assert.equal(isMotionClipId('wave'), true);
  assert.equal(isMotionClipId('point'), true);
  assert.equal(isMotionClipId('clap'), true);
  assert.equal(isMotionClipId('jump'), true);
  assert.equal(isMotionClipId('dance'), true);
  assert.equal(isMotionClipId('unknown_clip'), false);

  assert.equal(DEFAULT_MOTION_INTENSITY, 1.0);
  assert.deepEqual(MOTION_INTENSITY_LEVELS, { subtle: 0.5, normal: 1.0, strong: 1.5 });
  assert.equal(isMotionIntensity(1.0), true);
  assert.equal(isMotionIntensity(0.05), false);

  assert.equal(DEFAULT_PHASE_OFFSET, 0);
  assert.deepEqual([...PHASE_OFFSETS], [0, 0.25, 0.5, 0.75]);
  assert.equal(isPhaseOffset(0.25), true);
  assert.equal(isPhaseOffset(-0.1), false);
});

test('motion clips catalog provides frozen, immutable clip definitions with valid durations', () => {
  for (const id of MOTION_CLIP_IDS) {
    const clip = getMotionClip(id);
    assert.ok(clip, `Clip ${id} should exist`);
    assert.equal(clip.clipId, id);
    assert.ok(clip.durationMs > 0);
    assert.ok(Array.isArray(clip.channels?.root));
    assert.ok(clip.channels.root.length >= 2);
  }

  const unknownClip = getMotionClip('unknown_clip');
  assert.equal(unknownClip.clipId, 'none');

  for (const pose of STATIC_POSES) {
    const transform = getStaticPoseTransform(pose);
    assert.ok(transform, `Pose ${pose} transform should exist`);
    assert.ok(Number.isFinite(transform.x));
    assert.ok(Number.isFinite(transform.y));
    assert.ok(Number.isFinite(transform.rotate));
    assert.ok(Number.isFinite(transform.scaleX));
    assert.ok(Number.isFinite(transform.scaleY));
  }
});

test('interpolateKeyframes calculates bounded smooth interpolation across timestamps', () => {
  const frames = [
    { at: 0, val: 0 },
    { at: 0.5, val: 10 },
    { at: 1, val: 0 }
  ];

  assert.equal(interpolateKeyframes(frames, 0, 'val'), 0);
  assert.equal(interpolateKeyframes(frames, 0.5, 'val'), 10);
  assert.equal(interpolateKeyframes(frames, 1, 'val'), 0);
  assert.equal(interpolateKeyframes(frames, -0.5, 'val'), 0);
  assert.equal(interpolateKeyframes(frames, 1.5, 'val'), 0);

  const mid = interpolateKeyframes(frames, 0.25, 'val');
  assert.ok(mid > 0 && mid < 10, 'Mid-point should interpolate smoothly');
  assert.equal(Math.round(mid * 10) / 10, 5);
});

test('evaluateClipAtTime correctly handles looping, phase offset, and intensity multiplier', () => {
  const bounce = getMotionClip('happy_bounce');

  const frame0 = evaluateClipAtTime(bounce, 0);
  assert.equal(frame0.root.x, 0);
  assert.equal(frame0.root.y, 0);

  const apexTime = bounce.durationMs * 0.45;
  const frameApex = evaluateClipAtTime(bounce, apexTime);
  assert.ok(frameApex.root.y < -10, 'Apex should lift character up');
  assert.ok(frameApex.expression.intensityMultiplier > 1.0, 'Apex should amplify expression');

  // Loop wrapping: timestamp + 2 * durationMs should match exact frame
  const frameLooped = evaluateClipAtTime(bounce, apexTime + bounce.durationMs * 2);
  assert.equal(Math.round(frameLooped.root.y), Math.round(frameApex.root.y));

  // Phase offset: 50% offset at time 0 should equal 50% duration with 0 offset
  const framePhase = evaluateClipAtTime(bounce, 0, { phaseOffset: 0.5 });
  const frameDirect = evaluateClipAtTime(bounce, bounce.durationMs * 0.5);
  assert.equal(Math.round(framePhase.root.y * 100), Math.round(frameDirect.root.y * 100));

  // Intensity scaling: 50% intensity should halve translation
  const frameSubtle = evaluateClipAtTime(bounce, apexTime, { intensity: 0.5 });
  assert.equal(Math.round(frameSubtle.root.y * 100), Math.round(frameApex.root.y * 0.5 * 100));
});

test('evaluateCharacterPose composites static pose, root motion, and expression intensity seamlessly', () => {
  const entity = {
    instanceId: 'char-1',
    kind: 'character',
    expression: 'happy',
    expressionIntensity: 0.8,
    pose: 'lean_left',
    animation: {
      clipId: 'idle',
      enabled: true,
      intensity: 1.0,
      phaseOffset: 0
    }
  };

  const poseAt0 = evaluateCharacterPose(entity, 0);
  assert.equal(poseAt0.expression, 'happy');
  assert.equal(poseAt0.expressionIntensity, 0.8);
  assert.equal(poseAt0.root.rotate, -4); // from lean_left
  assert.equal(poseAt0.root.x, -6); // from lean_left

  // When playback is disabled (e.g. paused/static export)
  const staticPose = evaluateCharacterPose(entity, 500, { playbackEnabled: false });
  assert.equal(staticPose.root.x, -6);
  assert.equal(staticPose.root.rotate, -4);
  assert.equal(staticPose.expressionIntensity, 0.8);
  assert.equal(staticPose.isAnimated, false);
});

test('resolveEffectiveMotion enforces user setting over OS preference appropriately', () => {
  assert.equal(resolveEffectiveMotion('reduce', false), false);
  assert.equal(resolveEffectiveMotion('reduce', true), false);
  assert.equal(resolveEffectiveMotion('full', false), true);
  assert.equal(resolveEffectiveMotion('full', true), true);
  assert.equal(resolveEffectiveMotion('system', false), true);
  assert.equal(resolveEffectiveMotion('system', true), false);
});
