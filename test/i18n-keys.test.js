import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.clear !== 'function') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
}

const { TRANSLATIONS } = await import('../js/core/i18n.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function resolve(dict, keyPath) {
  return keyPath.split('.').reduce((obj, key) => (obj && typeof obj === 'object' ? obj[key] : undefined), dict);
}

function listJsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'locales' ? [] : listJsFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

// A missing key makes t() return '' and updateDomTranslations then blanks the
// element's text or accessible name, so every static key must exist in both locales.
test('Every data-i18n key in index.html resolves to a string in every locale', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const keys = new Set([...html.matchAll(/data-i18n(?:-[\w-]+)?="([\w.]+)"/g)].map((m) => m[1]));
  assert.ok(keys.size > 0);
  for (const [lang, dict] of Object.entries(TRANSLATIONS)) {
    const missing = [...keys].filter((key) => typeof resolve(dict, key) !== 'string');
    assert.deepEqual(missing, [], `index.html keys missing from ${lang}`);
  }
});

test('Every literal t() key in js/ resolves to a string in every locale', () => {
  const usages = [];
  for (const file of listJsFiles(path.join(root, 'js'))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const m of source.matchAll(/\bt\(\s*(['"])([\w.]+)\1\s*[,)]/g)) usages.push({ key: m[2], file: path.relative(root, file) });
  }
  assert.ok(usages.length > 0);
  for (const [lang, dict] of Object.entries(TRANSLATIONS)) {
    const missing = usages.filter(({ key }) => typeof resolve(dict, key) !== 'string').map(({ key, file }) => `${key} (${file})`);
    assert.deepEqual(missing, [], `t() keys missing from ${lang}`);
  }
});
