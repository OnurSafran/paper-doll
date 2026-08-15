import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearProjectBackup,
  formatProjectExportFilename,
  getAvailableBackup,
  mergeProjectEnvelopes,
  saveProjectBackup,
  serializeProjectExport,
  validateImportPayload
} from '../js/services/project-portability.js';
import { createAppStore } from '../js/core/app-store.js';
import { getAsset } from '../js/core/asset-catalog.js';
import { createDefaultEnvelope, createRuntimeState, persistedProjection } from '../js/core/state-schema.js';
import { createStarterDraft } from '../js/domain/outfit-rules.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    data
  };
}

test('serializeProjectExport formats valid versioned JSON containing full domain state', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset });
  store.dispatch({ type: 'preset/save', name: 'Export Doll' });
  store.dispatch({ type: 'scene/new' });
  store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_table', x: 800, y: 700 });
  store.dispatch({ type: 'scene/saveToLibrary', name: 'Export Scene' });

  const jsonStr = serializeProjectExport(store.getState(), () => new Date('2026-08-14T12:00:00Z'));
  assert.ok(typeof jsonStr === 'string');

  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.schemaVersion, 2);
  assert.equal(parsed.presets.length, 1);
  assert.equal(parsed.presets[0].name, 'Export Doll');
  assert.equal(parsed.scenes.length, 1);
  assert.equal(parsed.scenes[0].title, 'Export Scene');
  assert.equal(parsed.currentScene.entities.length, 1);
  assert.equal(formatProjectExportFilename(() => new Date('2026-08-14T12:00:00Z')), 'paper-doll-project-2026-08-14.json');
});

test('validateImportPayload performs 5-stage validation and summarizes incoming payload', () => {
  // 1. Valid JSON payload
  const validEnvelope = {
    schemaVersion: 2,
    savedAt: new Date().toISOString(),
    settings: { reducedMotion: 'reduce', soundEnabled: true },
    presets: [{
      presetId: 'doll-import-1',
      name: 'Imported Doll',
      baseDollId: 'doll_classic_a',
      skinTone: 'peach',
      slots: { hair: null, top: { assetId: 'top_tshirt', color: 'coral' }, bottom: null, dress: null, shoes: null, accessory: null }
    }],
    scenes: [{
      sceneId: 'scene-import-1',
      title: 'Imported Tea Scene',
      backgroundId: 'bg_atelier',
      entities: [{ instanceId: 'ent-1', kind: 'prop', sourceId: 'prop_chair', x: 500, y: 600, scale: 1, order: 1 }]
    }],
    currentScene: {
      sceneId: 'current-import',
      title: 'Current Stage',
      backgroundId: 'bg_park',
      entities: [{ instanceId: 'ent-2', kind: 'prop', sourceId: 'prop_lamp', x: 400, y: 500, scale: 1, order: 1 }]
    }
  };

  const validRes = validateImportPayload(JSON.stringify(validEnvelope), getAsset);
  assert.equal(validRes.ok, true);
  assert.equal(validRes.summary.presetCount, 1);
  assert.equal(validRes.summary.sceneCount, 1);
  assert.equal(validRes.summary.hasCurrentScene, true);
  assert.equal(validRes.summary.currentSceneEntityCount, 1);
  assert.equal(validRes.envelope.settings.reducedMotion, 'reduce');

  // 2. Malformed JSON syntax
  const badSyntaxRes = validateImportPayload('{not json', getAsset);
  assert.equal(badSyntaxRes.ok, false);
  assert.match(badSyntaxRes.error, /Invalid JSON/);

  // 3. Non-object / array payload
  const arrayRes = validateImportPayload('[1, 2, 3]', getAsset);
  assert.equal(arrayRes.ok, false);
  assert.match(arrayRes.error, /valid Paper Doll project object/);

  // 4. Schema v1 migration
  const v1Payload = { ...validEnvelope, schemaVersion: 1 };
  const migratedRes = validateImportPayload(JSON.stringify(v1Payload), getAsset);
  assert.equal(migratedRes.ok, true);
  assert.equal(migratedRes.envelope.schemaVersion, 2);
  assert.ok(migratedRes.warnings.some((w) => w.includes('upgraded')));
});

