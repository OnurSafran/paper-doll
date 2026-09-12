/**
 * Trusted content-pack contracts and lookup helpers.
 *
 * Official manifests are bundled code. User-authored pack files are not
 * accepted here; the deferred .dollpack importer needs a separate data-only
 * validation boundary.
 */

export const PACK_MANIFEST_SCHEMA_VERSION = 1;
export const ALL_PACKS_FILTER = 'all';
export const CORE_PACK_ID = 'core';

const PACK_ID_PATTERN = /^(?:core|pack_[a-z0-9]+(?:_[a-z0-9]+)*)$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const ASSET_PATH_PATTERN = /^assets\/[A-Za-z0-9._/-]+$/;
const ASSET_KINDS = new Set(['doll', 'face', 'wearable', 'background', 'prop']);

export function getVisiblePackManifests(manifests = [], hiddenPackIds = []) {
  const hidden = new Set(Array.isArray(hiddenPackIds) ? hiddenPackIds : []);
  return manifests.filter((manifest) => manifest?.id === CORE_PACK_ID || !hidden.has(manifest?.id));
}

export function isPackId(value) {
  return typeof value === 'string' && PACK_ID_PATTERN.test(value);
}

export function isPackVersion(value) {
  return typeof value === 'string' && VERSION_PATTERN.test(value);
}

export function getAssetPackId(asset) {
  if (!asset || typeof asset !== 'object') return null;
  return asset.packId || asset.metadata?.dlc || null;
}

export function collectReferencedPackRequirements(state, getAsset) {
  const requirements = new Map();
  const assetIds = [];
  const addDraft = (draft) => {
    if (!draft || typeof draft !== 'object') return;
    if (draft.baseDollId) assetIds.push(draft.baseDollId);
    for (const item of Object.values(draft.slots || {})) if (item?.assetId) assetIds.push(item.assetId);
    for (const item of Object.values(draft.face || {})) if (item?.assetId) assetIds.push(item.assetId);
  };
  const addScene = (scene) => {
    if (!scene || typeof scene !== 'object') return;
    if (scene.backgroundId) assetIds.push(scene.backgroundId);
    for (const entity of scene.entities || []) {
      if (entity.sourceId) assetIds.push(entity.sourceId);
      addDraft(entity.characterSnapshot);
    }
  };
  addDraft(state?.designer?.draft);
  for (const preset of state?.presets || []) addDraft(preset);
  for (const scene of state?.scenes || []) addScene(scene);
  addScene(state?.currentScene);
  for (const assetId of assetIds) {
    const asset = getAsset?.(assetId);
    const packId = getAssetPackId(asset);
    if (!packId || packId === CORE_PACK_ID || requirements.has(packId)) continue;
    requirements.set(packId, {
      id: packId,
      ...(isPackVersion(asset.packVersion) ? { version: asset.packVersion } : {})
    });
  }
  return [...requirements.values()];
}

