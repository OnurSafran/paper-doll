import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SAFE_MOTION_CLIP_IDS,
  SAFE_STATIC_POSES,
  MOTION_CLIP_IDS,
  STATIC_POSES,
  isSafeMotionClipId,
  isSafeStaticPose,
  isMotionProfile,
  MOTION_PROFILES,
  DEFAULT_MOTION_PROFILE
} from '../js/domain/vocabulary.js';
import {
  MOTION_CLIPS,
  STATIC_POSE_TRANSFORMS,
  RIGID_CLIP_FALLBACKS,
  RIGID_POSE_FALLBACKS,
  MOTION_PROFILES_CONFIG,
  resolveMotionProfile,
  resolveSafeClipId,
  resolveSafePoseId,
  getMotionClip,
  getStaticPoseTransform
} from '../js/domain/animation-clips.js';
import {
  evaluateClipAtTime,
  evaluateCharacterPose
} from '../js/domain/motion-evaluator.js';
import { sanitizeEnvelope, createDefaultEnvelope } from '../js/core/state-schema.js';
import { createAppStore } from '../js/core/app-store.js';
import { hasRigidWearableForLimb } from '../js/core/asset-catalog.js';
import { TRANSLATIONS } from '../js/core/i18n.js';
import fs from 'node:fs';
import path from 'node:path';

