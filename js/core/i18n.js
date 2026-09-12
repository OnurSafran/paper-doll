import { PACK_MANIFESTS, PACK_REGISTRY } from '../packs/index.js';
/**
 * Centralized Internationalization (i18n) Engine for Paper Doll Studio
 * Default language: Turkish ('tr')
 * Supported languages: Turkish ('tr'), English ('en')
 */

import { tr } from './locales/tr.js';
import { en } from './locales/en.js';

export const SUPPORTED_LANGUAGES = Object.freeze(['tr', 'en']);
export const DEFAULT_LANGUAGE = 'tr';
export const STORAGE_KEY = 'paper_doll_language';
export const LANGUAGE_STORAGE_KEY = STORAGE_KEY;

export const TRANSLATIONS = Object.freeze({
  tr: Object.assign({}, tr, ...PACK_MANIFESTS.map((pack) => ('locales' in pack ? pack.locales.tr : {}))),
  en: Object.assign({}, en, ...PACK_MANIFESTS.map((pack) => ('locales' in pack ? pack.locales.en : {})))
});

let currentLanguage = DEFAULT_LANGUAGE;

/**
 * Initialize current language from localStorage or default to 'tr'
 */
export function initLanguage() {
  try {
    const storage = typeof window !== 'undefined' && window.localStorage ? window.localStorage : globalThis.localStorage;
    const saved = storage?.getItem?.(STORAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
      currentLanguage = saved;
    } else {
      currentLanguage = DEFAULT_LANGUAGE;
    }
  } catch {
    currentLanguage = DEFAULT_LANGUAGE;
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = currentLanguage;
  }
  return currentLanguage;
}

export function getCurrentLanguage() {
  return currentLanguage;
}

export function setLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) return;
  currentLanguage = lang;
  try {
    const storage = typeof window !== 'undefined' && window.localStorage ? window.localStorage : globalThis.localStorage;
    storage?.setItem?.(STORAGE_KEY, lang);
  } catch { /* storage fallback */ }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    updateDomTranslations();
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('languagechange', { detail: { language: lang } }));
  }
}

/**
 * Key lookup helper with dot notation and parameter interpolation:
 * t('designer.outfitCount', { count: 3 })
 */
export function t(keyPath, params = {}) {
  if (!keyPath || typeof keyPath !== 'string') return '';
  const keys = keyPath.split('.');
  
  let value = keys.reduce((obj, key) => (obj && typeof obj === 'object' ? obj[key] : undefined), TRANSLATIONS[currentLanguage]);
  
  if (value === undefined) {
    value = keys.reduce((obj, key) => (obj && typeof obj === 'object' ? obj[key] : undefined), TRANSLATIONS[DEFAULT_LANGUAGE]);
  }
  
  if (value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.replace(/\{(\w+)\}/g, (match, k) => (params[k] !== undefined ? params[k] : match));
  }
  return value;
}

export function assetName(asset, fallback = '') {
  const id = typeof asset === 'string' ? asset : asset?.id;
  const defaultName = typeof asset === 'string' ? fallback : (asset?.name || fallback);
  if (!id) return defaultName;
  const translated = t((typeof asset === 'string' ? PACK_REGISTRY.getAsset(id)?.nameKey : asset?.nameKey) || `assets.${id}`);
  return !translated || translated === `assets.${id}` ? defaultName : translated;
}

/** @param {string} key
 * @param {Record<string, any>} params */
export function translateMessage(key, params = {}) {
  const resolved = { ...params };
  if (params.assetId) {
    resolved.name = assetName(params.assetId, params.name || t('designer.unknownAsset'));
  }
  if (params.baseDollId) {
    resolved.name = t(`models.${params.baseDollId}`) || params.name || t('designer.unknownAsset');
  }
  if (Array.isArray(params.slotIds)) {
    const slotNames = params.slotIds.map((slot) => t(`wardrobeSlots.${slot}`));
    resolved.slot = slotNames[0] || '';
    resolved.slots = slotNames.join(` ${t('app.and')} `);
  }
  return t(key, resolved);
}

/**
 * Updates all DOM nodes having data-i18n attributes
 */
export function updateDomTranslations(root = typeof document !== 'undefined' ? document : null) {
  if (!root || typeof root.querySelectorAll !== 'function') return;

  /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('[data-i18n]')).forEach((el) => {
    const key = el.getAttribute?.('data-i18n') || el.dataset?.i18n;
    if (key) {
      const val = t(key);
      if (/<[a-z][\s\S]*>/i.test(val)) {
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    }
  });

  /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('[data-i18n-title]')).forEach((el) => {
    const key = el.getAttribute?.('data-i18n-title') || el.dataset?.i18nTitle;
    if (key) el.title = t(key);
  });

  /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('[data-i18n-aria-label]')).forEach((el) => {
    const key = el.getAttribute?.('data-i18n-aria-label') || el.dataset?.i18nAriaLabel;
    if (key) {
      if (typeof el.setAttribute === 'function') el.setAttribute('aria-label', t(key));
      else el['aria-label'] = t(key);
    }
  });

  /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('[data-i18n-placeholder]')).forEach((el) => {
    const key = el.getAttribute?.('data-i18n-placeholder') || el.dataset?.i18nPlaceholder;
    if (key) /** @type {HTMLInputElement | HTMLTextAreaElement} */ (el).placeholder = t(key);
  });

  /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('[data-i18n-content]')).forEach((el) => {
    const key = el.getAttribute?.('data-i18n-content') || el.dataset?.i18nContent;
    if (key) el.setAttribute('content', t(key));
  });
}
