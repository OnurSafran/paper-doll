import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultEnvelope,
  createRuntimeState,
  sanitizeCustomAsset,
  sanitizeDraft,
  sanitizeEnvelope,
  SCHEMA_VERSION
} from '../js/core/state-schema.js';
import { createStarterDraft } from '../js/domain/outfit-rules.js';
import { getAsset } from '../js/core/asset-catalog.js';
import { createPaintSession, WEARABLE_PAINT_SLOTS } from '../js/features/paint/paint-session.js';
import { getReferenceGuides, guideIsInBounds } from '../js/features/paint/paint-guides.js';
import { renderDollInto } from '../js/features/designer/designer-view.js';
import { createExportDollSvg } from '../js/services/export-service.js';
import {
  exportProjectPackage,
  mergeProjectEnvelopes,
  serializeProjectPackage,
  validateImportPayload
} from '../js/services/project-portability.js';
import { computeSha256 } from '../js/services/custom-art-repository.js';
import { createAppStore } from '../js/core/app-store.js';

test('sanitizeCustomAsset accepts valid custom hair wearable assets', () => {
  const validHair = {
    assetId: 'custom_hair_sparkle_01',
    name: 'Sparkle Curls',
    kind: 'wearable',
    slot: 'hair',
    format: 'image/png',
    logicalWidth: 300,
    logicalHeight: 450,
    pixelWidth: 600,
    pixelHeight: 900,
    byteLength: 45000,
    sha256: 'a1b2c3d4e5f60718',
    createdAt: '2026-08-17T12:00:00.000Z',
    updatedAt: '2026-08-17T12:00:00.000Z',
    libraryVisible: true,
    status: 'available'
  };

  const sanitized = sanitizeCustomAsset(validHair);
  assert.ok(sanitized);
  assert.equal(sanitized.assetId, 'custom_hair_sparkle_01');
  assert.equal(sanitized.kind, 'wearable');
  assert.equal(sanitized.slot, 'hair');
  assert.equal(sanitized.logicalWidth, 300);
  assert.equal(sanitized.logicalHeight, 450);
  assert.equal(sanitized.pixelWidth, 600);
  assert.equal(sanitized.pixelHeight, 900);
  assert.equal(sanitized.status, 'available');
  assert.deepEqual(sanitized.supportedFitFamilies, ['baby', 'child', 'teen', 'adult', 'elder']);
  assert.deepEqual(sanitized.presentationStyles, ['neutral', 'feminine', 'masculine']);
});

test('sanitizeDraft and AppStore handle custom hair in outfit slots cleanly', () => {
  const customHair = {
    assetId: 'custom_hair_braids',
    name: 'Twin Braids',
    kind: 'wearable',
    slot: 'hair',
    format: 'image/png',
    logicalWidth: 300,
    logicalHeight: 450,
    pixelWidth: 600,
    pixelHeight: 900,
    byteLength: 25000,
    sha256: 'deadbeef12345678'
  };

  const resolver = (id) => (id === 'custom_hair_braids' ? customHair : getAsset(id));

  const draft = createStarterDraft();
  draft.slots.hair = { assetId: 'custom_hair_braids', color: 'brown' };

  const sanitized = sanitizeDraft(draft, resolver);
  assert.ok(sanitized);
  assert.equal(sanitized.slots.hair.assetId, 'custom_hair_braids');

  // Retains reference even if temporarily uncataloged (as placeholder reference)
  const draftMissing = sanitizeDraft(draft, () => undefined);
  assert.ok(draftMissing);
  assert.equal(draftMissing.slots.hair.assetId, 'custom_hair_braids');
});

test('Paint session and guides support slot: hair across all base doll models', () => {
  assert.ok(WEARABLE_PAINT_SLOTS.includes('hair'));

  const session = createPaintSession({ slot: 'hair' });
  assert.equal(session.getState().slot, 'hair');
  assert.equal(session.getState().itemType, 'wearable');

  for (const model of ['doll_classic_a', 'doll_classic_b', 'doll_chibi_a', 'doll_baby_a', 'doll_adult_a', 'doll_elder_a']) {
    const guides = getReferenceGuides('hair', model);
    assert.ok(guides.length >= 4, `Model ${model} must have hair guides`);
    assert.ok(guides.every(guideIsInBounds), `Model ${model} hair guides must stay in 300x450 bounds`);
  }
});

