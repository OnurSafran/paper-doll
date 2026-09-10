/** Stage drag selection and compound entity previews. */
import { clientToLogical } from '../../core/coordinate-space.js';
import { clampCompoundEntityPoint, getAttachedDescendants } from '../../domain/scene-rules.js';
import { PointerController } from '../../core/pointer-controller.js?v=2';
import { escapeCss } from '../../core/css-escape.js';
import { CAMERA_CONSTANTS, DEFAULT_STAGE_WIDTH, VIEWPORT_WIDTH } from '../../domain/vocabulary.js';

export function createStagePointerController(context) {
  let pointerController = null;

  const previewPoints = new Map();

  const grabOffsets = new Map();

  function cancelPointerController() {
    context.stopEdgePan();
    const cancel = pointerController?.cancel;
    if (typeof cancel === 'function') cancel.call(pointerController);
  }

  function initPointerController() {
    const stageEl = context.$('#play-stage');
    if (!stageEl) return;
    context.initCameraControls();
    pointerController = new PointerController(stageEl, {
      selector: '.scene-entity-positioner',
      getId: (element) => element.dataset.instanceId,
      onSelect(instanceId, element, event) {
        const state = context.store.getState();
        const selectedIds = state.ui.selectedEntityIds || [];
        if (event?.shiftKey) {
          context.store.dispatch({ type: 'ui/toggleEntitySelection', instanceId });
        } else if (!selectedIds.includes(instanceId)) {
          context.store.dispatch({ type: 'ui/selectEntity', instanceId });
        }
      },
      onDeselect(event) {
        const uiState = context.store.getState().ui;
        const hasSelection = Boolean(uiState.selectedEntityId || uiState.selectedEntityIds?.length);
        if (!event?.shiftKey && hasSelection) {
          context.store.dispatch({ type: 'ui/clearSelection' });
        }
      },
      onStart(instanceId, element, event) {
        const state = context.store.getState();
        const selectedIds = (state.ui.selectedEntityIds?.length > 1 && state.ui.selectedEntityIds.includes(instanceId))
          ? state.ui.selectedEntityIds
          : [instanceId];

        const entitiesToDrag = state.currentScene.entities.filter((e) => selectedIds.includes(e.instanceId) && !e.pinned);
        if (entitiesToDrag.length === 0) return;

        context.playRenderToken += 1;
        previewPoints.clear();
        grabOffsets.clear();
        context.activeDragInstanceId = instanceId;
        context.latestDragPoint = event ? { clientX: event.clientX, clientY: event.clientY } : null;
        context.$('#scene-entities .context-ring')?.remove();

        if (event) {
          const stageRect = stageEl.getBoundingClientRect();
          const currentCameraX = state.currentScene.cameraX || 0;
          const pointerLogical = clientToLogical(event.clientX, event.clientY, stageRect, currentCameraX);

          for (const ent of entitiesToDrag) {
            const el = stageEl.querySelector(`.scene-entity-positioner[data-instance-id="${escapeCss(ent.instanceId)}"]`);
            if (el) el.classList.add('is-dragging');
            grabOffsets.set(ent.instanceId, {
              dx: ent.x - pointerLogical.x,
              dy: ent.y - pointerLogical.y,
              startX: ent.x,
              startY: ent.y
            });
            const descendants = getAttachedDescendants(state.currentScene, ent.instanceId);
            for (const d of descendants) {
              const childEl = stageEl.querySelector(`.scene-entity-positioner[data-instance-id="${escapeCss(d.instanceId)}"]`);
              if (childEl) childEl.classList.add('is-dragging');
            }
          }
        }
      },
      onPreview(instanceId, element, event) {
        context.latestDragPoint = { clientX: event.clientX, clientY: event.clientY };
        const stageRect = stageEl.getBoundingClientRect();
        const state = context.store.getState();
        const stageWidth = state.currentScene.stageWidth || DEFAULT_STAGE_WIDTH;
        if (stageWidth > VIEWPORT_WIDTH) {
          const clientXRel = event.clientX - stageRect.left;
          if (clientXRel < CAMERA_CONSTANTS.EDGE_ZONE) {
            context.startEdgePan(-1);
          } else if (clientXRel > stageRect.width - CAMERA_CONSTANTS.EDGE_ZONE) {
            context.startEdgePan(1);
          } else {
            context.stopEdgePan();
          }
        }
        updateDragPreview(instanceId, event);
      },
      onCommit(instanceId, element, event) {
        element?.classList?.remove('is-dragging');
        void event;
        context.stopEdgePan();
        for (const [id] of grabOffsets) {
          const el = stageEl.querySelector(`.scene-entity-positioner[data-instance-id="${escapeCss(id)}"]`);
          if (el) el.classList.remove('is-dragging');
          const descendants = getAttachedDescendants(context.store.getState().currentScene, id);
          for (const d of descendants) {
            const childEl = stageEl.querySelector(`.scene-entity-positioner[data-instance-id="${escapeCss(d.instanceId)}"]`);
            if (childEl) childEl.classList.remove('is-dragging');
          }
        }

        const moves = [];
        for (const [id] of grabOffsets) {
          const point = previewPoints.get(id);
          if (point) {
            moves.push({ instanceId: id, x: point.x, y: point.y });
          }
        }

        grabOffsets.clear();
        previewPoints.clear();
        context.activeDragInstanceId = null;
        context.latestDragPoint = null;

        if (moves.length > 1) {
          context.store.dispatch({ type: 'scene/moveEntities', moves });
        } else if (moves.length === 1) {
          context.store.dispatch({ type: 'scene/moveEntity', instanceId: moves[0].instanceId, x: moves[0].x, y: moves[0].y });
        }
      },
      onCancel(instanceId, element) {
        element?.classList?.remove('is-dragging');
        context.stopEdgePan();
        for (const [id] of grabOffsets) {
          const el = stageEl.querySelector(`.scene-entity-positioner[data-instance-id="${escapeCss(id)}"]`);
          if (el) el.classList.remove('is-dragging');
          const descendants = getAttachedDescendants(context.store.getState().currentScene, id);
          for (const d of descendants) {
            const childEl = stageEl.querySelector(`.scene-entity-positioner[data-instance-id="${escapeCss(d.instanceId)}"]`);
            if (childEl) childEl.classList.remove('is-dragging');
          }
        }
        grabOffsets.clear();
        previewPoints.clear();
        context.activeDragInstanceId = null;
        context.latestDragPoint = null;
        void context.render();
      }
    });
  }

  function updateDragPreview(instanceId, event) {
    const stageEl = context.$('#play-stage');
    if (!stageEl || !event) return;
    const state = context.store.getState();
    const stageRect = stageEl.getBoundingClientRect();
    const currentCameraX = state.currentScene.cameraX || 0;
    const pointerLogical = clientToLogical(event.clientX, event.clientY, stageRect, currentCameraX);
    const primaryOffset = grabOffsets.get(instanceId);
    if (!primaryOffset) return;

    const primaryRawX = pointerLogical.x + primaryOffset.dx;
    const primaryRawY = pointerLogical.y + primaryOffset.dy;
    const primaryClamped = clampCompoundEntityPoint(primaryRawX, primaryRawY, state.currentScene, instanceId, context.getAsset);
    const deltaX = primaryClamped.x - primaryOffset.startX;
    const deltaY = primaryClamped.y - primaryOffset.startY;

    for (const [id, offset] of grabOffsets) {
      const ent = state.currentScene.entities.find((e) => e.instanceId === id);
      if (!ent) continue;
      const targetX = offset.startX + deltaX;
      const targetY = offset.startY + deltaY;
      const clamped = clampCompoundEntityPoint(targetX, targetY, state.currentScene, id, context.getAsset);
      previewPoints.set(id, clamped);
      const el = stageEl.querySelector(`.scene-entity-positioner[data-instance-id="${escapeCss(id)}"]`);
      if (el) {
        el.style.setProperty('--x', String(clamped.x));
        el.style.setProperty('--y', String(clamped.y));
      }

      const descendants = getAttachedDescendants(state.currentScene, id);
      const childDeltaX = clamped.x - ent.x;
      const childDeltaY = clamped.y - ent.y;
      for (const d of descendants) {
        const childEl = stageEl.querySelector(`.scene-entity-positioner[data-instance-id="${escapeCss(d.instanceId)}"]`);
        if (childEl) {
          childEl.style.setProperty('--x', String(d.x + childDeltaX));
          childEl.style.setProperty('--y', String(d.y + childDeltaY));
        }
      }
    }
  }

  return { cancelPointerController, initPointerController, updateDragPreview };
}
