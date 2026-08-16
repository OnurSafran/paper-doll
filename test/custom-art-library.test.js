import test from 'node:test';
import assert from 'node:assert/strict';
import { countAssetUses } from '../js/domain/outfit-rules.js';
import { createAppStore } from '../js/core/app-store.js';
import { createDefaultEnvelope, createRuntimeState, sanitizeCustomAsset } from '../js/core/state-schema.js';
import { createCustomArtRepository } from '../js/services/custom-art-repository.js';
import { createAssetRegistry } from '../js/core/asset-registry.js';
import { createPaintView } from '../js/features/paint/paint-view.js';

// Minimal valid PNG for testing
const MINIMAL_PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82
]);

function createMockIndexedDB() {
  const databases = new Map();
  return {
    open(dbName, version = 1) {
      let db = databases.get(dbName);
      const isNew = !db;
      if (!db) {
        db = { name: dbName, version: 0, stores: new Map() };
        databases.set(dbName, db);
      }
      const request = { result: null, error: null, onupgradeneeded: null, onsuccess: null, onerror: null };
      queueMicrotask(() => {
        const dbWrapper = {
          name: dbName,
          version,
          objectStoreNames: { contains: (name) => db.stores.has(name) },
          createObjectStore(name, options = {}) {
            if (!db.stores.has(name)) {
              db.stores.set(name, { data: new Map(), keyPath: options.keyPath || null, indexes: new Map() });
            }
            return {
              createIndex(idxName, keyPath) { db.stores.get(name).indexes.set(idxName, keyPath); }
            };
          },
          transaction(storeNames, mode = 'readonly') {
            const tx = {
              error: null, oncomplete: null, onerror: null, onabort: null,
              abort() { if (tx.onabort) tx.onabort(); },
              objectStore(storeName) {
                const store = db.stores.get(storeName);
                if (!store) throw new Error(`Store not found: ${storeName}`);
                return {
                  get(key) {
                    const req = { result: undefined, error: null, onsuccess: null, onerror: null };
                    queueMicrotask(() => { req.result = store.data.get(key); if (req.onsuccess) req.onsuccess({ target: req }); });
                    return req;
                  },
                  getAll() {
                    const req = { result: [], error: null, onsuccess: null, onerror: null };
                    queueMicrotask(() => { req.result = Array.from(store.data.values()); if (req.onsuccess) req.onsuccess({ target: req }); });
                    return req;
                  },
                  put(val, key) {
                    const req = { result: key, error: null, onsuccess: null, onerror: null };
                    const effectiveKey = key ?? (store.keyPath ? val[store.keyPath] : null);
                    store.data.set(effectiveKey, val);
                    queueMicrotask(() => { if (req.onsuccess) req.onsuccess({ target: req }); });
                    return req;
                  },
                  delete(key) {
                    const req = { result: undefined, error: null, onsuccess: null, onerror: null };
                    store.data.delete(key);
                    queueMicrotask(() => { if (req.onsuccess) req.onsuccess({ target: req }); });
                    return req;
                  },
                  clear() {
                    const req = { result: undefined, error: null, onsuccess: null, onerror: null };
                    store.data.clear();
                    queueMicrotask(() => { if (req.onsuccess) req.onsuccess({ target: req }); });
                    return req;
                  },
                  index(idxName) {
                    const keyField = store.indexes.get(idxName);
                    return {
                      getAll(query) {
                        const req = { result: [], error: null, onsuccess: null, onerror: null };
                        queueMicrotask(() => {
                          req.result = Array.from(store.data.values()).filter((item) => item[keyField] === query);
                          if (req.onsuccess) req.onsuccess({ target: req });
                        });
                        return req;
                      }
                    };
                  }
                };
              }
            };
            queueMicrotask(() => { if (tx.oncomplete) tx.oncomplete(); });
            return tx;
          },
          close() {}
        };
        if (isNew || db.version < version) {
          request.result = dbWrapper;
          if (request.onupgradeneeded) request.onupgradeneeded({ target: request, oldVersion: db.version, newVersion: version });
          db.version = version;
        }
        request.result = dbWrapper;
        if (request.onsuccess) request.onsuccess({ target: request });
      });
      return request;
    }
  };
}

