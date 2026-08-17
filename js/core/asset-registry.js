/**
 * Unified Asset Registry
 * Single authority for resolving catalog assets (SVG) and custom assets (PNG metadata).
 */

import { ASSETS, getAsset as getBuiltinAsset } from './asset-catalog.js';
import { isCustomAssetId } from '../domain/vocabulary.js';

export function customAssetToDescriptor(asset) {
  if (!asset || typeof asset !== 'object') return null;
  if (asset.kind === 'wearable') {
    return Object.freeze({
      id: asset.assetId,
      kind: 'wearable',
      slot: asset.slot,
      name: asset.name,
      custom: true,
      format: 'image/png',
      logicalWidth: asset.logicalWidth || 300,
      logicalHeight: asset.logicalHeight || 450,
      pixelWidth: asset.pixelWidth || 600,
      pixelHeight: asset.pixelHeight || 900,
      viewBox: [0, 0, 300, 450],
      tintable: false,
      defaultColors: Object.freeze({ primary: 'coral' }),
      ...(asset.supportedFitFamilies?.length ? { supportedFitFamilies: Object.freeze([...asset.supportedFitFamilies]) } : {}),
      ...(asset.presentationStyles?.length ? { presentationStyles: Object.freeze([...asset.presentationStyles]) } : {}),
      libraryVisible: asset.libraryVisible !== false,
      status: asset.status || 'available',
      metadata: Object.freeze({
        creator: 'Player',
        format: 'image/png',
        sha256: asset.sha256
      })
    });
  }
  if (asset.kind === 'prop') {
    return Object.freeze({
      id: asset.assetId,
      kind: 'prop',
      name: asset.name,
      custom: true,
      format: 'image/png',
      displayWidth: asset.displayWidth || 240,
      displayHeight: asset.displayHeight || 240,
      groundAnchor: Object.freeze(asset.groundAnchor ? { ...asset.groundAnchor } : { x: 0.5, y: 1.0 }),
      viewBox: [0, 0, 1000, 1000],
      defaultScale: 1,
      libraryVisible: asset.libraryVisible !== false,
      status: asset.status || 'available',
      metadata: Object.freeze({
        creator: 'Player',
        format: 'image/png',
        sha256: asset.sha256
      })
    });
  }
  return null;
}

export function createAssetRegistry(customAssets = []) {
  const customMap = new Map();
  for (const item of customAssets) {
    const desc = customAssetToDescriptor(item);
    if (desc) customMap.set(desc.id, desc);
  }

  function getAsset(id) {
    if (!id) return undefined;
    if (customMap.has(id)) return customMap.get(id);
    const builtin = getBuiltinAsset(id);
    if (builtin) return builtin;
    if (isCustomAssetId(id)) {
      return Object.freeze({
        id,
        kind: 'wearable',
        name: 'Missing Artwork',
        custom: true,
        format: 'image/png',
        status: 'missing',
        libraryVisible: false,
        viewBox: [0, 0, 300, 450],
        logicalWidth: 300,
        logicalHeight: 450
      });
    }
    return undefined;
  }

  function assetsByKind(kind, { includeHidden = false } = {}) {
    const builtins = ASSETS.filter((a) => a.kind === kind);
    const customs = [...customMap.values()].filter((a) =>
      a.kind === kind && (includeHidden || (a.libraryVisible !== false && a.status === 'available'))
    );
    return [...builtins, ...customs];
  }

  function wearablesBySlot(slot, { includeHidden = false } = {}) {
    const builtins = ASSETS.filter((a) => a.kind === 'wearable' && a.slot === slot);
    const customs = [...customMap.values()].filter((a) =>
      a.kind === 'wearable' && a.slot === slot && (includeHidden || (a.libraryVisible !== false && a.status === 'available'))
    );
    return [...builtins, ...customs];
  }

  function customWearablesBySlot(slot, { includeHidden = false } = {}) {
    return [...customMap.values()].filter((a) =>
      a.kind === 'wearable' && a.slot === slot && (includeHidden || (a.libraryVisible !== false && a.status === 'available'))
    );
  }

  function customProps({ includeHidden = false } = {}) {
    return [...customMap.values()].filter((a) =>
      a.kind === 'prop' && (includeHidden || (a.libraryVisible !== false && a.status === 'available'))
    );
  }

  function isCustom(id) {
    return isCustomAssetId(id) || customMap.has(id);
  }

  return {
    getAsset,
    assetsByKind,
    wearablesBySlot,
    customWearablesBySlot,
    customProps,
    isCustom
  };
}
