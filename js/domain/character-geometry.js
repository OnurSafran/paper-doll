/**
 * Shared character geometry: authoring canvas, neutral ground contact,
 * selection envelope, and the artwork transform used by every renderer.
 *
 * Layers and rig pivots stay in the 300 × 450 authoring space. The stage
 * places an entity's (x, y) at the neutral foot contact and renders the full
 * canvas at one uniform scale around it, so feet meet the placement plane
 * without cropping hair, hats, or motion overflow.
 */
import { CHARACTER_DIMENSIONS, DEFAULT_BASE_DOLL_ID, isCustomAssetId } from './vocabulary.js';
import { artworkRevision } from './artwork-revision.js';

export const CHARACTER_AUTHORING_WIDTH = 300;
export const CHARACTER_AUTHORING_HEIGHT = 450;
/** Uniform authoring-to-stage scale; never derived from the envelope. */
export const CHARACTER_ARTWORK_SCALE = CHARACTER_DIMENSIONS.BASE_WIDTH / CHARACTER_AUTHORING_WIDTH;
/** Approximate classic-doll reference for dolls that lack authored contact metadata. */
export const FALLBACK_FOOT_CONTACT = Object.freeze({ x: 150, y: 410 });

// Measured bottom edges of custom raster artwork, keyed by custom asset ID.
// Each entry remembers the artwork revision it measured, so replacing artwork
// under the same ID (import, backup restore) reads as unmeasured until remeasured.
// `bottom` is null for artwork with no qualifying pixel. `span` is the horizontal
// extent (authoring units) of the lowest visible band, where the doll meets the stand.
const measuredCustomBottoms = new Map();

export function recordCustomArtworkBottom(assetId, bottomY, revision = null, span = null) {
  const validSpan = Number.isFinite(span?.left) && Number.isFinite(span?.right) && span.right > span.left
    ? { left: span.left, right: span.right }
    : null;
  measuredCustomBottoms.set(assetId, { bottom: Number.isFinite(bottomY) ? bottomY : null, revision, span: validSpan });
}

function measuredEntry(assetId, revision) {
  const entry = measuredCustomBottoms.get(assetId);
  return entry && entry.revision === revision ? entry : undefined;
}

/** The measured bottom for `revision`: a number, null (empty artwork), or undefined (not measured). */
function measuredBottom(assetId, revision) {
  return measuredEntry(assetId, revision)?.bottom;
}

export function hasCustomArtworkBottom(assetId, revision = null) {
  return measuredBottom(assetId, revision) !== undefined;
}

export function forgetCustomArtworkBottom(assetId) {
  measuredCustomBottoms.delete(assetId);
}

/** Matches the full-doll detection used by the stage, Scene Book, and export renderers. */
export function customFullArtId(snapshot) {
  if (!snapshot) return null;
  if (snapshot.customArtId) return snapshot.customArtId;
  if (isCustomAssetId(snapshot.baseDollId)) return snapshot.baseDollId;
  return null;
}

/**
 * Neutral standing contact in authoring coordinates: the lowest visible support
 * edge of the base doll's feet or its footwear, centered horizontally.
 */
export function getCharacterContact(snapshot, getAsset = (_id) => undefined) {
  const resolve = typeof getAsset === 'function' ? getAsset : () => undefined;
  const customId = customFullArtId(snapshot);
  if (customId) {
    const bottom = measuredBottom(customId, artworkRevision(resolve(customId)));
    if (Number.isFinite(bottom)) return { x: CHARACTER_AUTHORING_WIDTH / 2, y: bottom, source: 'measured' };
    // Unmeasured or empty artwork keeps the canvas bottom until it is known.
    return { x: CHARACTER_AUTHORING_WIDTH / 2, y: CHARACTER_AUTHORING_HEIGHT, source: 'unavailable' };
  }
  const doll = resolve(snapshot?.baseDollId || DEFAULT_BASE_DOLL_ID);
  const authored = doll?.footContact;
  let x = Number.isFinite(authored?.x) ? authored.x : FALLBACK_FOOT_CONTACT.x;
  let y = Number.isFinite(authored?.y) ? authored.y : FALLBACK_FOOT_CONTACT.y;
  const shoeId = snapshot?.slots?.shoes?.assetId;
  if (shoeId) {
    const sole = isCustomAssetId(shoeId) ? measuredBottom(shoeId, artworkRevision(resolve(shoeId))) : resolve(shoeId)?.soleContactY;
    if (Number.isFinite(sole) && sole > y) y = sole;
  }
  return { x, y: Math.min(CHARACTER_AUTHORING_HEIGHT, y), source: authored ? 'authored' : 'fallback' };
}

