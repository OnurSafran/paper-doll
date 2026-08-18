import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hexToRgba,
  rgbaToHex,
  interpolateStrokePoints,
  floodFillImageData,
  computeNonTransparentBounds,
  calculatePropDisplayDimensions,
  drawBrushStamp,
  applyStroke,
  drawShape,
  samplePixel,
  executeFloodFill
} from '../js/features/paint/paint-raster.js';

test('hexToRgba and rgbaToHex convert accurately', () => {
  const c1 = hexToRgba('#ff0000');
  assert.deepEqual(c1, { r: 255, g: 0, b: 0, a: 255 });

  const c2 = hexToRgba('#0f0', 128);
  assert.deepEqual(c2, { r: 0, g: 255, b: 0, a: 128 });

  const c3 = hexToRgba('invalid');
  assert.deepEqual(c3, { r: 0, g: 0, b: 0, a: 255 });

  const hex = rgbaToHex(255, 128, 0);
  assert.equal(hex, '#ff8000');
});

test('interpolateStrokePoints generates evenly spaced coordinates', () => {
  const p0 = { x: 0, y: 0 };
  const p1 = { x: 10, y: 0 };
  const points = interpolateStrokePoints(p0, p1, 2);

  assert.equal(points.length, 5);
  assert.equal(points[0].x, 2);
  assert.equal(points[4].x, 10);
});

test('floodFillImageData fills contiguous matching regions within tolerance', () => {
  // 4x4 image with a 2x2 white center on black background
  const width = 4;
  const height = 4;
  const data = new Uint8ClampedArray(width * height * 4); // all 0 (black transparent)

  // set center 2x2 to red
  for (const y of [1, 2]) {
    for (const x of [1, 2]) {
      const idx = (y * width + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 0;
      data[idx + 2] = 0;
      data[idx + 3] = 255;
    }
  }

  const imgData = { width, height, data };
  const fillBlue = { r: 0, g: 0, b: 255, a: 255 };

  const bounds = {};
  const changed = floodFillImageData(imgData, 1, 1, fillBlue, 10, bounds);
  assert.equal(changed, true);
  assert.deepEqual(bounds, { x: 1, y: 1, right: 2, bottom: 2 });

  // Check center 2x2 is now blue
  for (const y of [1, 2]) {
    for (const x of [1, 2]) {
      const idx = (y * width + x) * 4;
      assert.equal(data[idx], 0);
      assert.equal(data[idx + 1], 0);
      assert.equal(data[idx + 2], 255);
      assert.equal(data[idx + 3], 255);
    }
  }

  // Check (0,0) is still untouched black transparent
  assert.equal(data[0], 0);
  assert.equal(data[3], 0);
});

test('scanline flood fill follows neighboring spans across a wide region', () => {
  const width = 5;
  const height = 3;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) data[i * 4 + 3] = 255;

  const target = [[1, 1], [2, 1], [3, 1], [3, 0], [1, 2]];
  for (const [x, y] of target) {
    const idx = (y * width + x) * 4;
    data[idx] = 255;
    data[idx + 1] = 0;
    data[idx + 2] = 0;
  }
  const changed = floodFillImageData({ width, height, data }, 1, 1, { r: 0, g: 0, b: 255, a: 255 });
  assert.equal(changed, true);
  for (const [x, y] of target) {
    const idx = (y * width + x) * 4;
    assert.equal(data[idx + 2], 255);
  }
});

test('computeNonTransparentBounds accurately finds bounding boxes and aspect ratios', () => {
  const width = 10;
  const height = 10;
  const data = new Uint8ClampedArray(width * height * 4);

  // empty canvas
  const emptyRes = computeNonTransparentBounds({ width, height, data });
  assert.equal(emptyRes.empty, true);
  assert.equal(emptyRes.width, 10);

  // Draw a 4x2 rectangle from (2, 3) to (5, 4)
  for (let y = 3; y <= 4; y++) {
    for (let x = 2; x <= 5; x++) {
      const idx = (y * width + x) * 4;
      data[idx + 3] = 255; // alpha
    }
  }

  const filledRes = computeNonTransparentBounds({ width, height, data });
  assert.equal(filledRes.empty, false);
  assert.equal(filledRes.x, 2);
  assert.equal(filledRes.y, 3);
  assert.equal(filledRes.width, 4);
  assert.equal(filledRes.height, 2);
  assert.equal(filledRes.aspectRatio, 2);
});

test('calculatePropDisplayDimensions respects small, medium, and large size constraints', () => {
  // Wide prop (aspect ratio 2.0)
  const wideSmall = calculatePropDisplayDimensions(2.0, 'small');
  assert.equal(wideSmall.displayWidth, 140);
  assert.equal(wideSmall.displayHeight, 70);

  const wideMed = calculatePropDisplayDimensions(2.0, 'medium');
  assert.equal(wideMed.displayWidth, 240);
  assert.equal(wideMed.displayHeight, 120);

  const wideLg = calculatePropDisplayDimensions(2.0, 'large');
  assert.equal(wideLg.displayWidth, 360);
  assert.equal(wideLg.displayHeight, 180);

  // Tall prop (aspect ratio 0.5)
  const tallMed = calculatePropDisplayDimensions(0.5, 'medium');
  assert.equal(tallMed.displayHeight, 240);
  assert.equal(tallMed.displayWidth, 120);
});

test('Canvas context operations handle strokes, shapes, and mirroring cleanly', () => {
  const calls = [];
  const mockCtx = {
    canvas: { width: 300, height: 450 },
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => calls.push('beginPath'),
    arc: (...args) => calls.push(['arc', ...args]),
    moveTo: (...args) => calls.push(['moveTo', ...args]),
    lineTo: (...args) => calls.push(['lineTo', ...args]),
    stroke: () => calls.push('stroke'),
    fill: () => calls.push('fill'),
    strokeRect: (...args) => calls.push(['strokeRect', ...args]),
    fillRect: (...args) => calls.push(['fillRect', ...args]),
    ellipse: (...args) => calls.push(['ellipse', ...args]),
    getImageData: (x, y, w, h) => {
      const data = new Uint8ClampedArray(w * h * 4);
      data[0] = 255; // red
      data[3] = 255; // opaque
      return { width: w, height: h, data };
    },
    putImageData: () => calls.push('putImageData')
  };

  // Draw single stamp
  drawBrushStamp(mockCtx, 50, 60, 10, '#ff0000');
  assert.equal(mockCtx.fillStyle, '#ff0000');

  // Draw mirrored stroke
  applyStroke(mockCtx, [{ x: 40, y: 50 }], { size: 10, color: '#00ff00', mirror: true, axisX: 150 });
  // axisX = 150 -> mirroredX = 300 - 40 = 260
  const arcCalls = calls.filter((c) => Array.isArray(c) && c[0] === 'arc');
  assert.equal(arcCalls.length >= 2, true);
  assert.equal(arcCalls[arcCalls.length - 2][1], 40);
  assert.equal(arcCalls[arcCalls.length - 1][1], 260);

  // Draw rectangle with mirror
  drawShape(mockCtx, 'rect', 10, 20, 30, 40, { mirror: true, axisX: 150 });
  const rectCalls = calls.filter((c) => Array.isArray(c) && c[0] === 'strokeRect');
  assert.equal(rectCalls.length >= 2, true);

  // Eyedropper sample
  const sample = samplePixel(mockCtx, 10, 10);
  assert.equal(sample.hex, '#ff0000');
});
