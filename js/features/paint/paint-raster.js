/**
 * Custom Paint Studio — Pure Raster Operations Engine
 * Handles pixel manipulation, stroke interpolation, flood fill,
 * shapes, eyedropper, rectangular selection, mirror drawing, and PNG encoding.
 */

import { CUSTOM_WEARABLE_DIMENSIONS, CUSTOM_PROP_DIMENSIONS } from '../../domain/vocabulary.js';

export const BRUSH_SIZES = Object.freeze([4, 10, 20, 40]);

/**
 * Parses a hex color string (#RGB, #RRGGBB) into an RGBA object.
 */
export function hexToRgba(hex, alpha = 255) {
  if (typeof hex !== 'string') return { r: 0, g: 0, b: 0, a: alpha };
  let clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length !== 6) return { r: 0, g: 0, b: 0, a: alpha };
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return { r: 0, g: 0, b: 0, a: alpha };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
    a: Math.max(0, Math.min(255, alpha))
  };
}

/**
 * Converts RGBA numbers to a normalized hex string (#rrggbb).
 */
export function rgbaToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Creates an offscreen canvas with specified logical and backing pixel dimensions.
 */
export function createAuthoringCanvas(logicalWidth, logicalHeight, scaleFactor = 2) {
  const canvas = typeof document !== 'undefined'
    ? document.createElement('canvas')
    : { width: logicalWidth * scaleFactor, height: logicalHeight * scaleFactor };

  canvas.width = logicalWidth * scaleFactor;
  canvas.height = logicalHeight * scaleFactor;
  return canvas;
}

/**
 * Interpolates points between (x0, y0) and (x1, y1) for smooth brush stamping.
 */
export function interpolateStrokePoints(p0, p1, stepDistance = 2) {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const dist = Math.hypot(dx, dy);
  const step = Number.isFinite(stepDistance) && stepDistance > 0 ? stepDistance : 1;
  if (dist <= step) return [{ x: p1.x, y: p1.y }];

  const count = Math.ceil(dist / step);
  const points = [];
  for (let i = 1; i <= count; i += 1) {
    const t = i / count;
    points.push({
      x: p0.x + dx * t,
      y: p0.y + dy * t
    });
  }
  return points;
}

/**
 * Draws a circular brush or eraser stamp at (x, y) on a Canvas 2D context.
 */
export function drawBrushStamp(ctx, x, y, size, colorHex, isEraser = false) {
  if (!ctx) return;
  ctx.save();
  if (isEraser) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = colorHex;
  }
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Applies a stroke of points to a canvas with optional mirror reflection across axisX.
 */
export function applyStroke(ctx, points, { size = 10, color = '#2d261e', isEraser = false, mirror = false, axisX = 150 }) {
  if (!ctx || !points || points.length === 0) return;
  for (const pt of points) {
    drawBrushStamp(ctx, pt.x, pt.y, size, color, isEraser);
    if (mirror) {
      const mirroredX = 2 * axisX - pt.x;
      drawBrushStamp(ctx, mirroredX, pt.y, size, color, isEraser);
    }
  }
}

/**
 * Color distance check for flood fill matching tolerance.
 */
function colorMatches(data, idx, target, tolerance) {
  const dr = Math.abs(data[idx] - target.r);
  const dg = Math.abs(data[idx + 1] - target.g);
  const db = Math.abs(data[idx + 2] - target.b);
  const da = Math.abs(data[idx + 3] - target.a);
  return dr <= tolerance && dg <= tolerance && db <= tolerance && da <= tolerance;
}

/**
 * Pure 4-way stack-based flood fill on an ImageData instance.
 */
export function floodFillImageData(imageData, startX, startY, fillRgba, tolerance = 16) {
  const { width, height, data } = imageData;
  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  if (sx < 0 || sx >= width || sy < 0 || sy >= height) return false;

  const startIdx = (sy * width + sx) * 4;
  const targetRgba = {
    r: data[startIdx],
    g: data[startIdx + 1],
    b: data[startIdx + 2],
    a: data[startIdx + 3]
  };

  // If already matches fill color, do nothing
  if (
    Math.abs(targetRgba.r - fillRgba.r) <= tolerance &&
    Math.abs(targetRgba.g - fillRgba.g) <= tolerance &&
    Math.abs(targetRgba.b - fillRgba.b) <= tolerance &&
    Math.abs(targetRgba.a - fillRgba.a) <= tolerance
  ) {
    return false;
  }

  const visited = new Uint8Array(width * height);
  const stack = [sx, sy];

  while (stack.length > 0) {
    const y = stack.pop();
    const x = stack.pop();
    const pos = y * width + x;

    if (visited[pos]) continue;
    visited[pos] = 1;

    const idx = pos * 4;
    if (colorMatches(data, idx, targetRgba, tolerance)) {
      data[idx] = fillRgba.r;
      data[idx + 1] = fillRgba.g;
      data[idx + 2] = fillRgba.b;
      data[idx + 3] = fillRgba.a;

      if (x > 0 && !visited[pos - 1]) stack.push(x - 1, y);
      if (x < width - 1 && !visited[pos + 1]) stack.push(x + 1, y);
      if (y > 0 && !visited[pos - width]) stack.push(x, y - 1);
      if (y < height - 1 && !visited[pos + width]) stack.push(x, y + 1);
    }
  }
  return true;
}

