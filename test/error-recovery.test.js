import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { classifyError, executeSafeTeardown } from '../js/core/error-boundary.js';
import { createStorageAdapter } from '../js/core/storage-adapter.js';
import { createDefaultEnvelope, STORAGE_KEY } from '../js/core/state-schema.js';

const root = resolve(import.meta.dirname, '..');
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const js = await readFile(resolve(root, 'js/app.js'), 'utf8');

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); }
  };
}

test('classifyError returns privacy-safe diagnostic codes without player text', () => {
  const quotaErr = Object.assign(new Error('User "Alice" quota exceeded on doll save'), { name: 'QuotaExceededError' });
  assert.equal(classifyError(quotaErr), 'ERR_STORAGE_QUOTA');

  const mediaErr = Object.assign(new Error('Permission denied for microphone device'), { name: 'NotAllowedError' });
  assert.equal(classifyError(mediaErr), 'ERR_MEDIA_PERMISSION');

  const typeErr = new TypeError('Cannot read properties of undefined (reading "presetName")');
  assert.equal(classifyError(typeErr), 'ERR_RUNTIME_TYPE');

  const refErr = new ReferenceError('someDraftVar is not defined');
  assert.equal(classifyError(refErr), 'ERR_RUNTIME_REFERENCE');

  const syntaxErr = new SyntaxError('Unexpected token < in JSON at position 0');
  assert.equal(classifyError(syntaxErr), 'ERR_SYNTAX');

  const netErr = new Error('Failed to fetch resource from offline cache');
  assert.equal(classifyError(netErr), 'ERR_NETWORK');

  const secErr = Object.assign(new Error('Cross-origin frame blocked'), { name: 'SecurityError' });
  assert.equal(classifyError(secErr), 'ERR_SECURITY');

  const unknownErr = new Error('Random mystery failure');
  assert.equal(classifyError(unknownErr), 'ERR_RUNTIME');

  const nullErr = classifyError(null);
  assert.equal(nullErr, 'ERR_RUNTIME_UNKNOWN');

  // Verify none of the classified outputs contain arbitrary user messages
  for (const err of [quotaErr, mediaErr, typeErr, refErr, syntaxErr, netErr, secErr, unknownErr]) {
    const code = classifyError(err);
    assert.match(code, /^ERR_[A-Z_]+$/);
    assert.doesNotMatch(code, /Alice|presetName|someDraftVar|random/i);
  }
});

test('executeSafeTeardown runs all callbacks safely and collects warnings if any fail', () => {
  let pointerCancelled = false;
  let audioStopped = false;
  let exportCancelled = false;
  let storageCancelled = false;

  const result = executeSafeTeardown({
    cancelPointer: () => { pointerCancelled = true; },
    stopAudio: () => { throw new Error('Audio hardware busy'); },
    cancelExport: () => { exportCancelled = true; },
    cancelStorage: () => { storageCancelled = true; }
  });

  assert.equal(pointerCancelled, true);
  assert.equal(exportCancelled, true);
  assert.equal(storageCancelled, true);
  assert.equal(result.ok, true);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /Audio teardown failed/);
});

test('top-level error teardown cancels pending storage write to preserve disk bytes', () => {
  const initialData = JSON.stringify({ ...createDefaultEnvelope(), revision: 1, savedAt: 'safe-initial-bytes' });
  const storage = memoryStorage({ [STORAGE_KEY]: initialData });
  const adapter = createStorageAdapter({ storage, delay: 5000, initialRevision: 1 });

  // Schedule a save with corrupted/in-progress state
  adapter.schedule({ ...createDefaultEnvelope(), savedAt: 'corrupted-in-memory-state' });

  // Runtime error occurs -> execute teardown with cancelStorage
  executeSafeTeardown({
    cancelStorage: () => adapter.cancel()
  });

  // Verify pending write was aborted and storage remains intact
  const disk = JSON.parse(storage.data.get(STORAGE_KEY));
  assert.equal(disk.savedAt, 'safe-initial-bytes');
  assert.equal(disk.revision, 1);
});

test('index.html and app.js expose accessible error boundary dialog and event listeners', () => {
  assert.match(html, /<dialog id="error-boundary-dialog"[^>]*role="alertdialog"/);
  assert.match(html, /id="error-boundary-title"/);
  assert.match(html, /id="error-boundary-message"/);
  assert.match(html, /id="error-boundary-code"/);
  assert.match(html, /id="dismiss-error-btn"/);
  assert.match(html, /id="reload-error-btn"/);

  assert.match(js, /window\.addEventListener\('error'/);
  assert.match(js, /window\.addEventListener\('unhandledrejection'/);
  assert.match(js, /function handleTopLevelError\(/);
});
