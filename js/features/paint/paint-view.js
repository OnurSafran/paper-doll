/**
 * Custom Paint Studio — Feature View & Controller
 * Integrates responsive UI, authoring canvas, pointer & keyboard drawing,
 * live preview, toolbars, palette, save pipeline, and draft recovery.
 */

import { createPaintSession, validateArtworkName } from './paint-session.js';
import {
  applyStroke,
  interpolateStrokePoints,
  executeFloodFill,
  drawShape,
  samplePixel,
  computeNonTransparentBounds,
  calculatePropDisplayDimensions,
  canvasToBlob
} from './paint-raster.js';
import {
  CUSTOM_WEARABLE_DIMENSIONS,
  CUSTOM_PROP_DIMENSIONS,
  defaultMakeId,
  defaultNow,
  LIMITS
} from '../../domain/vocabulary.js';
import { countAssetUses, slotLabel } from '../../domain/outfit-rules.js';
import { getReferenceGuides } from './paint-guides.js';

const CURATED_PALETTE = [
  '#2d261e', '#ffffff', '#e76f51', '#f4a261',
  '#e9c46a', '#2a9d8f', '#264653', '#9b5de5',
  '#f15bb5', '#fee440', '#00bbf9', '#00f5d4',
  '#8d5b4c', '#d4a373', '#ccd5ae', '#e07a5f'
];

export function isTrustedCutoutDescriptor(asset, slot) {
  return Boolean(asset && !asset.custom && asset.kind === 'wearable' && asset.slot === slot && asset.id);
}

