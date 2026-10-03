/** Selection context ring and keyboard/batch actions. */
import { escapeCss } from '../../core/css-escape.js';
import { CAMERA_CONSTANTS, DEFAULT_STAGE_WIDTH, VIEWPORT_WIDTH, bubbleStyleLabelKey } from '../../domain/vocabulary.js';
import { assetName, t } from '../../core/i18n.js';
import { getPlacementChoices, openPlacementActions } from './placement-controls.js';
import { logicalToClient, stageContentRect } from '../../core/coordinate-space.js';

const TOOLBAR_GAP = 12;
const WINDOW_MARGIN = 12;
const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

export function sceneControlDisabledReason(scene, selectedIds, action) {
  const movable = scene.entities.filter(e => selectedIds.includes(e.instanceId) && !e.pinned);
  if (['flip', 'smaller', 'larger'].includes(action) && !movable.length) return 'play.pinnedMoveBlocked';
  if (!action.startsWith('align') && !['distributeH', 'distributeV'].includes(action)) return null;
  if (movable.length < 2) return 'placement.alignmentUnavailable';
  if (['distributeH', 'distributeV'].includes(action) && movable.length < 3) return 'placement.distributionUnavailable';
  if (scene.placementMode === 'room' || movable.some(e => e.placement?.kind === 'surface')) {
    const supports = movable.map(e => JSON.stringify([e.placement?.kind, e.placement?.regionId, e.attachedTo, e.placement?.surfaceId]));
    if (new Set(supports).size > 1) return 'placement.alignmentUnavailable';
  }
  return null;
}

/** Stay centered on art until the window, rather than the stage, limits space. */
export function contextToolbarPosition(art, size, viewport, avoid = null) {
  const minX = viewport.left + WINDOW_MARGIN, maxX = viewport.left + viewport.width - WINDOW_MARGIN - size.width;
  const minY = viewport.top + WINDOW_MARGIN, maxY = viewport.top + viewport.height - WINDOW_MARGIN - size.height;
  const left = Math.max(minX, Math.min(maxX, (art.left + art.right - size.width) / 2));
  // Leave room for the selection arrow when placing actions above the art.
  const below = art.bottom + TOOLBAR_GAP, above = art.top - 32 - size.height;
  const obstacles = avoid ? (Array.isArray(avoid) ? avoid : [avoid]) : [];
  const collisions = obstacles.filter(rect => overlaps({ left, right: left + size.width, top: below, bottom: below + size.height }, rect));
  const collision = collisions.length > 0;
  const isAbove = (below > maxY || collision) && (above >= minY || art.top - viewport.top > viewport.top + viewport.height - art.bottom);
  const preferredTop = isAbove ? above : collision ? Math.max(below, ...collisions.map(rect => rect.bottom + TOOLBAR_GAP)) : below;
  return { left, top: Math.max(minY, Math.min(maxY, preferredTop)), isAbove: Boolean(isAbove) };
}

