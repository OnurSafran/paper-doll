import test from 'node:test';
import assert from 'node:assert/strict';

if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.clear !== 'function') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
}

import {
  initLanguage,
  setLanguage,
  getCurrentLanguage,
  t,
  updateDomTranslations,
  translateMessage,
  TRANSLATIONS,
  LANGUAGE_STORAGE_KEY
} from '../js/core/i18n.js';
import { getPaletteColorName } from '../js/core/palette.js';
import { ASSETS, getAsset } from '../js/core/asset-catalog.js';
import { createAppStore } from '../js/core/app-store.js';
import { createDefaultEnvelope } from '../js/core/state-schema.js';

test('i18n system defaults to Turkish (tr) with complete dictionary', () => {
  localStorage.clear();
  initLanguage();
  assert.equal(getCurrentLanguage(), 'tr');
  assert.equal(t('app.title'), 'Paper Doll Studio');
  assert.equal(t('nav.designer'), 'Tasarımcı');
  assert.equal(t('nav.paint'), 'Boya');
  assert.equal(t('nav.play'), 'Oyna');
});

test('i18n parameter interpolation works correctly', () => {
  setLanguage('tr');
  assert.equal(t('designer.outfitCount', { count: 3 }), '3 parça');
  assert.equal(t('designer.renameTitle', { name: 'Ayşe' }), 'Ayşe adını değiştir');

  setLanguage('en');
  assert.equal(t('designer.outfitCount', { count: 3 }), '3 pieces');
  assert.equal(t('designer.renameTitle', { name: 'Emma' }), 'Rename Emma');
});

test('setLanguage switches language and persists to localStorage', () => {
  setLanguage('en');
  assert.equal(getCurrentLanguage(), 'en');
  assert.equal(localStorage.getItem(LANGUAGE_STORAGE_KEY), 'en');
  assert.equal(t('app.title'), 'Paper Doll Studio');

  setLanguage('tr');
  assert.equal(getCurrentLanguage(), 'tr');
  assert.equal(localStorage.getItem(LANGUAGE_STORAGE_KEY), 'tr');
  assert.equal(t('app.title'), 'Paper Doll Studio');
});

test('Designer status messages can be retranslated after switching language', () => {
  const originalLanguage = getCurrentLanguage();

  try {
    setLanguage('tr');
    const store = createAppStore(createDefaultEnvelope(), { getAsset });
    assert.equal(store.getState().ui.message, t('designer.choosePieceFirst'));

    store.dispatch({ type: 'designer/equip', assetId: 'top_hoodie' });
    const state = store.getState();
    assert.equal(state.ui.messageKey, 'designer.equipped');
    assert.deepEqual(state.ui.messageParams, { assetId: 'top_hoodie', slotIds: [] });
    assert.equal(state.ui.message, 'Rahat kapüşonlu giydirildi.');

    setLanguage('en');
    assert.equal(translateMessage(state.ui.messageKey, state.ui.messageParams), 'Cozy hoodie equipped.');
  } finally {
    setLanguage(originalLanguage);
  }
});

test('storage status messages and My Art collection label are localized', () => {
  setLanguage('tr');
  assert.equal(t('sync.storageSaved'), 'Bu cihaza kaydedildi.');
  assert.equal(t('play.propCollectionMyArt'), 'Çizimlerim');
  setLanguage('en');
  assert.equal(t('sync.storageSaved'), 'Saved on this device.');
  assert.equal(t('play.propCollectionMyArt'), 'My Art');
});

test('palette color localization helper works in tr and en', () => {
  setLanguage('tr');
  assert.equal(getPaletteColorName('coral'), 'Mercan pembesi');
  assert.equal(getPaletteColorName('sky'), 'Gök mavisi');

  setLanguage('en');
  assert.equal(getPaletteColorName('coral'), 'Coral pink');
  assert.equal(getPaletteColorName('sky'), 'Sky blue');
});

