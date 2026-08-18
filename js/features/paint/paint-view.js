/**
 * Custom Paint Studio — Feature View & Controller
 * Integrates responsive UI, authoring canvas, pointer & keyboard drawing,
 * live preview, toolbars, palette, save pipeline, and draft recovery.
 */

import { createPaintSession } from './paint-session.js';
import {
  applyStroke,
  interpolateStrokePoints,
  executeFloodFill,
  drawShape,
  samplePixel
} from './paint-raster.js';
import {
  CUSTOM_WEARABLE_DIMENSIONS,
  CUSTOM_PROP_DIMENSIONS
} from '../../domain/vocabulary.js';
import { slotLabel } from '../../domain/outfit-rules.js';
import { getReferenceGuides, guideIsInBounds } from './paint-guides.js';
import { t } from '../../core/i18n.js';
import { SLOT_CUTOUT_FALLBACK_VIEWBOX } from '../../core/preview-viewboxes.js';
import {
  captureHistorySnapshot,
  cropHistorySnapshot,
  historySnapshotChanged,
  restoreHistorySnapshot
} from './paint-history.js';
import { createPaintLibraryView } from './paint-library-view.js';
import { createPaintSaveService } from './paint-save-service.js';


const CURATED_PALETTE = [
  '#2d261e', '#ffffff', '#e76f51', '#f4a261',
  '#e9c46a', '#2a9d8f', '#264653', '#9b5de5',
  '#f15bb5', '#fee440', '#00bbf9', '#00f5d4',
  '#8d5b4c', '#d4a373', '#ccd5ae', '#e07a5f'
];

export {
  SLOT_CUTOUT_FALLBACK_VIEWBOX,
  SLOT_PREVIEW_VIEWBOX
} from '../../core/preview-viewboxes.js';

export function isTrustedCutoutDescriptor(asset, slot) {
  return Boolean(asset && !asset.custom && asset.kind === 'wearable' && asset.slot === slot && asset.id);
}

function fitCutoutSvg(svg, slot) {
  try {
    const targetGroup = svg.querySelector('#garment') || svg.querySelector('g') || svg;
    const bbox = targetGroup.getBBox ? targetGroup.getBBox() : null;
    if (bbox && bbox.width > 0 && bbox.height > 0) {
      const pad = Math.max(bbox.width, bbox.height) * 0.08;
      svg.setAttribute('viewBox', `${Math.max(0, bbox.x - pad)} ${Math.max(0, bbox.y - pad)} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`);
      return;
    }
  } catch {
    // getBBox fallback
  }
  svg.setAttribute('viewBox', SLOT_CUTOUT_FALLBACK_VIEWBOX[slot] || '0 0 300 450');
}

