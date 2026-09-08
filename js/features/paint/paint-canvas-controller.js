/** Pointer drawing and canvas history transactions. */
import { applyStroke, interpolateStrokePoints, executeFloodFill, drawShape, samplePixel } from './paint-raster.js';
import { t } from '../../core/i18n.js';
import { captureHistorySnapshot, cropHistorySnapshot, historySnapshotChanged, restoreHistorySnapshot } from './paint-history.js';

export function createPaintCanvasController(context) {
  let isPointerDown = false;

  let lastPointerPos = null;

  let selectionBeforeRect = null;

  let activePointerId = null;

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
    context.canvas.setPointerCapture?.(e.pointerId);
    lastPointerPos = coords;
    context.pointerStart = coords;
    context.pendingHistorySnapshot = context.ctx.getImageData(0, 0, context.canvas.width, context.canvas.height);

    if (state.tool === 'brush' || state.tool === 'eraser') {
      applyStroke(context.ctx, [coords], {
        size: state.brushSize * context.backingScale(),
        color: state.color,
        isEraser: state.tool === 'eraser',
        mirror: state.mirror,
        axisX: context.session.mirrorAxisX * context.backingScale()
      });
      context.includePendingRect(context.pointsBounds([coords], state.brushSize * context.backingScale(), state.mirror));
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
    if (!isPointerDown || !lastPointerPos) return;
    const coords = getCanvasCoordinates(e);
    const state = context.session.getState();

    if (state.tool === 'brush' || state.tool === 'eraser') {
      const points = interpolateStrokePoints(lastPointerPos, coords, 3);
      applyStroke(context.ctx, points, {
        size: state.brushSize * context.backingScale(),
        color: state.color,
        isEraser: state.tool === 'eraser',
        mirror: state.mirror,
        axisX: context.session.mirrorAxisX * context.backingScale()
      });
      context.includePendingRect(context.pointsBounds(points, state.brushSize * context.backingScale(), state.mirror));
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
    if (!isPointerDown) return;
    isPointerDown = false;
    lastPointerPos = null;
    context.canvas.releasePointerCapture?.(e.pointerId);
    activePointerId = null;

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

  function handlePointerCancel(e) {
    if (!isPointerDown) return;
    const cancelledSelection = context.pointerMode?.startsWith('select-');
    isPointerDown = false;
    lastPointerPos = null;
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
    const pointerId = e?.pointerId ?? activePointerId;
    if (pointerId != null) context.canvas.releasePointerCapture?.(pointerId);
    activePointerId = null;
    context.flushLivePreview();
  }

  function cancelTransientOperation({ clearSelection = false } = {}) {
    if (isPointerDown) handlePointerCancel({ pointerId: activePointerId });
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
