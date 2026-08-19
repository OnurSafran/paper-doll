/**
 * Designer View Feature Module
 * Owns wardrobe palettes, dress-up layers, swatch picking, and Dollbox presets.
 */

import { assetsByKind, facesByGroup, getOfferedWearables, matchesDiscoveryFilters, wearablesBySlot, getAsset as getBuiltinAsset } from '../../core/asset-catalog.js';
import { GARMENT_COLORS, HAIR_COLORS, IRIS_COLORS, PALETTE, paletteValue, SKIN_COLORS } from '../../core/palette.js';
import { loadAssetSvg, makeAssetPlaceholder } from '../../core/svg-loader.js';
import { DEFAULT_EXPRESSION, FACE_GROUPS, FIT_FAMILIES, PRESENTATION_STYLES, isCustomAssetId } from '../../domain/vocabulary.js';
import { isDefaultFace, isFaceCompatible, isWearableCompatible } from '../../domain/outfit-rules.js';
import { customAssetToDescriptor } from '../../core/asset-registry.js';
import { applyMouthExpression } from '../../core/mouth-expression.js';
import { assetName, getCurrentLanguage, t } from '../../core/i18n.js';
import { SLOT_PREVIEW_VIEWBOX } from '../../core/preview-viewboxes.js';

export const WARDROBE_SLOTS = [
  ['top', 'Tops'],
  ['bottom', 'Bottoms'],
  ['dress', 'Dresses'],
  ['shoes', 'Shoes'],
  ['hair', 'Hair'],
  ['accessory', 'Accessories']
];

export function describeOutfit(draft, getAsset = getBuiltinAsset) {
  const names = Object.values(draft.slots).filter(Boolean).map((item) => assetName(getAsset(item.assetId))).filter(Boolean);
  return names.length ? t('designer.outfitWearing', { items: names.join(', ') }) : t('designer.outfitEmpty');
}

export { SLOT_PREVIEW_VIEWBOX } from '../../core/preview-viewboxes.js';

export const FACE_PREVIEW_VIEWBOX = Object.freeze({
  eyes: '115 42 70 32',
  eyebrows: '115 42 70 24',
  nose: '135 55 30 22',
  mouth: '135 64 30 22',
  detail: '120 54 60 30'
});

function createCustomArtSvg(url) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 300 450');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
  image.setAttribute('href', url);
  image.setAttribute('x', '0');
  image.setAttribute('y', '0');
  image.setAttribute('width', '300');
  image.setAttribute('height', '450');
  image.setAttribute('preserveAspectRatio', 'none');
  svg.appendChild(image);
  return svg;
}

export function dollsForLifeStagePicker(dollAssets = assetsByKind('doll')) {
  const representativeByStage = new Map();
  for (const asset of dollAssets) {
    const lifeStage = asset.lifeStages?.[0];
    if (lifeStage && !representativeByStage.has(lifeStage)) representativeByStage.set(lifeStage, asset);
  }
  return FIT_FAMILIES.map((lifeStage) => representativeByStage.get(lifeStage)).filter(Boolean);
}

export async function appendAsset(container, assetId, { color, isPreview = false, customArtRepo, getCustomArtUrl, getAsset = getBuiltinAsset, loadAssetSvg: injectedLoadSvg } = {}) {
  try {
    if (isCustomAssetId(assetId)) {
      const url = await customArtRepo?.getTrackedObjectUrl?.(assetId) || await getCustomArtUrl?.(assetId);
      if (url) {
        if (isPreview) {
          const img = document.createElement('img');
          img.src = url;
          img.alt = assetName(getAsset(assetId), 'Custom art');
          img.className = 'custom-art-card-thumb';
          container.append(img);
          return;
        }
        container.append(createCustomArtSvg(url));
        return;
      }
    }
    const loadSvg = injectedLoadSvg ?? loadAssetSvg;
    const svg = await loadSvg(assetId);
    const asset = getAsset(assetId);
    container.style.setProperty('--asset-color-primary', paletteValue(color ?? asset?.defaultColors?.primary, 'coral'));
    if (asset?.kind === 'face' && asset.faceGroup === 'eyes') {
      container.style.setProperty('--iris-color', paletteValue(color, 'cocoa'));
    }
    if (isPreview && asset?.kind === 'wearable' && SLOT_PREVIEW_VIEWBOX[asset.slot]) {
      svg.setAttribute('viewBox', SLOT_PREVIEW_VIEWBOX[asset.slot]);
    } else if (isPreview && asset?.kind === 'face' && FACE_PREVIEW_VIEWBOX[asset.faceGroup]) {
      svg.setAttribute('viewBox', FACE_PREVIEW_VIEWBOX[asset.faceGroup]);
    }
    container.append(svg);
  } catch {
    container.append(makeAssetPlaceholder(getAsset(assetId)?.name ?? 'Asset'));
  }
}