export function createPaintView({
  rootElement = document,
  store,
  customArtRepo,
  assetRegistry,
  svgLoader,
  onNavigate,
  askConfirm,
  showAlert
} = {}) {
  let session = createPaintSession();
  let canvas = null;
  let ctx = null;
  let isPointerDown = false;
  let lastPointerPos = null;
  let cursorX = 150;
  let cursorY = 225;
  let pendingNavigationHref = null;
  let pendingHistorySnapshot = null;
  let pendingHistoryRect = null;
  let pointerStart = null;
  let pointerMode = null;
  let selectionRect = null;
  let selectionPixels = null;
  let selectionBeforeRect = null;
  let guideRenderToken = 0;
  let activePointerId = null;
  let cutoutActionToken = 0;
  let cutoutActionPending = false;
  let activeCutoutUrl = null;
  let livePreviewToken = 0;
  let livePreviewMode = null;
  let livePreviewCanvas = null;
  let livePreviewDollWrap = null;
  let livePreviewDollId = null;

  // DOM elements cache
  const screen = rootElement.querySelector('#paint-screen');
  const canvasStage = rootElement.querySelector('#paint-canvas-stage');
  const guideLayer = rootElement.querySelector('#paint-guide-layer');
  const selectionOutline = rootElement.querySelector('#paint-selection-outline');
  const virtualCursor = rootElement.querySelector('#paint-cursor');
  const previewStage = rootElement.querySelector('#paint-preview-stage');
  const previewVariants = rootElement.querySelector('#paint-preview-variants');
  const itemBadge = rootElement.querySelector('#paint-item-label');
  const statusElem = rootElement.querySelector('#paint-status');

  // Controls
  const backBtn = rootElement.querySelector('#paint-back-btn');
  const newBtn = rootElement.querySelector('#paint-new-btn');
  const undoBtn = rootElement.querySelector('#paint-undo-btn');
  const redoBtn = rootElement.querySelector('#paint-redo-btn');
  const mirrorBtn = rootElement.querySelector('#paint-mirror-btn');
  const zoomBtn = rootElement.querySelector('#paint-zoom-btn');
  const clearBtn = rootElement.querySelector('#paint-clear-btn');
  const saveBtn = rootElement.querySelector('#paint-save-btn');

  // Sidebar
  const typeWearableBtn = rootElement.querySelector('#paint-type-wearable');
  const typePropBtn = rootElement.querySelector('#paint-type-prop');
  const wearableConfig = rootElement.querySelector('#paint-wearable-config');
  const propConfig = rootElement.querySelector('#paint-prop-config');
  const slotSelect = rootElement.querySelector('#paint-slot-select');
  const cutoutGrid = rootElement.querySelector('#paint-cutout-grid');
  const cutoutStatus = rootElement.querySelector('#paint-cutout-status');
  const cutoutAddBtn = rootElement.querySelector('#paint-cutout-add-btn');
  const cutoutReplaceBtn = rootElement.querySelector('#paint-cutout-replace-btn');
  const propSizeSelect = rootElement.querySelector('#paint-prop-size-select');
  const propPlacementSelect = rootElement.querySelector('#paint-prop-placement-select');
  const referenceControls = rootElement.querySelector('#paint-reference-controls');
  const referenceVisible = rootElement.querySelector('#paint-reference-visible');
  const referenceModel = rootElement.querySelector('#paint-reference-model');
  const referenceOpacity = rootElement.querySelector('#paint-reference-opacity');
  const referenceOpacityValue = rootElement.querySelector('#paint-reference-opacity-value');
  const guidesVisible = rootElement.querySelector('#paint-guides-visible');
  const cutoutReferenceVisible = rootElement.querySelector('#paint-cutout-reference-visible');
  const toolsToolbar = rootElement.querySelector('#paint-tools-toolbar');
  const brushSizeGroup = rootElement.querySelector('#paint-brush-size-group');
  const brushSizeSlider = rootElement.querySelector('#paint-brush-size-slider');
  const brushSizeValue = rootElement.querySelector('#paint-brush-size-value');
  const shapeOptions = rootElement.querySelector('#paint-shape-options');
  const shapeFilledCheckbox = rootElement.querySelector('#paint-shape-filled');
  const paletteGrid = rootElement.querySelector('#paint-palette-grid');
  const colorPicker = rootElement.querySelector('#paint-color-picker');
  const activeColorSwatch = rootElement.querySelector('#paint-active-color');

  // Sidebar tabs
  const tabDraw = rootElement.querySelector('#paint-tab-draw');
  const tabSetup = rootElement.querySelector('#paint-tab-setup');
  const panelDraw = rootElement.querySelector('#paint-panel-draw');
  const panelSetup = rootElement.querySelector('#paint-panel-setup');

  // Dirty-navigation dialog
  const dirtyDialog = rootElement.querySelector('#paint-dirty-dialog');
  const dirtyKeepBtn = rootElement.querySelector('#paint-dirty-keep-btn');
  const dirtyDiscardBtn = rootElement.querySelector('#paint-dirty-discard-btn');
  const dirtySaveBtn = rootElement.querySelector('#paint-dirty-save-btn');

  function backingScale() {
    return canvas?.width && session.logicalWidth ? canvas.width / session.logicalWidth : 1;
  }

  function init() {
    canvas = rootElement.querySelector('#paint-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d', { willReadFrequently: true });

    renderPalette();
    bindEvents();
    resetCanvas();
  }

  function selectColor(hex) {
    if (!hex) return;
    session.setColor(hex);
    if (colorPicker) colorPicker.value = hex;
    const currentTool = session.getState().tool;
    if (currentTool === 'eraser' || currentTool === 'select' || currentTool === 'eyedropper') {
      session.setTool('brush');
      updateUIFromState();
    }
    updatePaletteActive();
  }

  function renderPalette() {
    if (!paletteGrid) return;
    paletteGrid.replaceChildren();
    CURATED_PALETTE.forEach((hex) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'paint-swatch';
      btn.style.backgroundColor = hex;
      btn.title = hex;
      btn.setAttribute('aria-label', t('paint.colorSwatchAria', { color: hex }));
      const active = hex.toLowerCase() === session.getState().color.toLowerCase();
      btn.setAttribute('aria-pressed', String(active));
      if (active) {
        btn.classList.add('active');
      }
      btn.addEventListener('click', () => {
        selectColor(hex);
      });
      paletteGrid.appendChild(btn);
    });
  }

  function updatePaletteActive() {
    const currentColor = session.getState().color.toLowerCase();
    paletteGrid?.querySelectorAll('.paint-swatch').forEach((btn) => {
      const active = btn.title.toLowerCase() === currentColor;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    if (activeColorSwatch) {
      activeColorSwatch.style.backgroundColor = session.getState().color;
      activeColorSwatch.setAttribute('aria-label', `${t('paint.activeColorAria')} ${session.getState().color}`);
    }
  }

  function resetCanvas(options = {}) {
    cutoutActionToken += 1;
    cutoutActionPending = false;
    session = createPaintSession(options);
    pendingHistorySnapshot = null;
    pendingHistoryRect = null;
    pointerStart = null;
    pointerMode = null;
    selectionRect = null;
    selectionPixels = null;
    updateSelectionOutline();
    const state = session.getState();

    canvas.width = session.pixelWidth;
    canvas.height = session.pixelHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (canvasStage) {
      canvasStage.classList.toggle('is-prop-stage', state.itemType === 'prop');
      canvasStage.style.width = `${session.logicalWidth}px`;
      canvasStage.style.height = `${session.logicalHeight}px`;
      canvasStage.style.setProperty('--paint-zoom', state.zoom === 2 ? '2' : '1');
    }

    cursorX = Math.round(session.logicalWidth / 2);
    cursorY = Math.round(session.logicalHeight / 2);
    updateVirtualCursor();

    updateUIFromState();
    loadCutoutsForSlot(state.slot);
    renderGuideLayer();
    updateLivePreview();
    updateHistoryButtons();
  }

  function updateUIFromState() {
    const state = session.getState();

    canvas?.setAttribute('aria-label', t('paint.canvasAria', {
      type: state.itemType === 'wearable' ? t('paint.wearableTypeBtn') : t('paint.propTypeLabel'),
      tool: t('paint.toolLabels.' + state.tool) || state.tool,
      zoom: state.zoom === 2 ? '2x' : '1x',
      status: state.dirty ? t('paint.unsavedStatus') : t('paint.savedStatus')
    }));

    if (itemBadge) {
      itemBadge.textContent = state.itemType === 'wearable'
        ? `${t('wardrobeSlots.' + state.slot) || state.slot.toUpperCase()} ${t('paint.cutoutSuffix')}`
        : t('paint.propTypeLabel');
    }


    typeWearableBtn?.classList.toggle('active', state.itemType === 'wearable');
    typePropBtn?.classList.toggle('active', state.itemType === 'prop');
    if (wearableConfig) wearableConfig.hidden = state.itemType !== 'wearable';
    if (propConfig) propConfig.hidden = state.itemType !== 'prop';
    // Reference controls are now a <details> element; toggle display instead of hidden
    if (referenceControls) {
      referenceControls.style.display = state.itemType !== 'wearable' ? 'none' : '';
    }

    if (slotSelect) slotSelect.value = state.slot;
    if (propSizeSelect) propSizeSelect.value = state.propSize;
    if (propPlacementSelect) propPlacementSelect.value = state.propPlacement;
    if (referenceVisible) referenceVisible.checked = state.referenceVisible;
    if (referenceModel) referenceModel.value = state.baseDollId;
    if (referenceOpacity) referenceOpacity.value = String(state.referenceOpacity);
    if (referenceOpacityValue) referenceOpacityValue.value = `${state.referenceOpacity}%`;
    if (guidesVisible) guidesVisible.checked = state.guidesVisible;
    if (cutoutReferenceVisible) cutoutReferenceVisible.checked = state.cutoutReferenceVisible;

    toolsToolbar?.querySelectorAll('.tool-btn').forEach((btn) => {
      const active = btn.dataset.tool === state.tool;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    if (shapeOptions) shapeOptions.hidden = state.tool !== 'shape';
    if (shapeFilledCheckbox) shapeFilledCheckbox.checked = state.shapeFilled;

    // Contextual: show brush-size only for brush/eraser
    if (brushSizeGroup) {
      brushSizeGroup.hidden = state.tool !== 'brush' && state.tool !== 'eraser';
    }

    if (brushSizeSlider) brushSizeSlider.value = String(state.brushSize);
    if (brushSizeValue) brushSizeValue.value = `${state.brushSize}px`;

    mirrorBtn?.setAttribute('aria-pressed', String(state.mirror));
    mirrorBtn?.classList.toggle('active', state.mirror);

    if (zoomBtn) {
      zoomBtn.textContent = state.zoom === 2 ? '🔍 2×' : '🔍 1×';
    }

    updatePaletteActive();
  }

  async function loadCutoutsForSlot(slot) {
    if (!cutoutGrid) return;
    cutoutGrid.replaceChildren();
    cancelCutoutAction();
    const requestedCutoutId = session.getState().cutoutAssetId;
    const selectedCutoutId = getTrustedCutout(requestedCutoutId, slot) ? requestedCutoutId : null;
    session.setCutoutAssetId(selectedCutoutId);
    updateCutoutActions();

    if (session.getState().itemType !== 'wearable') return;

    const slotAssets = assetRegistry?.wearablesBySlot
      ? assetRegistry.wearablesBySlot(slot)
      : (assetRegistry?.getCategoryAssets?.('wardrobe', slot) || []);
    const approvedCutouts = slotAssets
      .filter((asset) => asset && asset.kind === 'wearable' && asset.slot === slot && !asset.custom)
      .slice(0, 8);

    if (approvedCutouts.length === 0) {
      setCutoutStatus(t('paint.noCutoutsAvailable'));
      return;
    }

    setCutoutStatus(selectedCutoutId ? t('paint.cutoutSelectedHelp') : t('paint.cutoutHelpStatus'));

    // Dedicated None card
    const noneCard = document.createElement('button');
    noneCard.type = 'button';
    noneCard.className = 'cutout-card cutout-none-card';
    noneCard.dataset.assetId = '';
    noneCard.setAttribute('role', 'option');
    noneCard.setAttribute('aria-selected', String(!selectedCutoutId));
    noneCard.classList.toggle('active', !selectedCutoutId);
    noneCard.title = t('paint.noneCutoutTitle');
    noneCard.setAttribute('aria-label', t('paint.noneCutoutTitle'));
    const noneIcon = document.createElement('span');
    noneIcon.className = 'cutout-none-icon';
    noneIcon.setAttribute('aria-hidden', 'true');
    noneIcon.textContent = '🚫';
    noneCard.appendChild(noneIcon);
    noneCard.addEventListener('click', () => {
      cancelCutoutAction();
      session.setCutoutAssetId(null);
      cutoutGrid.querySelectorAll('.cutout-card').forEach((c) => {
        c.classList.toggle('active', c === noneCard);
        c.setAttribute('aria-selected', String(c === noneCard));
      });
      updateCutoutActions();
      renderGuideLayer();
      saveService.checkpointReferencePreferences();
      setCutoutStatus(t('paint.cutoutUnselected'));
      announceStatus(t('paint.cutoutUnselected'));
    });
    cutoutGrid.appendChild(noneCard);

    approvedCutouts.forEach((asset) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'cutout-card';
      card.dataset.assetId = asset.id;
      card.setAttribute('role', 'option');
      card.setAttribute('aria-selected', String(asset.id === selectedCutoutId));
      card.classList.toggle('active', asset.id === selectedCutoutId);
      card.title = asset.name || asset.id;
      if (svgLoader?.load) {
        svgLoader.load(asset.id).then((svg) => {
          if (svg) {
            const clone = svg.cloneNode(true);
            clone.setAttribute('width', '100%');
            clone.setAttribute('height', '100%');
            clone.setAttribute('aria-hidden', 'true');
            card.replaceChildren(clone);
            fitCutoutSvg(clone, slot);
            requestAnimationFrame(() => fitCutoutSvg(clone, slot));
          }
        }).catch(() => {
          if (asset.path) {
            const image = document.createElement('img');
            image.src = asset.path;
            image.alt = '';
            image.setAttribute('aria-hidden', 'true');
            card.replaceChildren(image);
          }
        });
      } else if (asset.path) {
        const image = document.createElement('img');
        image.src = asset.path;
        image.alt = '';
        image.setAttribute('aria-hidden', 'true');
        card.appendChild(image);
      } else {
        const icon = document.createElement('span');
        icon.className = 'cutout-fallback-icon';
        icon.textContent = '✂️';
        icon.setAttribute('aria-hidden', 'true');
        card.appendChild(icon);
      }

      card.addEventListener('click', () => {
        cancelCutoutAction();
        const isCurrentlySelected = session.getState().cutoutAssetId === asset.id;
        if (isCurrentlySelected) {
          // Unselect on re-clicking the active card
          session.setCutoutAssetId(null);
          cutoutGrid.querySelectorAll('.cutout-card').forEach((c) => {
            c.classList.toggle('active', c === noneCard);
            c.setAttribute('aria-selected', String(c === noneCard));
          });
          updateCutoutActions();
          renderGuideLayer();
          saveService.checkpointReferencePreferences();
          setCutoutStatus(t('paint.cutoutUnselected'));
          announceStatus(t('paint.cutoutUnselected'));
          return;
        }

        cutoutGrid.querySelectorAll('.cutout-card').forEach((c) => {
          const active = c === card;
          c.classList.toggle('active', active);
          c.setAttribute('aria-selected', String(active));
        });
        session.setCutoutAssetId(asset.id);
        session.setCutoutReferenceVisible(true);
        if (cutoutReferenceVisible) cutoutReferenceVisible.checked = true;
        updateCutoutActions();
        renderGuideLayer();
        saveService.checkpointReferencePreferences();
        setCutoutStatus(t('paint.cutoutSelectedStatus', { name: asset.name || asset.id }));
        announceStatus(t('paint.cutoutSelectedAnnounce', { name: asset.name || asset.id }));
      });

      cutoutGrid.appendChild(card);
    });
    if (selectedCutoutId) {
      const selected = getTrustedCutout(selectedCutoutId, slot);
      setCutoutStatus(t('paint.cutoutRestoredStatus', { name: selected?.name || selectedCutoutId }));
    }
  }

  function setCutoutStatus(message) {
    if (cutoutStatus) cutoutStatus.textContent = message;
  }

  function cancelCutoutAction() {
    cutoutActionToken += 1;
    cutoutActionPending = false;
    if (activeCutoutUrl) {
      URL.revokeObjectURL(activeCutoutUrl);
      activeCutoutUrl = null;
    }
    updateCutoutActions();
  }

  function updateCutoutActions() {
    const enabled = Boolean(session.getState().cutoutAssetId) && !cutoutActionPending;
    if (cutoutAddBtn) cutoutAddBtn.disabled = !enabled;
    if (cutoutReplaceBtn) cutoutReplaceBtn.disabled = !enabled;
  }

  function getTrustedCutout(assetId, slot = session.getState().slot) {
    const asset = assetRegistry?.getAsset?.(assetId);
    return isTrustedCutoutDescriptor(asset, slot) ? asset : null;
  }

  function canvasHasPixels() {
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] !== 0) return true;
    }
    return false;
  }

  async function rasterizeCutoutIntoCanvas(assetId, mode = 'add') {
    if (!svgLoader || !assetId || cutoutActionPending) return false;
    const initialState = session.getState();
    const initialAsset = getTrustedCutout(assetId, initialState.slot);
    if (!initialAsset) {
      setCutoutStatus(t('paint.cutoutUnavailable'));
      return false;
    }
    if (mode === 'replace' && canvasHasPixels()) {
      const confirmed = await (askConfirm?.(
        t('paint.replaceCutoutTitle'),
        t('paint.replaceCutoutMessage')
      ) ?? true);
      if (!confirmed) {
        setCutoutStatus(t('paint.artworkKeptStatus'));
        return false;
      }
    }

    const requestSession = session;
    const requestSlot = initialState.slot;
    const requestToken = ++cutoutActionToken;
    let url = null;
    let before = null;
    cutoutActionPending = true;
    updateCutoutActions();
    setCutoutStatus(t('paint.loadingCutout', { name: initialAsset.name || assetId }));
    try {
      const svgElement = await svgLoader.load(assetId);
      if (!svgElement) throw new Error('Cutout SVG is unavailable.');

      const xml = new XMLSerializer().serializeToString(svgElement);
      const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      url = URL.createObjectURL(blob);
      activeCutoutUrl = url;
      const img = new Image();

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });

      if (requestToken !== cutoutActionToken || requestSession !== session ||
          session.getState().slot !== requestSlot || !getTrustedCutout(assetId, requestSlot)) {
        return false;
      }

      before = captureHistorySnapshot(ctx);
      if (mode === 'replace') ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (!historySnapshotChanged(ctx, before)) {
        setCutoutStatus(t('paint.cutoutNoChange'));
        return false;
      }
      session.pushHistory(before);
      updateHistoryButtons();
      updateUIFromState();
      updateLivePreview();
      saveService.scheduleDraftCheckpoint();
      setCutoutStatus(mode === 'replace' ? t('paint.cutoutReplaced', { name: initialAsset.name || assetId }) : t('paint.cutoutAdded', { name: initialAsset.name || assetId }));
      announceStatus(mode === 'replace' ? t('paint.cutoutReplaceDone') : t('paint.cutoutAddDone'));
      return true;
    } catch (err) {
      if (before) restoreHistorySnapshot(ctx, before);
      if (requestToken === cutoutActionToken) {
        console.warn('Could not rasterize cutout:', err);
        setCutoutStatus(t('paint.cutoutLoadError'));
      }
      return false;
    } finally {
      if (url) URL.revokeObjectURL(url);
      if (activeCutoutUrl === url) activeCutoutUrl = null;
      if (requestToken === cutoutActionToken) {
        cutoutActionPending = false;
        updateCutoutActions();
      }
    }
  }

  async function renderGuideLayer() {
    if (!guideLayer) return;
    const token = ++guideRenderToken;
    guideLayer.replaceChildren();
    const state = session.getState();
    guideLayer.style.setProperty('--reference-opacity', String(state.referenceOpacity / 100));

    if (state.itemType === 'wearable') {
      const doc = guideLayer.ownerDocument || document;
      const baseDollId = state.baseDollId || 'doll_classic_a';
      const bodyLayer = doc.createElement('div');
      bodyLayer.className = 'paint-reference-body';
      bodyLayer.hidden = !state.referenceVisible;
      guideLayer.appendChild(bodyLayer);

      const cutout = getTrustedCutout(state.cutoutAssetId, state.slot);
      if (cutout?.path && state.cutoutReferenceVisible) {
        const cutoutImage = doc.createElement('img');
        cutoutImage.className = 'paint-reference-cutout';
        cutoutImage.src = cutout.path;
        cutoutImage.alt = '';
        cutoutImage.setAttribute('aria-hidden', 'true');
        guideLayer.appendChild(cutoutImage);
      }

      if (state.guidesVisible) {
        guideLayer.appendChild(createAlignmentGuideSvg(doc, state.slot, baseDollId));
      }

      if (svgLoader && state.referenceVisible) {
        try {
          const dollSvg = await svgLoader.load(baseDollId);
          if (dollSvg && token === guideRenderToken && session.getState().itemType === 'wearable' &&
              session.getState().baseDollId === baseDollId) {
            const clone = dollSvg.cloneNode(true);
            clone.setAttribute('aria-hidden', 'true');
            bodyLayer.appendChild(clone);
          }
        } catch {
          // ignore
        }
      }
    } else {
      const groundLine = document.createElement('div');
      groundLine.className = 'paint-guide-groundline';
      guideLayer.appendChild(groundLine);
    }
  }

  function createAlignmentGuideSvg(doc, slot, modelId) {
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = doc.createElementNS(namespace, 'svg');
    svg.setAttribute('class', 'paint-alignment-guides');
    svg.setAttribute('viewBox', '0 0 300 450');
    svg.setAttribute('aria-hidden', 'true');

    for (const guide of getReferenceGuides(slot, modelId).filter(guideIsInBounds)) {
      let shape;
      if (guide.type === 'line') {
        shape = doc.createElementNS(namespace, 'line');
        for (const attr of ['x1', 'y1', 'x2', 'y2']) shape.setAttribute(attr, String(guide[attr]));
      } else if (guide.type === 'ellipse') {
        shape = doc.createElementNS(namespace, 'ellipse');
        for (const attr of ['cx', 'cy', 'rx', 'ry']) shape.setAttribute(attr, String(guide[attr]));
      } else {
        shape = doc.createElementNS(namespace, 'circle');
        shape.setAttribute('cx', String(guide.x));
        shape.setAttribute('cy', String(guide.y));
        shape.setAttribute('r', '4');
      }
      shape.setAttribute('class', `paint-guide-shape paint-guide-${guide.type}`);
      svg.appendChild(shape);

      const text = doc.createElementNS(namespace, 'text');
      const labelX = guide.x ?? guide.x1 ?? guide.cx;
      const labelY = guide.y ?? guide.y1 ?? (guide.cy - guide.ry);
      text.setAttribute('x', String(Math.min(250, labelX + 6)));
      text.setAttribute('y', String(Math.max(12, labelY - 5)));
      text.setAttribute('class', 'paint-guide-label');
      text.textContent = guide.label;
      svg.appendChild(text);
    }
    return svg;
  }

  function updateVirtualCursor() {
    if (!virtualCursor || !canvasStage) return;
    const state = session.getState();
    canvasStage.style.setProperty('--cursor-x', `${cursorX}px`);
    canvasStage.style.setProperty('--cursor-y', `${cursorY}px`);
    canvasStage.style.setProperty('--cursor-size', `${state.brushSize}px`);
  }

  function normalizeSelectionRect(a, b) {
    const x0 = Math.max(0, Math.min(canvas.width, Math.floor(Math.min(a.x, b.x))));
    const y0 = Math.max(0, Math.min(canvas.height, Math.floor(Math.min(a.y, b.y))));
    const x1 = Math.max(0, Math.min(canvas.width, Math.ceil(Math.max(a.x, b.x))));
    const y1 = Math.max(0, Math.min(canvas.height, Math.ceil(Math.max(a.y, b.y))));
    return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
  }

  function selectionContains(rect, point) {
    return rect && point.x >= rect.x && point.x <= rect.x + rect.width &&
      point.y >= rect.y && point.y <= rect.y + rect.height;
  }

  function updateSelectionOutline() {
    if (!selectionOutline) return;
    if (!selectionRect || selectionRect.width === 0 || selectionRect.height === 0) {
      selectionOutline.style.display = 'none';
      return;
    }
    selectionOutline.style.display = 'block';
    selectionOutline.style.left = `${selectionRect.x / 2}px`;
    selectionOutline.style.top = `${selectionRect.y / 2}px`;
    selectionOutline.style.width = `${selectionRect.width / 2}px`;
    selectionOutline.style.height = `${selectionRect.height / 2}px`;
  }

  function captureSelection() {
    if (!selectionRect?.width || !selectionRect?.height) return null;
    return ctx.getImageData(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
  }

  function unionRects(...rects) {
    const valid = rects.filter((rect) => rect?.width >= 0 && rect?.height >= 0);
    if (!valid.length) return null;
    const left = Math.min(...valid.map((rect) => rect.x));
    const top = Math.min(...valid.map((rect) => rect.y));
    const right = Math.max(...valid.map((rect) => rect.x + rect.width));
    const bottom = Math.max(...valid.map((rect) => rect.y + rect.height));
    return { x: left, y: top, width: right - left, height: bottom - top };
  }

  function includePendingRect(rect) {
    pendingHistoryRect = unionRects(pendingHistoryRect, rect);
  }

  function pointsBounds(points, size, mirror = false, axisX = session.mirrorAxisX * backingScale()) {
    const radius = size / 2 + 1;
    const rects = [];
    for (const point of points) {
      rects.push({ x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2 });
      if (mirror) {
        const mirroredX = 2 * axisX - point.x;
        rects.push({ x: mirroredX - radius, y: point.y - radius, width: radius * 2, height: radius * 2 });
      }
    }
    return unionRects(...rects);
  }

  function shapeBounds(x0, y0, x1, y1, size, mirror = false, axisX = session.mirrorAxisX * backingScale()) {
    const pad = size / 2 + 1;
    const rect = {
      x: Math.min(x0, x1) - pad,
      y: Math.min(y0, y1) - pad,
      width: Math.abs(x1 - x0) + pad * 2,
      height: Math.abs(y1 - y0) + pad * 2
    };
    if (!mirror) return rect;
    return unionRects(rect, {
      x: 2 * axisX - Math.max(x0, x1) - pad,
      y: rect.y,
      width: Math.abs(x1 - x0) + pad * 2,
      height: rect.height
    });
  }

  function floodBoundsRect(bounds) {
    if (!Number.isFinite(bounds?.x) || !Number.isFinite(bounds?.y) ||
        !Number.isFinite(bounds?.right) || !Number.isFinite(bounds?.bottom)) return null;
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.right - bounds.x + 1,
      height: bounds.bottom - bounds.y + 1
    };
  }

  function moveSelectionBy(dx, dy, duplicate = false) {
    if (!selectionRect) return false;
    const previousRect = selectionRect;
    const before = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = selectionPixels || captureSelection();
    if (!pixels) return false;
    const next = {
      ...selectionRect,
      x: Math.max(0, Math.min(canvas.width - selectionRect.width, selectionRect.x + dx)),
      y: Math.max(0, Math.min(canvas.height - selectionRect.height, selectionRect.y + dy))
    };
    if (next.x === selectionRect.x && next.y === selectionRect.y && !duplicate) return false;
    if (!duplicate) ctx.clearRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
    ctx.putImageData(pixels, next.x, next.y);
    selectionRect = next;
    selectionPixels = pixels;
    session.pushHistory(cropHistorySnapshot(before, unionRects(previousRect, next)));
    session.markDirty(true);
    updateSelectionOutline();
    updateHistoryButtons();
    updateUIFromState();
    updateLivePreview();
    saveService.scheduleDraftCheckpoint();
    return true;
  }

  function deleteSelection() {
    if (!selectionRect) return false;
    const before = captureHistorySnapshot(ctx, selectionRect);
    ctx.clearRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
    if (!historySnapshotChanged(ctx, before)) return false;
    selectionRect = null;
    selectionPixels = null;
    session.pushHistory(before);
    session.markDirty(true);
    updateSelectionOutline();
    updateHistoryButtons();
    updateUIFromState();
    updateLivePreview();
    saveService.scheduleDraftCheckpoint();
    return true;
  }

  function flipSelectionHorizontally() {
    if (!selectionRect) return false;
    const pixels = selectionPixels || captureSelection();
    if (!pixels) return false;
    const before = captureHistorySnapshot(ctx, selectionRect);
    const temp = document.createElement('canvas');
    temp.width = pixels.width;
    temp.height = pixels.height;
    const tempCtx = temp.getContext('2d');
    tempCtx.putImageData(pixels, 0, 0);
    ctx.save();
    ctx.clearRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
    ctx.translate(selectionRect.x + selectionRect.width, selectionRect.y);
    ctx.scale(-1, 1);
    ctx.drawImage(temp, 0, 0);
    ctx.restore();
    selectionPixels = ctx.getImageData(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
    if (!historySnapshotChanged(ctx, before)) return false;
    session.pushHistory(before);
    session.markDirty(true);
    updateHistoryButtons();
    updateUIFromState();
    updateLivePreview();
    saveService.scheduleDraftCheckpoint();
    return true;
  }

  function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches ? e.touches[0].clientX : 0);
    const clientY = e.clientY ?? (e.touches ? e.touches[0].clientY : 0);

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function commitPendingOperation() {
    const before = pendingHistorySnapshot;
    const rect = pendingHistoryRect;
    pendingHistorySnapshot = null;
    pendingHistoryRect = null;
    pointerStart = null;
    if (!before) return false;
    if (!historySnapshotChanged(ctx, before, rect)) return false;
    const historySnapshot = cropHistorySnapshot(before, rect);
    session.pushHistory(historySnapshot);
    session.markDirty(true);
    updateHistoryButtons();
    updateUIFromState();
    updateLivePreview();
    saveService.scheduleDraftCheckpoint();
    return true;
  }

  function updateHistoryButtons() {
    if (undoBtn) undoBtn.disabled = !session.canUndo();
    if (redoBtn) redoBtn.disabled = !session.canRedo();
  }

  function handlePointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const coords = getCanvasCoordinates(e);
    const state = session.getState();
    if (state.tool === 'eyedropper') {
      const sampled = samplePixel(ctx, coords.x, coords.y);
      if (sampled) {
        session.setColor(sampled.hex);
        if (colorPicker) colorPicker.value = sampled.hex;
        updatePaletteActive();
        session.setTool('brush');
        updateUIFromState();
      }
      isPointerDown = false;
      return;
    }

    if (state.tool === 'fill') {
      const before = captureHistorySnapshot(ctx);
      const fillBounds = {};
      const changed = executeFloodFill(ctx, coords.x, coords.y, state.color, {
        tolerance: 16,
        mirror: state.mirror,
        axisX: session.mirrorAxisX * backingScale(),
        bounds: fillBounds
      });
      if (changed) {
        session.pushHistory(cropHistorySnapshot(before, floodBoundsRect(fillBounds)));
        session.markDirty(true);
        updateHistoryButtons();
        updateUIFromState();
        updateLivePreview();
        saveService.scheduleDraftCheckpoint();
      }
      return;
    }

    if (state.tool === 'select') {
      isPointerDown = true;
      activePointerId = e.pointerId;
      canvas.setPointerCapture?.(e.pointerId);
      lastPointerPos = coords;
      pointerStart = coords;
      selectionBeforeRect = selectionRect;
      if (selectionContains(selectionRect, coords)) {
        pointerMode = 'select-move';
        selectionPixels = captureSelection();
        pendingHistorySnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
        pendingHistoryRect = selectionRect;
      } else {
        pointerMode = 'select-rect';
        selectionPixels = null;
        pendingHistorySnapshot = null;
        pendingHistoryRect = null;
        selectionRect = normalizeSelectionRect(coords, coords);
        updateSelectionOutline();
      }
      return;
    }

    if (!['brush', 'eraser', 'shape'].includes(state.tool)) return;

    isPointerDown = true;
    activePointerId = e.pointerId;
    canvas.setPointerCapture?.(e.pointerId);
    lastPointerPos = coords;
    pointerStart = coords;
    pendingHistorySnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (state.tool === 'brush' || state.tool === 'eraser') {
      applyStroke(ctx, [coords], {
        size: state.brushSize * backingScale(),
        color: state.color,
        isEraser: state.tool === 'eraser',
        mirror: state.mirror,
        axisX: session.mirrorAxisX * backingScale()
      });
      includePendingRect(pointsBounds([coords], state.brushSize * backingScale(), state.mirror));
      updateLivePreview();
    } else if (state.tool === 'shape') {
      drawShape(ctx, state.shapeType, coords.x, coords.y, coords.x, coords.y, {
        color: state.color,
        size: state.brushSize * backingScale(),
        filled: state.shapeFilled,
        mirror: state.mirror,
        axisX: session.mirrorAxisX * backingScale()
      });
      includePendingRect(shapeBounds(coords.x, coords.y, coords.x, coords.y, state.brushSize * backingScale(), state.mirror));
    }
  }

  function handlePointerMove(e) {
    if (!isPointerDown || !lastPointerPos) return;
    const coords = getCanvasCoordinates(e);
    const state = session.getState();

    if (state.tool === 'brush' || state.tool === 'eraser') {
      const points = interpolateStrokePoints(lastPointerPos, coords, 3);
      applyStroke(ctx, points, {
        size: state.brushSize * backingScale(),
        color: state.color,
        isEraser: state.tool === 'eraser',
        mirror: state.mirror,
        axisX: session.mirrorAxisX * backingScale()
      });
      includePendingRect(pointsBounds(points, state.brushSize * backingScale(), state.mirror));
      lastPointerPos = coords;
      updateLivePreview();
    } else if (pointerMode === 'select-rect' && pointerStart) {
      selectionRect = normalizeSelectionRect(pointerStart, coords);
      updateSelectionOutline();
    } else if (pointerMode === 'select-move' && pointerStart && selectionPixels) {
      ctx.putImageData(pendingHistorySnapshot, 0, 0);
      const dx = Math.round(coords.x - pointerStart.x);
      const dy = Math.round(coords.y - pointerStart.y);
      selectionRect = {
        ...selectionBeforeRect,
        x: Math.max(0, Math.min(canvas.width - selectionBeforeRect.width, selectionBeforeRect.x + dx)),
        y: Math.max(0, Math.min(canvas.height - selectionBeforeRect.height, selectionBeforeRect.y + dy))
      };
      includePendingRect(unionRects(selectionBeforeRect, selectionRect));
      ctx.clearRect(selectionBeforeRect.x, selectionBeforeRect.y, selectionBeforeRect.width, selectionBeforeRect.height);
      ctx.putImageData(selectionPixels, selectionRect.x, selectionRect.y);
      updateSelectionOutline();
      updateLivePreview();
    } else if (state.tool === 'shape' && pointerStart) {
      ctx.putImageData(pendingHistorySnapshot, 0, 0);
      drawShape(ctx, state.shapeType, pointerStart.x, pointerStart.y, coords.x, coords.y, {
        color: state.color,
        size: state.brushSize * backingScale(),
        filled: state.shapeFilled,
        mirror: state.mirror,
        axisX: session.mirrorAxisX * backingScale()
      });
      includePendingRect(shapeBounds(pointerStart.x, pointerStart.y, coords.x, coords.y, state.brushSize * backingScale(), state.mirror));
      lastPointerPos = coords;
      updateLivePreview();
    }
  }

  function handlePointerUp(e) {
    if (!isPointerDown) return;
    isPointerDown = false;
    lastPointerPos = null;
    canvas.releasePointerCapture?.(e.pointerId);
    activePointerId = null;

    if (pointerMode === 'select-rect') {
      pendingHistorySnapshot = null;
      pendingHistoryRect = null;
      pointerMode = null;
      selectionPixels = captureSelection();
      updateSelectionOutline();
      return;
    }
    pointerMode = null;
    commitPendingOperation();
  }

  function handlePointerCancel(e) {
    if (!isPointerDown) return;
    const cancelledSelection = pointerMode?.startsWith('select-');
    isPointerDown = false;
    lastPointerPos = null;
    pointerStart = null;
    if (pendingHistorySnapshot) ctx.putImageData(pendingHistorySnapshot, 0, 0);
    pendingHistorySnapshot = null;
    pendingHistoryRect = null;
    pointerMode = null;
    if (cancelledSelection) {
      selectionRect = selectionBeforeRect;
      selectionPixels = captureSelection();
      updateSelectionOutline();
    }
    const pointerId = e?.pointerId ?? activePointerId;
    if (pointerId != null) canvas.releasePointerCapture?.(pointerId);
    activePointerId = null;
    updateLivePreview();
  }

  function cancelTransientOperation({ clearSelection = false } = {}) {
    if (isPointerDown) handlePointerCancel({ pointerId: activePointerId });
    if (clearSelection) {
      selectionRect = null;
      selectionPixels = null;
      selectionBeforeRect = null;
      updateSelectionOutline();
    }
  }

  function handleKeyDown(e) {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' ||
      document.activeElement?.tagName === 'SELECT' || document.activeElement?.isContentEditable) {
      return;
    }
    if (screen && !screen.contains(document.activeElement) && !screen.contains(e.target)) return;
    if (e.key === ' ' && e.target?.closest?.('button, [role="button"]')) return;

    const state = session.getState();
    const step = e.shiftKey ? 1 : 10;

    if (state.tool === 'select' && selectionRect && /^Arrow/.test(e.key)) {
      e.preventDefault();
      const delta = e.key === 'ArrowLeft' ? [-step, 0] : e.key === 'ArrowRight' ? [step, 0] : e.key === 'ArrowUp' ? [0, -step] : [0, step];
      moveSelectionBy(delta[0] * backingScale(), delta[1] * backingScale());
      return;
    }

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        cursorX = Math.max(0, cursorX - step);
        updateVirtualCursor();
        break;
      case 'ArrowRight':
        e.preventDefault();
        cursorX = Math.min(session.logicalWidth, cursorX + step);
        updateVirtualCursor();
        break;
      case 'ArrowUp':
        e.preventDefault();
        cursorY = Math.max(0, cursorY - step);
        updateVirtualCursor();
        break;
      case 'ArrowDown':
        e.preventDefault();
        cursorY = Math.min(session.logicalHeight, cursorY + step);
        updateVirtualCursor();
        break;
      case ' ':
        e.preventDefault();
        // Trigger action at cursor
        applyActionAtVirtualCursor();
        break;
      case 'Enter':
        if (state.tool === 'select' && !selectionRect) {
          e.preventDefault();
          const half = 40;
          selectionRect = normalizeSelectionRect(
            { x: (cursorX - half) * backingScale(), y: (cursorY - half) * backingScale() },
            { x: (cursorX + half) * backingScale(), y: (cursorY + half) * backingScale() }
          );
          selectionPixels = captureSelection();
          updateSelectionOutline();
        }
        break;
      case 'Delete':
      case 'Backspace':
        if (state.tool === 'select') {
          e.preventDefault();
          deleteSelection();
        }
        break;
      case 'Escape':
        if (selectionRect) {
          e.preventDefault();
          selectionRect = null;
          selectionPixels = null;
          updateSelectionOutline();
        }
        break;
      case 'b':
      case 'B':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          session.setTool('brush');
          updateUIFromState();
        }
        break;
      case 'e':
      case 'E':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          session.setTool('eraser');
          updateUIFromState();
        }
        break;
      case 'g':
      case 'G':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          session.setTool('fill');
          updateUIFromState();
        }
        break;
      case 's':
      case 'S':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          session.setTool('select');
          updateUIFromState();
        }
        break;
      case 'r':
      case 'R':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          session.setTool('shape');
          updateUIFromState();
        }
        break;
      case 'd':
      case 'D':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          moveSelectionBy(20, 20, true);
        }
        break;
      case 'h':
      case 'H':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          if (state.tool === 'select') flipSelectionHorizontally();
        }
        break;
      case 'i':
      case 'I':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          session.setTool('eyedropper');
          updateUIFromState();
        }
        break;
      case 'm':
      case 'M':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          session.toggleMirror();
          updateUIFromState();
        }
        break;
      case 'z':
      case 'Z':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (e.shiftKey) handleRedo();
          else handleUndo();
        } else if (!e.altKey) {
          session.setZoom(state.zoom === 1 ? 2 : 1);
          if (canvasStage) {
            canvasStage.style.setProperty('--paint-zoom', session.getState().zoom === 2 ? '2' : '1');
          }
          if (zoomBtn) zoomBtn.textContent = session.getState().zoom === 2 ? '🔍 2×' : '🔍 1×';
        }
        break;
      case 'y':
      case 'Y':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleRedo();
        }
        break;
      case '[':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          const newSize = Math.max(1, state.brushSize - 2);
          session.setBrushSize(newSize);
          updateUIFromState();
          updateVirtualCursor();
          announceStatus(t('paint.brushSizeStatus', { size: newSize }));
        }
        break;
      case ']':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          const newSize = Math.min(50, state.brushSize + 2);
          session.setBrushSize(newSize);
          updateUIFromState();
          updateVirtualCursor();
          announceStatus(t('paint.brushSizeStatus', { size: newSize }));
        }
        break;
      default:
        break;
    }
  }

  function applyActionAtVirtualCursor() {
    const state = session.getState();
    const scale = backingScale();
    const px = cursorX * scale;
    const py = cursorY * scale;

    if (state.tool === 'eyedropper') {
      const sampled = samplePixel(ctx, px, py);
      if (sampled) {
        session.setColor(sampled.hex);
        if (colorPicker) colorPicker.value = sampled.hex;
        updatePaletteActive();
        session.setTool('brush');
        updateUIFromState();
      }
      return;
    }

    let before;
    let changed = false;
    if (state.tool === 'brush' || state.tool === 'eraser') {
      before = captureHistorySnapshot(ctx, pointsBounds([{ x: px, y: py }], state.brushSize * scale, state.mirror));
      applyStroke(ctx, [{ x: px, y: py }], {
        size: state.brushSize * scale,
        color: state.color,
        isEraser: state.tool === 'eraser',
        mirror: state.mirror,
        axisX: session.mirrorAxisX * scale
      });
      changed = historySnapshotChanged(ctx, before);
    } else if (state.tool === 'fill') {
      before = captureHistorySnapshot(ctx);
      const fillBounds = {};
      changed = executeFloodFill(ctx, px, py, state.color, {
        tolerance: 16,
        mirror: state.mirror,
        axisX: session.mirrorAxisX * scale,
        bounds: fillBounds
      });
      if (changed) before = cropHistorySnapshot(before, floodBoundsRect(fillBounds));
    } else if (state.tool === 'shape') {
      const shapeSize = 40;
      before = captureHistorySnapshot(ctx, shapeBounds(
        px - shapeSize * scale,
        py - shapeSize * scale,
        px + shapeSize * scale,
        py + shapeSize * scale,
        state.brushSize * scale,
        state.mirror,
        session.mirrorAxisX * scale
      ));
      drawShape(ctx, state.shapeType, px - shapeSize * scale, py - shapeSize * scale, px + shapeSize * scale, py + shapeSize * scale, {
        color: state.color,
        size: state.brushSize * scale,
        filled: state.shapeFilled,
        mirror: state.mirror,
        axisX: session.mirrorAxisX * scale
      });
      changed = historySnapshotChanged(ctx, before);
    }

    if (changed) {
      session.pushHistory(before);
      session.markDirty(true);
      updateHistoryButtons();
      updateUIFromState();
      updateLivePreview();
      saveService.scheduleDraftCheckpoint();
    }
  }

  function handleUndo() {
    if (!session.canUndo()) return;
    const current = captureHistorySnapshot(ctx, session.peekUndo());
    const prev = session.undo(current);
    if (prev) {
      restoreHistorySnapshot(ctx, prev);
      updateHistoryButtons();
      updateUIFromState();
      announceStatus(t('paint.undoAnnouncement'));
      updateLivePreview();
      saveService.scheduleDraftCheckpoint();
    }
  }

  function handleRedo() {
    if (!session.canRedo()) return;
    const current = captureHistorySnapshot(ctx, session.peekRedo());
    const next = session.redo(current);
    if (next) {
      restoreHistorySnapshot(ctx, next);
      updateHistoryButtons();
      updateUIFromState();
      announceStatus(t('paint.redoAnnouncement'));
      updateLivePreview();
      saveService.scheduleDraftCheckpoint();
    }
  }

  async function updateLivePreview() {
    if (!previewStage) return;
    const renderToken = ++livePreviewToken;
    const state = session.getState();
    const mode = state.itemType === 'wearable' ? 'wearable' : 'prop';

    if (mode !== livePreviewMode) {
      previewStage.replaceChildren();
      livePreviewMode = mode;
      livePreviewCanvas = null;
      livePreviewDollWrap = null;
      livePreviewDollId = null;
    }

    if (!livePreviewCanvas) {
      livePreviewCanvas = document.createElement('canvas');
      livePreviewCanvas.style.width = '100%';
      livePreviewCanvas.style.height = '100%';
      livePreviewCanvas.style.position = 'absolute';
      livePreviewCanvas.style.inset = '0';
      livePreviewCanvas.style.zIndex = '2';
    }
    if (livePreviewCanvas.width !== canvas.width) livePreviewCanvas.width = canvas.width;
    if (livePreviewCanvas.height !== canvas.height) livePreviewCanvas.height = canvas.height;
    livePreviewCanvas.getContext('2d').drawImage(canvas, 0, 0);

    if (state.itemType === 'wearable') {
      if (!livePreviewDollWrap) {
        livePreviewDollWrap = document.createElement('div');
        livePreviewDollWrap.className = 'preview-doll-mini';
        livePreviewDollWrap.style.position = 'relative';
        livePreviewDollWrap.style.width = '100%';
        livePreviewDollWrap.style.height = '100%';
        livePreviewDollWrap.appendChild(livePreviewCanvas);
        previewStage.appendChild(livePreviewDollWrap);
      }

      if (svgLoader) {
        const baseDollId = state.baseDollId || 'doll_classic_a';
        if (baseDollId !== livePreviewDollId) {
          livePreviewDollId = baseDollId;
          livePreviewDollWrap.querySelector?.('.preview-doll-base')?.remove?.();
          try {
            const dollSvg = await svgLoader.load(baseDollId);
            if (renderToken !== livePreviewToken || session.getState().itemType !== 'wearable') return;
            if (dollSvg) {
            const clone = dollSvg.cloneNode(true);
            clone.classList.add('preview-doll-base');
            clone.setAttribute('aria-hidden', 'true');
            clone.style.width = '100%';
            clone.style.height = '100%';
            clone.style.position = 'absolute';
            clone.style.inset = '0';
            clone.style.opacity = '0.75';
            livePreviewDollWrap.insertBefore(clone, livePreviewCanvas);
            }
          } catch {
            // ignore
          }
        }
      }
    } else {
      livePreviewCanvas.className = 'preview-prop-mini';
      if (livePreviewCanvas.parentNode !== previewStage) previewStage.appendChild(livePreviewCanvas);
    }
  }

  function announceStatus(message) {
    if (statusElem) statusElem.textContent = message;
  }

  function switchSidebarTab(tab) {
    if (tabDraw) {
      tabDraw.classList.toggle('active', tab === 'draw');
      tabDraw.setAttribute('aria-selected', String(tab === 'draw'));
    }
    if (tabSetup) {
      tabSetup.classList.toggle('active', tab === 'setup');
      tabSetup.setAttribute('aria-selected', String(tab === 'setup'));
    }
    if (panelDraw) panelDraw.hidden = tab !== 'draw';
    if (panelSetup) panelSetup.hidden = tab !== 'setup';
  }

  function bindEvents() {
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('keydown', handleKeyDown);

    // Sidebar tab switching
    tabDraw?.addEventListener('click', () => switchSidebarTab('draw'));
    tabSetup?.addEventListener('click', () => switchSidebarTab('setup'));

    undoBtn?.addEventListener('click', handleUndo);
    redoBtn?.addEventListener('click', handleRedo);

    newBtn?.addEventListener('click', () => {
      if (session.getState().dirty) {
        checkDirtyBeforeAction(() => resetCanvas());
      } else {
        resetCanvas();
      }
    });

    backBtn?.addEventListener('click', () => {
      const origin = session.getState().originContext || 'designer';
      if (session.getState().dirty) {
        checkDirtyBeforeAction(() => {
          if (onNavigate) onNavigate(origin);
        });
      } else {
        if (onNavigate) onNavigate(origin);
      }
    });

    mirrorBtn?.addEventListener('click', () => {
      session.toggleMirror();
      updateUIFromState();
    });

    zoomBtn?.addEventListener('click', () => {
      const nextZoom = session.getState().zoom === 1 ? 2 : 1;
      session.setZoom(nextZoom);
      if (canvasStage) {
        canvasStage.style.setProperty('--paint-zoom', nextZoom === 2 ? '2' : '1');
      }
      if (zoomBtn) zoomBtn.textContent = nextZoom === 2 ? '🔍 2×' : '🔍 1×';
    });

    clearBtn?.addEventListener('click', async () => {
      if (canvasHasPixels()) {
        const confirmed = await (askConfirm?.(
          t('paint.clearCanvasTitle'),
          t('paint.clearCanvasMessage')
        ) ?? true);
        if (!confirmed) return;
      }
      const before = captureHistorySnapshot(ctx);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!historySnapshotChanged(ctx, before)) return;
      session.pushHistory(before);
      session.markDirty(true);
      updateHistoryButtons();
      updateUIFromState();
      updateLivePreview();
      saveService.scheduleDraftCheckpoint();
    });

    saveBtn?.addEventListener('click', saveService.openSaveDialog);

    // Type toggles
    typeWearableBtn?.addEventListener('click', () => {
      if (session.getState().itemType !== 'wearable') {
        checkDirtyBeforeAction(() => resetCanvas({ itemType: 'wearable', slot: slotSelect?.value || 'top' }));
      }
    });

    typePropBtn?.addEventListener('click', () => {
      if (session.getState().itemType !== 'prop') {
        checkDirtyBeforeAction(() => resetCanvas({ itemType: 'prop' }));
      }
    });

    slotSelect?.addEventListener('change', (e) => {
      const slot = e.target.value;
      cancelTransientOperation({ clearSelection: true });
      if (!session.setSlot(slot)) return;
      updateUIFromState();
      loadCutoutsForSlot(slot);
      renderGuideLayer();
      updateLivePreview();
      saveService.scheduleDraftCheckpoint();
      announceStatus(t('paint.slotChanged', { slot: slotLabel(slot) || slot }));
    });

    cutoutAddBtn?.addEventListener('click', () => {
      rasterizeCutoutIntoCanvas(session.getState().cutoutAssetId, 'add');
    });

    cutoutReplaceBtn?.addEventListener('click', () => {
      rasterizeCutoutIntoCanvas(session.getState().cutoutAssetId, 'replace');
    });

    propSizeSelect?.addEventListener('change', (e) => {
      session.setPropSize(e.target.value);
    });

    propPlacementSelect?.addEventListener('change', (e) => {
      session.setPropPlacement(e.target.value);
    });

    referenceVisible?.addEventListener('change', (e) => {
      session.setReferenceVisible(e.target.checked);
      renderGuideLayer();
      saveService.checkpointReferencePreferences();
      announceStatus(e.target.checked ? t('paint.referenceShown') : t('paint.referenceHidden'));
    });

    referenceModel?.addEventListener('change', (e) => {
      if (!session.setBaseDollId(e.target.value)) return;
      renderGuideLayer();
      updateLivePreview();
      saveService.checkpointReferencePreferences();
      announceStatus(t('paint.modelChanged', { name: e.target.selectedOptions?.[0]?.textContent || 'selected model' }));
    });

    referenceOpacity?.addEventListener('input', (e) => {
      session.setReferenceOpacity(Number(e.target.value));
      const value = session.getState().referenceOpacity;
      if (referenceOpacityValue) referenceOpacityValue.value = `${value}%`;
      if (guideLayer) guideLayer.style.setProperty('--reference-opacity', String(value / 100));
      saveService.checkpointReferencePreferences();
    });

    referenceOpacity?.addEventListener('change', () => {
      announceStatus(t('paint.opacityChanged', { percent: session.getState().referenceOpacity }));
    });

    guidesVisible?.addEventListener('change', (e) => {
      session.setGuidesVisible(e.target.checked);
      renderGuideLayer();
      saveService.checkpointReferencePreferences();
      announceStatus(e.target.checked ? t('paint.guidesShown') : t('paint.guidesHidden'));
    });

    cutoutReferenceVisible?.addEventListener('change', (e) => {
      session.setCutoutReferenceVisible(e.target.checked);
      renderGuideLayer();
      saveService.checkpointReferencePreferences();
      announceStatus(e.target.checked ? t('paint.cutoutRefShown') : t('paint.cutoutRefHidden'));
    });

    // Tools
    toolsToolbar?.addEventListener('click', (e) => {
      const btn = e.target.closest('.tool-btn');
      if (btn?.dataset.tool) {
        session.setTool(btn.dataset.tool);
        updateUIFromState();
      }
    });

    brushSizeSlider?.addEventListener('input', (e) => {
      const size = Number(e.target.value);
      session.setBrushSize(size);
      if (brushSizeValue) brushSizeValue.value = `${size}px`;
      updateVirtualCursor();
    });

    brushSizeSlider?.addEventListener('change', (e) => {
      const size = Number(e.target.value);
      session.setBrushSize(size);
      if (brushSizeValue) brushSizeValue.value = `${size}px`;
      updateVirtualCursor();
      announceStatus(t('paint.brushSizeStatus', { size }));
    });

    shapeOptions?.addEventListener('click', (e) => {
      const chip = e.target.closest('.shape-chip');
      if (chip?.dataset.shape) {
        session.setShapeType(chip.dataset.shape);
        shapeOptions.querySelectorAll('.shape-chip').forEach((c) => {
          const active = c.dataset.shape === chip.dataset.shape;
          c.classList.toggle('active', active);
          c.setAttribute('aria-checked', String(active));
        });
      }
    });

    shapeFilledCheckbox?.addEventListener('change', (e) => {
      session.setShapeFilled(e.target.checked);
    });

    activeColorSwatch?.addEventListener('click', () => {
      colorPicker?.click();
    });

    colorPicker?.addEventListener('input', (e) => {
      selectColor(e.target.value);
    });

    colorPicker?.addEventListener('change', (e) => {
      selectColor(e.target.value);
    });

    // Dirty dialog
    dirtyKeepBtn?.addEventListener('click', () => {
      dirtyDialog?.close();
      pendingNavigationHref = null;
    });

    dirtyDiscardBtn?.addEventListener('click', () => {
      dirtyDialog?.close();
      session.markDirty(false);
      customArtRepo?.clearDraft();
      if (typeof pendingNavigationHref === 'function') {
        pendingNavigationHref();
      }
      pendingNavigationHref = null;
    });

    dirtySaveBtn?.addEventListener('click', () => {
      dirtyDialog?.close();
      saveService.openSaveDialog();
    });

    saveService.bindEvents();
    libraryView.bindEvents();
  }

  function checkDirtyBeforeAction(actionCallback) {
    if (session.getState().dirty) {
      pendingNavigationHref = actionCallback;
      dirtyDialog?.showModal();
    } else {
      actionCallback();
    }
  }

  function openSession(options = {}) {
    resetCanvas(options);
    void saveService.checkDraftRecovery();
  }

  function cancelAsyncOperations() {
    cancelCutoutAction();
    cancelTransientOperation({ clearSelection: true });
    guideRenderToken += 1;
    void saveService.flushDraftCheckpoint();
  }

  function refreshLanguage() {
    updateUIFromState();
    renderPalette();
    const st = session.getState();
    if (st.itemType === 'wearable') {
      void loadCutoutsForSlot(st.slot);
    }
    libraryView.refreshLanguage();
    saveService.refreshLanguage();
  }

  function destroy() {
    window.removeEventListener('keydown', handleKeyDown);
    cancelAsyncOperations();
    saveService.destroy();
  }

  const saveService = createPaintSaveService({
    rootElement,
    store,
    customArtRepo,
    onNavigate,
    showAlert,
    getSession: () => session,
    getCanvasState: () => ({ canvas, ctx }),
    resetCanvas,
    updateLivePreview,
    announceStatus
  });

  const libraryView = createPaintLibraryView({
    rootElement,
    store,
    customArtRepo,
    onNavigate,
    askConfirm,
    showAlert,
    getSession: () => session,
    getCanvasState: () => ({ canvas, ctx }),
    resetCanvas,
    updateLivePreview,
    updateHistoryButtons,
    announceStatus,
    checkDirtyBeforeAction
  });

  init();

  return {
    openSession,
    editCopyOfArtwork: libraryView.editCopyOfArtwork,
    resetCanvas,
    openMyArtDialog: libraryView.openMyArtDialog,
    renderMyArtCards: libraryView.renderMyArtCards,
    checkDirtyBeforeAction,
    cancelAsyncOperations,
    destroy,
    flushDraftCheckpoint: saveService.flushDraftCheckpoint,
    refreshLanguage,
    getSessionState: () => session.getState()
  };
}
