import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_PACKS_FILTER,
  CORE_PACK_ID,
  PACK_MANIFESTS,
  PACK_REGISTRY,
  createPackRegistry,
  getVisiblePackManifests,
  validatePackManifest
} from '../js/packs/index.js';
import { createAssetRegistry } from '../js/core/asset-registry.js';
import { createAppStore } from '../js/core/app-store.js';
import { getAsset } from '../js/core/asset-catalog.js';
import { createDefaultEnvelope, sanitizeEnvelope } from '../js/core/state-schema.js';

const packId = 'pack_fixture_family';
const packAsset = {
  id: 'top_family_cardigan',
  kind: 'wearable',
  slot: 'top',
  name: 'Family cardigan',
  path: 'assets/packs/pack-family-home/cardigan.svg',
  viewBox: [0, 0, 300, 450],
  tintable: true,
  defaultColors: { primary: 'sage' },
  requiredGroups: ['garment'],
  supportedFitFamilies: ['teen', 'child', 'adult', 'elder'],
  presentationStyles: ['neutral'],
  poseSupport: 'rigid',
  metadata: { dlc: packId }
};

function familyManifest() {
  return {
    id: packId,
    version: '1.0.0',
    schemaVersion: 1,
    minAppVersion: '1.20.0',
    nameKey: 'pack_family_home.name',
    descriptionKey: 'pack_family_home.description',
    coverPath: 'assets/packs/pack-family-home/cover.svg',
    assets: [packAsset],
    dependencies: [],
    chapters: [{
      id: 'everyday',
      nameKey: 'pack_family_home.chapters.everyday',
      assetIds: [packAsset.id]
    }],
    files: ['assets/packs/pack-family-home/cover.svg', packAsset.path]
  };
}

test('the bundled core manifest covers the existing catalog and cache resources', () => {
  assert.deepEqual(PACK_REGISTRY.getPackIds(), [CORE_PACK_ID, 'pack_family_home']);
  assert.equal(PACK_REGISTRY.getPack('core').assets.length, 145);
  assert.equal(PACK_REGISTRY.getResourceFiles([CORE_PACK_ID]).length, 146);
  assert.equal(PACK_REGISTRY.getAsset('prop_cake').packId, CORE_PACK_ID);
  assert.equal(PACK_REGISTRY.getAssetPack('prop_cake'), CORE_PACK_ID);
});

test('pack manifests validate chapters, provenance, and namespaced locale data', () => {
  const manifest = familyManifest();
  assert.equal(validatePackManifest(manifest).valid, true);
  assert.equal(validatePackManifest({ ...manifest, assets: [{ ...packAsset, metadata: { dlc: 'core' } }] }).valid, false);
  assert.equal(validatePackManifest({
    ...manifest,
    locales: {
      tr: { [packId]: { name: 'Aile' } },
      en: { [packId]: { name: 'Family' } }
    }
  }).valid, true);
  assert.equal(validatePackManifest({
    ...manifest,
    locales: { tr: { name: 'Aile' }, en: { name: 'Family' } }
  }).valid, false);
});

test('registry separates availability, visibility, and missing references', () => {
  const manifest = familyManifest();
  const unavailable = createPackRegistry([...PACK_MANIFESTS, manifest], { availablePackIds: ['core'] });
  assert.equal(unavailable.getAsset(packAsset.id).status, 'missing');
  assert.equal(unavailable.assetsByKind('wearable', { packId }).length, 0);
  assert.equal(unavailable.assetsByKind('wearable', { packId, includeUnavailable: true })[0].kind, 'wearable');

  const hidden = createPackRegistry([...PACK_MANIFESTS, manifest], { visiblePackIds: ['core'] });
  assert.equal(hidden.assetsByKind('wearable', { packId }).length, 0);
  assert.equal(hidden.assetsByKind('wearable', { packId, includeHidden: true }).length, 1);
  assert.equal(hidden.getAsset(packAsset.id).status, undefined);
});

test('asset registry composes pack filtering with fit and style discovery', () => {
  const registry = createAssetRegistry([], { packManifests: [...PACK_MANIFESTS, familyManifest()] });
  assert.equal(registry.getOfferedWearables('top', 'doll_adult_a', 'neutral', packId).map((asset) => asset.id).join(','), packAsset.id);
  assert.equal(registry.getOfferedWearables('top', 'doll_baby_a', 'neutral', packId).length, 0);
  assert.equal(registry.assetsByKind('wearable', { packId: ALL_PACKS_FILTER }).some((asset) => asset.id === packAsset.id), true);
});

test('pack references and hidden-pack preferences survive state sanitization', () => {
  const envelope = createDefaultEnvelope();
  const result = sanitizeEnvelope({
    ...envelope,
    settings: { ...envelope.settings, hiddenPacks: [packId, 'not a pack'] },
    packRequirements: [{ id: packId, version: '1.0.0' }, { id: 'bad id', version: '1.0.0' }]
  }, getAsset);
  assert.deepEqual(result.envelope.settings.hiddenPacks, [packId]);
  assert.deepEqual(result.envelope.packRequirements, [{ id: packId, version: '1.0.0' }]);
});

test('hidden packs are omitted from pickers and an imported hidden filter resets to all packs', () => {
  assert.deepEqual(getVisiblePackManifests(PACK_REGISTRY.getPacks(), ['pack_family_home']).map((manifest) => manifest.id), ['core']);
  assert.deepEqual(getVisiblePackManifests(PACK_REGISTRY.getPacks(), ['core', 'pack_family_home']).map((manifest) => manifest.id), ['core']);

  const store = createAppStore(createDefaultEnvelope(), { getAsset: PACK_REGISTRY.getAsset, assets: PACK_REGISTRY.getPacks().flatMap((manifest) => manifest.assets) });
  store.dispatch({ type: 'ui/setPackFilter', packId: 'pack_family_home' });
  store.dispatch({
    type: 'project/importReplace',
    envelope: {
      ...createDefaultEnvelope(),
      settings: { ...createDefaultEnvelope().settings, hiddenPacks: ['pack_family_home'] }
    }
  });
  assert.equal(store.getState().ui.packFilter, 'all');
  assert.deepEqual(store.getState().settings.hiddenPacks, ['pack_family_home']);
});

test('store mutations record the first referenced non-core pack', async () => {
  const { createAppStore } = await import('../js/core/app-store.js');
  const packRegistry = createPackRegistry([...PACK_MANIFESTS, familyManifest()]);
  const store = createAppStore(createDefaultEnvelope(), {
    getAsset: packRegistry.getAsset,
    assets: packRegistry.getPacks().flatMap((manifest) => manifest.assets)
  });
  const result = store.dispatch({ type: 'designer/equip', assetId: packAsset.id });
  assert.equal(result.ok, true);
  assert.deepEqual(store.getState().packRequirements, [{ id: packId, version: '1.0.0' }]);
});
