import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_IRIS_COLOR,
  FACE_GROUPS,
  FIT_FAMILIES,
  PRESENTATION_STYLES,
  isFaceGroup,
  isFitFamily,
  isPresentationStyle
} from '../js/domain/vocabulary.js';
import { IRIS_COLORS, isIrisColor } from '../js/core/palette.js';
import { facesByGroup, getAsset, ASSETS } from '../js/core/asset-catalog.js';
import {
  clearFaceDetail,
  countAssetUses,
  createDefaultFace,
  createStarterDraft,
  DEFAULT_FACE_BY_DOLL,
  resetFace,
  setFaceFeature,
  setIrisColor
} from '../js/domain/outfit-rules.js';
import {
  createDefaultEnvelope,
  SCHEMA_VERSION,
  sanitizeDraft,
  sanitizeEnvelope
} from '../js/core/state-schema.js';
import { createAppStore } from '../js/core/app-store.js';

test('vocabulary defines face groups, iris colors, fit families, and styles', () => {
  assert.deepEqual([...FACE_GROUPS], ['eyes', 'eyebrows', 'nose', 'mouth', 'detail']);
  assert.equal(isFaceGroup('eyes'), true);
  assert.equal(isFaceGroup('detail'), true);
  assert.equal(isFaceGroup('hat'), false);

  assert.equal(DEFAULT_IRIS_COLOR, 'cocoa');
  assert.deepEqual([...IRIS_COLORS], ['cocoa', 'honey', 'sage', 'sky', 'charcoal', 'lavender']);
  assert.equal(isIrisColor('cocoa'), true);
  assert.equal(isIrisColor('sky'), true);
  assert.equal(isIrisColor('neon-pink'), false);

  assert.deepEqual([...FIT_FAMILIES], ['baby', 'child', 'teen', 'adult', 'elder']);
  assert.equal(isFitFamily('teen'), true);
  assert.equal(isFitFamily('giant'), false);

  assert.deepEqual([...PRESENTATION_STYLES], ['all', 'neutral', 'feminine', 'masculine', 'unsorted']);
  assert.equal(isPresentationStyle('neutral'), true);
  assert.equal(isPresentationStyle('gothic'), false);
});

test('asset catalog registers all 19 modular face features across groups', () => {
  const eyes = facesByGroup('eyes');
  assert.equal(eyes.length, 5);
  assert.ok(eyes.some((a) => a.id === 'eyes_classic'));
  assert.ok(eyes.some((a) => a.id === 'eyes_round'));
  assert.ok(eyes.some((a) => a.id === 'eyes_sparkle'));
  assert.ok(eyes.some((a) => a.id === 'eyes_calm'));
  assert.ok(eyes.some((a) => a.id === 'eyes_curious'));

  const eyebrows = facesByGroup('eyebrows');
  assert.equal(eyebrows.length, 4);
  assert.ok(eyebrows.some((a) => a.id === 'brows_soft'));
  assert.ok(eyebrows.some((a) => a.id === 'brows_arched'));
  assert.ok(eyebrows.some((a) => a.id === 'brows_bold'));
  assert.ok(eyebrows.some((a) => a.id === 'brows_expressive'));

  const noses = facesByGroup('nose');
  assert.equal(noses.length, 3);
  assert.ok(noses.some((a) => a.id === 'nose_dot'));
  assert.ok(noses.some((a) => a.id === 'nose_button'));
  assert.ok(noses.some((a) => a.id === 'nose_soft_curve'));

  const mouths = facesByGroup('mouth');
  assert.equal(mouths.length, 5);
  assert.ok(mouths.some((a) => a.id === 'mouth_gentle_smile'));
  assert.ok(mouths.some((a) => a.id === 'mouth_open_smile'));
  assert.ok(mouths.some((a) => a.id === 'mouth_neutral'));
  assert.ok(mouths.some((a) => a.id === 'mouth_playful'));
  assert.ok(mouths.some((a) => a.id === 'mouth_smirk'));

  const details = facesByGroup('detail');
  assert.equal(details.length, 2);
  assert.ok(details.some((a) => a.id === 'detail_blush'));
  assert.ok(details.some((a) => a.id === 'detail_freckles'));
});

