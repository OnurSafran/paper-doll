#!/usr/bin/env node

/**
 * Regenerates every background SVG in assets/backgrounds.
 *
 * The scenes are generated rather than hand-drawn because seamless tiling is a
 * numeric property: horizons must leave and re-enter a tile at the same height
 * and slope, repeating textures must sit on a period that divides the tile
 * width, and set pieces on an edge must be drawn twice. See scripts/backgrounds/lib.mjs
 * for those helpers and docs/ASSETS.md for the rules they enforce.
 *
 * Edit the scene modules, run `npm run build:backgrounds`, then re-run
 * `npm run check` (the app-shell fingerprint in sw.js changes with the art).
 */

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import forest from './backgrounds/forest.mjs';
import park from './backgrounds/park.mjs';
import beach from './backgrounds/beach.mjs';
import { atelier, bedroom, cafe, library } from './backgrounds/interiors.mjs';
import { candyLand, citySunset, moonlitMeadow, snowyVillage } from './backgrounds/wide.mjs';

const dir = resolve(import.meta.dirname, '../assets/backgrounds');
const scenes = {
  'bedroom.svg': bedroom,
  'park.svg': park,
  'atelier.svg': atelier,
  'beach.svg': beach,
  'cafe.svg': cafe,
  'forest.svg': forest,
  'library.svg': library,
  'moonlit-meadow.svg': moonlitMeadow,
  'snowy-village.svg': snowyVillage,
  'city-sunset.svg': citySunset,
  'candy-land.svg': candyLand
};

const failures = [];

for (const [name, build] of Object.entries(scenes)) {
  const source = build();
  const bytes = Buffer.byteLength(source);
  const shapes = [...source.matchAll(/<(?:path|rect|circle|ellipse|line|polyline|polygon)\b/gi)].length;
  await writeFile(resolve(dir, name), source, 'utf8');
  console.log(`${name.padEnd(22)} ${String(bytes).padStart(7)} bytes  ${String(shapes).padStart(4)} shapes`);
  if (shapes > 800) failures.push(`${name}: ${shapes} shapes exceeds the 800-shape budget`);
  if (bytes > 400_000) failures.push(`${name}: ${bytes} bytes exceeds the 400KB budget`);
}

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
}
