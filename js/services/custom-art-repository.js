/**
 * Custom Art Repository Service
 * Single authority for IndexedDB database creation, transactions,
 * PNG blob validation, staging, drafts, backups, trash, and tracked object URLs.
 */

import { CUSTOM_ID_PREFIX, isCustomAssetId, LIMITS } from '../domain/vocabulary.js';

export const DB_NAME = 'paperDollStudio';
export const DB_VERSION = 1;

export const STORES = Object.freeze({
  ARTWORK: 'artwork',
  DRAFTS: 'drafts',
  STAGING: 'staging',
  BACKUPS: 'backups',
  TRASH: 'trash'
});

export const PNG_SIGNATURE = Object.freeze([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * Validates PNG signature bytes and extracts pixel dimensions from the IHDR chunk.
 */
export function parsePngHeader(bytes) {
  if (!(bytes instanceof Uint8Array) && !(bytes instanceof ArrayBuffer)) {
    return { ok: false, error: 'Expected byte buffer.' };
  }
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length < 26) {
    return { ok: false, error: 'File is too small to be a valid PNG image.' };
  }
  for (let i = 0; i < 8; i += 1) {
    if (u8[i] !== PNG_SIGNATURE[i]) {
      return { ok: false, error: 'Invalid PNG header signature.' };
    }
  }
  // Check for IHDR at offset 12..15
  const ihdr = String.fromCharCode(u8[12], u8[13], u8[14], u8[15]);
  if (ihdr !== 'IHDR') {
    return { ok: false, error: 'Missing PNG IHDR chunk header.' };
  }
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  const bitDepth = u8[24];
  const colorType = u8[25];

  if (width === 0 || height === 0) {
    return { ok: false, error: 'Invalid PNG pixel dimensions (0x0).' };
  }

  return {
    ok: true,
    width,
    height,
    bitDepth,
    colorType,
    byteLength: u8.byteLength
  };
}

/**
 * Computes SHA-256 digest string for a byte buffer.
 */
export async function computeSha256(bytes, cryptoInstance = globalThis.crypto) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (cryptoInstance?.subtle?.digest) {
    const hashBuffer = await cryptoInstance.subtle.digest('SHA-256', u8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  throw new Error('Web Crypto SHA-256 is unavailable.');
}

/**
 * Encodes a Uint8Array into a Base64 string.
 */
export function uint8ArrayToBase64(u8) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('base64');
  }
  let binary = '';
  const len = u8.byteLength;
  for (let i = 0; i < len; i += 1) {
    binary += String.fromCharCode(u8[i]);
  }
  return btoa(binary);
}

/**
 * Decodes a Base64 string into a Uint8Array.
 */