test('all keys in Turkish dictionary exist in English dictionary', () => {
  function collectKeys(obj, prefix = '') {
    let keys = [];
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'object' && v !== null) {
        keys = keys.concat(collectKeys(v, fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    return keys;
  }

  const trKeys = collectKeys(TRANSLATIONS.tr);
  const enKeys = collectKeys(TRANSLATIONS.en);

  const missingInEn = trKeys.filter((k) => !enKeys.includes(k));
  const missingInTr = enKeys.filter((k) => !trKeys.includes(k));

  assert.deepEqual(missingInEn, [], `Keys missing in English dictionary: ${missingInEn.join(', ')}`);
  assert.deepEqual(missingInTr, [], `Keys missing in Turkish dictionary: ${missingInTr.join(', ')}`);
});

test('translation placeholders stay aligned between languages', () => {
  function collectEntries(obj, prefix = '') {
    return Object.entries(obj).flatMap(([key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      return value && typeof value === 'object'
        ? collectEntries(value, fullKey)
        : [[fullKey, String(value)]];
    });
  }

  const english = Object.fromEntries(collectEntries(TRANSLATIONS.en));
  const placeholders = (value) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

  for (const [key, turkishValue] of collectEntries(TRANSLATIONS.tr)) {
    assert.deepEqual(
      placeholders(turkishValue),
      placeholders(english[key]),
      `Placeholder mismatch for ${key}`
    );
  }
});

test('every built-in catalog asset has a localized name in both languages', () => {
  for (const language of ['tr', 'en']) {
    setLanguage(language);
    for (const asset of ASSETS) {
      const label = t(`assets.${asset.id}`);
      assert.ok(label && label !== `assets.${asset.id}`, `${language} is missing assets.${asset.id}`);
    }
  }
});

test('updateDomTranslations preserves inline HTML formatting in rich strings', () => {
  setLanguage('tr');
  const guideEl = {
    getAttribute: (attr) => (attr === 'data-i18n' ? 'guideDialog.step1Desc' : null),
    innerHTML: '',
    textContent: ''
  };
  const codeEl = {
    getAttribute: (attr) => (attr === 'data-i18n' ? 'projectDialog.exportCopy' : null),
    innerHTML: '',
    textContent: ''
  };

  const mockContainer = {
    querySelectorAll: (selector) => {
      if (selector === '[data-i18n]') return [guideEl, codeEl];
      return [];
    }
  };

  updateDomTranslations(mockContainer);
  assert.match(guideEl.innerHTML, /<strong>Tasarımcı<\/strong>/);
  assert.match(codeEl.innerHTML, /<code>\.json<\/code>/);

  setLanguage('en');
  updateDomTranslations(mockContainer);
  assert.match(guideEl.innerHTML, /<strong>Designer<\/strong>/);
  assert.match(codeEl.innerHTML, /<code>\.json<\/code>/);
});

test('updateDomTranslations updates element text, titles, placeholders, content, and aria-labels', () => {
  setLanguage('tr');
  const textEl = {
    getAttribute: (attr) => (attr === 'data-i18n' ? 'nav.designer' : null),
    textContent: 'Old Text'
  };
  const titleEl = {
    getAttribute: (attr) => (attr === 'data-i18n-title' ? 'header.undoTitle' : null),
    title: 'Old Title'
  };
  const placeholderEl = {
    getAttribute: (attr) => (attr === 'data-i18n-placeholder' ? 'designer.dollNamePlaceholder' : null),
    placeholder: 'Old Placeholder'
  };
  const ariaEl = {
    getAttribute: (attr) => (attr === 'data-i18n-aria-label' ? 'app.langToggleTitle' : null),
    setAttribute: (attr, val) => { ariaEl[attr] = val; }
  };
  const contentEl = {
    getAttribute: (attr) => (attr === 'data-i18n-content' ? 'app.description' : null),
    setAttribute: (attr, val) => { contentEl[attr] = val; }
  };

  const mockContainer = {
    querySelectorAll: (selector) => {
      if (selector === '[data-i18n]') return [textEl];
      if (selector === '[data-i18n-title]') return [titleEl];
      if (selector === '[data-i18n-placeholder]') return [placeholderEl];
      if (selector === '[data-i18n-aria-label]') return [ariaEl];
      if (selector === '[data-i18n-content]') return [contentEl];
      return [];
    }
  };

  updateDomTranslations(mockContainer);
  assert.equal(textEl.textContent, 'Tasarımcı');
  assert.equal(titleEl.title, 'Geri Al (Ctrl+Z veya ⌘Z)');
  assert.equal(placeholderEl.placeholder, 'Güneşli gün bebeği');
  assert.equal(ariaEl['aria-label'], 'Dili Değiştir / Switch Language');
  assert.equal(contentEl.content, 'Kağıt bebekler tasarlayın ve sahnelerde canlandırın.');
});

import { validateArtworkName } from '../js/features/paint/paint-session.js';

test('validateArtworkName error messages adapt to active language', () => {
  setLanguage('tr');
  const trEmpty = validateArtworkName('');
  assert.equal(trEmpty.valid, false);
  assert.equal(trEmpty.error, 'Lütfen çiziminiz için bir ad girin.');

  const trTooLong = validateArtworkName('A'.repeat(50));
  assert.equal(trTooLong.valid, false);
  assert.equal(trTooLong.error, 'Ad çok uzun (en fazla 30 karakter).');

  setLanguage('en');
  const enEmpty = validateArtworkName('');
  assert.equal(enEmpty.valid, false);
  assert.equal(enEmpty.error, 'Please enter a name for your artwork.');

  const enTooLong = validateArtworkName('A'.repeat(50));
  assert.equal(enTooLong.valid, false);
  assert.equal(enTooLong.error, 'Name is too long (maximum 30 characters).');
});

test('Custom asset and project status messages adapt to active language and retranslate', () => {
  const originalLanguage = getCurrentLanguage();

  try {
    setLanguage('tr');
    const store = createAppStore(createDefaultEnvelope(), { getAsset });

    // 1. Custom asset add
    store.dispatch({
      type: 'customAsset/add',
      asset: {
        assetId: 'custom_hat_1',
        kind: 'wearable',
        slot: 'accessory',
        name: 'Mavi Şapka',
        svgDataUri: 'data:image/svg+xml;utf8,<svg></svg>'
      }
    });
    let state = store.getState();
    assert.equal(state.ui.messageKey, 'paint.assetAdded');
    assert.equal(state.ui.message, '“Mavi Şapka” Çizimlerime eklendi.');

    setLanguage('en');
    assert.equal(translateMessage(state.ui.messageKey, state.ui.messageParams), '"Mavi Şapka" added to My Art.');

    // 2. Custom asset rename
    setLanguage('tr');
    store.dispatch({
      type: 'customAsset/rename',
      assetId: 'custom_hat_1',
      name: 'Yaz Şapkası'
    });
    state = store.getState();
    assert.equal(state.ui.messageKey, 'paint.assetRenamed');
    assert.equal(state.ui.message, 'Çizim adı “Yaz Şapkası” olarak değiştirildi.');

    setLanguage('en');
    assert.equal(translateMessage(state.ui.messageKey, state.ui.messageParams), 'Artwork renamed to "Yaz Şapkası".');

    // 3. Project restore backup
    setLanguage('tr');
    store.dispatch({
      type: 'project/restoreBackup',
      envelope: createDefaultEnvelope(),
      messageKey: 'toasts.backupRestored'
    });
    state = store.getState();
    assert.equal(state.ui.messageKey, 'toasts.backupRestored');
    assert.equal(state.ui.message, 'Önceki proje yedeği geri yüklendi.');

    setLanguage('en');
    assert.equal(translateMessage(state.ui.messageKey, state.ui.messageParams), 'Previous project backup restored.');

    // 4. Designer set base doll (with incompatible items preserved)
    setLanguage('tr');
    store.dispatch({
      type: 'designer/setBaseDoll',
      baseDollId: 'doll_adult_a'
    });
    state = store.getState();
    assert.equal(state.ui.messageKey, 'designer.baseDollChangedFit');
    assert.equal(state.ui.message, 'Yetişkin seçildi. Uyumsuz parçalar korunuyor ve model değişene kadar gizleniyor.');

    setLanguage('en');
    assert.equal(translateMessage(state.ui.messageKey, state.ui.messageParams), 'Adult selected. Incompatible items are preserved and hidden until the model fits them.');

    // 5. Designer set base doll without incompatible items (same fit family: classic A -> classic B)
    store.dispatch({ type: 'designer/reset' });
    setLanguage('tr');
    store.dispatch({
      type: 'designer/setBaseDoll',
      baseDollId: 'doll_classic_b'
    });
    state = store.getState();
    assert.equal(state.ui.messageKey, 'designer.baseDollChanged');
    assert.equal(state.ui.message, 'Neşeli seçildi.');

    setLanguage('en');
    assert.equal(translateMessage(state.ui.messageKey, state.ui.messageParams), 'Joy selected.');
  } finally {
    setLanguage(originalLanguage);
  }
});