if (!globalThis.document) {
  class MockElement {
    constructor(tagName) {
      this.tagName = tagName;
      this.attributes = new Map();
      this.style = {
        _props: new Map(),
        setProperty(k, v) { this._props.set(k, String(v)); },
        getPropertyValue(k) { return this._props.get(k) || ''; }
      };
      this.childNodes = [];
      this.parentNode = null;
      this.dataset = {};
    }
    setAttribute(k, v) { this.attributes.set(k, String(v)); }
    getAttribute(k) { return this.attributes.get(k) || null; }
    hasAttribute(k) { return this.attributes.has(k); }
    removeAttribute(k) { this.attributes.delete(k); }
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
      clone.dataset = { ...this.dataset };
      for (const child of this.childNodes) clone.appendChild(child.cloneNode());
      return clone;
    }
    querySelector(selector) {
      const idMatch = selector.match(/^#([a-zA-Z0-9_-]+)/);
      const tagMatch = selector.match(/^[a-zA-Z0-9_-]+/);
      const targetId = idMatch ? idMatch[1] : null;
      const targetTag = tagMatch ? tagMatch[0] : null;

      const find = (el) => {
        if (targetId && el.getAttribute('id') === targetId) return el;
        if (targetTag && el.tagName === targetTag) return el;
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
    createElement(tagName) { return new MockElement(tagName); },
    createElementNS(ns, tagName) { return new MockElement(tagName); }
  };
}

test('Vocabulary defines safe motion clips, safe poses, and motion profiles', () => {
  assert.deepEqual([...SAFE_MOTION_CLIP_IDS], [
    'none',
    'idle',
    'happy_bounce',
    'sway',
    'hello',
    'celebrate',
    'nod',
    'look_around'
  ]);

  assert.deepEqual([...SAFE_STATIC_POSES], [
    'rest',
    'lean_left',
    'lean_right',
    'look_left',
    'look_right',
    'tilt_left',
    'tilt_right'
  ]);

  assert.deepEqual([...MOTION_PROFILES], ['root', 'root-head']);
  assert.equal(DEFAULT_MOTION_PROFILE, 'root-head');
  assert.equal(isMotionProfile('root'), true);
  assert.equal(isMotionProfile('root-head'), true);
  assert.equal(isMotionProfile('full-body-rig'), false);

  for (const id of SAFE_MOTION_CLIP_IDS) {
    assert.equal(isSafeMotionClipId(id), true);
  }
  assert.equal(isSafeMotionClipId('wave'), false);
  assert.equal(isSafeMotionClipId('jump'), false);
  assert.equal(isSafeMotionClipId('dance'), false);

  for (const pose of SAFE_STATIC_POSES) {
    assert.equal(isSafeStaticPose(pose), true);
  }
  assert.equal(isSafeStaticPose('wave'), false);
  assert.equal(isSafeStaticPose('hands_on_hips'), false);
});

test('resolveMotionProfile correctly identifies root vs root-head profiles', () => {
  // Modular doll with standard preset
  const modularDoll = {
    instanceId: 'char-1',
    kind: 'character',
    sourceId: 'doll_classic_a',
    characterSnapshot: { baseDollId: 'doll_classic_a' }
  };
  assert.equal(resolveMotionProfile(modularDoll), 'root-head');

  // Full-body custom painted artwork
  const customFullBodyArt = {
    instanceId: 'char-2',
    kind: 'character',
    sourceId: 'custom_painted_character_1',
    isCustomArt: true,
    characterSnapshot: { customArtId: 'custom_painted_character_1', kind: 'custom_full' }
  };
  assert.equal(resolveMotionProfile(customFullBodyArt), 'root');

  // Custom asset with custom_ prefix without doll_
  const customPrefixedEntity = {
    instanceId: 'char-3',
    kind: 'character',
    sourceId: 'custom_art_123',
    characterSnapshot: {}
  };
  assert.equal(resolveMotionProfile(customPrefixedEntity), 'root');

  // Null/empty fallback
  assert.equal(resolveMotionProfile(null), 'root-head');
});

test('Rigid-safe motion clips: hello and celebrate adhere to conservative transform limits and zero limb channels', () => {
  const helloClip = getMotionClip('hello');
  assert.ok(helloClip, 'hello clip should exist');
  assert.equal(helloClip.loop, true);

  const celebrateClip = getMotionClip('celebrate');
  assert.ok(celebrateClip, 'celebrate clip should exist');
  assert.equal(celebrateClip.loop, true);

  // Evaluate hello clip at multiple timestamps
  for (let t = 0; t <= 1600; t += 200) {
    const evaluated = evaluateClipAtTime(helloClip, t);
    // Root bounds from PRD 17.3 (x <= 6, y <= 3 for greeting, rot <= 4, scale 0.98-1.02)
    assert.ok(Math.abs(evaluated.root.x) <= 6, `hello root.x ${evaluated.root.x} exceeds limit`);
    assert.ok(Math.abs(evaluated.root.y) <= 3, `hello root.y ${evaluated.root.y} exceeds limit`);
    assert.ok(Math.abs(evaluated.root.rotate) <= 4, `hello root.rotate ${evaluated.root.rotate} exceeds limit`);
    assert.ok(evaluated.root.scaleX >= 0.98 && evaluated.root.scaleX <= 1.02);
    assert.ok(evaluated.root.scaleY >= 0.98 && evaluated.root.scaleY <= 1.02);

    // Head bounds from PRD 17.3 (x/y <= 3, rot <= 6)
    assert.ok(Math.abs(evaluated.head.x) <= 3, `hello head.x ${evaluated.head.x} exceeds limit`);
    assert.ok(Math.abs(evaluated.head.y) <= 3, `hello head.y ${evaluated.head.y} exceeds limit`);
    assert.ok(Math.abs(evaluated.head.rotate) <= 6, `hello head.rotate ${evaluated.head.rotate} exceeds limit`);

    // Expression bounds (1.0 - 1.15)
    assert.ok(evaluated.expression.intensityMultiplier >= 1.0 && evaluated.expression.intensityMultiplier <= 1.15);

    // Zero limb channels
    assert.equal(evaluated.armLeft.x, 0);
    assert.equal(evaluated.armLeft.y, 0);
    assert.equal(evaluated.armLeft.rotate, 0);
    assert.equal(evaluated.armRight.x, 0);
    assert.equal(evaluated.armRight.y, 0);
    assert.equal(evaluated.armRight.rotate, 0);
    assert.equal(evaluated.legLeft.x, 0);
    assert.equal(evaluated.legLeft.y, 0);
    assert.equal(evaluated.legLeft.rotate, 0);
    assert.equal(evaluated.legRight.x, 0);
    assert.equal(evaluated.legRight.y, 0);
    assert.equal(evaluated.legRight.rotate, 0);
  }

  // Evaluate celebrate clip at multiple timestamps
  for (let t = 0; t <= 1400; t += 200) {
    const evaluated = evaluateClipAtTime(celebrateClip, t);
    // Root bounds (bounce y <= 10, x <= 6, rot <= 4)
    assert.ok(Math.abs(evaluated.root.x) <= 6, `celebrate root.x ${evaluated.root.x} exceeds limit`);
    assert.ok(Math.abs(evaluated.root.y) <= 10, `celebrate root.y ${evaluated.root.y} exceeds limit`);
    assert.ok(Math.abs(evaluated.root.rotate) <= 4, `celebrate root.rotate ${evaluated.root.rotate} exceeds limit`);

    // Head bounds (x/y <= 3, rot <= 6)
    assert.ok(Math.abs(evaluated.head.x) <= 3);
    assert.ok(Math.abs(evaluated.head.y) <= 3);
    assert.ok(Math.abs(evaluated.head.rotate) <= 6);

    // Expression bounds (1.0 - 1.15)
    assert.ok(evaluated.expression.intensityMultiplier >= 1.0 && evaluated.expression.intensityMultiplier <= 1.15);

    // Zero limb channels
    assert.equal(evaluated.armLeft.x, 0);
    assert.equal(evaluated.armLeft.rotate, 0);
    assert.equal(evaluated.armRight.x, 0);
    assert.equal(evaluated.armRight.rotate, 0);
    assert.equal(evaluated.legLeft.x, 0);
    assert.equal(evaluated.legLeft.rotate, 0);
    assert.equal(evaluated.legRight.x, 0);
    assert.equal(evaluated.legRight.rotate, 0);
  }
});

test('Legacy migration fallbacks: RIGID_CLIP_FALLBACKS and RIGID_POSE_FALLBACKS', () => {
  assert.equal(RIGID_CLIP_FALLBACKS.wave, 'hello');
  assert.equal(RIGID_CLIP_FALLBACKS.point, 'look_around');
  assert.equal(RIGID_CLIP_FALLBACKS.clap, 'celebrate');
  assert.equal(RIGID_CLIP_FALLBACKS.dance, 'sway');
  assert.equal(RIGID_CLIP_FALLBACKS.jump, 'happy_bounce');

  assert.equal(RIGID_POSE_FALLBACKS.wave, 'lean_left');
  assert.equal(RIGID_POSE_FALLBACKS.point, 'look_right');
  assert.equal(RIGID_POSE_FALLBACKS.hands_on_hips, 'rest');
  assert.equal(RIGID_POSE_FALLBACKS.arms_up, 'rest');

  // resolveSafeClipId
  assert.equal(resolveSafeClipId('wave', 'root-head'), 'hello');
  assert.equal(resolveSafeClipId('jump', 'root-head'), 'happy_bounce');
  assert.equal(resolveSafeClipId('dance', 'root-head'), 'sway');
  assert.equal(resolveSafeClipId('clap', 'root-head'), 'celebrate');
  assert.equal(resolveSafeClipId('point', 'root-head'), 'look_around');
  assert.equal(resolveSafeClipId('idle', 'root-head'), 'idle');
  assert.equal(resolveSafeClipId('happy-bounce', 'root-head'), 'happy_bounce');

  // Root profile restricts head-only clips
  assert.equal(resolveSafeClipId('nod', 'root'), 'idle');
  assert.equal(resolveSafeClipId('look_around', 'root'), 'idle');
  assert.equal(resolveSafeClipId('hello', 'root'), 'hello');

  // resolveSafePoseId
  assert.equal(resolveSafePoseId('wave', 'root-head'), 'lean_left');
  assert.equal(resolveSafePoseId('point', 'root-head'), 'look_right');
  assert.equal(resolveSafePoseId('hands_on_hips', 'root-head'), 'rest');
  assert.equal(resolveSafePoseId('arms_up', 'root-head'), 'rest');
  assert.equal(resolveSafePoseId('rest', 'root-head'), 'rest');

  // Root profile restricts head-only poses
  assert.equal(resolveSafePoseId('look_left', 'root'), 'rest');
  assert.equal(resolveSafePoseId('tilt_left', 'root'), 'rest');
  assert.equal(resolveSafePoseId('lean_left', 'root'), 'lean_left');
});

import { getAsset } from '../js/core/asset-catalog.js';

test('State schema sanitizes legacy clips and poses into rigid-safe catalog at the state boundary', () => {
  const legacyScene = {
    sceneId: 'scene_legacy_1',
    title: 'Legacy Scene',
    entities: [
      {
        instanceId: 'char-legacy-1',
        kind: 'character',
        sourceId: 'doll_classic_a',
        characterSnapshot: {
          baseDollId: 'doll_classic_a',
          skinTone: 'peach'
        },
        x: 800,
        y: 700,
        pose: 'wave',
        animation: {
          clipId: 'wave',
          enabled: true,
          intensity: 1.0,
          phaseOffset: 0.25
        }
      },
      {
        instanceId: 'char-legacy-2',
        kind: 'character',
        sourceId: 'doll_classic_b',
        characterSnapshot: {
          baseDollId: 'doll_classic_b',
          skinTone: 'honey'
        },
        x: 600,
        y: 700,
        pose: 'hands_on_hips',
        animation: {
          clipId: 'jump',
          enabled: true,
          intensity: 1.0
        }
      },
      {
        instanceId: 'char-custom-art',
        kind: 'character',
        sourceId: 'custom_full_painting',
        isCustomArt: true,
        characterSnapshot: {
          baseDollId: 'doll_classic_a',
          skinTone: 'peach',
          kind: 'custom_full',
          customArtId: 'custom_full_painting'
        },
        x: 1000,
        y: 700,
        pose: 'look_left',
        animation: {
          clipId: 'nod',
          enabled: true,
          intensity: 1.0
        }
      }
    ]
  };

  const envelope = createDefaultEnvelope();
  envelope.currentScene = legacyScene;
  const sanitized = sanitizeEnvelope(envelope, getAsset);

  const char1 = sanitized.envelope.currentScene.entities.find((e) => e.instanceId === 'char-legacy-1');
  assert.equal(char1.pose, 'lean_left', 'Legacy wave pose should sanitize to lean_left');
  assert.equal(char1.animation.clipId, 'hello', 'Legacy wave clip should sanitize to hello');

  const char2 = sanitized.envelope.currentScene.entities.find((e) => e.instanceId === 'char-legacy-2');
  assert.equal(char2.pose, 'rest', 'Legacy hands_on_hips pose should sanitize to rest');
  assert.equal(char2.animation.clipId, 'happy_bounce', 'Legacy jump clip should sanitize to happy_bounce');

  const customChar = sanitized.envelope.currentScene.entities.find((e) => e.instanceId === 'char-custom-art');
  assert.equal(customChar.pose, 'rest', 'Custom art look_left pose should sanitize to rest');
  assert.equal(customChar.animation.clipId, 'idle', 'Custom art nod clip should sanitize to idle');
});

test('Custom full-body painted art suppresses head and limb transforms in evaluateCharacterPose', () => {
  const customChar = {
    instanceId: 'char-custom',
    kind: 'character',
    sourceId: 'custom_painted_hero',
    isCustomArt: true,
    characterSnapshot: { kind: 'custom_full' },
    pose: 'rest',
    animation: {
      clipId: 'hello',
      enabled: true,
      intensity: 1.0
    }
  };

  const evaluated = evaluateCharacterPose(customChar, 400, { playbackEnabled: true });
  // Root moves
  assert.ok(evaluated.root.x !== 0 || evaluated.root.y !== 0 || evaluated.root.rotate !== 0);

  // Head and limbs are completely suppressed (zero transforms)
  assert.equal(evaluated.head.x, 0);
  assert.equal(evaluated.head.y, 0);
  assert.equal(evaluated.head.rotate, 0);
  assert.equal(evaluated.head.scaleX, 1);
  assert.equal(evaluated.head.scaleY, 1);

  assert.equal(evaluated.armLeft.rotate, 0);
  assert.equal(evaluated.armRight.rotate, 0);
  assert.equal(evaluated.legLeft.rotate, 0);
  assert.equal(evaluated.legRight.rotate, 0);
});

test('UI Contract: index.html exposes only safe poses and safe clips without limb promises', () => {
  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');

  // Verify safe poses are in index.html
  for (const poseId of SAFE_STATIC_POSES) {
    assert.ok(indexHtml.includes(`data-pose="${poseId}"`), `index.html must have button for data-pose="${poseId}"`);
  }

  // Verify limb-specific poses are not present in pose buttons
  assert.ok(!indexHtml.includes('data-pose="hands_on_hips"'));
  assert.ok(!indexHtml.includes('data-pose="arms_up"'));

  // Verify safe clips are in index.html
  for (const clipId of SAFE_MOTION_CLIP_IDS) {
    assert.ok(indexHtml.includes(`data-clip-id="${clipId}"`), `index.html must have button for data-clip-id="${clipId}"`);
  }

  // Verify limb clips are not present in clip buttons
  assert.ok(!indexHtml.includes('data-clip-id="dance"'));
  assert.ok(!indexHtml.includes('data-clip-id="jump"'));
  assert.ok(!indexHtml.includes('data-clip-id="clap"'));
});

test('i18n contains Turkish and English strings for new rigid-safe clips and legacy notice', () => {
  assert.equal(TRANSLATIONS.tr.play.clipHello, 'Selam / Karşılama');
  assert.equal(TRANSLATIONS.tr.play.clipHelloShort, '👋 Selam');
  assert.equal(TRANSLATIONS.tr.play.clipCelebrate, 'Neşeli kutlama');
  assert.equal(TRANSLATIONS.tr.play.clipCelebrateShort, '🎉 Kutla');
  assert.ok(TRANSLATIONS.tr.play.legacyAnimationNotice);

  assert.equal(TRANSLATIONS.en.play.clipHello, 'Hello / Greeting');
  assert.equal(TRANSLATIONS.en.play.clipHelloShort, '👋 Hello');
  assert.equal(TRANSLATIONS.en.play.clipCelebrate, 'Bouncy celebration');
  assert.equal(TRANSLATIONS.en.play.clipCelebrateShort, '🎉 Celebrate');
  assert.ok(TRANSLATIONS.en.play.legacyAnimationNotice);
});

test('AppStore runtime reducers sanitize legacy clip, pose, and attachJoint dispatches', () => {
  const store = createAppStore(createDefaultEnvelope());
  store.dispatch({ type: 'preset/save', name: 'TestDoll' });
  const presetId = store.getState().presets[0].presetId;
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 600, y: 700 });
  const charId = store.getState().currentScene.entities.find((e) => e.kind === 'character').instanceId;

  // Dispatch legacy wave pose
  store.dispatch({ type: 'scene/setDollPose', instanceId: charId, pose: 'wave' });
  let char = store.getState().currentScene.entities.find((e) => e.instanceId === charId);
  assert.equal(char.pose, 'lean_left', 'Runtime setDollPose with wave must resolve to lean_left');

  // Dispatch legacy hands_on_hips pose
  store.dispatch({ type: 'scene/setDollPose', instanceId: charId, pose: 'hands_on_hips' });
  char = store.getState().currentScene.entities.find((e) => e.instanceId === charId);
  assert.equal(char.pose, 'rest', 'Runtime setDollPose with hands_on_hips must resolve to rest');

  // Dispatch legacy wave clip
  store.dispatch({
    type: 'scene/setDollAnimation',
    instanceId: charId,
    animation: { clipId: 'wave', enabled: true, intensity: 1.0 }
  });
  char = store.getState().currentScene.entities.find((e) => e.instanceId === charId);
  assert.equal(char.animation.clipId, 'hello', 'Runtime setDollAnimation with wave must resolve to hello');

  // Dispatch legacy clap clip
  store.dispatch({
    type: 'scene/setDollAnimation',
    instanceId: charId,
    animation: { clipId: 'clap', enabled: true, intensity: 1.0 }
  });
  char = store.getState().currentScene.entities.find((e) => e.instanceId === charId);
  assert.equal(char.animation.clipId, 'celebrate', 'Runtime setDollAnimation with clap must resolve to celebrate');

  // Dispatch legacy dance clip
  store.dispatch({
    type: 'scene/setDollAnimation',
    instanceId: charId,
    animation: { clipId: 'dance', enabled: true, intensity: 1.0 }
  });
  char = store.getState().currentScene.entities.find((e) => e.instanceId === charId);
  assert.equal(char.animation.clipId, 'sway', 'Runtime setDollAnimation with dance must resolve to sway');
});

