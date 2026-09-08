import { createPaintControlsController } from './paint-controls-controller.js';
import { createPaintKeyboardController } from './paint-keyboard-controller.js';
import { createPaintCanvasController } from './paint-canvas-controller.js';
import { createPaintSelectionController } from './paint-selection-controller.js';
import { createPaintPreviewController } from './paint-preview-controller.js';
import { createPaintCutoutController } from './paint-cutout-controller.js';
import { createPaintPaletteController } from './paint-palette-controller.js';
/**
 * Custom Paint Studio — Feature View & Controller
 * Integrates responsive UI, authoring canvas, pointer & keyboard drawing,
 * live preview, toolbars, palette, save pipeline, and draft recovery.
 */

import { createPaintSession } from './paint-session.js';

import { SLOT_CUTOUT_FALLBACK_VIEWBOX } from '../../core/preview-viewboxes.js';

import { createPaintLibraryView } from './paint-library-view.js';
import { createPaintSaveService } from './paint-save-service.js';


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
  store = undefined,
  customArtRepo = undefined,
  assetRegistry = undefined,
  svgLoader = undefined,
  onNavigate = undefined,
  askConfirm = undefined,
  showAlert = undefined
} = {}) {
  let session = createPaintSession();
  let canvas = null;
  let ctx = null;

  let cursorX = 150;
  let cursorY = 225;
  let pendingNavigationHref = null;
  let pendingHistorySnapshot = null;
  let pendingHistoryRect = null;
  let pointerStart = null;
  let pointerMode = null;
  let selectionRect = null;
  let selectionPixels = null;

  let guideRenderToken = 0;

  let cutoutActionToken = 0;
  let cutoutActionPending = false;

  // DOM elements cache

  const canvasStage = /** @type {HTMLElement} */ (rootElement.querySelector('#paint-canvas-stage'));
  const guideLayer = /** @type {HTMLElement} */ (rootElement.querySelector('#paint-guide-layer'));

  const previewVariants = /** @type {HTMLElement} */ (rootElement.querySelector('#paint-preview-variants'));

  const statusElem = /** @type {HTMLElement} */ (rootElement.querySelector('#paint-status'));

  // Controls

  const undoBtn = /** @type {HTMLButtonElement} */ (rootElement.querySelector('#paint-undo-btn'));
  const redoBtn = /** @type {HTMLButtonElement} */ (rootElement.querySelector('#paint-redo-btn'));

  const zoomBtn = /** @type {HTMLButtonElement} */ (rootElement.querySelector('#paint-zoom-btn'));

  // Sidebar & Item Chip Popover
  const itemChip = /** @type {HTMLElement} */ (rootElement.querySelector('#paint-item-chip'));

  const itemConfigPopover = /** @type {HTMLDetailsElement} */ (rootElement.querySelector('#paint-item-config-popover'));

  const cutoutAddBtn = /** @type {HTMLButtonElement} */ (rootElement.querySelector('#paint-cutout-add-btn'));
  const cutoutReplaceBtn = /** @type {HTMLButtonElement} */ (rootElement.querySelector('#paint-cutout-replace-btn'));

  const cutoutReferenceVisible = /** @type {HTMLInputElement} */ (rootElement.querySelector('#paint-cutout-reference-visible'));
  const toolsToolbar = /** @type {HTMLElement} */ (rootElement.querySelector('#paint-tools-toolbar'));

  const brushSizeSlider = /** @type {HTMLInputElement} */ (rootElement.querySelector('#paint-brush-size-slider'));
  const brushSizeValue = /** @type {HTMLOutputElement} */ (rootElement.querySelector('#paint-brush-size-value'));
  const shapeOptions = /** @type {HTMLElement} */ (rootElement.querySelector('#paint-shape-options'));
  const shapeFilledCheckbox = /** @type {HTMLInputElement} */ (rootElement.querySelector('#paint-shape-filled'));

  const colorPicker = /** @type {HTMLInputElement} */ (rootElement.querySelector('#paint-color-picker'));

  // Sidebar tabs

  // Dirty-navigation dialog
  const dirtyDialog = /** @type {HTMLDialogElement} */ (rootElement.querySelector('#paint-dirty-dialog'));

  function backingScale() {
    return canvas?.width && session.logicalWidth ? canvas.width / session.logicalWidth : 1;
  }

  function init() {
    canvas = /** @type {HTMLCanvasElement} */ (rootElement.querySelector('#paint-canvas'));
    if (!canvas) return;
    ctx = canvas.getContext('2d', { willReadFrequently: true });

    renderPalette();
    bindEvents();
    resetCanvas();
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

  let previewRafId = null;

  function announceStatus(message) {
    if (statusElem) statusElem.textContent = message;
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
    if (previewRafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(previewRafId);
      previewRafId = null;
    }
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

  function handleDocumentClick(event) {
    if (itemConfigPopover && itemConfigPopover.open && !event.target.closest('#paint-item-config-popover')) {
      itemConfigPopover.open = false;
    }
  }

  function destroy() {
    window.removeEventListener('keydown', handleKeyDown);
    if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
      document.removeEventListener('click', handleDocumentClick);
    }
    cancelAsyncOperations();
    saveService.destroy();
  }

  const { renderPalette, updatePaletteActive, bindPaletteEvents } = createPaintPaletteController({
    rootElement,
    get session() { return session; }, set session(value) { session = value; },
    toolsToolbar,
    brushSizeSlider,
    brushSizeValue,
    shapeOptions,
    shapeFilledCheckbox,
    colorPicker,
    get updateUIFromState() { return updateUIFromState; },
    get updateVirtualCursor() { return updateVirtualCursor; },
    get announceStatus() { return announceStatus; }
  });

  const { loadCutoutsForSlot, cancelCutoutAction, getTrustedCutout, canvasHasPixels, rasterizeCutoutIntoCanvas } = createPaintCutoutController({
    get isTrustedCutoutDescriptor() { return isTrustedCutoutDescriptor; },
    get fitCutoutSvg() { return fitCutoutSvg; },
    rootElement,
    assetRegistry,
    svgLoader,
    askConfirm,
    get session() { return session; }, set session(value) { session = value; },
    get canvas() { return canvas; }, set canvas(value) { canvas = value; },
    get ctx() { return ctx; }, set ctx(value) { ctx = value; },
    get cutoutActionToken() { return cutoutActionToken; }, set cutoutActionToken(value) { cutoutActionToken = value; },
    get cutoutActionPending() { return cutoutActionPending; }, set cutoutActionPending(value) { cutoutActionPending = value; },
    cutoutAddBtn,
    cutoutReplaceBtn,
    cutoutReferenceVisible,
    get updateUIFromState() { return updateUIFromState; },
    get renderGuideLayer() { return renderGuideLayer; },
    get updateHistoryButtons() { return updateHistoryButtons; },
    get updateLivePreview() { return updateLivePreview; },
    get announceStatus() { return announceStatus; },
    get saveService() { return saveService; }
  });

  const { renderGuideLayer, scheduleLivePreview, flushLivePreview, updateLivePreview } = createPaintPreviewController({
    rootElement,
    svgLoader,
    get session() { return session; }, set session(value) { session = value; },
    get canvas() { return canvas; }, set canvas(value) { canvas = value; },
    get guideRenderToken() { return guideRenderToken; }, set guideRenderToken(value) { guideRenderToken = value; },
    guideLayer,
    get getTrustedCutout() { return getTrustedCutout; },
    get previewRafId() { return previewRafId; }, set previewRafId(value) { previewRafId = value; }
  });

  const { normalizeSelectionRect, selectionContains, updateSelectionOutline, captureSelection, unionRects, includePendingRect, pointsBounds, shapeBounds, floodBoundsRect, moveSelectionBy, deleteSelection, flipSelectionHorizontally } = createPaintSelectionController({
    rootElement,
    get session() { return session; }, set session(value) { session = value; },
    get canvas() { return canvas; }, set canvas(value) { canvas = value; },
    get ctx() { return ctx; }, set ctx(value) { ctx = value; },
    get pendingHistoryRect() { return pendingHistoryRect; }, set pendingHistoryRect(value) { pendingHistoryRect = value; },
    get selectionRect() { return selectionRect; }, set selectionRect(value) { selectionRect = value; },
    get selectionPixels() { return selectionPixels; }, set selectionPixels(value) { selectionPixels = value; },
    backingScale,
    get updateUIFromState() { return updateUIFromState; },
    get updateHistoryButtons() { return updateHistoryButtons; },
    get saveService() { return saveService; }
  });

  const { updateHistoryButtons, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel, cancelTransientOperation, handleUndo, handleRedo } = createPaintCanvasController({
    get session() { return session; }, set session(value) { session = value; },
    get canvas() { return canvas; }, set canvas(value) { canvas = value; },
    get ctx() { return ctx; }, set ctx(value) { ctx = value; },
    get pendingHistorySnapshot() { return pendingHistorySnapshot; }, set pendingHistorySnapshot(value) { pendingHistorySnapshot = value; },
    get pendingHistoryRect() { return pendingHistoryRect; }, set pendingHistoryRect(value) { pendingHistoryRect = value; },
    get pointerStart() { return pointerStart; }, set pointerStart(value) { pointerStart = value; },
    get pointerMode() { return pointerMode; }, set pointerMode(value) { pointerMode = value; },
    get selectionRect() { return selectionRect; }, set selectionRect(value) { selectionRect = value; },
    get selectionPixels() { return selectionPixels; }, set selectionPixels(value) { selectionPixels = value; },
    undoBtn,
    redoBtn,
    colorPicker,
    backingScale,
    get updatePaletteActive() { return updatePaletteActive; },
    get updateUIFromState() { return updateUIFromState; },
    get normalizeSelectionRect() { return normalizeSelectionRect; },
    get selectionContains() { return selectionContains; },
    get updateSelectionOutline() { return updateSelectionOutline; },
    get captureSelection() { return captureSelection; },
    get unionRects() { return unionRects; },
    get includePendingRect() { return includePendingRect; },
    get pointsBounds() { return pointsBounds; },
    get shapeBounds() { return shapeBounds; },
    get floodBoundsRect() { return floodBoundsRect; },
    get scheduleLivePreview() { return scheduleLivePreview; },
    get flushLivePreview() { return flushLivePreview; },
    get updateLivePreview() { return updateLivePreview; },
    get announceStatus() { return announceStatus; },
    get saveService() { return saveService; }
  });

  const { updateVirtualCursor, handleKeyDown } = createPaintKeyboardController({
    rootElement,
    get session() { return session; }, set session(value) { session = value; },
    get ctx() { return ctx; }, set ctx(value) { ctx = value; },
    get cursorX() { return cursorX; }, set cursorX(value) { cursorX = value; },
    get cursorY() { return cursorY; }, set cursorY(value) { cursorY = value; },
    get selectionRect() { return selectionRect; }, set selectionRect(value) { selectionRect = value; },
    get selectionPixels() { return selectionPixels; }, set selectionPixels(value) { selectionPixels = value; },
    canvasStage,
    zoomBtn,
    colorPicker,
    backingScale,
    get updatePaletteActive() { return updatePaletteActive; },
    get updateUIFromState() { return updateUIFromState; },
    get normalizeSelectionRect() { return normalizeSelectionRect; },
    get updateSelectionOutline() { return updateSelectionOutline; },
    get captureSelection() { return captureSelection; },
    get pointsBounds() { return pointsBounds; },
    get shapeBounds() { return shapeBounds; },
    get floodBoundsRect() { return floodBoundsRect; },
    get moveSelectionBy() { return moveSelectionBy; },
    get deleteSelection() { return deleteSelection; },
    get flipSelectionHorizontally() { return flipSelectionHorizontally; },
    get updateHistoryButtons() { return updateHistoryButtons; },
    get handleUndo() { return handleUndo; },
    get handleRedo() { return handleRedo; },
    get updateLivePreview() { return updateLivePreview; },
    get announceStatus() { return announceStatus; },
    get saveService() { return saveService; }
  });

  const { updateUIFromState, bindEvents } = createPaintControlsController({
    rootElement,
    customArtRepo,
    onNavigate,
    askConfirm,
    get session() { return session; }, set session(value) { session = value; },
    get canvas() { return canvas; }, set canvas(value) { canvas = value; },
    get ctx() { return ctx; }, set ctx(value) { ctx = value; },
    get pendingNavigationHref() { return pendingNavigationHref; }, set pendingNavigationHref(value) { pendingNavigationHref = value; },
    get selectionRect() { return selectionRect; }, set selectionRect(value) { selectionRect = value; },
    get selectionPixels() { return selectionPixels; }, set selectionPixels(value) { selectionPixels = value; },
    canvasStage,
    guideLayer,
    undoBtn,
    redoBtn,
    zoomBtn,
    cutoutAddBtn,
    cutoutReplaceBtn,
    cutoutReferenceVisible,
    toolsToolbar,
    brushSizeSlider,
    brushSizeValue,
    shapeOptions,
    shapeFilledCheckbox,
    dirtyDialog,
    get updatePaletteActive() { return updatePaletteActive; },
    get resetCanvas() { return resetCanvas; },
    get loadCutoutsForSlot() { return loadCutoutsForSlot; },
    get canvasHasPixels() { return canvasHasPixels; },
    get rasterizeCutoutIntoCanvas() { return rasterizeCutoutIntoCanvas; },
    get renderGuideLayer() { return renderGuideLayer; },
    get updateSelectionOutline() { return updateSelectionOutline; },
    get moveSelectionBy() { return moveSelectionBy; },
    get deleteSelection() { return deleteSelection; },
    get flipSelectionHorizontally() { return flipSelectionHorizontally; },
    get updateHistoryButtons() { return updateHistoryButtons; },
    get handlePointerDown() { return handlePointerDown; },
    get handlePointerMove() { return handlePointerMove; },
    get handlePointerUp() { return handlePointerUp; },
    get handlePointerCancel() { return handlePointerCancel; },
    get cancelTransientOperation() { return cancelTransientOperation; },
    get handleKeyDown() { return handleKeyDown; },
    get handleUndo() { return handleUndo; },
    get handleRedo() { return handleRedo; },
    get updateLivePreview() { return updateLivePreview; },
    get announceStatus() { return announceStatus; },
    get bindPaletteEvents() { return bindPaletteEvents; },
    get checkDirtyBeforeAction() { return checkDirtyBeforeAction; },
    get handleDocumentClick() { return handleDocumentClick; },
    get saveService() { return saveService; },
    get libraryView() { return libraryView; }
  });

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
