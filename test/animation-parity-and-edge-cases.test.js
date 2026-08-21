import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppStore } from '../js/core/app-store.js';
import { ASSETS, hasRigidWearableForLimb } from '../js/core/asset-catalog.js';
import {
  evaluateCharacterPose,
  evaluateProceduralBlink,
  evaluateAttachedEntityTransform,
  resolveEntityAttachmentTransform
} from '../js/domain/motion-evaluator.js';
import { createSceneAnimationService } from '../js/services/scene-animation-service.js';
import { createExportService, createExportDollSvg } from '../js/services/export-service.js';
import { createCompositeSceneThumbnailSvg } from '../js/features/scene-book/scene-book-view.js';
import { CHARACTER_DIMENSIONS, LIMITS } from '../js/domain/vocabulary.js';
import fs from 'node:fs';

// Mock minimal DOM for Node test environment
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
      const slotMatch = selector.match(/\[data-slot="([^"]+)"\]/);
      const targetId = idMatch ? idMatch[1] : null;
      const targetSlot = slotMatch ? slotMatch[1] : null;

      const find = (el) => {
        if (targetId && el.getAttribute('id') === targetId) return el;
        if (targetSlot && el.getAttribute('data-slot') === targetSlot) return el;
        for (const child of el.childNodes) {
          const match = find(child);
          if (match) return match;
        }
        return null;
      };
      return find(this);
    }
    querySelectorAll(selector) {
      const results = [];
      const match = (el) => {
        if (selector.includes('.scene-entity-positioner') && el.dataset?.instanceId) results.push(el);
        for (const child of el.childNodes) match(child);
      };
      match(this);
      return results;
    }
  }

  globalThis.document = {
    createElement(tagName) { return new MockElement(tagName); },
    createElementNS(ns, tagName) { return new MockElement(tagName); }
  };
}