test('mergeProjectEnvelopes rewrites colliding IDs and preserves entity references', () => {
  const current = createDefaultEnvelope();
  current.presets = [{
    presetId: 'same-doll-id',
    name: 'Existing Emma',
    baseDollId: 'doll_classic_a',
    skinTone: 'peach',
    slots: createStarterDraft().slots
  }];
  current.scenes = [{
    sceneId: 'same-scene-id',
    title: 'Existing Scene',
    backgroundId: 'bg_bedroom',
    entities: []
  }];

  const incoming = createDefaultEnvelope();
  incoming.presets = [{
    presetId: 'same-doll-id', // Colliding preset ID
    name: 'Incoming Emma',
    baseDollId: 'doll_classic_a',
    skinTone: 'warm',
    slots: createStarterDraft().slots
  }];
  incoming.scenes = [{
    sceneId: 'same-scene-id', // Colliding scene ID
    title: 'Incoming Scene',
    backgroundId: 'bg_atelier',
    entities: [{
      instanceId: 'char-instance-1',
      kind: 'character',
      sourceId: 'same-doll-id', // References the colliding preset ID
      characterSnapshot: createStarterDraft(),
      x: 800,
      y: 700,
      scale: 1,
      order: 1
    }]
  }];

  let idCounter = 100;
  const mergedResult = mergeProjectEnvelopes(current, incoming, {
    makeId: () => `generated-id-${++idCounter}`
  });

  const merged = mergedResult.envelope;
  assert.equal(merged.presets.length, 2);
  assert.equal(merged.presets[0].presetId, 'same-doll-id');
  assert.equal(merged.presets[1].presetId, 'generated-id-101');
  assert.equal(merged.presets[1].name, 'Incoming Emma');

  assert.equal(merged.scenes.length, 2);
  assert.equal(merged.scenes[0].sceneId, 'same-scene-id');
  assert.equal(merged.scenes[1].sceneId, 'generated-id-102');
  assert.equal(merged.scenes[1].title, 'Incoming Scene');

  // Verify that character entity in the incoming scene had its sourceId updated to match the rewritten preset ID!
  assert.equal(merged.scenes[1].entities[0].sourceId, 'generated-id-101');
  assert.equal(mergedResult.stats.rewrittenIdsCount, 1);
});

test('mergeProjectEnvelopes caps collections at domain limits and records warnings', () => {
  const current = createDefaultEnvelope();
  for (let i = 0; i < 48; i += 1) {
    current.presets.push({
      presetId: `existing-preset-${i}`,
      name: `Doll ${i}`,
      baseDollId: 'doll_classic_a',
      skinTone: 'peach',
      slots: createStarterDraft().slots
    });
  }

  const incoming = createDefaultEnvelope();
  for (let i = 0; i < 5; i += 1) {
    incoming.presets.push({
      presetId: `incoming-preset-${i}`,
      name: `New Doll ${i}`,
      baseDollId: 'doll_classic_a',
      skinTone: 'warm',
      slots: createStarterDraft().slots
    });
  }

  const result = mergeProjectEnvelopes(current, incoming);
  assert.equal(result.envelope.presets.length, 50); // Capped at MAX_PRESETS = 50
  assert.ok(result.warnings.some((w) => w.includes('Preset limit (50) reached')));
});

test('saveProjectBackup, getAvailableBackup, and clearProjectBackup manage storage snapshots safely', () => {
  const storage = memoryStorage();
  assert.equal(getAvailableBackup(storage, getAsset).available, false);

  const envelopeToBackUp = {
    ...createDefaultEnvelope(),
    presets: [{
      presetId: 'backup-doll',
      name: 'Safe Doll',
      baseDollId: 'doll_classic_a',
      skinTone: 'peach',
      slots: createStarterDraft().slots
    }]
  };

  // 1. Save backup
  const saveRes = saveProjectBackup(storage, envelopeToBackUp, () => new Date('2026-08-14T15:30:00Z'));
  assert.equal(saveRes.ok, true);

  // 2. Retrieve backup
  const backup = getAvailableBackup(storage, getAsset);
  assert.equal(backup.available, true);
  assert.equal(backup.envelope.presets.length, 1);
  assert.equal(backup.envelope.presets[0].name, 'Safe Doll');
  assert.equal(backup.backedUpAt, '2026-08-14T15:30:00.000Z');

  // 3. Clear backup
  clearProjectBackup(storage);
  assert.equal(getAvailableBackup(storage, getAsset).available, false);
});