export function validatePackManifest(manifest, { knownPackIds = [] } = {}) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { valid: false, errors: ['manifest must be an object'] };
  }

  if (!isPackId(manifest.id)) errors.push('id must be a stable pack ID');
  if (!isPackVersion(manifest.version)) errors.push('version must be a semantic version');
  if (manifest.schemaVersion !== PACK_MANIFEST_SCHEMA_VERSION) errors.push('schemaVersion must be ' + PACK_MANIFEST_SCHEMA_VERSION);
  if (!isPackVersion(manifest.minAppVersion)) errors.push('minAppVersion must be a semantic version');
  if (!isNonEmptyString(manifest.nameKey)) errors.push('nameKey is required');
  if (!isNonEmptyString(manifest.descriptionKey)) errors.push('descriptionKey is required');
  if (!isSafeAssetPath(manifest.coverPath)) errors.push('coverPath must be a safe assets path');

  const assets = Array.isArray(manifest.assets) ? manifest.assets : null;
  if (!assets) {
    errors.push('assets must be an array');
  } else {
    const assetIds = new Set();
    for (const asset of assets) {
      if (!asset || typeof asset !== 'object') {
        errors.push('assets must contain descriptor objects');
        continue;
      }
      if (!isValidAssetId(asset.id)) errors.push('asset ' + String(asset.id) + ' has an invalid ID');
      if (assetIds.has(asset.id)) errors.push('asset ' + asset.id + ' is duplicated within the pack');
      assetIds.add(asset.id);
      if (!ASSET_KINDS.has(asset.kind)) errors.push('asset ' + asset.id + ' has an invalid kind');
      if (!isSafeAssetPath(asset.path)) errors.push('asset ' + asset.id + ' has an unsafe path');
      if (!validViewBox(asset.viewBox)) errors.push('asset ' + asset.id + ' must declare a four-number viewBox');
      if (asset.metadata?.dlc !== manifest.id) errors.push('asset ' + asset.id + ' must declare metadata.dlc=' + manifest.id);
    }
  }

  const dependencies = Array.isArray(manifest.dependencies) ? manifest.dependencies : [];
  if (!Array.isArray(manifest.dependencies) && manifest.dependencies !== undefined) errors.push('dependencies must be an array');
  for (const dependency of dependencies) {
    const id = typeof dependency === 'string' ? dependency : dependency?.id;
    const version = typeof dependency === 'string' ? null : dependency?.version;
    if (!isPackId(id)) errors.push('dependency IDs must be valid pack IDs');
    if (id === manifest.id) errors.push('a pack cannot depend on itself');
    if (knownPackIds.length && !knownPackIds.includes(id)) errors.push('dependency ' + id + ' is not registered');
    if (version !== null && !isPackVersion(version)) errors.push('dependency ' + id + ' has an invalid version');
  }

  validateChapters(manifest, errors);
  validateLocales(manifest, errors);
  validateFiles(manifest, errors);

  return { valid: errors.length === 0, errors };
}