test('renderDollInto renders custom hair at Layer 70 and skips Layer 10 hairBack', async () => {
  const draft = createStarterDraft();
  draft.slots.hair = { assetId: 'custom_hair_afro', color: 'brown' };

  const appendedLayers = [];
  const fakeContainer = {
    replaceChildren(...nodes) { appendedLayers.push(...nodes); }
  };

  const origDocument = globalThis.document;
  const createdElements = [];

  const makeEl = (tag) => {
    const attrs = new Map();
    const styles = new Map();
    const children = [];
    const el = {
      tagName: tag.toUpperCase(),
      localName: tag.toLowerCase(),
      dataset: {},
      style: {
        zIndex: '',
        setProperty(k, v) { styles.set(k, String(v)); },
        getPropertyValue(k) { return styles.get(k) || ''; }
      },
      setAttribute(k, v) { attrs.set(k, String(v)); },
      getAttribute(k) { return attrs.get(k) ?? null; },
      appendChild(c) { children.push(c); return c; },
      append(...c) { children.push(...c); },
      querySelector(sel) {
        if (sel === 'image') {
          if (this.localName === 'image') return this;
          for (const c of children) {
            const m = c.querySelector?.(sel);
            if (m) return m;
          }
        }
        return null;
      }
    };
    createdElements.push(el);
    return el;
  };

  globalThis.document = {
    createElement: (tag) => makeEl(tag),
    createElementNS: (ns, tag) => makeEl(tag)
  };

  try {
    const fakeCustomArtRepo = {
      getTrackedObjectUrl: async (id) => (id === 'custom_hair_afro' ? 'blob:paperdoll/custom-hair-afro' : null)
    };

    const fakeLoadSvg = async () => makeEl('svg');

    await renderDollInto(fakeContainer, draft, {
      customArtRepo: fakeCustomArtRepo,
      getCustomArtUrl: fakeCustomArtRepo.getTrackedObjectUrl,
      loadAssetSvg: fakeLoadSvg
    });

    assert.ok(appendedLayers.length > 0);
    // Find all hair layers
    const hairLayers = appendedLayers.filter(l => l.dataset?.slot === 'hair');
    assert.equal(hairLayers.length, 1, 'Custom hair must only render single layer at z-index 70');
    assert.equal(hairLayers[0].style.zIndex, '70');

    // Verify image inside layer 70 references the custom hair blob URL
    const img = hairLayers[0].querySelector('image');
    assert.ok(img);
    assert.equal(img.getAttribute('href'), 'blob:paperdoll/custom-hair-afro');
  } finally {
    if (origDocument === undefined) delete globalThis.document;
    else globalThis.document = origDocument;
  }
});

test('createExportDollSvg renders custom hair at Layer 70 for PNG canvas exports', async () => {
  const draft = createStarterDraft();
  draft.slots.hair = { assetId: 'custom_hair_afro', color: 'brown' };

  const origDocument = globalThis.document;
  const createdElements = [];

  const makeEl = (tag) => {
    const attrs = new Map();
    const styles = new Map();
    const children = [];
    const el = {
      tagName: tag.toUpperCase(),
      localName: tag.toLowerCase(),
      dataset: {},
      style: {
        setProperty(k, v) { styles.set(k, String(v)); },
        getPropertyValue(k) { return styles.get(k) || ''; }
      },
      setAttribute(k, v) { attrs.set(k, String(v)); },
      getAttribute(k) { return attrs.get(k) ?? null; },
      appendChild(c) { children.push(c); return c; },
      append(...c) { children.push(...c); },
      cloneNode() { return makeEl(tag); },
      get firstChild() { return children[0] || null; }
    };
    createdElements.push(el);
    return el;
  };

  globalThis.document = {
    createElementNS: (ns, tag) => makeEl(tag)
  };

  try {
    const fakeCustomArtRepo = {
      getTrackedObjectUrl: async (id) => (id === 'custom_hair_afro' ? 'blob:paperdoll/custom-hair-afro' : null)
    };

    const fakeLoadSvg = async () => makeEl('svg');

    const svg = await createExportDollSvg(draft, 'neutral', {
      customArtRepo: fakeCustomArtRepo,
      loadAssetSvg: fakeLoadSvg
    });

    assert.ok(svg);
    // Find image element for custom hair
    const images = createdElements.filter(el => el.localName === 'image');
    assert.ok(images.some(img => img.getAttribute('href') === 'blob:paperdoll/custom-hair-afro'));
  } finally {
    if (origDocument === undefined) delete globalThis.document;
    else globalThis.document = origDocument;
  }
});