test('AppStore handles project/importReplace, project/importMerge, and project/restoreBackup with undo support', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset });
  store.dispatch({ type: 'preset/save', name: 'Initial Doll' });
  assert.equal(store.getState().presets.length, 1);

  const incomingEnvelope = {
    schemaVersion: 2,
    revision: 2,
    savedAt: new Date().toISOString(),
    settings: { reducedMotion: 'system', soundEnabled: true },
    presets: [{
      presetId: 'replaced-doll',
      name: 'Imported Brand New Doll',
      baseDollId: 'doll_classic_a',
      skinTone: 'peach',
      slots: createStarterDraft().slots
    }],
    scenes: [],
    currentScene: null
  };

  // 1. Test Replace
  store.dispatch({ type: 'project/importReplace', envelope: incomingEnvelope });
  assert.equal(store.getState().presets.length, 1);
  assert.equal(store.getState().presets[0].name, 'Imported Brand New Doll');
  assert.equal(store.getState().settings.soundEnabled, true);
  assert.equal(store.canUndo(), true);

  // Undo replace -> restores Initial Doll
  store.dispatch({ type: 'app/undo' });
  assert.equal(store.getState().presets.length, 1);
  assert.equal(store.getState().presets[0].name, 'Initial Doll');

  // Redo replace -> restores Imported Brand New Doll
  store.dispatch({ type: 'app/redo' });
  assert.equal(store.getState().presets[0].name, 'Imported Brand New Doll');

  // 2. Test Merge
  const mergedEnvelope = {
    ...incomingEnvelope,
    presets: [
      ...incomingEnvelope.presets,
      {
        presetId: 'merged-second-doll',
        name: 'Second Merged Doll',
        baseDollId: 'doll_classic_a',
        skinTone: 'peach',
        slots: createStarterDraft().slots
      }
    ]
  };
  store.dispatch({ type: 'project/importMerge', envelope: mergedEnvelope });
  assert.equal(store.getState().presets.length, 2);

  // 3. Test Restore Backup
  const backupEnvelope = {
    ...incomingEnvelope,
    presets: [{
      presetId: 'original-backup-doll',
      name: 'Original Backup Doll',
      baseDollId: 'doll_classic_a',
      skinTone: 'peach',
      slots: createStarterDraft().slots
    }]
  };
  store.dispatch({ type: 'project/restoreBackup', envelope: backupEnvelope });
  assert.equal(store.getState().presets.length, 1);
  assert.equal(store.getState().presets[0].name, 'Original Backup Doll');
});

test('validateImportPayload rejects malicious payloads and invalid ID structures', () => {
  // Payload with malicious selector characters in instanceId and presetId
  const maliciousPayload = {
    schemaVersion: 2,
    presets: [{
      presetId: '"><script>alert(1)</script>',
      name: 'Hacked Doll',
      baseDollId: 'doll_classic_a',
      skinTone: 'peach',
      slots: {}
    }],
    scenes: [{
      sceneId: 'scene-malicious-1',
      title: 'Malicious Scene',
      backgroundId: 'bg_bedroom',
      entities: [{
        instanceId: 'ent-1"] { display: none }',
        kind: 'prop',
        sourceId: 'prop_chair',
        x: 500,
        y: 600,
        scale: 1,
        order: 1
      }]
    }]
  };

  const res = validateImportPayload(JSON.stringify(maliciousPayload), getAsset);
  assert.equal(res.ok, true);
  // Malicious preset with invalid ID should be skipped
  assert.equal(res.envelope.presets.length, 0);
  assert.ok(res.warnings.some((w) => w.includes('Dollbox preset was skipped')));
  // Scene with invalid entity instanceId should drop the invalid entity
  assert.equal(res.envelope.scenes[0].entities.length, 0);
  assert.ok(res.warnings.some((w) => w.includes('invalid scene item was skipped')));
});

