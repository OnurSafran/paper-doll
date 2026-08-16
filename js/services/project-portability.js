/**
 * Project Portability Service
 * Single authority for project package JSON export, validate-before-mutate import,
 * base64 custom artwork validation, collision rewriting for Merge, and recoverable backup snapshots.
 */

import {
  clonePreset,
  cloneScene,
  persistedProjection,
  sanitizeCustomAsset,
  sanitizeEnvelope,
  SCHEMA_VERSION,
  STORAGE_KEY
} from '../core/state-schema.js';
import {
  base64ToUint8Array,
  blobToUint8Array,
  computeSha256,
  parsePngHeader,
  uint8ArrayToBase64
} from './custom-art-repository.js';
import {
  CUSTOM_ID_PREFIX,
  defaultMakeId,
  defaultNow,
  isCustomAssetId,
  isValidId,
  LIMITS
} from '../domain/vocabulary.js';

export const PACKAGE_FORMAT = 'paper-doll-project';
export const PACKAGE_FORMAT_VERSION = 1;
export const BACKUP_KEY_LATEST = 'paperDollStudio.backup.latest';

function isStrictBase64(value) {
  return typeof value === 'string' && value.length > 0 && value.length % 4 === 0 &&
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

/**
 * Formats a portable export filename with date stamp.
 */
export function formatProjectExportFilename(now = () => new Date()) {
  const d = now();
  const dateStr = d.toISOString().slice(0, 10);
  return `paper-doll-project-${dateStr}.json`;
}

/**
 * Serializes the studio state and optional custom artwork records into package format v1 JSON.
 */
export function serializeProjectPackage(state, customArtwork = [], now = () => new Date()) {
  const envelope = persistedProjection(state, now);
  const pkg = {
    format: PACKAGE_FORMAT,
    formatVersion: PACKAGE_FORMAT_VERSION,
    exportedAt: now().toISOString(),
    state: envelope,
    customArtwork: (customArtwork || []).map((item) => ({
      metadata: { ...item.metadata },
      encoding: 'base64',
      data: typeof item.data === 'string' ? item.data : uint8ArrayToBase64(item.bytes || new Uint8Array(0))
    }))
  };
  return JSON.stringify(pkg, null, 2);
}

/**
 * Synchronous export serialization (creates package format v1).
 */
export const serializeProjectExport = serializeProjectPackage;

/**
 * Asynchronously gathers referenced custom artwork blobs from the repository and serializes a full project package.
 */
export async function exportProjectPackage(state, customArtRepo = null, now = () => new Date()) {
  const customArtwork = [];
  const referencedCustomIds = new Set();

  for (const asset of state.customAssets || []) {
    if (asset.libraryVisible !== false && asset.status === 'available') {
      referencedCustomIds.add(asset.assetId);
    }
  }
  for (const preset of state.presets || []) {
    for (const slot of Object.values(preset.slots || {})) {
      if (slot?.assetId && isCustomAssetId(slot.assetId)) referencedCustomIds.add(slot.assetId);
    }
  }
  for (const scene of state.scenes || []) {
    for (const entity of scene.entities || []) {
      if (entity.kind === 'prop' && isCustomAssetId(entity.sourceId)) referencedCustomIds.add(entity.sourceId);
      if (entity.kind === 'character') {
        for (const slot of Object.values(entity.characterSnapshot?.slots || {})) {
          if (slot?.assetId && isCustomAssetId(slot.assetId)) referencedCustomIds.add(slot.assetId);
        }
      }
    }
  }
  if (state.currentScene) {
    for (const entity of state.currentScene.entities || []) {
      if (entity.kind === 'prop' && isCustomAssetId(entity.sourceId)) referencedCustomIds.add(entity.sourceId);
      if (entity.kind === 'character') {
        for (const slot of Object.values(entity.characterSnapshot?.slots || {})) {
          if (slot?.assetId && isCustomAssetId(slot.assetId)) referencedCustomIds.add(slot.assetId);
        }
      }
    }
  }

  if (!customArtRepo || typeof customArtRepo.getArtwork !== 'function') {
    if (referencedCustomIds.size) throw new Error('Custom artwork storage is unavailable.');
  } else {
    for (const assetId of referencedCustomIds) {
      const meta = (state.customAssets || []).find((a) => a.assetId === assetId);
      const artRecord = await customArtRepo.getArtwork(assetId);
      if (!meta || !artRecord?.blob) {
        throw new Error(`Custom artwork "${meta?.name ?? assetId}" is missing and cannot be exported.`);
      }
      const bytes = await blobToUint8Array(artRecord.blob);
      const parsed = parsePngHeader(bytes);
      const digest = await computeSha256(bytes);
      if (!parsed.ok || bytes.byteLength !== meta.byteLength ||
        parsed.width !== meta.pixelWidth || parsed.height !== meta.pixelHeight ||
        digest !== meta.sha256 || digest !== artRecord.sha256) {
        throw new Error(`Custom artwork "${meta.name}" is corrupt and cannot be exported.`);
      }
      customArtwork.push({
        metadata: { ...meta, byteLength: bytes.byteLength, pixelWidth: parsed.width, pixelHeight: parsed.height, sha256: digest },
        data: uint8ArrayToBase64(bytes)
      });
    }
  }

  return serializeProjectPackage(state, customArtwork, now);
}

/**
 * Validates an incoming JSON string or object payload before mutating any domain state.
 * Supports outer package format v1 (`format: "paper-doll-project"`).
 */
export async function validateImportPayload(
  rawInput,
  getAsset = () => undefined,
  { maxBytes = LIMITS.MAX_PACKAGE_BYTES, cryptoInstance = globalThis.crypto } = {}
) {
  const warnings = [];
  if (!rawInput) {
    return { ok: false, error: 'No file content provided.', warnings: ['Empty payload.'] };
  }

  let inputBytes = null;
  if (typeof rawInput === 'string') {
    inputBytes = new TextEncoder().encode(rawInput).byteLength;
  } else if (typeof rawInput === 'object' && rawInput !== null) {
    try {
      inputBytes = new TextEncoder().encode(JSON.stringify(rawInput)).byteLength;
    } catch {
      return { ok: false, error: 'Invalid project payload format.', warnings: ['Payload could not be serialized.'] };
    }
  }
  if (inputBytes > maxBytes) {
    return { ok: false, error: 'Project file exceeds the maximum allowed size (45MB).', warnings: ['Payload exceeded size limit.'] };
  }

  let parsed;
  if (typeof rawInput === 'string') {
    try {
      parsed = JSON.parse(rawInput);
    } catch (err) {
      return { ok: false, error: 'Invalid JSON file. Could not parse file content.', warnings: ['JSON syntax error: ' + err.message] };
    }
  } else if (typeof rawInput === 'object' && rawInput !== null) {
    parsed = rawInput;
  } else {
    return { ok: false, error: 'Invalid project payload format.', warnings: ['Expected a JSON object.'] };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'The file does not contain a valid Paper Doll project object.', warnings: ['Root must be an object.'] };
  }

  let rawState = parsed;
  let rawCustomArtwork = [];
  let isPackage = false;

  if (parsed.format === PACKAGE_FORMAT) {
    isPackage = true;
    if (parsed.formatVersion !== PACKAGE_FORMAT_VERSION) {
      return { ok: false, error: `Unsupported project package format version ${String(parsed.formatVersion)}.`, warnings: ['Package version mismatch.'] };
    }
    rawState = parsed.state;
    rawCustomArtwork = Array.isArray(parsed.customArtwork) ? parsed.customArtwork : [];
  }

  if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) {
    return { ok: false, error: 'The package does not contain a valid state envelope.', warnings: ['Missing state object.'] };
  }

  // Pre-extract custom assets to feed the getAsset resolver
  const incomingCustomMeta = new Map();
  if (Array.isArray(rawState.customAssets)) {
    for (const c of rawState.customAssets) {
      const sanitized = sanitizeCustomAsset(c);
      if (sanitized) incomingCustomMeta.set(sanitized.assetId, sanitized);
    }
  }

  const assetResolver = (id) => incomingCustomMeta.get(id) || getAsset(id);
  const result = sanitizeEnvelope(rawState, assetResolver);
  if (!result.envelope) {
    return { ok: false, error: 'The file content could not be read as a valid project.', warnings: result.warnings };
  }

  const envelope = result.envelope;

  // Validate custom artwork items in package
  const validatedArtwork = [];
  let totalArtworkBytes = 0;
  const expectedCustomAssets = new Map((envelope.customAssets || []).map((asset) => [asset.assetId, asset]));
  const expectedCustomIds = new Set();
  for (const asset of envelope.customAssets || []) {
    if (asset.status === 'available' && asset.libraryVisible !== false) expectedCustomIds.add(asset.assetId);
  }
  for (const preset of envelope.presets || []) {
    for (const slot of Object.values(preset.slots || {})) {
      if (slot?.assetId && isCustomAssetId(slot.assetId)) expectedCustomIds.add(slot.assetId);
    }
  }
  for (const scene of [...(envelope.scenes || []), ...(envelope.currentScene ? [envelope.currentScene] : [])]) {
    for (const entity of scene.entities || []) {
      if (entity.kind === 'prop' && isCustomAssetId(entity.sourceId)) expectedCustomIds.add(entity.sourceId);
      for (const slot of Object.values(entity.characterSnapshot?.slots || {})) {
        if (slot?.assetId && isCustomAssetId(slot.assetId)) expectedCustomIds.add(slot.assetId);
      }
    }
  }
  const seenArtworkIds = new Set();

  for (const item of rawCustomArtwork) {
    if (!item || typeof item !== 'object' || !item.metadata || typeof item.data !== 'string') {
      return { ok: false, error: 'A custom artwork entry had invalid structure.', warnings: ['Artwork structure validation failed.'] };
    }
    if (item.encoding !== 'base64') {
      return { ok: false, error: 'A custom artwork entry used an unsupported encoding.', warnings: ['Only Base64 PNG artwork is accepted.'] };
    }
    const meta = sanitizeCustomAsset(item.metadata);
    const expected = meta && expectedCustomAssets.get(meta.assetId);
    if (!meta || !expected || seenArtworkIds.has(meta.assetId)) {
      return { ok: false, error: 'A custom artwork entry had invalid or duplicate metadata.', warnings: ['Artwork metadata validation failed.'] };
    }
    const metadataMatches = meta.kind === expected.kind && meta.slot === expected.slot &&
      meta.name === expected.name &&
      meta.logicalWidth === expected.logicalWidth && meta.logicalHeight === expected.logicalHeight &&
      meta.pixelWidth === expected.pixelWidth && meta.pixelHeight === expected.pixelHeight &&
      meta.byteLength === expected.byteLength && meta.sha256 === expected.sha256 &&
      (meta.displayWidth ?? null) === (expected.displayWidth ?? null) &&
      (meta.displayHeight ?? null) === (expected.displayHeight ?? null) &&
      (!expected.groundAnchor || (meta.groundAnchor?.x === expected.groundAnchor.x && meta.groundAnchor?.y === expected.groundAnchor.y));
    if (!metadataMatches) {
      return { ok: false, error: `Custom artwork "${expected.name}" did not match its metadata.`, warnings: ['Artwork metadata and state differ.'] };
    }
    seenArtworkIds.add(meta.assetId);

    if (!isStrictBase64(item.data)) {
      return { ok: false, error: `Custom artwork "${meta.name}" contained invalid Base64 data.`, warnings: ['Base64 validation failed.'] };
    }

    let bytes;
    try {
      bytes = base64ToUint8Array(item.data);
    } catch {
      return { ok: false, error: `Custom artwork "${meta.name}" contained invalid Base64 data.`, warnings: ['Base64 validation failed.'] };
    }

    if (bytes.byteLength > LIMITS.MAX_CUSTOM_ASSET_BYTES) {
      return { ok: false, error: `Custom artwork "${meta.name}" exceeded maximum allowed size (2MB).`, warnings: ['Artwork byte limit exceeded.'] };
    }
    totalArtworkBytes += bytes.byteLength;
    if (totalArtworkBytes > LIMITS.MAX_TOTAL_CUSTOM_BYTES) {
      return { ok: false, error: 'The package exceeds the total custom artwork byte limit.', warnings: ['Total artwork byte limit exceeded.'] };
    }

    const pngInfo = parsePngHeader(bytes);
    if (!pngInfo.ok) {
      return { ok: false, error: `Custom artwork "${meta.name}" is not a valid PNG image.`, warnings: ['PNG validation failed.'] };
    }

    const sha256 = await computeSha256(bytes, cryptoInstance);
    if (expected.byteLength !== bytes.byteLength || expected.pixelWidth !== pngInfo.width ||
      expected.pixelHeight !== pngInfo.height || expected.sha256 !== sha256) {
      return { ok: false, error: `Custom artwork "${meta.name}" did not match its metadata.`, warnings: ['Artwork metadata and bytes differ.'] };
    }

    const validRecord = {
      metadata: {
        ...expected,
        pixelWidth: pngInfo.width,
        pixelHeight: pngInfo.height,
        byteLength: bytes.byteLength,
        sha256
      },
      bytes,
      sha256
    };
    validatedArtwork.push(validRecord);
  }

  for (const assetId of expectedCustomIds) {
    if (!seenArtworkIds.has(assetId)) {
      const asset = expectedCustomAssets.get(assetId);
      return { ok: false, error: `Custom artwork "${asset?.name ?? assetId}" is missing from the package.`, warnings: ['Referenced or visible custom artwork is missing.'] };
    }
  }

  const summary = {
    schemaVersion: envelope.schemaVersion,
    savedAt: envelope.savedAt,
    presetCount: envelope.presets.length,
    sceneCount: envelope.scenes.length,
    hasCurrentScene: Boolean(envelope.currentScene && envelope.currentScene.entities?.length > 0),
    currentSceneEntityCount: envelope.currentScene?.entities?.length ?? 0,
    customAssetCount: envelope.customAssets?.length ?? 0,
    artworkBlobCount: validatedArtwork.length,
    settings: { ...envelope.settings }
  };

  return {
    ok: true,
    isPackage,
    envelope,
    customArtwork: validatedArtwork,
    summary,
    warnings: [...warnings, ...result.warnings]
  };
}

