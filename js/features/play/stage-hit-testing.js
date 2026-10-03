/**
 * Alpha-accurate stage hit testing.
 *
 * Masks are rasterized once per artwork and reused. At pointer time the client
 * point is mapped through each candidate's current visual transforms (read from
 * the same CSS inputs the renderer uses), so transparent artwork falls through
 * to entities behind it. Dolls keep one mask per rig channel so animated heads
 * and limbs are tested where they are drawn, not where they rest.
 */
import { clientToLogical, stageContentRect } from '../../core/coordinate-space.js';
import {
  ALPHA_THRESHOLD,
  createAlphaMask,
  inlineSvgImages,
  maskAlphaAt,
  maskHit,
  rasterizeImageUrl,
  rasterizeSources
} from '../../core/alpha-mask.js';
import { createExportDollSvg } from '../../core/doll-svg.js';
import { createBubbleSvg } from '../../core/bubble-svg.js';
import { loadAssetSvg, makeAssetPlaceholder } from '../../core/svg-loader.js';
import { measureCharacterContacts } from '../../core/character-measurement.js';
import {
  CHARACTER_AUTHORING_HEIGHT,
  CHARACTER_AUTHORING_WIDTH,
  customFullArtId,
  getCharacterContact
} from '../../domain/character-geometry.js';
import { CHARACTER_DIMENSIONS, DEFAULT_BASE_DOLL_ID, isCustomAssetId } from '../../domain/vocabulary.js';
import { isDefaultFace } from '../../domain/outfit-rules.js';
import { artworkRevision } from '../../domain/artwork-revision.js';

export const POSE_CHANNELS = Object.freeze(['body', 'head', 'eyes', 'armLeft', 'armRight', 'legLeft', 'legRight']);

// Element IDs the stage stylesheet animates inside any doll layer.
const CHANNEL_ELEMENT_IDS = Object.freeze({
  'pose-head': 'head',
  'pose-arm-left': 'armLeft',
  'arm-left': 'armLeft',
  'pose-arm-right': 'armRight',
  'arm-right': 'armRight',
  'pose-leg-left': 'legLeft',
  'leg-left': 'legLeft',
  'pose-leg-right': 'legRight',
  'leg-right': 'legRight'
});
const CHANNEL_CSS_PREFIX = Object.freeze({
  head: '--motion-head',
  armLeft: '--motion-arm-left',
  armRight: '--motion-arm-right',
  legLeft: '--motion-leg-left',
  legRight: '--motion-leg-right'
});
/** @type {Readonly<Record<string, {key: 'headPivot'|'shoulderLeftPivot'|'shoulderRightPivot'|'hipLeftPivot'|'hipRightPivot', fallback: {x: number, y: number}}>>} */
const CHANNEL_PIVOTS = Object.freeze({
  head: { key: 'headPivot', fallback: { x: 150, y: 90 } },
  armLeft: { key: 'shoulderLeftPivot', fallback: { x: 126, y: 120 } },
  armRight: { key: 'shoulderRightPivot', fallback: { x: 174, y: 120 } },
  legLeft: { key: 'hipLeftPivot', fallback: { x: 138, y: 230 } },
  legRight: { key: 'hipRightPivot', fallback: { x: 162, y: 230 } }
});
const PAINTED_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'use', 'image']);
const NON_RENDERED_CONTAINERS = new Set(['defs', 'clipPath', 'mask', 'symbol', 'pattern', 'marker']);
const MAX_MASK_ENTRIES = 96;
const MAX_PROP_MASK_PIXELS = 1024;
const MAX_RASTER_MASK_SIDE = 512;
export const HIT_TOLERANCE_CSS_PX = 2.5;
// A bounded disk sample, independent of mask density and zoom. No canvas/DOM work.
const EDGE_SAMPLES = Object.freeze([1, 2, 3, 4, 5].flatMap(ring =>
  Array.from({ length: ring * 8 }, (_, i) => {
    const angle = i * Math.PI * 2 / (ring * 8);
    return { x: Math.cos(angle) * ring / 5, y: Math.sin(angle) * ring / 5 };
  })));