test('validateImportPayload enforces maximum payload byte cap', () => {
  const giantPayload = '{"a":"' + 'x'.repeat(100) + '"}';
  const res = validateImportPayload(giantPayload, getAsset, { maxBytes: 50 });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'Project file exceeds the maximum allowed size (5MB).');

  const unicodePayload = '{"a":"' + 'é'.repeat(30) + '"}';
  const unicodeRes = validateImportPayload(unicodePayload, getAsset, { maxBytes: 50 });
  assert.equal(unicodeRes.ok, false);

  const objectRes = validateImportPayload({ a: 'x'.repeat(100) }, getAsset, { maxBytes: 50 });
  assert.equal(objectRes.ok, false);
});

test('saveProjectBackup handles storage failure and returns error result', () => {
  const throwingStorage = {
    setItem: () => { throw new Error('QuotaExceeded'); }
  };
  const res = saveProjectBackup(throwingStorage, { schemaVersion: 2, presets: [] });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'QuotaExceeded');

  const nullStorageRes = saveProjectBackup(null, { schemaVersion: 2, presets: [] });
  assert.equal(nullStorageRes.ok, false);
  assert.equal(nullStorageRes.error, 'Storage unavailable');
});

test('mergeProjectEnvelopes preserves local user settings and rewrites preset refs in incoming currentScene fallback', () => {
  const current = {
    ...createDefaultEnvelope(),
    settings: { reducedMotion: 'reduce', soundEnabled: false },
    currentScene: null
  };
  const incoming = {
    ...createDefaultEnvelope(),
    settings: { reducedMotion: 'no-preference', soundEnabled: true },
    presets: [{
      presetId: 'incoming-char-1',
      name: 'Imported Emma',
      baseDollId: 'doll_classic_a',
      skinTone: 'peach',
      slots: {}
    }],
    currentScene: {
      sceneId: 'incoming-stage',
      title: 'Incoming Stage',
      backgroundId: 'bg_park',
      entities: [{
        instanceId: 'char-on-stage',
        kind: 'character',
        sourceId: 'incoming-char-1',
        x: 600,
        y: 600,
        scale: 1,
        order: 1
      }]
    }
  };

  const res = mergeProjectEnvelopes(current, incoming, {
    makeId: () => 'rewritten-char-id'
  });

  // Local settings must be preserved
  assert.equal(res.envelope.settings.reducedMotion, 'reduce');
  assert.equal(res.envelope.settings.soundEnabled, false);
  // Character in fallback currentScene must have sourceId remapped if preset ID was remapped or preserved
  assert.ok(res.envelope.currentScene);
  assert.equal(res.envelope.currentScene.entities[0].sourceId, res.envelope.presets[0].presetId);
});

test('mergeProjectEnvelopes omits collisions when the ID generator cannot produce a safe ID', () => {
  const current = createDefaultEnvelope();
  current.presets = [{
    presetId: 'same-doll-id',
    name: 'Existing Doll',
    baseDollId: 'doll_classic_a',
    skinTone: 'peach',
    slots: createStarterDraft().slots
  }];
  const incoming = {
    ...createDefaultEnvelope(),
    presets: [{
      presetId: 'same-doll-id',
      name: 'Incoming Doll',
      baseDollId: 'doll_classic_a',
      skinTone: 'peach',
      slots: createStarterDraft().slots
    }]
  };

  const result = mergeProjectEnvelopes(current, incoming, { makeId: () => 'unsafe.id' });
  assert.equal(result.envelope.presets.length, 1);
  assert.ok(result.warnings.some((warning) => warning.includes('safe unique ID')));
});

test('saveProjectBackup prunes older historical backup keys', () => {
  const storage = memoryStorage({
    'paperDollStudio.backup.1000': '{"old": 1}',
    'paperDollStudio.backup.2000': '{"old": 2}',
    'other.key': 'preserved'
  });

  const res = saveProjectBackup(storage, { schemaVersion: 2, presets: [] });
  assert.equal(res.ok, true);
  assert.ok(storage.data.has('paperDollStudio.backup.latest'));
  assert.ok(storage.data.has('other.key'));
  assert.equal(storage.data.has('paperDollStudio.backup.1000'), false, 'Older backup 1000 pruned');
  assert.equal(storage.data.has('paperDollStudio.backup.2000'), false, 'Older backup 2000 pruned');
});