export function base64ToUint8Array(base64) {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Converts a Blob or Uint8Array to Uint8Array.
 */
export async function blobToUint8Array(blobOrBytes) {
  if (blobOrBytes instanceof Uint8Array) return blobOrBytes;
  if (blobOrBytes instanceof ArrayBuffer) return new Uint8Array(blobOrBytes);
  if (blobOrBytes && typeof blobOrBytes.arrayBuffer === 'function') {
    const buf = await blobOrBytes.arrayBuffer();
    return new Uint8Array(buf);
  }
  throw new Error('Unsupported blob or buffer type');
}

/**
 * Creates the Custom Art Repository service.
 */
export function createCustomArtRepository(options = {}) {
  const indexedDB = options.indexedDB ?? globalThis.indexedDB;
  const cryptoInstance = options.crypto ?? globalThis.crypto;
  const createObjectURL = options.createObjectURL ?? (globalThis.URL?.createObjectURL?.bind(globalThis.URL) || ((b) => `blob:mock-${Math.random()}`));
  const revokeObjectURL = options.revokeObjectURL ?? (globalThis.URL?.revokeObjectURL?.bind(globalThis.URL) || (() => {}));
  const now = options.now ?? (() => new Date());

  let dbPromise = null;
  const objectUrlCache = new Map(); // assetId -> { url, blob }
  const objectUrlPromises = new Map(); // assetId -> Promise<string|null>

  function isAvailable() {
    return Boolean(indexedDB && typeof indexedDB.open === 'function');
  }

  function getDb() {
    if (!isAvailable()) {
      return Promise.reject(new Error('IndexedDB is not available.'));
    }
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      let request;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (err) {
        reject(err);
        return;
      }

      request.onerror = () => {
        reject(request.error || new Error('Could not open IndexedDB database.'));
      };

      request.onblocked = () => {
        reject(new Error('Database open blocked by another tab.'));
      };

      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORES.ARTWORK)) {
          db.createObjectStore(STORES.ARTWORK, { keyPath: 'assetId' });
        }
        if (!db.objectStoreNames.contains(STORES.DRAFTS)) {
          db.createObjectStore(STORES.DRAFTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.STAGING)) {
          const stagingStore = db.createObjectStore(STORES.STAGING, { keyPath: 'key' });
          stagingStore.createIndex('by_operation', 'operationId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.BACKUPS)) {
          db.createObjectStore(STORES.BACKUPS, { keyPath: 'backupId' });
        }
        if (!db.objectStoreNames.contains(STORES.TRASH)) {
          db.createObjectStore(STORES.TRASH, { keyPath: 'assetId' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
    });

    return dbPromise;
  }

  function reqToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function transactionToPromise(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed.'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted.'));
    });
  }

  async function saveArtwork(assetId, blobOrBytes, meta = {}) {
    if (!isCustomAssetId(assetId)) {
      return { ok: false, error: `Invalid custom asset ID: ${assetId}` };
    }
    if (await getArtwork(assetId)) {
      return { ok: false, error: 'Artwork IDs are immutable; save the edit as a new asset.' };
    }
    const bytes = await blobToUint8Array(blobOrBytes);
    const parsed = parsePngHeader(bytes);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }
    if (bytes.byteLength > LIMITS.MAX_CUSTOM_ASSET_BYTES) {
      return { ok: false, error: `Custom artwork exceeds max size (${LIMITS.MAX_CUSTOM_ASSET_BYTES} bytes).` };
    }
    if ((meta.pixelWidth != null && meta.pixelWidth !== parsed.width) ||
      (meta.pixelHeight != null && meta.pixelHeight !== parsed.height)) {
      return { ok: false, error: 'PNG dimensions do not match artwork metadata.' };
    }

    const sha256 = await computeSha256(bytes, cryptoInstance);
    if (meta.sha256 && meta.sha256 !== sha256) {
      return { ok: false, error: 'SHA-256 digest mismatch.' };
    }

    const blob = new Blob([bytes], { type: 'image/png' });

    const stamp = now().toISOString();
    const record = {
      assetId,
      blob,
      byteLength: bytes.byteLength,
      pixelWidth: parsed.width,
      pixelHeight: parsed.height,
      sha256,
      createdAt: meta.createdAt || stamp,
      updatedAt: stamp
    };

    try {
      const db = await getDb();
      const tx = db.transaction(STORES.ARTWORK, 'readwrite');
      const txDone = transactionToPromise(tx);
      const store = tx.objectStore(STORES.ARTWORK);
      await reqToPromise(store.put(record));
      await txDone;

      // Revoke any previous cached object URL so next request creates fresh one
      if (objectUrlCache.has(assetId)) {
        revokeObjectURL(objectUrlCache.get(assetId).url);
        objectUrlCache.delete(assetId);
      }

      return {
        ok: true,
        record: {
          assetId,
          byteLength: bytes.byteLength,
          pixelWidth: parsed.width,
          pixelHeight: parsed.height,
          sha256,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt
        }
      };
    } catch (err) {
      return { ok: false, error: err.message || 'Storage write failed' };
    }
  }

  async function getArtwork(assetId) {
    if (!assetId) return null;
    try {
      const db = await getDb();
      const tx = db.transaction(STORES.ARTWORK, 'readonly');
      const store = tx.objectStore(STORES.ARTWORK);
      const record = await reqToPromise(store.get(assetId));
      return record || null;
    } catch {
      return null;
    }
  }

  async function getTrashArtwork(assetId) {
    if (!assetId) return null;
    try {
      const db = await getDb();
      const tx = db.transaction(STORES.TRASH, 'readonly');
      const record = await reqToPromise(tx.objectStore(STORES.TRASH).get(assetId));
      return record || null;
    } catch {
      return null;
    }
  }

  async function getAllArtwork() {
    try {
      const db = await getDb();
      const tx = db.transaction(STORES.ARTWORK, 'readonly');
      return await reqToPromise(tx.objectStore(STORES.ARTWORK).getAll());
    } catch {
      return [];
    }
  }

  async function hasArtwork(assetId) {
    const item = await getArtwork(assetId);
    return Boolean(item);
  }

  async function deleteArtwork(assetId) {
    if (!assetId) return { ok: false };
    try {
      const db = await getDb();
      const tx = db.transaction([STORES.ARTWORK, STORES.TRASH], 'readwrite');
      const txDone = transactionToPromise(tx);
      await reqToPromise(tx.objectStore(STORES.ARTWORK).delete(assetId));
      await reqToPromise(tx.objectStore(STORES.TRASH).delete(assetId));
      await txDone;

      if (objectUrlCache.has(assetId)) {
        revokeObjectURL(objectUrlCache.get(assetId).url);
        objectUrlCache.delete(assetId);
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function moveToTrash(assetId, reason = 'user_removed') {
    if (!assetId) return { ok: false };
    try {
      const db = await getDb();
      const tx = db.transaction([STORES.ARTWORK, STORES.TRASH], 'readwrite');
      const txDone = transactionToPromise(tx);
      const artStore = tx.objectStore(STORES.ARTWORK);
      const trashStore = tx.objectStore(STORES.TRASH);

      const record = await reqToPromise(artStore.get(assetId));
      if (!record) return { ok: false, error: 'Artwork not found.' };

      const trashRecord = {
        ...record,
        trashedAt: now().toISOString(),
        reason
      };

      await reqToPromise(trashStore.put(trashRecord));
      await reqToPromise(artStore.delete(assetId));
      await txDone;

      if (objectUrlCache.has(assetId)) {
        revokeObjectURL(objectUrlCache.get(assetId).url);
        objectUrlCache.delete(assetId);
      }

      return { ok: true, trashedAt: trashRecord.trashedAt };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function restoreFromTrash(assetId) {
    if (!assetId) return { ok: false };
    try {
      const db = await getDb();
      const tx = db.transaction([STORES.ARTWORK, STORES.TRASH], 'readwrite');
      const txDone = transactionToPromise(tx);
      const artStore = tx.objectStore(STORES.ARTWORK);
      const trashStore = tx.objectStore(STORES.TRASH);

      const trashRecord = await reqToPromise(trashStore.get(assetId));
      if (!trashRecord) return { ok: false, error: 'Trash record not found.' };

      const { trashedAt, reason, ...artRecord } = trashRecord;
      artRecord.updatedAt = now().toISOString();

      await reqToPromise(artStore.put(artRecord));
      await reqToPromise(trashStore.delete(assetId));
      await txDone;

      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function emptyTrash(assetIds = null) {
    try {
      const db = await getDb();
      const tx = db.transaction(STORES.TRASH, 'readwrite');
      const txDone = transactionToPromise(tx);
      const trashStore = tx.objectStore(STORES.TRASH);
      const trashedItems = await reqToPromise(trashStore.getAll());
      const targetIds = Array.isArray(assetIds) ? new Set(assetIds) : null;
      for (const item of trashedItems) {
        if (!targetIds || targetIds.has(item.assetId)) {
          await reqToPromise(trashStore.delete(item.assetId));
        }
      }
      await txDone;
      for (const item of trashedItems) {
        if (!targetIds || targetIds.has(item.assetId)) revokeTrackedObjectUrl(item.assetId);
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function stageArtwork(operationId, assetId, blobOrBytes, meta = {}) {
    if (!operationId || !isCustomAssetId(assetId)) {
      return { ok: false, error: 'Invalid staging parameters.' };
    }
    const bytes = await blobToUint8Array(blobOrBytes);
    const parsed = parsePngHeader(bytes);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    if (bytes.byteLength > LIMITS.MAX_CUSTOM_ASSET_BYTES) {
      return { ok: false, error: 'Staged artwork exceeds byte limit.' };
    }
    if ((meta.pixelWidth != null && meta.pixelWidth !== parsed.width) ||
      (meta.pixelHeight != null && meta.pixelHeight !== parsed.height)) {
      return { ok: false, error: 'PNG dimensions do not match artwork metadata.' };
    }

    const sha256 = await computeSha256(bytes, cryptoInstance);
    if (meta.sha256 && meta.sha256 !== sha256) {
      return { ok: false, error: 'SHA-256 digest mismatch.' };
    }
    const blob = new Blob([bytes], { type: 'image/png' });

    const key = `${operationId}/${assetId}`;
    const record = {
      key,
      operationId,
      assetId,
      blob,
      byteLength: bytes.byteLength,
      pixelWidth: parsed.width,
      pixelHeight: parsed.height,
      sha256,
      meta,
      stagedAt: now().toISOString()
    };

    try {
      const db = await getDb();
      const tx = db.transaction(STORES.STAGING, 'readwrite');
      const txDone = transactionToPromise(tx);
      const store = tx.objectStore(STORES.STAGING);
      await reqToPromise(store.put(record));
      await txDone;
      return { ok: true, key, sha256 };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function commitStagedArtwork(operationId) {
    if (!operationId) return { ok: false, count: 0 };
    try {
      const db = await getDb();
      const tx = db.transaction([STORES.STAGING, STORES.ARTWORK], 'readwrite');
      const txDone = transactionToPromise(tx);
      const stagingStore = tx.objectStore(STORES.STAGING);
      const artworkStore = tx.objectStore(STORES.ARTWORK);

      let stagedItems = [];
      if (stagingStore.indexNames?.contains('by_operation')) {
        const index = stagingStore.index('by_operation');
        stagedItems = await reqToPromise(index.getAll(operationId));
      } else {
        const all = await reqToPromise(stagingStore.getAll());
        stagedItems = all.filter((item) => item.operationId === operationId);
      }

      for (const item of stagedItems) {
        const stamp = now().toISOString();
        const artRecord = {
          assetId: item.assetId,
          blob: item.blob,
          byteLength: item.byteLength,
          pixelWidth: item.pixelWidth,
          pixelHeight: item.pixelHeight,
          sha256: item.sha256,
          createdAt: item.meta?.createdAt || stamp,
          updatedAt: stamp
        };
        await reqToPromise(artworkStore.put(artRecord));
        await reqToPromise(stagingStore.delete(item.key));
        if (objectUrlCache.has(item.assetId)) {
          revokeObjectURL(objectUrlCache.get(item.assetId).url);
          objectUrlCache.delete(item.assetId);
        }
      }

      await txDone;

      return { ok: true, count: stagedItems.length };
    } catch (err) {
      return { ok: false, error: err.message, count: 0 };
    }
  }

  async function pruneStaging(operationId) {
    try {
      const db = await getDb();
      const tx = db.transaction(STORES.STAGING, 'readwrite');
      const txDone = transactionToPromise(tx);
      const store = tx.objectStore(STORES.STAGING);
      if (operationId) {
        const all = await reqToPromise(store.getAll());
        for (const item of all) {
          if (item.operationId === operationId) {
            await reqToPromise(store.delete(item.key));
          }
        }
      } else {
        await reqToPromise(store.clear());
      }
      await txDone;
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function stageArtworkBatch(operationId, items = []) {
    if (!operationId || !Array.isArray(items)) {
      return { ok: false, count: 0, error: 'Invalid staging batch.' };
    }
    for (const item of items) {
      const result = await stageArtwork(operationId, item.metadata?.assetId, item.bytes ?? item.blob, item.metadata || {});
      if (!result.ok) {
        await pruneStaging(operationId);
        return { ok: false, count: 0, error: result.error };
      }
    }
    return { ok: true, count: items.length };
  }

  async function saveBackup(backupId, envelope, customArtworkBlobs = []) {
    if (!backupId || !envelope) return { ok: false, error: 'Invalid backup parameters.' };
    const artworkById = new Map(customArtworkBlobs.map((item) => [item.assetId, item]));
    for (const asset of envelope.customAssets || []) {
      if (asset.status !== 'available') continue;
      const item = artworkById.get(asset.assetId);
      if (!item?.blob) return { ok: false, error: `Backup artwork is missing: ${asset.name || asset.assetId}.` };
      try {
        const bytes = await blobToUint8Array(item.blob);
        const parsed = parsePngHeader(bytes);
        const sha256 = await computeSha256(bytes, cryptoInstance);
        if (!parsed.ok || bytes.byteLength !== asset.byteLength || parsed.width !== asset.pixelWidth ||
          parsed.height !== asset.pixelHeight || sha256 !== asset.sha256) {
          return { ok: false, error: `Backup artwork is corrupt: ${asset.name || asset.assetId}.` };
        }
      } catch {
        return { ok: false, error: `Backup artwork could not be validated: ${asset.name || asset.assetId}.` };
      }
    }
    const stamp = now().toISOString();
    const backupRecord = {
      backupId,
      backedUpAt: stamp,
      envelope,
      artwork: customArtworkBlobs.map((item) => ({
        assetId: item.assetId,
        blob: item.blob,
        byteLength: item.byteLength,
        sha256: item.sha256
      }))
    };

    try {
      const db = await getDb();
      const tx = db.transaction(STORES.BACKUPS, 'readwrite');
      const txDone = transactionToPromise(tx);
      const store = tx.objectStore(STORES.BACKUPS);
      const existingBackups = await reqToPromise(store.getAll());
      for (const existing of existingBackups) {
        if (existing.backupId !== backupId) await reqToPromise(store.delete(existing.backupId));
      }
      await reqToPromise(store.put(backupRecord));
      await txDone;
      return { ok: true, backupId, backedUpAt: stamp };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function getBackup(backupId) {
    if (!backupId) return null;
    try {
      const db = await getDb();
      const tx = db.transaction(STORES.BACKUPS, 'readonly');
      const store = tx.objectStore(STORES.BACKUPS);
      return await reqToPromise(store.get(backupId));
    } catch {
      return null;
    }
  }

  async function getLatestBackup() {
    try {
      const db = await getDb();
      const tx = db.transaction(STORES.BACKUPS, 'readonly');
      const store = tx.objectStore(STORES.BACKUPS);
      const all = await reqToPromise(store.getAll());
      if (!all || all.length === 0) return null;
      all.sort((a, b) => (b.backedUpAt || '').localeCompare(a.backedUpAt || ''));
      return all[0];
    } catch {
      return null;
    }
  }

  async function restoreBackup(backupId) {
    const backup = await getBackup(backupId);
    if (!backup || !Array.isArray(backup.artwork)) {
      return { ok: false, error: 'Backup not found or incomplete.' };
    }
    try {
      const db = await getDb();
      const tx = db.transaction(STORES.ARTWORK, 'readwrite');
      const txDone = transactionToPromise(tx);
      const store = tx.objectStore(STORES.ARTWORK);
      for (const item of backup.artwork) {
        const bytes = await blobToUint8Array(item.blob);
        const parsed = parsePngHeader(bytes);
        if (!parsed.ok || bytes.byteLength !== item.byteLength) {
          throw new Error('Backup artwork failed validation.');
        }
        const sha256 = await computeSha256(bytes, cryptoInstance);
        if (sha256 !== item.sha256) throw new Error('Backup artwork digest mismatch.');
        await reqToPromise(store.put({
          ...item,
          pixelWidth: parsed.width,
          pixelHeight: parsed.height,
          sha256
        }));
        if (objectUrlCache.has(item.assetId)) {
          revokeObjectURL(objectUrlCache.get(item.assetId).url);
          objectUrlCache.delete(item.assetId);
        }
      }
      await txDone;
      return { ok: true, count: backup.artwork.length };
    } catch (err) {
      return { ok: false, error: err.message || 'Backup restore failed.' };
    }
  }

  async function saveDraft(blobOrBytes, metadata = {}) {
    const bytes = await blobToUint8Array(blobOrBytes);
    const parsed = parsePngHeader(bytes);
    if (!parsed.ok) return { ok: false, error: parsed.error };

    const blob = blobOrBytes instanceof Uint8Array || blobOrBytes instanceof ArrayBuffer
      ? new Blob([bytes], { type: 'image/png' })
      : blobOrBytes;

    const draftRecord = {
      id: 'active',
      blob,
      byteLength: bytes.byteLength,
      pixelWidth: parsed.width,
      pixelHeight: parsed.height,
      metadata,
      updatedAt: now().toISOString()
    };

    try {
      const db = await getDb();
      const tx = db.transaction(STORES.DRAFTS, 'readwrite');
      const txDone = transactionToPromise(tx);
      const store = tx.objectStore(STORES.DRAFTS);
      await reqToPromise(store.put(draftRecord));
      await txDone;
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function getDraft() {
    try {
      const db = await getDb();
      const tx = db.transaction(STORES.DRAFTS, 'readonly');
      const store = tx.objectStore(STORES.DRAFTS);
      const res = await reqToPromise(store.get('active'));
      return res || null;
    } catch {
      return null;
    }
  }

  async function clearDraft() {
    try {
      const db = await getDb();
      const tx = db.transaction(STORES.DRAFTS, 'readwrite');
      const txDone = transactionToPromise(tx);
      const store = tx.objectStore(STORES.DRAFTS);
      await reqToPromise(store.delete('active'));
      await txDone;
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function getTrackedObjectUrl(assetId) {
    if (!assetId) return null;
    if (objectUrlCache.has(assetId)) {
      return objectUrlCache.get(assetId).url;
    }
    if (objectUrlPromises.has(assetId)) return objectUrlPromises.get(assetId);
    const pending = (async () => {
      const item = await getArtwork(assetId) || await getTrashArtwork(assetId);
      if (!item || !item.blob) return null;
      try {
        const url = createObjectURL(item.blob);
        objectUrlCache.set(assetId, { url, blob: item.blob });
        return url;
      } catch {
        return null;
      } finally {
        objectUrlPromises.delete(assetId);
      }
    })();
    objectUrlPromises.set(assetId, pending);
    return pending;
  }

  function revokeTrackedObjectUrl(assetId) {
    if (objectUrlCache.has(assetId)) {
      const { url } = objectUrlCache.get(assetId);
      revokeObjectURL(url);
      objectUrlCache.delete(assetId);
    }
  }

  function revokeAllTrackedUrls() {
    for (const [, { url }] of objectUrlCache) {
      revokeObjectURL(url);
    }
    objectUrlCache.clear();
  }

  async function scanOrphans(referencedAssetIds = []) {
    try {
      const db = await getDb();
      const tx = db.transaction([STORES.ARTWORK, STORES.DRAFTS, STORES.STAGING, STORES.BACKUPS, STORES.TRASH], 'readonly');
      const [all, drafts, staging, backups, trash] = await Promise.all([
        reqToPromise(tx.objectStore(STORES.ARTWORK).getAll()),
        reqToPromise(tx.objectStore(STORES.DRAFTS).getAll()),
        reqToPromise(tx.objectStore(STORES.STAGING).getAll()),
        reqToPromise(tx.objectStore(STORES.BACKUPS).getAll()),
        reqToPromise(tx.objectStore(STORES.TRASH).getAll())
      ]);
      const referencedSet = new Set(referencedAssetIds);
      for (const item of drafts) {
        if (item.metadata?.assetId) referencedSet.add(item.metadata.assetId);
      }
      for (const item of staging) referencedSet.add(item.assetId);
      for (const backup of backups) {
        for (const item of backup.artwork || []) referencedSet.add(item.assetId);
      }
      for (const item of trash) referencedSet.add(item.assetId);
      return all
        .filter((record) => !referencedSet.has(record.assetId))
        .map((record) => record.assetId);
    } catch {
      return [];
    }
  }

  async function pruneOrphans(orphanAssetIds = [], referencedAssetIds = []) {
    if (!orphanAssetIds.length) return { ok: true, prunedCount: 0 };
    try {
      // Re-scan at deletion time. A caller may have held an old scan result,
      // so trusting IDs alone could delete artwork that became referenced.
      const confirmedOrphans = new Set(await scanOrphans(referencedAssetIds));
      const safeIds = orphanAssetIds.filter((id) => confirmedOrphans.has(id));
      if (!safeIds.length) return { ok: true, prunedCount: 0 };
      const db = await getDb();
      const tx = db.transaction(STORES.ARTWORK, 'readwrite');
      const txDone = transactionToPromise(tx);
      const store = tx.objectStore(STORES.ARTWORK);
      let count = 0;
      for (const id of safeIds) {
        await reqToPromise(store.delete(id));
        revokeTrackedObjectUrl(id);
        count += 1;
      }
      await txDone;
      return { ok: true, prunedCount: count };
    } catch (err) {
      return { ok: false, error: err.message, prunedCount: 0 };
    }
  }

  return {
    isAvailable,
    getDb,
    // Keep digest calculation behind the repository boundary so callers do
    // not need to know whether artwork is represented as a Blob or bytes.
    async computeSha256(blobOrBytes) {
      const bytes = await blobToUint8Array(blobOrBytes);
      return computeSha256(bytes, cryptoInstance);
    },
    saveArtwork,
    getArtwork,
    getAllArtwork,
    hasArtwork,
    deleteArtwork,
    moveToTrash,
    restoreFromTrash,
    emptyTrash,
    stageArtwork,
    stageArtworkBatch,
    commitStagedArtwork,
    pruneStaging,
    saveBackup,
    getBackup,
    getLatestBackup,
    restoreBackup,
    saveDraft,
    getDraft,
    clearDraft,
    getTrackedObjectUrl,
    revokeTrackedObjectUrl,
    revokeAllTrackedUrls,
    scanOrphans,
    pruneOrphans,
    close() {
      revokeAllTrackedUrls();
      if (dbPromise) {
        dbPromise.then((db) => db.close()).catch(() => {});
        dbPromise = null;
      }
    }
  };
}
