/**
 * Unified Asset Registry
 * Single authority for resolving catalog assets (SVG), official pack assets,
 * and custom assets (PNG metadata).
 */

import {
  ASSETS,
  getAsset as getBuiltinAsset,
  getAssetPackId as getCatalogAssetPackId,
  matchesDiscoveryFilters
} from './asset-catalog.js';
import { ALL_PACKS_FILTER, CORE_PACK_ID, PACK_MANIFESTS, createPackRegistry } from '../packs/index.js';
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
        sha256: asset.sha256,
        source: 'player-created artwork'
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
      collections: Object.freeze([...(asset.collections || [])]),
      libraryVisible: asset.libraryVisible !== false,
      status: asset.status || 'available',
      metadata: Object.freeze({
        creator: 'Player',
        format: 'image/png',
        sha256: asset.sha256,
        source: 'player-created artwork'
      })
    });
  }
  return null;
}

export function createAssetRegistry(customAssets = [], options = {}) {
  const customMap = new Map();
  for (const item of customAssets) {
    const desc = customAssetToDescriptor(item);
    if (desc) customMap.set(desc.id, desc);
  }

  const packRegistry = options.packRegistry && options.availablePackIds === undefined
    ? options.packRegistry
    : createPackRegistry(options.packRegistry?.getPacks?.() || options.packManifests || PACK_MANIFESTS, {
      availablePackIds: options.availablePackIds
    });
  const configuredVisiblePackIds = Array.isArray(options.visiblePackIds)
    ? new Set([CORE_PACK_ID, ...options.visiblePackIds])
    : null;

  function officialAssetsByKind(kind, options = {}) {
    const assets = packRegistry.assetsByKind(kind, {
      ...options,
      includeHidden: Boolean(options.includeHidden || configuredVisiblePackIds)
    });
    if (options.includeHidden || !configuredVisiblePackIds) return assets;
    return assets.filter((asset) => configuredVisiblePackIds.has(asset.packId));
  }

  function getAsset(id) {
    if (!id) return undefined;
    if (customMap.has(id)) return customMap.get(id);
    const official = packRegistry.getAsset(id);
    if (official) return official;
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

  function assetsByKind(kind, {
    includeHidden = false,
    collectionId = null,
    packId = ALL_PACKS_FILTER,
    includeUnavailable = false
  } = {}) {
    const builtins = officialAssetsByKind(kind, { includeHidden, packId, includeUnavailable })
      .filter((asset) => !collectionId || asset.collections?.includes(collectionId));
    const customs = [...customMap.values()].filter((asset) =>
      asset.kind === kind && (includeHidden || (asset.libraryVisible !== false && asset.status === 'available'))
    );
    if (collectionId === 'my-art') return packId === ALL_PACKS_FILTER ? customs : [];
    const filteredCustoms = collectionId
      ? customs.filter((asset) => asset.collections?.includes(collectionId))
      : customs;
    return [...builtins, ...(packId === ALL_PACKS_FILTER ? filteredCustoms : [])];
  }

  function wearablesBySlot(slot, {
    includeHidden = false,
    packId = ALL_PACKS_FILTER,
    includeUnavailable = false
  } = {}) {
    const builtins = officialAssetsByKind('wearable', { includeHidden, packId, includeUnavailable })
      .filter((asset) => asset.slot === slot);
    const customs = [...customMap.values()].filter((asset) =>
      asset.kind === 'wearable' && asset.slot === slot &&
      (includeHidden || (asset.libraryVisible !== false && asset.status === 'available'))
    );
    return [...builtins, ...(packId === ALL_PACKS_FILTER ? customs : [])];
  }

  function getOfferedWearables(slot, baseDollId, styleFilter = 'all', packId = ALL_PACKS_FILTER) {
    const fitFamily = getAsset(baseDollId)?.fitFamily || 'teen';
    return wearablesBySlot(slot, { packId }).filter((asset) =>
      matchesDiscoveryFilters(asset, fitFamily, styleFilter, packId)
    );
  }

  function facesByGroup(group, fitFamily, packId = ALL_PACKS_FILTER) {
    return assetsByKind('face', { packId }).filter((asset) =>
      asset.faceGroup === group &&
      (!fitFamily || !asset.supportedFitFamilies || asset.supportedFitFamilies.includes(fitFamily))
    );
  }

  function customWearablesBySlot(slot, { includeHidden = false } = {}) {
    return [...customMap.values()].filter((asset) =>
      asset.kind === 'wearable' && asset.slot === slot &&
      (includeHidden || (asset.libraryVisible !== false && asset.status === 'available'))
    );
  }

  function customProps({ includeHidden = false } = {}) {
    return [...customMap.values()].filter((asset) =>
      asset.kind === 'prop' && (includeHidden || (asset.libraryVisible !== false && asset.status === 'available'))
    );
  }

  return {
    getAsset,
    assetsByKind,
    wearablesBySlot,
    getOfferedWearables,
    facesByGroup,
    customWearablesBySlot,
    customProps,
    getPack: packRegistry.getPack,
    getPackIds: packRegistry.getPackIds,
    getResourceFiles: packRegistry.getResourceFiles,
    getAssetPack: (id) => customMap.has(id) ? null : packRegistry.getAssetPack(id) || getCatalogAssetPackId(getBuiltinAsset(id)),
    isPackAvailable: packRegistry.isPackAvailable,
    isPackVisible: (id) => configuredVisiblePackIds ? configuredVisiblePackIds.has(id) : packRegistry.isPackVisible(id),
    isCustom(id) {
      return isCustomAssetId(id) || customMap.has(id);
    }
  };
}

export { ASSETS };
