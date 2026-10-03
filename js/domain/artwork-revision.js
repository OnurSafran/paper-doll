/**
 * Artwork revisions: the one place that knows how a custom asset's content
 * identity is spelled, so caches (masks, contacts, rendered entities) can
 * invalidate when artwork changes under a stable asset ID.
 */
import { isCustomAssetId } from './vocabulary.js';

/**
 * Content identity of an asset descriptor, or null for built-ins.
 * Registry descriptors keep the digest under `metadata`; stored records keep it flat.
 */
export function artworkRevision(asset) {
  return asset?.metadata?.sha256 ?? asset?.sha256 ?? asset?.updatedAt ?? null;
}

/** Asset IDs a character snapshot draws from, in a stable order. */
function snapshotArtworkIds(snapshot) {
  return [
    snapshot?.baseDollId,
    snapshot?.customArtId,
    ...Object.values(snapshot?.slots || {}).map(item => item?.assetId),
    ...Object.values(snapshot?.face || {}).map(item => item?.assetId)
  ].filter(Boolean);
}

/**
 * `[assetId, revision]` pairs for every custom artwork an entity renders.
 * Built-in artwork never changes under an ID, so it contributes nothing.
 */
export function entityArtworkRevisions(entity, getAsset = (_id) => undefined) {
  const ids = entity?.kind === 'character'
    ? snapshotArtworkIds(entity.characterSnapshot)
    : entity?.kind === 'prop' ? [entity.sourceId] : [];
  return [...new Set(ids)]
    .filter(isCustomAssetId)
    .sort()
    .map(id => [id, artworkRevision(getAsset?.(id))]);
}