test('asset catalog dolls have fitFamily metadata and wearables have supportedFitFamilies', () => {
  const classicA = getAsset('doll_classic_a');
  assert.equal(classicA.fitFamily, 'teen');
  assert.deepEqual(classicA.lifeStages, ['teen']);
  assert.deepEqual(classicA.presentationStyles, ['neutral']);

  const chibi = getAsset('doll_chibi_a');
  assert.equal(chibi.fitFamily, 'child');

  const tshirt = getAsset('top_tshirt');
  assert.deepEqual(tshirt.supportedFitFamilies, ['teen']);
});

test('outfit rules creates default face for dolls and handles face mutations', () => {
  // doll_classic_a default face: detail is null
  const defaultClassicA = createDefaultFace('doll_classic_a');
  assert.equal(defaultClassicA.eyes.assetId, 'eyes_classic');
  assert.equal(defaultClassicA.eyes.irisColor, 'cocoa');
  assert.equal(defaultClassicA.eyebrows.assetId, 'brows_soft');
  assert.equal(defaultClassicA.nose.assetId, 'nose_dot');
  assert.equal(defaultClassicA.mouth.assetId, 'mouth_gentle_smile');
  assert.equal(defaultClassicA.detail, null);

  // doll_classic_b default face: eyes_sparkle, detail_blush
  const defaultClassicB = createDefaultFace('doll_classic_b');
  assert.equal(defaultClassicB.eyes.assetId, 'eyes_sparkle');
  assert.equal(defaultClassicB.detail.assetId, 'detail_blush');

  // doll_chibi_a default face: eyes_round, detail_blush
  const defaultChibi = createDefaultFace('doll_chibi_a');
  assert.equal(defaultChibi.eyes.assetId, 'eyes_round');
  assert.equal(defaultChibi.nose.assetId, 'nose_button');
  assert.equal(defaultChibi.detail.assetId, 'detail_blush');

  const draft = createStarterDraft();
  assert.ok(draft.face);
  assert.equal(draft.face.eyes.assetId, 'eyes_classic');

  // Change eye style
  const changedEyes = setFaceFeature(draft, 'eyes', 'eyes_sparkle');
  assert.equal(changedEyes.changed, true);
  assert.equal(changedEyes.draft.face.eyes.assetId, 'eyes_sparkle');
  assert.equal(changedEyes.draft.face.eyes.irisColor, 'cocoa');
  const invalidEyes = setFaceFeature(draft, 'eyes', 'nose_dot', getAsset);
  assert.equal(invalidEyes.changed, false);

  // Change iris color
  const changedIris = setIrisColor(changedEyes.draft, 'sky');
  assert.equal(changedIris.changed, true);
  assert.equal(changedIris.draft.face.eyes.irisColor, 'sky');

  // Change nose
  const changedNose = setFaceFeature(changedIris.draft, 'nose', 'nose_button');
  assert.equal(changedNose.changed, true);
  assert.equal(changedNose.draft.face.nose.assetId, 'nose_button');

  // Set a detail first, then clear it
  const withDetail = setFaceFeature(changedNose.draft, 'detail', 'detail_blush');
  assert.equal(withDetail.changed, true);
  assert.equal(withDetail.draft.face.detail.assetId, 'detail_blush');
  const clearedDetail = clearFaceDetail(withDetail.draft);
  assert.equal(clearedDetail.changed, true);
  assert.equal(clearedDetail.draft.face.detail, null);

  // Reset face
  const restored = resetFace(clearedDetail.draft);
  assert.equal(restored.changed, true);
  assert.equal(restored.draft.face.eyes.assetId, 'eyes_classic');
  assert.equal(restored.draft.face.eyes.irisColor, 'cocoa');
  assert.equal(restored.draft.face.detail, null); // doll_classic_a default has no detail
});