export function hitWithTolerance(point, tolerance, test) {
  if (test(point)) return true;
  if (!(tolerance.x > 0) && !(tolerance.y > 0)) return false;
  return EDGE_SAMPLES.some(offset => test({ x: point.x + offset.x * tolerance.x, y: point.y + offset.y * tolerance.y }));
}

// ---------------------------------------------------------------------------
// Pure geometry (shared with tests)

/**
 * Inverts `transform-origin: o; transform: translate(t) rotate(r) scale(s)` for one point.
 * Equivalent to applying T(o)·T(t)·R(r)·S(s)·T(-o) in reverse.
 */
export function inverseOriginTransform(point, { origin = { x: 0, y: 0 }, tx = 0, ty = 0, rotate = 0, scaleX = 1, scaleY = 1 } = {}) {
  let x = point.x - origin.x - tx;
  let y = point.y - origin.y - ty;
  if (rotate) {
    const r = -rotate * Math.PI / 180;
    const c = Math.cos(r);
    const s = Math.sin(r);
    [x, y] = [x * c - y * s, x * s + y * c];
  }
  // A collapsed axis has no visible area to hit.
  if (!scaleX || !scaleY) return null;
  return { x: x / scaleX + origin.x, y: y / scaleY + origin.y };
}

/**
 * Maps a logical stage point into an entity's unflipped visual box, where
 * (0, 0) is the box's top-left corner and (width, height) its bottom-right.
 */
export function entityLocalPoint(point, geometry) {
  const { x, y, width, height, anchorX = 0.5, anchorY = 1, flip = 1, attachedTx = 0, attachedTy = 0, attachedRot = 0 } = geometry;
  const anchor = { x, y };
  const visual = inverseOriginTransform(point, { origin: anchor, tx: attachedTx, ty: attachedTy, rotate: attachedRot, scaleX: flip, scaleY: 1 });
  if (!visual) return null;
  return { x: visual.x - (x - anchorX * width), y: visual.y - (y - anchorY * height) };
}

/** Maps box coordinates to user space for `preserveAspectRatio="xMidYMid meet"` (also object-fit: contain). */
export function meetBoxToUser(local, boxWidth, boxHeight, rect) {
  const k = Math.min(boxWidth / rect.width, boxHeight / rect.height);
  if (!(k > 0)) return null;
  const offsetX = (boxWidth - rect.width * k) / 2;
  const offsetY = (boxHeight - rect.height * k) / 2;
  return { x: rect.x + (local.x - offsetX) / k, y: rect.y + (local.y - offsetY) / k };
}

/** Neutral painted extent within the visual/canvas, including meet-fit offsets. */
export function selectionArtworkBox(descriptor, geometry) {
  if (descriptor.mode === 'character') {
    const bounds = Object.values(descriptor.masks).map(mask => /** @type {any} */ (mask).bounds).filter(Boolean);
    if (!bounds.length) return { x: 0, y: 0, width: 1, height: 1 };
    const left = Math.min(...bounds.map(b => b.x)), right = Math.max(...bounds.map(b => b.x + b.width));
    const top = Math.min(...bounds.map(b => b.y)), bottom = Math.max(...bounds.map(b => b.y + b.height));
    return { x: left / CHARACTER_AUTHORING_WIDTH, y: top / CHARACTER_AUTHORING_HEIGHT,
      width: (right - left) / CHARACTER_AUTHORING_WIDTH, height: (bottom - top) / CHARACTER_AUTHORING_HEIGHT };
  }
  if (descriptor.mode === 'mask' && descriptor.mask.bounds) {
    const { rect, bounds } = descriptor.mask;
    const k = Math.min(geometry.width / rect.width, geometry.height / rect.height);
    return {
      x: (.5 * (geometry.width - rect.width * k) + (bounds.x - rect.x) * k) / geometry.width,
      y: (.5 * (geometry.height - rect.height * k) + (bounds.y - rect.y) * k) / geometry.height,
      width: bounds.width * k / geometry.width, height: bounds.height * k / geometry.height
    };
  }
  return { x: 0, y: 0, width: 1, height: 1 };
}