test('evaluateCharacterPose enforces defense-in-depth safe fallback for legacy IDs', () => {
  const legacyEntity = {
    instanceId: 'char-legacy-eval',
    kind: 'character',
    sourceId: 'doll_classic_a',
    characterSnapshot: { baseDollId: 'doll_classic_a', skinTone: 'peach' },
    pose: 'rest',
    animation: {
      clipId: 'clap',
      enabled: true,
      intensity: 1.0
    }
  };

  const evaluated = evaluateCharacterPose(legacyEntity, 350, { playbackEnabled: true });
  // Clap resolves to celebrate (which has 0 arm transforms)
  assert.equal(evaluated.armLeft.rotate, 0);
  assert.equal(evaluated.armRight.rotate, 0);
  assert.equal(evaluated.legLeft.rotate, 0);
  assert.equal(evaluated.legRight.rotate, 0);
  // Root moves according to celebrate
  assert.ok(evaluated.root.y !== 0);

  const legacyWavePoseEntity = {
    instanceId: 'char-legacy-wave-pose',
    kind: 'character',
    sourceId: 'doll_classic_a',
    characterSnapshot: { baseDollId: 'doll_classic_a', skinTone: 'peach' },
    pose: 'wave',
    animation: {
      clipId: 'none',
      enabled: false
    }
  };
  const evaluatedWavePose = evaluateCharacterPose(legacyWavePoseEntity, 0, { playbackEnabled: false });
  // Wave pose falls back to lean_left (where root leans -4 and arm compensates 3, not -120 gesture)
  assert.equal(evaluatedWavePose.armRight.rotate, 3);
  assert.equal(evaluatedWavePose.root.rotate, -4);
});