export function createPaintView({
  rootElement = document,
  store,
  customArtRepo,
  assetRegistry,
  svgLoader,
  onNavigate
} = {}) {
  let session = createPaintSession();
  let canvas = null;
  let ctx = null;
  let isPointerDown = false;
  let lastPointerPos = null;
  let cursorX = 150;
  let cursorY = 225;
  let draftTimer = null;
  let pendingNavigationHref = null;
  let pendingHistorySnapshot = null;
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
  const brushSizesContainer = rootElement.querySelector('#paint-brush-sizes');
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

  // Dialogs
  const saveDialog = rootElement.querySelector('#paint-save-dialog');
  const saveForm = rootElement.querySelector('#paint-save-form');
  const saveThumb = rootElement.querySelector('#paint-save-thumb');
  const nameInput = rootElement.querySelector('#paint-artwork-name');
  const saveMyArtBtn = rootElement.querySelector('#paint-save-myart-btn');
  const saveContextBtn = rootElement.querySelector('#paint-save-context-btn');
  const cancelSaveBtn = rootElement.querySelector('#paint-cancel-save-btn');

  const dirtyDialog = rootElement.querySelector('#paint-dirty-dialog');
  const dirtyKeepBtn = rootElement.querySelector('#paint-dirty-keep-btn');
  const dirtyDiscardBtn = rootElement.querySelector('#paint-dirty-discard-btn');
  const dirtySaveBtn = rootElement.querySelector('#paint-dirty-save-btn');

  const recoveryDialog = rootElement.querySelector('#paint-draft-recovery-dialog');
  const recoverContinueBtn = rootElement.querySelector('#paint-recover-continue-btn');
  const recoverDiscardBtn = rootElement.querySelector('#paint-recover-discard-btn');

  // My Art & Impact Dialogs (Gate 3)
  const myArtBtn = rootElement.querySelector('#paint-myart-btn');
  const myArtDialog = rootElement.querySelector('#paint-myart-dialog');
  const closeMyArtBtn = rootElement.querySelector('#close-myart-dialog');
  const myArtGrid = rootElement.querySelector('#paint-myart-grid');
  const myArtTabs = rootElement.querySelectorAll('#paint-myart-dialog .myart-tab-btn');
  const myArtTrashActions = rootElement.querySelector('#myart-trash-actions');
  const myArtEmptyTrashBtn = rootElement.querySelector('#myart-empty-trash-btn');

  const impactDialog = rootElement.querySelector('#paint-impact-dialog');
  const impactThumb = rootElement.querySelector('#impact-art-thumb');
  const impactName = rootElement.querySelector('#impact-art-name');
  const impactSummary = rootElement.querySelector('#impact-art-summary');
  const impactDetailsBox = rootElement.querySelector('#impact-details-box');
  const impactCancelBtn = rootElement.querySelector('#paint-impact-cancel-btn');
  const impactRemoveBtn = rootElement.querySelector('#paint-impact-remove-btn');
  const impactDeleteAllBtn = rootElement.querySelector('#paint-impact-delete-all-btn');

  const renameDialog = rootElement.querySelector('#paint-rename-dialog');
  const renameForm = rootElement.querySelector('#paint-rename-form');
  const renameInput = rootElement.querySelector('#paint-rename-input');
  const renameCancelBtn = rootElement.querySelector('#paint-rename-cancel-btn');

  let currentMyArtTab = 'all';
  let activeImpactAsset = null;
  let activeRenameAsset = null;

  function init() {
    canvas = rootElement.querySelector('#paint-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d', { willReadFrequently: true });

    renderPalette();
    bindEvents();
    resetCanvas();
  }

  function renderPalette() {
    if (!paletteGrid) return;
    paletteGrid.innerHTML = '';
    CURATED_PALETTE.forEach((hex) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'paint-swatch';
      btn.style.backgroundColor = hex;
      btn.title = hex;
      btn.setAttribute('aria-label', `Color ${hex}`);
      if (hex.toLowerCase() === session.getState().color.toLowerCase()) {
        btn.classList.add('active');
      }
      btn.addEventListener('click', () => {
        session.setColor(hex);
        if (colorPicker) colorPicker.value = hex;
        updatePaletteActive();
      });
      paletteGrid.appendChild(btn);
    });
  }

  function updatePaletteActive() {
    const currentColor = session.getState().color.toLowerCase();
    paletteGrid?.querySelectorAll('.paint-swatch').forEach((btn) => {
      btn.classList.toggle('active', btn.title.toLowerCase() === currentColor);
    });
    if (activeColorSwatch) {
      activeColorSwatch.style.backgroundColor = session.getState().color;
    }
  }

  function resetCanvas(options = {}) {
    cutoutActionToken += 1;
    cutoutActionPending = false;
    session = createPaintSession(options);
    pendingHistorySnapshot = null;
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
      canvasStage.style.setProperty('--paint-zoom', state.zoom === 2 ? '1.5' : '1');
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

    canvas?.setAttribute('aria-label',
      `${state.itemType === 'wearable' ? 'Wearable' : 'Prop'} artwork canvas. ` +
      `Tool: ${state.tool}. Zoom: ${state.zoom === 2 ? '2x' : '1x'}. ` +
      `${state.dirty ? 'Unsaved changes.' : 'No unsaved changes.'} ` +
      'Use pointer input or Arrow keys and Space to paint.');

    if (itemBadge) {
      itemBadge.textContent = state.itemType === 'wearable'
        ? `${state.slot.toUpperCase()} Cutout`
        : 'PROP';
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

    brushSizesContainer?.querySelectorAll('.size-chip').forEach((chip) => {
      const active = Number(chip.dataset.size) === state.brushSize;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-checked', String(active));
    });

    mirrorBtn?.setAttribute('aria-pressed', String(state.mirror));
    mirrorBtn?.classList.toggle('active', state.mirror);

    if (zoomBtn) {
      zoomBtn.textContent = state.zoom === 2 ? '🔍 2×' : '🔍 1×';
    }

    updatePaletteActive();
  }

  async function loadCutoutsForSlot(slot) {
    if (!cutoutGrid) return;
    cutoutGrid.innerHTML = '';
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
      setCutoutStatus('No starting cutouts are available for this slot.');
      return;
    }

    setCutoutStatus('Choose a cutout to use as a non-saving reference.');

    approvedCutouts.forEach((asset) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'cutout-card';
      card.dataset.assetId = asset.id;
      card.setAttribute('role', 'option');
      card.setAttribute('aria-selected', String(asset.id === selectedCutoutId));
      card.classList.toggle('active', asset.id === selectedCutoutId);
      card.title = asset.name || asset.id;
      card.setAttribute('aria-label', `Reference cutout: ${asset.name || asset.id}`);

      if (asset.path) {
        const image = document.createElement('img');
        image.src = asset.path;
        image.alt = '';
        image.setAttribute('aria-hidden', 'true');
        card.appendChild(image);
        const label = document.createElement('span');
        label.textContent = asset.name || asset.id;
        card.appendChild(label);
      } else {
        card.textContent = asset.name || asset.id;
      }

      card.addEventListener('click', () => {
        cancelCutoutAction();
        cutoutGrid.querySelectorAll('.cutout-card').forEach((c) => {
          c.classList.remove('active');
          c.setAttribute('aria-selected', 'false');
        });
        card.classList.add('active');
        card.setAttribute('aria-selected', 'true');
        session.setCutoutAssetId(asset.id);
        updateCutoutActions();
        renderGuideLayer();
        checkpointReferencePreferences();
        setCutoutStatus(`${asset.name || asset.id} selected as a non-saving reference.`);
      });

      cutoutGrid.appendChild(card);
    });
    if (selectedCutoutId) {
      const selected = getTrustedCutout(selectedCutoutId, slot);
      setCutoutStatus(`${selected?.name || selectedCutoutId} restored as a non-saving reference.`);
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
      setCutoutStatus('That cutout is unavailable for the current slot.');
      return false;
    }
    if (mode === 'replace' && canvasHasPixels() && !confirm('Replace the current artwork with this cutout? You can Undo afterward.')) {
      setCutoutStatus('Artwork kept unchanged.');
      return false;
    }

    const requestSession = session;
    const requestSlot = initialState.slot;
    const requestToken = ++cutoutActionToken;
    let url = null;
    let before = null;
    cutoutActionPending = true;
    updateCutoutActions();
    setCutoutStatus(`Loading ${initialAsset.name || assetId}…`);
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

      before = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (mode === 'replace') ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (!imageDataChanged(before)) {
        setCutoutStatus('The cutout did not change the artwork.');
        return false;
      }
      session.pushHistory(before);
      updateHistoryButtons();
      updateUIFromState();
      updateLivePreview();
      scheduleDraftCheckpoint();
      setCutoutStatus(`${initialAsset.name || assetId} ${mode === 'replace' ? 'replaced the artwork' : 'was added to the artwork'}.`);
      announceStatus(`Cutout ${mode === 'replace' ? 'replacement' : 'addition'} complete. Undo is available.`);
      return true;
    } catch (err) {
      if (before) ctx.putImageData(before, 0, 0);
      if (requestToken === cutoutActionToken) {
        console.warn('Could not rasterize cutout:', err);
        setCutoutStatus('Could not load that cutout. Your artwork was not changed.');
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
    guideLayer.innerHTML = '';
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

    for (const guide of getReferenceGuides(slot, modelId)) {
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

  function moveSelectionBy(dx, dy, duplicate = false) {
    if (!selectionRect) return false;
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
    session.pushHistory(before);
    session.markDirty(true);
    updateSelectionOutline();
    updateHistoryButtons();
    updateUIFromState();
    updateLivePreview();
    scheduleDraftCheckpoint();
    return true;
  }

  function deleteSelection() {
    if (!selectionRect) return false;
    const before = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.clearRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
    if (!imageDataChanged(before)) return false;
    selectionRect = null;
    selectionPixels = null;
    session.pushHistory(before);
    session.markDirty(true);
    updateSelectionOutline();
    updateHistoryButtons();
    updateUIFromState();
    updateLivePreview();
    scheduleDraftCheckpoint();
    return true;
  }

  function flipSelectionHorizontally() {
    if (!selectionRect) return false;
    const pixels = selectionPixels || captureSelection();
    if (!pixels) return false;
    const before = ctx.getImageData(0, 0, canvas.width, canvas.height);
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
    if (!imageDataChanged(before)) return false;
    session.pushHistory(before);
    session.markDirty(true);
    updateHistoryButtons();
    updateUIFromState();
    updateLivePreview();
    scheduleDraftCheckpoint();
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

  function imageDataChanged(before) {
    if (!before) return false;
    const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (current.data.length !== before.data.length) return true;
    for (let i = 0; i < current.data.length; i += 1) {
      if (current.data[i] !== before.data[i]) return true;
    }
    return false;
  }

  function commitPendingOperation() {
    const before = pendingHistorySnapshot;
    pendingHistorySnapshot = null;
    pointerStart = null;
    if (!imageDataChanged(before)) return false;
    session.pushHistory(before);
    session.markDirty(true);
    updateHistoryButtons();
    updateUIFromState();
    updateLivePreview();
    scheduleDraftCheckpoint();
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
      const before = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const changed = executeFloodFill(ctx, coords.x, coords.y, state.color, {
        tolerance: 16,
        mirror: state.mirror,
        axisX: (session.logicalWidth / 2) * 2 // scale factor 2
      });
      if (changed) {
        session.pushHistory(before);
        session.markDirty(true);
        updateHistoryButtons();
        updateUIFromState();
        updateLivePreview();
        scheduleDraftCheckpoint();
      }
      return;
    }

    if (state.tool === 'select') {
      isPointerDown = true;
      activePointerId = e.pointerId;
      canvas.setPointerCapture?.(e.pointerId);
      pointerStart = coords;
      selectionBeforeRect = selectionRect;
      pendingHistorySnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (selectionContains(selectionRect, coords)) {
        pointerMode = 'select-move';
        selectionPixels = captureSelection();
      } else {
        pointerMode = 'select-rect';
        selectionPixels = null;
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
        size: state.brushSize * 2, // scale factor 2
        color: state.color,
        isEraser: state.tool === 'eraser',
        mirror: state.mirror,
        axisX: (session.logicalWidth / 2) * 2
      });
      updateLivePreview();
    } else if (state.tool === 'shape') {
      drawShape(ctx, state.shapeType, coords.x, coords.y, coords.x, coords.y, {
        color: state.color,
        size: state.brushSize * 2,
        filled: state.shapeFilled,
        mirror: state.mirror,
        axisX: (session.logicalWidth / 2) * 2
      });
    }
  }

  function handlePointerMove(e) {
    if (!isPointerDown || !lastPointerPos) return;
    const coords = getCanvasCoordinates(e);
    const state = session.getState();

    if (state.tool === 'brush' || state.tool === 'eraser') {
      const points = interpolateStrokePoints(lastPointerPos, coords, 3);
      applyStroke(ctx, points, {
        size: state.brushSize * 2,
        color: state.color,
        isEraser: state.tool === 'eraser',
        mirror: state.mirror,
        axisX: (session.logicalWidth / 2) * 2
      });
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
      ctx.clearRect(selectionBeforeRect.x, selectionBeforeRect.y, selectionBeforeRect.width, selectionBeforeRect.height);
      ctx.putImageData(selectionPixels, selectionRect.x, selectionRect.y);
      updateSelectionOutline();
      updateLivePreview();
    } else if (state.tool === 'shape' && pointerStart) {
      ctx.putImageData(pendingHistorySnapshot, 0, 0);
      drawShape(ctx, state.shapeType, pointerStart.x, pointerStart.y, coords.x, coords.y, {
        color: state.color,
        size: state.brushSize * 2,
        filled: state.shapeFilled,
        mirror: state.mirror,
        axisX: (session.logicalWidth / 2) * 2
      });
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

    const state = session.getState();
    const step = e.shiftKey ? 1 : 10;

    if (state.tool === 'select' && selectionRect && /^Arrow/.test(e.key)) {
      e.preventDefault();
      const delta = e.key === 'ArrowLeft' ? [-step, 0] : e.key === 'ArrowRight' ? [step, 0] : e.key === 'ArrowUp' ? [0, -step] : [0, step];
      moveSelectionBy(delta[0] * 2, delta[1] * 2);
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
            { x: (cursorX - half) * 2, y: (cursorY - half) * 2 },
            { x: (cursorX + half) * 2, y: (cursorY + half) * 2 }
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
            canvasStage.style.setProperty('--paint-zoom', session.getState().zoom === 2 ? '1.5' : '1');
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
      default:
        break;
    }
  }

  function applyActionAtVirtualCursor() {
    const state = session.getState();
    const px = cursorX * 2;
    const py = cursorY * 2;

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

    const before = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let changed = false;
    if (state.tool === 'brush' || state.tool === 'eraser') {
      applyStroke(ctx, [{ x: px, y: py }], {
        size: state.brushSize * 2,
        color: state.color,
        isEraser: state.tool === 'eraser',
        mirror: state.mirror,
        axisX: (session.logicalWidth / 2) * 2
      });
      changed = imageDataChanged(before);
    } else if (state.tool === 'fill') {
      changed = executeFloodFill(ctx, px, py, state.color, {
        tolerance: 16,
        mirror: state.mirror,
        axisX: (session.logicalWidth / 2) * 2
      });
    } else if (state.tool === 'shape') {
      const shapeSize = 40;
      drawShape(ctx, state.shapeType, px - shapeSize * 2, py - shapeSize * 2, px + shapeSize * 2, py + shapeSize * 2, {
        color: state.color,
        size: state.brushSize * 2,
        filled: state.shapeFilled,
        mirror: state.mirror,
        axisX: (session.logicalWidth / 2) * 2
      });
      changed = imageDataChanged(before);
    }

    if (changed) {
      session.pushHistory(before);
      session.markDirty(true);
      updateHistoryButtons();
      updateUIFromState();
      updateLivePreview();
      scheduleDraftCheckpoint();
    }
  }

  function handleUndo() {
    if (!session.canUndo()) return;
    const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const prev = session.undo(current);
    if (prev) {
      ctx.putImageData(prev, 0, 0);
      updateHistoryButtons();
      updateUIFromState();
      announceStatus('Paint operation undone.');
      updateLivePreview();
      scheduleDraftCheckpoint();
    }
  }

  function handleRedo() {
    if (!session.canRedo()) return;
    const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const next = session.redo(current);
    if (next) {
      ctx.putImageData(next, 0, 0);
      updateHistoryButtons();
      updateUIFromState();
      announceStatus('Paint operation redone.');
      updateLivePreview();
      scheduleDraftCheckpoint();
    }
  }

  async function updateLivePreview() {
    if (!previewStage) return;
    previewStage.innerHTML = '';
    const state = session.getState();

    if (state.itemType === 'wearable') {
      const dollWrap = document.createElement('div');
      dollWrap.className = 'preview-doll-mini';
      dollWrap.style.position = 'relative';
      dollWrap.style.width = '100%';
      dollWrap.style.height = '100%';

      if (svgLoader) {
        const baseDollId = state.baseDollId || 'doll_classic_a';
        try {
          const dollSvg = await svgLoader.load(baseDollId);
          if (dollSvg && session.getState().itemType === 'wearable') {
            const clone = dollSvg.cloneNode(true);
            clone.setAttribute('aria-hidden', 'true');
            clone.style.width = '100%';
            clone.style.height = '100%';
            clone.style.position = 'absolute';
            clone.style.inset = '0';
            clone.style.opacity = '0.75';
            dollWrap.appendChild(clone);
          }
        } catch {
          // ignore
        }
      }

      const previewCanvas = document.createElement('canvas');
      previewCanvas.width = canvas.width;
      previewCanvas.height = canvas.height;
      const pCtx = previewCanvas.getContext('2d');
      pCtx.drawImage(canvas, 0, 0);
      previewCanvas.style.width = '100%';
      previewCanvas.style.height = '100%';
      previewCanvas.style.position = 'absolute';
      previewCanvas.style.inset = '0';
      previewCanvas.style.zIndex = '2';
      dollWrap.appendChild(previewCanvas);
      previewStage.appendChild(dollWrap);
    } else {
      const previewCanvas = document.createElement('canvas');
      previewCanvas.width = canvas.width;
      previewCanvas.height = canvas.height;
      const pCtx = previewCanvas.getContext('2d');
      pCtx.drawImage(canvas, 0, 0);
      previewCanvas.className = 'preview-prop-mini';
      previewStage.appendChild(previewCanvas);
    }
  }

  function scheduleDraftCheckpoint() {
    if (!customArtRepo) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      void flushDraftCheckpoint();
    }, 500);
  }

  async function flushDraftCheckpoint() {
    clearTimeout(draftTimer);
    draftTimer = null;
    if (!customArtRepo || !session.getState().dirty) return;
    try {
      const blob = await canvasToBlob(canvas);
      const state = session.getState();
      await customArtRepo.saveDraft(blob, {
        itemType: state.itemType,
        slot: state.slot,
        nameIsGenerated: state.nameIsGenerated,
        baseDollId: state.baseDollId,
        referenceVisible: state.referenceVisible,
        referenceOpacity: state.referenceOpacity,
        guidesVisible: state.guidesVisible,
        cutoutReferenceVisible: state.cutoutReferenceVisible,
        cutoutAssetId: state.cutoutAssetId,
        propSize: state.propSize,
        propPlacement: state.propPlacement,
        name: state.name
      });
    } catch (err) {
      console.warn('Draft checkpoint failed:', err);
    }
  }

  function checkpointReferencePreferences() {
    if (session.getState().dirty) scheduleDraftCheckpoint();
  }

  async function openSaveDialog() {
    if (!saveDialog) return;
    const state = session.getState();

    if (nameInput) nameInput.value = state.name;

    if (saveThumb) {
      saveThumb.innerHTML = '';
      const thumb = document.createElement('canvas');
      thumb.width = canvas.width;
      thumb.height = canvas.height;
      const tCtx = thumb.getContext('2d');
      tCtx.drawImage(canvas, 0, 0);
      saveThumb.appendChild(thumb);
    }

    if (saveContextBtn) {
      if (state.originContext === 'designer') {
        saveContextBtn.textContent = '💾 Save & Wear';
        saveContextBtn.hidden = false;
      } else if (state.originContext === 'play') {
        saveContextBtn.textContent = '💾 Save & Add to Stage';
        saveContextBtn.hidden = false;
      } else {
        saveContextBtn.hidden = true;
      }
    }

    saveDialog.showModal();
  }

  async function commitSave(andUse = false) {
    const rawName = nameInput ? nameInput.value : session.getState().name;
    const validation = validateArtworkName(rawName);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    session.setName(validation.name);
    const state = session.getState();
    const assetId = `custom_${defaultMakeId()}`;
    const now = defaultNow().toISOString();

    try {
      const blob = await canvasToBlob(canvas);
      if (!customArtRepo?.computeSha256) throw new Error('Artwork digest service is unavailable.');
      const sha256 = await customArtRepo.computeSha256(blob);

      let customMetadata = {
        assetId,
        name: validation.name,
        kind: state.itemType,
        format: 'image/png',
        logicalWidth: session.logicalWidth,
        logicalHeight: session.logicalHeight,
        pixelWidth: session.pixelWidth,
        pixelHeight: session.pixelHeight,
        byteLength: blob.size,
        sha256,
        createdAt: now,
        updatedAt: now,
        libraryVisible: true,
        status: 'available'
      };

      if (state.itemType === 'wearable') {
        customMetadata.slot = state.slot;
      } else {
        // Calculate display dimensions for prop
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const bounds = computeNonTransparentBounds(imgData);
        const dims = calculatePropDisplayDimensions(bounds.aspectRatio, state.propSize);
        customMetadata.displayWidth = dims.displayWidth;
        customMetadata.displayHeight = dims.displayHeight;
        customMetadata.groundAnchor = state.propPlacement === 'surface'
          ? { x: 0.5, y: 1.0 }
          : { x: 0.5, y: 0.5 };
      }

      // 1. Save binary to IndexedDB
      const binaryResult = await customArtRepo.saveArtwork(assetId, blob, customMetadata);
      if (!binaryResult?.ok) throw new Error(binaryResult?.error || 'Artwork binary could not be saved.');

      // 2. Commit metadata to AppStore
      const metadataResult = store.dispatch({
        type: 'customAsset/add',
        asset: customMetadata
      });
      if (!metadataResult?.ok) {
        throw new Error(metadataResult?.code === 'LIMIT'
          ? 'The My Art library is full. The draft is still available.'
          : 'Artwork metadata could not be committed. The draft is still available.');
      }

      // 3. Clear draft
      await customArtRepo.clearDraft('active');
      session.markDirty(false);
      saveDialog?.close();

      // 4. Contextual action if requested
      if (andUse && state.originContext === 'designer' && state.itemType === 'wearable') {
        store.dispatch({
          type: 'designer/equip',
          assetId
        });
        if (onNavigate) onNavigate('designer');
      } else if (andUse && state.originContext === 'play' && state.itemType === 'prop') {
        store.dispatch({
          type: 'scene/spawnProp',
          assetId
        });
        if (onNavigate) onNavigate('play');
      } else {
        announceStatus(`Saved "${validation.name}" to My Art!`);
      }
    } catch (err) {
      console.error('Save artwork failed:', err);
      alert(`Could not save artwork: ${err.message || 'Storage failure'}`);
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
        canvasStage.style.setProperty('--paint-zoom', nextZoom === 2 ? '1.5' : '1');
      }
      if (zoomBtn) zoomBtn.textContent = nextZoom === 2 ? '🔍 2×' : '🔍 1×';
    });

    clearBtn?.addEventListener('click', () => {
      const before = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!imageDataChanged(before)) return;
      session.pushHistory(before);
      session.markDirty(true);
      updateHistoryButtons();
      updateUIFromState();
      updateLivePreview();
      scheduleDraftCheckpoint();
    });

    saveBtn?.addEventListener('click', openSaveDialog);

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
      scheduleDraftCheckpoint();
      announceStatus(`Changed to ${slotLabel(slot) || slot}. Your artwork and paint history were kept.`);
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
      checkpointReferencePreferences();
      announceStatus(`Body reference ${e.target.checked ? 'shown' : 'hidden'}. Artwork pixels are unchanged.`);
    });

    referenceModel?.addEventListener('change', (e) => {
      if (!session.setBaseDollId(e.target.value)) return;
      renderGuideLayer();
      updateLivePreview();
      checkpointReferencePreferences();
      announceStatus(`Reference model changed to ${e.target.selectedOptions?.[0]?.textContent || 'selected model'}. Artwork pixels are unchanged.`);
    });

    referenceOpacity?.addEventListener('input', (e) => {
      session.setReferenceOpacity(Number(e.target.value));
      const value = session.getState().referenceOpacity;
      if (referenceOpacityValue) referenceOpacityValue.value = `${value}%`;
      if (guideLayer) guideLayer.style.setProperty('--reference-opacity', String(value / 100));
      checkpointReferencePreferences();
    });

    referenceOpacity?.addEventListener('change', () => {
      announceStatus(`Reference opacity ${session.getState().referenceOpacity} percent. Artwork pixels are unchanged.`);
    });

    guidesVisible?.addEventListener('change', (e) => {
      session.setGuidesVisible(e.target.checked);
      renderGuideLayer();
      checkpointReferencePreferences();
      announceStatus(`Alignment guides ${e.target.checked ? 'shown' : 'hidden'}. Artwork pixels are unchanged.`);
    });

    cutoutReferenceVisible?.addEventListener('change', (e) => {
      session.setCutoutReferenceVisible(e.target.checked);
      renderGuideLayer();
      checkpointReferencePreferences();
      announceStatus(`Cutout reference ${e.target.checked ? 'shown' : 'hidden'}. Artwork pixels are unchanged.`);
    });

    // Tools
    toolsToolbar?.addEventListener('click', (e) => {
      const btn = e.target.closest('.tool-btn');
      if (btn?.dataset.tool) {
        session.setTool(btn.dataset.tool);
        updateUIFromState();
      }
    });

    brushSizesContainer?.addEventListener('click', (e) => {
      const chip = e.target.closest('.size-chip');
      if (chip?.dataset.size) {
        session.setBrushSize(Number(chip.dataset.size));
        updateUIFromState();
        updateVirtualCursor();
      }
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

    colorPicker?.addEventListener('input', (e) => {
      session.setColor(e.target.value);
      updatePaletteActive();
    });

    // Save dialog
    saveForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      commitSave(true);
    });

    saveMyArtBtn?.addEventListener('click', () => {
      commitSave(false);
    });

    cancelSaveBtn?.addEventListener('click', () => {
      saveDialog?.close();
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
      openSaveDialog();
    });

    // Recovery dialog
    recoverContinueBtn?.addEventListener('click', async () => {
      recoveryDialog?.close();
      await restoreActiveDraft();
    });

    recoverDiscardBtn?.addEventListener('click', async () => {
      recoveryDialog?.close();
      await customArtRepo?.clearDraft();
    });

    // My Art dialog event bindings
    myArtBtn?.addEventListener('click', () => openMyArtDialog('all'));
    closeMyArtBtn?.addEventListener('click', () => myArtDialog?.close());
    myArtTabs?.forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => openMyArtDialog(tabBtn.dataset.tab));
    });
    myArtEmptyTrashBtn?.addEventListener('click', handleEmptyTrash);

    // Impact dialog event bindings
    impactCancelBtn?.addEventListener('click', () => impactDialog?.close());
    impactRemoveBtn?.addEventListener('click', () => {
      if (activeImpactAsset) handleRemoveFromMyArt(activeImpactAsset.assetId);
    });
    impactDeleteAllBtn?.addEventListener('click', () => {
      if (activeImpactAsset) handleDeleteWithUses(activeImpactAsset.assetId);
    });

    // Rename dialog event bindings
    renameCancelBtn?.addEventListener('click', () => renameDialog?.close());
    renameForm?.addEventListener('submit', handleSaveRename);
  }

  function openMyArtDialog(tab = 'all') {
    if (!myArtDialog) return;
    currentMyArtTab = tab;
    myArtTabs?.forEach((btn) => {
      const active = btn.dataset.tab === currentMyArtTab;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    if (myArtTrashActions) {
      myArtTrashActions.hidden = currentMyArtTab !== 'trash';
    }
    renderMyArtCards();
    myArtDialog.showModal();
  }

  async function renderMyArtCards() {
    if (!myArtGrid) return;
    myArtGrid.innerHTML = '';
    const state = store?.getState?.() || {};
    const allCustoms = state.customAssets || [];

    let filtered = [];
    if (currentMyArtTab === 'trash') {
      filtered = allCustoms.filter((a) => a.status === 'trashed' || a.libraryVisible === false);
    } else if (currentMyArtTab === 'wearable') {
      filtered = allCustoms.filter((a) => (a.status === 'available' || a.status == null) && a.libraryVisible !== false && a.kind === 'wearable');
    } else if (currentMyArtTab === 'prop') {
      filtered = allCustoms.filter((a) => (a.status === 'available' || a.status == null) && a.libraryVisible !== false && a.kind === 'prop');
    } else {
      filtered = allCustoms.filter((a) => (a.status === 'available' || a.status == null) && a.libraryVisible !== false);
    }

    if (filtered.length === 0) {
      const emptyP = document.createElement('p');
      emptyP.className = 'panel-copy';
      emptyP.style.gridColumn = '1 / -1';
      emptyP.style.textAlign = 'center';
      emptyP.style.padding = '2rem 1rem';
      emptyP.textContent = currentMyArtTab === 'trash'
        ? 'Trash is empty.'
        : 'No custom artwork found in this category. Click "+ New" to paint something!';
      myArtGrid.appendChild(emptyP);
      return;
    }

    for (const asset of filtered) {
      const card = document.createElement('article');
      card.className = `myart-card ${asset.status === 'trashed' ? 'is-trashed' : ''}`;
      card.setAttribute('role', 'listitem');

      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'myart-card-thumb-wrap';

      const img = document.createElement('img');
      img.alt = asset.name || 'Custom artwork';
      img.loading = 'lazy';

      // Load object URL
      if (customArtRepo?.getTrackedObjectUrl) {
        customArtRepo.getTrackedObjectUrl(asset.assetId).then((url) => {
          if (url) {
            img.src = url;
          } else {
            thumbWrap.innerHTML = `<span class="missing-art-label" style="font-size:0.75rem; color:var(--ink-muted);">🎨 ${asset.status === 'trashed' ? 'Trashed' : 'No preview'}</span>`;
          }
        }).catch(() => {});
      }
      thumbWrap.appendChild(img);
      card.appendChild(thumbWrap);

      const info = document.createElement('div');
      info.className = 'myart-card-info';

      const titleRow = document.createElement('div');
      titleRow.className = 'myart-card-title-row';

      const title = document.createElement('strong');
      title.className = 'myart-card-title';
      title.textContent = asset.name || 'Untitled';
      title.title = asset.name || 'Untitled';
      titleRow.appendChild(title);
      info.appendChild(titleRow);

      const meta = document.createElement('span');
      meta.className = 'myart-card-meta';
      const slotText = asset.kind === 'wearable' ? (slotLabel(asset.slot) || 'Wearable') : 'Prop';
      meta.textContent = `${slotText} • ${new Date(asset.createdAt || Date.now()).toLocaleDateString()}`;
      info.appendChild(meta);

      const impact = countAssetUses(asset.assetId, state);
      const usageBadge = document.createElement('span');
      usageBadge.className = 'panel-copy';
      usageBadge.style.fontSize = '0.78rem';
      usageBadge.textContent = impact.totalUses > 0
        ? `Used ${impact.totalUses} time${impact.totalUses === 1 ? '' : 's'}`
        : 'Not in use';
      info.appendChild(usageBadge);

      card.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'myart-card-actions';

      if (currentMyArtTab === 'trash') {
        const restoreBtn = document.createElement('button');
        restoreBtn.type = 'button';
        restoreBtn.className = 'button secondary myart-card-btn';
        restoreBtn.innerHTML = '↺ Restore';
        restoreBtn.title = `Restore "${asset.name}" to My Art`;
        restoreBtn.addEventListener('click', () => handleRestoreArtwork(asset.assetId));
        actions.appendChild(restoreBtn);

        const purgeBtn = document.createElement('button');
        purgeBtn.type = 'button';
        purgeBtn.className = 'button danger-fill myart-card-btn';
        purgeBtn.innerHTML = '🗑 Delete';
        purgeBtn.title = `Permanently delete "${asset.name}"`;
        purgeBtn.addEventListener('click', () => handleDeletePermanently(asset.assetId));
        actions.appendChild(purgeBtn);
      } else {
        const useBtn = document.createElement('button');
        useBtn.type = 'button';
        useBtn.className = 'button primary myart-card-btn';
        useBtn.innerHTML = asset.kind === 'wearable' ? '👗 Wear' : '➕ Add';
        useBtn.title = asset.kind === 'wearable' ? 'Wear on doll in Designer' : 'Add to scene in Play';
        useBtn.addEventListener('click', () => {
          myArtDialog.close();
          if (asset.kind === 'wearable') {
            store.dispatch({ type: 'designer/equip', assetId: asset.assetId });
            if (onNavigate) onNavigate('designer');
          } else {
            store.dispatch({ type: 'scene/spawnProp', assetId: asset.assetId });
            if (onNavigate) onNavigate('play');
          }
        });
        actions.appendChild(useBtn);

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'button secondary myart-card-btn';
        copyBtn.innerHTML = '📝 Edit Copy';
        copyBtn.title = `Edit a copy of "${asset.name}"`;
        copyBtn.addEventListener('click', () => editCopyOfArtwork(asset.assetId));
        actions.appendChild(copyBtn);

        const renameBtn = document.createElement('button');
        renameBtn.type = 'button';
        renameBtn.className = 'button secondary myart-card-btn';
        renameBtn.innerHTML = '✏️ Rename';
        renameBtn.title = `Rename "${asset.name}"`;
        renameBtn.addEventListener('click', () => openRenameDialog(asset));
        actions.appendChild(renameBtn);

        const impactBtn = document.createElement('button');
        impactBtn.type = 'button';
        impactBtn.className = 'button secondary myart-card-btn';
        impactBtn.innerHTML = '🗑 Remove';
        impactBtn.title = `Remove or delete "${asset.name}"`;
        impactBtn.addEventListener('click', () => openImpactDialog(asset));
        actions.appendChild(impactBtn);
      }

      card.appendChild(actions);
      myArtGrid.appendChild(card);
    }
  }

  async function editCopyOfArtwork(assetId) {
    if (!assetId) return;
    const state = store?.getState?.() || {};
    const asset = (state.customAssets || []).find((a) => a.assetId === assetId);
    if (!asset) return;

    checkDirtyBeforeAction(async () => {
      try {
        let record = await customArtRepo?.getArtwork?.(assetId);
        if (!record && customArtRepo?.getDraft) {
          const draft = await customArtRepo.getDraft('active');
          if (draft?.metadata?.assetId === assetId) record = draft;
        }
        if (!record?.blob) {
          alert('Artwork pixels could not be found for copying.');
          return;
        }

        const url = URL.createObjectURL(record.blob);
        const img = new Image();
        try {
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = url;
          });
        } finally {
          URL.revokeObjectURL(url);
        }

        resetCanvas({
          itemType: asset.kind || 'wearable',
          slot: asset.slot || 'top',
          propSize: asset.displayWidth > 240 ? 'large' : (asset.displayWidth < 180 ? 'small' : 'medium'),
          propPlacement: asset.groundAnchor?.y === 0.5 ? 'hang' : 'surface',
          name: `${asset.name} (Copy)`
        });

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        session.markDirty(true);
        updateLivePreview();
        updateHistoryButtons();
        myArtDialog?.close();
        announceStatus(`Opened copy of "${asset.name}". Saving will create a new artwork.`);
      } catch (err) {
        console.error('Edit copy failed:', err);
        alert('Could not edit copy of artwork.');
      }
    });
  }

  function openImpactDialog(asset) {
    if (!impactDialog || !asset) return;
    activeImpactAsset = asset;
    const state = store?.getState?.() || {};
    const impact = countAssetUses(asset.assetId, state);

    if (impactName) impactName.textContent = asset.name || 'Untitled';
    if (impactSummary) impactSummary.textContent = impact.formattedSummary;

    if (impactThumb) {
      impactThumb.innerHTML = '';
      const img = document.createElement('img');
      img.alt = asset.name || 'Artwork';
      customArtRepo?.getTrackedObjectUrl?.(asset.assetId).then((url) => {
        if (url) img.src = url;
      }).catch(() => {});
      impactThumb.appendChild(img);
    }

    if (impactDetailsBox) {
      impactDetailsBox.innerHTML = '';
      const list = document.createElement('ul');
      list.className = 'impact-details-list';

      if (impact.inDesignerDraft) {
        const li = document.createElement('li');
        li.innerHTML = '<span>👗</span> <span>Equipped in current <strong>Designer draft</strong></span>';
        list.appendChild(li);
      }

      for (const p of impact.presets) {
        const li = document.createElement('li');
        const icon = document.createElement('span');
        icon.textContent = '🎀';
        const text = document.createElement('span');
        text.append('Dollbox Preset: ');
        const name = document.createElement('strong');
        name.textContent = p.name || 'Untitled';
        text.append(name, ` (${p.count} use${p.count === 1 ? '' : 's'})`);
        li.append(icon, ' ', text);
        list.appendChild(li);
      }

      if (impact.currentSceneUses > 0) {
        const li = document.createElement('li');
        li.innerHTML = `<span>🎬</span> <span>Active Stage Scene: <strong>${impact.currentSceneUses} item${impact.currentSceneUses === 1 ? '' : 's'}</strong></span>`;
        list.appendChild(li);
      }

      for (const s of impact.scenes) {
        const li = document.createElement('li');
        const icon = document.createElement('span');
        icon.textContent = '📖';
        const text = document.createElement('span');
        text.append('Saved Scene: ');
        const title = document.createElement('strong');
        title.textContent = s.title || 'Untitled scene';
        text.append(title, ` (${s.count} item${s.count === 1 ? '' : 's'})`);
        li.append(icon, ' ', text);
        list.appendChild(li);
      }

      if (impact.totalUses === 0) {
        const li = document.createElement('li');
        li.innerHTML = '<span>✨</span> <span>Not currently used in any dolls or scenes.</span>';
        list.appendChild(li);
      }

      impactDetailsBox.appendChild(list);
    }

    impactDialog.showModal();
  }

  async function handleRemoveFromMyArt(assetId) {
    if (!assetId) return;
    try {
      const moved = await customArtRepo?.moveToTrash?.(assetId, 'user_removed');
      if (!moved?.ok) throw new Error(moved?.error || 'Artwork could not be moved to trash.');
      const removed = store.dispatch({ type: 'customAsset/remove', assetId });
      if (!removed?.ok) {
        await customArtRepo.restoreFromTrash(assetId);
        throw new Error('Artwork metadata could not be updated.');
      }
      impactDialog?.close();
      renderMyArtCards();
      announceStatus('Artwork removed from My Art. Retained placeholders in dolls and scenes.');
    } catch (err) {
      console.error('Remove artwork failed:', err);
      alert('Could not remove artwork.');
    }
  }

  async function handleDeleteWithUses(assetId) {
    if (!assetId) return;
    try {
      const moved = await customArtRepo?.moveToTrash?.(assetId, 'user_deleted_all_uses');
      if (!moved?.ok) throw new Error(moved?.error || 'Artwork could not be moved to trash.');
      const deleted = store.dispatch({ type: 'customAsset/deleteWithUses', assetId });
      if (!deleted?.ok) {
        await customArtRepo.restoreFromTrash(assetId);
        throw new Error('Artwork uses could not be deleted.');
      }
      impactDialog?.close();
      renderMyArtCards();
      announceStatus('Artwork and all its uses were deleted.');
    } catch (err) {
      console.error('Delete with uses failed:', err);
      alert('Could not delete artwork.');
    }
  }

  function openRenameDialog(asset) {
    if (!renameDialog || !asset) return;
    activeRenameAsset = asset;
    if (renameInput) renameInput.value = asset.name || '';
    renameDialog.showModal();
  }

  function handleSaveRename(e) {
    e?.preventDefault?.();
    if (!activeRenameAsset) return;
    const raw = renameInput?.value || '';
    const validation = validateArtworkName(raw);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }
    store.dispatch({
      type: 'customAsset/rename',
      assetId: activeRenameAsset.assetId,
      name: validation.name
    });
    renameDialog?.close();
    renderMyArtCards();
    announceStatus(`Artwork renamed to "${validation.name}".`);
  }

  async function handleRestoreArtwork(assetId) {
    if (!assetId) return;
    try {
      const restored = await customArtRepo?.restoreFromTrash?.(assetId);
      if (!restored?.ok) throw new Error(restored?.error || 'Artwork could not be restored from trash.');
      const metadataResult = store.dispatch({ type: 'customAsset/restore', assetId });
      if (!metadataResult?.ok) {
        await customArtRepo.moveToTrash(assetId, 'metadata_restore_failed');
        throw new Error('Artwork metadata could not be restored.');
      }
      renderMyArtCards();
      announceStatus('Artwork restored to My Art.');
    } catch (err) {
      console.error('Restore artwork failed:', err);
      alert('Could not restore artwork.');
    }
  }

  async function handleDeletePermanently(assetId) {
    if (!assetId) return;
    if (!confirm('Are you sure you want to permanently delete this artwork from trash?')) return;
    try {
      const deleted = store.dispatch({ type: 'customAsset/deleteWithUses', assetId });
      if (!deleted?.ok) throw new Error('Artwork metadata could not be deleted.');
      const binaryResult = await customArtRepo?.deleteArtwork?.(assetId);
      if (!binaryResult?.ok) {
        store.dispatch({ type: 'app/undo' });
        throw new Error(binaryResult?.error || 'Artwork pixels could not be deleted.');
      }
      renderMyArtCards();
      announceStatus('Artwork permanently deleted.');
    } catch (err) {
      console.error('Permanent deletion failed:', err);
      alert('Could not delete artwork.');
    }
  }

  async function handleEmptyTrash() {
    const currentState = store?.getState?.() || {};
    const referencedTrashCount = (currentState.customAssets || []).filter((asset) =>
      (asset.status === 'trashed' || asset.libraryVisible === false) &&
      countAssetUses(asset.assetId, currentState).totalUses > 0
    ).length;
    const confirmation = referencedTrashCount > 0
      ? `Permanently delete unused trash? ${referencedTrashCount} referenced item${referencedTrashCount === 1 ? '' : 's'} will be retained so dolls and scenes keep their placeholders.`
      : 'Are you sure you want to permanently empty the trash?';
    if (!confirm(confirmation)) return;
    try {
      const state = store?.getState?.() || {};
      const trashed = (state.customAssets || []).filter((asset) =>
        asset.status === 'trashed' || asset.libraryVisible === false
      );
      const deletableIds = trashed
        .filter((asset) => countAssetUses(asset.assetId, state).totalUses === 0)
        .map((asset) => asset.assetId);
      if (deletableIds.length > 0) {
        const emptied = await customArtRepo?.emptyTrash?.(deletableIds);
        if (!emptied?.ok) throw new Error(emptied?.error || 'Trash could not be emptied.');
        const purged = store.dispatch({ type: 'customAsset/purgeTrash', assetIds: deletableIds });
        if (!purged?.ok) throw new Error('Trashed artwork metadata could not be deleted.');
      }
      renderMyArtCards();
      const retainedCount = trashed.length - deletableIds.length;
      announceStatus(retainedCount > 0
        ? `Trash emptied for unused artwork. ${retainedCount} referenced item${retainedCount === 1 ? '' : 's'} retained safely.`
        : 'Trash emptied.');
    } catch (err) {
      console.error('Empty trash failed:', err);
      alert('Could not empty trash.');
    }
  }

  function checkDirtyBeforeAction(actionCallback) {
    if (session.getState().dirty) {
      pendingNavigationHref = actionCallback;
      dirtyDialog?.showModal();
    } else {
      actionCallback();
    }
  }

  async function checkDraftRecovery() {
    if (!customArtRepo || !recoveryDialog) return;
    try {
      const draft = await customArtRepo.getDraft('active');
      if (draft && draft.blob) {
        recoveryDialog.showModal();
      }
    } catch {
      // ignore
    }
  }

  async function restoreActiveDraft() {
    if (!customArtRepo) return;
    try {
      const draft = await customArtRepo.getDraft('active');
      if (!draft || !draft.blob) return;

      const url = URL.createObjectURL(draft.blob);
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      URL.revokeObjectURL(url);

      const metadata = draft.metadata || draft;

      resetCanvas({
        itemType: metadata.itemType || 'wearable',
        slot: metadata.slot || 'top',
        nameIsGenerated: metadata.nameIsGenerated,
        baseDollId: metadata.baseDollId,
        referenceVisible: metadata.referenceVisible,
        referenceOpacity: metadata.referenceOpacity,
        guidesVisible: metadata.guidesVisible,
        cutoutReferenceVisible: metadata.cutoutReferenceVisible,
        cutoutAssetId: metadata.cutoutAssetId,
        propSize: metadata.propSize || 'medium',
        propPlacement: metadata.propPlacement || 'surface',
        name: metadata.name || 'Recovered Art'
      });

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      session.markDirty(true);
      updateLivePreview();
    } catch (err) {
      console.warn('Could not restore draft:', err);
    }
  }

  function openSession(options = {}) {
    resetCanvas(options);
    checkDraftRecovery();
  }

  function cancelAsyncOperations() {
    cancelCutoutAction();
    cancelTransientOperation({ clearSelection: true });
    guideRenderToken += 1;
    void flushDraftCheckpoint();
  }

  init();

  return {
    openSession,
    resetCanvas,
    openMyArtDialog,
    renderMyArtCards,
    checkDirtyBeforeAction,
    cancelAsyncOperations,
    flushDraftCheckpoint,
    getSessionState: () => session.getState()
  };
}
