/**
 * Custom Paint Studio — Paint Session & History Management
 * Manages tool selection, colors, brush sizing, mirror toggles,
 * bounded Undo/Redo history, draft checkpoints, and name validation.
 */

import {
  CUSTOM_WEARABLE_DIMENSIONS,
  CUSTOM_PROP_DIMENSIONS,
  LIMITS
} from '../../domain/vocabulary.js';
import { t } from '../../core/i18n.js';

export const MAX_HISTORY_STEPS = 20;
export const MAX_HISTORY_BYTES = 32 * 1024 * 1024; // 32 MB
export const WEARABLE_PAINT_SLOTS = Object.freeze(['top', 'bottom', 'dress', 'shoes', 'hair', 'accessory']);
export const REFERENCE_DOLL_IDS = Object.freeze(['doll_classic_a', 'doll_classic_b', 'doll_chibi_a', 'doll_baby_a', 'doll_adult_a', 'doll_elder_a']);

/**
 * Validates a custom artwork name.
 */
export function validateArtworkName(name) {
  if (typeof name !== 'string') return { valid: false, error: t('paint.nameMustBeText') };
  const trimmed = name.trim();
  if (!trimmed) return { valid: false, error: t('paint.nameRequired') };

  const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;
  const length = segmenter ? [...segmenter.segment(trimmed)].length : trimmed.length;

  const maxLen = LIMITS.MAX_CUSTOM_ASSET_NAME_LENGTH || 30;
  if (length > maxLen) {
    return {
      valid: false,
      error: t('paint.nameTooLong', { max: maxLen })
    };
  }

  return { valid: true, name: trimmed };
}

/**
 * Creates a Paint Session model.
 */
