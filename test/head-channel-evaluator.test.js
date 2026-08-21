import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_STATIC_POSE,
  MOTION_CLIP_IDS,
  POSE_SUPPORT_LEVELS,
  STATIC_POSES,
  isPoseSupportLevel
} from '../js/domain/vocabulary.js';
import {
  getMotionClip,
  getStaticPoseTransform,
  STATIC_POSE_TRANSFORMS
} from '../js/domain/animation-clips.js';
import {
  evaluateCharacterPose,
  evaluateClipAtTime,
  interpolateKeyframes
} from '../js/domain/motion-evaluator.js';
import { isHeadBoundLayer } from '../js/core/asset-catalog.js';

test('pose support levels and vocabulary predicates are defined', () => {
  assert.deepEqual([...POSE_SUPPORT_LEVELS], ['rigid', 'basic', 'full']);
  assert.equal(isPoseSupportLevel('rigid'), true);
  assert.equal(isPoseSupportLevel('basic'), true);
  assert.equal(isPoseSupportLevel('full'), true);
  assert.equal(isPoseSupportLevel('unknown'), false);
});

test('static poses define valid root and head transforms for all poses', () => {
  for (const pose of STATIC_POSES) {
    const transform = getStaticPoseTransform(pose);
    assert.ok(transform, `Pose ${pose} should exist in transforms`);
    
    // Check root channel
    const root = transform.root || transform;
    assert.ok(Number.isFinite(root.x), `Pose ${pose} root.x should be finite`);
    assert.ok(Number.isFinite(root.y), `Pose ${pose} root.y should be finite`);
    assert.ok(Number.isFinite(root.rotate), `Pose ${pose} root.rotate should be finite`);
    assert.ok(Number.isFinite(root.scaleX), `Pose ${pose} root.scaleX should be finite`);
    assert.ok(Number.isFinite(root.scaleY), `Pose ${pose} root.scaleY should be finite`);

    // Check head channel
    const head = transform.head || { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 };
    assert.ok(Number.isFinite(head.x), `Pose ${pose} head.x should be finite`);
    assert.ok(Number.isFinite(head.y), `Pose ${pose} head.y should be finite`);
    assert.ok(Number.isFinite(head.rotate), `Pose ${pose} head.rotate should be finite`);
    assert.ok(Number.isFinite(head.scaleX), `Pose ${pose} head.scaleX should be finite`);
    assert.ok(Number.isFinite(head.scaleY), `Pose ${pose} head.scaleY should be finite`);
  }

  const tiltLeft = getStaticPoseTransform('tilt_left');
  assert.ok(tiltLeft.head.rotate < -5, 'tilt_left head should rotate counterclockwise');

  const tiltRight = getStaticPoseTransform('tilt_right');
  assert.ok(tiltRight.head.rotate > 5, 'tilt_right head should rotate clockwise');

  const lookLeft = getStaticPoseTransform('look_left');
  assert.ok(lookLeft.head.x < 0, 'look_left head should offset left');

  const lookRight = getStaticPoseTransform('look_right');
  assert.ok(lookRight.head.x > 0, 'look_right head should offset right');
});

test('motion clips evaluate head channel curves across keyframes', () => {
  for (const id of MOTION_CLIP_IDS) {
    const clip = getMotionClip(id);
    const evalAt0 = evaluateClipAtTime(clip, 0);
    assert.ok(evalAt0.root, `Clip ${id} should have evaluated root`);
    assert.ok(evalAt0.head, `Clip ${id} should have evaluated head`);
    assert.ok(Number.isFinite(evalAt0.head.x));
    assert.ok(Number.isFinite(evalAt0.head.y));
    assert.ok(Number.isFinite(evalAt0.head.rotate));
    assert.ok(Number.isFinite(evalAt0.head.scaleX));
    assert.ok(Number.isFinite(evalAt0.head.scaleY));
  }

  // Test nod clip has articulated head motion
  const nod = getMotionClip('nod');
  const nodDown = evaluateClipAtTime(nod, nod.durationMs * 0.25);
  assert.ok(nodDown.head.rotate > 5, 'nod should pitch head down at quarter cycle');
  assert.ok(nodDown.head.y > 2, 'nod should translate head down at quarter cycle');

  // Test curious_tilt clip
  const tiltClip = getMotionClip('curious_tilt');
  const tiltLeft = evaluateClipAtTime(tiltClip, tiltClip.durationMs * 0.25);
  assert.ok(tiltLeft.head.rotate < -5, 'curious_tilt should tilt head left');
  const tiltRight = evaluateClipAtTime(tiltClip, tiltClip.durationMs * 0.8);
  assert.ok(tiltRight.head.rotate > 5, 'curious_tilt should tilt head right');

  // Test look_around clip
  const lookClip = getMotionClip('look_around');
  const lookLeft = evaluateClipAtTime(lookClip, lookClip.durationMs * 0.2);
  assert.ok(lookLeft.head.x < -3, 'look_around should look left');
  const lookRight = evaluateClipAtTime(lookClip, lookClip.durationMs * 0.7);
  assert.ok(lookRight.head.x > 3, 'look_around should look right');
});

