/**
 * Designer View Feature Module
 * Owns wardrobe palettes, dress-up layers, swatch picking, and Dollbox presets.
 */

import { assetsByKind, wearablesBySlot, getAsset as getBuiltinAsset } from '../../core/asset-catalog.js';
import { GARMENT_COLORS, HAIR_COLORS, PALETTE, paletteValue, SKIN_COLORS } from '../../core/palette.js';
import { loadAssetSvg, makeAssetPlaceholder } from '../../core/svg-loader.js';
import { DEFAULT_EXPRESSION, isCustomAssetId } from '../../domain/vocabulary.js';
import { customAssetToDescriptor } from '../../core/asset-registry.js';
import { applyMouthExpression } from '../../services/export-service.js';
import { t } from '../../core/i18n.js';

export const WARDROBE_SLOTS = [
  ['top', 'Tops'],
  ['bottom', 'Bottoms'],
  ['dress', 'Dresses'],
  ['shoes', 'Shoes'],
  ['hair', 'Hair'],
  ['accessory', 'Accessories']
];

export function describeOutfit(draft, getAsset = getBuiltinAsset) {
  const names = Object.values(draft.slots).filter(Boolean).map((item) => getAsset(item.assetId)?.name).filter(Boolean);
  return names.length ? t('designer.outfitWearing', { items: names.join(', ') }) : t('designer.outfitEmpty');
}


export const SLOT_PREVIEW_VIEWBOX = Object.freeze({
  top: '80 85 140 125',
  bottom: '90 170 120 180',
  dress: '60 105 180 270',
  shoes: '105 345 90 70',
  hair: '70 15 160 175',
  accessory: '90 0 120 80'
});

export async function appendAsset(container, assetId, { color, isPreview = false, customArtRepo, getAsset = getBuiltinAsset } = {}) {
  try {
    if (isCustomAssetId(assetId)) {
      const url = await customArtRepo?.getTrackedObjectUrl?.(assetId);
      if (url) {
        if (isPreview) {
          const img = document.createElement('img');
          img.src = url;
          img.alt = getAsset(assetId)?.name ?? 'Custom art';
          img.className = 'custom-art-card-thumb';
          container.append(img);
          return;
        }
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 300 450');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttribute('href', url);
        img.setAttribute('x', '0');
        img.setAttribute('y', '0');
        img.setAttribute('width', '300');
        img.setAttribute('height', '450');
        img.setAttribute('preserveAspectRatio', 'none');
        svg.appendChild(img);
        container.append(svg);
        return;
      }
    }
    const svg = await loadAssetSvg(assetId);
    const asset = getAsset(assetId);
    container.style.setProperty('--asset-color-primary', paletteValue(color ?? asset?.defaultColors?.primary, 'coral'));
    container.style.setProperty('--hair-color', paletteValue(color ?? asset?.defaultColors?.primary, 'brown'));
    if (isPreview && asset?.kind === 'wearable' && SLOT_PREVIEW_VIEWBOX[asset.slot]) {
      svg.setAttribute('viewBox', SLOT_PREVIEW_VIEWBOX[asset.slot]);
    }
    container.append(svg);
  } catch {
    container.append(makeAssetPlaceholder(getAsset(assetId)?.name ?? 'Asset'));
  }
}

export async function renderAssetPreview(container, asset, options = {}) {
  container.replaceChildren();
  await appendAsset(container, asset.id, {
    color: asset.defaultColors?.primary,
    isPreview: true,
    customArtRepo: options.customArtRepo,
    getAsset: options.getAsset
  });
}

