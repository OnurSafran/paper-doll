import test from 'node:test';
import assert from 'node:assert/strict';
import { getAsset } from '../js/core/asset-catalog.js';
import { createEmptyScene, addEntity, moveEntity, moveEntities, flipEntity, scaleEntity, setEntityPinned, duplicateEntity, deleteEntity } from '../js/domain/scene-rules.js';
import { setPlacementMode, placeEntity, recoverSurfacePlacements, resolvePlacement, changePlacementBackground } from '../js/domain/scene-placement.js';
import { previewStageSize } from '../js/domain/stage-sizing.js';
import { confirmStageSize } from '../js/features/play/background-placement-confirm.js';
import { createDefaultEnvelope, sanitizeEnvelope, sanitizeScene, SCHEMA_VERSION, STORAGE_KEY } from '../js/core/state-schema.js';
import { createAppStore } from '../js/core/app-store.js';
import { loadProject, resetObsoleteProject } from '../js/services/project-repository.js';
import { validateImportPayload, getAvailableBackup, BACKUP_KEY_LATEST } from '../js/services/project-portability.js';
import { validatePackManifest } from '../js/packs/pack-registry.js';
import { CORE_PACK_MANIFEST } from '../js/packs/core/manifest.js';
import { surfacePreset, validPolygon } from '../js/domain/placement-geometry.js';

