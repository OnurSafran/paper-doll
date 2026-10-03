import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STATIC_POSES,
  SAFE_STATIC_POSES,
  MOTION_CLIP_IDS,
  SAFE_MOTION_CLIP_IDS,
  POSE_CHANNELS,
  isStaticPose,
  isMotionClipId,
  DEFAULT_STATIC_POSE,
  DEFAULT_MOTION_CLIP_ID
} from '../js/domain/vocabulary.js';
import { STATIC_POSE_TRANSFORMS, MOTION_CLIPS, getMotionClip, getStaticPoseTransform } from '../js/domain/animation-clips.js';
import { evaluateClipAtTime, evaluateCharacterPose } from '../js/domain/motion-evaluator.js';
import { ASSETS, getLimbBoundChannel, isLimbBoundLayer } from '../js/core/asset-catalog.js';
import { createExportDollSvg } from '../js/core/doll-svg.js';
import { TRANSLATIONS } from '../js/core/i18n.js';
import fs from 'node:fs';
import path from 'node:path';

// Mock minimal DOM for Node test runner if needed
if (!globalThis.document) {
  class MockElement {
    constructor(tagName) {
      this.tagName = tagName;
      this.attributes = new Map();
      this.style = {
        _props: new Map(),
        setProperty(k, v) { this._props.set(k, v); },
        getPropertyValue(k) { return this._props.get(k); }
      };
      this.childNodes = [];
      this.parentNode = null;
    }
    setAttribute(k, v) { this.attributes.set(k, String(v)); }
    getAttribute(k) { return this.attributes.get(k); }
    appendChild(child) {
      if (child.parentNode) {
        const idx = child.parentNode.childNodes.indexOf(child);
        if (idx >= 0) child.parentNode.childNodes.splice(idx, 1);
      }
      child.parentNode = this;
      this.childNodes.push(child);
      return child;
    }
    get firstChild() { return this.childNodes[0] || null; }
    cloneNode() {
      const clone = new MockElement(this.tagName);
      for (const [k, v] of this.attributes) clone.setAttribute(k, v);
      for (const child of this.childNodes) clone.appendChild(child.cloneNode());
      return clone;
    }
    querySelector(selector) {
      const id = selector.replace(/^[#[\]=]/g, '').replace(/["']/g, '');
      const find = (el) => {
        if (el.getAttribute('id') === id || el.getAttribute('id') === selector.slice(1)) return el;
        for (const child of el.childNodes) {
          const match = find(child);
          if (match) return match;
        }
        return null;
      };
      return find(this);
    }
  }

  globalThis.document = {
    createElementNS: (ns, tag) => new MockElement(tag),
    createElement: (tag) => new MockElement(tag)
  };
}

test('POSE_CHANNELS defines root, head, and 4 articulated limb channels plus expression', () => {
  assert.deepEqual([...POSE_CHANNELS], ['root', 'head', 'armLeft', 'armRight', 'legLeft', 'legRight', 'expression']);
});

test('Static pose catalog contains body and head poses and accepts retired IDs for migration', () => {
  const expectedPoses = [
    'rest', 'lean_left', 'lean_right', 'look_left', 'look_right', 'tilt_left', 'tilt_right',
    'wave', 'point', 'hands_on_hips', 'arms_up'
  ];
  assert.deepEqual([...STATIC_POSES], expectedPoses);

  assert.deepEqual(Object.keys(STATIC_POSE_TRANSFORMS), [...SAFE_STATIC_POSES]);
  for (const poseId of SAFE_STATIC_POSES) {
    assert.equal(isStaticPose(poseId), true, `isStaticPose should return true for ${poseId}`);
    const poseDef = STATIC_POSE_TRANSFORMS[poseId];
    assert.ok(poseDef, `STATIC_POSE_TRANSFORMS must include ${poseId}`);
    assert.ok(poseDef.root, `Pose ${poseId} must have root channel`);
    assert.ok(poseDef.head, `Pose ${poseId} must have head channel`);
    assert.ok(poseDef.armLeft, `Pose ${poseId} must have armLeft channel`);
    assert.ok(poseDef.armRight, `Pose ${poseId} must have armRight channel`);
    assert.ok(poseDef.legLeft, `Pose ${poseId} must have legLeft channel`);
    assert.ok(poseDef.legRight, `Pose ${poseId} must have legRight channel`);
  }

  for (const poseId of ['wave', 'point', 'hands_on_hips', 'arms_up']) {
    assert.equal(STATIC_POSE_TRANSFORMS[poseId], undefined);
    assert.deepEqual(getStaticPoseTransform(poseId), STATIC_POSE_TRANSFORMS.rest);
  }
});

test('Motion clip catalog contains no retired gestures and accepts their IDs for migration', () => {
  const expectedClips = [
    'none', 'idle', 'happy_bounce', 'nod', 'sway', 'curious_tilt', 'look_around',
    'wave', 'point', 'clap', 'jump', 'dance', 'hello', 'celebrate', 'bow', 'wiggle', 'shake_head'
  ];
  assert.deepEqual([...MOTION_CLIP_IDS], expectedClips);

  for (const clipId of Object.keys(MOTION_CLIPS)) {
    assert.equal(isMotionClipId(clipId), true, `isMotionClipId should return true for ${clipId}`);
    const clipDef = MOTION_CLIPS[clipId];
    assert.ok(clipDef, `MOTION_CLIPS must include ${clipId}`);
    assert.ok(clipDef.durationMs >= 0, `Clip ${clipId} durationMs must be >= 0`);
    assert.ok(clipDef.channels, `Clip ${clipId} must have channels object`);

    // Verify all defined channel keyframes are valid numbers
    for (const [channelName, kfs] of Object.entries(clipDef.channels)) {
      if (!Array.isArray(kfs)) continue;
      for (const kf of kfs) {
        assert.ok(Number.isFinite(kf.at), `Keyframe in ${clipId}.${channelName} must have numeric at`);
        if (channelName !== 'expression') {
          assert.ok(Number.isFinite(kf.x), `Keyframe in ${clipId}.${channelName} must have numeric x`);
          assert.ok(Number.isFinite(kf.y), `Keyframe in ${clipId}.${channelName} must have numeric y`);
          assert.ok(Number.isFinite(kf.rotate), `Keyframe in ${clipId}.${channelName} must have numeric rotate`);
          assert.ok(Number.isFinite(kf.scaleX), `Keyframe in ${clipId}.${channelName} must have numeric scaleX`);
          assert.ok(Number.isFinite(kf.scaleY), `Keyframe in ${clipId}.${channelName} must have numeric scaleY`);
        }
      }
    }
  }

  for (const clipId of ['wave', 'point', 'clap', 'jump', 'dance', 'hello']) {
    assert.equal(MOTION_CLIPS[clipId], undefined);
    assert.equal(getMotionClip(clipId).clipId, 'none');
  }
});

test('evaluateCharacterPose migrates gestures to head motion while keeping arms at rest', () => {
  const entity = {
    instanceId: 'char_test_1',
    kind: 'character',
    x: 200,
    y: 300,
    pose: 'wave',
    animation: {
      enabled: true,
      clipId: 'wave',
      intensity: 1.0,
      phaseOffset: 0
    },
    expression: 'happy',
    expressionIntensity: 0.65
  };

  // Static evaluation (playback disabled)
  const staticResult = evaluateCharacterPose(entity, 0, { playbackEnabled: false });
  assert.equal(staticResult.isAnimated, false);
  assert.equal(staticResult.armRight.rotate, 0);
  assert.equal(staticResult.expression, 'happy');

  // Animated evaluation (playback enabled at 300ms)
  const animatedResult = evaluateCharacterPose(entity, 300, { playbackEnabled: true });
  assert.equal(animatedResult.isAnimated, true);
  assert.ok(Number.isFinite(animatedResult.armRight.rotate));
  assert.ok(Number.isFinite(animatedResult.armLeft.rotate));
  assert.ok(Number.isFinite(animatedResult.legLeft.rotate));
  assert.ok(Number.isFinite(animatedResult.legRight.rotate));
  assert.ok(Number.isFinite(animatedResult.head.rotate));
  assert.ok(Number.isFinite(animatedResult.root.y));

  // Intensity scaling: 0.5 intensity should produce half the clip motion delta
  const subtleResult = evaluateCharacterPose({
    ...entity,
    animation: { ...entity.animation, intensity: 0.5 }
  }, 300, { playbackEnabled: true });
  assert.equal(subtleResult.head.rotate - staticResult.head.rotate, (animatedResult.head.rotate - staticResult.head.rotate) * 0.5);
  assert.equal(animatedResult.armRight.rotate, 0);
  assert.equal(animatedResult.armLeft.rotate, 0);
});

test('Remaining poses and clips keep both arms at rest across outfits, times and intensities', () => {
  const rest = { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 };
  for (const slots of [{}, { top: { assetId: 'top_tshirt' } }, { dress: { assetId: 'dress_sundress' } }]) {
    for (const pose of SAFE_STATIC_POSES) {
      for (const clipId of SAFE_MOTION_CLIP_IDS) {
        for (const intensity of [0.5, 1, 3]) {
          for (const time of [0, 350, 1200]) {
            const evaluated = evaluateCharacterPose({
              kind: 'character', pose,
              characterSnapshot: { baseDollId: 'doll_classic_a', slots },
              animation: { clipId, enabled: true, intensity }
            }, time, { playbackEnabled: true });
            assert.deepEqual(evaluated.armLeft, rest, `${pose}/${clipId} left arm`);
            assert.deepEqual(evaluated.armRight, rest, `${pose}/${clipId} right arm`);
          }
        }
      }
    }
  }
});

test('all 6 catalog dolls declare poseSupport: full, joint pivots, and match SVG group structure', () => {
  const dollAssets = ASSETS.filter((a) => a.kind === 'doll');
  assert.equal(dollAssets.length, 6, 'Should have 6 base dolls');

  for (const doll of dollAssets) {
    assert.equal(doll.poseSupport, 'full', `${doll.id} should have poseSupport: full`);
    assert.ok(doll.headPivot && Number.isFinite(doll.headPivot.x) && Number.isFinite(doll.headPivot.y), `${doll.id} headPivot`);
    assert.ok(doll.shoulderLeftPivot && Number.isFinite(doll.shoulderLeftPivot.x) && Number.isFinite(doll.shoulderLeftPivot.y), `${doll.id} shoulderLeftPivot`);
    assert.ok(doll.shoulderRightPivot && Number.isFinite(doll.shoulderRightPivot.x) && Number.isFinite(doll.shoulderRightPivot.y), `${doll.id} shoulderRightPivot`);
    assert.ok(doll.hipLeftPivot && Number.isFinite(doll.hipLeftPivot.x) && Number.isFinite(doll.hipLeftPivot.y), `${doll.id} hipLeftPivot`);
    assert.ok(doll.hipRightPivot && Number.isFinite(doll.hipRightPivot.x) && Number.isFinite(doll.hipRightPivot.y), `${doll.id} hipRightPivot`);

    // Verify SVG file content on disk
    const svgPath = path.resolve(doll.path);
    assert.ok(fs.existsSync(svgPath), `SVG file exists: ${doll.path}`);
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    assert.ok(svgContent.includes('id="pose-head"'), `${doll.id} missing #pose-head`);
    assert.ok(svgContent.includes('id="pose-arm-left"'), `${doll.id} missing #pose-arm-left`);
    assert.ok(svgContent.includes('id="pose-arm-right"'), `${doll.id} missing #pose-arm-right`);
    assert.ok(svgContent.includes('id="pose-leg-left"'), `${doll.id} missing #pose-leg-left`);
    assert.ok(svgContent.includes('id="pose-leg-right"'), `${doll.id} missing #pose-leg-right`);
    assert.ok(svgContent.includes('id="torso"'), `${doll.id} missing #torso`);
  }
});

test('getLimbBoundChannel and isLimbBoundLayer resolve limb accessories', () => {
  assert.equal(getLimbBoundChannel('accessory', 'accessory_rattle_baby'), 'armRight');
  assert.equal(isLimbBoundLayer('accessory', 'accessory_rattle_baby'), true);
  assert.equal(getLimbBoundChannel('accessory', 'accessory_hat'), null);
  assert.equal(isLimbBoundLayer('accessory', 'accessory_hat'), false);
});

test('createExportDollSvg applies limb transforms to SVG joint groups', async () => {
  const mockSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const body = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  body.setAttribute('id', 'body');

  const armLeft = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  armLeft.setAttribute('id', 'pose-arm-left');
  body.appendChild(armLeft);

  const armRight = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  armRight.setAttribute('id', 'pose-arm-right');
  body.appendChild(armRight);

  const head = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  head.setAttribute('id', 'pose-head');
  body.appendChild(head);

  mockSvg.appendChild(body);

  const draft = {
    baseDollId: 'doll_classic_a',
    skinTone: 'peach',
    slots: {}
  };

  const pose = {
    head: { x: 0, y: 0, rotate: 10, scaleX: 1, scaleY: 1 },
    armLeft: { x: 0, y: 0, rotate: 30, scaleX: 1, scaleY: 1 },
    armRight: { x: 0, y: 0, rotate: -80, scaleX: 1, scaleY: 1 },
    legLeft: { x: 0, y: 0, rotate: 5, scaleX: 1, scaleY: 1 },
    legRight: { x: 0, y: 0, rotate: -5, scaleX: 1, scaleY: 1 }
  };

  const exportedSvg = await createExportDollSvg(draft, 'neutral', {
    loadAssetSvg: async () => mockSvg.cloneNode(),
    pose
  });

  const armLeftEl = exportedSvg.querySelector('#pose-arm-left');
  assert.ok(armLeftEl, '#pose-arm-left must exist in exported SVG');
  assert.ok(armLeftEl.getAttribute('transform')?.includes('rotate(30)'), 'armLeft should have rotate(30)');

  const armRightEl = exportedSvg.querySelector('#pose-arm-right');
  assert.ok(armRightEl, '#pose-arm-right must exist in exported SVG');
  assert.ok(armRightEl.getAttribute('transform')?.includes('rotate(-80)'), 'armRight should have rotate(-80)');

  const headEl = exportedSvg.querySelector('#pose-head');
  assert.ok(headEl, '#pose-head must exist in exported SVG');
  assert.ok(headEl.getAttribute('transform')?.includes('rotate(10)'), 'head should have rotate(10)');
});

test('index.html contains buttons for all rigid-safe static poses and motion clips', () => {
  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');

  for (const poseId of SAFE_STATIC_POSES) {
    assert.ok(indexHtml.includes(`data-pose="${poseId}"`), `index.html must have button for data-pose="${poseId}"`);
  }

  for (const clipId of SAFE_MOTION_CLIP_IDS) {
    assert.ok(indexHtml.includes(`data-clip-id="${clipId}"`), `index.html must have button for data-clip-id="${clipId}"`);
  }
});

test('i18n dictionary contains all static poses and motion clips in Turkish and English', () => {
  const tr = TRANSLATIONS.tr.play;
  const en = TRANSLATIONS.en.play;

  const poseKeyMap = {
    rest: ['poseRest', 'poseRestShort'],
    lean_left: ['poseLeanLeft', 'poseLeanLeftShort'],
    lean_right: ['poseLeanRight', 'poseLeanRightShort'],
    look_left: ['poseLookLeft', 'poseLookLeftShort'],
    look_right: ['poseLookRight', 'poseLookRightShort'],
    tilt_left: ['poseTiltLeft', 'poseTiltLeftShort'],
    tilt_right: ['poseTiltRight', 'poseTiltRightShort'],
  };

  for (const [poseId, [titleKey, shortKey]] of Object.entries(poseKeyMap)) {
    assert.ok(tr[titleKey], `TR translation missing ${titleKey} for ${poseId}`);
    assert.ok(tr[shortKey], `TR translation missing ${shortKey} for ${poseId}`);
    assert.ok(en[titleKey], `EN translation missing ${titleKey} for ${poseId}`);
    assert.ok(en[shortKey], `EN translation missing ${shortKey} for ${poseId}`);
  }

  const clipKeyMap = {
    none: ['clipNone', 'clipNoneShort'],
    idle: ['clipIdle', 'clipIdleShort'],
    happy_bounce: ['clipBounce', 'clipBounceShort'],
    celebrate: ['clipCelebrate', 'clipCelebrateShort'],
    nod: ['clipNod', 'clipNodShort'],
    sway: ['clipSway', 'clipSwayShort'],
    curious_tilt: ['clipCuriousTilt', 'clipCuriousTiltShort'],
    look_around: ['clipLookAround', 'clipLookAroundShort'],
  };

  for (const [clipId, [titleKey, shortKey]] of Object.entries(clipKeyMap)) {
    assert.ok(tr[titleKey], `TR translation missing ${titleKey} for ${clipId}`);
    assert.ok(tr[shortKey], `TR translation missing ${shortKey} for ${clipId}`);
    assert.ok(en[titleKey], `EN translation missing ${titleKey} for ${clipId}`);
    assert.ok(en[shortKey], `EN translation missing ${shortKey} for ${clipId}`);
  }
});
