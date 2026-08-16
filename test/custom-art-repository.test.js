import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCustomArtRepository,
  uint8ArrayToBase64,
  base64ToUint8Array,
  computeSha256,
  parsePngHeader
} from '../js/services/custom-art-repository.js';
import { LIMITS } from '../js/domain/vocabulary.js';

// Valid 1x1 minimal PNG bytes
const MINIMAL_PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG magic header
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
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
        db = {
          name: dbName,
          version: 0,
          stores: new Map()
        };
        databases.set(dbName, db);
      }

      const request = {
        result: null,
        error: null,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null
      };

      queueMicrotask(() => {
        const dbWrapper = {
          name: dbName,
          version,
          objectStoreNames: {
            contains: (name) => db.stores.has(name)
          },
          createObjectStore(name, options = {}) {
            if (!db.stores.has(name)) {
              db.stores.set(name, {
                data: new Map(),
                keyPath: options.keyPath || null,
                indexes: new Map()
              });
            }
            return {
              createIndex(idxName, keyPath) {
                db.stores.get(name).indexes.set(idxName, keyPath);
              }
            };
          },
          transaction(storeNames, mode = 'readonly') {
            const txStoreNames = Array.isArray(storeNames) ? storeNames : [storeNames];
            const tx = {
              error: null,
              oncomplete: null,
              onerror: null,
              onabort: null,
              abort() {
                if (tx.onabort) tx.onabort();
              },
              objectStore(storeName) {
                const store = db.stores.get(storeName);
                if (!store) throw new Error(`Store not found: ${storeName}`);
                return {
                  get(key) {
                    const req = { result: undefined, error: null, onsuccess: null, onerror: null };
                    queueMicrotask(() => {
                      req.result = store.data.get(key);
                      if (req.onsuccess) req.onsuccess({ target: req });
                    });
                    return req;
                  },
                  getAll() {
                    const req = { result: [], error: null, onsuccess: null, onerror: null };
                    queueMicrotask(() => {
                      req.result = Array.from(store.data.values());
                      if (req.onsuccess) req.onsuccess({ target: req });
                    });
                    return req;
                  },
                  put(val, key) {
                    const req = { result: key, error: null, onsuccess: null, onerror: null };
                    const effectiveKey = key ?? (store.keyPath ? val[store.keyPath] : null);
                    store.data.set(effectiveKey, val);
                    queueMicrotask(() => {
                      if (req.onsuccess) req.onsuccess({ target: req });
                    });
                    return req;
                  },
                  delete(key) {
                    const req = { result: undefined, error: null, onsuccess: null, onerror: null };
                    store.data.delete(key);
                    queueMicrotask(() => {
                      if (req.onsuccess) req.onsuccess({ target: req });
                    });
                    return req;
                  },
                  clear() {
                    const req = { result: undefined, error: null, onsuccess: null, onerror: null };
                    store.data.clear();
                    queueMicrotask(() => {
                      if (req.onsuccess) req.onsuccess({ target: req });
                    });
                    return req;
                  },
                  index(idxName) {
                    const keyField = store.indexes.get(idxName);
                    return {
                      getAll(query) {
                        const req = { result: [], error: null, onsuccess: null, onerror: null };
                        queueMicrotask(() => {
                          const results = Array.from(store.data.values()).filter((item) => item[keyField] === query);
                          req.result = results;
                          if (req.onsuccess) req.onsuccess({ target: req });
                        });
                        return req;
                      }
                    };
                  }
                };
              }
            };

            queueMicrotask(() => {
              if (tx.oncomplete) tx.oncomplete();
            });
            return tx;
          },
          close() {}
        };

        if (isNew || db.version < version) {
          request.result = dbWrapper;
          if (request.onupgradeneeded) {
            request.onupgradeneeded({ target: request, oldVersion: db.version, newVersion: version });
          }
          db.version = version;
        }

        request.result = dbWrapper;
        if (request.onsuccess) request.onsuccess({ target: request });
      });

      return request;
    }
  };
}

