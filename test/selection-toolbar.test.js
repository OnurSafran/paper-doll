import test from 'node:test';
import assert from 'node:assert/strict';
import { contextToolbarPosition } from '../js/features/play/selection-hud-controller.js';
import { artworkStageBounds } from '../js/features/play/stage-hit-testing.js';

const viewport = { left: 0, top: 0, width: 1440, height: 900 };
const size = { width: 400, height: 44 };

test('following actions stay centered below artwork and can cross the stage edge', () => {
  const position = contextToolbarPosition({ left: 950, right: 1050, top: 300, bottom: 500 }, size, viewport);
  assert.deepEqual(position, { left: 800, top: 512, isAbove: false });
  assert.ok(position.left + size.width > 1000, 'a stage ending at x1000 cannot clamp the toolbar');
});

test('window margins constrain actions, including a zoomed visual viewport', () => {
  assert.equal(contextToolbarPosition({ left: 0, right: 30, top: 100, bottom: 200 }, size, viewport).left, 12);
  assert.equal(contextToolbarPosition({ left: 1400, right: 1430, top: 100, bottom: 200 }, size, viewport).left, 1028);
  const zoomed = { left: 100, top: 200, width: 375, height: 500 };
  const position = contextToolbarPosition({ left: 420, right: 470, top: 250, bottom: 400 }, { width: 351, height: 53 }, zoomed);
  assert.deepEqual(position, { left: 112, top: 412, isAbove: false });
});

test('actions flip above near the window bottom and avoid covering the minimap', () => {
  assert.deepEqual(contextToolbarPosition({ left: 600, right: 800, top: 700, bottom: 880 }, size, viewport), { left: 500, top: 624, isAbove: true });
  const minimap = { left: 800, right: 1000, top: 710, bottom: 760 };
  assert.deepEqual(contextToolbarPosition({ left: 850, right: 950, top: 500, bottom: 700 }, size, viewport, minimap), { left: 700, top: 424, isAbove: true });
});

test('oversized artwork still leaves all actions within the window', () => {
  const position = contextToolbarPosition({ left: -100, right: 1540, top: -200, bottom: 1100 }, size, viewport);
  assert.ok(position.top >= 12 && position.top + size.height <= viewport.height - 12);
});

test('cached painted extents follow preview positions, flips and attachment rotation', () => {
  const geometry = { x: 800, y: 600, width: 200, height: 200, anchorX: .5, anchorY: 1, flip: -1, attachedTx: 40, attachedTy: 10, attachedRot: 90 };
  const bounds = artworkStageBounds({ x: .1, y: .4, width: .15, height: .2 }, geometry);
  for (const [key, expected] of Object.entries({ left: 920, right: 960, top: 660, bottom: 690 })) assert.ok(Math.abs(bounds[key] - expected) < 1e-9, key);
  const moved = artworkStageBounds({ x: .1, y: .4, width: .15, height: .2 }, { ...geometry, x: 850, y: 630 });
  assert.equal(moved.left - bounds.left, 50);
  assert.equal(moved.top - bounds.top, 30);
});

test('doll toolbar bounds use the original canvas and measured contact without rescaling', () => {
  const geometry = { x: 800, y: 750, width: 235, height: 400 * 235 / 300, anchorX: .5, anchorY: 1, flip: 1, attachedTx: 0, attachedTy: 0, attachedRot: 0 };
  const bounds = artworkStageBounds({ x: 100 / 300, y: 100 / 450, width: 100 / 300, height: 300 / 450 }, geometry, 235 * 450 / 300);
  assert.equal(bounds.bottom, 750);
  assert.ok(Math.abs(bounds.top - (750 - 300 * 235 / 300)) < 1e-9);
});
