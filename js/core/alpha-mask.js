/**
 * Alpha-threshold geometry shared by Paint Studio cropping and stage hit testing.
 * Thresholding only measures artwork; it never modifies saved pixels.
 */

/** Minimum composited alpha (0…255) that counts as visible artwork. */
export const ALPHA_THRESHOLD = 15;

/**
 * Inclusive bounds of pixels with alpha >= threshold.
 * @param {{width: number, height: number, data: ArrayLike<number>}} imageData
 */
export function computeAlphaBounds(imageData, threshold = ALPHA_THRESHOLD) {
  const { width, height, data } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    let row = y * width * 4 + 3;
    for (let x = 0; x < width; x += 1, row += 4) {
      if (data[row] >= threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX === -1) return { empty: true, x: 0, y: 0, width, height, aspectRatio: 1 };
  const trimW = maxX - minX + 1;
  const trimH = maxY - minY + 1;
  return { empty: false, x: minX, y: minY, width: trimW, height: trimH, aspectRatio: trimW / trimH };
}

/**
 * Keeps only the alpha channel of rasterized artwork, mapped to a user-space rectangle.
 * @param {{width: number, height: number, data: ArrayLike<number>}} imageData
 * @param {{x: number, y: number, width: number, height: number}} rect user-space area the pixels cover
 */
export function createAlphaMask(imageData, rect) {
  const { width, height, data } = imageData;
  const alpha = new Uint8Array(width * height);
  let any = false;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let i = 0, j = 3; i < alpha.length; i += 1, j += 4) {
    alpha[i] = data[j];
    if (data[j] >= ALPHA_THRESHOLD) any = true;
    // Include faint channel edges: overlapping doll channels can composite to
    // visible alpha even when each channel is below the hit threshold.
    if (data[j] > 0) {
      const x = i % width, y = Math.floor(i / width);
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  const bounds = maxX < 0 ? null : {
    x: rect.x + minX / width * rect.width, y: rect.y + minY / height * rect.height,
    width: (maxX - minX + 1) / width * rect.width, height: (maxY - minY + 1) / height * rect.height
  };
  return { width, height, rect: { ...rect }, alpha, empty: !any, bounds };
}

/** Composited alpha at a user-space point; 0 outside the mask. */
export function maskAlphaAt(mask, ux, uy) {
  if (!mask) return 0;
  const { rect } = mask;
  const px = Math.floor((ux - rect.x) / rect.width * mask.width);
  const py = Math.floor((uy - rect.y) / rect.height * mask.height);
  if (px < 0 || py < 0 || px >= mask.width || py >= mask.height) return 0;
  return mask.alpha[py * mask.width + px];
}

export function maskHit(mask, ux, uy, threshold = ALPHA_THRESHOLD) {
  return maskAlphaAt(mask, ux, uy) >= threshold;
}

function createCanvas(width, height) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function decodeBlob(blob) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(blob); } catch { /* SVG bitmaps are not universal */ }
  }
  const url = URL.createObjectURL(blob);
  try { return await decodeUrl(url); } finally { URL.revokeObjectURL(url); }
}

// `decode()` can stay pending while a page is hidden; load events still fire and
// drawImage decodes on demand, so masks never stall a background render.
function decodeUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Artwork could not be decoded.'));
    img.src = url;
  });
}

async function decodeRasterUrl(url) {
  if (typeof createImageBitmap === 'function' && typeof fetch === 'function') {
    try { return await createImageBitmap(await (await fetch(url)).blob()); } catch { /* fall back to an image element */ }
  }
  return decodeUrl(url);
}

/** Inline raster references once before SVG image decoding, preserving SVG opacity and clipping. */
export async function inlineSvgImages(svg) {
  await Promise.all([...svg.querySelectorAll('image')].map(async (element) => {
    const href = element.getAttribute('href');
    if (!href || href.startsWith('data:')) return;
    const response = await fetch(href);
    if (!response.ok) throw new Error('Artwork could not be loaded.');
    const blob = await response.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    element.setAttribute('href', String(dataUrl));
  }));
}

/**
 * Draws sources onto one canvas and returns its pixels. Each source is either an
 * SVG element (rendered over `rect`) or an image URL drawn into a destination box.
 * @param {Array<{svg?: Element, url?: string, box?: {x: number, y: number, width: number, height: number}}>} sources
 * @param {{x: number, y: number, width: number, height: number}} rect user-space area to rasterize
 */
export async function rasterizeSources(sources, rect, pixelWidth, pixelHeight) {
  const width = Math.max(1, Math.round(pixelWidth));
  const height = Math.max(1, Math.round(pixelHeight));
  const canvas = createCanvas(width, height);
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d', { willReadFrequently: true }));
  const sx = width / rect.width;
  const sy = height / rect.height;
  for (const source of sources) {
    let image = null;
    let box = source.box || rect;
    if (source.svg) {
      const clone = /** @type {Element} */ (source.svg.cloneNode(true));
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('viewBox', `${rect.x} ${rect.y} ${rect.width} ${rect.height}`);
      clone.setAttribute('preserveAspectRatio', 'none');
      clone.setAttribute('width', String(width));
      clone.setAttribute('height', String(height));
      const text = new XMLSerializer().serializeToString(clone);
      image = await decodeBlob(new Blob([text], { type: 'image/svg+xml;charset=utf-8' }));
      box = rect;
    } else if (source.url) {
      image = await decodeRasterUrl(source.url);
    }
    if (!image) continue;
    ctx.drawImage(image, (box.x - rect.x) * sx, (box.y - rect.y) * sy, box.width * sx, box.height * sy);
    image.close?.();
  }
  return ctx.getImageData(0, 0, width, height);
}

/** Decodes a raster image URL, downsampled so its longer side is at most `maxSide`. */
export async function rasterizeImageUrl(url, maxSide = Number.POSITIVE_INFINITY) {
  const image = await decodeRasterUrl(url);
  const naturalWidth = /** @type {HTMLImageElement} */ (image).naturalWidth || image.width;
  const naturalHeight = /** @type {HTMLImageElement} */ (image).naturalHeight || image.height;
  const fit = Math.min(1, maxSide / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(1, Math.round(naturalWidth * fit));
  const height = Math.max(1, Math.round(naturalHeight * fit));
  const canvas = createCanvas(width, height);
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d', { willReadFrequently: true }));
  ctx.drawImage(image, 0, 0, width, height);
  /** @type {any} */ (image).close?.();
  return ctx.getImageData(0, 0, width, height);
}