test('Rigid wearable fallback detects shoes to prevent leg detachment in footwear-only outfits', () => {
  const shoesOnlyDraft = {
    baseDollId: 'doll_classic_a',
    slots: {
      shoes: { assetId: 'shoes_sneakers' }
    }
  };

  const hasRigidLeg = hasRigidWearableForLimb(shoesOnlyDraft, 'legLeft');
  assert.equal(hasRigidLeg, true, 'hasRigidWearableForLimb must detect rigid shoes');

  // Static lean poses have 0 leg rotations for root kinematic consistency
  const leanLeft = getStaticPoseTransform('lean_left');
  assert.equal(leanLeft.legLeft.rotate, 0);
  assert.equal(leanLeft.legRight.rotate, 0);

  const leanRight = getStaticPoseTransform('lean_right');
  assert.equal(leanRight.legLeft.rotate, 0);
  assert.equal(leanRight.legRight.rotate, 0);
});

test('AppStore handles character phase offset selection and updates entity state', () => {
  const store = createAppStore(createDefaultEnvelope());
  store.dispatch({ type: 'preset/save', name: 'Emma' });
  const presetId = store.getState().presets[0].presetId;
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 800, y: 720 });
  const charId = store.getState().currentScene.entities[0].instanceId;

  store.dispatch({
    type: 'scene/setDollAnimation',
    instanceId: charId,
    animation: {
      clipId: 'happy_bounce',
      phaseOffset: 0.5
    }
  });

  const entity = store.getState().currentScene.entities.find((e) => e.instanceId === charId);
  assert.equal(entity.animation.phaseOffset, 0.5);
  assert.equal(entity.animation.clipId, 'happy_bounce');
});

test('Full-body custom artwork correctly resolves root profile and renders skin layer in export', async () => {
  const { createExportDollSvg } = await import('../js/services/export-service.js');
  
  const customFullDraft = {
    kind: 'custom_full',
    customArtId: 'custom_full_artwork_1',
    slots: {}
  };

  let loadedAssetId = null;
  const mockLoadSvg = async (id) => {
    loadedAssetId = id;
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    return el;
  };

  const customArtRepo = {
    getTrackedObjectUrl: async (id) => `blob:mock-url-${id}`
  };

  const svg = await createExportDollSvg(customFullDraft, 'neutral', {
    loadAssetSvg: mockLoadSvg,
    customArtRepo
  });

  assert.ok(svg, 'Export SVG should be generated for custom full-body art');
  const imageEl = svg.querySelector('image');
  assert.ok(imageEl, 'Custom art image element should be rendered');
  assert.equal(imageEl.getAttribute('href'), 'blob:mock-url-custom_full_artwork_1');
});