test('state schema v4 sanitization and v3 migration', () => {
  assert.equal(SCHEMA_VERSION, 4);

  // v3 envelope migrates to v4 and injects default face into presets and scene character entities
  const legacyV3 = {
    schemaVersion: 3,
    savedAt: '2026-08-16T12:00:00Z',
    settings: { reducedMotion: 'system', soundEnabled: true },
    presets: [{
      presetId: 'p-1',
      name: 'Legacy Doll',
      baseDollId: 'doll_classic_a',
      skinTone: 'peach',
      slots: { hair: null, top: null, bottom: null, dress: null, shoes: null, accessory: null }
    }],
    scenes: [],
    currentScene: {
      sceneId: 'sc-1',
      title: 'Stage',
      backgroundId: 'bg_bedroom',
      entities: [{
        instanceId: 'char-1',
        kind: 'character',
        sourceId: 'doll_classic_b',
        x: 400,
        y: 600,
        scale: 1,
        order: 1,
        characterSnapshot: {
          baseDollId: 'doll_classic_b',
          skinTone: 'honey',
          slots: { hair: null, top: null, bottom: null, dress: null, shoes: null, accessory: null }
        }
      }]
    }
  };

  const sanitized = sanitizeEnvelope(legacyV3, getAsset);
  assert.equal(sanitized.envelope.schemaVersion, 4);
  assert.equal(sanitized.migrated, true);
  assert.equal(sanitized.recovered, true);

  // Preset uses doll_classic_a → default face: eyes_classic, detail null
  assert.ok(sanitized.envelope.presets[0].face);
  assert.equal(sanitized.envelope.presets[0].face.eyes.assetId, 'eyes_classic');
  assert.equal(sanitized.envelope.presets[0].face.detail, null);

  // Scene entity uses doll_classic_b → default face: eyes_sparkle, detail_blush
  assert.ok(sanitized.envelope.currentScene.entities[0].characterSnapshot.face);
  assert.equal(sanitized.envelope.currentScene.entities[0].characterSnapshot.face.eyes.assetId, 'eyes_sparkle');
  assert.equal(sanitized.envelope.currentScene.entities[0].characterSnapshot.face.detail.assetId, 'detail_blush');

  // Draft with corrupted face safely repairs
  const brokenDraft = {
    baseDollId: 'doll_classic_a',
    skinTone: 'peach',
    face: {
      eyes: { assetId: 'non_existent_eyes', irisColor: 'radioactive' },
      eyebrows: null,
      nose: { assetId: 'invalid_nose' },
      mouth: 'not-an-object',
      detail: { assetId: 'invalid_detail' }
    },
    slots: {}
  };
  const sanitizedDraft = sanitizeDraft(brokenDraft, getAsset);
  assert.equal(sanitizedDraft.face.eyes.assetId, 'eyes_classic');
  assert.equal(sanitizedDraft.face.eyes.irisColor, 'cocoa');
  assert.equal(sanitizedDraft.face.eyebrows.assetId, 'brows_soft');
  assert.equal(sanitizedDraft.face.nose.assetId, 'nose_dot');
  assert.equal(sanitizedDraft.face.mouth.assetId, 'mouth_gentle_smile');
  assert.equal(sanitizedDraft.face.detail, null);
});

test('invalid face groups produce group-level recovery warnings', () => {
  const result = sanitizeEnvelope({
    schemaVersion: 4,
    presets: [{
      presetId: 'p-face-warning',
      name: 'Face warning',
      baseDollId: 'doll_classic_a',
      skinTone: 'peach',
      face: { eyes: { assetId: 'not-a-face' } },
      slots: { hair: null, top: null, bottom: null, dress: null, shoes: null, accessory: null }
    }],
    scenes: [],
    currentScene: null
  }, getAsset);

  assert.ok(result.envelope.presets[0].face.eyes.assetId === 'eyes_classic');
  assert.ok(result.warnings.some((warning) => warning.includes('eyes')));
});

