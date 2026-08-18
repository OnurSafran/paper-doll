#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const failures = [];
const cssFiles = new Map();

function fingerprint(source) {
  const normalized = source.replace(/\?v=[^'"\s)]+/g, '?v=');
  return createHash('sha256').update(normalized).digest('hex').slice(0, 8);
}

function cacheVersion(ref) {
  return ref.match(/[?&]v=([^&#]+)/)?.[1] || null;
}

function cleanRef(ref) {
  return ref.split('?')[0].split('#')[0];
}

function resolveRef(owner, ref) {
  const path = cleanRef(ref).replace(/^\.\//, '');
  return resolve(dirname(owner), path);
}

function displayPath(path) {
  return relative(root, path) || '.';
}

async function checkCssReference(owner, ref, kind) {
  const target = resolveRef(owner, ref);
  const version = cacheVersion(ref);
  if (!version) {
    failures.push(`${displayPath(owner)}: ${kind} ${ref} is missing a content version`);
    return null;
  }

  let source;
  try {
    source = await readFile(target, 'utf8');
  } catch {
    failures.push(`${displayPath(owner)}: ${kind} target is missing: ${ref}`);
    return null;
  }

  const expected = fingerprint(source);
  if (version !== expected) {
    failures.push(`${displayPath(owner)}: ${ref} has version ${version}; expected ${expected}`);
  }
  cssFiles.set(target, source);
  return target;
}

async function inspectCssFile(path, source) {
  const imports = [...source.matchAll(/@import\s+['"]([^'"]+\.css(?:\?v=[^'"]+)?)['"]/g)].map((match) => match[1]);
  for (const ref of imports) {
    const target = await checkCssReference(path, ref, 'CSS import');
    if (target && !cssFiles.has(`${target}:checked`)) {
      cssFiles.set(`${target}:checked`, true);
      await inspectCssFile(target, cssFiles.get(target));
    }
  }
}

const indexPath = resolve(root, 'index.html');
const indexSource = await readFile(indexPath, 'utf8');
const indexStylesheets = [...indexSource.matchAll(/<link\b[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+\.css(?:\?v=[^"']+)?)['"]/gi)].map((match) => match[1]);
for (const ref of indexStylesheets) {
  const target = await checkCssReference(indexPath, ref, 'stylesheet');
  if (target && !cssFiles.has(`${target}:checked`)) {
    cssFiles.set(`${target}:checked`, true);
    await inspectCssFile(target, cssFiles.get(target));
  }
}

const swPath = resolve(root, 'sw.js');
const swSource = await readFile(swPath, 'utf8');
const shellEntries = [...swSource.matchAll(/['"](\.\/[^'"]+)['"]/g)].map((match) => match[1]);
const shellCssEntries = shellEntries.filter((entry) => cleanRef(entry).endsWith('.css'));
const shellCssTargets = new Set();
for (const ref of shellCssEntries) {
  const target = await checkCssReference(swPath, ref, 'service-worker CSS entry');
  if (target) shellCssTargets.add(target);
}
for (const target of cssFiles.keys()) {
  if (typeof target === 'string' && !target.endsWith(':checked') && !shellCssTargets.has(target)) {
    failures.push(`sw.js: CSS file is not in APP_SHELL: ${displayPath(target)}`);
  }
}

const cacheName = swSource.match(/const CACHE_NAME\s*=\s*['"]([^'"]+)['"]/)?.[1];
if (!cacheName) {
  failures.push('sw.js: CACHE_NAME is missing');
} else {
  const shellHash = createHash('sha256');
  for (const entry of shellEntries.map(cleanRef).filter((entry) => entry !== '.').sort()) {
    const path = resolve(root, entry);
    try {
      const bytes = await readFile(path);
      shellHash.update(entry);
      shellHash.update('\0');
      shellHash.update(bytes);
    } catch {
      failures.push(`sw.js: APP_SHELL entry is missing: ${entry}`);
    }
  }
  const expectedCacheName = `paper-doll-studio-v${shellHash.digest('hex').slice(0, 8)}`;
  if (cacheName !== expectedCacheName) {
    failures.push(`sw.js: CACHE_NAME is ${cacheName}; expected ${expectedCacheName} for the current app shell`);
  }
}

if (failures.length) {
  console.error(`Cache-busting validation failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Cache-busting validation passed: ${cssFiles.size / 2} CSS files and the app-shell fingerprint are current.`);
}