export async function renderDollInto(container, draft, options = {}) {
  const layers = [];
  const hair = draft.slots.hair;
  if (hair) layers.push([10, hair.assetId, hair.color, 'hairBack', 'hair']);
  layers.push([20, draft.baseDollId, null, null, 'skin']);
  for (const [slot, order] of [['bottom', 30], ['shoes', 35], ['top', 40], ['dress', 45]]) {
    const item = draft.slots[slot];
    if (item) layers.push([order, item.assetId, item.color, null, slot]);
  }
  if (hair) layers.push([70, hair.assetId, hair.color, 'hairFront', 'hair']);
  const accessory = draft.slots.accessory;
  if (accessory) layers.push([80, accessory.assetId, accessory.color, null, 'accessory']);

  const expression = options.expression || draft.expression || DEFAULT_EXPRESSION;
  const customArtRepo = options.customArtRepo;
  const getAsset = options.getAsset ?? getBuiltinAsset;

  const nodes = await Promise.all(layers.map(async ([order, id, color, group, slot]) => {
    const layer = document.createElement('span');
    layer.className = 'doll-layer';
    layer.dataset.slot = slot;
    layer.style.zIndex = String(order);
    layer.style.setProperty('--skin-color', paletteValue(draft.skinTone, 'peach'));
    layer.style.setProperty('--hair-color', paletteValue(color, 'brown'));
    layer.style.setProperty('--asset-color-primary', paletteValue(color, 'coral'));
    try {
      if (isCustomAssetId(id)) {
        const url = await customArtRepo?.getTrackedObjectUrl?.(id) || await options.getCustomArtUrl?.(id);
        if (url) {
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
          layer.append(svg);
          return layer;
        }
      }
      const svg = await loadAssetSvg(id);
      if (group) {
        for (const candidate of ['hairBack', 'hairFront']) {
          const node = svg.querySelector(`#${candidate}`);
          if (node && candidate !== group) node.style.display = 'none';
        }
      }
      if (slot === 'skin') {
        applyMouthExpression(svg, expression);
      }
      layer.append(svg);
    } catch {
      layer.append(makeAssetPlaceholder(getAsset(id)?.name ?? 'Asset'));
    }
    return layer;
  }));
  container.replaceChildren(...nodes);
}

export function previewCustomColor(color, slot = 'top') {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return;
  const layers = document.querySelectorAll(`#doll-stage .doll-layer[data-slot="${slot}"]`);
  for (const layer of layers) {
    layer.style.setProperty(slot === 'hair' ? '--hair-color' : '--asset-color-primary', color);
  }
}