/**
 * Merges an incoming validated project envelope and custom artwork into the current studio envelope.
 * Rewrites colliding preset, scene, and custom asset IDs, mapping all references cleanly.
 */
export function mergeProjectEnvelopes(currentEnvelope, incomingEnvelope, incomingCustomArtwork = [], options = {}) {
  if (incomingCustomArtwork && !Array.isArray(incomingCustomArtwork) && typeof incomingCustomArtwork === 'object') {
    options = incomingCustomArtwork;
    incomingCustomArtwork = [];
  }
  const makeId = options.makeId ?? defaultMakeId;
  const now = options.now ?? defaultNow;
  const warnings = [];

  const usedCustomIds = new Set((currentEnvelope.customAssets || []).map((a) => a.assetId));
  const customIdRewrites = new Map(); // oldCustomId -> newCustomId

  const nextUniqueCustomId = () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `${CUSTOM_ID_PREFIX}${makeId()}`;
      if (isValidId(candidate) && !usedCustomIds.has(candidate)) {
        usedCustomIds.add(candidate);
        return candidate;
      }
    }
    return null;
  };

  // 1. Merge custom asset metadata and map collisions
  const mergedCustomAssets = (currentEnvelope.customAssets || []).map((a) => ({ ...a }));
  const rewrittenCustomArtwork = [];

  for (const incomingAsset of incomingEnvelope.customAssets || []) {
    if (mergedCustomAssets.length >= LIMITS.MAX_CUSTOM_ASSETS) {
      warnings.push(`Custom art library limit (${LIMITS.MAX_CUSTOM_ASSETS}) reached; remaining drawings were omitted.`);
      break;
    }

    let finalAssetId = incomingAsset.assetId;
    if (usedCustomIds.has(finalAssetId)) {
      finalAssetId = nextUniqueCustomId();
      if (!finalAssetId) {
        warnings.push('A colliding custom artwork was omitted because a safe unique ID could not be generated.');
        continue;
      }
      customIdRewrites.set(incomingAsset.assetId, finalAssetId);
    } else {
      usedCustomIds.add(finalAssetId);
    }

    const rewrittenAsset = {
      ...incomingAsset,
      assetId: finalAssetId
    };
    mergedCustomAssets.push(rewrittenAsset);

    const artBlobItem = incomingCustomArtwork.find((item) => item.metadata?.assetId === incomingAsset.assetId);
    if (artBlobItem) {
      rewrittenCustomArtwork.push({
        ...artBlobItem,
        metadata: {
          ...artBlobItem.metadata,
          assetId: finalAssetId
        }
      });
    }
  }

  // 2. Merge presets with rewritten custom wearable references
  const usedPresetIds = new Set((currentEnvelope.presets || []).map((p) => p.presetId));
  const presetIdRewrites = new Map(); // oldPresetId -> newPresetId

  const nextUniquePresetId = () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = makeId();
      if (isValidId(candidate) && !usedPresetIds.has(candidate)) {
        usedPresetIds.add(candidate);
        return candidate;
      }
    }
    return null;
  };

  const rewriteDraftSlots = (draft) => {
    if (!draft || !draft.slots) return draft;
    const cloned = clonePreset(draft);
    for (const [slotKey, slotItem] of Object.entries(cloned.slots)) {
      if (slotItem?.assetId && customIdRewrites.has(slotItem.assetId)) {
        cloned.slots[slotKey] = {
          ...slotItem,
          assetId: customIdRewrites.get(slotItem.assetId)
        };
      }
    }
    return cloned;
  };

  const mergedPresets = (currentEnvelope.presets || []).map(clonePreset);
  let addedPresets = 0;

  for (const incomingPreset of incomingEnvelope.presets || []) {
    if (mergedPresets.length >= LIMITS.MAX_PRESETS) {
      warnings.push(`Preset limit (${LIMITS.MAX_PRESETS}) reached; remaining incoming dolls were omitted.`);
      break;
    }

    let finalPresetId = incomingPreset.presetId;
    if (usedPresetIds.has(finalPresetId)) {
      finalPresetId = nextUniquePresetId();
      if (!finalPresetId) {
        warnings.push('A colliding incoming doll was omitted because a safe unique ID could not be generated.');
        continue;
      }
      presetIdRewrites.set(incomingPreset.presetId, finalPresetId);
    } else {
      usedPresetIds.add(finalPresetId);
    }

    const rewrittenPreset = rewriteDraftSlots({
      ...clonePreset(incomingPreset),
      presetId: finalPresetId
    });
    mergedPresets.push(rewrittenPreset);
    addedPresets += 1;
  }

  // 3. Merge scenes with rewritten character snapshot presets and custom prop sourceIds
  const usedSceneIds = new Set((currentEnvelope.scenes || []).map((s) => s.sceneId));
  const mergedScenes = (currentEnvelope.scenes || []).map(cloneScene);
  let addedScenes = 0;

  const nextUniqueSceneId = () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = makeId();
      if (isValidId(candidate) && !usedSceneIds.has(candidate)) {
        usedSceneIds.add(candidate);
        return candidate;
      }
    }
    return null;
  };

  const rewriteSceneEntities = (entities = []) => {
    return entities.map((entity) => {
      let nextSourceId = entity.sourceId;
      if (entity.kind === 'character' && presetIdRewrites.has(entity.sourceId)) {
        nextSourceId = presetIdRewrites.get(entity.sourceId);
      } else if (entity.kind === 'prop' && customIdRewrites.has(entity.sourceId)) {
        nextSourceId = customIdRewrites.get(entity.sourceId);
      }

      let characterSnapshot = entity.characterSnapshot;
      if (entity.kind === 'character' && characterSnapshot) {
        characterSnapshot = rewriteDraftSlots(characterSnapshot);
      }

      return {
        ...entity,
        sourceId: nextSourceId,
        ...(characterSnapshot ? { characterSnapshot } : {})
      };
    });
  };

  for (const incomingScene of incomingEnvelope.scenes || []) {
    if (mergedScenes.length >= LIMITS.MAX_SCENES) {
      warnings.push(`Scene library limit (${LIMITS.MAX_SCENES}) reached; remaining incoming scenes were omitted.`);
      break;
    }

    let finalSceneId = incomingScene.sceneId;
    if (usedSceneIds.has(finalSceneId)) {
      finalSceneId = nextUniqueSceneId();
      if (!finalSceneId) {
        warnings.push('A colliding incoming scene was omitted because a safe unique ID could not be generated.');
        continue;
      }
    } else {
      usedSceneIds.add(finalSceneId);
    }

    mergedScenes.push({
      ...cloneScene(incomingScene),
      sceneId: finalSceneId,
      entities: rewriteSceneEntities(incomingScene.entities || [])
    });
    addedScenes += 1;
  }

  let targetCurrentScene = currentEnvelope.currentScene ? cloneScene(currentEnvelope.currentScene) : null;
  if (!targetCurrentScene && incomingEnvelope.currentScene) {
    const rawCurrent = cloneScene(incomingEnvelope.currentScene);
    rawCurrent.entities = rewriteSceneEntities(rawCurrent.entities || []);
    targetCurrentScene = rawCurrent;
  }

  const mergedEnvelope = {
    schemaVersion: SCHEMA_VERSION,
    revision: (currentEnvelope.revision ?? 1) + 1,
    savedAt: now().toISOString(),
    settings: {
      ...incomingEnvelope.settings,
      ...currentEnvelope.settings
    },
    customAssets: mergedCustomAssets,
    presets: mergedPresets,
    scenes: mergedScenes,
    currentScene: targetCurrentScene
  };

  return {
    envelope: mergedEnvelope,
    customArtwork: rewrittenCustomArtwork,
    warnings,
    stats: {
      addedPresets,
      addedScenes,
      addedCustomAssets: mergedCustomAssets.length - (currentEnvelope.customAssets?.length || 0),
      rewrittenIdsCount: presetIdRewrites.size + customIdRewrites.size
    }
  };
}

