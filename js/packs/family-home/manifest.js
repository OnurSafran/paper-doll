import { FAMILY_ASSETS, FAMILY_CHAPTERS } from './catalog.js';
import { FAMILY_LOCALES } from './locales.js';
import { FAMILY_OUTFITS } from './recipes.js';
import { FAMILY_TEMPLATES } from './stories.js';

export const FAMILY_HOME_MANIFEST = Object.freeze({
  id: 'pack_family_home',
  version: '1.0.0',
  schemaVersion: 1,
  minAppVersion: '1.20.0',
  nameKey: 'pack_family_home.name',
  descriptionKey: 'pack_family_home.description',
  coverPath: 'assets/packs/pack_family_home/cover.svg',
  dependencies: [],
  assets: FAMILY_ASSETS,
  chapters: FAMILY_CHAPTERS,
  locales: FAMILY_LOCALES,
  templates: FAMILY_TEMPLATES,
  outfits: FAMILY_OUTFITS,
  files: ['assets/packs/pack_family_home/cover.svg', ...FAMILY_ASSETS.map((asset) => asset.path)]
});