export function createDesignerView({
  store,
  $,
  $$,
  askConfirm,
  miniButton,
  customArtRepo,
  openPaintStudio,
  getAsset = getBuiltinAsset
}) {
  let designerRenderToken = 0;

  function renderSwatches(container, tokens, selected, onSelect) {
    container.replaceChildren(...tokens.map((token) => {
      const colorName = t('colors.' + token) || PALETTE[token]?.name || token;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'swatch';
      button.style.setProperty('--swatch', paletteValue(token));
      button.setAttribute('aria-label', colorName);
      button.setAttribute('aria-pressed', String(token === selected));
      button.title = colorName;
      button.addEventListener('click', () => onSelect(token));
      return button;
    }));
  }

  function renderWardrobe(state, token) {
    const tabs = $('#wardrobe-tabs');
    const items = $('#wardrobe-items');
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
      return button;
    }));
    if (focusedTabId) requestAnimationFrame(() => {
      if (token === designerRenderToken) $(`#${focusedTabId}`)?.focus();
    });
    items.setAttribute('aria-labelledby', `wardrobe-tab-${state.designer.selectedSlot}`);

    const builtins = wearablesBySlot(state.designer.selectedSlot);
    const customs = (state.customAssets || [])
      .filter((a) => a.kind === 'wearable' && a.slot === state.designer.selectedSlot && a.status === 'available' && a.libraryVisible !== false)
      .map(customAssetToDescriptor);
    const allWearables = [...builtins, ...customs];

    const cards = allWearables.map((asset) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `asset-card${asset.custom ? ' is-custom-asset' : ''}`;
      button.draggable = true;
      button.dataset.assetId = asset.id;
      button.setAttribute('aria-pressed', String(state.designer.draft.slots[asset.slot]?.assetId === asset.id));
      button.setAttribute('aria-label', t('designer.equipAssetAria', { name: asset.name, custom: asset.custom ? ` (${t('designer.customBadgeTitle')})` : '' }));
      const preview = document.createElement('span');
      preview.className = 'asset-card-preview';
      const label = document.createElement('span');
      label.textContent = asset.name;
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
        if (currentEquipped === asset.id && !['skin', 'hair'].includes(asset.slot)) {
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

    if (['top', 'bottom', 'dress', 'shoes', 'accessory'].includes(state.designer.selectedSlot)) {
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
            originContext: 'designer'
          });
        } else {
          window.location.hash = '#paint';
        }
      });
      cards.push(paintBtn);
    }

    items.replaceChildren(...cards);
  }

  function renderDollModels(container, selectedDollId) {
    if (!container) return;
    const dollAssets = assetsByKind('doll');
    container.replaceChildren(...dollAssets.map((asset) => {
      const modelLabel = t('models.' + asset.id) || (asset.id === 'doll_classic_a' ? 'Klasik' : asset.id === 'doll_classic_b' ? 'Neşeli' : 'Chibi');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'model-picker-btn';
      button.setAttribute('aria-label', asset.name);
      button.setAttribute('aria-pressed', String(asset.id === selectedDollId));
      button.title = asset.name;
      button.textContent = modelLabel;
      button.addEventListener('click', () => store.dispatch({ type: 'designer/setBaseDoll', baseDollId: asset.id }));
      return button;
    }));
  }

  function renderPalettes(state) {
    const draft = state.designer.draft;
    renderDollModels($('#doll-model-palette'), draft.baseDollId);
    renderSwatches($('#skin-palette'), SKIN_COLORS, draft.skinTone, (color) => store.dispatch({ type: 'designer/setSkin', color }));
    if (draft.slots.hair) {
      renderSwatches($('#hair-palette'), HAIR_COLORS, draft.slots.hair.color, (color) => store.dispatch({ type: 'designer/setColor', slot: 'hair', color }));
    } else {
      $('#hair-palette').replaceChildren(Object.assign(document.createElement('span'), { className: 'empty-note compact-note', textContent: t('designer.equipHairFirst') }));
    }
    const slot = state.designer.selectedSlot;
    const selectedItem = draft.slots[slot];
    const isCustom = selectedItem && isCustomAssetId(selectedItem.assetId);
    const colors = slot === 'hair' ? HAIR_COLORS : GARMENT_COLORS;
    const container = $('#piece-palette');
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
    custom.disabled = !selectedItem || isCustom;
    custom.value = paletteValue(selectedItem?.color, slot === 'hair' ? 'brown' : 'coral');
  }

  function renderDollbox(state, token) {
    const list = $('#dollbox-list');
    if (!state.presets.length) {
      list.replaceChildren(Object.assign(document.createElement('p'), { className: 'empty-note', textContent: t('designer.emptyDollbox') }));
      return;
    }
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
        miniButton('✎', t('designer.openInDesigner', { name: preset.name }), () => store.dispatch({ type: 'preset/load', presetId: preset.presetId })),
        miniButton('Aa', t('designer.renameTitle', { name: preset.name }), () => {
          const nextName = window.prompt(t('designer.renamePrompt'), preset.name);
          if (nextName != null && nextName.trim()) {
            store.dispatch({ type: 'preset/rename', presetId: preset.presetId, name: nextName });
          }
        }),
        miniButton('×', t('designer.deleteConfirmTitle', { name: preset.name }), async () => {
          if (await askConfirm(t('designer.deleteConfirmTitle', { name: preset.name }), t('designer.deleteConfirmMessage'))) {
            store.dispatch({ type: 'preset/delete', presetId: preset.presetId });
          }
        })
      );
      row.append(preview, name, actions);
      void renderDollInto(preview, preset, { customArtRepo, getAsset }).then(() => {
        if (token !== designerRenderToken) preview.replaceChildren();
      });
      return row;
    }));
  }

  async function render(state = store.getState()) {
    const token = ++designerRenderToken;
    const draft = state.designer.draft;
    renderWardrobe(state, token);
    renderPalettes(state);
    renderDollbox(state, token);
    const pieceCount = Object.values(draft.slots).filter(Boolean).length;
    $('#outfit-count').textContent = t('designer.outfitCount', { count: pieceCount });
    $('#remove-piece').disabled = !draft.slots[state.designer.selectedSlot];


    const editing = state.presets.find((preset) => preset.presetId === state.designer.editingPresetId);
    const nameInput = $('#doll-name');
    if (document.activeElement !== nameInput) nameInput.value = editing?.name ?? '';
    $('#update-preset').disabled = !editing;

    const stage = $('#doll-stage');
    const stagedDoll = document.createElement('div');
    await renderDollInto(stagedDoll, draft, { customArtRepo, getAsset });
    if (token !== designerRenderToken) return;
    stage.replaceChildren(...stagedDoll.childNodes);
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