export function createSelectionHudController(context) {
  let ring = null;
  let anchors = [];
  let layout = null;
  let resizeObserver = null;
  let layoutFrame = null;

  function removeContextRing() {
    if (!ring) return;
    ring?.remove();
    ring = null;
    anchors = [];
    layout = null;
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (layoutFrame !== null) cancelAnimationFrame(layoutFrame);
    layoutFrame = null;
    globalThis.window?.removeEventListener('resize', scheduleLayout);
    globalThis.window?.removeEventListener('scroll', onScroll, true);
    globalThis.window?.visualViewport?.removeEventListener('resize', scheduleLayout);
    globalThis.window?.visualViewport?.removeEventListener('scroll', scheduleLayout);
  }

  function measureLayout() {
    layoutFrame = null;
    const stage = context.$('#play-stage');
    if (!ring || !stage) return;
    const rect = stageContentRect(stage);
    const obstacles = [stage.querySelector('.camera-hud:not([hidden])'), context.$('.play-stage-controls')]
      .filter(element => element && !element.hidden).map(element => element.getBoundingClientRect()).filter(box => box.width > 0);
    ring.style.maxWidth = `${Math.max(1, (window.visualViewport?.width || document.documentElement.clientWidth) - 2 * WINDOW_MARGIN)}px`;
    layout = { stage: rect, width: ring.offsetWidth || layout?.width, height: ring.offsetHeight || layout?.height,
      clip: stage.closest('main')?.getBoundingClientRect(),
      avoid: obstacles.map(box => ({ left: box.left - rect.left, top: box.top - rect.top, width: box.width, height: box.height })) };
    updateContextRingPosition();
  }

  function scheduleLayout() {
    if (ring && layoutFrame === null) layoutFrame = requestAnimationFrame(measureLayout);
  }

  function onScroll(event) {
    if (!ring?.contains(event.target)) scheduleLayout();
  }

  // Drag previews already know the stage rectangle. All other layout reads are
  // confined to selection/layout changes; pointer movement reuses this cache.
  function updateContextRingPosition(stageRect = layout?.stage, cameraTransition = false) {
    if (!ring || !layout || !stageRect) return;
    const state = context.store.getState();
    const vv = globalThis.window?.visualViewport;
    const viewport = { left: vv?.offsetLeft || 0, top: vv?.offsetTop || 0,
      width: vv?.width || document.documentElement.clientWidth, height: vv?.height || window.innerHeight };
    const stageBox = { left: stageRect.left, top: stageRect.top, right: stageRect.left + stageRect.width, bottom: stageRect.top + stageRect.height };
    const visibleWindow = { left: viewport.left, top: viewport.top, right: viewport.left + viewport.width, bottom: viewport.top + viewport.height };
    const visible = anchors.map(element => context.hitTester.artworkBounds(element)).filter(Boolean).map(bounds => {
      const topLeft = logicalToClient(bounds.left, bounds.top, stageRect, state.currentScene.cameraX);
      const bottomRight = logicalToClient(bounds.right, bounds.bottom, stageRect, state.currentScene.cameraX);
      return { left: topLeft.x, top: topLeft.y, right: bottomRight.x, bottom: bottomRight.y };
    }).filter(bounds => overlaps(bounds, stageBox) && overlaps(bounds, visibleWindow) && (!layout.clip || overlaps(bounds, layout.clip)));
    ring.hidden = state.ui.mode !== 'play' || !visible.length;
    if (ring.hidden) return;
    const art = { left: Math.min(...visible.map(b => b.left)), right: Math.max(...visible.map(b => b.right)),
      top: Math.min(...visible.map(b => b.top)), bottom: Math.max(...visible.map(b => b.bottom)) };
    const avoid = layout.avoid.map(box => ({ left: stageRect.left + box.left, top: stageRect.top + box.top,
      right: stageRect.left + box.left + box.width, bottom: stageRect.top + box.top + box.height }));
    const position = contextToolbarPosition(art, layout, viewport, avoid);
    ring.classList.toggle('is-above', position.isAbove);
    ring.classList.toggle('is-dragging', Boolean(context.activeDragInstanceId));
    ring.classList.toggle('is-camera-panning', cameraTransition && !context.activeDragInstanceId);
    ring.style.left = `${position.left}px`;
    ring.style.top = `${position.top}px`;
  }
  function openEditBubbleDialog(entity) {
    const dialog = context.$('#bubble-text-dialog');
    const input = context.$('#bubble-text-input');
    const count = context.$('#bubble-char-count');
    if (!dialog || !input) return;
    input.value = entity?.text || '';
    if (count) count.textContent = `${input.value.length}/120`;
    dialog.showModal();
    input.focus();
    input.select();
  }

  function renderContextRing(state = context.store.getState()) {
    const focusedElement = document.activeElement;
    const focusedAction = context.getContextRingFocusAction(focusedElement);
    const scrollLeft = ring?.scrollLeft || 0;
    removeContextRing();
    if (state.ui.mode !== 'play') return;

    const selectedIds = state.ui.selectedEntityIds || (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : []);
    if (selectedIds.length === 0) return;

    const isMulti = selectedIds.length > 1;
    let label;
    let selected = null;

    if (isMulti) {
      label = t('play.itemCount', { count: selectedIds.length });
      const selectedEntities = state.currentScene.entities.filter((e) => selectedIds.includes(e.instanceId));
      if (selectedEntities.length === 0) return;
    } else {
      selected = state.currentScene.entities.find((entity) => entity.instanceId === selectedIds[0]);
      if (!selected) return;
      const asset = context.getAsset(selected.sourceId);
      const preset = selected.kind === 'character' ? state.presets.find((item) => item.presetId === selected.sourceId) : null;
      label = selected.kind === 'bubble'
        ? t(bubbleStyleLabelKey(selected.bubbleStyle))
        : (selected.sourceId === 'demo_emma' ? 'Emma' : preset?.name ?? assetName(asset, t('play.sceneProp')));
    }

    ring = document.createElement('div');
    const nextRing = ring;
    ring.className = `context-ring${isMulti ? ' is-multi' : ''}`;
    ring.setAttribute('role', 'toolbar');
    ring.setAttribute('aria-label', t('play.contextRingAria'));

    const pill = document.createElement('div');
    pill.className = 'selection-pill';
    const dot = document.createElement('span');
    dot.className = 'selection-dot';
    dot.setAttribute('aria-hidden', 'true');
    const labelSpan = document.createElement('span');
    labelSpan.className = 'selected-label';
    const supportLabel = selected?.placement ? t(`placement.${selected.placement.kind === 'surface' ? 'onSurface' : selected.placement.kind === 'floor' ? 'onFloor' : selected.placement.kind === 'wall' ? 'onWall' : 'free'}`) : '';
    labelSpan.textContent = supportLabel ? `${label} · ${supportLabel}` : label;
    pill.append(dot, labelSpan);
    ring.append(pill);

    let controls;
    if (isMulti) {
      const allSelectedPinned = state.currentScene.entities.filter((e) => selectedIds.includes(e.instanceId)).every((e) => e.pinned);
      controls = [
        ['alignLeft', '⇤', t('play.alignLeft')],
        ['alignCenter', '⇥⇤', t('play.alignCenter')],
        ['alignRight', '⇥', t('play.alignRight')],
        ['alignTop', '⤒', t('play.alignTop')],
        ['alignMiddle', '↕', t('play.alignMiddle')],
        ['alignBottom', '⤓', t('play.alignBottom')],
        ['distributeH', '⋯', t('play.distributeH')],
        ['distributeV', '⋮', t('play.distributeV')],
        ['flip', '↔', t('play.flip')],
        ['smaller', '−', t('play.smaller')],
        ['larger', '+', t('play.larger')],
        ['togglePin', allSelectedPinned ? '📌' : '📍', allSelectedPinned ? t('play.unpin') : t('play.pin')],
        ['delete', '', t('play.deleteItem')]
      ];
    } else {
      controls = [
        ...(selected.kind === 'bubble' ? [['editBubble', '✏️', t('play.editBubble')]] : []),
        ...(getPlacementChoices(state.currentScene, selected, context.getAsset).length ? [['placeOn', '⊞', t('placement.placeOn')]] : []),
        ['flip', '↔', t('play.flip')],
        ['smaller', '−', t('play.smaller')],
        ['larger', '+', t('play.larger')],
        ['back', '↓', t('play.sendBackward')],
        ['front', '↑', t('play.bringForward')],
        ['togglePin', selected.pinned ? '📌' : '📍', selected.pinned ? t('play.unpin') : t('play.pin')],
        ...(selected.attachedTo ? [['detach', '⛓️', t('play.detach')]] : []),
        ['duplicate', '⧉', t('play.duplicate')],
        ...(context.store.getState().currentScene.entities.some(e => e.attachedTo === selected.instanceId && e.placement?.kind === 'surface') ? [['duplicateWithContents','⧉+',t('placement.duplicateWithContents')]] : []),
        ['delete', '', t('play.deleteItem')]
      ];
    }

    ring.append(...controls.map(([action, symbol, labelText]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.action = action;
      button.textContent = symbol;
      button.title = labelText;
      const disabledReason = sceneControlDisabledReason(state.currentScene, selectedIds, action);
      if (disabledReason) { button.disabled = true; button.title = t(disabledReason); }
      button.setAttribute('aria-label', labelText);
      if (action === 'delete') {
        button.className = 'danger';
        button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';
      }
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        void handleEntityAction(action);
      });
      return button;
    }));

    // A body-level fixed overlay can cross the stage and its clipped ancestors.
    // The scene itself keeps its existing panorama/artwork clipping behavior.
    document.body.append(ring);
    ring.addEventListener('keydown', handleStageKeydown);
    ring.scrollLeft = scrollLeft;
    const entities = new Map([...context.$('#scene-entities').children].map(element => [element.dataset.instanceId, element]));
    anchors = selectedIds.map(id => entities.get(id)).filter(Boolean);
    measureLayout();
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(scheduleLayout);
      resizeObserver.observe(context.$('#play-stage'));
      resizeObserver.observe(ring);
    }
    window.addEventListener('resize', scheduleLayout);
    window.addEventListener('scroll', onScroll, true);
    window.visualViewport?.addEventListener('resize', scheduleLayout);
    window.visualViewport?.addEventListener('scroll', scheduleLayout);
    if (focusedAction && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        if (document.activeElement !== focusedElement
          && !(document.activeElement === document.body && !focusedElement.isConnected)) return;
        if (nextRing.isConnected) /** @type {HTMLButtonElement} */ (nextRing.querySelector(`button[data-action="${escapeCss(focusedAction)}"]`))?.focus?.({ preventScroll: true });
      });
    }
  }

  async function handleEntityAction(action) {
    const state = context.store.getState();
    const selectedIds = state.ui.selectedEntityIds || (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : []);
    const id = state.ui.selectedEntityId;
    const entity = state.currentScene.entities.find((item) => item.instanceId === id);
    if (!action || selectedIds.length === 0) return;
    const disabledReason = sceneControlDisabledReason(state.currentScene, selectedIds, action);
    if (disabledReason) {
      context.store.dispatch({ type: 'ui/message', message: t(disabledReason) });
      return;
    }

    if (action.startsWith('align') || action === 'distributeH' || action === 'distributeV') {
      const modeMap = {
        alignLeft: 'left',
        alignCenter: 'center',
        alignRight: 'right',
        alignTop: 'top',
        alignMiddle: 'middle',
        alignBottom: 'bottom',
        distributeH: 'distribute-h',
        distributeV: 'distribute-v'
      };
      const alignment = modeMap[action];
      if (alignment) {
        context.store.dispatch({ type: 'scene/alignEntities', alignment, instanceIds: selectedIds });
      }
      return;
    }

    if (action === 'editBubbleText' || action === 'editBubble') {
      if (entity && entity.kind === 'bubble') openEditBubbleDialog(entity);
      return;
    }

    if (selectedIds.length > 1) {
      if (action === 'flip') context.store.dispatch({ type: 'scene/flipEntities', instanceIds: selectedIds });
      else if (action === 'smaller') context.store.dispatch({ type: 'scene/scaleEntities', instanceIds: selectedIds, delta: -0.1 });
      else if (action === 'larger') context.store.dispatch({ type: 'scene/scaleEntities', instanceIds: selectedIds, delta: 0.1 });
      else if (action === 'togglePin') context.store.dispatch({ type: 'scene/togglePinEntities', instanceIds: selectedIds });
      else if (action === 'delete' && await context.askConfirm(t('play.deleteMultipleTitle', { count: selectedIds.length }), t('play.deleteMultipleMessage'))) {
        context.store.dispatch({ type: 'scene/deleteEntities', instanceIds: selectedIds });
        context.$('#play-stage')?.focus();
      }
      return;
    }

    if (!entity) return;
    if (action === 'placeOn') openPlacementActions(context, id);
    else if (action === 'flip') context.store.dispatch({ type: 'scene/flipEntity', instanceId: id });
    else if (action === 'smaller') context.store.dispatch({ type: 'scene/scaleEntity', instanceId: id, scale: entity.scale - .1 });
    else if (action === 'larger') context.store.dispatch({ type: 'scene/scaleEntity', instanceId: id, scale: entity.scale + .1 });
    else if (action === 'back') context.store.dispatch({ type: 'scene/reorderEntity', instanceId: id, direction: -1 });
    else if (action === 'front') context.store.dispatch({ type: 'scene/reorderEntity', instanceId: id, direction: 1 });
    else if (action === 'duplicate' || action === 'duplicateWithContents') context.store.dispatch({ type: 'scene/duplicateEntity', instanceId: id, withContents: action === 'duplicateWithContents' });
    else if (action === 'togglePin') context.store.dispatch({ type: 'scene/togglePin', instanceId: id });
    else if (action === 'detach') context.store.dispatch({ type: 'scene/detachEntity', instanceId: id });
    else if (action === 'delete' && await context.askConfirm(t('play.deleteOneTitle'), t('play.deleteOneMessage'))) {
      context.store.dispatch({ type: 'scene/deleteEntity', instanceId: id });
      context.$('#play-stage')?.focus();
    }
  }

  function handleStageKeydown(event) {
    if (event.target?.closest?.('.context-ring') && (event.key === 'Enter' || event.key === ' ')) return;
    const isSlider = Boolean(event.target?.matches?.('#camera-slider'));
    if (!isSlider && event.target?.matches?.('input, select, textarea, [contenteditable]')) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const state = context.store.getState();
    const stageWidth = state.currentScene.stageWidth || DEFAULT_STAGE_WIDTH;
    const selectedIds = state.ui.selectedEntityIds || (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : []);
    const id = state.ui.selectedEntityId;
    const entity = state.currentScene.entities.find((item) => item.instanceId === id);

    if (event.key === 'PageUp') {
      event.preventDefault();
      context.store.dispatch({ type: 'scene/panCamera', deltaX: -CAMERA_CONSTANTS.STEP });
      return;
    }
    if (event.key === 'PageDown') {
      event.preventDefault();
      context.store.dispatch({ type: 'scene/panCamera', deltaX: CAMERA_CONSTANTS.STEP });
      return;
    }
    if (event.key === 'Home' && (!isSlider || event.shiftKey)) {
      event.preventDefault();
      context.store.dispatch({ type: 'scene/setCameraX', cameraX: 0 });
      return;
    }
    if (event.key === 'End' && (!isSlider || event.shiftKey)) {
      event.preventDefault();
      context.store.dispatch({ type: 'scene/setCameraX', cameraX: stageWidth - VIEWPORT_WIDTH });
      return;
    }
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && event.shiftKey && (selectedIds.length === 0 || isSlider || event.currentTarget?.id === 'camera-hud')) {
      event.preventDefault();
      const delta = event.key === 'ArrowLeft' ? -CAMERA_CONSTANTS.STEP : CAMERA_CONSTANTS.STEP;
      context.store.dispatch({ type: 'scene/panCamera', deltaX: delta });
      return;
    }

    if (isSlider || event.currentTarget?.id === 'camera-hud') return;

    if (event.key.toLowerCase() === 'o') {
      event.preventDefault();
      context.openSceneOutlineDialog?.();
      return;
    }

    if (event.key.toLowerCase() === 'm') {
      event.preventDefault();
      context.openWorldMapDialog?.();
      return;
    }

    if (event.key === 'Escape' && selectedIds.length > 0) {
      event.preventDefault();
      context.store.dispatch({ type: 'ui/clearSelection' });
      return;
    }

    if (selectedIds.length === 0) return;

    const focusedEntityId = event.target?.closest?.('.scene-entity-positioner')?.dataset.instanceId;
    const editsSelectedBubble = event.key.toLowerCase() === 'e'
      || (event.key === 'Enter' && (!focusedEntityId || focusedEntityId === id));
    if (selectedIds.length === 1 && entity && editsSelectedBubble && entity.kind === 'bubble') {
      event.preventDefault();
      openEditBubbleDialog(entity);
      return;
    }

    const step = event.shiftKey ? 1 : 10;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[event.key]) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      if (selectedIds.length > 1) {
        const batchMoves = state.currentScene.entities
          .filter((e) => selectedIds.includes(e.instanceId) && !e.pinned)
          .map((e) => ({ instanceId: e.instanceId, x: e.x + dx, y: e.y + dy }));
        if (batchMoves.length > 0) context.store.dispatch({ type: 'scene/moveEntities', moves: batchMoves });
        else context.store.dispatch({ type: 'ui/message', message: t('play.pinnedMoveBlocked') });
      } else if (entity) {
        if (entity.pinned) context.store.dispatch({ type: 'ui/message', message: t('play.pinnedMoveBlocked') });
        else context.store.dispatch({ type: 'scene/moveEntity', instanceId: id, x: entity.x + dx, y: entity.y + dy });
      }
    } else if (event.key === '[') {
      if (id) context.store.dispatch({ type: 'scene/reorderEntity', instanceId: id, direction: -1 });
    } else if (event.key === ']') {
      if (id) context.store.dispatch({ type: 'scene/reorderEntity', instanceId: id, direction: 1 });
    } else if (event.key === '-' || event.key === '_') {
      void handleEntityAction('smaller');
    } else if (event.key === '+' || event.key === '=') {
      void handleEntityAction('larger');
    } else if (event.key.toLowerCase() === 'd') {
      if (selectedIds.length === 1 && id) context.store.dispatch({ type: 'scene/duplicateEntity', instanceId: id });
    } else if (event.key.toLowerCase() === 'p') {
      void handleEntityAction('togglePin');
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      void handleEntityAction('delete');
    }
  }

  return { renderContextRing, updateContextRingPosition, removeContextRing, handleEntityAction, handleStageKeydown, openEditBubbleDialog };
}
