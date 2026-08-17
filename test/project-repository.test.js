import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectRepository, loadProject, STORAGE_KEY } from '../js/services/project-repository.js';
import { createDefaultEnvelope } from '../js/core/state-schema.js';
import { getAsset } from '../js/core/asset-catalog.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    data
  };
}

test('project repository load handles null and unavailable storage', () => {
  const nullResult = loadProject(null, getAsset);
  assert.equal(nullResult.available, false);
  assert.equal(nullResult.recovered, false);
  assert.equal(nullResult.envelope.schemaVersion, 4);

  const throwingStorage = {
    getItem: () => { throw new Error('SecurityError: access denied'); }
  };
  const deniedResult = loadProject(throwingStorage, getAsset);
  assert.equal(deniedResult.available, false);
  assert.equal(deniedResult.recovered, false);
  assert.match(deniedResult.warnings[0], /could not be read/);
});

test('project repository load cleans up leftover .tmp writes and quarantines corrupted bytes', () => {
  const corruptedRaw = '{"broken": json...';
  const storage = memoryStorage({
    [STORAGE_KEY]: corruptedRaw,
    [`${STORAGE_KEY}.tmp`]: '{"stale": true}'
  });

  const result = loadProject(storage, getAsset);
  assert.equal(result.available, false);
  assert.equal(result.recovered, false);
  assert.equal(storage.data.has(`${STORAGE_KEY}.tmp`), false);

  const quarantineKeys = [...storage.data.keys()].filter((k) => k.startsWith('paperDollStudio.quarantine.'));
  assert.equal(quarantineKeys.length, 1);
  assert.equal(storage.data.get(quarantineKeys[0]), corruptedRaw);
});

test('project repository treats a valid v3 to v4 migration as recovered', () => {
  const legacy = { ...createDefaultEnvelope(), schemaVersion: 3 };
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(legacy) });

  const result = loadProject(storage, getAsset);
  assert.equal(result.available, true);
  assert.equal(result.recovered, true);
  assert.equal(result.envelope.schemaVersion, 4);
  assert.equal([...storage.data.keys()].some((key) => key.startsWith('paperDollStudio.quarantine.')), false);
});

test('project repository tracks monotonic revisions and detects cross-tab conflicts', () => {
  const storage = memoryStorage({
    [STORAGE_KEY]: JSON.stringify({ ...createDefaultEnvelope(), revision: 5 })
  });

  const statusLogs = [];
  const repo = createProjectRepository({
    storage,
    initialRevision: 5,
    onStatus: (status) => statusLogs.push(status)
  });

  assert.equal(repo.getBaseRevision(), 5);
  assert.equal(repo.getStorageRevision(), 5);
  assert.equal(repo.hasConflict(), false);

  // Tab A makes a normal save -> revision advances to 6
  const save1 = repo.save(createDefaultEnvelope());
  assert.equal(save1.ok, true);
  assert.equal(save1.revision, 6);
  assert.equal(repo.getBaseRevision(), 6);
  assert.equal(repo.hasConflict(), false);

  // Simulate Tab B writing revision 8 to disk
  storage.data.set(STORAGE_KEY, JSON.stringify({ ...createDefaultEnvelope(), revision: 8 }));
  assert.equal(repo.getStorageRevision(), 8);
  assert.equal(repo.hasConflict(), true);

  // Tab A attempts to save without force -> blocked with REVISION_CONFLICT
  const blockedSave = repo.save(createDefaultEnvelope());
  assert.equal(blockedSave.ok, false);
  assert.equal(blockedSave.code, 'REVISION_CONFLICT');
  assert.equal(blockedSave.storageRevision, 8);
  assert.equal(blockedSave.baseRevision, 6);
  assert.equal(statusLogs.at(-1)?.status, 'unsaved');

  // Tab A forces save -> succeeds and advances to max(6, 8) + 1 = 9
  const forcedSave = repo.save(createDefaultEnvelope(), { force: true });
  assert.equal(forcedSave.ok, true);
  assert.equal(forcedSave.revision, 9);
  assert.equal(repo.getBaseRevision(), 9);
  assert.equal(repo.hasConflict(), false);
});

test('project repository detects another tab overwriting data during a write', () => {
  const storage = memoryStorage();
  const originalSetItem = storage.setItem;
  let injected = false;
  storage.setItem = (key, value) => {
    originalSetItem(key, value);
    if (key === STORAGE_KEY && !injected) {
      injected = true;
      originalSetItem(STORAGE_KEY, JSON.stringify({ ...createDefaultEnvelope(), revision: 2, settings: { soundEnabled: true } }));
    }
  };

  const repo = createProjectRepository({ storage, initialRevision: 1 });
  const result = repo.save(createDefaultEnvelope());
  assert.equal(result.ok, false);
  assert.equal(result.code, 'STORAGE_WRITE_RACE');
  assert.equal(result.storageRevision, 2);
  assert.equal(repo.getBaseRevision(), 1);
  assert.equal(storage.data.has(`${STORAGE_KEY}.tmp`), false);
});

test('project repository handles debounced scheduling, flushing, and cancellation', async () => {
  const storage = memoryStorage();
  const repo = createProjectRepository({ storage, delay: 50, initialRevision: 1 });

  // Schedule an update
  repo.schedule({ ...createDefaultEnvelope(), settings: { soundEnabled: true } });
  assert.equal(storage.data.has(STORAGE_KEY), false);

  // Flush immediately
  const flushResult = repo.flush();
  assert.equal(flushResult.ok, true);
  assert.equal(storage.data.has(STORAGE_KEY), true);
  const diskEnvelope = JSON.parse(storage.data.get(STORAGE_KEY));
  assert.equal(diskEnvelope.settings.soundEnabled, true);

  // Schedule and cancel
  repo.schedule({ ...createDefaultEnvelope(), settings: { soundEnabled: false } });
  repo.cancel();
  await new Promise((resolve) => setTimeout(resolve, 80));

  // Disk still has true, canceled save never wrote
  const diskAfterCancel = JSON.parse(storage.data.get(STORAGE_KEY));
  assert.equal(diskAfterCancel.settings.soundEnabled, true);
});

test('project repository maps quota exceeded errors correctly and cleans up temporary keys', () => {
  const storage = {
    getItem: () => null,
    setItem: (key) => {
      if (key === STORAGE_KEY) {
        const err = new Error('Quota exceeded');
        err.name = 'QuotaExceededError';
        throw err;
      }
    },
    removeItem: () => {}
  };

  const statusLogs = [];
  const repo = createProjectRepository({
    storage,
    onStatus: (status) => statusLogs.push(status)
  });

  const res = repo.save(createDefaultEnvelope());
  assert.equal(res.ok, false);
  assert.equal(res.code, 'STORAGE_QUOTA');
  assert.equal(statusLogs.at(-1)?.status, 'unsaved');
});

test('project repository load quarantines parseable but unsupported/corrupted schema payloads and returns recovered: false', () => {
  const unsupportedRaw = JSON.stringify({ schemaVersion: 999, presets: [] });
  const storage = memoryStorage({
    [STORAGE_KEY]: unsupportedRaw
  });

  const result = loadProject(storage, getAsset);
  assert.equal(result.available, true);
  assert.equal(result.recovered, false);
  assert.ok(result.warnings.some((w) => w.includes('Unsupported schema version')));

  const quarantineKeys = [...storage.data.keys()].filter((k) => k.startsWith('paperDollStudio.quarantine.'));
  assert.equal(quarantineKeys.length, 1);
  assert.equal(storage.data.get(quarantineKeys[0]), unsupportedRaw);
});