test('countAssetUses accurately counts references across draft, presets, stage, and Scene Book', () => {
  const assetId = 'custom_shirt_1';
  const otherAssetId = 'custom_hat_2';

  const sampleState = {
    designer: {
      draft: {
        baseDollId: 'doll_classic_a',
        skinTone: 'peach',
        slots: {
          top: { assetId, color: 'coral' },
          bottom: null,
          hair: { assetId: 'hair_ponytail', color: 'brown' },
          dress: null,
          shoes: null,
          accessory: null
        }
      }
    },
    presets: [
      {
        presetId: 'preset_1',
        name: 'Summer Doll',
        slots: { top: { assetId, color: 'coral' }, bottom: null, hair: null, dress: null, shoes: null, accessory: null }
      },
      {
        presetId: 'preset_2',
        name: 'Winter Doll',
        slots: { top: null, bottom: null, hair: null, dress: null, shoes: null, accessory: { assetId: otherAssetId, color: 'gold' } }
      }
    ],
    currentScene: {
      sceneId: 'scene_current',
      entities: [
        {
          instanceId: 'char_inst_1',
          kind: 'character',
          characterSnapshot: {
            slots: { top: { assetId, color: 'coral' }, bottom: null, hair: null, dress: null, shoes: null, accessory: null }
          }
        },
        {
          instanceId: 'prop_inst_1',
          kind: 'prop',
          sourceId: otherAssetId
        }
      ]
    },
    scenes: [
      {
        sceneId: 'scene_saved_1',
        title: 'Tea Party Story',
        entities: [
          {
            instanceId: 'char_inst_2',
            kind: 'character',
            characterSnapshot: {
              slots: { top: { assetId, color: 'coral' }, bottom: null, hair: null, dress: null, shoes: null, accessory: null }
            }
          }
        ]
      }
    ]
  };

  const impact = countAssetUses(assetId, sampleState);
  assert.equal(impact.totalUses, 4);
  assert.equal(impact.inDesignerDraft, true);
  assert.equal(impact.presets.length, 1);
  assert.equal(impact.presets[0].name, 'Summer Doll');
  assert.equal(impact.currentSceneUses, 1);
  assert.equal(impact.scenes.length, 1);
  assert.equal(impact.scenes[0].title, 'Tea Party Story');
  assert.equal(impact.formattedSummary, 'Used 4 times across 4 dolls and 2 scenes');

  // Test prop usage counting
  const propImpact = countAssetUses(otherAssetId, sampleState);
  assert.equal(propImpact.totalUses, 2);
  assert.equal(propImpact.inDesignerDraft, false);
  assert.equal(propImpact.presets.length, 1);
  assert.equal(propImpact.currentSceneUses, 1);
});