test('project portability packages and validates custom hair Base64 artwork and rewrites collisions on merge', async () => {
  const validBytes = new Uint8Array(24 + 10);
  validBytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82], 0);
  const view = new DataView(validBytes.buffer);
  view.setUint32(16, 600, false);
  view.setUint32(20, 900, false);
  validBytes[24] = 8;
  validBytes[25] = 6;

  const validB64 = Buffer.from(validBytes).toString('base64');
  const validSha = await computeSha256(validBytes);

  const pkg = {
    format: 'paper-doll-project',
    formatVersion: 1,
    exportedAt: '2026-08-17T12:00:00.000Z',
    state: {
      schemaVersion: 4,
      presets: [{
        presetId: 'doll-with-custom-hair',
        name: 'Hairstyle Doll',
        baseDollId: 'doll_classic_a',
        skinTone: 'peach',
        slots: {
          hair: { assetId: 'custom_hair_topknot', color: 'brown' }
        }
      }],
      scenes: [],
      currentScene: null,
      customAssets: [{
        assetId: 'custom_hair_topknot',
        name: 'Topknot Hair',
        kind: 'wearable',
        slot: 'hair',
        format: 'image/png',
        logicalWidth: 300,
        logicalHeight: 450,
        pixelWidth: 600,
        pixelHeight: 900,
        byteLength: validBytes.byteLength,
        sha256: validSha,
        libraryVisible: true,
        status: 'available'
      }]
    },
    customArtwork: [{
      metadata: {
        assetId: 'custom_hair_topknot',
        name: 'Topknot Hair',
        kind: 'wearable',
        slot: 'hair',
        format: 'image/png',
        logicalWidth: 300,
        logicalHeight: 450,
        pixelWidth: 600,
        pixelHeight: 900,
        byteLength: validBytes.byteLength,
        sha256: validSha
      },
      encoding: 'base64',
      data: validB64
    }]
  };

  // 1. Validate import payload
  const res = await validateImportPayload(JSON.stringify(pkg), getAsset);
  assert.equal(res.ok, true);
  assert.equal(res.envelope.customAssets.length, 1);
  assert.equal(res.envelope.customAssets[0].slot, 'hair');
  assert.equal(res.customArtwork.length, 1);
  assert.equal(res.customArtwork[0].metadata.assetId, 'custom_hair_topknot');

  // 2. Merge with collision rewriting
  const current = {
    ...createDefaultEnvelope(),
    customAssets: [{
      assetId: 'custom_hair_topknot', // Collision
      name: 'Existing Hair',
      kind: 'wearable',
      slot: 'hair',
      format: 'image/png',
      logicalWidth: 300,
      logicalHeight: 450,
      pixelWidth: 600,
      pixelHeight: 900,
      byteLength: 100,
      sha256: 'existing-hair-sha'
    }]
  };

  let idCounter = 100;
  const merged = mergeProjectEnvelopes(current, res.envelope, res.customArtwork, {
    makeId: () => `id-${++idCounter}`
  });

  assert.equal(merged.envelope.customAssets.length, 2);
  assert.equal(merged.envelope.customAssets[0].assetId, 'custom_hair_topknot');
  assert.equal(merged.envelope.customAssets[1].assetId, 'custom_id-101');
  assert.equal(merged.envelope.presets[0].slots.hair.assetId, 'custom_id-101');
});
