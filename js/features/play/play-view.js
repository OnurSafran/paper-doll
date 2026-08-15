/**
 * Play View Feature Module
 * Owns sandbox stage, entity composition, visual spawner tray, multi-selection,
 * batch transforms, alignment, and quick controls.
 */

import { assetsByKind, getAsset } from '../../core/asset-catalog.js';
import { clientToLogical } from '../../core/coordinate-space.js';
import { clampCompoundEntityPoint, getAttachedDescendants, getEntityBounds } from '../../domain/scene-rules.js';
import { PointerController } from '../../core/pointer-controller.js?v=2';
import { CHARACTER_DIMENSIONS, DEFAULT_EXPRESSION } from '../../domain/vocabulary.js';
import { appendAsset, renderAssetPreview } from '../designer/designer-view.js';
import { createBubbleSvg } from '../../services/export-service.js';

const escapeCss = (val) => globalThis.CSS?.escape ? CSS.escape(String(val)) : String(val).replace(/["\\]/g, '\\$&');

export function nextSpawnPoint(index) {
  return { x: 650 + (index % 5) * 80, y: 690 + (index % 3) * 45 };
}

export function findSceneSkinSvg(instanceId) {
  const entity = [...document.querySelectorAll('.scene-entity-positioner')]
    .find((element) => element.dataset.instanceId === instanceId);
  return entity?.querySelector('[data-slot="skin"] svg')
    || entity?.querySelector('svg[data-asset-id="doll_classic_a"]');
}

export function createPlayView({
  store,
  $,
  $$,
  renderDollInto,
  askConfirm,
  openSceneOutlineDialog
}) {
  let playRenderToken = 0;
  let spawnTab = 'characters';
  let pointerController = null;
  const previewPoints = new Map();
  const grabOffsets = new Map();

  function cancelPointerController() {
    const cancel = pointerController?.cancel;
    if (typeof cancel === 'function') cancel.call(pointerController);
  }

  function initPointerController() {
    const stageEl = $('#play-stage');
    if (!stageEl) return;
    pointerController = new PointerController(stageEl, {
      selector: '.scene-entity-positioner',
      getId: (element) => element.dataset.instanceId,
      onSelect(instanceId, element, event) {
        if (event?.shiftKey) {
          store.dispatch({ type: 'ui/toggleEntitySelection', instanceId });
        } else {
          store.dispatch({ type: 'ui/selectEntity', instanceId });
        }
      },
      onDeselect(event) {
        const uiState = store.getState().ui;
        const hasSelection = Boolean(uiState.selectedEntityId || uiState.selectedEntityIds?.length);
        if (!event?.shiftKey && hasSelection) {
          store.dispatch({ type: 'ui/clearSelection' });
        }
      },
      onStart(instanceId, element, event) {
        const state = store.getState();
        const selectedIds = (state.ui.selectedEntityIds?.length > 1 && state.ui.selectedEntityIds.includes(instanceId))
          ? state.ui.selectedEntityIds
          : [instanceId];

        const entitiesToDrag = state.currentScene.entities.filter((e) => selectedIds.includes(e.instanceId) && !e.pinned);
        if (entitiesToDrag.length === 0) return;

        playRenderToken += 1;
        previewPoints.clear();
        grabOffsets.clear();
        $('#scene-entities .context-ring')?.remove();

        if (event) {
          const stageRect = stageEl.getBoundingClientRect();
          const pointerLogical = clientToLogical(event.clientX, event.clientY, stageRect);

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
        const state = store.getState();
        const stageRect = stageEl.getBoundingClientRect();
        const pointerLogical = clientToLogical(event.clientX, event.clientY, stageRect);

        const primaryOffset = grabOffsets.get(instanceId);
        if (!primaryOffset) return;

        const primaryRawX = pointerLogical.x + primaryOffset.dx;
        const primaryRawY = pointerLogical.y + primaryOffset.dy;
        const primaryClamped = clampCompoundEntityPoint(primaryRawX, primaryRawY, state.currentScene, instanceId, getAsset);

        const deltaX = primaryClamped.x - primaryOffset.startX;
        const deltaY = primaryClamped.y - primaryOffset.startY;

        for (const [id, offset] of grabOffsets) {
          const ent = state.currentScene.entities.find((e) => e.instanceId === id);
          if (!ent) continue;
          const targetX = offset.startX + deltaX;
          const targetY = offset.startY + deltaY;
          const clamped = clampCompoundEntityPoint(targetX, targetY, state.currentScene, id, getAsset);
          previewPoints.set(id, clamped);
          const el = stageEl.querySelector(`.scene-entity-positioner[data-instance-id="${escapeCss(id)}"]`);
          if (el) {
            el.style.setProperty('--x', `${clamped.x / 16}%`);
            el.style.setProperty('--y', `${clamped.y / 9}%`);
          }

          const descendants = getAttachedDescendants(state.currentScene, id);
          const childDeltaX = clamped.x - ent.x;
          const childDeltaY = clamped.y - ent.y;
          for (const d of descendants) {
            const childEl = stageEl.querySelector(`.scene-entity-positioner[data-instance-id="${escapeCss(d.instanceId)}"]`);
            if (childEl) {
              childEl.style.setProperty('--x', `${(d.x + childDeltaX) / 16}%`);
              childEl.style.setProperty('--y', `${(d.y + childDeltaY) / 9}%`);
            }
          }
        }
      },
      onCommit(instanceId, element, event) {
        element?.classList?.remove('is-dragging');
        for (const [id] of grabOffsets) {
          const el = stageEl.querySelector(`.scene-entity-positioner[data-instance-id="${escapeCss(id)}"]`);
          if (el) el.classList.remove('is-dragging');
          const descendants = getAttachedDescendants(store.getState().currentScene, id);
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

        if (moves.length > 1) {
          store.dispatch({ type: 'scene/moveEntities', moves });
        } else if (moves.length === 1) {
          store.dispatch({ type: 'scene/moveEntity', instanceId: moves[0].instanceId, x: moves[0].x, y: moves[0].y });
        }
      },
      onCancel(instanceId, element) {
        element?.classList?.remove('is-dragging');
        for (const [id] of grabOffsets) {
          const el = stageEl.querySelector(`.scene-entity-positioner[data-instance-id="${escapeCss(id)}"]`);
          if (el) el.classList.remove('is-dragging');
          const descendants = getAttachedDescendants(store.getState().currentScene, id);
          for (const d of descendants) {
            const childEl = stageEl.querySelector(`.scene-entity-positioner[data-instance-id="${escapeCss(d.instanceId)}"]`);
            if (childEl) childEl.classList.remove('is-dragging');
          }
        }
        grabOffsets.clear();
        previewPoints.clear();
        void render();
      }
    });
  }

  function renderBackgroundSelect(state) {
    const select = $('#background-select');
    select.replaceChildren(...assetsByKind('background').map((asset) =>
      new Option(asset.name, asset.id, false, asset.id === state.currentScene.backgroundId)
    ));
  }

  const BUBBLE_PRESETS = [
    { style: 'speech', name: 'Speech Bubble', defaultText: 'Hello!', desc: '💬 Talk bubble' },
    { style: 'thought', name: 'Thought Cloud', defaultText: 'Thinking...', desc: '💭 Thought cloud' },
    { style: 'shout', name: 'Shout Balloon', defaultText: 'Look here!', desc: '💥 Shout burst' },
    { style: 'caption', name: 'Story Caption', defaultText: 'Once upon a time...', desc: '📜 Story caption' }
  ];

  function openEditBubbleDialog(entity) {
    const dialog = $('#bubble-text-dialog');
    const input = $('#bubble-text-input');
    const count = $('#bubble-char-count');
    if (!dialog || !input) return;
    input.value = entity?.text || '';
    if (count) count.textContent = `${input.value.length}/120`;
    dialog.showModal();
    input.focus();
    input.select();
  }

  function renderSpawnTray(state, token) {
    const tabs = $('#spawn-tabs');
    const focusedTabId = document.activeElement?.closest?.('#spawn-tabs [role="tab"]')?.id;
    tabs.replaceChildren(...[['characters', 'Characters'], ['props', 'Props'], ['bubbles', 'Bubbles']].map(([id, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.role = 'tab';
      button.id = `spawn-tab-${id}`;
      button.setAttribute('aria-controls', 'spawn-items');
      button.setAttribute('aria-selected', String(spawnTab === id));
      button.tabIndex = spawnTab === id ? 0 : -1;
      button.textContent = label;
      button.addEventListener('click', () => { spawnTab = id; void render(); });
      return button;
    }));
    if (focusedTabId) requestAnimationFrame(() => {
      if (token === playRenderToken) $(`#${focusedTabId}`)?.focus();
    });

    const list = $('#spawn-items');
    list.setAttribute('aria-labelledby', `spawn-tab-${spawnTab}`);
    if (spawnTab === 'characters' && !state.presets.length) {
      const empty = document.createElement('div');
      empty.className = 'tray-empty';
      empty.innerHTML = '<p>Create and save a doll first. Props and bubbles are ready now.</p><a class="button secondary" href="#designer">Go to Designer</a>';
      list.replaceChildren(empty);
      return;
    }

    if (spawnTab === 'bubbles') {
      list.replaceChildren(...BUBBLE_PRESETS.map((preset) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'spawn-item spawn-bubble-card';
        card.draggable = true;
        card.setAttribute('aria-label', `Add ${preset.name} to scene`);
        const thumb = document.createElement('span');
        thumb.className = 'spawn-thumb spawn-bubble-thumb';
        thumb.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.className = 'spawn-name';
        label.textContent = preset.name;
        const kindLabel = document.createElement('span');
        kindLabel.className = 'spawn-kind';
        kindLabel.textContent = preset.desc;
        card.append(thumb, kindLabel, label);

        card.addEventListener('click', () => {
          store.dispatch({
            type: 'scene/spawnBubble',
            bubbleStyle: preset.style,
            text: preset.defaultText,
            ...nextSpawnPoint(state.currentScene.entities.length)
          });
        });

        card.addEventListener('dragstart', (event) => {
          event.dataTransfer.effectAllowed = 'copy';
          event.dataTransfer.setData('text/plain', `paper-doll-spawn:bubble:${preset.style}:${encodeURIComponent(preset.defaultText)}`);
          card.classList.add('is-dragging');
        });
        card.addEventListener('dragend', () => card.classList.remove('is-dragging'));

        const bubbleThumbSvg = createBubbleSvg({
          width: 140,
          text: preset.defaultText,
          bubbleStyle: preset.style
        });
        thumb.replaceChildren(bubbleThumbSvg);
        return card;
      }));
      return;
    }

    const sources = spawnTab === 'characters' ? state.presets : assetsByKind('prop');
    list.replaceChildren(...sources.map((source) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'spawn-item';
      card.draggable = true;
      card.setAttribute('aria-label', `Spawn ${source.name} in scene (or drag to place)`);
      const thumb = document.createElement('span');
      thumb.className = 'spawn-thumb';
      thumb.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.className = 'spawn-name';
      label.textContent = source.name;
      const kindLabel = document.createElement('span');
      kindLabel.className = 'spawn-kind';
      kindLabel.textContent = spawnTab === 'characters' ? 'Saved doll' : 'Scene prop';
      card.append(thumb, kindLabel, label);
      const kind = spawnTab === 'characters' ? 'character' : 'prop';
      const sourceId = kind === 'character' ? source.presetId : source.id;

      card.addEventListener('click', () => {
        if (spawnTab === 'characters') {
          store.dispatch({ type: 'scene/spawnCharacter', presetId: source.presetId, ...nextSpawnPoint(state.currentScene.entities.length) });
        } else {
          store.dispatch({ type: 'scene/spawnProp', assetId: source.id, ...nextSpawnPoint(state.currentScene.entities.length) });
        }
      });

      card.addEventListener('dragstart', (event) => {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain', `paper-doll-spawn:${kind}:${sourceId}`);
        card.classList.add('is-dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('is-dragging'));

      if (spawnTab === 'characters') {
        void renderDollInto(thumb, source).then(() => { if (token !== playRenderToken) thumb.replaceChildren(); });
      } else {
        void renderAssetPreview(thumb, source);
      }
      return card;
    }));
  }

  function renderSelectedActions(state = store.getState()) {
    const selectedIds = state.ui.selectedEntityIds || (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : []);
    const isMulti = selectedIds.length >= 2;
    const selected = state.currentScene.entities.find((entity) => entity.instanceId === state.ui.selectedEntityId);
    const asset = selected ? getAsset(selected.sourceId) : null;
    const preset = selected?.kind === 'character' ? state.presets.find((item) => item.presetId === selected.sourceId) : null;
    const isCharacter = !isMulti && selected?.kind === 'character';
    const isBubble = !isMulti && selected?.kind === 'bubble';

    let label = 'No item selected';
    if (isMulti) {
      label = `${selectedIds.length} items selected`;
    } else if (selected) {
      label = isBubble
        ? `${(selected.bubbleStyle || 'speech').charAt(0).toUpperCase() + (selected.bubbleStyle || 'speech').slice(1)} bubble`
        : (selected?.sourceId === 'demo_emma' ? 'Emma sample doll' : preset?.name ?? asset?.name ?? 'Scene item');
    }

    const labelEl = $('#selected-label');
    if (labelEl) labelEl.textContent = label;
    for (const button of $$('#entity-actions > button')) button.disabled = selectedIds.length === 0;

    const alignGroup = $('#alignment-controls');
    if (alignGroup) {
      alignGroup.hidden = !isMulti;
    }

    const pinBtn = $('#pin-item-btn');
    if (pinBtn) {
      pinBtn.disabled = selectedIds.length === 0;
      const allSelectedPinned = isMulti
        ? state.currentScene.entities.filter((e) => selectedIds.includes(e.instanceId)).every((e) => e.pinned)
        : selected?.pinned;
      pinBtn.textContent = allSelectedPinned ? '📌 Pinned' : '📍 Pin';
      pinBtn.title = allSelectedPinned ? 'Unpin items from scene background' : 'Pin items to scene background';
    }
    const detachBtn = $('#detach-item-btn');
    if (detachBtn) {
      detachBtn.hidden = isMulti || !selected?.attachedTo;
      detachBtn.disabled = isMulti || !selected?.attachedTo;
    }

    const expressionGroup = $('#character-expression-controls');
    if (expressionGroup) {
      expressionGroup.hidden = !isCharacter;
      if (isCharacter) {
        const currentExpr = selected.expression || DEFAULT_EXPRESSION;
        for (const btn of $$('button[data-expression]', expressionGroup)) {
          const isSelected = btn.dataset.expression === currentExpr;
          btn.classList.toggle('is-selected-expression', isSelected);
          btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        }
      }
    }

    const bubbleGroup = $('#bubble-controls');
    if (bubbleGroup) {
      bubbleGroup.hidden = !isBubble;
      if (isBubble) {
        const currentStyle = selected.bubbleStyle || 'speech';
        for (const btn of $$('button[data-bubble-style]', bubbleGroup)) {
          const isSelected = btn.dataset.bubbleStyle === currentStyle;
          btn.classList.toggle('is-selected-bubble-style', isSelected);
          btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        }
      }
    }
  }

  function renderContextRing(state = store.getState()) {
    $('#scene-entities .context-ring')?.remove();
    const selected = state.currentScene.entities.find((entity) => entity.instanceId === state.ui.selectedEntityId);
    if (!selected || state.ui.mode !== 'play') return;
    const bounds = getEntityBounds(selected, getAsset);
    const entityHeight = bounds.height;
    const placeBelow = selected.y - entityHeight < 175;
    const ringY = placeBelow ? selected.y + 35 : selected.y - entityHeight - 20;
    const horizontalClass = selected.x < 250 ? ' align-left' : selected.x > 1350 ? ' align-right' : '';
    const ring = document.createElement('div');
    ring.className = `context-ring${placeBelow ? ' is-below' : ''}${horizontalClass}`;
    ring.style.setProperty('--ring-x', `${selected.x / 16}%`);
    ring.style.setProperty('--ring-y', `${ringY / 9}%`);
    ring.setAttribute('role', 'toolbar');
    ring.setAttribute('aria-label', 'Selected item quick controls');
    const controls = [
      ...(selected.kind === 'bubble' ? [['editBubble', '✏️', 'Edit bubble text']] : []),
      ['flip', '↔', 'Flip horizontally'],
      ['smaller', '−', 'Make smaller'],
      ['larger', '+', 'Make larger'],
      ['back', '↓', 'Send backward'],
      ['front', '↑', 'Bring forward'],
      ['togglePin', selected.pinned ? '📌' : '📍', selected.pinned ? 'Unpin item' : 'Pin item to scene'],
      ...(selected.attachedTo ? [['detach', '⛓️', 'Detach from host item']] : []),
      ['duplicate', '⧉', 'Duplicate item'],
      ['delete', '×', 'Delete item']
    ];
    ring.append(...controls.map(([action, symbol, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.action = action;
      button.textContent = symbol;
      button.title = label;
      button.setAttribute('aria-label', label);
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        void handleEntityAction(action);
      });
      return button;
    }));
    $('#scene-entities').append(ring);
  }

  async function createSceneEntity(entity, isPrimarySelected, isMultiSelected) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `scene-entity-positioner${isPrimarySelected ? ' is-selected' : ''}${isMultiSelected ? ' is-multi-selected' : ''}${entity.pinned ? ' is-pinned' : ''}${entity.kind === 'bubble' ? ' is-bubble-entity' : ''}`;
    button.dataset.instanceId = entity.instanceId;
    button.style.setProperty('--x', `${entity.x / 16}%`);
    button.style.setProperty('--y', `${entity.y / 9}%`);
    button.style.zIndex = String(entity.order);
    const asset = getAsset(entity.sourceId);
    const bounds = getEntityBounds(entity, getAsset);
    const logicalWidth = bounds.width;
    button.style.setProperty('--entity-width', `${logicalWidth / 16}%`);
    button.style.aspectRatio = entity.kind === 'character'
      ? '2 / 3'
      : (entity.kind === 'bubble' ? `${bounds.width} / ${bounds.height}` : `${asset?.displayWidth ?? 200} / ${asset?.displayHeight ?? 200}`);

    button.addEventListener('click', (e) => {
      if (e.shiftKey) {
        store.dispatch({ type: 'ui/toggleEntitySelection', instanceId: entity.instanceId });
      } else {
        store.dispatch({ type: 'ui/selectEntity', instanceId: entity.instanceId });
      }
    });

    const visual = document.createElement('span');
    visual.className = 'scene-entity-visual';
    visual.style.setProperty('--flip', entity.flipped ? '-1' : '1');

    if (entity.kind === 'character') {
      const canvas = document.createElement('span');
      canvas.className = 'scene-character-canvas';
      await renderDollInto(canvas, entity.characterSnapshot, { expression: entity.expression || DEFAULT_EXPRESSION });
      visual.append(canvas);
      const preset = store.getState().presets.find((item) => item.presetId === entity.sourceId);
      button.setAttribute('aria-label', `${entity.pinned ? 'Pinned ' : ''}${preset?.name ?? (entity.sourceId === 'demo_emma' ? 'Emma sample doll' : 'Paper doll scene item')}`);
    } else if (entity.kind === 'bubble') {
      const bubbleSvg = createBubbleSvg(entity);
      visual.append(bubbleSvg);
      button.setAttribute('aria-label', `${entity.pinned ? 'Pinned ' : ''}${entity.bubbleStyle || 'speech'} bubble: ${entity.text}`);
      button.addEventListener('dblclick', (event) => {
        event.stopPropagation();
        openEditBubbleDialog(entity);
      });
    } else {
      await appendAsset(visual, entity.sourceId, {});
      button.setAttribute('aria-label', `${entity.pinned ? 'Pinned ' : ''}${asset?.name ?? 'Unavailable prop'}`);
    }
    button.append(visual);
    if (entity.pinned) {
      const badge = document.createElement('span');
      badge.className = 'pinned-badge';
      badge.textContent = '📌';
      badge.setAttribute('aria-hidden', 'true');
      button.append(badge);
    }
    return button;
  }

  async function handleEntityAction(action) {
    const state = store.getState();
    const selectedIds = state.ui.selectedEntityIds || (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : []);
    const id = state.ui.selectedEntityId;
    const entity = state.currentScene.entities.find((item) => item.instanceId === id);
    if (!action || selectedIds.length === 0) return;

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
        store.dispatch({ type: 'scene/alignEntities', alignment, instanceIds: selectedIds });
      }
      return;
    }

    if (action === 'editBubbleText' || action === 'editBubble') {
      if (entity && entity.kind === 'bubble') openEditBubbleDialog(entity);
      return;
    }

    if (selectedIds.length > 1) {
      if (action === 'flip') store.dispatch({ type: 'scene/flipEntities', instanceIds: selectedIds });
      else if (action === 'smaller') store.dispatch({ type: 'scene/scaleEntities', instanceIds: selectedIds, delta: -0.1 });
      else if (action === 'larger') store.dispatch({ type: 'scene/scaleEntities', instanceIds: selectedIds, delta: 0.1 });
      else if (action === 'togglePin') store.dispatch({ type: 'scene/togglePinEntities', instanceIds: selectedIds });
      else if (action === 'delete' && await askConfirm(`Delete ${selectedIds.length} scene items?`, 'This removes them from the current scene.')) {
        store.dispatch({ type: 'scene/deleteEntities', instanceIds: selectedIds });
        $('#play-stage')?.focus();
      }
      return;
    }

    if (!entity) return;
    if (action === 'flip') store.dispatch({ type: 'scene/flipEntity', instanceId: id });
    else if (action === 'smaller') store.dispatch({ type: 'scene/scaleEntity', instanceId: id, scale: entity.scale - .1 });
    else if (action === 'larger') store.dispatch({ type: 'scene/scaleEntity', instanceId: id, scale: entity.scale + .1 });
    else if (action === 'back') store.dispatch({ type: 'scene/reorderEntity', instanceId: id, direction: -1 });
    else if (action === 'front') store.dispatch({ type: 'scene/reorderEntity', instanceId: id, direction: 1 });
    else if (action === 'duplicate') store.dispatch({ type: 'scene/duplicateEntity', instanceId: id });
    else if (action === 'togglePin') store.dispatch({ type: 'scene/togglePin', instanceId: id });
    else if (action === 'detach') store.dispatch({ type: 'scene/detachEntity', instanceId: id });
    else if (action === 'delete' && await askConfirm('Delete this scene item?', 'This removes only this copy from the current scene.')) {
      store.dispatch({ type: 'scene/deleteEntity', instanceId: id });
      $('#play-stage')?.focus();
    }
  }

  function handleStageKeydown(event) {
    if (event.target.matches('input, select, textarea')) return;
    const state = store.getState();
    const selectedIds = state.ui.selectedEntityIds || (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : []);
    const id = state.ui.selectedEntityId;
    const entity = state.currentScene.entities.find((item) => item.instanceId === id);

    if (event.key.toLowerCase() === 'o') {
      event.preventDefault();
      openSceneOutlineDialog?.();
      return;
    }

    if (event.key === 'Escape' && selectedIds.length > 0) {
      event.preventDefault();
      store.dispatch({ type: 'ui/clearSelection' });
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
        store.dispatch({ type: 'scene/moveEntities', moves: batchMoves });
      } else if (entity) {
        store.dispatch({ type: 'scene/moveEntity', instanceId: id, x: entity.x + dx, y: entity.y + dy });
      }
    } else if (event.key === '[') {
      if (id) store.dispatch({ type: 'scene/reorderEntity', instanceId: id, direction: -1 });
    } else if (event.key === ']') {
      if (id) store.dispatch({ type: 'scene/reorderEntity', instanceId: id, direction: 1 });
    } else if (event.key === '-' || event.key === '_') {
      void handleEntityAction('smaller');
    } else if (event.key === '+' || event.key === '=') {
      void handleEntityAction('larger');
    } else if (event.key.toLowerCase() === 'd') {
      if (selectedIds.length === 1 && id) store.dispatch({ type: 'scene/duplicateEntity', instanceId: id });
    } else if (event.key.toLowerCase() === 'p') {
      void handleEntityAction('togglePin');
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      void handleEntityAction('delete');
    }
  }

  async function render(state = store.getState()) {
    const token = ++playRenderToken;
    const focusedEntityId = document.activeElement?.closest?.('.scene-entity-positioner')?.dataset.instanceId;
    renderBackgroundSelect(state);
    renderSpawnTray(state, token);
    renderSelectedActions(state);
    $('#empty-scene').hidden = state.currentScene.entities.length > 0;
    const currentBackground = getAsset(state.currentScene.backgroundId);
    $('#scene-name-chip').textContent = currentBackground?.name ?? 'Paper scene';
    $('#scene-count-chip').textContent = `${state.currentScene.entities.length} item${state.currentScene.entities.length === 1 ? '' : 's'}`;

    const background = $('#scene-background');
    const stagedBackground = document.createElement('div');
    await appendAsset(stagedBackground, state.currentScene.backgroundId, {});
    if (token !== playRenderToken) return;
    background.replaceChildren(stagedBackground);

    const entityRoot = $('#scene-entities');
    const stagedEntities = document.createDocumentFragment();
    const ordered = [...state.currentScene.entities].sort((a, b) => a.order - b.order);
    const selectedSet = new Set(state.ui.selectedEntityIds || (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : []));

    for (const entity of ordered) {
      if (token !== playRenderToken) return;
      const isSelected = selectedSet.has(entity.instanceId);
      const isPrimary = state.ui.selectedEntityId === entity.instanceId;
      const isMulti = isSelected && selectedSet.size > 1;
      const element = await createSceneEntity(entity, isPrimary, isMulti);
      if (token !== playRenderToken) return;
      stagedEntities.append(element);
    }
    entityRoot.replaceChildren(stagedEntities);
    renderContextRing(state);
    if (focusedEntityId) {
      requestAnimationFrame(() => {
        if (token !== playRenderToken) return;
        [...entityRoot.querySelectorAll('.scene-entity-positioner')]
          .find((element) => element.dataset.instanceId === focusedEntityId)
          ?.focus({ preventScroll: true });
      });
    }
  }

  function bumpToken() {
    playRenderToken += 1;
  }

  return {
    render,
    bumpToken,
    initPointerController,
    cancelPointerController,
    renderSelectedActions,
    renderContextRing,
    handleEntityAction,
    handleStageKeydown
  };
}