/** Built-in dolls use their body center; painted bounds still set the marker height. */
export function selectionMarkerPoint(descriptor, geometry) {
  const box = selectionArtworkBox(descriptor, geometry);
  const x = descriptor.mode === 'character' && Number.isFinite(descriptor.bodyCenterX)
    ? descriptor.bodyCenterX / CHARACTER_AUTHORING_WIDTH
    : box.x + box.width / 2;
  return { x, y: box.y };
}

/** Stable toolbar extent: follows placement, flip and attachment, not joint motion. */
export function artworkStageBounds(box, geometry, canvasHeight = geometry.height) {
  const { x, y, width, height, anchorX, anchorY, flip, attachedTx, attachedTy, attachedRot } = geometry;
  const angle = attachedRot * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  const points = [box.x, box.x + box.width].flatMap(u => [box.y, box.y + box.height].map(v => {
    const dx = (u * width - anchorX * width) * flip, dy = v * canvasHeight - anchorY * height;
    return { x: x + attachedTx + dx * c - dy * s, y: y + attachedTy + dx * s + dy * c };
  }));
  return { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)),
    top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) };
}

/**
 * Maps a point in a character's visual box to authoring coordinates through the
 * root motion transform. The canvas box shares the envelope's top-left corner and
 * width; root motion pivots on the contact.
 */
export function characterAuthoringPoint(local, boxWidth, contact, root = {}) {
  const canvasHeight = boxWidth * CHARACTER_AUTHORING_HEIGHT / CHARACTER_AUTHORING_WIDTH;
  const origin = { x: contact.x / CHARACTER_AUTHORING_WIDTH * boxWidth, y: contact.y / CHARACTER_AUTHORING_HEIGHT * canvasHeight };
  const canvasPoint = inverseOriginTransform(local, {
    origin,
    tx: (root.x || 0) / CHARACTER_DIMENSIONS.BASE_WIDTH * boxWidth,
    ty: (root.y || 0) / CHARACTER_DIMENSIONS.BASE_HEIGHT * canvasHeight,
    rotate: root.rotate || 0,
    scaleX: root.scaleX ?? 1,
    scaleY: root.scaleY ?? 1
  });
  if (!canvasPoint) return null;
  return { x: canvasPoint.x / boxWidth * CHARACTER_AUTHORING_WIDTH, y: canvasPoint.y / canvasHeight * CHARACTER_AUTHORING_HEIGHT };
}

/** Undoes one rig channel's joint transform (authoring units, pivot-relative). */
export function channelPoint(authoringPoint, pivot, joint = {}) {
  return inverseOriginTransform(authoringPoint, {
    origin: pivot,
    tx: joint.x || 0,
    ty: joint.y || 0,
    rotate: joint.rotate || 0,
    scaleX: joint.scaleX ?? 1,
    scaleY: joint.scaleY ?? 1
  });
}

/**
 * Tests a character's channel masks at an authoring point.
 * @param {Record<string, any>} masks channel → alpha mask (absent channels skipped)
 * @param {Record<string, {x: number, y: number}>} pivots
 * @param {Record<string, any>} joints channel → joint transform
 */
export function characterMasksHit(masks, authoringPoint, pivots, joints = {}, threshold = ALPHA_THRESHOLD) {
  let alpha = 0;
  for (const channel of POSE_CHANNELS) {
    const mask = masks[channel];
    if (!mask) continue;
    const point = channel === 'body' ? authoringPoint : channelPoint(authoringPoint, pivots[channel], joints[channel]);
    if (!point) continue;
    const sampled = maskAlphaAt(mask, point.x, point.y);
    alpha = sampled + alpha * (1 - sampled / 255);
    if (alpha >= threshold) return true;
  }
  return false;
}

/**
 * Front-to-back candidate order matching paint order: z-index, then DOM order.
 * Dragged entities are lifted above everything by the stylesheet.
 */
