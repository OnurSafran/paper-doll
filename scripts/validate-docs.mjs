#!/usr/bin/env node

import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const failures = [];

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(path));
    if (entry.isFile() && extname(entry.name) === '.md') files.push(path);
  }

  return files;
}

function lineNumber(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

const requiredDocuments = [
  'README.md',
  'docs/PROJECT.md',
  'docs/ARCHITECTURE.md',
  'docs/ASSETS.md',
  'docs/ROADMAP.md',
  'docs/QUALITY.md',
  'docs/DECISIONS.md',
  'docs/OFFLINE-PWA.md'
];

for (const relPath of requiredDocuments) {
  try {
    await stat(resolve(root, relPath));
  } catch {
    failures.push(`Missing canonical documentation file: ${relPath}`);
  }
}

const mdFiles = await markdownFiles(root);

for (const file of mdFiles) {
  const text = await readFile(file, 'utf8');

  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].trim().replace(/^<|>$/g, '');
    const line = lineNumber(text, match.index);

    if (/^file:/i.test(target)) {
      failures.push(`${file}:${line}: absolute file URL is not portable: ${target}`);
      continue;
    }

    if (/^(?:https?:|mailto:|#)/i.test(target)) continue;

    const withoutFragment = target.split('#', 1)[0];
    if (!withoutFragment) continue;

    try {
      await stat(resolve(dirname(file), decodeURIComponent(withoutFragment)));
    } catch {
      failures.push(`${file}:${line}: missing relative link target: ${target}`);
    }
  }
}

if (failures.length) {
  console.error(`Documentation validation failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Documentation validation passed: ${mdFiles.length} markdown documents and all links valid.`);
}
