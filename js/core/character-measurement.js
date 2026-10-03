/** Resolve custom contacts before any renderer consumes character geometry. */
import { computeAlphaBounds, rasterizeImageUrl } from './alpha-mask.js';
import { CHARACTER_AUTHORING_HEIGHT, CHARACTER_AUTHORING_WIDTH, customFullArtId, hasCustomArtworkBottom, recordCustomArtworkBottom } from '../domain/character-geometry.js';
import { isCustomAssetId } from '../domain/vocabulary.js';
import { artworkRevision } from '../domain/artwork-revision.js';

// The base is the lowest tenth of the visible artwork (feet and hem, not raised arms).
const BASE_BAND = 0.1;

// One in-flight measurement per artwork revision, so a replacement never joins a stale decode.
const pendingMeasurements = new Map();

/** Horizontal extent of the lowest visible band, in authoring units. */
function baseSpan(pixels, bounds) {
  const bandRows = Math.max(1, Math.round(bounds.height * BASE_BAND));
  const top = bounds.y + bounds.height - bandRows;
  const band = computeAlphaBounds({
    width: pixels.width,
    height: bandRows,
    data: pixels.data.subarray(top * pixels.width * 4, (top + bandRows) * pixels.width * 4)
  });
  if (band.empty) return null;
  return {
    left: band.x / pixels.width * CHARACTER_AUTHORING_WIDTH,
    right: (band.x + band.width) / pixels.width * CHARACTER_AUTHORING_WIDTH
  };
}

async function measureBottom(assetId, revision, customArtRepo, rasterizeImage) {
  if (hasCustomArtworkBottom(assetId, revision)) return;
  const key = `${assetId}\n${revision}`;
  if (!pendingMeasurements.has(key)) {
    const pending = (async () => {
      try {
        const url = await customArtRepo?.getTrackedObjectUrl?.(assetId);
        if (!url) return;
        const pixels = await rasterizeImage(url);
        const bounds = computeAlphaBounds(pixels);
        recordCustomArtworkBottom(
          assetId,
          bounds.empty ? null : (bounds.y + bounds.height) / pixels.height * CHARACTER_AUTHORING_HEIGHT,
          revision,
          bounds.empty ? null : baseSpan(pixels, bounds)
        );
      } catch {
        // Keep unavailable-artwork geometry; transient decode failures may retry.
      }
    })();
    pendingMeasurements.set(key, pending);
  }
  try { await pendingMeasurements.get(key); } finally { pendingMeasurements.delete(key); }
}

/**
 * `getAsset` supplies each artwork's revision; it must be the resolver the
 * caller later passes to `getCharacterContact`, or measurements will not match.
 */
export async function measureCharacterContacts(snapshot, { customArtRepo = undefined, rasterizeImage = rasterizeImageUrl, getAsset = undefined } = {}) {
  const fullId = customFullArtId(snapshot);
  const shoeId = snapshot?.slots?.shoes?.assetId;
  const revisionOf = (id) => artworkRevision(getAsset?.(id));
  await Promise.all([
    fullId ? measureBottom(fullId, revisionOf(fullId), customArtRepo, rasterizeImage) : null,
    shoeId && isCustomAssetId(shoeId) ? measureBottom(shoeId, revisionOf(shoeId), customArtRepo, rasterizeImage) : null
  ]);
}
