/** Keyboard drawing, selection, and virtual cursor navigation. */
import { applyStroke, executeFloodFill, drawShape, samplePixel } from './paint-raster.js';
import { t } from '../../core/i18n.js';
import { captureHistorySnapshot, cropHistorySnapshot, historySnapshotChanged } from './paint-history.js';

export function createPaintKeyboardController(context) {
  const screen = /** @type {HTMLElement} */ (context.rootElement.querySelector('#paint-screen'));

  const virtualCursor = /** @type {HTMLElement} */ (context.rootElement.querySelector('#paint-cursor'));

  function updateVirtualCursor() {
    if (!virtualCursor || !context.canvasStage) return;
    const state = context.session.getState();
    context.canvasStage.style.setProperty('--cursor-x', `${context.cursorX}px`);
    context.canvasStage.style.setProperty('--cursor-y', `${context.cursorY}px`);
    context.canvasStage.style.setProperty('--cursor-size', `${state.brushSize}px`);
  }

  function handleKeyDown(e) {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' ||
      document.activeElement?.tagName === 'SELECT' || /** @type {HTMLElement} */ (document.activeElement)?.isContentEditable) {
      return;
    }
    if (screen && !screen.contains(document.activeElement) && !screen.contains(e.target)) return;
    if (e.key === ' ' && e.target?.closest?.('button, [role="button"]')) return;

    const state = context.session.getState();
    const step = e.shiftKey ? 1 : 10;

    if (state.tool === 'select' && context.selectionRect && /^Arrow/.test(e.key)) {
      e.preventDefault();
      const delta = e.key === 'ArrowLeft' ? [-step, 0] : e.key === 'ArrowRight' ? [step, 0] : e.key === 'ArrowUp' ? [0, -step] : [0, step];
      context.moveSelectionBy(delta[0] * context.backingScale(), delta[1] * context.backingScale());
      return;
    }

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        context.cursorX = Math.max(0, context.cursorX - step);
        updateVirtualCursor();
        break;
      case 'ArrowRight':
        e.preventDefault();
        context.cursorX = Math.min(context.session.logicalWidth, context.cursorX + step);
        updateVirtualCursor();
        break;
      case 'ArrowUp':
        e.preventDefault();
        context.cursorY = Math.max(0, context.cursorY - step);
        updateVirtualCursor();
        break;
      case 'ArrowDown':
        e.preventDefault();
        context.cursorY = Math.min(context.session.logicalHeight, context.cursorY + step);
        updateVirtualCursor();
        break;
      case ' ':
        e.preventDefault();
        // Trigger action at cursor
        applyActionAtVirtualCursor();
        break;
      case 'Enter':
        if (state.tool === 'select' && !context.selectionRect) {
          e.preventDefault();
          const half = 40;
          context.selectionRect = context.normalizeSelectionRect(
            { x: (context.cursorX - half) * context.backingScale(), y: (context.cursorY - half) * context.backingScale() },
            { x: (context.cursorX + half) * context.backingScale(), y: (context.cursorY + half) * context.backingScale() }
          );
          context.selectionPixels = context.captureSelection();
          context.updateSelectionOutline();
        }
        break;
      case 'Delete':
      case 'Backspace':
        if (state.tool === 'select') {
          e.preventDefault();
          context.deleteSelection();
        }
        break;
      case 'Escape':
        if (context.selectionRect) {
          e.preventDefault();
          context.selectionRect = null;
          context.selectionPixels = null;
          context.updateSelectionOutline();
        }
        break;
      case 'b':
      case 'B':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          context.session.setTool('brush');
          context.updateUIFromState();
        }
        break;
      case 'e':
      case 'E':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          context.session.setTool('eraser');
          context.updateUIFromState();
        }
        break;
      case 'g':
      case 'G':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          context.session.setTool('fill');
          context.updateUIFromState();
        }
        break;
      case 's':
      case 'S':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          context.session.setTool('select');
          context.updateUIFromState();
        }
        break;
      case 'r':
      case 'R':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          context.session.setTool('shape');
          context.updateUIFromState();
        }
        break;
      case 'd':
      case 'D':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          context.moveSelectionBy(20, 20, true);
        }
        break;
      case 'h':
      case 'H':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          if (state.tool === 'select') context.flipSelectionHorizontally();
        }
        break;
      case 'i':
      case 'I':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          context.session.setTool('eyedropper');
          context.updateUIFromState();
        }
        break;
      case 'm':
      case 'M':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          context.session.toggleMirror();
          context.updateUIFromState();
        }
        break;
      case 'z':
      case 'Z':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (e.shiftKey) context.handleRedo();
          else context.handleUndo();
        } else if (!e.altKey) {
          context.session.setZoom(state.zoom === 1 ? 2 : 1);
          if (context.canvasStage) {
            context.canvasStage.style.setProperty('--paint-zoom', context.session.getState().zoom === 2 ? '2' : '1');
          }
          if (context.zoomBtn) context.zoomBtn.textContent = context.session.getState().zoom === 2 ? '🔍 2×' : '🔍 1×';
        }
        break;
      case 'y':
      case 'Y':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          context.handleRedo();
        }
        break;
      case '[':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          const newSize = Math.max(1, state.brushSize - 2);
          context.session.setBrushSize(newSize);
          context.updateUIFromState();
          updateVirtualCursor();
          context.announceStatus(t('paint.brushSizeStatus', { size: newSize }));
        }
        break;
      case ']':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          const newSize = Math.min(50, state.brushSize + 2);
          context.session.setBrushSize(newSize);
          context.updateUIFromState();
          updateVirtualCursor();
          context.announceStatus(t('paint.brushSizeStatus', { size: newSize }));
        }
        break;
      default:
        break;
    }
  }

  function applyActionAtVirtualCursor() {
    const state = context.session.getState();
    const scale = context.backingScale();
    const px = context.cursorX * scale;
    const py = context.cursorY * scale;

    if (state.tool === 'eyedropper') {
      const sampled = samplePixel(context.ctx, px, py);
      if (sampled) {
        context.session.setColor(sampled.hex);
        if (context.colorPicker) context.colorPicker.value = sampled.hex;
        context.updatePaletteActive();
        context.session.setTool('brush');
        context.updateUIFromState();
      }
      return;
    }

    let before;
    let changed = false;
    if (state.tool === 'brush' || state.tool === 'eraser') {
      before = captureHistorySnapshot(context.ctx, context.pointsBounds([{ x: px, y: py }], state.brushSize * scale, state.mirror));
      applyStroke(context.ctx, [{ x: px, y: py }], {
        size: state.brushSize * scale,
        color: state.color,
        isEraser: state.tool === 'eraser',
        mirror: state.mirror,
        axisX: context.session.mirrorAxisX * scale
      });
      changed = historySnapshotChanged(context.ctx, before);
    } else if (state.tool === 'fill') {
      before = captureHistorySnapshot(context.ctx);
      const fillBounds = {};
      changed = executeFloodFill(context.ctx, px, py, state.color, {
        tolerance: 16,
        mirror: state.mirror,
        axisX: context.session.mirrorAxisX * scale,
        bounds: fillBounds
      });
      if (changed) before = cropHistorySnapshot(before, context.floodBoundsRect(fillBounds));
    } else if (state.tool === 'shape') {
      const shapeSize = 40;
      before = captureHistorySnapshot(context.ctx, context.shapeBounds(
        px - shapeSize * scale,
        py - shapeSize * scale,
        px + shapeSize * scale,
        py + shapeSize * scale,
        state.brushSize * scale,
        state.mirror,
        context.session.mirrorAxisX * scale
      ));
      drawShape(context.ctx, state.shapeType, px - shapeSize * scale, py - shapeSize * scale, px + shapeSize * scale, py + shapeSize * scale, {
        color: state.color,
        size: state.brushSize * scale,
        filled: state.shapeFilled,
        mirror: state.mirror,
        axisX: context.session.mirrorAxisX * scale
      });
      changed = historySnapshotChanged(context.ctx, before);
    }

    if (changed) {
      context.session.pushHistory(before);
      context.session.markDirty(true);
      context.updateHistoryButtons();
      context.updateUIFromState();
      context.updateLivePreview();
      context.saveService.scheduleDraftCheckpoint();
    }
  }

  return { updateVirtualCursor, handleKeyDown, applyActionAtVirtualCursor };
}
