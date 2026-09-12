import { FAMILY_HOME_MANIFEST } from './family-home/manifest.js';
import { CORE_PACK_MANIFEST } from './core/manifest.js';
import { createPackRegistry } from './pack-registry.js';

/** Bundled trusted manifests. Future packs are appended only after validation. */
export const PACK_MANIFESTS = Object.freeze([CORE_PACK_MANIFEST, FAMILY_HOME_MANIFEST]);

export const PACK_REGISTRY = createPackRegistry(PACK_MANIFESTS);

export {
  ALL_PACKS_FILTER,
  CORE_PACK_ID,
  PACK_MANIFEST_SCHEMA_VERSION,
  createPackRegistry,
  collectReferencedPackRequirements,
  getVisiblePackManifests,
  getAssetPackId,
  isPackId,
  isPackVersion,
  validatePackManifest
} from './pack-registry.js';