test('evaluateCharacterPose composites static pose head and motion clip head seamlessly', () => {
  const entity = {
    instanceId: 'char-head-1',
    kind: 'character',
    expression: 'smile',
    expressionIntensity: 0.7,
    pose: 'tilt_left',
    animation: {
      clipId: 'nod',
      enabled: true,
      intensity: 1.0,
      phaseOffset: 0
    }
  };

  const poseAt0 = evaluateCharacterPose(entity, 0);
  assert.equal(poseAt0.expression, 'smile');
  assert.equal(poseAt0.expressionIntensity, 0.7);
  assert.equal(poseAt0.head.rotate, -10); // from tilt_left

  const nodDuration = getMotionClip('nod').durationMs;
  const poseAtNod = evaluateCharacterPose(entity, nodDuration * 0.25);
  // Composite: tilt_left (-10) + nod down (8) = -2
  assert.equal(Math.round(poseAtNod.head.rotate), -2);
  assert.ok(poseAtNod.head.y > 3, 'Composite head.y should include nod translation');

  // When animation playback is disabled
  const staticOnly = evaluateCharacterPose(entity, nodDuration * 0.25, { playbackEnabled: false });
  assert.equal(staticOnly.head.rotate, -10);
  assert.equal(staticOnly.head.y, 0);
  assert.equal(staticOnly.isAnimated, false);
});

test('isHeadBoundLayer classifies hair, face features, and head accessories as head-bound', () => {
  // Hair slots are head-bound
  assert.equal(isHeadBoundLayer('hair', 'hair_ponytail'), true);
  assert.equal(isHeadBoundLayer('hair', 'hair_short'), true);
  assert.equal(isHeadBoundLayer('hair', 'hair_bun'), true);

  // Face slots are head-bound
  assert.equal(isHeadBoundLayer('face-eyes', 'eyes_classic'), true);
  assert.equal(isHeadBoundLayer('face-eyebrows', 'eyebrows_soft'), true);
  assert.equal(isHeadBoundLayer('face-detail', 'detail_freckles'), true);
  assert.equal(isHeadBoundLayer('face-nose', 'nose_button'), true);
  assert.equal(isHeadBoundLayer('face-mouth', 'mouth_neutral'), true);

  // Head accessories are head-bound
  assert.equal(isHeadBoundLayer('accessory', 'accessory_hat'), true);
  assert.equal(isHeadBoundLayer('accessory', 'accessory_glasses'), true);
  assert.equal(isHeadBoundLayer('accessory', 'accessory_cat_ears'), true);
  assert.equal(isHeadBoundLayer('accessory', 'accessory_crown'), true);
  assert.equal(isHeadBoundLayer('accessory', 'accessory_bow'), true);

  // Non-head slots are NOT head-bound
  assert.equal(isHeadBoundLayer('top', 'top_tshirt'), false);
  assert.equal(isHeadBoundLayer('bottom', 'bottom_jeans'), false);
  assert.equal(isHeadBoundLayer('dress', 'dress_sundress'), false);
  assert.equal(isHeadBoundLayer('shoes', 'shoes_sneakers'), false);
  assert.equal(isHeadBoundLayer('accessory', 'accessory_backpack_child'), false);
  assert.equal(isHeadBoundLayer('accessory', 'accessory_bib_baby'), false);
  assert.equal(isHeadBoundLayer('accessory', 'accessory_shawl_elder'), false);
  assert.equal(isHeadBoundLayer('skin', 'doll_classic_a'), false);
});