export async function renderAssetPreview(container, asset, options = {}) {
  container.replaceChildren();
  await appendAsset(container, asset.id, {
    color: options.color ?? asset.defaultColors?.primary,
    isPreview: true,
    customArtRepo: options.customArtRepo,
    getCustomArtUrl: options.getCustomArtUrl,
    getAsset: options.getAsset
  });
}

export async function renderDollInto(container, draft, options = {}) {
  const customArtRepo = options.customArtRepo;
  const loadSvg = options.loadAssetSvg ?? loadAssetSvg;
  const getAsset = options.getAsset ?? getBuiltinAsset;
  const enforceFit = options.enforceFit !== false;
  const layers = [];
  const hair = draft?.slots?.hair;
  const expression = options.expression || draft.expression || DEFAULT_EXPRESSION;
  const showBakedFace = isDefaultFace(draft?.face, draft?.baseDollId) && expression === DEFAULT_EXPRESSION;
  const addWearableLayer = (slot, order, group = null) => {
    const item = draft?.slots?.[slot];
    if (!item) return;
    const asset = getAsset(item.assetId);
    layers.push([order, item.assetId, item.color, group, slot, enforceFit && !isWearableCompatible(draft, asset, getAsset)]);
  };
  if (hair && !isCustomAssetId(hair.assetId) && (!enforceFit || isWearableCompatible(draft, getAsset(hair.assetId), getAsset))) {
    layers.push([10, hair.assetId, hair.color, 'hairBack', 'hair', false]);
  }
  layers.push([20, draft?.baseDollId, null, null, 'skin']);

  const face = draft?.face;
  if (face && !showBakedFace) {
    if (face.eyes) layers.push([22, face.eyes.assetId, null, null, 'face-eyes', enforceFit && !isFaceCompatible(draft, getAsset(face.eyes.assetId), getAsset), face.eyes.irisColor]);
    if (face.eyebrows) layers.push([24, face.eyebrows.assetId, null, null, 'face-eyebrows', enforceFit && !isFaceCompatible(draft, getAsset(face.eyebrows.assetId), getAsset)]);
    if (face.detail) layers.push([25, face.detail.assetId, null, null, 'face-detail', enforceFit && !isFaceCompatible(draft, getAsset(face.detail.assetId), getAsset)]);
    if (face.nose) layers.push([26, face.nose.assetId, null, null, 'face-nose', enforceFit && !isFaceCompatible(draft, getAsset(face.nose.assetId), getAsset)]);
    if (face.mouth) layers.push([28, face.mouth.assetId, null, null, 'face-mouth', enforceFit && !isFaceCompatible(draft, getAsset(face.mouth.assetId), getAsset)]);
  }

  for (const [slot, order] of [['bottom', 30], ['shoes', 35], ['top', 40], ['dress', 45]]) addWearableLayer(slot, order);
  if (hair) addWearableLayer('hair', 70, 'hairFront');
  const accessory = draft?.slots?.accessory;
  if (accessory) {
    const asset = getAsset(accessory.assetId);
    layers.push([80, accessory.assetId, accessory.color, null, 'accessory', !isWearableCompatible(draft, asset, getAsset)]);
  }

  const fitWarningNames = [];
  const nodes = (await Promise.all(layers.map(async ([order, id, color, group, slot, incompatible, extra]) => {
    const layer = document.createElement('span');
    layer.className = 'doll-layer';
    layer.dataset.slot = slot;
    layer.style.zIndex = String(order);
    layer.style.setProperty('--skin-color', paletteValue(draft.skinTone, 'peach'));
    layer.style.setProperty('--hair-color', paletteValue(color, 'brown'));
    layer.style.setProperty('--asset-color-primary', paletteValue(color, 'coral'));
    if (incompatible) {
      const displayName = assetName(getAsset(id), 'Asset');
      const warningText = t('designer.fitWarningPlaceholder', { name: displayName });
      fitWarningNames.push(displayName);
      const placeholder = makeAssetPlaceholder(warningText);
      placeholder.className += ' fit-warning-placeholder';
      placeholder.textContent = '⚠️';
      placeholder.setAttribute('aria-label', warningText);
      placeholder.hidden = true;
      placeholder.title = warningText;
      layer.append(placeholder);
      return layer;
    }
    if (slot === 'face-eyes' && extra) {
      layer.style.setProperty('--iris-color', paletteValue(extra, 'cocoa'));
    }
    try {
      if (isCustomAssetId(id)) {
        const url = await customArtRepo?.getTrackedObjectUrl?.(id) || await options.getCustomArtUrl?.(id);
        if (url) {
          layer.append(createCustomArtSvg(url));
          return layer;
        }
      }
      const svg = await loadSvg(id);
      if (group) {
        for (const candidate of ['hairBack', 'hairFront']) {
          const node = svg.querySelector(`#${candidate}`);
          if (node && candidate !== group) node.style.display = 'none';
        }
      }
      if (slot === 'skin') {
        const baked = svg.querySelector('#baked-face');
        if (baked && face && !showBakedFace) {
          baked.style.display = 'none';
        } else if (!face) {
          applyMouthExpression(svg, expression);
        }
      }
      if (slot === 'face-mouth') {
        if (expression && expression !== 'neutral') {
          applyMouthExpression(svg, expression);
        }
      }
      layer.append(svg);
    } catch {
      layer.append(makeAssetPlaceholder(assetName(getAsset(id), 'Asset')));
    }
    return layer;
  })));
  container.replaceChildren(...nodes);
  if (enforceFit && fitWarningNames.length && typeof container.append === 'function') {
    const details = document.createElement('details');
    details.className = 'fit-warning-summary';
    const summary = document.createElement('summary');
    summary.textContent = t('designer.fitWarningSummary', { count: fitWarningNames.length });
    details.append(summary);
    const list = document.createElement('ul');
    for (const name of fitWarningNames) {
      const item = document.createElement('li');
      item.textContent = t('designer.fitWarningPlaceholder', { name });
      list.append(item);
    }
    details.append(list);
    container.append(details);
  }
}

