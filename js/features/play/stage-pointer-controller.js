import { placeEntity, orderedSceneEntities, getPlacementGuides, usesPlacementDrag } from '../../domain/scene-placement.js';
/** Stage drag selection and compound entity previews. */
import { clientToLogical, renderedCameraX, stageContentRect } from '../../core/coordinate-space.js';
import { clampCompoundEntityPoint, getAttachedDescendants, moveEntities } from '../../domain/scene-rules.js';
import { PointerController } from '../../core/pointer-controller.js?v=2';
import { escapeCss } from '../../core/css-escape.js';
import { createStageHoverCursor } from './stage-hover-cursor.js';
import { CAMERA_CONSTANTS, DEFAULT_STAGE_WIDTH, VIEWPORT_WIDTH } from '../../domain/vocabulary.js';
import { t } from '../../core/i18n.js';

/** UI controls above the stage must neither resolve artwork nor clear selection. */
export function isStageArtworkEvent(stageEl, event) {
  const target = event?.target;
  if (!target?.closest) return false;
  if (target !== stageEl && !target.closest('#scene-world')) return false;
  if (target.closest('.context-ring, .scene-picker-group')) return false;
  const control = target.closest('button, a, input, select, textarea, [role="button"], [role="slider"]');
  return !control || control.classList.contains('scene-entity-positioner');
}

