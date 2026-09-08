import test from 'node:test';
import assert from 'node:assert/strict';
import { appendAsset } from '../js/features/designer/designer-view.js';
import { getAsset } from '../js/core/asset-catalog.js';
import { paletteValue } from '../js/core/palette.js';

async function preview(id, color) {
  const attrs = new Map();
  const properties = new Map();
  const svg = { setAttribute: (key, value) => attrs.set(key, value) };
  const container = { style: { setProperty: (key, value) => properties.set(key, value) }, append: () => {} };
  await appendAsset(container, id, { isPreview: true, color, loadAssetSvg: async () => svg });
  return { attrs, properties };
}

test('body accessory previews include their attachment points instead of cropping to the head', async () => {
  for (const [id, px, py] of [
    ['accessory_rattle_baby', 202, 193],
    ['accessory_backpack_child', 150, 148],
    ['accessory_bib_baby', 150, 150],
    ['accessory_shawl_elder', 150, 170]
  ]) {
    const { attrs } = await preview(id);
    const [x, y, width, height] = attrs.get('viewBox').split(' ').map(Number);
    assert.ok(px > x && px < x + width && py > y && py < y + height, `${id} attachment must be visible`);
  }
});

test('baby shoe and overalls previews include the toes and shoulder straps', async () => {
  for (const [id, minY, maxY] of [
    ['bottom_overalls', 108, 344],
    ['shoes_booties_baby', 336, 369],
    ['shoes_sneakers_baby', 337, 370]
  ]) {
    const { attrs } = await preview(id);
    const [, y, , height] = attrs.get('viewBox').split(' ').map(Number);
    assert.ok(y <= minY && y + height >= maxY, `${id} must fit entirely in its thumbnail`);
  }
});

test('hair previews use the hair color channel for default and custom colors', async () => {
  const normal = await preview('hair_long');
  assert.equal(normal.properties.get('--hair-color'), paletteValue(getAsset('hair_long').defaultColors.primary));
  const custom = await preview('hair_long', '#1265ab');
  assert.equal(custom.properties.get('--hair-color'), '#1265ab');
});