export function previewCustomColor(color, slot = 'top', queryAll = (selector) => document.querySelectorAll(selector)) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return;
  const layers = queryAll(`#doll-stage .doll-layer[data-slot="${slot}"]`);
  for (const layer of layers) {
    layer.style.setProperty(slot === 'hair' ? '--hair-color' : '--asset-color-primary', color);
  }
}

function sameDollLayerStructure(previousDraft, nextDraft) {
  if (!previousDraft || !nextDraft || previousDraft.baseDollId !== nextDraft.baseDollId) return false;
  if ((previousDraft.expression || DEFAULT_EXPRESSION) !== (nextDraft.expression || DEFAULT_EXPRESSION)) return false;
  for (const [slot] of WARDROBE_SLOTS) {
    if (previousDraft.slots?.[slot]?.assetId !== nextDraft.slots?.[slot]?.assetId) return false;
  }
  for (const group of FACE_GROUPS) {
    if (previousDraft.face?.[group]?.assetId !== nextDraft.face?.[group]?.assetId) return false;
  }
  return isDefaultFace(previousDraft.face, previousDraft.baseDollId) ===
    isDefaultFace(nextDraft.face, nextDraft.baseDollId);
}

/**
 * Applies color-only draft changes to an existing doll stage.
 * Returns false when the layer tree must be rebuilt.
 */
export function patchDollColors(container, previousDraft, nextDraft) {
  if (!sameDollLayerStructure(previousDraft, nextDraft)) return false;
  const layers = Array.from(container?.querySelectorAll?.('.doll-layer') || []);
  const setLayers = (slot, property, value) => {
    for (const layer of layers) {
      if (layer.dataset.slot === slot) layer.style.setProperty(property, value);
    }
  };

  if (previousDraft.skinTone !== nextDraft.skinTone) {
    const value = paletteValue(nextDraft.skinTone, 'peach');
    for (const layer of layers) layer.style.setProperty('--skin-color', value);
  }

  for (const [slot] of WARDROBE_SLOTS) {
    const previousItem = previousDraft.slots?.[slot];
    const nextItem = nextDraft.slots?.[slot];
    if (previousItem?.color === nextItem?.color) continue;
    setLayers(slot, slot === 'hair' ? '--hair-color' : '--asset-color-primary', paletteValue(
      nextItem?.color,
      slot === 'hair' ? 'brown' : 'coral'
    ));
  }

  const previousIris = previousDraft.face?.eyes?.irisColor;
  const nextIris = nextDraft.face?.eyes?.irisColor;
  if (previousIris !== nextIris) {
    setLayers('face-eyes', '--iris-color', paletteValue(nextIris, 'cocoa'));
  }
  return true;
}