export function createPaintSession(initialState = {}) {
  const itemType = initialState.itemType === 'prop' ? 'prop' : 'wearable';
  const slot = WEARABLE_PAINT_SLOTS.includes(initialState.slot)
    ? initialState.slot
    : 'top';

  const logicalWidth = itemType === 'wearable'
    ? CUSTOM_WEARABLE_DIMENSIONS.LOGICAL_WIDTH
    : CUSTOM_PROP_DIMENSIONS.LOGICAL_WIDTH;

  const logicalHeight = itemType === 'wearable'
    ? CUSTOM_WEARABLE_DIMENSIONS.LOGICAL_HEIGHT
    : CUSTOM_PROP_DIMENSIONS.LOGICAL_HEIGHT;

  const pixelWidth = itemType === 'wearable'
    ? CUSTOM_WEARABLE_DIMENSIONS.PIXEL_WIDTH
    : CUSTOM_PROP_DIMENSIONS.PIXEL_WIDTH;

  const pixelHeight = itemType === 'wearable'
    ? CUSTOM_WEARABLE_DIMENSIONS.PIXEL_HEIGHT
    : CUSTOM_PROP_DIMENSIONS.PIXEL_HEIGHT;

  let state = {
    itemType,
    slot,
    cutoutAssetId: typeof initialState.cutoutAssetId === 'string' ? initialState.cutoutAssetId : null,
    baseDollId: REFERENCE_DOLL_IDS.includes(initialState.baseDollId) ? initialState.baseDollId : 'doll_classic_a',
    referenceVisible: initialState.referenceVisible !== false,
    referenceOpacity: Number.isFinite(initialState.referenceOpacity)
      ? Math.max(20, Math.min(80, Math.round(initialState.referenceOpacity / 10) * 10))
      : 50,
    guidesVisible: initialState.guidesVisible !== false,
    cutoutReferenceVisible: initialState.cutoutReferenceVisible !== false,
    propSize: ['small', 'medium', 'large'].includes(initialState.propSize) ? initialState.propSize : 'medium',
    propPlacement: ['surface', 'hang'].includes(initialState.propPlacement) ? initialState.propPlacement : 'surface',
    tool: ['brush', 'eraser', 'fill', 'shape', 'select', 'eyedropper'].includes(initialState.tool) ? initialState.tool : 'brush',
    shapeType: ['line', 'rect', 'ellipse'].includes(initialState.shapeType) ? initialState.shapeType : 'rect',
    shapeFilled: Boolean(initialState.shapeFilled),
    brushSize: Number.isFinite(Number(initialState.brushSize)) && Number(initialState.brushSize) >= 1 && Number(initialState.brushSize) <= 50
      ? Math.round(Number(initialState.brushSize))
      : 10,
    color: typeof initialState.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(initialState.color) ? initialState.color : '#e76f51',
    mirror: Boolean(initialState.mirror),
    zoom: [1, 2, 'fit'].includes(initialState.zoom) ? initialState.zoom : 1,
    name: initialState.name || (itemType === 'wearable' ? `My ${slot}` : 'My Prop'),
    nameIsGenerated: initialState.nameIsGenerated == null ? !initialState.name : Boolean(initialState.nameIsGenerated),
    dirty: false,
    originContext: initialState.originContext || null // 'designer' | 'play' | 'library' | null
  };

  const undoStack = [];
  const redoStack = [];
  let historyBytes = 0;
  let metadataDirty = false;

  function snapshotBytes(snapshot) {
    if (!snapshot) return 0;
    if (snapshot.data?.byteLength != null) return snapshot.data.byteLength;
    if (snapshot.byteLength != null) return snapshot.byteLength;
    return 0;
  }

  function trimHistory() {
    while ((undoStack.length + redoStack.length) > MAX_HISTORY_STEPS || historyBytes > MAX_HISTORY_BYTES) {
      // Undo entries are the oldest user-visible states. Prefer evicting those
      // first, while still keeping the combined undo/redo memory bounded.
      const oldest = undoStack.length ? undoStack.shift() : redoStack.shift();
      if (!oldest) break;
      historyBytes -= snapshotBytes(oldest);
    }
    historyBytes = Math.max(0, historyBytes);
  }

  function getState() {
    return { ...state };
  }

  function setTool(tool) {
    if (['brush', 'eraser', 'fill', 'shape', 'select', 'eyedropper'].includes(tool)) {
      state = { ...state, tool };
    }
  }

  function setSlot(nextSlot) {
    if (state.itemType !== 'wearable' || !WEARABLE_PAINT_SLOTS.includes(nextSlot) || nextSlot === state.slot) {
      return false;
    }
    const name = state.nameIsGenerated ? `My ${nextSlot}` : state.name;
    metadataDirty = true;
    state = { ...state, slot: nextSlot, name, cutoutAssetId: null, dirty: true };
    return true;
  }

  function setBaseDollId(baseDollId) {
    if (!REFERENCE_DOLL_IDS.includes(baseDollId) || baseDollId === state.baseDollId) return false;
    state = { ...state, baseDollId };
    return true;
  }

  function setReferenceVisible(referenceVisible) {
    state = { ...state, referenceVisible: Boolean(referenceVisible) };
  }

  function setReferenceOpacity(referenceOpacity) {
    const value = Number(referenceOpacity);
    if (!Number.isFinite(value)) return;
    state = { ...state, referenceOpacity: Math.max(20, Math.min(80, Math.round(value / 10) * 10)) };
  }

  function setGuidesVisible(guidesVisible) {
    state = { ...state, guidesVisible: Boolean(guidesVisible) };
  }

  function setCutoutReferenceVisible(cutoutReferenceVisible) {
    state = { ...state, cutoutReferenceVisible: Boolean(cutoutReferenceVisible) };
  }

  function setCutoutAssetId(cutoutAssetId) {
    state = { ...state, cutoutAssetId: typeof cutoutAssetId === 'string' ? cutoutAssetId : null };
  }

  function setShapeType(shapeType) {
    if (['line', 'rect', 'ellipse'].includes(shapeType)) {
      state = { ...state, shapeType };
    }
  }

  function setShapeFilled(shapeFilled) {
    state = { ...state, shapeFilled: Boolean(shapeFilled) };
  }

  function setBrushSize(brushSize) {
    const size = Math.round(Number(brushSize));
    if (Number.isFinite(size) && size >= 1 && size <= 50) {
      state = { ...state, brushSize: size };
    }
  }

  function setColor(color) {
    if (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/i.test(color)) {
      state = { ...state, color: color.toLowerCase() };
    }
  }

  function toggleMirror() {
    state = { ...state, mirror: !state.mirror };
  }

  function setZoom(zoom) {
    if ([1, 2, 'fit'].includes(zoom)) {
      state = { ...state, zoom };
    }
  }

  function setPropSize(propSize) {
    if (['small', 'medium', 'large'].includes(propSize)) {
      state = { ...state, propSize };
    }
  }

  function setPropPlacement(propPlacement) {
    if (['surface', 'hang'].includes(propPlacement)) {
      state = { ...state, propPlacement };
    }
  }

  function setName(name) {
    if (name === state.name && !state.nameIsGenerated) return;
    metadataDirty = true;
    state = { ...state, name, nameIsGenerated: false, dirty: true };
  }

  function markDirty(dirty = true) {
    if (!dirty) metadataDirty = false;
    state = { ...state, dirty };
  }

  function pushHistory(snapshotImageData) {
    if (!snapshotImageData) return;
    undoStack.push(snapshotImageData);
    historyBytes += snapshotBytes(snapshotImageData);
    // Clear redo on new action
    for (const snapshot of redoStack) historyBytes -= snapshotBytes(snapshot);
    redoStack.length = 0;
    trimHistory();
    state = { ...state, dirty: true };
  }

  function canUndo() {
    return undoStack.length > 0;
  }

  function canRedo() {
    return redoStack.length > 0;
  }

  function undo(currentImageData) {
    if (!canUndo()) return null;
    if (currentImageData) {
      redoStack.push(currentImageData);
      historyBytes += snapshotBytes(currentImageData);
    }
    const previous = undoStack.pop();
    historyBytes -= snapshotBytes(previous);
    trimHistory();
    state = { ...state, dirty: metadataDirty || undoStack.length > 0 || redoStack.length > 0 };
    return previous;
  }

  function redo(currentImageData) {
    if (!canRedo()) return null;
    if (currentImageData) {
      undoStack.push(currentImageData);
      historyBytes += snapshotBytes(currentImageData);
    }
    const next = redoStack.pop();
    historyBytes -= snapshotBytes(next);
    trimHistory();
    state = { ...state, dirty: true };
    return next;
  }

  function clearHistory() {
    undoStack.length = 0;
    redoStack.length = 0;
    historyBytes = 0;
  }

  return {
    logicalWidth,
    logicalHeight,
    pixelWidth,
    pixelHeight,
    mirrorAxisX: logicalWidth / 2,
    getState,
    setSlot,
    setBaseDollId,
    setReferenceVisible,
    setReferenceOpacity,
    setGuidesVisible,
    setCutoutReferenceVisible,
    setCutoutAssetId,
    setTool,
    setShapeType,
    setShapeFilled,
    setBrushSize,
    setColor,
    toggleMirror,
    setZoom,
    setPropSize,
    setPropPlacement,
    setName,
    markDirty,
    pushHistory,
    canUndo,
    canRedo,
    undo,
    redo,
    clearHistory
  };
}
