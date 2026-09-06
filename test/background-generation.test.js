import test from 'node:test';
import assert from 'node:assert/strict';
import { wrap } from '../scripts/backgrounds/lib.mjs';
import { citySunset } from '../scripts/backgrounds/wide.mjs';

test('wrapped decorations reuse their geometry without rerolling random detail', () => {
  for (const [x, offset] of [[3, 1600], [1597, -1600]]) {
    let calls = 0;
    const result = wrap(x, 1600, 20, (px) => `<circle cx="${px}" r="${++calls}"/>`);
    assert.equal(calls, 1);
    assert.equal(result, `<circle cx="${x}" r="1"/>\n<g transform="translate(${offset} 0)"><circle cx="${x}" r="1"/></g>`);
  }
  assert.equal(wrap(800, 1600, 20, (x) => `<circle cx="${x}"/>`), '<circle cx="800"/>');
});

test('rooftop bulbs have valid colors and windows stay inside their towers', () => {
  const source = citySunset();
  assert.doesNotMatch(source, /undefined|NaN/);
  const bulbs = [...source.matchAll(/<circle\b[^>]*r="14" fill="([^"]+)"/g)];
  assert.equal(bulbs.length, 20);
  assert.equal(new Set(bulbs.map((match) => match[1])).size, 4);
  for (const [, color] of bulbs) assert.match(color, /^#[0-9a-f]{6}$/);

  const towers = [...source.matchAll(/<g transform="translate\([^\"]+\)">\s*<rect x="0" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="#5f3f5e"\/>\s*([\s\S]*?)<\/g>/g)];
  assert.ok(towers.length >= 25);
  let windows = 0;
  for (const [, top, width, height, contents] of towers) {
    for (const [, x, y] of contents.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="9" height="13"/g)) {
      windows += 1;
      assert.ok(+x >= 0 && +x + 9 <= +width);
      assert.ok(+y >= +top && +y + 13 <= +top + +height);
    }
  }
  assert.ok(windows > 0);
});