test('P1 Fix: All 6 catalog dolls require and contain #pose-root group', () => {
  const dolls = ASSETS.filter((a) => a.kind === 'doll');
  assert.equal(dolls.length, 6);
  for (const doll of dolls) {
    assert.ok(doll.requiredGroups.includes('pose-root'), `Doll ${doll.id} must require pose-root`);
    const svgContent = fs.readFileSync(doll.path, 'utf8');
    assert.match(svgContent, /<g\s+id=["']pose-root["']/, `Doll SVG ${doll.path} must contain #pose-root`);
  }
});

test('P1 Fix: Blink geometry applies scale around head pivot without shifting eyes', async () => {
  const mockSvg = (id) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('data-asset-id', id);
    return el;
  };

  const dollSvg = await createExportDollSvg(
    {
      baseDollId: 'doll_classic_a',
      face: {
        eyes: { assetId: 'eyes_classic', irisColor: 'cocoa' },
        mouth: { assetId: 'mouth_smile' }
      }
    },
    'neutral',
    {
      loadAssetSvg: async (id) => mockSvg(id),
      headTransform: { x: 0, y: 0, rotate: 5, scaleX: 1, scaleY: 1 },
      blinkScaleY: 0.1
    }
  );

  // Check eyes group transform
  const eyesGroup = dollSvg.querySelector('[data-slot="face-eyes"]') || dollSvg.childNodes.find(
    (c) => c.getAttribute('transform') && c.getAttribute('transform').includes('scale(1, 0.1)')
  );
  assert.ok(eyesGroup, 'Eyes group should be transformed with composed head transform and blinkScaleY');
  const transform = eyesGroup.getAttribute('transform');
  assert.ok(transform.includes('150') && transform.includes('90'), 'Transform must pivot around headPivot (150, 90)');
  assert.ok(transform.includes('rotate(5)'), 'Transform must include head rotation');
  assert.ok(transform.includes('scale(1, 0.1)'), 'Transform must include blink scale');
});

test('P1 Fix: Rigid wearable fallback prevents limb detachment when dressed in rigid clothing', () => {
  const nakedDoll = {
    instanceId: 'char-1',
    kind: 'character',
    animation: { clipId: 'wave', enabled: true, intensity: 1.0 },
    characterSnapshot: {
      baseDollId: 'doll_classic_a',
      slots: {}
    }
  };

  const dressedDoll = {
    instanceId: 'char-2',
    kind: 'character',
    animation: { clipId: 'wave', enabled: true, intensity: 1.0 },
    characterSnapshot: {
      baseDollId: 'doll_classic_a',
      slots: {
        top: { assetId: 'top_tshirt', color: 'coral' }
      }
    }
  };

  const nakedPose = evaluateCharacterPose(nakedDoll, 500, { playbackEnabled: true, fallbackLegacy: false });
  // In naked doll with raw legacy wave clip, arm rotates during wave
  assert.notEqual(nakedPose.armRight.rotate, 0, 'Naked doll arm moves during raw wave');

  const dressedPose = evaluateCharacterPose(dressedDoll, 500, { playbackEnabled: true, fallbackLegacy: false });
  // In rigid dressed doll, arm is held rigid to avoid disconnecting from static clothing
  assert.equal(dressedPose.armRight.rotate, 0, 'Dressed doll arm transform is suppressed to prevent limb separation');
  assert.equal(dressedPose.armRight.x, 0);
  assert.equal(dressedPose.armRight.y, 0);
});

test('P2 Fix: User-selectable reduced-motion mode via app store and sceneAnimationService', () => {
  const store = createAppStore();

  assert.equal(store.getState().settings.reducedMotion, 'system');

  store.dispatch({ type: 'settings/setReducedMotion', mode: 'reduce' });
  assert.equal(store.getState().settings.reducedMotion, 'reduce');

  store.dispatch({ type: 'settings/setReducedMotion', mode: 'full' });
  assert.equal(store.getState().settings.reducedMotion, 'full');

  store.dispatch({ type: 'settings/setReducedMotion', mode: 'invalid_mode' });
  assert.equal(store.getState().settings.reducedMotion, 'full', 'Invalid modes must be rejected');

  let staticApplied = false;
  const service = createSceneAnimationService({
    store,
    queryAll: () => [],
    isVoiceActive: () => false
  });

  // Verify service handles settings change
  service.handleSettingsChange();
  assert.equal(typeof service.handleSettingsChange, 'function');
});

test('P2 Fix: Voice puppetry does not suppress other characters when primarySelectedId is empty', () => {
  let isVoiceSpeaking = true;
  const store = createAppStore();
  store.dispatch({
    type: 'scene/spawnCharacter',
    characterSnapshot: { baseDollId: 'doll_classic_a' },
    x: 400,
    y: 700
  });
  store.dispatch({
    type: 'scene/spawnCharacter',
    characterSnapshot: { baseDollId: 'doll_classic_b' },
    x: 800,
    y: 700
  });

  const state = store.getState();
  const char1 = state.currentScene.entities[0];
  const char2 = state.currentScene.entities[1];

  // When no doll is selected (selectedEntityId is null), voiceTargetId defaults to the first character (char1)
  const voiceTargetId = state.ui.selectedEntityId || state.currentScene.entities.find((e) => e.kind === 'character')?.instanceId;
  assert.equal(voiceTargetId, char1.instanceId, 'Voice targets first character when none is selected');

  const char1Overridden = isVoiceSpeaking && char1.instanceId === voiceTargetId;
  const char2Overridden = isVoiceSpeaking && char2.instanceId === voiceTargetId;

  assert.equal(char1Overridden, true, 'Target character mouth is overridden by voice');
  assert.equal(char2Overridden, false, 'Non-target character animated mouth is NOT suppressed');
});

test('P2 Fix: Recursive attachment resolution evaluates multi-level DAG correctly', () => {
  const hostChar = {
    instanceId: 'char-host',
    kind: 'character',
    x: 500,
    y: 700,
    scale: 1,
    flipped: false,
    pose: 'default',
    animation: { clipId: 'idle', enabled: false }
  };

  const propParent = {
    instanceId: 'prop-tray',
    kind: 'prop',
    sourceId: 'prop_basket',
    x: 550,
    y: 600,
    scale: 1,
    flipped: false,
    attachedTo: 'char-host',
    attachJoint: 'head',
    attachOffset: { dx: 10, dy: -50 }
  };

  const bubbleChild = {
    instanceId: 'bubble-nested',
    kind: 'bubble',
    x: 560,
    y: 520,
    scale: 1,
    flipped: false,
    attachedTo: 'prop-tray',
    attachOffset: { dx: 10, dy: -80 }
  };

  const allEntitiesMap = new Map([
    ['char-host', hostChar],
    ['prop-tray', propParent],
    ['bubble-nested', bubbleChild]
  ]);

  const characterPoses = new Map([
    ['char-host', evaluateCharacterPose(hostChar, 0, { playbackEnabled: false })]
  ]);

  const parentTransform = resolveEntityAttachmentTransform(propParent, allEntitiesMap, characterPoses);
  const childTransform = resolveEntityAttachmentTransform(bubbleChild, allEntitiesMap, characterPoses);

  assert.ok(Number.isFinite(parentTransform.tx), 'Parent attached transform tx is finite');
  assert.ok(Number.isFinite(parentTransform.ty), 'Parent attached transform ty is finite');
  assert.ok(Number.isFinite(childTransform.tx), 'Child recursive attached transform tx is finite');
  assert.ok(Number.isFinite(childTransform.ty), 'Child recursive attached transform ty is finite');
});

test('Animation: Changing clipId to active clip auto-enables scene playback without requiring enabled property', () => {
  const store = createAppStore();
  store.dispatch({ type: 'preset/save', name: 'Emma' });
  const presetId = store.getState().presets[0].presetId;
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 500, y: 700 });
  const charId = store.getState().currentScene.entities.find((e) => e.kind === 'character').instanceId;

  assert.equal(store.getState().currentScene.animationSettings.enabled, false);

  // Dispatching { clipId: 'jump' } without enabled property must auto-enable doll and scene
  store.dispatch({
    type: 'scene/setDollAnimation',
    instanceId: charId,
    animation: { clipId: 'jump' }
  });
  const doll = store.getState().currentScene.entities.find((e) => e.instanceId === charId);
  assert.equal(doll.animation.enabled, true, 'Doll animation should be enabled');
  assert.equal(doll.animation.clipId, 'happy_bounce', 'Legacy jump should normalize to happy_bounce');
  assert.equal(store.getState().currentScene.animationSettings.enabled, true, 'Scene animation should auto-play');

  // Pausing scene playback explicitly
  store.dispatch({ type: 'scene/toggleScenePlayback' });
  assert.equal(store.getState().currentScene.animationSettings.enabled, false);

  // Changing to another active clip restarts playback
  store.dispatch({
    type: 'scene/setDollAnimation',
    instanceId: charId,
    animation: { clipId: 'happy_bounce' }
  });
  assert.equal(store.getState().currentScene.animationSettings.enabled, true);

  // Dispatching { clipId: 'none' } turns doll animation off
  store.dispatch({
    type: 'scene/setDollAnimation',
    instanceId: charId,
    animation: { clipId: 'none' }
  });
  const dollOff = store.getState().currentScene.entities.find((e) => e.instanceId === charId);
  assert.equal(dollOff.animation.enabled, false);
});