function furnished(width = 1600, x = 800) {
  let scene = setPlacementMode({ ...createEmptyScene('test'), stageWidth: width }, 'room', getAsset);
  scene = addEntity(scene, { instanceId: 'table', kind: 'prop', sourceId: 'prop_table', x, y: 780 }, getAsset);
  scene = addEntity(scene, { instanceId: 'tea', kind: 'prop', sourceId: 'prop_tea_set', x, y: 800 }, getAsset);
  return placeEntity(scene, 'tea', { x: x - 20, y: 640 }, getAsset, { target: { kind: 'surface', hostId: 'table', surfaceId: 'tabletop' } });
}
const entity = (scene, id) => scene.entities.find(e => e.instanceId === id);
const storeFor = scene => createAppStore({ ...createDefaultEnvelope(), currentScene: scene }, { getAsset });
function storageFor(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { data, get length() { return data.size; }, key: i => [...data.keys()][i], getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
}

test('Pinned surface contents resist direct edits but follow their host', () => {
  let scene = setEntityPinned(furnished(), 'tea', true);
  assert.equal(entity(scene, 'tea').pinned, true);
  assert.equal(moveEntity(scene, 'tea', 1000, 700, getAsset), scene);
  assert.equal(scaleEntity(scene, 'tea', 2, getAsset), scene);
  const before = entity(scene, 'tea');
  scene = moveEntity(scene, 'table', 1000, 800, getAsset);
  assert.equal(entity(scene, 'tea').pinned, true);
  assert.equal(entity(scene, 'tea').x - before.x, 200);
  assert.equal(entity(scene, 'tea').attachedTo, 'table');
});

test('Mirrored asymmetric contact survives save sanitization without shifting', () => {
  const asymmetric = { ...getAsset('prop_tea_set'), displayWidth: 200, groundAnchor: { x: .9, y: 1 } };
  const lookup = id => id === 'prop_tea_set' ? asymmetric : getAsset(id);
  const scene = addEntity(createEmptyScene('test'), { instanceId: 'tea', kind: 'prop', sourceId: 'prop_tea_set', x: 50, y: 800, flipped: true }, lookup);
  assert.equal(entity(scene, 'tea').x, 50);
  assert.equal(entity(sanitizeScene(scene, lookup), 'tea').x, 50);
});

test('A group move is atomic when one root reaches the room boundary', () => {
  let scene = furnished();
  scene = addEntity(scene, { instanceId: 'chair', kind: 'prop', sourceId: 'prop_chair', x: 1450, y: 800 }, getAsset);
  const result = moveEntities(scene, [{ instanceId: 'table', x: 1000, y: 780 }, { instanceId: 'chair', x: 1650, y: 800 }], getAsset);
  assert.equal(result, scene);
});

test('Free background permits furniture transforms after moving away from its old floor', () => {
  let scene = { ...furnished(), placementMode: 'free' };
  scene = moveEntity(scene, 'table', 800, 470, getAsset);
  const flipped = flipEntity(scene, 'table', getAsset);
  assert.equal(entity(flipped, 'table').flipped, true);
  assert.equal(entity(flipped, 'tea').placement.kind, 'surface');
  const scaled = scaleEntity(flipped, 'table', 1.1, getAsset);
  assert.equal(entity(scaled, 'table').scale, 1.1);
  assert.equal(entity(scaled, 'tea').placement.kind, 'surface');
});

test('Generic grandchildren follow a supported parent through host scale and reflection', () => {
  let scene = furnished();
  const tea = entity(scene, 'tea');
  // Narrative attachments may be generic descendants of a surface-supported prop.
  scene.entities.push({ instanceId: 'caption', kind: 'bubble', x: tea.x + 20, y: tea.y - 100, scale: 1, flipped: false, pinned: false, attachedTo: 'tea', attachOffset: { dx: 20, dy: -100 }, order: 3, width: 180, text: 'Tea', bubbleStyle: 'caption' });
  for (const transform of [s => scaleEntity(s, 'table', 1.2, getAsset), s => flipEntity(s, 'table', getAsset)]) {
    scene = transform(scene);
    assert.equal(entity(scene, 'caption').x - entity(scene, 'tea').x, 20);
    assert.equal(entity(scene, 'caption').y - entity(scene, 'tea').y, -100);
  }
});

test('Missing artwork cannot provide an invisible support surface', () => {
  const lookup = id => id === 'prop_table' ? { ...getAsset(id), status: 'missing' } : getAsset(id);
  const restored = recoverSurfacePlacements(furnished(), lookup);
  assert.equal(entity(restored, 'tea').placement.reason, 'support-missing');
  assert.equal(entity(restored, 'tea').attachedTo, null);
});

test('Newly acquired drag support retains its release distance', () => {
  const scene = furnished();
  const child = { ...entity(scene, 'tea'), attachedTo: null, placement: { kind: 'floor', regionId: 'floor:0' } };
  const near = resolvePlacement(scene, child, { x: 800, y: 650 }, getAsset, { transfer: true });
  assert.equal(near.kind, 'surface');
  const edge = resolvePlacement(scene, child, { x: 800, y: 900 }, getAsset, { target: { kind: 'surface', hostId: 'table', surfaceId: 'tabletop' } });
  const point = { x: edge.point.x, y: edge.point.y + 20 };
  assert.equal(resolvePlacement(scene, child, point, getAsset, { transfer: true }).kind, 'floor');
  assert.equal(resolvePlacement(scene, child, point, getAsset, { transfer: true, currentTarget: { hostId: 'table', surfaceId: 'tabletop' } }).kind, 'surface');
});

test('Duplication distinguishes host-only, furnished copy, and same-surface contents', () => {
  const scene = furnished();
  const hostOnly = duplicateEntity(scene, 'table', 'copy', getAsset);
  assert.equal(hostOnly.entities.length, 3);
  const contents = duplicateEntity(scene, 'tea', 'tea-copy', getAsset);
  assert.equal(contents.entities.length, 3);
  assert.equal(entity(contents, 'tea-copy').attachedTo, 'table');
  assert.equal(entity(contents, 'tea-copy').placement.kind, 'surface');
  assert.equal(entity(contents, 'tea-copy').order, 3);
  const furnishedCopy = duplicateEntity(scene, 'table', 'copy', getAsset, () => 'tea-copy', true);
  assert.equal(furnishedCopy.entities.length, 4);
  assert.equal(entity(furnishedCopy, 'tea-copy').attachedTo, 'copy');
});

test('Deleting a host resolves unpinned contents onto the floor; undo restores support', () => {
  const store = storeFor(furnished());
  store.dispatch({ type: 'scene/deleteEntity', instanceId: 'table' });
  assert.equal(entity(store.getState().currentScene, 'tea').placement.kind, 'floor');
  assert.equal(entity(store.getState().currentScene, 'tea').attachedTo, null);
  store.dispatch({ type: 'app/undo' });
  assert.equal(entity(store.getState().currentScene, 'tea').attachedTo, 'table');
  const pinned = deleteEntity(setEntityPinned(furnished(), 'tea', true), 'table', getAsset);
  assert.equal(entity(pinned, 'tea').pinned, true);
  assert.equal(entity(pinned, 'tea').placement.reason, 'support-missing');
});

test('Flip command resolves omitted IDs from the current selection', () => {
  const store = storeFor(furnished());
  store.dispatch({ type: 'ui/selectEntities', instanceIds: ['table', 'tea'] });
  const result = store.dispatch({ type: 'scene/flipEntities' });
  assert.equal(result.ok, true);
  assert.equal(entity(store.getState().currentScene, 'table').flipped, true);
});

test('Shrink preview counts every member of a cut-off pinned assembly', () => {
  const scene = setEntityPinned(furnished(3200, 2500), 'table', true);
  const preview = previewStageSize(scene, 1600, getAsset);
  assert.deepEqual(preview.removedIds.sort(), ['table', 'tea']);
  assert.equal(preview.scene.entities.length, 0);
  assert.equal(scene.entities.length, 2);
});

test('Shrink requires confirmation at the reducer boundary; cancellation changes nothing', async () => {
  const store = storeFor(furnished(3200, 2500));
  const before = store.getState();
  assert.equal(store.dispatch({ type: 'scene/setStageWidth', stageWidth: 1600 }).code, 'SHRINK_CONFIRMATION_REQUIRED');
  assert.equal(store.getState(), before);
  let message;
  const accepted = await confirmStageSize({ store, getAsset, askConfirm: async (_title, text) => { message = text; return false; } }, 1600);
  assert.equal(accepted, false);
  assert.match(message, /2/);
  assert.equal(store.getState(), before);
});

test('Confirmed shrink removes contents in one undo entry and restores them on undo', async () => {
  const store = storeFor(furnished(3200, 2500));
  assert.equal(await confirmStageSize({ store, getAsset, askConfirm: async () => true }, 1600), true);
  assert.equal(store.getState().currentScene.stageWidth, 1600);
  assert.equal(store.getState().currentScene.entities.length, 0);
  store.dispatch({ type: 'app/undo' });
  assert.equal(store.getState().currentScene.stageWidth, 3200);
  assert.equal(entity(store.getState().currentScene, 'tea').attachedTo, 'table');
  store.dispatch({ type: 'app/redo' });
  assert.equal(store.getState().currentScene.entities.length, 0);
});

test('Expansion and safe shrink do not prompt or move existing items', async () => {
  const store = storeFor(furnished());
  const point = entity(store.getState().currentScene, 'tea');
  const askConfirm = async () => { assert.fail('No items affected'); };
  assert.equal(await confirmStageSize({ store, getAsset, askConfirm }, 4800), true);
  assert.equal(await confirmStageSize({ store, getAsset, askConfirm }, 1600), true);
  assert.equal(entity(store.getState().currentScene, 'tea').x, point.x);
  assert.equal(entity(store.getState().currentScene, 'tea').y, point.y);
});

test('Shrink confirmation cannot apply to an arrangement changed while awaiting the dialog', async () => {
  const store = storeFor(furnished(3200, 2500));
  const accepted = await confirmStageSize({ store, getAsset, askConfirm: async () => { store.dispatch({ type: 'scene/moveEntity', instanceId: 'table', x: 800, y: 780 }); return true; } }, 1600);
  assert.equal(accepted, false);
  assert.equal(store.getState().currentScene.stageWidth, 3200);
});

test('Every pre-release or unversioned save requests a full reset; version 8 survives', () => {
  const saved = { ...createDefaultEnvelope(), currentScene: furnished(), scenes: [furnished()], settings: { soundEnabled: true }, customAssets: [{ assetId: 'custom_old' }], presets: [{ presetId: 'old' }] };
  for (const version of [undefined, null, 0, 1, 6, 7, '8']) {
    const result = sanitizeEnvelope({ ...saved, schemaVersion: version }, getAsset);
    assert.equal(result.resetRequired, true);
    assert.equal(result.envelope.schemaVersion, SCHEMA_VERSION);
    assert.equal(result.envelope.currentScene, null);
    assert.deepEqual(result.envelope.scenes, []);
    assert.deepEqual(result.envelope.customAssets, []);
    assert.deepEqual(result.envelope.presets, []);
    assert.equal(result.envelope.settings.soundEnabled, false);
  }
  const current = sanitizeEnvelope({ ...createDefaultEnvelope(), currentScene: furnished() }, getAsset);
  assert.equal(current.resetRequired, undefined);
  assert.equal(current.envelope.currentScene.entities.length, 2);
  for (const raw of [null, 'null', '[]', '{bad json', '{}']) {
    assert.equal(loadProject(storageFor(raw == null ? {} : { [STORAGE_KEY]: raw }), getAsset).resetRequired, true);
  }
});

test('Clean start waits for artwork, drafts, staging, trash and backup reset before stamping version', async () => {
  const storage = storageFor({ [STORAGE_KEY]: '{"schemaVersion":7}', 'paperDollStudio.backup.latest': 'backup', 'paperDollStudio.quarantine.old': 'old', 'paperDollStudio.settings': 'old', paper_doll_language: 'tr', unrelated: 'keep' });
  let finishReset;
  const pending = resetObsoleteProject(storage, { resetAll: () => new Promise(resolve => { finishReset = resolve; }) });
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).schemaVersion, 7);
  finishReset({ ok: true });
  await pending;
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).schemaVersion, 8);
  assert.deepEqual([...storage.data.keys()].sort(), [STORAGE_KEY, 'unrelated'].sort());
  assert.equal(storage.getItem('unrelated'), 'keep');
});

