#!/usr/bin/env node

import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PACK_MANIFESTS, PACK_REGISTRY, validatePackManifest } from '../js/packs/index.js';

const root = resolve(import.meta.dirname, '..');
const failures = [];
const serviceWorkerSource = await readFile(resolve(root, 'sw.js'), 'utf8').catch(() => '');

for (const manifest of PACK_MANIFESTS) {
  const result = validatePackManifest(manifest, { knownPackIds: PACK_MANIFESTS.map((item) => item.id) });
  for (const error of result.errors) failures.push(manifest.id + ': ' + error);

  const resourceFiles = PACK_REGISTRY.getResourceFiles([manifest.id]);
  let totalBytes = 0;
  for (const file of resourceFiles) {
    const path = resolve(root, file);
    try {
      const info = await stat(path);
      totalBytes += info.size;
    } catch {
      failures.push(manifest.id + ': missing resource ' + file);
      continue;
    }
    if (!serviceWorkerSource.includes("'./" + file + "'")) {
      failures.push(manifest.id + ': resource is missing from the offline app shell: ' + file);
    }
  }
  if (manifest.totalBytes !== undefined && manifest.totalBytes !== totalBytes) {
    failures.push(manifest.id + ': totalBytes is ' + manifest.totalBytes + '; found ' + totalBytes);
  }
}

if (failures.length) {
  console.error('Pack validation failed (' + failures.length + ' issue' + (failures.length === 1 ? '' : 's') + '):');
  for (const failure of failures) console.error('- ' + failure);
  process.exitCode = 1;
} else {
  console.log('Pack validation passed: ' + PACK_MANIFESTS.length + ' manifest' +
    (PACK_MANIFESTS.length === 1 ? '' : 's') + ' and ' + PACK_REGISTRY.getResourceFiles().length + ' bundled resources.');
}
