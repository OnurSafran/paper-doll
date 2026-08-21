#!/usr/bin/env node

import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ASSETS } from '../js/core/asset-catalog.js';
import { isColorValue } from '../js/core/palette.js';

const root = resolve(import.meta.dirname, '..');
const failures = [];
const catalogIds = new Set();
let serviceWorkerSource = '';
const prohibitedElements = /<(?:script|style|foreignObject|iframe|object|embed|audio|video|image|linearGradient|radialGradient|filter|animate|animateMotion|animateTransform|set)\b/i;
const eventAttributes = /\son[a-z]+\s*=/i;
const externalReferences = /(?:href|xlink:href)\s*=\s*["'](?!#)[^"']+["']|\burl\((?!\s*["']?#)|@import|\bdata:/i;
const unsupportedXml = /<!DOCTYPE|<!ENTITY|\sxmlns:[a-z][\w.-]*\s*=/i;

try {
  serviceWorkerSource = await readFile(resolve(root, 'sw.js'), 'utf8');
} catch {
  failures.push('sw.js: service worker is missing or unreadable');
}

for (const asset of ASSETS) {
  if (catalogIds.has(asset.id)) failures.push(`catalog: duplicate asset id ${asset.id}`);
  catalogIds.add(asset.id);
  if (asset.kind === 'wearable' && !isColorValue(asset.defaultColors?.primary)) {
    failures.push(`${asset.id}: invalid default color ${String(asset.defaultColors?.primary)}`);
  }
  if (asset.kind === 'background' && ![1600, 3200, 4800].includes(asset.backgroundWidth)) {
    failures.push(`${asset.id}: backgroundWidth must be one of 1600, 3200, or 4800`);
  }
  if (!asset.path.startsWith('assets/') || asset.path.includes('..')) {
    failures.push(`${asset.id}: unsafe catalog path ${asset.path}`);
    continue;
  }
  if (serviceWorkerSource && !serviceWorkerSource.includes(`'./${asset.path}'`)) {
    failures.push(`${asset.id}: catalog path is missing from the offline app shell`);
  }

  const path = resolve(root, asset.path);
  let source;
  try {
    const info = await stat(path);
    source = await readFile(path, 'utf8');
    const maxBytes = asset.kind === 'background' ? 400_000 : asset.kind === 'prop' ? 200_000 : 150_000;
    if (info.size > maxBytes) failures.push(`${asset.path}: ${info.size} bytes exceeds ${maxBytes}`);
  } catch {
    failures.push(`${asset.path}: file is missing or unreadable`);
    continue;
  }

  if (!/^\s*<svg\b/i.test(source) || !/<\/svg>\s*$/i.test(source)) failures.push(`${asset.path}: SVG root is malformed`);
  if (!new RegExp(`data-asset-id=["']${escapeRegex(asset.id)}["']`).test(source)) failures.push(`${asset.path}: root asset ID does not match ${asset.id}`);
  const expectedViewBox = asset.viewBox.join(' ');
  const viewBox = source.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1]?.trim().replace(/\s+/g, ' ');
  if (viewBox !== expectedViewBox) failures.push(`${asset.path}: expected viewBox "${expectedViewBox}", found "${viewBox ?? 'missing'}"`);

  for (const group of asset.requiredGroups ?? []) {
    if (!new RegExp(`\\bid=["']${escapeRegex(group)}["']`).test(source)) failures.push(`${asset.path}: missing required #${group}`);
  }
  if (asset.kind === 'doll') {
    if (asset.poseSupport && !['rigid', 'basic', 'full'].includes(asset.poseSupport)) {
      failures.push(`${asset.id}: invalid poseSupport "${asset.poseSupport}"`);
    }
    if (asset.poseSupport === 'basic' || asset.poseSupport === 'full') {
      if (!asset.headPivot || !Number.isFinite(asset.headPivot.x) || !Number.isFinite(asset.headPivot.y)) {
        failures.push(`${asset.id}: rigged doll must declare a numeric headPivot { x, y }`);
      }
    }
    if (asset.poseSupport === 'full') {
      if (!asset.shoulderLeftPivot || !Number.isFinite(asset.shoulderLeftPivot.x) || !Number.isFinite(asset.shoulderLeftPivot.y)) {
        failures.push(`${asset.id}: full poseSupport doll must declare a numeric shoulderLeftPivot { x, y }`);
      }
      if (!asset.shoulderRightPivot || !Number.isFinite(asset.shoulderRightPivot.x) || !Number.isFinite(asset.shoulderRightPivot.y)) {
        failures.push(`${asset.id}: full poseSupport doll must declare a numeric shoulderRightPivot { x, y }`);
      }
      if (!asset.hipLeftPivot || !Number.isFinite(asset.hipLeftPivot.x) || !Number.isFinite(asset.hipLeftPivot.y)) {
        failures.push(`${asset.id}: full poseSupport doll must declare a numeric hipLeftPivot { x, y }`);
      }
      if (!asset.hipRightPivot || !Number.isFinite(asset.hipRightPivot.x) || !Number.isFinite(asset.hipRightPivot.y)) {
        failures.push(`${asset.id}: full poseSupport doll must declare a numeric hipRightPivot { x, y }`);
      }
    }
  }
  if (prohibitedElements.test(source)) failures.push(`${asset.path}: contains a prohibited element`);
  if (eventAttributes.test(source)) failures.push(`${asset.path}: contains an event-handler attribute`);
  if (externalReferences.test(source)) failures.push(`${asset.path}: contains an external or embedded reference`);
  if (unsupportedXml.test(source)) failures.push(`${asset.path}: contains unsupported XML or namespaces`);

  const shapeCount = [...source.matchAll(/<(?:path|rect|circle|ellipse|line|polyline|polygon)\b/gi)].length;
  const maxShapes = asset.kind === 'background' ? 800 : asset.kind === 'prop' ? 350 : 250;
  if (shapeCount > maxShapes) failures.push(`${asset.path}: ${shapeCount} shapes exceeds ${maxShapes}`);

  const ids = [...source.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) failures.push(`${asset.path}: duplicate IDs ${[...new Set(duplicates)].join(', ')}`);
}

const inventory = {
  doll: ASSETS.filter((asset) => asset.kind === 'doll').length,
  wearable: ASSETS.filter((asset) => asset.kind === 'wearable').length,
  background: ASSETS.filter((asset) => asset.kind === 'background').length,
  prop: ASSETS.filter((asset) => asset.kind === 'prop').length,
  face: ASSETS.filter((asset) => asset.kind === 'face').length
};
const expected = { doll: 6, wearable: 87, background: 11, prop: 22, face: 19 };
for (const [kind, count] of Object.entries(expected)) {
  if (inventory[kind] !== count) failures.push(`catalog: expected ${count} ${kind} assets, found ${inventory[kind]}`);
}

if (failures.length) {
  console.error(`Asset validation failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Asset validation passed: ${ASSETS.length} safe cataloged SVG files (${inventory.wearable} wearables).`);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