test('computeSha256 and base64 codecs round-trip accurately', async () => {
  const b64 = uint8ArrayToBase64(MINIMAL_PNG_BYTES);
  assert.equal(typeof b64, 'string');
  const decoded = base64ToUint8Array(b64);
  assert.deepEqual(decoded, MINIMAL_PNG_BYTES);

  const hash = await computeSha256(MINIMAL_PNG_BYTES);
  assert.equal(typeof hash, 'string');
  assert.equal(hash.length, 64);
});

test('parsePngHeader validates 8-byte signature and dimensions', () => {
  const parsed = parsePngHeader(MINIMAL_PNG_BYTES);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.width, 1);
  assert.equal(parsed.height, 1);

  const invalid = new Uint8Array([1, 2, 3, 4]);
  assert.equal(parsePngHeader(invalid).ok, false);
});

test('CustomArtRepository initializes and saves valid PNG artwork', async () => {
  const mockIDB = createMockIndexedDB();
  const repo = createCustomArtRepository({ indexedDB: mockIDB });

  const saveRes = await repo.saveArtwork('custom_art_1', MINIMAL_PNG_BYTES);

  assert.equal(saveRes.ok, true);
  assert.equal(saveRes.record.assetId, 'custom_art_1');
  assert.equal(saveRes.record.byteLength, MINIMAL_PNG_BYTES.byteLength);

  const retrieved = await repo.getArtwork('custom_art_1');
  assert.notEqual(retrieved, null);
  assert.equal(retrieved.assetId, 'custom_art_1');
  assert.equal(retrieved.byteLength, MINIMAL_PNG_BYTES.byteLength);

  const overwrite = await repo.saveArtwork('custom_art_1', MINIMAL_PNG_BYTES);
  assert.equal(overwrite.ok, false);
  assert.match(overwrite.error, /immutable/);
});

test('CustomArtRepository rejects non-PNG data and oversized files', async () => {
  const mockIDB = createMockIndexedDB();
  const repo = createCustomArtRepository({ indexedDB: mockIDB });

  const fakeJpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const res1 = await repo.saveArtwork('custom_bad_1', fakeJpg);
  assert.equal(res1.ok, false);

  const oversized = new Uint8Array(LIMITS.MAX_CUSTOM_ASSET_BYTES + 100);
  oversized.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // Put IHDR
  oversized.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06], 8);
  const res2 = await repo.saveArtwork('custom_big_1', oversized);
  assert.equal(res2.ok, false);
});

test('CustomArtRepository manages soft deletion (trash) and restore', async () => {
  const mockIDB = createMockIndexedDB();
  const repo = createCustomArtRepository({ indexedDB: mockIDB });

  await repo.saveArtwork('custom_item_to_trash', MINIMAL_PNG_BYTES);

  const trashRes = await repo.moveToTrash('custom_item_to_trash');
  assert.equal(trashRes.ok, true);

  const checkMain = await repo.getArtwork('custom_item_to_trash');
  assert.equal(checkMain, null);

  const restoreRes = await repo.restoreFromTrash('custom_item_to_trash');
  assert.equal(restoreRes.ok, true);

  const checkRestored = await repo.getArtwork('custom_item_to_trash');
  assert.notEqual(checkRestored, null);
  assert.equal(checkRestored.assetId, 'custom_item_to_trash');
});

test('CustomArtRepository stages and commits artwork batches', async () => {
  const mockIDB = createMockIndexedDB();
  const repo = createCustomArtRepository({ indexedDB: mockIDB });

  const stageRes = await repo.stageArtwork('session_123', 'custom_staged_1', MINIMAL_PNG_BYTES);
  assert.equal(stageRes.ok, true);

  const commitRes = await repo.commitStagedArtwork('session_123');
  assert.equal(commitRes.ok, true);
  assert.equal(commitRes.count, 1);

  const retrieved = await repo.getArtwork('custom_staged_1');
  assert.notEqual(retrieved, null);
  assert.equal(retrieved.assetId, 'custom_staged_1');
});

