import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureHistorySnapshot,
  cropHistorySnapshot,
  historySnapshotChanged,
  restoreHistorySnapshot
} from '../js/features/paint/paint-history.js';

function makeContext(width, height) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  return {
    canvas: { width, height },
    pixels,
    getImageData(x, y, w, h) {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let row = 0; row < h; row += 1) {
        const start = ((y + row) * width + x) * 4;
        data.set(pixels.subarray(start, start + w * 4), row * w * 4);
      }
      return { data, width: w, height: h };
    },
    putImageData(imageData, x, y) {
      for (let row = 0; row < imageData.height; row += 1) {
        const start = ((y + row) * width + x) * 4;
        pixels.set(imageData.data.subarray(row * imageData.width * 4, (row + 1) * imageData.width * 4), start);
      }
    }
  };
}

test('history snapshots capture and restore only the affected canvas rectangle', () => {
  const ctx = makeContext(8, 6);
  ctx.pixels[(2 * 8 + 3) * 4] = 10;
  const before = captureHistorySnapshot(ctx, { x: 2, y: 1, width: 3, height: 3 });

  ctx.pixels[(2 * 8 + 3) * 4] = 99;
  assert.equal(historySnapshotChanged(ctx, before), true);
  assert.equal(before.width, 3);
  assert.equal(before.height, 3);

  restoreHistorySnapshot(ctx, before);
  assert.equal(ctx.pixels[(2 * 8 + 3) * 4], 10);
  assert.equal(ctx.pixels.length, 8 * 6 * 4);
});

test('cropping a full before-image preserves source pixels in a dirty rectangle', () => {
  const ctx = makeContext(5, 4);
  ctx.pixels[(3 * 5 + 4) * 4 + 1] = 77;
  const full = captureHistorySnapshot(ctx);
  const patch = cropHistorySnapshot(full, { x: 3, y: 2, width: 2, height: 2 });

  assert.equal(patch.x, 3);
  assert.equal(patch.y, 2);
  assert.equal(patch.width, 2);
  assert.equal(patch.height, 2);
  assert.equal(patch.data[(1 * 2 + 1) * 4 + 1], 77);
});

test('full snapshots compare only the requested dirty rectangle', () => {
  const ctx = makeContext(6, 4);
  const before = captureHistorySnapshot(ctx);
  ctx.pixels[0] = 42;

  assert.equal(historySnapshotChanged(ctx, before, { x: 2, y: 1, width: 2, height: 2 }), false);
  assert.equal(historySnapshotChanged(ctx, before, { x: 0, y: 0, width: 1, height: 1 }), true);
});
