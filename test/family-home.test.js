import test from 'node:test';
import assert from 'node:assert/strict';
import { PACK_REGISTRY, createPackRegistry, collectReferencedPackRequirements } from '../js/packs/index.js';
import { FAMILY_HOME_MANIFEST as pack } from '../js/packs/family-home/manifest.js';
import { createAssetRegistry } from '../js/core/asset-registry.js';
import { createAppStore } from '../js/core/app-store.js';
import { createDefaultEnvelope, sanitizeEnvelope } from '../js/core/state-schema.js';
import { isWearableCompatible } from '../js/domain/outfit-rules.js';
import { instantiateSceneTemplate } from '../js/domain/scene-templates.js';
import { t, setLanguage, assetName } from '../js/core/i18n.js';

test('Family pack meets the locked ledger, chapter, fit, and bilingual story budgets', () => {
  assert.equal(pack.assets.length, 92);
  for (const [kind, count] of [['wearable', 48], ['prop', 40], ['background', 4]]) assert.equal(pack.assets.filter(a => a.kind === kind).length, count);
  assert.deepEqual(pack.chapters.map(c => c.assetIds.length), [17, 21, 17, 16, 17]);
  const wearables = pack.assets.filter(a => a.kind === 'wearable');
  for (const [fit, count] of [['baby', 10], ['child', 10], ['adult', 10], ['elder', 12], ['teen', 6]]) assert.equal(wearables.filter(a => a.supportedFitFamilies.includes(fit)).length, count);
  assert.equal(pack.templates.length, 6);
  assert.equal(pack.templates.flatMap(s => s.promptKeys).length, 12);
  assert.equal(pack.outfits.length, 8);
  for (const language of ['en', 'tr']) {
    setLanguage(language);
    for (const asset of pack.assets) assert.ok(assetName(asset));
    for (const story of pack.templates) for (const key of [story.titleKey, ...story.promptKeys]) assert.ok(t(key));
  }
});

test('all eight recipes resolve compatible items and load with undo/redo', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset: PACK_REGISTRY.getAsset, assets: PACK_REGISTRY.getPacks().flatMap(p => p.assets) });
  for (const outfit of pack.outfits) {
    for (const item of Object.values(outfit.slots).filter(Boolean)) {
      const asset = PACK_REGISTRY.getAsset(item.assetId);
      assert.ok(asset, item.assetId);
      assert.ok(isWearableCompatible(outfit, asset, PACK_REGISTRY.getAsset), item.assetId);
    }
    assert.equal(store.dispatch({ type: 'designer/loadOutfit', outfitId: outfit.id }).ok, true);
    assert.equal(store.getState().designer.draft.baseDollId, outfit.baseDollId);
    assert.ok(store.canUndo());
    store.dispatch({ type: 'app/undo' });
    store.dispatch({ type: 'app/redo' });
    assert.equal(store.getState().designer.draft.baseDollId, outfit.baseDollId);
  }
});

test('family scenes preserve character recipes, geometry, and pack references on save/reload', () => {
  for (const template of pack.templates) {
    const scene = instantiateSceneTemplate(template.id);
    assert.ok(scene);
    for (const entity of scene.entities) if (entity.kind === 'prop') assert.ok(PACK_REGISTRY.getAsset(entity.sourceId), entity.sourceId);
    assert.ok(new Set(scene.entities.filter(e => e.kind === 'character').map(e => e.characterSnapshot.baseDollId)).size > 1);
    const envelope = { ...createDefaultEnvelope(), currentScene: scene, scenes: [scene] };
    envelope.packRequirements = collectReferencedPackRequirements(envelope, PACK_REGISTRY.getAsset);
    const restored = sanitizeEnvelope(envelope, PACK_REGISTRY.getAsset).envelope;
    assert.equal(restored.currentScene.backgroundId, scene.backgroundId);
    assert.equal(restored.currentScene.stageWidth, scene.stageWidth);
    assert.deepEqual(restored.currentScene.entities.map(e => e.characterSnapshot?.slots), scene.entities.map(e => e.characterSnapshot?.slots));
    assert.deepEqual(restored.packRequirements, [{ id: pack.id, version: pack.version }]);
    const missing = createPackRegistry(PACK_REGISTRY.getPacks(), { availablePackIds: ['core'] });
    const recovered = sanitizeEnvelope(envelope, missing.getAsset).envelope;
    assert.equal(recovered.currentScene.backgroundId, scene.backgroundId);
    assert.equal(recovered.currentScene.stageWidth, scene.stageWidth);
  }
});

test('manifest validation rejects raw invalid input before normalization can repair it', () => {
  for (const patch of [ { assets: 'bad' }, { dependencies: 'bad' }, { files: 'bad' }, { chapters: 'bad' }, { assets: [{ ...pack.assets[0], metadata: { dlc: 'core' } }] }, { assets: [{ ...pack.assets[0], viewBox: [0, 0, -1, 450] }] }]) {
    assert.throws(() => createPackRegistry([{ ...pack, ...patch }]), /Invalid content-pack registry/);
  }
});

test('pack-filtered prop discovery excludes custom art and unavailable lookup respects opt-out', () => {
  const registry = createAssetRegistry([{ assetId: 'custom_fixture', kind: 'prop', name: 'Fixture', status: 'available' }]);
  assert.ok(registry.assetsByKind('prop').some(a => a.custom));
  assert.ok(registry.assetsByKind('prop', { packId: pack.id }).every(a => !a.custom));
  const missing = createPackRegistry(PACK_REGISTRY.getPacks(), { availablePackIds: ['core'] });
  assert.equal(missing.getAsset(pack.assets[0].id, { includeUnavailable: false }), undefined);
  assert.equal(missing.getAsset(pack.assets[0].id).status, 'missing');
});

test('pack content registration rejects broken recipes and template references', () => {
  const core = PACK_REGISTRY.getPack('core');
  assert.throws(() => createPackRegistry([core, { ...pack, templates: [{ ...pack.templates[0], backgroundId: 'unknown_background' }] }]), /registered background/);
  const broken = { ...pack.outfits[0], slots: { hair: { assetId: 'unknown_hair' } } };
  assert.throws(() => createPackRegistry([core, { ...pack, outfits: [broken] }]), /incompatible outfit item/);
  assert.throws(() => createPackRegistry([core, { ...pack, templates: [pack.templates[0], pack.templates[0]] }]), /duplicate template/);
});