test('Failed artwork reset never stamps the new version, so the next load retries', async () => {
  const storage = storageFor({ [STORAGE_KEY]: '{"schemaVersion":7}' });
  await assert.rejects(resetObsoleteProject(storage, { resetAll: async () => ({ ok: false, error: 'blocked' }) }), /blocked/);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).schemaVersion, 7);
  assert.equal(loadProject(storage, getAsset).resetRequired, true);
});

test('Incompatible imports and backups cannot reintroduce old data or silently wipe the project', async () => {
  for (const version of [undefined, 7, 9]) {
    const saved = { ...createDefaultEnvelope(), schemaVersion: version };
    assert.equal((await validateImportPayload(saved, getAsset)).ok, false);
    assert.equal(getAvailableBackup(storageFor({ [BACKUP_KEY_LATEST]: JSON.stringify(saved) }), getAsset).available, false);
  }
});

test('Malformed pack support metadata is rejected before the catalog is mounted', () => {
  const prop = CORE_PACK_MANIFEST.assets.find(a => a.id === 'prop_table');
  const manifest = assets => ({ ...CORE_PACK_MANIFEST, assets });
  assert.equal(validatePackManifest(manifest([{ ...prop, supportSurfaces: [{ ...prop.supportSurfaces[0], polygon: [[0, 0], [1, 1], [1, 0], [0, 1]] }] }])).valid, false);
  assert.equal(validatePackManifest(manifest([{ ...prop, placementRules: { ...prop.placementRules, allowedTargets: ['surface'] } }])).valid, false);
  const background = CORE_PACK_MANIFEST.assets.find(a => a.id === 'bg_bedroom');
  assert.equal(validatePackManifest(manifest([{ ...background, placementProfile: { regions: [background.placementProfile.regions[0], background.placementProfile.regions[0]] } }])).valid, false);
});

