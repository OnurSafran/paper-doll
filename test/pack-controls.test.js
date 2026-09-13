import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { PACK_REGISTRY } from '../js/packs/index.js';
import { getVisiblePackManifests } from '../js/packs/pack-registry.js';

test('pack controls retain their options during scene updates and refresh for filter, visibility, and language changes', () => {
  const source = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  const start = source.indexOf('let packControlsSignature');
  const end = source.indexOf('\nfor (const select of document.querySelectorAll', start);
  let state = { ui: { packFilter: 'all' }, settings: { hiddenPacks: [] } };
  let language = 'en';
  const picker = { options: [], replaceChildren(...options) { this.options = options; } };
  const outfits = { options: [], replaceChildren(...options) { this.options = options; } };
  const render = runInNewContext(source.slice(start, end) + '\nrenderPackControls;', {
    store: { getState: () => state },
    getCurrentLanguage: () => language,
    PACK_REGISTRY, getVisiblePackManifests,
    document: { querySelectorAll: () => [picker] },
    $: () => outfits,
    t: (key) => language + ':' + key,
    Option: class { constructor(text, value) { this.text = text; this.value = value; } }
  });
  render();
  const originalOptions = picker.options;
  const originalOutfits = outfits.options;
  state = { ...state, currentScene: { cameraX: 400 } };
  render();
  assert.equal(picker.options, originalOptions);
  assert.equal(outfits.options, originalOutfits);
  state.ui.packFilter = 'pack_family_home';
  render();
  assert.equal(picker.value, 'pack_family_home');
  language = 'tr';
  render();
  assert.ok(picker.options.every(option => option.text.startsWith('tr:')));
  state.settings.hiddenPacks = ['pack_family_home'];
  render();
  assert.equal(picker.value, 'all');
  assert.equal(picker.options.length, 2);
  assert.equal(outfits.options.length, 1);
});