/** @param {ReadonlyArray<Object>} [manifests] */
export function createPackRegistry(manifests = [], {
  availablePackIds = undefined,
  visiblePackIds = undefined
} = {}) {
  if (!Array.isArray(manifests)) throw new TypeError('Pack manifests must be an array.');

  const packIds = manifests.map((manifest) => manifest?.id).filter(Boolean);
  const rawErrors = manifests.flatMap((manifest) => validatePackManifest(manifest, { knownPackIds: packIds }).errors);
  if (rawErrors.length) throw new Error('Invalid content-pack registry:\n- ' + rawErrors.join('\n- '));
  const normalizedManifests = manifests.map((manifest) => normalizePackManifest(manifest));
  const manifestErrors = [];
  const assetIds = new Set();
  const assetMap = new Map();
  const packMap = new Map();
  const localeOwners = new Map();

  for (const manifest of normalizedManifests) {
    if (packMap.has(manifest.id)) manifestErrors.push('duplicate pack ID ' + manifest.id);
    packMap.set(manifest.id, manifest);
    const result = validatePackManifest(manifest, { knownPackIds: packIds });
    for (const error of result.errors) manifestErrors.push(manifest.id + ': ' + error);
    for (const [language, dictionary] of Object.entries(manifest.locales || {})) {
      for (const key of flattenKeys(dictionary)) {
        const ownerKey = language + ':' + key;
        const owner = localeOwners.get(ownerKey);
        if (owner && owner !== manifest.id) manifestErrors.push('locale key ' + ownerKey + ' is shared by ' + owner + ' and ' + manifest.id);
        localeOwners.set(ownerKey, manifest.id);
      }
    }
    for (const asset of manifest.assets) {
      if (assetIds.has(asset.id)) manifestErrors.push('duplicate asset ID ' + asset.id);
      assetIds.add(asset.id);
      assetMap.set(asset.id, asset);
    }
  }
  manifestErrors.push(...validatePackContent(normalizedManifests, assetMap));
  manifestErrors.push(...validateDependencyGraph(normalizedManifests, packMap));
  if (manifestErrors.length) throw new Error('Invalid content-pack registry:\n- ' + manifestErrors.join('\n- '));

  const allPackIds = new Set(normalizedManifests.map((manifest) => manifest.id));
  const installed = normalizePackSelection(availablePackIds, allPackIds);
  const visible = normalizePackSelection(visiblePackIds, installed);
  if (allPackIds.has(CORE_PACK_ID)) {
    installed.add(CORE_PACK_ID);
    visible.add(CORE_PACK_ID);
  }

  function getPack(id) {
    return packMap.get(id);
  }

  function getAsset(id, { includeUnavailable = true } = {}) {
    const asset = assetMap.get(id);
    if (!asset) return undefined;
    if (installed.has(asset.packId)) return asset;
    if (!includeUnavailable) return undefined;
    return missingPackAsset(asset);
  }

  function assetsByKind(kind, {
    packId = ALL_PACKS_FILTER,
    includeHidden = false,
    includeUnavailable = false
  } = {}) {
    return normalizedManifests.flatMap((manifest) => {
      if (packId !== ALL_PACKS_FILTER && manifest.id !== packId) return [];
      const packIsAvailable = installed.has(manifest.id);
      if (!packIsAvailable && !includeUnavailable) return [];
      if (!includeHidden && !visible.has(manifest.id) && !(includeUnavailable && !packIsAvailable)) return [];
      return manifest.assets.filter((asset) => asset.kind === kind).map((asset) =>
        packIsAvailable ? asset : missingPackAsset(asset)
      );
    });
  }

  function getResourceFiles(selectedPackIds = undefined) {
    const selection = normalizePackSelection(selectedPackIds, installed);
    const files = new Set();
    for (const manifest of normalizedManifests) {
      if (!selection.has(manifest.id)) continue;
      files.add(manifest.coverPath);
      for (const asset of manifest.assets) files.add(asset.path);
      for (const file of manifest.files || []) files.add(file);
    }
    return [...files].sort();
  }

  return Object.freeze({
    getAsset,
    getAssetPack: (assetId) => assetMap.get(assetId)?.packId || null,
    getPack,
    getPacks: () => normalizedManifests,
    getPackIds: () => [...allPackIds],
    getResourceFiles,
    assetsByKind,
    isPackAvailable: (id) => installed.has(id),
    isPackVisible: (id) => visible.has(id)
  });
}

function normalizePackManifest(manifest) {
  const packId = manifest?.id;
  const version = manifest?.version;
  const assets = Array.isArray(manifest?.assets) ? manifest.assets.map((asset) => normalizeAsset(asset, packId, version)) : [];
  return Object.freeze({
    ...(manifest || {}),
    assets: Object.freeze(assets),
    dependencies: Object.freeze(Array.isArray(manifest?.dependencies) ? manifest.dependencies.map((dependency) =>
      typeof dependency === 'string' ? dependency : Object.freeze({ ...dependency })
    ) : []),
    chapters: Object.freeze(Array.isArray(manifest?.chapters) ? manifest.chapters.map((chapter) => Object.freeze({
      ...chapter,
      assetIds: Object.freeze(Array.isArray(chapter.assetIds) ? [...chapter.assetIds] : [])
    })) : []),
    files: Object.freeze(Array.isArray(manifest?.files) ? [...manifest.files] : [])
  });
}

function normalizeAsset(asset, packId, packVersion) {
  const metadata = Object.freeze({ ...(asset?.metadata || {}), dlc: packId });
  return Object.freeze({
    ...(asset || {}),
    packId,
    packVersion,
    metadata,
    ...(Array.isArray(asset?.requiredGroups) ? { requiredGroups: Object.freeze([...asset.requiredGroups]) } : {}),
    ...(Array.isArray(asset?.supportedFitFamilies) ? { supportedFitFamilies: Object.freeze([...asset.supportedFitFamilies]) } : {}),
    ...(Array.isArray(asset?.presentationStyles) ? { presentationStyles: Object.freeze([...asset.presentationStyles]) } : {}),
    ...(Array.isArray(asset?.lifeStages) ? { lifeStages: Object.freeze([...asset.lifeStages]) } : {}),
    ...(Array.isArray(asset?.collections) ? { collections: Object.freeze([...asset.collections]) } : {}),
    ...(Array.isArray(asset?.viewBox) ? { viewBox: Object.freeze([...asset.viewBox]) } : {})
  });
}