test('CustomArtRepository creates full backup snapshot and restores it', async () => {
  const mockIDB = createMockIndexedDB();
  const repo = createCustomArtRepository({ indexedDB: mockIDB });

  await repo.saveArtwork('custom_art_a', MINIMAL_PNG_BYTES);
  await repo.saveArtwork('custom_art_b', MINIMAL_PNG_BYTES);

  const backupRes = await repo.saveBackup('backup_001', { version: 3 }, [
    { assetId: 'custom_art_a', blob: new Blob([MINIMAL_PNG_BYTES]), byteLength: MINIMAL_PNG_BYTES.byteLength, sha256: 'abc' }
  ]);
  assert.equal(backupRes.ok, true);

  const retrievedBackup = await repo.getBackup('backup_001');
  assert.notEqual(retrievedBackup, null);
  assert.equal(retrievedBackup.backupId, 'backup_001');
  assert.equal(retrievedBackup.artwork.length, 1);
});

test('CustomArtRepository manages tracked object URL cache lifecycle', async () => {
  let createdCount = 0;
  let revokedCount = 0;

  const mockCreateObjectUrl = () => {
    createdCount++;
    return `blob:test/${createdCount}`;
  };
  const mockRevokeObjectUrl = () => {
    revokedCount++;
  };

  const mockIDB = createMockIndexedDB();
  const repo = createCustomArtRepository({
    indexedDB: mockIDB,
    createObjectURL: mockCreateObjectUrl,
    revokeObjectURL: mockRevokeObjectUrl
  });

  await repo.saveArtwork('custom_art_url_1', MINIMAL_PNG_BYTES);

  const url1 = await repo.getTrackedObjectUrl('custom_art_url_1');
  assert.equal(url1, 'blob:test/1');
  assert.equal(createdCount, 1);

  // Second call retrieves cached URL without creating new one
  const url1Cached = await repo.getTrackedObjectUrl('custom_art_url_1');
  assert.equal(url1Cached, 'blob:test/1');
  assert.equal(createdCount, 1);

  // Revoke explicitly
  repo.revokeTrackedObjectUrl('custom_art_url_1');
  assert.equal(revokedCount, 1);

  // Ensure again creates new URL
  const url1New = await repo.getTrackedObjectUrl('custom_art_url_1');
  assert.equal(url1New, 'blob:test/2');
  assert.equal(createdCount, 2);

  // Clear all
  repo.revokeAllTrackedUrls();
  assert.equal(revokedCount, 2);
});

test('CustomArtRepository deduplicates concurrent object URL loads', async () => {
  let createdCount = 0;
  const mockIDB = createMockIndexedDB();
  const repo = createCustomArtRepository({
    indexedDB: mockIDB,
    createObjectURL: () => `blob:concurrent/${++createdCount}`
  });

  await repo.saveArtwork('custom_concurrent', MINIMAL_PNG_BYTES);
  const [first, second] = await Promise.all([
    repo.getTrackedObjectUrl('custom_concurrent'),
    repo.getTrackedObjectUrl('custom_concurrent')
  ]);
  assert.equal(first, second);
  assert.equal(createdCount, 1);
});

test('CustomArtRepository lists artwork and restores validated backup bytes', async () => {
  const mockIDB = createMockIndexedDB();
  const repo = createCustomArtRepository({ indexedDB: mockIDB });
  const saved = await repo.saveArtwork('custom_backup_restore', MINIMAL_PNG_BYTES);
  const backup = await repo.saveBackup('latest', { schemaVersion: 3 }, [
    { assetId: 'custom_backup_restore', blob: new Blob([MINIMAL_PNG_BYTES]), byteLength: MINIMAL_PNG_BYTES.byteLength, sha256: saved.record.sha256 }
  ]);
  assert.equal(backup.ok, true);
  assert.equal((await repo.getAllArtwork()).length, 1);
  await repo.deleteArtwork('custom_backup_restore');
  const restored = await repo.restoreBackup('latest');
  assert.equal(restored.ok, true);
  assert.ok(await repo.getArtwork('custom_backup_restore'));
});