/**
 * Saves a recoverable backup snapshot before performing a Replace operation.
 */
export function saveProjectBackup(storage, envelope, now = () => new Date()) {
  if (!storage) return { ok: false, error: 'Storage unavailable' };
  try {
    const stamp = now().toISOString();
    const backupEnvelope = {
      ...envelope,
      backedUpAt: stamp
    };
    const serialized = JSON.stringify(backupEnvelope);

    storage.setItem(BACKUP_KEY_LATEST, serialized);
    return { ok: true, savedAt: stamp };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Retrieves the latest recoverable backup from storage if one exists.
 */
export function getAvailableBackup(storage, getAsset = () => undefined) {
  if (!storage) return { available: false };
  try {
    const raw = storage.getItem(BACKUP_KEY_LATEST);
    if (!raw) return { available: false };
    const parsed = JSON.parse(raw);
    const result = sanitizeEnvelope(parsed, getAsset);
    if (!result.envelope) return { available: false };
    return {
      available: true,
      envelope: result.envelope,
      backedUpAt: parsed.backedUpAt || parsed.savedAt || new Date(0).toISOString(),
      summary: {
        presetCount: result.envelope.presets.length,
        sceneCount: result.envelope.scenes.length,
        customAssetCount: result.envelope.customAssets?.length ?? 0,
        hasCurrentScene: Boolean(result.envelope.currentScene?.entities?.length)
      }
    };
  } catch {
    return { available: false };
  }
}

/**
 * Clears the latest backup snapshot from storage.
 */
export function clearProjectBackup(storage) {
  if (!storage) return;
  try {
    storage.removeItem(BACKUP_KEY_LATEST);
  } catch {
    // Best effort
  }
}