function missingPackAsset(asset) {
  return Object.freeze({ ...asset, status: 'missing', libraryVisible: false });
}

function normalizePackSelection(selection, fallback) {
  if (!Array.isArray(selection)) return new Set(fallback);
  return new Set(selection.filter((id) => fallback.has(id)));
}

function validateChapters(manifest, errors) {
  if (manifest.chapters === undefined) return;
  if (!Array.isArray(manifest.chapters)) {
    errors.push('chapters must be an array');
    return;
  }
  const assetIds = new Set((Array.isArray(manifest.assets) ? manifest.assets : []).map((asset) => asset?.id));
  const chapterIds = new Set();
  for (const chapter of manifest.chapters) {
    if (!chapter || typeof chapter !== 'object' || !isNonEmptyString(chapter.id)) {
      errors.push('chapters must contain objects with IDs');
      continue;
    }
    if (chapterIds.has(chapter.id)) errors.push('chapter ' + chapter.id + ' is duplicated');
    chapterIds.add(chapter.id);
    if (!isNonEmptyString(chapter.nameKey)) errors.push('chapter ' + chapter.id + ' needs a nameKey');
    if (!Array.isArray(chapter.assetIds)) errors.push('chapter ' + chapter.id + ' needs an assetIds array');
    for (const assetId of Array.isArray(chapter.assetIds) ? chapter.assetIds : []) {
      if (!assetIds.has(assetId)) errors.push('chapter ' + chapter.id + ' references asset ' + assetId + ' outside the pack');
    }
  }
}

function validateLocales(manifest, errors) {
  if (manifest.locales === undefined) return;
  if (!manifest.locales || typeof manifest.locales !== 'object' || Array.isArray(manifest.locales)) {
    errors.push('locales must be an object');
    return;
  }
  const languages = Object.keys(manifest.locales);
  if (!languages.includes('tr') || !languages.includes('en')) errors.push('locales must contain tr and en dictionaries');
  const flattened = new Map();
  for (const language of languages) {
    const keys = flattenKeys(manifest.locales[language]);
    flattened.set(language, keys);
    for (const key of keys) {
      const validNamespace = key.startsWith(manifest.id + '.') || key.startsWith('packs.' + manifest.id + '.');
      if (!validNamespace) errors.push('locale key ' + key + ' must be namespaced to ' + manifest.id);
    }
  }
  const trKeys = flattened.get('tr') || [];
  const enKeys = flattened.get('en') || [];
  for (const key of trKeys) if (!enKeys.includes(key)) errors.push('locale key ' + key + ' is missing in en');
  for (const key of enKeys) if (!trKeys.includes(key)) errors.push('locale key ' + key + ' is missing in tr');
}

function validateFiles(manifest, errors) {
  if (manifest.files === undefined) return;
  if (!Array.isArray(manifest.files)) {
    errors.push('files must be an array');
    return;
  }
  const files = new Set();
  for (const file of manifest.files) {
    if (!isSafeAssetPath(file)) errors.push('resource file ' + String(file) + ' has an unsafe path');
    if (files.has(file)) errors.push('resource file ' + file + ' is duplicated');
    files.add(file);
  }
  if (manifest.totalBytes !== undefined && (!Number.isInteger(manifest.totalBytes) || manifest.totalBytes < 0)) {
    errors.push('totalBytes must be a non-negative integer');
  }
}

