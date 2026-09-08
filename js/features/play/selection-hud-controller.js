/** Selection context ring and keyboard/batch actions. */
import { getEntityBounds } from '../../domain/scene-rules.js';
import { escapeCss } from '../../core/css-escape.js';
import { CAMERA_CONSTANTS, DEFAULT_STAGE_WIDTH, VIEWPORT_WIDTH, bubbleStyleLabelKey } from '../../domain/vocabulary.js';
import { assetName, t } from '../../core/i18n.js';

export function createSelectionHudController(context) {
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
    const focusedAction = context.getContextRingFocusAction(document.activeElement);
    context.$('#scene-entities .context-ring')?.remove();
    if (state.ui.mode !== 'play') return;

    const selectedIds = state.ui.selectedEntityIds || (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : []);
    if (selectedIds.length === 0) return;

    const isMulti = selectedIds.length > 1;
    let label = t('play.noItemSelected');
    let ringX = 0;
    let ringY = 0;
    let placeBelow = true;
    let selected = null;

    if (isMulti) {
      label = t('play.itemCount', { count: selectedIds.length });
      const selectedEntities = state.currentScene.entities.filter((e) => selectedIds.includes(e.instanceId));
      if (selectedEntities.length === 0) return;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const ent of selectedEntities) {
        const bounds = getEntityBounds(ent, context.getAsset);
        const top = ent.y - bounds.height * (bounds.anchorY ?? 1.0);
        const bottom = ent.y + bounds.height * (1.0 - (bounds.anchorY ?? 1.0));
        minX = Math.min(minX, ent.x);
        maxX = Math.max(maxX, ent.x);
        minY = Math.min(minY, top);
        maxY = Math.max(maxY, bottom);
      }
      ringX = (minX + maxX) / 2;
      if (maxY > context.CONTEXT_RING_FLIP_THRESHOLD_Y) {
        placeBelow = false;
        ringY = Math.max(context.CONTEXT_RING_MIN_Y, minY - context.CONTEXT_RING_GAP_ABOVE);
      } else {
        placeBelow = true;
        ringY = Math.min(context.CONTEXT_RING_MAX_Y, maxY + context.CONTEXT_RING_GAP_BELOW);
      }
    } else {
      selected = state.currentScene.entities.find((entity) => entity.instanceId === selectedIds[0]);
      if (!selected) return;
      const asset = context.getAsset(selected.sourceId);
      const preset = selected.kind === 'character' ? state.presets.find((item) => item.presetId === selected.sourceId) : null;
      label = selected.kind === 'bubble'
        ? t(bubbleStyleLabelKey(selected.bubbleStyle))
        : (selected.sourceId === 'demo_emma' ? 'Emma' : preset?.name ?? assetName(asset, t('play.sceneProp')));
      ringX = selected.x;
      const bounds = getEntityBounds(selected, context.getAsset);
      const top = selected.y - bounds.height * (bounds.anchorY ?? 1.0);
      const bottom = selected.y + bounds.height * (1.0 - (bounds.anchorY ?? 1.0));
      if (bottom > context.CONTEXT_RING_FLIP_THRESHOLD_Y || selected.y > context.CONTEXT_RING_FLIP_THRESHOLD_Y) {
        placeBelow = false;
        ringY = Math.max(context.CONTEXT_RING_MIN_Y, top - context.CONTEXT_RING_GAP_ABOVE);
      } else {
        placeBelow = true;
        ringY = Math.min(context.CONTEXT_RING_MAX_Y, bottom + context.CONTEXT_RING_GAP_BELOW);
      }
    }

    const stageWidth = state.currentScene.stageWidth || DEFAULT_STAGE_WIDTH;
    ringX = Math.max(50, Math.min(stageWidth - 50, ringX));
    const horizontalClass = ringX < 250 ? ' align-left' : ringX > stageWidth - 250 ? ' align-right' : '';
    const ring = document.createElement('div');
    ring.className = `context-ring${placeBelow ? ' is-below' : ''}${horizontalClass}${isMulti ? ' is-multi' : ''}`;
    ring.style.setProperty('--ring-x', String(ringX));
    ring.style.setProperty('--ring-y', String(ringY));
    ring.setAttribute('role', 'toolbar');
    ring.setAttribute('aria-label', t('play.contextRingAria'));

    const pill = document.createElement('div');
    pill.className = 'selection-pill';
    const dot = document.createElement('span');
    dot.className = 'selection-dot';
    dot.setAttribute('aria-hidden', 'true');
    const labelSpan = document.createElement('span');
    labelSpan.className = 'selected-label';
    labelSpan.textContent = label;
    pill.append(dot, labelSpan);
    ring.append(pill);

    const deselectBtn = document.createElement('button');
    deselectBtn.type = 'button';
    deselectBtn.className = 'deselect-btn';
    deselectBtn.dataset.action = 'deselect';
    deselectBtn.textContent = '✕';
    deselectBtn.title = t('play.deselectItem');
    deselectBtn.setAttribute('aria-label', t('play.deselectItem'));
    deselectBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      void handleEntityAction('deselect');
    });
    ring.append(deselectBtn);

    let controls = [];
    if (isMulti) {
      const allSelectedPinned = state.currentScene.entities.filter((e) => selectedIds.includes(e.instanceId)).every((e) => e.pinned);
      controls = [
        ['alignLeft', '⇤', t('play.alignLeft')],
        ['alignCenter', '⇥⇤', t('play.alignCenter')],
        ['alignRight', '⇥', t('play.alignRight')],
        ['alignTop', '⤒', t('play.alignTop')],
        ['alignMiddle', '⤓', t('play.alignMiddle')],
        ['alignBottom', '⤓', t('play.alignBottom')],
        ['distributeH', '⋯', t('play.distributeH')],
        ['distributeV', '⋮', t('play.distributeV')],
        ['flip', '↔', t('play.flip')],
        ['smaller', '−', t('play.smaller')],
        ['larger', '+', t('play.larger')],
        ['togglePin', allSelectedPinned ? '📌' : '📍', allSelectedPinned ? t('play.unpin') : t('play.pin')],
        ['delete', '×', t('play.deleteItem')]
      ];
    } else {
      controls = [
        ...(selected.kind === 'bubble' ? [['editBubble', '✏️', t('play.editBubble')]] : []),
        ['flip', '↔', t('play.flip')],
        ['smaller', '−', t('play.smaller')],
        ['larger', '+', t('play.larger')],
        ['back', '↓', t('play.sendBackward')],
        ['front', '↑', t('play.bringForward')],
        ['togglePin', selected.pinned ? '📌' : '📍', selected.pinned ? t('play.unpin') : t('play.pin')],
        ...(selected.attachedTo ? [['detach', '⛓️', t('play.detach')]] : []),
        ['duplicate', '⧉', t('play.duplicate')],
        ['delete', '×', t('play.deleteItem')]
      ];
    }

    ring.append(...controls.map(([action, symbol, labelText]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.action = action;
      button.textContent = symbol;
      button.title = labelText;
      button.setAttribute('aria-label', labelText);
      if (action === 'delete') button.className = 'danger';
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        void handleEntityAction(action);
      });
      return button;
    }));

    context.$('#scene-entities')?.append(ring);
    if (focusedAction && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        /** @type {HTMLButtonElement} */ (ring.querySelector(`button[data-action="${escapeCss(focusedAction)}"]`))?.focus?.({ preventScroll: true });
      });
    }
  }

  async function handleEntityAction(action) {
    const state = context.store.getState();
    const selectedIds = state.ui.selectedEntityIds || (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : []);
    const id = state.ui.selectedEntityId;
    const entity = state.currentScene.entities.find((item) => item.instanceId === id);
    if (!action || selectedIds.length === 0) return;

    if (action === 'deselect') {
      context.store.dispatch({ type: 'ui/clearSelection' });
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
    if (action === 'flip') context.store.dispatch({ type: 'scene/flipEntity', instanceId: id });
    else if (action === 'smaller') context.store.dispatch({ type: 'scene/scaleEntity', instanceId: id, scale: entity.scale - .1 });
    else if (action === 'larger') context.store.dispatch({ type: 'scene/scaleEntity', instanceId: id, scale: entity.scale + .1 });
    else if (action === 'back') context.store.dispatch({ type: 'scene/reorderEntity', instanceId: id, direction: -1 });
    else if (action === 'front') context.store.dispatch({ type: 'scene/reorderEntity', instanceId: id, direction: 1 });
    else if (action === 'duplicate') context.store.dispatch({ type: 'scene/duplicateEntity', instanceId: id });
    else if (action === 'togglePin') context.store.dispatch({ type: 'scene/togglePin', instanceId: id });
    else if (action === 'detach') context.store.dispatch({ type: 'scene/detachEntity', instanceId: id });
    else if (action === 'delete' && await context.askConfirm(t('play.deleteOneTitle'), t('play.deleteOneMessage'))) {
      context.store.dispatch({ type: 'scene/deleteEntity', instanceId: id });
      context.$('#play-stage')?.focus();
    }
  }

  function handleStageKeydown(event) {
    const isSlider = Boolean(event.target?.matches?.('#camera-slider'));
    if (!isSlider && event.target.matches('input, select, textarea, [contenteditable]')) return;
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

    if (selectedIds.length === 1 && entity && (event.key === 'Enter' || event.key.toLowerCase() === 'e') && entity.kind === 'bubble') {
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

  return { renderContextRing, handleEntityAction, handleStageKeydown, openEditBubbleDialog };
}