export function orderCandidates(elements) {
  return elements
    .map((element, index) => ({
      element,
      index,
      z: element.classList?.contains('is-dragging') ? Number.POSITIVE_INFINITY : (Number.parseFloat(element.style?.zIndex) || 0)
    }))
    .sort((a, b) => (b.z - a.z) || (b.index - a.index))
    .map(item => item.element);
}

/** Channel a painted element follows: nearest rig group, else its layer, else the body. */
export function elementPoseChannel(element) {
  for (let node = element; node && node.getAttribute; node = node.parentNode) {
    const id = node.getAttribute('id');
    if (id && CHANNEL_ELEMENT_IDS[id]) return CHANNEL_ELEMENT_IDS[id];
    const layer = node.getAttribute('data-layer-channel');
    if (layer) return layer;
  }
  return 'body';
}

function isInsideNonRendered(element) {
  for (let node = element.parentNode; node && node.localName; node = node.parentNode) {
    if (NON_RENDERED_CONTAINERS.has(node.localName)) return true;
  }
  return false;
}

function cssNumber(style, name, fallback = 0) {
  const value = Number.parseFloat(style?.getPropertyValue?.(name));
  return Number.isFinite(value) ? value : fallback;
}

function readJoint(style, prefix) {
  return {
    x: cssNumber(style, `${prefix}-tx`),
    y: cssNumber(style, `${prefix}-ty`),
    rotate: cssNumber(style, `${prefix}-rot`),
    scaleX: cssNumber(style, `${prefix}-scale-x`, 1),
    scaleY: cssNumber(style, `${prefix}-scale-y`, 1)
  };
}

/** Reads the positioner's live geometry, including uncommitted drag positions. */
export function readPositionerGeometry(element, visual = element.querySelector?.('.scene-entity-visual')) {
  const style = element.style;
  return {
    x: cssNumber(style, '--x'),
    y: cssNumber(style, '--y'),
    width: cssNumber(style, '--entity-width'),
    height: cssNumber(style, '--entity-height'),
    anchorX: cssNumber(style, '--anchor-x', 0.5),
    anchorY: cssNumber(style, '--anchor-y', 1),
    flip: cssNumber(visual?.style, '--flip', 1) < 0 ? -1 : 1,
    attachedTx: cssNumber(style, '--motion-attached-tx'),
    attachedTy: cssNumber(style, '--motion-attached-ty'),
    attachedRot: cssNumber(style, '--motion-attached-rot')
  };
}

// ---------------------------------------------------------------------------
// Mask construction (browser)

export function characterMaskKey(entity, getAsset = (_id) => undefined) {
  const snapshot = entity.characterSnapshot;
  // Recolors reuse masks, except iris changes can switch the baked/default face.
  const artwork = (id) => [id ?? null, id ? artworkRevision(getAsset?.(id)) : null];
  const slots = Object.entries(snapshot?.slots || {}).sort().map(([slot, item]) => [slot, artwork(item?.assetId)]);
  const face = Object.entries(snapshot?.face || {}).sort().map(([group, item]) => [group, artwork(item?.assetId)]);
  return `character:${JSON.stringify([snapshot?.kind ?? null, artwork(snapshot?.baseDollId), artwork(snapshot?.customArtId), slots, face, isDefaultFace(snapshot?.face, snapshot?.baseDollId), entity.expression, entity.expressionIntensity])}`;
}

/** Cache key for the artwork an entity is hit-tested against, or null when it has none. */
export function entityMaskKey(entity, getAsset = (_id) => undefined) {
  if (entity.kind === 'character') return characterMaskKey(entity, getAsset);
  if (entity.kind === 'bubble') return `bubble:${JSON.stringify([entity.bubbleStyle, entity.text, entity.width])}`;
  const asset = getAsset?.(entity.sourceId);
  if (isCustomAssetId(entity.sourceId)) return `custom:${entity.sourceId}:${artworkRevision(asset) ?? ''}`;
  return asset ? `prop:${asset.id}:${asset.viewBox.join(' ')}` : null;
}