function validateDependencyGraph(manifests, packMap) {
  const errors = [];
  const visiting = new Set();
  const visited = new Set();
  function visit(id, path = []) {
    if (visiting.has(id)) {
      errors.push('dependency cycle: ' + [...path, id].join(' -> '));
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    const manifest = packMap.get(id);
    for (const dependency of manifest?.dependencies || []) {
      const dependencyId = typeof dependency === 'string' ? dependency : dependency?.id;
      if (packMap.has(dependencyId)) visit(dependencyId, [...path, id]);
    }
    visiting.delete(id);
    visited.add(id);
  }
  for (const manifest of manifests) visit(manifest.id);
  return errors;
}

function validatePackContent(manifests, assetMap) {
  const errors = [];
  const templateIds = new Set();
  const outfitIds = new Set();
  for (const manifest of manifests) {
    const validateDraft = (draft) => {
      const doll = assetMap.get(draft?.baseDollId);
      if (doll?.kind !== 'doll') errors.push(manifest.id + ': outfit needs a registered doll');
      for (const [slot, item] of Object.entries(draft?.slots || {})) {
        if (!item) continue;
        const asset = assetMap.get(item.assetId);
        if (asset?.kind !== 'wearable' || asset.slot !== slot || !asset.supportedFitFamilies?.includes(doll?.fitFamily)) errors.push(manifest.id + ': incompatible outfit item ' + item.assetId);
        if (asset && asset.packId !== 'core' && asset.packId !== manifest.id) errors.push(manifest.id + ': outfit requires another expansion');
      }
    };
    if (manifest.outfits !== undefined && !Array.isArray(manifest.outfits)) errors.push(manifest.id + ': outfits must be an array');
    for (const outfit of Array.isArray(manifest.outfits) ? manifest.outfits : []) {
      if (!isValidAssetId(outfit?.id) || outfitIds.has(outfit.id)) errors.push(manifest.id + ': invalid or duplicate outfit ID');
      outfitIds.add(outfit?.id);
      validateDraft(outfit);
    }
    if (manifest.templates !== undefined && !Array.isArray(manifest.templates)) errors.push(manifest.id + ': templates must be an array');
    for (const template of Array.isArray(manifest.templates) ? manifest.templates : []) {
      if (!isValidAssetId(template?.id) || templateIds.has(template.id)) errors.push(manifest.id + ': invalid or duplicate template ID');
      templateIds.add(template?.id);
      if (assetMap.get(template?.backgroundId)?.kind !== 'background') errors.push(manifest.id + ': template needs a registered background');
      if (!Array.isArray(template?.entities)) { errors.push(manifest.id + ': template needs entities'); continue; }
      const refs = new Set();
      for (const entity of template.entities) {
        if (!entity?.refId || refs.has(entity.refId)) errors.push(manifest.id + ': invalid or duplicate entity reference');
        refs.add(entity?.refId);
        if (entity?.kind === 'prop' && assetMap.get(entity.sourceId)?.kind !== 'prop') errors.push(manifest.id + ': unknown template prop ' + entity.sourceId);
        if (entity?.kind === 'character' && entity.characterSnapshot) validateDraft(entity.characterSnapshot);
      }
      for (const entity of template.entities) if (entity?.attachedToRef && !refs.has(entity.attachedToRef)) errors.push(manifest.id + ': dangling template attachment');
    }
  }
  return errors;
}

function isValidAssetId(value) {
  return typeof value === 'string' && /^[a-z][a-z0-9_]{1,99}$/.test(value);
}

function isSafeAssetPath(value) {
  return typeof value === 'string' && ASSET_PATH_PATTERN.test(value) && !value.includes('..');
}

function validViewBox(value) {
  return Array.isArray(value) && value.length === 4 && value.every((item) => Number.isFinite(item)) && value[2] > 0 && value[3] > 0;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function flattenKeys(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return prefix ? [prefix] : [];
  return Object.entries(value).flatMap(([key, child]) => flattenKeys(child, prefix ? prefix + '.' + key : key));
}
