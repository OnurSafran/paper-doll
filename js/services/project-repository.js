/**
 * Project Repository Service
 * Single authority for project persistence, loading, monotonic revisions,
 * guarded writes, cross-tab conflict detection, and quarantine recovery.
 */

import { createDefaultEnvelope, sanitizeEnvelope, STORAGE_KEY } from '../core/state-schema.js';
import { LIMITS } from '../domain/vocabulary.js';

export { STORAGE_KEY };

/**
 * Load and validate a persisted project envelope from storage.
 * Separates storage availability from recovery outcome.
 */
export function loadEnvelope(storage, getAsset = () => undefined) {
  if (!storage) {
    const defaults = createDefaultEnvelope();
    return {
      envelope: defaults,
      warnings: ['Local storage is unavailable.'],
      available: false,
      recovered: false,
      baseRevision: defaults.revision
    };
  }

  let raw = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch (error) {
    const defaults = createDefaultEnvelope();
    return {
      envelope: defaults,
      warnings: ['Saved data could not be read; safe defaults were loaded.'],
      available: false,
      recovered: false,
      error,
      baseRevision: defaults.revision
    };
  }

  const cleanupWarnings = [];
  try {
    if (storage.getItem(`${STORAGE_KEY}.tmp`)) {
      storage.removeItem(`${STORAGE_KEY}.tmp`);
    }
  } catch {
    cleanupWarnings.push('Temporary recovery data could not be cleared.');
  }

  if (!raw) {
    const defaults = createDefaultEnvelope();
    return {
      envelope: defaults,
      warnings: cleanupWarnings,
      available: true,
      recovered: true,
      baseRevision: defaults.revision
    };
  }

  try {
    const parsed = JSON.parse(raw);
    const result = sanitizeEnvelope(parsed, getAsset);
    if (result.recovered === false && raw) {
      try {
        storage.setItem(`paperDollStudio.quarantine.${Date.now()}`, raw);
      } catch {
        /* quarantine is best-effort */
      }
    }
    return {
      ...result,
      warnings: [...cleanupWarnings, ...result.warnings],
      available: true,
      recovered: result.recovered !== false,
      baseRevision: result.envelope.revision ?? 1
    };
  } catch (error) {
    if (raw) {
      try {
        storage.setItem(`paperDollStudio.quarantine.${Date.now()}`, raw);
      } catch {
        /* quarantine is best-effort */
      }
    }
    const defaults = createDefaultEnvelope();
    return {
      envelope: defaults,
      warnings: [...cleanupWarnings, 'Saved data could not be read; safe defaults were loaded.'],
      available: false,
      recovered: false,
      error,
      baseRevision: defaults.revision
    };
  }
}

export const loadProject = loadEnvelope;

/**
 * Creates a project repository instance managing save scheduling,
 * guarded writes, monotonic revisions, and cross-tab conflict detection.
 */
export function createProjectRepository({
  storage,
  delay = LIMITS.AUTOSAVE_DEBOUNCE_MS,
  onStatus = () => {},
  initialRevision = 1,
  getAsset = () => undefined
} = {}) {
  let timer = null;
  let pending = null;
  let baseRevision = Number.isInteger(initialRevision) && initialRevision >= 1 ? initialRevision : 1;

  function getStorageRevision() {
    if (!storage) return null;
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      return Number.isInteger(parsed?.revision) && parsed.revision >= 1 ? parsed.revision : 0;
    } catch {
      return null;
    }
  }

  function hasConflict() {
    const diskRev = getStorageRevision();
    return diskRev != null && diskRev > baseRevision;
  }

  function save(envelope, { force = false } = {}) {
    if (!storage) {
      onStatus({ status: 'unsaved', message: 'Storage is unavailable; changes will not survive refresh.' });
      return { ok: false, code: 'STORAGE_UNAVAILABLE' };
    }

    const currentStorageRevision = getStorageRevision();
    if (!force && currentStorageRevision != null && currentStorageRevision > baseRevision) {
      onStatus({
        status: 'unsaved',
        message: 'Saved data was updated in another tab. Reload or overwrite confirmation required.'
      });
      return {
        ok: false,
        code: 'REVISION_CONFLICT',
        storageRevision: currentStorageRevision,
        baseRevision
      };
    }

    const nextRevision = Math.max(baseRevision, currentStorageRevision || 0) + 1;
    const toSave = {
      ...envelope,
      revision: nextRevision
    };

    let serialized;
    try {
      serialized = JSON.stringify(toSave);
      JSON.parse(serialized);
    } catch (error) {
      onStatus({ status: 'unsaved', message: 'Could not save. Your current session is still open.' });
      return { ok: false, code: 'STORAGE_SERIALIZE', error };
    }

    onStatus({ status: 'saving', message: 'Saving…' });
    try {
      storage.setItem(`${STORAGE_KEY}.tmp`, serialized);
      storage.setItem(STORAGE_KEY, serialized);
    } catch (error) {
      try {
        storage.removeItem(`${STORAGE_KEY}.tmp`);
      } catch {
        /* best effort cleanup */
      }
      onStatus({ status: 'unsaved', message: 'Could not save. Your current session is still open.' });
      return {
        ok: false,
        code: error?.name === 'QuotaExceededError' ? 'STORAGE_QUOTA' : 'STORAGE_FAILED',
        error
      };
    }

    let verifiedRaw = null;
    try {
      verifiedRaw = storage.getItem(STORAGE_KEY);
    } catch {
      /* verification failure is treated as an unconfirmed write */
    }
    const verifiedRevision = getStorageRevision();
    if (verifiedRaw !== serialized) {
      try {
        storage.removeItem(`${STORAGE_KEY}.tmp`);
      } catch {
        /* best effort cleanup */
      }
      onStatus({ status: 'unsaved', message: 'Another tab changed saved data during the write. Your current session is still open.' });
      return {
        ok: false,
        code: 'STORAGE_WRITE_RACE',
        storageRevision: verifiedRevision,
        expectedRevision: nextRevision
      };
    }

    baseRevision = nextRevision;

    try {
      storage.removeItem(`${STORAGE_KEY}.tmp`);
    } catch (warning) {
      onStatus({
        status: 'saved',
        message: 'Saved on this device. Temporary recovery data could not be cleared.'
      });
      return { ok: true, code: 'TEMP_CLEANUP_FAILED', revision: nextRevision, warning };
    }

    onStatus({ status: 'saved', message: 'Saved on this device.' });
    return { ok: true, revision: nextRevision };
  }

  return {
    load() {
      const result = loadEnvelope(storage, getAsset);
      if (result.baseRevision != null) {
        baseRevision = result.baseRevision;
      }
      return result;
    },
    getBaseRevision: () => baseRevision,
    setBaseRevision: (rev) => {
      if (Number.isInteger(rev) && rev >= 1) baseRevision = rev;
    },
    getStorageRevision,
    hasConflict,
    schedule(envelope) {
      pending = envelope;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const next = pending;
        pending = null;
        save(next);
      }, delay);
    },
    flush(options) {
      if (timer) clearTimeout(timer);
      timer = null;
      if (!pending) return { ok: true, code: 'NO_PENDING_WRITE' };
      const next = pending;
      pending = null;
      return save(next, options);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
    },
    save
  };
}

export const createStorageAdapter = createProjectRepository;