test('Trapezoid taper remains convex at its supported extremes', () => {
  for (const taper of [.05, .7, 1]) {
    const polygon = surfacePreset('trapezoid', .1, .2, .6, .1, taper);
    assert.equal(validPolygon(polygon), true);
    assert(Math.abs((polygon[1][0] - polygon[0][0]) / .6 - taper) < 1e-9);
  }
});

test('Background selection derives room constraints automatically when a profile exists', () => {
  const scene = changePlacementBackground({ ...furnished(), placementMode: 'free' }, 'bg_bedroom', getAsset);
  assert.equal(scene.placementMode, 'room');
  assert.equal(entity(scene, 'table').placement.kind, 'floor');
});


test('Retained pinned contacts resolve new tile references after a native panorama shrinks', () => {
  const background = { ...getAsset('bg_bedroom'), backgroundWidth: 3200, placementProfile: { regions: [{ id: 'floor', kind: 'floor', polygon: [[0, 646], [3200, 646], [3200, 900], [0, 900]] }] } };
  const lookup = id => id === 'bg_bedroom' ? background : getAsset(id);
  let scene = furnished(4800, 2700);
  scene = { ...scene, entities: scene.entities.map(e => e.instanceId === 'table' ? { ...e, placement: { kind: 'floor', regionId: 'floor:1' }, pinned: true } : e) };
  const preview = previewStageSize(scene, 3200, lookup);
  assert.deepEqual(preview.removedIds, []);
  assert.equal(entity(preview.scene, 'table').pinned, true);
  assert.equal(entity(preview.scene, 'table').placement.regionId, 'floor:0');
  assert.equal(entity(preview.scene, 'table').x, 2700);
  const reloaded = sanitizeScene(preview.scene, lookup);
  assert.equal(entity(reloaded, 'table').placement.kind, 'floor');
  assert.equal(entity(reloaded, 'tea').placement.kind, 'surface');
});

test('Factory reset creates a constrained welcome scene with no undo into old data', () => {
  const store = storeFor(furnished());
  store.dispatch({ type: 'project/factoryReset' });
  assert.equal(store.getState().currentScene.placementMode, 'room');
  assert.equal(store.getState().currentScene.entities[0].placement.kind, 'floor');
  const scene = store.getState().currentScene;
  store.dispatch({ type: 'app/undo' });
  assert.equal(store.getState().currentScene, scene);
});
