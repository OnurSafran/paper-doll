#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';

const root = resolve(import.meta.dirname, '..');

function fingerprint(source) {
  const normalized = source.replace(/\?v=[^'"\s)]+/g, '?v=');
  return createHash('sha256').update(normalized).digest('hex').slice(0, 8);
}

function cleanRef(ref) {
  return ref.split('?')[0].split('#')[0];
}

async function collectFiles(dir, ext) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const child = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...await collectFiles(child, ext));
    } else if (entry.name.endsWith(ext)) {
      found.push(child);
    }
  }
  return found;
}

// 1. Compute CSS fingerprints
const cssFiles = await collectFiles(resolve(root, 'css'), '.css');
const cssVersions = new Map();

for (const path of cssFiles) {
  const content = await readFile(path, 'utf8');
  // Normalize newly added, unversioned imports before hashing any parent.
  const versioned = content.replace(/@import\s+['"]([^'"]+\.css)(?:\?v=[^'"]+)?['"]/g, "@import '$1?v='");
  const hash = fingerprint(versioned);
  cssVersions.set(path, hash);
}

// Update imports inside CSS files if needed
for (const path of cssFiles) {
  let content = await readFile(path, 'utf8');
  let changed = false;
  content = content.replace(/@import\s+['"]([^'"]+\.css)(?:\?v=[^'"]+)?['"]/g, (match, url) => {
    const targetPath = resolve(dirname(path), url);
    const version = cssVersions.get(targetPath);
    if (version) {
      changed = true;
      return `@import '${url}?v=${version}'`;
    }
    return match;
  });
  if (changed) {
    await writeFile(path, content, 'utf8');
    // Recompute fingerprint after import update
    cssVersions.set(path, fingerprint(content));
  }
}

// 2. Update index.html stylesheet links
const indexPath = resolve(root, 'index.html');
let indexHtml = await readFile(indexPath, 'utf8');
indexHtml = indexHtml.replace(/(<link\b[^>]+href=["'])([^"']+\.css)(?:\?v=[^"']+)?(["'][^>]*>)/gi, (match, prefix, href, suffix) => {
  const cleanHref = href.replace(/^\.\//, '');
  const targetPath = resolve(root, cleanHref);
  const version = cssVersions.get(targetPath);
  if (version) {
    return `${prefix}${href}?v=${version}${suffix}`;
  }
  return match;
});
await writeFile(indexPath, indexHtml, 'utf8');

const scriptRefs = [...indexHtml.matchAll(/<script\b[^>]+src=["']([^"']+)["']/gi)].map((match) => match[1]);

// 3. Scan all JS modules
const jsFiles = await collectFiles(resolve(root, 'js'), '.js');
const jsEntries = jsFiles
  .map((p) => `./${relative(root, p)}`)
  .sort((a, b) => {
    if (a.includes('js/app.js')) return -1;
    if (b.includes('js/app.js')) return 1;
    return a.localeCompare(b);
  })
  .map((entry) => {
    return scriptRefs.find((ref) => cleanRef(ref) === entry) || entry;
  });

// 4. Read sw.js and parse current shell entries
const swPath = resolve(root, 'sw.js');
const swSource = await readFile(swPath, 'utf8');
const shellMatch = swSource.match(/const APP_SHELL = \[([\s\S]*?)\];/);
if (!shellMatch) {
  throw new Error('Could not find APP_SHELL in sw.js');
}

const existingEntries = [...shellMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
const baseEntries = existingEntries.filter((entry) => {
  const clean = cleanRef(entry);
  return clean === './' || clean === './index.html' || clean === './manifest.webmanifest';
});

const assetEntries = existingEntries.filter((entry) => {
  const clean = cleanRef(entry);
  return clean.startsWith('./assets/');
});
const assetsRoot = resolve(root, 'assets');
let discoveredAssetEntries = [];
try {
  discoveredAssetEntries = (await collectFiles(assetsRoot, '.svg'))
    .map((path) => './' + relative(root, path))
    .sort();
} catch {
  // Asset-free fixture projects may still use this manifest updater.
}

const updatedCssEntries = cssFiles
  .map((path) => `./${relative(root, path)}?v=${cssVersions.get(path)}`)
  .sort();

// Combine into new APP_SHELL
const newShell = [
  ...new Set([
    ...baseEntries,
    ...updatedCssEntries,
    ...jsEntries,
    ...assetEntries,
    ...discoveredAssetEntries
  ])
];

// 5. Rewrite APP_SHELL in sw.js
const formattedShell = newShell.map((e) => `  '${e}',`).join('\n');
let newSwSource = swSource.replace(
  /const APP_SHELL = \[[\s\S]*?\];/,
  `const APP_SHELL = [\n${formattedShell}\n];`
);

// 6. Compute new CACHE_NAME exactly as validate-cache-busting.mjs does
const shellEntries = [...newSwSource.matchAll(/['"](\.\/[^'"]+)['"]/g)].map((match) => match[1]);
const shellHash = createHash('sha256');
for (const entry of shellEntries.map(cleanRef).filter((entry) => entry !== '.').sort()) {
  const path = resolve(root, entry);
  const bytes = await readFile(path);
  shellHash.update(entry);
  shellHash.update('\0');
  shellHash.update(bytes);
}
const newCacheName = `paper-doll-studio-v${shellHash.digest('hex').slice(0, 8)}`;

newSwSource = newSwSource.replace(
  /const CACHE_NAME = 'paper-doll-studio-v[a-f0-9]+';/,
  `const CACHE_NAME = '${newCacheName}';`
);

await writeFile(swPath, newSwSource, 'utf8');
console.log(`Updated sw.js: CACHE_NAME = ${newCacheName}, APP_SHELL contains ${newShell.length} entries.`);