/**
 * @param {{
 *   getAsset?: (id: string) => any,
 *   customArtRepo?: any,
 *   loadSvg?: (assetId: string) => Promise<any>,
 *   rasterize?: typeof rasterizeSources,
 *   rasterizeImage?: typeof rasterizeImageUrl,
 *   now?: () => number
 * }} [options]
 */
export function createStageHitTester({
  getAsset,
  customArtRepo = undefined,
  loadSvg = (assetId) => loadAssetSvg(assetId, getAsset),
  rasterize = rasterizeSources,
  rasterizeImage = rasterizeImageUrl,
  now = () => (globalThis.performance?.now?.() ?? Date.now())
} = {}) {
  /** @type {Map<string, Promise<any>>} */
  const masks = new Map();
  /** @type {WeakMap<Element, any>} */
  const descriptors = new WeakMap();
  const timings = { builds: 0, buildMs: 0, resolves: 0, resolveMs: 0, lastResolveMs: 0 };

  function cached(key, build) {
    if (!masks.has(key)) {
      if (masks.size >= MAX_MASK_ENTRIES) masks.delete(masks.keys().next().value);
      const started = now();
      const pending = build().then(value => {
        timings.builds += 1;
        timings.buildMs += now() - started;
        return value;
      }).catch(() => {
        if (masks.get(key) === pending) masks.delete(key);
        return null;
      });
      masks.set(key, pending);
    }
    return masks.get(key);
  }

  async function buildCharacterMasks(entity) {
    const svg = await createExportDollSvg(entity.characterSnapshot, entity.expression, { customArtRepo, getAsset, loadAssetSvg: loadSvg, enforceFit: false, expressionIntensity: entity.expressionIntensity });
    await inlineSvgImages(svg);
    for (const layer of svg.querySelectorAll('[data-layer-slot="face-eyes"]')) layer.setAttribute('data-layer-channel', 'eyes');
    const rect = { x: 0, y: 0, width: CHARACTER_AUTHORING_WIDTH, height: CHARACTER_AUTHORING_HEIGHT };
    const channelMasks = {};
    await Promise.all(POSE_CHANNELS.map(async (channel) => {
      const clone = /** @type {Element} */ (svg.cloneNode(true));
      let painted = 0;
      for (const element of [...clone.querySelectorAll('*')]) {
        if (!PAINTED_TAGS.has(element.localName) || isInsideNonRendered(element)) continue;
        const own = elementPoseChannel(element) === channel;
        if (!own) {
          element.remove();
        } else {
          painted += 1;
        }
      }
      if (!painted) return;
      const pixels = await rasterize([{ svg: clone }], rect, CHARACTER_AUTHORING_WIDTH, CHARACTER_AUTHORING_HEIGHT);
      const mask = createAlphaMask(pixels, rect);
      // Individually faint channels may become visible when composited together.
      if (mask.alpha.some(alpha => alpha > 0)) channelMasks[channel] = mask;
    }));
    return channelMasks;
  }

  async function buildPropMask(asset) {
    const svg = await loadSvg(asset.id);
    const [x, y, width, height] = asset.viewBox;
    const rect = { x, y, width, height };
    const density = Math.min(2, MAX_PROP_MASK_PIXELS / Math.max(asset.displayWidth || width, asset.displayHeight || height));
    const pixels = await rasterize([{ svg }], rect, (asset.displayWidth || width) * density, (asset.displayHeight || height) * density);
    return createAlphaMask(pixels, rect);
  }

  async function buildRasterMask(url) {
    // A downsampled mask keeps per-pixel accuracy at stage scale with bounded memory.
    const pixels = await rasterizeImage(url, MAX_RASTER_MASK_SIDE);
    return createAlphaMask(pixels, { x: 0, y: 0, width: pixels.width, height: pixels.height });
  }

  async function buildBubbleMask(entity) {
    const svg = createBubbleSvg(entity);
    const [x, y, width, height] = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    const rect = { x: x || 0, y: y || 0, width: width || 1, height: height || 1 };
    const pixels = await rasterize([{ svg }], rect, rect.width, rect.height);
    return createAlphaMask(pixels, rect);
  }

  /** Measures custom full-doll and custom footwear contacts before geometry is used. */
  async function measureCharacter(snapshot) {
    await measureCharacterContacts(snapshot, { customArtRepo, rasterizeImage, getAsset });
  }

  function pivotsFor(snapshot) {
    const doll = getAsset?.(snapshot?.baseDollId || DEFAULT_BASE_DOLL_ID);
    const pivots = Object.fromEntries(Object.entries(CHANNEL_PIVOTS).map(([channel, { key, fallback }]) => [channel, doll?.[key] || fallback]));
    return { ...pivots, eyes: pivots.head };
  }

  /**
   * Prepares the hit descriptor for a freshly created entity element. Resolves
   * once the element's artwork can be tested; failures fall back to the
   * visible placeholder box.
   */
  async function prepare(entity, element) {
    let descriptor = { mode: 'box', key: null };
    try {
      if (entity.kind === 'character') {
        const key = entityMaskKey(entity, getAsset);
        const channelMasks = await cached(key, () => buildCharacterMasks(entity));
        const contact = getCharacterContact(entity.characterSnapshot, getAsset);
        const customId = customFullArtId(entity.characterSnapshot);
        const unavailable = customId && contact.source !== 'measured';
        if (channelMasks && !unavailable) {
          descriptor = { mode: 'character', key, masks: channelMasks, contact,
            bodyCenterX: customId ? undefined : contact.x, pivots: pivotsFor(entity.characterSnapshot) };
        }
      } else if (entity.kind === 'bubble') {
        const key = entityMaskKey(entity, getAsset);
        const mask = await cached(key, () => buildBubbleMask(entity));
        if (mask) descriptor = { mode: 'mask', key, mask };
      } else if (isCustomAssetId(entity.sourceId)) {
        const key = entityMaskKey(entity, getAsset);
        const url = await customArtRepo?.getTrackedObjectUrl?.(entity.sourceId);
        const mask = url ? await cached(key, () => buildRasterMask(url)) : null;
        if (mask) descriptor = { mode: 'mask', key, mask };
      } else {
        const asset = getAsset?.(entity.sourceId);
        const key = entityMaskKey(entity, getAsset);
        const mask = asset ? await cached(key, () => buildPropMask(asset)) : null;
        if (mask) descriptor = { mode: 'mask', key, mask };
      }
    } catch {
      descriptor = { mode: 'box', key: null };
    }
    const visual = element.querySelector?.('.scene-entity-visual');
    if (descriptor.mode === 'box' && visual?.replaceChildren) {
      // A failed mask must never turn still-visible artwork into a clickable rectangle.
      // Make the fallback explicit and give it the same visible box as its hit target.
      visual.replaceChildren(makeAssetPlaceholder(element.getAttribute('aria-label') || 'Artwork'));
    }
    descriptor.visual = visual;
    descriptor.motionStyle = element.querySelector?.('.scene-entity-motion')?.style;
    descriptor.eyesStyle = element.querySelector?.('.doll-layer[data-slot="face-eyes"]')?.style;
    const geometry = readPositionerGeometry(element, visual);
    descriptor.selectionBox = selectionArtworkBox(descriptor, geometry);
    const marker = selectionMarkerPoint(descriptor, geometry);
    element.style?.setProperty?.('--selection-center-x', String(marker.x));
    element.style?.setProperty?.('--selection-top', String(marker.y));
    // Descriptors hold their masks directly, so cache eviction never strands a live element.
    descriptors.set(element, descriptor);
    return descriptor;
  }

  /** Whether visible artwork of `element` covers the logical stage point. */
  function hitTest(element, point, tolerance = { x: 0, y: 0 }) {
    const descriptor = descriptors.get(element);
    // Elements without prepared geometry are not yet interactive.
    if (!descriptor) return false;
    const geometry = readPositionerGeometry(element, descriptor.visual);
    if (!(geometry.width > 0) || !(geometry.height > 0)) return false;
    const local = entityLocalPoint(point, geometry);
    if (!local) return false;
    if (descriptor.mode === 'box') {
      return local.x >= 0 && local.y >= 0 && local.x <= geometry.width && local.y <= geometry.height;
    }
    if (descriptor.mode === 'mask') {
      // Most pointer positions are nowhere near most props: reject outside the painted
      // bounds (flip, attachment and letterboxing included) before sampling the mask.
      const painted = artworkStageBounds(descriptor.selectionBox, geometry);
      if (point.x < painted.left - tolerance.x || point.x > painted.right + tolerance.x
        || point.y < painted.top - tolerance.y || point.y > painted.bottom + tolerance.y) return false;
      return hitWithTolerance(point, tolerance, sample => {
        const candidate = entityLocalPoint(sample, geometry);
        const user = meetBoxToUser(candidate, geometry.width, geometry.height, descriptor.mask.rect);
        return Boolean(user) && maskHit(descriptor.mask, user.x, user.y);
      });
    }
    const motionStyle = descriptor.motionStyle;
    const root = readJoint(motionStyle, '--motion');
    const authoring = characterAuthoringPoint(local, geometry.width, descriptor.contact, root);
    if (!authoring) return false;
    const joints = Object.fromEntries(Object.entries(CHANNEL_CSS_PREFIX).map(([channel, prefix]) => [channel, readJoint(motionStyle, prefix)]));
    const eyesStyle = descriptor.eyesStyle;
    joints.eyes = { ...joints.head, scaleY: joints.head.scaleY * cssNumber(eyesStyle, '--motion-blink-scale-y', 1) };
    return hitWithTolerance(point, tolerance, sample => {
      const candidate = characterAuthoringPoint(entityLocalPoint(sample, geometry), geometry.width, descriptor.contact, root);
      return Boolean(candidate) && characterMasksHit(descriptor.masks, candidate, descriptor.pivots, joints);
    });
  }

  /**
   * Foremost entity whose visible artwork is under the client point, or null.
   * Continues through any number of transparent candidates. Exact artwork wins
   * over edge tolerance: the fringe only forgives near misses, so it can never
   * take a click from visible pixels of an entity behind.
   */
  function resolve(stageEl, clientX, clientY, cameraX = 0) {
    const started = now();
    const rect = stageContentRect(stageEl);
    const point = clientToLogical(clientX, clientY, rect, cameraX);
    const tolerance = { x: HIT_TOLERANCE_CSS_PX * 1600 / rect.width, y: HIT_TOLERANCE_CSS_PX * 900 / rect.height };
    const candidates = orderCandidates([...stageEl.querySelectorAll('#scene-entities > .scene-entity-positioner')]);
    const hit = candidates.find(element => hitTest(element, point))
      ?? candidates.find(element => hitTest(element, point, tolerance))
      ?? null;
    timings.resolves += 1;
    timings.lastResolveMs = now() - started;
    timings.resolveMs += timings.lastResolveMs;
    return hit;
  }

  /** Releases masks that no current entity uses. */
  function retain(entities) {
    const keep = new Set(entities.map(entity => entityMaskKey(entity, getAsset)));
    for (const key of [...masks.keys()]) if (!keep.has(key)) masks.delete(key);
  }

  function destroy() {
    masks.clear();
  }

  function artworkBounds(element) {
    const descriptor = descriptors.get(element);
    if (!descriptor) return null;
    const geometry = readPositionerGeometry(element, descriptor.visual);
    return artworkStageBounds(descriptor.selectionBox, geometry, descriptor.mode === 'character'
      ? geometry.width * CHARACTER_AUTHORING_HEIGHT / CHARACTER_AUTHORING_WIDTH : geometry.height);
  }

  return { prepare, measureCharacter, hitTest, resolve, retain, destroy, artworkBounds, timings, get size() { return masks.size; } };
}