test('AppStore handles designer face actions with undo/redo support', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset });

  // First, set a detail so we can test undo of clearDetail meaningfully
  store.dispatch({ type: 'designer/setFaceFeature', group: 'detail', assetId: 'detail_blush' });
  assert.equal(store.getState().designer.draft.face.detail.assetId, 'detail_blush');
  assert.equal(store.getState().designer.dirty, true);

  // Select face group
  store.dispatch({ type: 'designer/selectFaceGroup', group: 'mouth' });
  assert.equal(store.getState().designer.selectedFaceGroup, 'mouth');

  // Set face feature
  store.dispatch({ type: 'designer/setFaceFeature', group: 'mouth', assetId: 'mouth_open_smile' });
  assert.equal(store.getState().designer.draft.face.mouth.assetId, 'mouth_open_smile');

  const invalid = store.dispatch({ type: 'designer/setFaceFeature', group: 'eyes', assetId: 'nose_dot' });
  assert.equal(invalid.ok, false);
  assert.equal(store.getState().designer.draft.face.eyes.assetId, 'eyes_classic');

  // Set iris color
  store.dispatch({ type: 'designer/setIrisColor', color: 'lavender' });
  assert.equal(store.getState().designer.draft.face.eyes.irisColor, 'lavender');

  // Clear detail
  store.dispatch({ type: 'designer/clearFaceDetail' });
  assert.equal(store.getState().designer.draft.face.detail, null);

  // Undo clear detail — should restore detail_blush
  store.dispatch({ type: 'app/undo' });
  assert.notEqual(store.getState().designer.draft.face.detail, null);
  assert.equal(store.getState().designer.draft.face.detail.assetId, 'detail_blush');

  // Undo set iris color — should restore to 'cocoa'
  store.dispatch({ type: 'app/undo' });
  assert.equal(store.getState().designer.draft.face.eyes.irisColor, 'cocoa');

  // Redo iris color
  store.dispatch({ type: 'app/redo' });
  assert.equal(store.getState().designer.draft.face.eyes.irisColor, 'lavender');
});

test('createExportDollSvg renders face layers in exact visual hierarchy', async () => {
  // Provide a minimal DOM shim for Node.js environment
  const NS = 'http://www.w3.org/2000/svg';
  const attrs = {};
  const children = [];
  const fakeElement = (tag) => {
    const el = {
      tagName: tag,
      _attrs: {},
      _children: [],
      _style: {},
      setAttribute(k, v) { el._attrs[k] = v; },
      getAttribute(k) { return el._attrs[k] ?? null; },
      appendChild(child) { el._children.push(child); },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      style: { setProperty(k, v) {} },
      id: '',
      cloneNode() { return fakeElement(tag); }
    };
    return el;
  };

  const origDocument = globalThis.document;
  globalThis.document = {
    createElementNS(ns, tag) { return fakeElement(tag); }
  };

  try {
    const { createExportDollSvg } = await import('../js/services/export-service.js');

    const draft = createStarterDraft();
    draft.face = {
      eyes: { assetId: 'eyes_round', irisColor: 'sage' },
      eyebrows: { assetId: 'brows_arched' },
      nose: { assetId: 'nose_button' },
      mouth: { assetId: 'mouth_open_smile' },
      detail: { assetId: 'detail_freckles' }
    };

    const loadedIds = [];
    const fakeLoadSvg = async (id) => {
      loadedIds.push(id);
      return fakeElement('g');
    };

    const svg = await createExportDollSvg(draft, 'neutral', { loadAssetSvg: fakeLoadSvg });
    assert.ok(svg);
    assert.equal(svg.getAttribute('viewBox'), '0 0 300 450');

    // Verify that face layers were loaded in proper sequence
    assert.ok(loadedIds.includes('eyes_round'));
    assert.ok(loadedIds.includes('brows_arched'));
    assert.ok(loadedIds.includes('nose_button'));
    assert.ok(loadedIds.includes('mouth_open_smile'));
    assert.ok(loadedIds.includes('detail_freckles'));

    // Verify relative order of layers: doll body (doll_classic_a), eyes, brows, detail, nose, mouth
    const bodyIdx = loadedIds.indexOf('doll_classic_a');
    const eyesIdx = loadedIds.indexOf('eyes_round');
    const browsIdx = loadedIds.indexOf('brows_arched');
    const detailIdx = loadedIds.indexOf('detail_freckles');
    const noseIdx = loadedIds.indexOf('nose_button');
    const mouthIdx = loadedIds.indexOf('mouth_open_smile');

    assert.ok(bodyIdx < eyesIdx, 'body before eyes');
    assert.ok(eyesIdx < browsIdx, 'eyes before brows');
    assert.ok(browsIdx < detailIdx, 'brows before detail');
    assert.ok(detailIdx < noseIdx, 'detail before nose');
    assert.ok(noseIdx < mouthIdx, 'nose before mouth');
  } finally {
    if (origDocument === undefined) delete globalThis.document;
    else globalThis.document = origDocument;
  }
});

