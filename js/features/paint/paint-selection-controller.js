/** Canvas selection geometry, pixels, and transforms. */
import { captureHistorySnapshot, cropHistorySnapshot, historySnapshotChanged } from './paint-history.js';

export function createPaintSelectionController(context) {
  const selectionOutline = /** @type {HTMLElement} */ (context.rootElement.querySelector('#paint-selection-outline'));

  function normalizeSelectionRect(a, b) {
    const x0 = Math.max(0, Math.min(context.canvas.width, Math.floor(Math.min(a.x, b.x))));
    const y0 = Math.max(0, Math.min(context.canvas.height, Math.floor(Math.min(a.y, b.y))));
    const x1 = Math.max(0, Math.min(context.canvas.width, Math.ceil(Math.max(a.x, b.x))));
    const y1 = Math.max(0, Math.min(context.canvas.height, Math.ceil(Math.max(a.y, b.y))));
    return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
  }

  function selectionContains(rect, point) {
    return rect && point.x >= rect.x && point.x <= rect.x + rect.width &&
      point.y >= rect.y && point.y <= rect.y + rect.height;
  }

  function updateSelectionOutline() {
    if (!selectionOutline) return;
    if (!context.selectionRect || context.selectionRect.width === 0 || context.selectionRect.height === 0) {
      selectionOutline.style.display = 'none';
      return;
    }
    selectionOutline.style.display = 'block';
    selectionOutline.style.left = `${context.selectionRect.x / 2}px`;
    selectionOutline.style.top = `${context.selectionRect.y / 2}px`;
    selectionOutline.style.width = `${context.selectionRect.width / 2}px`;
    selectionOutline.style.height = `${context.selectionRect.height / 2}px`;
  }

  function captureSelection() {
    if (!context.selectionRect?.width || !context.selectionRect?.height) return null;
    return context.ctx.getImageData(context.selectionRect.x, context.selectionRect.y, context.selectionRect.width, context.selectionRect.height);
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
    context.pendingHistoryRect = unionRects(context.pendingHistoryRect, rect);
  }

  function pointsBounds(points, size, mirror = false, axisX = context.session.mirrorAxisX * context.backingScale()) {
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

  function shapeBounds(x0, y0, x1, y1, size, mirror = false, axisX = context.session.mirrorAxisX * context.backingScale()) {
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
    if (!context.selectionRect) return false;
    const previousRect = context.selectionRect;
    const before = context.ctx.getImageData(0, 0, context.canvas.width, context.canvas.height);
    const pixels = context.selectionPixels || captureSelection();
    if (!pixels) return false;
    const next = {
      ...context.selectionRect,
      x: Math.max(0, Math.min(context.canvas.width - context.selectionRect.width, context.selectionRect.x + dx)),
      y: Math.max(0, Math.min(context.canvas.height - context.selectionRect.height, context.selectionRect.y + dy))
    };
    if (next.x === context.selectionRect.x && next.y === context.selectionRect.y && !duplicate) return false;
    if (!duplicate) context.ctx.clearRect(context.selectionRect.x, context.selectionRect.y, context.selectionRect.width, context.selectionRect.height);
    context.ctx.putImageData(pixels, next.x, next.y);
    context.selectionRect = next;
    context.selectionPixels = pixels;
    context.session.pushHistory(cropHistorySnapshot(before, unionRects(previousRect, next)));
    context.session.markDirty(true);
    updateSelectionOutline();
    context.updateHistoryButtons();
    context.updateUIFromState();
    context.saveService.scheduleDraftCheckpoint();
    return true;
  }

  function deleteSelection() {
    if (!context.selectionRect) return false;
    const before = captureHistorySnapshot(context.ctx, context.selectionRect);
    context.ctx.clearRect(context.selectionRect.x, context.selectionRect.y, context.selectionRect.width, context.selectionRect.height);
    if (!historySnapshotChanged(context.ctx, before)) return false;
    context.selectionRect = null;
    context.selectionPixels = null;
    context.session.pushHistory(before);
    context.session.markDirty(true);
    updateSelectionOutline();
    context.updateHistoryButtons();
    context.updateUIFromState();
    context.saveService.scheduleDraftCheckpoint();
    return true;
  }

  function flipSelectionHorizontally() {
    if (!context.selectionRect) return false;
    const pixels = context.selectionPixels || captureSelection();
    if (!pixels) return false;
    const before = captureHistorySnapshot(context.ctx, context.selectionRect);
    const temp = document.createElement('canvas');
    temp.width = pixels.width;
    temp.height = pixels.height;
    const tempCtx = temp.getContext('2d');
    tempCtx.putImageData(pixels, 0, 0);
    context.ctx.save();
    context.ctx.clearRect(context.selectionRect.x, context.selectionRect.y, context.selectionRect.width, context.selectionRect.height);
    context.ctx.translate(context.selectionRect.x + context.selectionRect.width, context.selectionRect.y);
    context.ctx.scale(-1, 1);
    context.ctx.drawImage(temp, 0, 0);
    context.ctx.restore();
    context.selectionPixels = context.ctx.getImageData(context.selectionRect.x, context.selectionRect.y, context.selectionRect.width, context.selectionRect.height);
    if (!historySnapshotChanged(context.ctx, before)) return false;
    context.session.pushHistory(before);
    context.session.markDirty(true);
    context.updateHistoryButtons();
    context.updateUIFromState();
    context.saveService.scheduleDraftCheckpoint();
    return true;
  }

  return { normalizeSelectionRect, selectionContains, updateSelectionOutline, captureSelection, unionRects, includePendingRect, pointsBounds, shapeBounds, floodBoundsRect, moveSelectionBy, deleteSelection, flipSelectionHorizontally };
}