/**
 * Executes a flood fill on a canvas context with optional mirror reflection.
 */
export function executeFloodFill(ctx, startX, startY, colorHex, { tolerance = 16, mirror = false, axisX = 150 } = {}) {
  if (!ctx) return false;
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const fillRgba = hexToRgba(colorHex, 255);

  let changed = floodFillImageData(imgData, startX, startY, fillRgba, tolerance);
  if (mirror) {
    const mirroredX = 2 * axisX - startX;
    if (mirroredX >= 0 && mirroredX < width) {
      const mirrorChanged = floodFillImageData(imgData, mirroredX, startY, fillRgba, tolerance);
      changed = changed || mirrorChanged;
    }
  }

  if (changed) {
    ctx.putImageData(imgData, 0, 0);
  }
  return changed;
}

/**
 * Draws a vector geometric shape (line, rectangle, ellipse) on a Canvas 2D context.
 */
export function drawShape(ctx, shapeType, x0, y0, x1, y1, {
  color = '#2d261e',
  size = 4,
  filled = false,
  isEraser = false,
  mirror = false,
  axisX = 150
} = {}) {
  if (!ctx) return;

  const renderSingleShape = (startX, startY, endX, endY) => {
    ctx.save();
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
    }
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    if (shapeType === 'line') {
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    } else if (shapeType === 'rect') {
      const x = Math.min(startX, endX);
      const y = Math.min(startY, endY);
      const w = Math.abs(endX - startX);
      const h = Math.abs(endY - startY);
      if (filled) {
        ctx.fillRect(x, y, w, h);
      } else {
        ctx.strokeRect(x, y, w, h);
      }
    } else if (shapeType === 'ellipse') {
      const cx = (startX + endX) / 2;
      const cy = (startY + endY) / 2;
      const rx = Math.abs(endX - startX) / 2;
      const ry = Math.abs(endY - startY) / 2;
      if (rx > 0 && ry > 0) {
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        if (filled) ctx.fill();
        else ctx.stroke();
      }
    }
    ctx.restore();
  };

  renderSingleShape(x0, y0, x1, y1);
  if (mirror) {
    const mx0 = 2 * axisX - x0;
    const mx1 = 2 * axisX - x1;
    renderSingleShape(mx0, y0, mx1, y1);
  }
}

/**
 * Samples a single pixel from canvas at (x, y) for eyedropper tool.
 * Returns null if the pixel is completely transparent (alpha === 0).
 */
export function samplePixel(ctx, x, y) {
  if (!ctx) return null;
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || px >= ctx.canvas.width || py < 0 || py >= ctx.canvas.height) return null;

  const pixel = ctx.getImageData(px, py, 1, 1).data;
  if (pixel[3] === 0) return null; // Ignore transparent pixels
  return {
    r: pixel[0],
    g: pixel[1],
    b: pixel[2],
    a: pixel[3],
    hex: rgbaToHex(pixel[0], pixel[1], pixel[2])
  };
}

/**
 * Scans an ImageData to find the tight bounding box of all non-transparent pixels.
 */
export function computeNonTransparentBounds(imageData) {
  const { width, height, data } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX === -1) {
    // Empty canvas
    return {
      empty: true,
      x: 0,
      y: 0,
      width: width,
      height: height,
      aspectRatio: 1
    };
  }

  const trimW = maxX - minX + 1;
  const trimH = maxY - minY + 1;
  return {
    empty: false,
    x: minX,
    y: minY,
    width: trimW,
    height: trimH,
    aspectRatio: trimW / trimH
  };
}

/**
 * Calculates logical display dimensions for a custom prop given player size preset.
 */
export function calculatePropDisplayDimensions(aspectRatio, sizeCategory = 'medium') {
  const maxSide = sizeCategory === 'small' ? 140 : sizeCategory === 'large' ? 360 : 240;
  const ratio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;
  let displayWidth;
  let displayHeight;

  if (ratio >= 1) {
    displayWidth = maxSide;
    displayHeight = Math.max(1, Math.round(maxSide / ratio));
  } else {
    displayHeight = maxSide;
    displayWidth = Math.max(1, Math.round(maxSide * ratio));
  }

  return {
    displayWidth,
    displayHeight
  };
}

/**
 * Converts a canvas element to a PNG Blob.
 */
export function canvasToBlob(canvas, type = 'image/png') {
  return new Promise((resolve, reject) => {
    if (typeof canvas?.toBlob === 'function') {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      }, type);
    } else {
      reject(new Error('toBlob not supported in this environment'));
    }
  });
}
