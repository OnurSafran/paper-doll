/**
 * Project Portability Service
 * Single authority for project JSON export, validate-before-mutate import,
 * collision rewriting for Merge, and recoverable backup snapshots.
 */

import { clonePreset, cloneScene, persistedProjection, sanitizeEnvelope, SCHEMA_VERSION, STORAGE_KEY } from '../core/state-schema.js';
import { defaultMakeId, defaultNow, isValidId, LIMITS } from '../domain/vocabulary.js';

export const BACKUP_KEY_LATEST = 'paperDollStudio.backup.latest';

/**
 * Formats a portable export filename with date stamp.
 */
export function formatProjectExportFilename(now = () => new Date()) {
  const d = now();
  const dateStr = d.toISOString().slice(0, 10);
  return `paper-doll-project-${dateStr}.json`;
}

/**
 * Serializes the current studio state into a formatted, versioned project JSON string.
 */
export function serializeProjectExport(state, now = () => new Date()) {
  const envelope = persistedProjection(state, now);
  return JSON.stringify(envelope, null, 2);
}

/**
 * Validates an incoming JSON string or object payload before mutating any domain state.
 * Performs parse -> check schema -> migrate -> sanitize -> summarize.
 */
export function validateImportPayload(rawInput, getAsset = () => undefined, { maxBytes = LIMITS.MAX_IMPORT_BYTES } = {}) {
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
    return { ok: false, error: 'Project file exceeds the maximum allowed size (5MB).', warnings: ['Payload exceeded size limit.'] };
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

  const result = sanitizeEnvelope(parsed, getAsset);
  if (!result.envelope) {
    return { ok: false, error: 'The file content could not be read as a valid project.', warnings: result.warnings };
  }

  const envelope = result.envelope;
  const summary = {
    schemaVersion: envelope.schemaVersion,
    savedAt: envelope.savedAt,
    presetCount: envelope.presets.length,
    sceneCount: envelope.scenes.length,
    hasCurrentScene: Boolean(envelope.currentScene && envelope.currentScene.entities?.length > 0),
    currentSceneEntityCount: envelope.currentScene?.entities?.length ?? 0,
    settings: { ...envelope.settings }
  };

  return {
    ok: true,
    envelope,
    summary,
    warnings: [...warnings, ...result.warnings]
  };
}

/**
 * Merges an incoming validated project envelope into the current studio envelope.
 * Rewrites colliding preset and scene IDs, maps references cleanly, and enforces collection limits.
 */
export function mergeProjectEnvelopes(currentEnvelope, incomingEnvelope, options = {}) {
  const makeId = options.makeId ?? defaultMakeId;
  const now = options.now ?? defaultNow;
  const warnings = [];

  const usedPresetIds = new Set(currentEnvelope.presets.map((p) => p.presetId));
  const idRewrites = new Map(); // oldPresetId -> newPresetId

  const nextUniqueId = (usedIds) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = makeId();
      if (isValidId(candidate) && !usedIds.has(candidate)) {
        usedIds.add(candidate);
        return candidate;
      }
    }
    return null;
  };

  const mergedPresets = currentEnvelope.presets.map(clonePreset);
  let addedPresets = 0;

  for (const incomingPreset of incomingEnvelope.presets || []) {
    if (mergedPresets.length >= LIMITS.MAX_PRESETS) {
      warnings.push(`Preset limit (${LIMITS.MAX_PRESETS}) reached; remaining incoming dolls were omitted.`);
      break;
    }

    let finalPresetId = incomingPreset.presetId;
    if (usedPresetIds.has(finalPresetId)) {
      finalPresetId = nextUniqueId(usedPresetIds);
      if (!finalPresetId) {
        warnings.push('A colliding incoming doll was omitted because a safe unique ID could not be generated.');
        continue;
      }
      idRewrites.set(incomingPreset.presetId, finalPresetId);
    } else {
      usedPresetIds.add(finalPresetId);
    }

    mergedPresets.push({
      ...clonePreset(incomingPreset),
      presetId: finalPresetId
    });
    addedPresets += 1;
  }

  const usedSceneIds = new Set(currentEnvelope.scenes.map((s) => s.sceneId));
  const mergedScenes = (currentEnvelope.scenes || []).map(cloneScene);
  let addedScenes = 0;

  for (const incomingScene of incomingEnvelope.scenes || []) {
    if (mergedScenes.length >= LIMITS.MAX_SCENES) {
      warnings.push(`Scene library limit (${LIMITS.MAX_SCENES}) reached; remaining incoming scenes were omitted.`);
      break;
    }

    let finalSceneId = incomingScene.sceneId;
    if (usedSceneIds.has(finalSceneId)) {
      finalSceneId = nextUniqueId(usedSceneIds);
      if (!finalSceneId) {
        warnings.push('A colliding incoming scene was omitted because a safe unique ID could not be generated.');
        continue;
      }
    } else {
      usedSceneIds.add(finalSceneId);
    }

    // Rewrite entity sourceId references if any referenced character preset ID was rewritten
    const rewrittenEntities = (incomingScene.entities || []).map((entity) => {
      if (entity.kind === 'character' && idRewrites.has(entity.sourceId)) {
        return {
          ...entity,
          sourceId: idRewrites.get(entity.sourceId)
        };
      }
      return { ...entity };
    });

    mergedScenes.push({
      ...cloneScene(incomingScene),
      sceneId: finalSceneId,
      entities: rewrittenEntities
    });
    addedScenes += 1;
  }

  let targetCurrentScene = currentEnvelope.currentScene ? cloneScene(currentEnvelope.currentScene) : null;
  if (!targetCurrentScene && incomingEnvelope.currentScene) {
    const rawCurrent = cloneScene(incomingEnvelope.currentScene);
    rawCurrent.entities = (rawCurrent.entities || []).map((entity) => {
      if (entity.kind === 'character' && idRewrites.has(entity.sourceId)) {
        return { ...entity, sourceId: idRewrites.get(entity.sourceId) };
      }
      return { ...entity };
    });
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
    presets: mergedPresets,
    scenes: mergedScenes,
    currentScene: targetCurrentScene
  };

  return {
    envelope: mergedEnvelope,
    warnings,
    stats: {
      addedPresets,
      addedScenes,
      rewrittenIdsCount: idRewrites.size
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

    // Prune older historical backup keys so storage does not grow unbounded
    try {
      const backupPrefix = 'paperDollStudio.backup.';
      if (typeof storage.length === 'number' && typeof storage.key === 'function') {
        const keysToRemove = [];
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (k && k.startsWith(backupPrefix) && k !== BACKUP_KEY_LATEST) keysToRemove.push(k);
        }
        for (const k of keysToRemove) storage.removeItem(k);
      } else if (storage.data instanceof Map) {
        for (const k of [...storage.data.keys()]) {
          if (k.startsWith(backupPrefix) && k !== BACKUP_KEY_LATEST) storage.removeItem(k);
        }
      }
    } catch {
      /* historical pruning is best-effort */
    }

    storage.setItem(BACKUP_KEY_LATEST, serialized);
    try {
      storage.setItem(`paperDollStudio.backup.${Date.now()}`, serialized);
    } catch {
      // Historical backup write is best-effort
    }
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
