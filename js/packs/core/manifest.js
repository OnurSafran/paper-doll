import { ASSETS } from '../../core/asset-catalog.js';

/**
 * Core content is kept in the established catalog file. The manifest gives
 * it the same identity and resource contract used by future expansions.
 */
export const CORE_PACK_MANIFEST = Object.freeze({
  id: 'core',
  version: '1.20.0',
  schemaVersion: 1,
  minAppVersion: '1.20.0',
  nameKey: 'packs.core.name',
  descriptionKey: 'packs.core.description',
  coverPath: 'assets/app-icon.svg',
  assets: ASSETS,
  locales: {
    en: { packs: { core: { name: 'Core', description: 'The original studio collection.' } } },
    tr: { packs: { core: { name: 'Temel paket', description: 'Stüdyonun özgün koleksiyonu.' } } }
  },
  dependencies: [],
  chapters: [],
  files: Object.freeze(['assets/app-icon.svg', ...new Set(ASSETS.map((asset) => asset.path))])
});