test('FACE_PREVIEW_VIEWBOX zooms preview cards and appendAsset sets iris color', async () => {
  const { appendAsset, FACE_PREVIEW_VIEWBOX } = await import('../js/features/designer/designer-view.js');

  const eyesAsset = getAsset('eyes_sparkle');
  assert.equal(eyesAsset.faceGroup, 'eyes');
  assert.equal(FACE_PREVIEW_VIEWBOX[eyesAsset.faceGroup], '115 42 70 32');

  const mouthAsset = getAsset('mouth_open_smile');
  assert.equal(mouthAsset.faceGroup, 'mouth');
  assert.equal(FACE_PREVIEW_VIEWBOX[mouthAsset.faceGroup], '135 64 30 22');

  const origDocument = globalThis.document;
  const origDOMParser = globalThis.DOMParser;
  const origFetch = globalThis.fetch;
  const styles = new Map();
  const children = [];

  const makeEl = (tag) => {
    const attrs = new Map();
    const elStyles = new Map();
    const elChildren = [];
    const el = {
      tagName: tag.toUpperCase(),
      localName: tag.toLowerCase(),
      style: {
        setProperty(k, v) { elStyles.set(k, String(v)); },
        getPropertyValue(k) { return elStyles.get(k) || ''; }
      },
      setAttribute(k, v) { attrs.set(k, String(v)); },
      getAttribute(k) { return attrs.get(k) ?? null; },
      appendChild(c) { elChildren.push(c); return c; },
      append(...c) { elChildren.push(...c); },
      querySelector(sel) { if (sel === 'svg') return elChildren.find(c => c.localName === 'svg') || null; return null; },
      querySelectorAll() { return []; },
      cloneNode() { return makeEl(tag); }
    };
    return el;
  };

  const container = {
    style: {
      setProperty(k, v) { styles.set(k, String(v)); },
      getPropertyValue(k) { return styles.get(k) || ''; }
    },
    append(...nodes) { children.push(...nodes); },
    querySelector(sel) { if (sel === 'svg') return children.find(c => c.localName === 'svg') || null; return null; }
  };

  globalThis.document = {
    createElement: (tag) => makeEl(tag),
    createElementNS: (ns, tag) => makeEl(tag)
  };

  try {
    const fakeLoadSvg = async () => makeEl('svg');
    await appendAsset(container, 'eyes_sparkle', { color: 'lavender', isPreview: true, getAsset, loadAssetSvg: fakeLoadSvg });
    const previewSvg = container.querySelector('svg');
    assert.ok(previewSvg);
    assert.equal(previewSvg.getAttribute('viewBox'), '115 42 70 32');
    assert.equal(container.style.getPropertyValue('--iris-color'), '#a78bc4');
  } finally {
    if (origDocument === undefined) delete globalThis.document;
    else globalThis.document = origDocument;
  }
});

test('applyMouthExpression applies non-neutral expressions and cleanly restores resting face on neutral', async () => {
  const { applyMouthExpression } = await import('../js/services/export-service.js');

  const restingPath = { localName: 'path', style: { display: '' } };
  const faceFeatureG = {
    id: 'face-feature',
    children: [restingPath],
    appendChild(el) { faceFeatureG.children.push(el); }
  };
  const mouthSvg = {
    children: [faceFeatureG],
    querySelector(sel) {
      if (sel === '#doll-mouth-expression') return faceFeatureG.children.find(c => c.id === 'doll-mouth-expression') || null;
      if (sel === '#face-feature') return faceFeatureG;
      if (sel === '#doll-mouth-default') return null;
      return null;
    }
  };

  const origDocument = globalThis.document;
  globalThis.document = {
    createElementNS: (ns, tag) => ({
      tagName: tag,
      id: '',
      style: {},
      innerHTML: ''
    })
  };

  try {
    // Apply happy expression
    applyMouthExpression(mouthSvg, 'happy');
    assert.equal(restingPath.style.display, 'none');
    const exprG = mouthSvg.querySelector('#doll-mouth-expression');
    assert.ok(exprG);
    assert.ok(exprG.innerHTML.includes('e76f51')); // happy mouth color

    // Apply talking expression
    applyMouthExpression(mouthSvg, 'talking');
    assert.equal(restingPath.style.display, 'none');
    assert.ok(exprG.innerHTML.includes('fad2cf')); // talking tongue highlight

    // Restore neutral expression — resting mouth must be restored!
    applyMouthExpression(mouthSvg, 'neutral');
    assert.equal(restingPath.style.display, '');
    assert.equal(exprG.innerHTML, '');
  } finally {
    if (origDocument === undefined) delete globalThis.document;
    else globalThis.document = origDocument;
  }
});