test('AppStore customAsset/remove vs customAsset/deleteWithUses and single-step undo behavior', () => {
  const customWearable = sanitizeCustomAsset({
    assetId: 'custom_dress_1',
    name: 'Party Gown',
    kind: 'wearable',
    slot: 'dress',
    logicalWidth: 300,
    logicalHeight: 450,
    pixelWidth: 600,
    pixelHeight: 900
  });

  const envelope = {
    ...createDefaultEnvelope(),
    customAssets: [customWearable],
    presets: [
      {
        presetId: 'preset_alice',
        name: 'Alice',
        baseDollId: 'doll_classic_a',
        skinTone: 'peach',
        slots: { dress: { assetId: 'custom_dress_1', color: 'coral' }, top: null, bottom: null, hair: null, shoes: null, accessory: null }
      }
    ],
    currentScene: {
      sceneId: 'scene_act',
      stageWidth: 1600,
      cameraX: 0,
      backgroundId: 'bg_bedroom',
      entities: [
        {
          instanceId: 'char_1',
          kind: 'character',
          sourceId: 'preset_alice',
          characterSnapshot: {
            baseDollId: 'doll_classic_a',
            skinTone: 'peach',
            slots: { dress: { assetId: 'custom_dress_1', color: 'coral' }, top: null, bottom: null, hair: null, shoes: null, accessory: null }
          },
          x: 400,
          y: 700,
          scale: 1,
          order: 1
        }
      ]
    }
  };

  const store = createAppStore(envelope);

  // 1. Test customAsset/remove (Normal action: marks trashed & hidden, preserves references as placeholders)
  const removeRes = store.dispatch({ type: 'customAsset/remove', assetId: 'custom_dress_1' });
  assert.equal(removeRes.ok, true);

  const trashedCustom = store.getState().customAssets.find((a) => a.assetId === 'custom_dress_1');
  assert.equal(trashedCustom.status, 'trashed');
  assert.equal(trashedCustom.libraryVisible, false);
  // Preset still references custom_dress_1
  assert.equal(store.getState().presets[0].slots.dress.assetId, 'custom_dress_1');
  // Character in scene still references custom_dress_1
  assert.equal(store.getState().currentScene.entities[0].characterSnapshot.slots.dress.assetId, 'custom_dress_1');

  // Restore action
  const restoreRes = store.dispatch({ type: 'customAsset/restore', assetId: 'custom_dress_1' });
  assert.equal(restoreRes.ok, true);
  assert.equal(store.getState().customAssets.find((a) => a.assetId === 'custom_dress_1').status, 'available');
  assert.equal(store.getState().customAssets.find((a) => a.assetId === 'custom_dress_1').libraryVisible, true);

  // 2. Test customAsset/deleteWithUses (Destructive action: cleans references atomically across all collections)
  const deleteRes = store.dispatch({ type: 'customAsset/deleteWithUses', assetId: 'custom_dress_1' });
  assert.equal(deleteRes.ok, true);
  assert.equal(store.getState().customAssets.length, 0);
  assert.equal(store.getState().presets[0].slots.dress, null);
  assert.equal(store.getState().currentScene.entities[0].characterSnapshot.slots.dress, null);

  // 3. Test single-step undo
  assert.equal(store.canUndo(), true);
  const undoRes = store.dispatch({ type: 'app/undo' });
  assert.equal(undoRes.ok, true);

  // References and customAssets restored
  assert.equal(store.getState().customAssets.length, 1);
  assert.equal(store.getState().presets[0].slots.dress.assetId, 'custom_dress_1');
  assert.equal(store.getState().currentScene.entities[0].characterSnapshot.slots.dress.assetId, 'custom_dress_1');
});

test('CustomArtRepository trash lifecycle and emptyTrash safety', async () => {
  const mockIDB = createMockIndexedDB();
  const repo = createCustomArtRepository({ indexedDB: mockIDB });

  await repo.saveArtwork('custom_trash_test_1', MINIMAL_PNG_BYTES);
  await repo.saveArtwork('custom_trash_test_2', MINIMAL_PNG_BYTES);

  // Move 1 item to trash
  const trashRes = await repo.moveToTrash('custom_trash_test_1');
  assert.equal(trashRes.ok, true);
  assert.equal(await repo.getArtwork('custom_trash_test_1'), null);
  assert.notEqual(await repo.getArtwork('custom_trash_test_2'), null);

  // Restore from trash
  const restoreRes = await repo.restoreFromTrash('custom_trash_test_1');
  assert.equal(restoreRes.ok, true);
  assert.notEqual(await repo.getArtwork('custom_trash_test_1'), null);

  // Empty trash permanently clears trash store without touching artwork store
  await repo.moveToTrash('custom_trash_test_1');
  const emptyRes = await repo.emptyTrash();
  assert.equal(emptyRes.ok, true);

  // Item is no longer in trash to restore
  const failedRestore = await repo.restoreFromTrash('custom_trash_test_1');
  assert.equal(failedRestore.ok, false);

  // Item 2 in artwork store remained completely intact
  assert.notEqual(await repo.getArtwork('custom_trash_test_2'), null);

  // Permanent deletion also removes records that currently live in trash.
  await repo.moveToTrash('custom_trash_test_2');
  const deleteRes = await repo.deleteArtwork('custom_trash_test_2');
  assert.equal(deleteRes.ok, true);
  assert.equal((await repo.restoreFromTrash('custom_trash_test_2')).ok, false);
});

