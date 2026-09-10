/** Pointer drawing and canvas history transactions. */
import { applyStroke, interpolateStrokePoints, executeFloodFill, drawShape, samplePixel } from './paint-raster.js';
import { t } from '../../core/i18n.js';
import { captureHistorySnapshot, cropHistorySnapshot, historySnapshotChanged, restoreHistorySnapshot } from './paint-history.js';

// After Apple Pencil input, touches are treated as a resting palm for this long.
const PALM_REJECTION_MS = 3000;
// Finger-distance ratio that counts as pinching out (2×) or back in (1×).
const PINCH_ZOOM_RATIO = 1.25;

export function createPaintCanvasController(context) {
  let isPointerDown = false;

  let lastPointerPos = null;

  let selectionBeforeRect = null;

  let activePointerId = null;

  let activePointerType = null;

  let lastStrokeSize = null;

  let lastPenAt = -Infinity;

  /** Fingers on the canvas, tracked so two of them pinch instead of painting. */
  const touches = new Map();

  let pinchBaseline = null;

  function getCanvasCoordinates(e) {
    const rect = context.canvas.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches ? e.touches[0].clientX : 0);
    const clientY = e.clientY ?? (e.touches ? e.touches[0].clientY : 0);

    const scaleX = context.canvas.width / rect.width;
    const scaleY = context.canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function isOtherPointer(e) {
    return activePointerId != null && e?.pointerId != null && e.pointerId !== activePointerId;
  }

  function strokeSize(e, baseSize) {
    // Normal Apple Pencil pressure (~0.5) paints at the slider size.
    if (e?.pointerType !== 'pen' || !(e.pressure > 0)) return baseSize;
    return baseSize * Math.min(1.6, Math.max(0.3, e.pressure * 2));
  }

  function touchDistance() {
    const [a, b] = [...touches.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function setZoom(nextZoom) {
    context.session.setZoom(nextZoom);
    context.canvasStage?.style.setProperty('--paint-zoom', nextZoom === 2 ? '2' : '1');
    if (context.zoomBtn) context.zoomBtn.textContent = nextZoom === 2 ? '🔍 2×' : '🔍 1×';
  }

  /** Forgets a lifted finger; true while that finger was part of a pinch. */
  function releaseTouch(e) {
    if (!touches.delete(e?.pointerId)) return false;
    const wasPinch = pinchBaseline != null;
    if (touches.size === 0) pinchBaseline = null;
    return wasPinch;
  }

  function commitPendingOperation() {
    const before = context.pendingHistorySnapshot;
    const rect = context.pendingHistoryRect;
    context.pendingHistorySnapshot = null;
    context.pendingHistoryRect = null;
    context.pointerStart = null;
    if (!before) return false;
    if (!historySnapshotChanged(context.ctx, before, rect)) return false;
    const historySnapshot = cropHistorySnapshot(before, rect);
    context.session.pushHistory(historySnapshot);
    context.session.markDirty(true);
    updateHistoryButtons();
    context.updateUIFromState();
    context.saveService.scheduleDraftCheckpoint();
    return true;
  }

  function updateHistoryButtons() {
    if (context.undoBtn) context.undoBtn.disabled = !context.session.canUndo();
    if (context.redoBtn) context.redoBtn.disabled = !context.session.canRedo();
  }

  function handlePointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.pointerType === 'pen') lastPenAt = performance.now();
    if (e.pointerType === 'touch') {
      if (performance.now() - lastPenAt < PALM_REJECTION_MS) return;
      if (e.isPrimary) {
        touches.clear();
        pinchBaseline = null;
      }
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size >= 2) {
        // A second finger turns the gesture into a pinch; undo the first finger's dab.
        if (isPointerDown) cancelStroke();
        for (const id of touches.keys()) context.canvas.setPointerCapture?.(id);
        if (touches.size === 2) pinchBaseline = touchDistance();
        return;
      }
    }
    if (isPointerDown) {
      // The first pointer keeps its stroke, except a palm that landed before the Pencil.
      if (e.pointerType !== 'pen' || activePointerType !== 'touch') return;
      cancelStroke();
    }
    const coords = getCanvasCoordinates(e);
    const state = context.session.getState();
    if (state.tool === 'eyedropper') {
      const sampled = samplePixel(context.ctx, coords.x, coords.y);
      if (sampled) {
        context.session.setColor(sampled.hex);
        if (context.colorPicker) context.colorPicker.value = sampled.hex;
        context.updatePaletteActive();
        context.session.setTool('brush');
        context.updateUIFromState();
      }
      isPointerDown = false;
      return;
    }

    if (state.tool === 'fill') {
      const before = captureHistorySnapshot(context.ctx);
      const fillBounds = {};
      const changed = executeFloodFill(context.ctx, coords.x, coords.y, state.color, {
        tolerance: 16,
        mirror: state.mirror,
        axisX: context.session.mirrorAxisX * context.backingScale(),
        bounds: fillBounds
      });
      if (changed) {
        context.session.pushHistory(cropHistorySnapshot(before, context.floodBoundsRect(fillBounds)));
        context.session.markDirty(true);
        updateHistoryButtons();
        context.updateUIFromState();
        context.updateLivePreview();
        context.saveService.scheduleDraftCheckpoint();
      }
      return;
    }

    if (state.tool === 'select') {
      isPointerDown = true;
      activePointerId = e.pointerId;
      activePointerType = e.pointerType;
      context.canvas.setPointerCapture?.(e.pointerId);
      lastPointerPos = coords;
      context.pointerStart = coords;
      selectionBeforeRect = context.selectionRect;
      if (context.selectionContains(context.selectionRect, coords)) {
        context.pointerMode = 'select-move';
        context.selectionPixels = context.captureSelection();
        context.pendingHistorySnapshot = context.ctx.getImageData(0, 0, context.canvas.width, context.canvas.height);
        context.pendingHistoryRect = context.selectionRect;
      } else {
        context.pointerMode = 'select-rect';
        context.selectionPixels = null;
        context.pendingHistorySnapshot = null;
        context.pendingHistoryRect = null;
        context.selectionRect = context.normalizeSelectionRect(coords, coords);
        context.updateSelectionOutline();
      }
      return;
    }

    if (!['brush', 'eraser', 'shape'].includes(state.tool)) return;

    isPointerDown = true;
    activePointerId = e.pointerId;
    activePointerType = e.pointerType;
    context.canvas.setPointerCapture?.(e.pointerId);
    lastPointerPos = coords;
    context.pointerStart = coords;
    context.pendingHistorySnapshot = context.ctx.getImageData(0, 0, context.canvas.width, context.canvas.height);

    if (state.tool === 'brush' || state.tool === 'eraser') {
      const size = strokeSize(e, state.brushSize * context.backingScale());
      lastStrokeSize = size;
      applyStroke(context.ctx, [coords], {
        size,
        color: state.color,
        isEraser: state.tool === 'eraser',
        mirror: state.mirror,
        axisX: context.session.mirrorAxisX * context.backingScale()
      });
      context.includePendingRect(context.pointsBounds([coords], size, state.mirror));
      context.updateLivePreview();
    } else if (state.tool === 'shape') {
      drawShape(context.ctx, state.shapeType, coords.x, coords.y, coords.x, coords.y, {
        color: state.color,
        size: state.brushSize * context.backingScale(),
        filled: state.shapeFilled,
        mirror: state.mirror,
        axisX: context.session.mirrorAxisX * context.backingScale()
      });
      context.includePendingRect(context.shapeBounds(coords.x, coords.y, coords.x, coords.y, state.brushSize * context.backingScale(), state.mirror));
    }
  }

  function handlePointerMove(e) {
    if (touches.has(e.pointerId)) {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinchBaseline && touches.size === 2) {
        const ratio = touchDistance() / pinchBaseline;
        const zoomedIn = context.session.getState().zoom === 2;
        if (ratio >= PINCH_ZOOM_RATIO && !zoomedIn) setZoom(2);
        else if (ratio <= 1 / PINCH_ZOOM_RATIO && zoomedIn) setZoom(1);
      }
    }
    if (pinchBaseline) return;
    if (e.pointerType === 'pen') lastPenAt = performance.now();
    if (!isPointerDown || !lastPointerPos || isOtherPointer(e)) return;
    const coords = getCanvasCoordinates(e);
    const state = context.session.getState();

    if (state.tool === 'brush' || state.tool === 'eraser') {
      const size = strokeSize(e, state.brushSize * context.backingScale());
      const fromSize = lastStrokeSize ?? size;
      const points = interpolateStrokePoints(lastPointerPos, coords, 3);
      // Pencil pressure changes between events; ease the stamps from the old size to the new one.
      const sizedPoints = size === fromSize
        ? points
        : points.map((point, index) => ({ ...point, size: fromSize + (size - fromSize) * ((index + 1) / points.length) }));
      applyStroke(context.ctx, sizedPoints, {
        size,
        color: state.color,
        isEraser: state.tool === 'eraser',
        mirror: state.mirror,
        axisX: context.session.mirrorAxisX * context.backingScale()
      });
      context.includePendingRect(context.pointsBounds(points, Math.max(size, fromSize), state.mirror));
      lastStrokeSize = size;
      lastPointerPos = coords;
      context.scheduleLivePreview();
    } else if (context.pointerMode === 'select-rect' && context.pointerStart) {
      context.selectionRect = context.normalizeSelectionRect(context.pointerStart, coords);
      context.updateSelectionOutline();
    } else if (context.pointerMode === 'select-move' && context.pointerStart && context.selectionPixels) {
      context.ctx.putImageData(context.pendingHistorySnapshot, 0, 0);
      const dx = Math.round(coords.x - context.pointerStart.x);
      const dy = Math.round(coords.y - context.pointerStart.y);
      context.selectionRect = {
        ...selectionBeforeRect,
        x: Math.max(0, Math.min(context.canvas.width - selectionBeforeRect.width, selectionBeforeRect.x + dx)),
        y: Math.max(0, Math.min(context.canvas.height - selectionBeforeRect.height, selectionBeforeRect.y + dy))
      };
      context.includePendingRect(context.unionRects(selectionBeforeRect, context.selectionRect));
      context.ctx.clearRect(selectionBeforeRect.x, selectionBeforeRect.y, selectionBeforeRect.width, selectionBeforeRect.height);
      context.ctx.putImageData(context.selectionPixels, context.selectionRect.x, context.selectionRect.y);
      context.updateSelectionOutline();
      context.scheduleLivePreview();
    } else if (state.tool === 'shape' && context.pointerStart) {
      context.ctx.putImageData(context.pendingHistorySnapshot, 0, 0);
      drawShape(context.ctx, state.shapeType, context.pointerStart.x, context.pointerStart.y, coords.x, coords.y, {
        color: state.color,
        size: state.brushSize * context.backingScale(),
        filled: state.shapeFilled,
        mirror: state.mirror,
        axisX: context.session.mirrorAxisX * context.backingScale()
      });
      context.includePendingRect(context.shapeBounds(context.pointerStart.x, context.pointerStart.y, coords.x, coords.y, state.brushSize * context.backingScale(), state.mirror));
      lastPointerPos = coords;
      context.scheduleLivePreview();
    }
  }

  function handlePointerUp(e) {
    if (e.pointerType === 'pen') lastPenAt = performance.now();
    if (releaseTouch(e)) return;
    if (!isPointerDown || isOtherPointer(e)) return;
    isPointerDown = false;
    lastPointerPos = null;
    lastStrokeSize = null;
    context.canvas.releasePointerCapture?.(e.pointerId);
    activePointerId = null;
    activePointerType = null;

    if (context.pointerMode === 'select-rect') {
      context.pendingHistorySnapshot = null;
      context.pendingHistoryRect = null;
      context.pointerMode = null;
      context.selectionPixels = context.captureSelection();
      context.updateSelectionOutline();
      return;
    }
    context.pointerMode = null;
    commitPendingOperation();
    context.flushLivePreview();
  }

  /** Reverts the in-progress stroke or selection drag. */
  function cancelStroke(pointerId = activePointerId) {
    if (!isPointerDown) return;
    const cancelledSelection = context.pointerMode?.startsWith('select-');
    isPointerDown = false;
    lastPointerPos = null;
    lastStrokeSize = null;
    context.pointerStart = null;
    if (context.pendingHistorySnapshot) context.ctx.putImageData(context.pendingHistorySnapshot, 0, 0);
    context.pendingHistorySnapshot = null;
    context.pendingHistoryRect = null;
    context.pointerMode = null;
    if (cancelledSelection) {
      context.selectionRect = selectionBeforeRect;
      context.selectionPixels = context.captureSelection();
      context.updateSelectionOutline();
    }
    if (pointerId != null) context.canvas.releasePointerCapture?.(pointerId);
    activePointerId = null;
    activePointerType = null;
    context.flushLivePreview();
  }

  function handlePointerCancel(e) {
    if (releaseTouch(e)) return;
    if (isOtherPointer(e)) return;
    cancelStroke(e?.pointerId ?? activePointerId);
  }

  function cancelTransientOperation({ clearSelection = false } = {}) {
    if (isPointerDown) cancelStroke();
    if (clearSelection) {
      context.selectionRect = null;
      context.selectionPixels = null;
      selectionBeforeRect = null;
      context.updateSelectionOutline();
    }
  }

  function handleUndo() {
    if (!context.session.canUndo()) return;
    const current = captureHistorySnapshot(context.ctx, context.session.peekUndo());
    const prev = context.session.undo(current);
    if (prev) {
      restoreHistorySnapshot(context.ctx, prev);
      updateHistoryButtons();
      context.updateUIFromState();
      context.announceStatus(t('paint.undoAnnouncement'));
      context.updateLivePreview();
      context.saveService.scheduleDraftCheckpoint();
    }
  }

  function handleRedo() {
    if (!context.session.canRedo()) return;
    const current = captureHistorySnapshot(context.ctx, context.session.peekRedo());
    const next = context.session.redo(current);
    if (next) {
      restoreHistorySnapshot(context.ctx, next);
      updateHistoryButtons();
      context.updateUIFromState();
      context.announceStatus(t('paint.redoAnnouncement'));
      context.updateLivePreview();
      context.saveService.scheduleDraftCheckpoint();
    }
  }

  return { getCanvasCoordinates, commitPendingOperation, updateHistoryButtons, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel, cancelTransientOperation, handleUndo, handleRedo };
}
