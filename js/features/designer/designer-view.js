/**
 * Designer View Feature Module
 * Owns wardrobe palettes, dress-up layers, swatch picking, and Dollbox presets.
 */

import { assetsByKind, wearablesBySlot, getAsset } from '../../core/asset-catalog.js';
import { GARMENT_COLORS, HAIR_COLORS, PALETTE, paletteValue, SKIN_COLORS } from '../../core/palette.js';
import { loadAssetSvg, makeAssetPlaceholder } from '../../core/svg-loader.js';
import { DEFAULT_EXPRESSION } from '../../domain/vocabulary.js';
import { applyMouthExpression } from '../../services/export-service.js';

export const WARDROBE_SLOTS = [
  ['top', 'Tops'],
  ['bottom', 'Bottoms'],
  ['dress', 'Dresses'],
  ['shoes', 'Shoes'],
  ['hair', 'Hair'],
  ['accessory', 'Accessories']
];

export function describeOutfit(draft) {
  const names = Object.values(draft.slots).filter(Boolean).map((item) => getAsset(item.assetId)?.name).filter(Boolean);
  return names.length ? `Paper doll wearing ${names.join(', ')}.` : 'Paper doll with no outfit pieces.';
}

export const SLOT_PREVIEW_VIEWBOX = Object.freeze({
  top: '80 85 140 125',
  bottom: '90 170 120 180',
  dress: '60 105 180 270',
  shoes: '105 345 90 70',
  hair: '70 15 160 175',
  accessory: '90 0 120 80'
});

export async function appendAsset(container, assetId, { color, isPreview = false } = {}) {
  try {
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

export async function renderAssetPreview(container, asset) {
  container.replaceChildren();
  await appendAsset(container, asset.id, { color: asset.defaultColors?.primary, isPreview: true });
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

  const nodes = await Promise.all(layers.map(async ([order, id, color, group, slot]) => {
    const layer = document.createElement('span');
    layer.className = 'doll-layer';
    layer.dataset.slot = slot;
    layer.style.zIndex = String(order);
    layer.style.setProperty('--skin-color', paletteValue(draft.skinTone, 'peach'));
    layer.style.setProperty('--hair-color', paletteValue(color, 'brown'));
    layer.style.setProperty('--asset-color-primary', paletteValue(color, 'coral'));
    try {
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
  miniButton
}) {
  let designerRenderToken = 0;

  function renderSwatches(container, tokens, selected, onSelect) {
    container.replaceChildren(...tokens.map((token) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'swatch';
      button.style.setProperty('--swatch', paletteValue(token));
      button.setAttribute('aria-label', PALETTE[token].name);
      button.setAttribute('aria-pressed', String(token === selected));
      button.title = PALETTE[token].name;
      button.addEventListener('click', () => onSelect(token));
      return button;
    }));
  }

  function renderWardrobe(state, token) {
    const tabs = $('#wardrobe-tabs');
    const items = $('#wardrobe-items');
    const focusedTabId = document.activeElement?.closest?.('#wardrobe-tabs [role="tab"]')?.id;
    tabs.replaceChildren(...WARDROBE_SLOTS.map(([slot, label]) => {
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
    items.replaceChildren(...wearablesBySlot(state.designer.selectedSlot).map((asset) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'asset-card';
      button.draggable = true;
      button.dataset.assetId = asset.id;
      button.setAttribute('aria-pressed', String(state.designer.draft.slots[asset.slot]?.assetId === asset.id));
      button.setAttribute('aria-label', `Equip ${asset.name}`);
      const preview = document.createElement('span');
      preview.className = 'asset-card-preview';
      const label = document.createElement('span');
      label.textContent = asset.name;
      button.append(preview, label);
      button.addEventListener('click', () => store.dispatch({ type: 'designer/equip', assetId: asset.id }));
      button.addEventListener('dragstart', (event) => {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain', `paper-doll-wearable:${asset.id}`);
        button.classList.add('is-dragging');
      });
      button.addEventListener('dragend', () => button.classList.remove('is-dragging'));
      void renderAssetPreview(preview, asset);
      return button;
    }));
  }

  function renderDollModels(container, selectedDollId) {
    if (!container) return;
    const dollAssets = assetsByKind('doll');
    container.replaceChildren(...dollAssets.map((asset) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'model-picker-btn';
      button.setAttribute('aria-label', asset.name);
      button.setAttribute('aria-pressed', String(asset.id === selectedDollId));
      button.title = asset.name;
      button.textContent = asset.id === 'doll_classic_a' ? 'Classic' : asset.id === 'doll_classic_b' ? 'Joy' : 'Chibi';
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
      $('#hair-palette').replaceChildren(Object.assign(document.createElement('span'), { className: 'empty-note compact-note', textContent: 'Equip hair first' }));
    }
    const slot = state.designer.selectedSlot;
    const selectedItem = draft.slots[slot];
    const colors = slot === 'hair' ? HAIR_COLORS : GARMENT_COLORS;
    const container = $('#piece-palette');
    if (!selectedItem) {
      container.replaceChildren(Object.assign(document.createElement('p'), { textContent: 'Choose or equip a piece first.', className: 'empty-note' }));
    } else {
      renderSwatches(container, colors, selectedItem.color, (color) => store.dispatch({ type: 'designer/setColor', slot, color }));
    }
    const custom = $('#custom-color');
    custom.disabled = !selectedItem;
    custom.value = paletteValue(selectedItem?.color, slot === 'hair' ? 'brown' : 'coral');
  }

  function renderDollbox(state, token) {
    const list = $('#dollbox-list');
    if (!state.presets.length) {
      list.replaceChildren(Object.assign(document.createElement('p'), { className: 'empty-note', textContent: 'Saved dolls will appear here and in the Play tray.' }));
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
        miniButton('✎', `Open ${preset.name} in Designer`, () => store.dispatch({ type: 'preset/load', presetId: preset.presetId })),
        miniButton('Aa', `Rename ${preset.name}`, () => {
          const nextName = window.prompt('Rename doll', preset.name);
          if (nextName != null && nextName.trim()) {
            store.dispatch({ type: 'preset/rename', presetId: preset.presetId, name: nextName });
          }
        }),
        miniButton('×', `Delete ${preset.name}`, async () => {
          if (await askConfirm(`Delete "${preset.name}"?`, 'This removes the doll from your Dollbox and future scenes.')) {
            store.dispatch({ type: 'preset/delete', presetId: preset.presetId });
          }
        })
      );
      row.append(preview, name, actions);
      void renderDollInto(preview, preset).then(() => {
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
    $('#outfit-count').textContent = `${Object.values(draft.slots).filter(Boolean).length} pieces`;
    $('#remove-piece').disabled = !draft.slots[state.designer.selectedSlot];

    const editing = state.presets.find((preset) => preset.presetId === state.designer.editingPresetId);
    const nameInput = $('#doll-name');
    if (document.activeElement !== nameInput) nameInput.value = editing?.name ?? '';
    $('#update-preset').disabled = !editing;

    const stage = $('#doll-stage');
    const stagedDoll = document.createElement('div');
    await renderDollInto(stagedDoll, draft);
    if (token !== designerRenderToken) return;
    stage.replaceChildren(...stagedDoll.childNodes);
    stage.setAttribute('aria-label', describeOutfit(draft));
  }

  function bumpToken() {
    designerRenderToken += 1;
  }

  return {
    render,
    bumpToken,
    renderDollInto,
    describeOutfit,
    previewCustomColor
  };
}