test('CustomArtRepository scanOrphans and pruneOrphans safely accounts for all stores', async () => {
  const mockIDB = createMockIndexedDB();
  const repo = createCustomArtRepository({ indexedDB: mockIDB });

  await repo.saveArtwork('custom_active_1', MINIMAL_PNG_BYTES);
  await repo.saveArtwork('custom_orphan_1', MINIMAL_PNG_BYTES);
  await repo.saveArtwork('custom_orphan_2', MINIMAL_PNG_BYTES);

  // scanOrphans with referenced IDs
  const orphans = await repo.scanOrphans(['custom_active_1']);
  assert.equal(orphans.length, 2);
  assert.ok(orphans.includes('custom_orphan_1'));
  assert.ok(orphans.includes('custom_orphan_2'));

  // pruneOrphans
  const pruneRes = await repo.pruneOrphans(orphans);
  assert.equal(pruneRes.ok, true);
  assert.equal(pruneRes.prunedCount, 2);

  // Verified that only orphans were removed
  assert.equal(await repo.getArtwork('custom_orphan_1'), null);
  assert.equal(await repo.getArtwork('custom_orphan_2'), null);
  assert.notEqual(await repo.getArtwork('custom_active_1'), null);
});

test('AssetRegistry descriptor marks missing and trashed custom items accurately', () => {
  const customAssets = [
    {
      assetId: 'custom_avail_1',
      name: 'Available Shirt',
      kind: 'wearable',
      slot: 'top',
      status: 'available',
      logicalWidth: 300,
      logicalHeight: 450
    },
    {
      assetId: 'custom_trashed_1',
      name: 'Trashed Hat',
      kind: 'wearable',
      slot: 'accessory',
      status: 'trashed',
      logicalWidth: 300,
      logicalHeight: 450
    }
  ];

  const registry = createAssetRegistry(customAssets);
  const avail = registry.getAsset('custom_avail_1');
  assert.equal(avail.custom, true);
  assert.equal(avail.status, 'available');

  const trashed = registry.getAsset('custom_trashed_1');
  assert.equal(trashed.custom, true);
  assert.equal(trashed.status, 'trashed');

  const missing = registry.getAsset('custom_nonexistent_99');
  assert.equal(missing.custom, true);
  assert.equal(missing.status, 'missing');
});

test('My Art library and impact dialogs expose accessible markup and contracts', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');
  const paintViewJs = readFileSync(new URL('../js/features/paint/paint-view.js', import.meta.url), 'utf8');

  // HTML dialogs and buttons
  assert.match(html, /id="paint-myart-btn"/);
  assert.match(html, /id="paint-myart-dialog"/);
  assert.match(html, /id="myart-tab-all"/);
  assert.match(html, /id="myart-tab-wearable"/);
  assert.match(html, /id="myart-tab-prop"/);
  assert.match(html, /id="myart-tab-trash"/);
  assert.match(html, /id="myart-empty-trash-btn"/);
  assert.match(html, /id="paint-impact-dialog"/);
  assert.match(html, /id="paint-impact-remove-btn"/);
  assert.match(html, /id="paint-impact-delete-all-btn"/);
  assert.match(html, /id="paint-rename-dialog"/);

  // CSS rules
  assert.match(css, /\.myart-dialog/);
  assert.match(css, /\.myart-grid/);
  assert.match(css, /\.myart-card/);
  assert.match(css, /\.impact-dialog/);
  assert.match(css, /\.impact-art-preview/);

  // Paint view controller methods
  assert.match(paintViewJs, /openMyArtDialog/);
  assert.match(paintViewJs, /renderMyArtCards/);
  assert.match(paintViewJs, /editCopyOfArtwork/);
  assert.match(paintViewJs, /openImpactDialog/);
  assert.match(paintViewJs, /handleRemoveFromMyArt/);
  assert.match(paintViewJs, /handleDeleteWithUses/);
  assert.match(paintViewJs, /handleRestoreArtwork/);
  assert.match(paintViewJs, /handleDeletePermanently/);
  assert.match(paintViewJs, /handleEmptyTrash/);
});