/** Selection envelope in authoring units: full width, top of canvas, ending at the contact. */
export function getCharacterEnvelope(snapshot, getAsset) {
  const contact = getCharacterContact(snapshot, getAsset);
  return { x: 0, y: 0, width: CHARACTER_AUTHORING_WIDTH, height: contact.y, contact };
}

/** Stage-unit bounds for a character entity at the given scale. */
export function getCharacterStageBounds(snapshot, scale, getAsset) {
  const { width, height, contact } = getCharacterEnvelope(snapshot, getAsset);
  const s = CHARACTER_ARTWORK_SCALE * scale;
  return {
    width: width * s,
    height: height * s,
    anchorX: contact.x / width,
    anchorY: 1,
    contactX: contact.x,
    contactY: contact.y
  };
}

/**
 * Entity-local transform (before entity scale and flip) that draws the 300 × 450
 * authoring canvas so its contact lands on the origin. Root motion pivots on the
 * contact, matching the stage's CSS transform-origin.
 */
export function characterArtworkTransform(contact, root = null) {
  const r = root || {};
  const parts = [];
  if (r.x || r.y) parts.push(`translate(${r.x || 0}, ${r.y || 0})`);
  if (r.rotate) parts.push(`rotate(${r.rotate})`);
  const sx = r.scaleX ?? 1;
  const sy = r.scaleY ?? 1;
  parts.push(`scale(${CHARACTER_ARTWORK_SCALE * sx}, ${CHARACTER_ARTWORK_SCALE * sy})`);
  parts.push(`translate(${-contact.x}, ${-contact.y})`);
  return parts.join(' ');
}

/** CSS custom properties the stage needs to place the canvas around the contact. */
export function characterCanvasStyle(contact) {
  return {
    '--contact-x-pct': `${(contact.x / CHARACTER_AUTHORING_WIDTH * 100).toFixed(4)}%`,
    '--contact-y-pct': `${(contact.y / CHARACTER_AUTHORING_HEIGHT * 100).toFixed(4)}%`,
    '--canvas-height-ratio': String(CHARACTER_AUTHORING_HEIGHT / contact.y)
  };
}

const STAND_PADDING = 12;
const STAND_MIN_WIDTH = 60;

/**
 * Horizontal extent (authoring units) of the folded stand under a custom full
 * painting, from its measured base. Null when unmeasured; shipped dolls keep the
 * stylesheet's default stand.
 */
export function getCharacterStandSpan(snapshot, getAsset = (_id) => undefined) {
  const customId = customFullArtId(snapshot);
  if (!customId) return null;
  const resolve = typeof getAsset === 'function' ? getAsset : () => undefined;
  const span = measuredEntry(customId, artworkRevision(resolve(customId)))?.span;
  if (!span) return null;
  const width = Math.min(CHARACTER_AUTHORING_WIDTH, Math.max(STAND_MIN_WIDTH, span.right - span.left + STAND_PADDING * 2));
  const left = Math.min(CHARACTER_AUTHORING_WIDTH - width, Math.max(0, (span.left + span.right) / 2 - width / 2));
  return { left, width };
}

/** Stand custom properties; empty values clear a previous doll's span so the CSS default applies. */
export function characterStandStyle(snapshot, getAsset) {
  const span = getCharacterStandSpan(snapshot, getAsset);
  return {
    '--stand-left-pct': span ? `${(span.left / CHARACTER_AUTHORING_WIDTH * 100).toFixed(4)}%` : '',
    '--stand-width-pct': span ? `${(span.width / CHARACTER_AUTHORING_WIDTH * 100).toFixed(4)}%` : ''
  };
}