test('countAssetUses accurately detects face feature assets across draft, presets, and scenes', () => {
  const customEyesId = 'custom_face_eyes_special';
  const customDetailId = 'custom_face_freckles_star';

  const sampleState = {
    designer: {
      draft: {
        baseDollId: 'doll_classic_a',
        skinTone: 'peach',
        face: {
          eyes: { assetId: customEyesId, irisColor: 'sky' },
          eyebrows: { assetId: 'brows_soft' },
          nose: { assetId: 'nose_dot' },
          mouth: { assetId: 'mouth_gentle_smile' },
          detail: null
        },
        slots: {}
      }
    },
    presets: [
      {
        presetId: 'preset_star',
        name: 'Star Doll',
        face: {
          eyes: { assetId: 'eyes_classic', irisColor: 'cocoa' },
          eyebrows: { assetId: 'brows_soft' },
          nose: { assetId: 'nose_dot' },
          mouth: { assetId: 'mouth_gentle_smile' },
          detail: { assetId: customDetailId }
        },
        slots: {}
      }
    ],
    currentScene: {
      sceneId: 'scene_live',
      entities: [
        {
          instanceId: 'char_1',
          kind: 'character',
          characterSnapshot: {
            face: {
              eyes: { assetId: customEyesId, irisColor: 'sage' },
              eyebrows: { assetId: 'brows_soft' },
              nose: { assetId: 'nose_dot' },
              mouth: { assetId: 'mouth_gentle_smile' },
              detail: null
            },
            slots: {}
          }
        }
      ]
    },
    scenes: [
      {
        sceneId: 'scene_book_1',
        title: 'Story 1',
        entities: [
          {
            instanceId: 'char_2',
            kind: 'character',
            characterSnapshot: {
              face: {
                eyes: { assetId: customEyesId, irisColor: 'lavender' },
                eyebrows: { assetId: 'brows_soft' },
                nose: { assetId: 'nose_dot' },
                mouth: { assetId: 'mouth_gentle_smile' },
                detail: { assetId: customDetailId }
              },
              slots: {}
            }
          }
        ]
      }
    ]
  };

  const eyesImpact = countAssetUses(customEyesId, sampleState);
  assert.equal(eyesImpact.totalUses, 3); // 1 draft + 1 current scene + 1 saved scene
  assert.equal(eyesImpact.inDesignerDraft, true);
  assert.equal(eyesImpact.currentSceneUses, 1);
  assert.equal(eyesImpact.scenes.length, 1);
  assert.equal(eyesImpact.dollCount, 3);
  assert.equal(eyesImpact.sceneCount, 2);

  const detailImpact = countAssetUses(customDetailId, sampleState);
  assert.equal(detailImpact.totalUses, 2); // 1 preset + 1 saved scene
  assert.equal(detailImpact.inDesignerDraft, false);
  assert.equal(detailImpact.presets.length, 1);
  assert.equal(detailImpact.presets[0].name, 'Star Doll');
  assert.equal(detailImpact.scenes.length, 1);
});

test('findSceneSkinSvg locates modular face-mouth layer before skin layer', async () => {
  const { findSceneSkinSvg } = await import('../js/features/play/play-view.js');

  const skinSvg = { dataset: { assetId: 'doll_classic_a' } };
  const mouthSvg = { dataset: { assetId: 'mouth_open_smile' } };

  const entityElement = {
    dataset: { instanceId: 'test-doll-1' },
    querySelector(selector) {
      if (selector === '[data-slot="face-mouth"] svg') return mouthSvg;
      if (selector === '[data-slot="skin"] svg') return skinSvg;
      return null;
    }
  };

  const origDocument = globalThis.document;
  globalThis.document = {
    querySelectorAll(selector) {
      if (selector === '.scene-entity-positioner') return [entityElement];
      return [];
    }
  };

  try {
    const foundSvg = findSceneSkinSvg('test-doll-1');
    assert.equal(foundSvg, mouthSvg, 'Target should be the face-mouth SVG element');
  } finally {
    if (origDocument === undefined) delete globalThis.document;
    else globalThis.document = origDocument;
  }
});