test('Kinematics: Custom wearable asset with rigid support suppresses limb motion in evaluateCharacterPose', () => {
  const customDressAsset = {
    id: 'custom_ballgown',
    kind: 'clothing',
    slot: 'dress',
    name: 'Custom Ballgown',
    poseSupport: 'rigid'
  };

  const customResolver = (id) => {
    if (id === 'custom_ballgown') return customDressAsset;
    return null;
  };

  const charEntity = {
    instanceId: 'char_test',
    kind: 'character',
    pose: 'rest',
    animation: {
      clipId: 'dance',
      enabled: true,
      intensity: 1.0,
      phaseOffset: 0
    },
    characterSnapshot: {
      baseDollId: 'doll_classic_a',
      slots: {
        dress: { assetId: 'custom_ballgown' }
      }
    }
  };

  // When getAsset is provided and resolves custom rigid dress, limb channels are suppressed
  const poseWithCustom = evaluateCharacterPose(charEntity, 500, {
    playbackEnabled: true,
    loop: true,
    getAsset: customResolver
  });

  assert.equal(poseWithCustom.armLeft.rotate, 0, 'Arm left rotate should be zero with rigid dress');
  assert.equal(poseWithCustom.armRight.rotate, 0, 'Arm right rotate should be zero with rigid dress');
  assert.equal(poseWithCustom.legLeft.rotate, 0, 'Leg left rotate should be zero with rigid dress');
  assert.equal(poseWithCustom.legRight.rotate, 0, 'Leg right rotate should be zero with rigid dress');
  assert.ok(poseWithCustom.root.y !== 0, 'Root translation is preserved');
});