export function createDesignerView({
  store,
  $,
  $$,
  askConfirm,
  askPrompt = (_title, message, initialValue) => window.prompt(message, initialValue),
  miniButton,
  customArtRepo,
  openPaintStudio,
  getAsset = getBuiltinAsset
}) {
  let designerRenderToken = 0;
  let dollboxSignature = null;
  let dollboxRenderToken = 0;
  let lastRenderedDraft = null;
  let lastRenderedLanguage = null;

  function renderSwatches(container, tokens, selected, onSelect) {
    if (!container) return;
    const focusedToken = document.activeElement?.closest?.('.swatch')?.dataset.token;
    container.replaceChildren(...tokens.map((token) => {
      const colorName = t('colors.' + token) || PALETTE[token]?.name || token;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'swatch';
      button.dataset.token = token;
      button.style.setProperty('--swatch', paletteValue(token));
      button.setAttribute('aria-label', colorName);
      button.setAttribute('aria-pressed', String(token === selected));
      button.title = colorName;
      button.addEventListener('click', () => onSelect(token));
      bindRovingKeydown(button, tokens, selected, onSelect, () => container.querySelector('[aria-pressed="true"]'));
      return button;
    }));
    if (focusedToken) requestAnimationFrame(() => container.querySelector(`[data-token="${focusedToken}"]`)?.focus());
  }

  function bindRovingKeydown(button, values, selected, onSelect, query) {
    button.addEventListener('keydown', (event) => {
      const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1
          : event.key === 'Home' ? 0
            : event.key === 'End' ? values.length - 1
              : null;
      if (direction === null) return;
      event.preventDefault();
      const currentIndex = Math.max(0, values.indexOf(selected));
      const nextIndex = event.key === 'Home' ? 0
        : event.key === 'End' ? values.length - 1
          : (currentIndex + direction + values.length) % values.length;
      onSelect(values[nextIndex]);
      requestAnimationFrame(() => query()?.focus());
    });
  }

  function renderWardrobe(state, token) {
    const tabs = $('#wardrobe-tabs');
    const items = $('#wardrobe-items');
    if (!tabs || !items) return;
    const focusedTabId = document.activeElement?.closest?.('#wardrobe-tabs [role="tab"]')?.id;
    tabs.replaceChildren(...WARDROBE_SLOTS.map(([slot]) => {
      const label = t('wardrobeSlots.' + slot) || slot;
      const button = document.createElement('button');
      button.type = 'button';
      button.role = 'tab';
      button.id = `wardrobe-tab-${slot}`;
      button.setAttribute('aria-controls', 'wardrobe-items');
      button.setAttribute('aria-selected', String(state.designer.selectedSlot === slot));
      button.tabIndex = state.designer.selectedSlot === slot ? 0 : -1;
      button.textContent = label;
      button.addEventListener('click', () => store.dispatch({ type: 'designer/selectSlot', slot }));
      bindRovingKeydown(button, WARDROBE_SLOTS.map(([value]) => value), state.designer.selectedSlot, (nextSlot) => {
        store.dispatch({ type: 'designer/selectSlot', slot: nextSlot });
      }, () => tabs.querySelector('[aria-selected="true"]'));
      return button;
    }));
    if (focusedTabId) requestAnimationFrame(() => {
      if (token === designerRenderToken) $(`#${focusedTabId}`)?.focus();
    });
    items.setAttribute('aria-labelledby', `wardrobe-tab-${state.designer.selectedSlot}`);

    const styleNav = $('#style-filter-nav');
    if (styleNav) {
      const activeStyle = state.designer.selectedStyleFilter || 'all';
      const focusedStyle = document.activeElement?.closest?.('#style-filter-nav [data-style]')?.dataset.style;
      styleNav.replaceChildren(...PRESENTATION_STYLES.map((style) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('role', 'radio');
        btn.className = `style-pill${activeStyle === style ? ' is-active' : ''}`;
        btn.dataset.style = style;
        btn.setAttribute('aria-checked', String(activeStyle === style));
        btn.tabIndex = activeStyle === style ? 0 : -1;
        btn.textContent = t('styleFilters.' + style) || style;
        btn.addEventListener('click', () => store.dispatch({ type: 'designer/setStyleFilter', style }));
        bindRovingKeydown(btn, PRESENTATION_STYLES, activeStyle, (nextStyle) => {
          store.dispatch({ type: 'designer/setStyleFilter', style: nextStyle });
        }, () => styleNav.querySelector('[aria-checked="true"]'));
        return btn;
      }));
      if (focusedStyle) requestAnimationFrame(() => {
        if (token === designerRenderToken) styleNav.querySelector(`[data-style="${focusedStyle}"]`)?.focus();
      });
    }

    const activeStyle = state.designer.selectedStyleFilter || 'all';
    const builtins = getOfferedWearables(state.designer.selectedSlot, state.designer.draft.baseDollId, activeStyle);
    const targetFit = getAsset(state.designer.draft.baseDollId)?.fitFamily;
    const customs = (state.customAssets || [])
      .filter((a) => a.kind === 'wearable' && a.slot === state.designer.selectedSlot && a.status === 'available' && a.libraryVisible !== false)
      .map(customAssetToDescriptor)
      .filter((asset) => matchesDiscoveryFilters(asset, targetFit || 'teen', activeStyle));
    const allWearables = [...builtins, ...customs];

    const focusedAssetId = document.activeElement?.closest?.('#wardrobe-items [data-asset-id]')?.dataset.assetId;
    const cards = allWearables.map((asset) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `asset-card${asset.custom ? ' is-custom-asset' : ''}`;
      button.draggable = true;
      button.dataset.assetId = asset.id;
      button.setAttribute('aria-pressed', String(state.designer.draft.slots[asset.slot]?.assetId === asset.id));
      const displayName = assetName(asset);
      button.setAttribute('aria-label', t('designer.equipAssetAria', { name: displayName, custom: asset.custom ? ` (${t('designer.customBadgeTitle')})` : '' }));
      const preview = document.createElement('span');
      preview.className = 'asset-card-preview';
      const label = document.createElement('span');
      label.textContent = displayName;
      button.append(preview, label);
      if (asset.custom) {
        const badge = document.createElement('span');
        badge.className = 'custom-art-badge';
        badge.textContent = '🎨';
        badge.title = t('designer.customBadgeTitle');
        badge.setAttribute('aria-hidden', 'true');
        button.append(badge);
      }
      button.addEventListener('click', () => {
        const currentEquipped = state.designer.draft.slots[asset.slot]?.assetId;
        if (currentEquipped === asset.id && asset.slot !== 'hair') {
          store.dispatch({ type: 'designer/remove', slot: asset.slot });
        } else {
          store.dispatch({ type: 'designer/equip', assetId: asset.id });
        }
      });
      button.addEventListener('dragstart', (event) => {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain', `paper-doll-wearable:${asset.id}`);
        button.classList.add('is-dragging');
      });
      button.addEventListener('dragend', () => button.classList.remove('is-dragging'));
      void renderAssetPreview(preview, asset, { customArtRepo, getAsset });
      return button;
    });

    if (WARDROBE_SLOTS.some(([slot]) => slot === state.designer.selectedSlot)) {
      const slotName = t('wardrobeSlots.' + state.designer.selectedSlot) || state.designer.selectedSlot;
      const paintBtn = document.createElement('button');
      paintBtn.type = 'button';
      paintBtn.className = 'asset-card paint-item-action-card';
      paintBtn.setAttribute('aria-label', t('designer.paintSlotAria', { slot: slotName }));
      const preview = document.createElement('span');
      preview.className = 'asset-card-preview';
      preview.textContent = '🎨';
      const label = document.createElement('span');
      label.textContent = t('designer.paintSlotAction', { slot: slotName });
      paintBtn.append(preview, label);
      paintBtn.addEventListener('click', () => {
        if (openPaintStudio) {
          openPaintStudio({
            itemType: 'wearable',
            slot: state.designer.selectedSlot,
            originContext: 'designer',
            baseDollId: state.designer.draft.baseDollId
          });
        } else {
          window.location.hash = '#paint';
        }
      });
      cards.push(paintBtn);
    }

    const selectedHair = state.designer.selectedSlot === 'hair' ? state.designer.draft.slots.hair : null;
    if (selectedHair && isCustomAssetId(selectedHair.assetId)) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'asset-card paint-item-action-card';
      editBtn.setAttribute('aria-label', t('designer.editCustomHairAria'));
      editBtn.textContent = t('designer.editCustomHair');
      editBtn.addEventListener('click', () => openPaintStudio?.({
        itemType: 'wearable',
        slot: 'hair',
        originContext: 'designer',
        baseDollId: state.designer.draft.baseDollId,
        editAssetId: selectedHair.assetId
      }));
      cards.push(editBtn);
    }

    items.replaceChildren(...cards);
    if (focusedAssetId) requestAnimationFrame(() => {
      if (token === designerRenderToken) items.querySelector(`[data-asset-id="${focusedAssetId}"]`)?.focus();
    });
  }

  function renderFace(state, token) {
    const tabs = $('#face-tabs');
    const items = $('#face-items');
    if (!tabs || !items) return;
    const selectedGroup = state.designer.selectedFaceGroup || 'eyes';
    const draft = state.designer.draft;
    const face = draft.face;
    const focusedTabId = document.activeElement?.closest?.('#face-tabs [role="tab"]')?.id;

    tabs.replaceChildren(...FACE_GROUPS.map((group) => {
      const label = t('faceGroups.' + group) || group;
      const button = document.createElement('button');
      button.type = 'button';
      button.role = 'tab';
      button.id = `face-tab-${group}`;
      button.setAttribute('aria-controls', 'face-items');
      button.setAttribute('aria-selected', String(selectedGroup === group));
      button.tabIndex = selectedGroup === group ? 0 : -1;
      button.textContent = label;
      button.addEventListener('click', () => store.dispatch({ type: 'designer/selectFaceGroup', group }));
      bindRovingKeydown(button, FACE_GROUPS, selectedGroup, (nextGroup) => {
        store.dispatch({ type: 'designer/selectFaceGroup', group: nextGroup });
      }, () => tabs.querySelector('[aria-selected="true"]'));
      return button;
    }));
    if (focusedTabId) requestAnimationFrame(() => {
      if (token === designerRenderToken) $(`#${focusedTabId}`)?.focus();
    });

    items.setAttribute('aria-labelledby', `face-tab-${selectedGroup}`);

    const irisContainer = $('#iris-color-picker-group');
    if (irisContainer) {
      if (selectedGroup === 'eyes') {
        irisContainer.style.display = 'flex';
        const irisPalette = $('#iris-palette');
        if (irisPalette) {
          const currentIris = face?.eyes?.irisColor || 'cocoa';
          renderSwatches(irisPalette, IRIS_COLORS, currentIris, (color) => store.dispatch({ type: 'designer/setIrisColor', color }));
        }
      } else {
        irisContainer.style.display = 'none';
      }
    }

    const focusedAssetId = document.activeElement?.closest?.('#face-items [data-asset-id]')?.dataset.assetId;
    const faceAssets = facesByGroup(selectedGroup, getAsset(draft.baseDollId)?.fitFamily || 'teen');
    const cards = faceAssets.map((asset) => {
      const isSelected = face?.[selectedGroup]?.assetId === asset.id;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'asset-card';
      button.dataset.assetId = asset.id;
      button.setAttribute('aria-pressed', String(isSelected));
      const displayName = assetName(asset);
      button.setAttribute('aria-label', t('designer.equipFaceAria', { name: displayName }));
      const preview = document.createElement('span');
      preview.className = 'asset-card-preview';
      const label = document.createElement('span');
      label.textContent = displayName;
      button.append(preview, label);

      button.addEventListener('click', () => {
        store.dispatch({ type: 'designer/setFaceFeature', group: selectedGroup, assetId: asset.id });
      });

      const previewColor = selectedGroup === 'eyes' ? (face?.eyes?.irisColor || 'cocoa') : undefined;
      void renderAssetPreview(preview, asset, { customArtRepo, getAsset, color: previewColor });
      return button;
    });

    items.replaceChildren(...cards);
    if (focusedAssetId) requestAnimationFrame(() => {
      if (token === designerRenderToken) items.querySelector(`[data-asset-id="${focusedAssetId}"]`)?.focus();
    });
  }

  function renderDollModels(container, selectedDollId) {
    if (!container) return;
    const focusedDollId = document.activeElement?.closest?.('.model-picker-btn')?.dataset.assetId;
    const dollAssets = dollsForLifeStagePicker();
    const selectedDoll = getBuiltinAsset(selectedDollId);
    const selectedLifeStage = selectedDoll?.lifeStages?.[0];
    container.replaceChildren(...dollAssets.map((asset) => {
      const lifeStage = asset.lifeStages?.[0];
      const modelLabel = lifeStage ? t(`lifeStages.${lifeStage}`) : asset.name;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'model-picker-btn';
      button.dataset.assetId = asset.id;
      button.setAttribute('aria-label', modelLabel);
      button.setAttribute('aria-pressed', String(asset.id === selectedDollId || lifeStage === selectedLifeStage));
      button.title = modelLabel;
      button.textContent = modelLabel;
      button.addEventListener('click', () => store.dispatch({ type: 'designer/setBaseDoll', baseDollId: asset.id }));
      return button;
    }));
    if (focusedDollId) requestAnimationFrame(() => container.querySelector(`[data-asset-id="${focusedDollId}"]`)?.focus());
  }

  function renderPalettes(state) {
    const draft = state.designer.draft;
    renderDollModels($('#doll-model-palette'), draft.baseDollId);
    const skinPalette = $('#skin-palette');
    if (skinPalette) renderSwatches(skinPalette, SKIN_COLORS, draft.skinTone, (color) => store.dispatch({ type: 'designer/setSkin', color }));
    const hairPalette = $('#hair-palette');
    if (draft.slots.hair) {
      if (isCustomAssetId(draft.slots.hair.assetId)) {
        hairPalette?.replaceChildren(Object.assign(document.createElement('p'), {
          textContent: t('designer.customArtColorNote'),
          className: 'empty-note custom-art-note'
        }));
      } else {
        if (hairPalette) renderSwatches(hairPalette, HAIR_COLORS, draft.slots.hair.color, (color) => store.dispatch({ type: 'designer/setColor', slot: 'hair', color }));
      }
    } else {
      hairPalette?.replaceChildren(Object.assign(document.createElement('span'), { className: 'empty-note compact-note', textContent: t('designer.equipHairFirst') }));
    }
    const slot = state.designer.selectedSlot;
    const selectedItem = draft.slots[slot];
    const isCustom = selectedItem && isCustomAssetId(selectedItem.assetId);
    const colors = slot === 'hair' ? HAIR_COLORS : GARMENT_COLORS;
    const container = $('#piece-palette');
    if (!container) return;
    if (!selectedItem) {
      container.replaceChildren(Object.assign(document.createElement('p'), { textContent: t('designer.choosePieceFirst'), className: 'empty-note' }));
    } else if (isCustom) {
      container.replaceChildren(Object.assign(document.createElement('p'), {
        textContent: t('designer.customArtColorNote'),
        className: 'empty-note custom-art-note'
      }));
    } else {
      renderSwatches(container, colors, selectedItem.color, (color) => store.dispatch({ type: 'designer/setColor', slot, color }));
    }
    const custom = $('#custom-color');
    if (custom) {
      custom.disabled = !selectedItem || isCustom;
      custom.value = paletteValue(selectedItem?.color, slot === 'hair' ? 'brown' : 'coral');
    }
  }

  function renderDollbox(state) {
    const list = $('#dollbox-list');
    if (!list) return;
    // `updatedAt` must stay in the signature: preset/update keeps the same id and
    // name while replacing the whole draft, so appearance-only edits would
    // otherwise leave a stale card image. Language is included because the row
    // actions are localized.
    const signature = JSON.stringify({
      language: getCurrentLanguage(),
      presets: state.presets.map(({ presetId, name, updatedAt }) => [presetId, name, updatedAt ?? null])
    });
    if (signature === dollboxSignature) return;
    dollboxSignature = signature;
    const token = ++dollboxRenderToken;
    const focusedAction = document.activeElement?.closest?.('#dollbox-list [data-preset-action]');
    const focusedPresetId = focusedAction?.dataset.presetId;
    const focusedActionName = focusedAction?.dataset.presetAction;
    if (!state.presets.length) {
      list.replaceChildren(Object.assign(document.createElement('p'), { className: 'empty-note', textContent: t('designer.emptyDollbox') }));
      return;
    }
    const tagAction = (button, presetId, action) => {
      button.dataset.presetAction = action;
      button.dataset.presetId = presetId;
      return button;
    };
    list.replaceChildren(...state.presets.map((preset) => {
      const row = document.createElement('article');
      row.className = 'dollbox-item';
      const preview = document.createElement('div');
      preview.className = 'dollbox-preview';
      preview.setAttribute('aria-hidden', 'true');
      const name = document.createElement('div');
      name.className = 'dollbox-name';
      name.textContent = preset.name;
      name.title = preset.name;
      const actions = document.createElement('div');
      actions.className = 'mini-actions';
      actions.append(
        tagAction(miniButton('✎', t('designer.openInDesigner', { name: preset.name }), () => store.dispatch({ type: 'preset/load', presetId: preset.presetId })), preset.presetId, 'load'),
        tagAction(miniButton('Aa', t('designer.renameTitle', { name: preset.name }), async () => {
          const nextName = await askPrompt(t('designer.renameTitle', { name: preset.name }), t('designer.renamePrompt'), preset.name);
          if (nextName != null && nextName.trim()) {
            store.dispatch({ type: 'preset/rename', presetId: preset.presetId, name: nextName });
          }
        }), preset.presetId, 'rename'),
        tagAction(miniButton('×', t('designer.deleteConfirmTitle', { name: preset.name }), async () => {
          if (await askConfirm(t('designer.deleteConfirmTitle', { name: preset.name }), t('designer.deleteConfirmMessage'))) {
            store.dispatch({ type: 'preset/delete', presetId: preset.presetId });
          }
        }), preset.presetId, 'delete')
      );
      row.append(preview, name, actions);
      void renderDollInto(preview, preset, { customArtRepo, getAsset }).then(() => {
        if (token !== dollboxRenderToken) preview.replaceChildren();
      });
      return row;
    }));
    if (focusedPresetId && focusedActionName) {
      list.querySelector(`[data-preset-id="${focusedPresetId}"][data-preset-action="${focusedActionName}"]`)?.focus();
    }
  }

  async function render(state = store.getState()) {
    const token = ++designerRenderToken;
    const draft = state.designer.draft;
    const activeTab = state.designer.activeTab || 'wardrobe';

    const wardrobeModeBtn = $('#designer-mode-wardrobe');
    const faceModeBtn = $('#designer-mode-face');
    const wardrobeSection = $('#wardrobe-panel-section');
    const faceSection = $('#face-panel-section');

    if (wardrobeModeBtn && faceModeBtn) {
      wardrobeModeBtn.setAttribute('aria-selected', String(activeTab === 'wardrobe'));
      wardrobeModeBtn.classList.toggle('is-active', activeTab === 'wardrobe');
      faceModeBtn.setAttribute('aria-selected', String(activeTab === 'face'));
      faceModeBtn.classList.toggle('is-active', activeTab === 'face');
    }

    if (wardrobeSection && faceSection) {
      wardrobeSection.style.display = activeTab === 'wardrobe' ? '' : 'none';
      faceSection.style.display = activeTab === 'face' ? '' : 'none';
    }

    if (activeTab === 'face') {
      renderFace(state, token);
    } else {
      renderWardrobe(state, token);
    }

    renderPalettes(state);
    renderDollbox(state);
    const pieceCount = Object.values(draft.slots).filter(Boolean).length;
    $('#outfit-count').textContent = t('designer.outfitCount', { count: pieceCount });
    $('#remove-piece').disabled = !draft.slots[state.designer.selectedSlot];

    const editing = state.presets.find((preset) => preset.presetId === state.designer.editingPresetId);
    const nameInput = $('#doll-name');
    if (document.activeElement !== nameInput) nameInput.value = editing?.name ?? '';
    $('#update-preset').disabled = !editing;

    const stage = $('#doll-stage');
    const language = getCurrentLanguage();
    if (lastRenderedLanguage === language && patchDollColors(stage, lastRenderedDraft, draft)) {
      lastRenderedDraft = draft;
      stage.setAttribute('aria-label', describeOutfit(draft, getAsset));
      return;
    }
    const stagedDoll = document.createElement('div');
    await renderDollInto(stagedDoll, draft, { customArtRepo, getAsset });
    if (token !== designerRenderToken) return;
    stage.replaceChildren(...stagedDoll.childNodes);
    lastRenderedDraft = draft;
    lastRenderedLanguage = language;
    stage.setAttribute('aria-label', describeOutfit(draft, getAsset));
  }

  function bumpToken() {
    designerRenderToken += 1;
  }

  return {
    render,
    bumpToken,
    renderDollInto: (container, draft, options = {}) => renderDollInto(container, draft, { customArtRepo, getAsset, ...options }),
    describeOutfit: (draft) => describeOutfit(draft, getAsset),
    previewCustomColor
  };
}