export function createStagePointerController(context) {
  let pointerController = null;
  let hoverCursor = null;
  let pointerStage = null;
  let disposing = false;

  const previewPoints = new Map();
  let previewTarget = null;
  let guide = null;
  const guidePolygons = new Map();
  function clearGuide() { guide?.remove(); guide = null; guidePolygons.clear(); }
  function showGuide(scene, entity, stageEl) {
    delete stageEl.dataset.placementPreview;
    const targets = getPlacementGuides(scene, entity, context.getAsset);
    const world = context.$('#scene-world');
    if (!targets.length || !world) { clearGuide(); return; }
    if (!guide) {
      guide = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      guide.setAttribute('class', 'placement-drop-guide');
      guide.setAttribute('aria-hidden', 'true');
      world.append(guide);
    }
    guide.setAttribute('viewBox', `0 0 ${scene.stageWidth || 1600} 900`);
    guide.setAttribute('data-motion', context.store.getState().settings.reducedMotion || 'system');
    const keys = new Set();
    for (const target of targets) {
      const key = target.kind === 'surface' ? `surface:${target.hostId}:${target.surface.id}` : target.regionId;
      keys.add(key);
      let nodes = guidePolygons.get(key);
      if (!nodes) {
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const echo = target.kind === 'surface' ? document.createElementNS('http://www.w3.org/2000/svg', 'polygon') : null;
        echo?.setAttribute('class', 'tabletop-guide-echo');
        nodes = { polygon, echo };
        guidePolygons.set(key, nodes);
        guide.append(polygon);
        if (echo) guide.append(echo);
      }
      for (const polygon of [nodes.polygon, nodes.echo]) {
        if (!polygon) continue;
        polygon.setAttribute('points', target.polygon.map(p => p.join(',')).join(' '));
        polygon.setAttribute('data-kind', target.kind);
        polygon.setAttribute('data-active', String(target.active));
      }
    }
    // Patch existing nodes so the gentle bob does not restart on pointer moves.
    for (const [key, nodes] of guidePolygons) {
      if (!keys.has(key)) { nodes.polygon.remove(); nodes.echo?.remove(); guidePolygons.delete(key); }
    }
    stageEl.dataset.placementPreview = targets.find(t => t.active)?.kind || 'available';
  }

  const grabOffsets = new Map();

  function cancelPointerController() {
    const cancel = pointerController?.cancel;
    if (typeof cancel === 'function') cancel.call(pointerController);
    hoverCursor?.setDragging(false);
    hoverCursor?.clear();
    clearGuide();
    context.stopEdgePan();
  }

  function onHoverMove(event) { hoverCursor?.onMove(event); }
  function onPointerLeave() { hoverCursor?.clear(); }
  function onDoubleClick(event) {
    const element = resolveEntityAt(pointerStage, event);
    if (!element?.classList.contains('is-bubble-entity')) return;
    const entity = context.store.getState().currentScene.entities.find(e => e.instanceId === element.dataset.instanceId);
    if (!entity) return;
    event.stopPropagation();
    context.openEditBubbleDialog?.(entity);
  }

  function destroy() {
    disposing = true;
    cancelPointerController();
    pointerController?.destroy();
    pointerController = null;
    pointerStage?.removeEventListener('pointermove', onHoverMove);
    pointerStage?.removeEventListener('pointerleave', onPointerLeave);
    pointerStage?.removeEventListener('dblclick', onDoubleClick);
    hoverCursor = null;
    pointerStage = null;
    disposing = false;
  }

  /**
   * One selection authority: the foremost entity whose visible artwork is under
   * the pointer, passing through transparent artwork. Stage UI never resolves.
   */
  function resolveEntityAt(stageEl, event) {
    const target = event?.target;
    if (!target?.closest || !context.hitTester) return target?.closest?.('.scene-entity-positioner') || null;
    if (!isStageArtworkEvent(stageEl, event)) return null;
    const cameraX = renderedCameraX(stageEl, context.store.getState().currentScene.cameraX);
    return context.hitTester.resolve(stageEl, event.clientX, event.clientY, cameraX);
  }

  /**
   * Where a client point lands on the stage: its logical point, and the foremost
   * entity whose visible artwork is there (null over stage UI or empty space).
   * Used by non-pointer-session inputs such as palette drops.
   */
  function stagePointAt(event) {
    const stageEl = context.$('#play-stage');
    const rect = stageContentRect(stageEl);
    const cameraX = renderedCameraX(stageEl, context.store.getState().currentScene.cameraX, rect);
    return {
      point: clientToLogical(event.clientX, event.clientY, rect, cameraX),
      element: isStageArtworkEvent(stageEl, event) ? context.hitTester?.resolve(stageEl, event.clientX, event.clientY, cameraX) ?? null : null
    };
  }

  function initPointerController() {
    if (pointerController) return;
    const stageEl = context.$('#play-stage');
    if (!stageEl) return;
    pointerStage = stageEl;
    context.initCameraControls();
    hoverCursor = createStageHoverCursor({
      stageEl,
      isArtworkEvent: (event) => isStageArtworkEvent(stageEl, event),
      resolve: (event) => resolveEntityAt(stageEl, event)
    });
    stageEl.addEventListener('pointermove', onHoverMove);
    stageEl.addEventListener('pointerleave', onPointerLeave);
    stageEl.addEventListener('dblclick', onDoubleClick);
    pointerController = new PointerController(stageEl, {
      selector: '.scene-entity-positioner',
      shouldHandleEvent: (event) => !context.hitTester || isStageArtworkEvent(stageEl, event),
      getId: (element) => element.dataset.instanceId,
      resolveSubject: (event) => resolveEntityAt(stageEl, event),
      onSelect(instanceId, element, event) {
        // The native focus follows the front button; hand it to the resolved entity.
        const pressed = event?.target?.closest?.('.scene-entity-positioner');
        const owner = pointerController;
        if (pressed !== element) setTimeout(() => {
          if (pointerController !== owner) return;
          const focused = globalThis.document?.activeElement;
          if (element.isConnected && context.store.getState().ui.selectedEntityId === instanceId
            && (!focused || focused === pressed || focused === stageEl || focused === globalThis.document?.body)) element.focus({ preventScroll: true });
        }, 0);
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
        if (!entitiesToDrag.some(entity => entity.instanceId === instanceId)) {
          context.store.dispatch({ type: 'ui/message', message: t('play.pinnedMoveBlocked') });
          return false;
        }

        hoverCursor?.setDragging(true);
        context.playRenderToken += 1;
        previewTarget = null;
        clearGuide();
        delete stageEl.dataset.placementPreview;
        previewPoints.clear();
        grabOffsets.clear();
        context.activeDragInstanceId = instanceId;
        context.latestDragPoint = event ? { clientX: event.clientX, clientY: event.clientY } : null;
        context.updateContextRingPosition?.();

        if (event) {
          const stageRect = stageContentRect(stageEl);
          const currentCameraX = renderedCameraX(stageEl, state.currentScene.cameraX, stageRect);
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
        if (entitiesToDrag.length === 1 && usesPlacementDrag(state.currentScene, entitiesToDrag[0], context.getAsset)) {
          showGuide(state.currentScene, entitiesToDrag[0], stageEl);
        }
      },
      onPreview(instanceId, element, event) {
        context.latestDragPoint = { clientX: event.clientX, clientY: event.clientY };
        const stageRect = stageContentRect(stageEl);
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
        updateDragPreview(instanceId, event, stageRect);
      },
      onCommit(instanceId, element, event) {
        element?.classList?.remove('is-dragging');
        hoverCursor?.setDragging(false);
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

        context.updateContextRingPosition?.();

        if (moves.length > 1) {
          context.store.dispatch({ type: 'scene/moveEntities', moves });
        } else if (moves.length === 1) {
          context.store.dispatch({ type: stateForPlacement(moves[0].instanceId).placement ? 'scene/placeEntity' : 'scene/moveEntity', transfer: true, target: previewTarget, instanceId: moves[0].instanceId, x: moves[0].x, y: moves[0].y });
        }
        previewTarget = null;
        clearGuide();
        delete stageEl.dataset.placementPreview;
      },
      onCancel(instanceId, element) {
        element?.classList?.remove('is-dragging');
        hoverCursor?.setDragging(false);
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
        previewTarget = null;
        clearGuide();
        delete stageEl.dataset.placementPreview;
        if (!disposing) void context.render();
      }
    });
  }

  function stateForPlacement(instanceId = context.activeDragInstanceId) {
    const scene = context.store.getState().currentScene;
    const entity = scene.entities.find(e => e.instanceId === instanceId);
    return { placement: usesPlacementDrag(scene, entity, context.getAsset) };
  }

  function updateDragPreview(instanceId, event, previewStageRect = null) {
    const stageEl = context.$('#play-stage');
    if (!stageEl || !event) return;
    const state = context.store.getState();
    const stageRect = previewStageRect || stageContentRect(stageEl);
    const currentCameraX = renderedCameraX(stageEl, state.currentScene.cameraX, stageRect);
    const pointerLogical = clientToLogical(event.clientX, event.clientY, stageRect, currentCameraX);
    const primaryOffset = grabOffsets.get(instanceId);
    if (!primaryOffset) return;

    const primaryRawX = pointerLogical.x + primaryOffset.dx;
    const primaryRawY = pointerLogical.y + primaryOffset.dy;
    if (grabOffsets.size === 1 && stateForPlacement(instanceId).placement) {
      const next = placeEntity(state.currentScene, instanceId, { x: primaryRawX, y: primaryRawY }, context.getAsset, { transfer: true, currentTarget: previewTarget, snapDistance: 16 * 1600 / stageRect.width, releaseDistance: 24 * 1600 / stageRect.width });
      const entity = next.entities.find(e => e.instanceId === instanceId);
      previewTarget = entity.placement?.kind === 'surface' ? { kind: 'surface', hostId: entity.attachedTo, surfaceId: entity.placement.surfaceId } : entity.placement?.regionId ? { kind: entity.placement.kind, regionId: entity.placement.regionId } : null;
      previewPoints.set(instanceId, { x: entity.x, y: entity.y });
      for (const [index, e] of orderedSceneEntities(next, context.getAsset).entries()) {
        const element = stageEl.querySelector(`.scene-entity-positioner[data-instance-id="${escapeCss(e.instanceId)}"]`);
        if (element) { element.style.setProperty('--x', String(e.x)); element.style.setProperty('--y', String(e.y)); element.style.zIndex = String(index + 1); }
      }
      showGuide(next, entity, stageEl);
      context.updateContextRingPosition?.(stageRect);
      return;
    }
    if (grabOffsets.size > 1 && (state.currentScene.placementMode === 'room' || state.currentScene.entities.some(e => grabOffsets.has(e.instanceId) && e.placement?.kind === 'surface'))) {
      const moves = [...grabOffsets].map(([id, offset]) => ({ instanceId: id, x: offset.startX + primaryRawX - primaryOffset.startX, y: offset.startY + primaryRawY - primaryOffset.startY }));
      const next = moveEntities(state.currentScene, moves, context.getAsset);
      for (const [index, entity] of orderedSceneEntities(next, context.getAsset).entries()) {
        if (grabOffsets.has(entity.instanceId)) previewPoints.set(entity.instanceId, { x: entity.x, y: entity.y });
        const element = stageEl.querySelector(`.scene-entity-positioner[data-instance-id="${escapeCss(entity.instanceId)}"]`);
        if (element) { element.style.setProperty('--x', String(entity.x)); element.style.setProperty('--y', String(entity.y)); element.style.zIndex = String(index + 1); }
      }
      context.updateContextRingPosition?.(stageRect);
      return;
    }
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
    context.updateContextRingPosition?.(stageRect);
  }

  return { cancelPointerController, initPointerController, updateDragPreview, stagePointAt, destroy };
}
