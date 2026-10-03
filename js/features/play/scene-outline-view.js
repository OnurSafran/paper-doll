/** Scene layer order, artwork previews, pinning, and deletion. */
import { orderedSceneEntities } from '../../domain/scene-placement.js';
import { evaluateCharacterPose } from '../../domain/motion-evaluator.js';
import { getAsset as getBuiltinAsset } from '../../core/asset-catalog.js';
import { createExportDollSvg } from '../../core/doll-svg.js';
import { createBubbleSvg } from '../../core/bubble-svg.js';
import { makeAssetPlaceholder } from '../../core/svg-loader.js';
import { appendAsset } from '../designer/designer-view.js';
import { escapeCss } from '../../core/css-escape.js';
import { bubbleStyleLabelKey } from '../../domain/vocabulary.js';
import { assetName, t } from '../../core/i18n.js';

export async function renderOutlineThumbnail(container, entity, { getAsset = getBuiltinAsset, customArtRepo = undefined, loadAssetSvg = undefined } = {}) {
  try {
    if (entity.kind === 'character') {
      const pose = evaluateCharacterPose(entity, 0, { playbackEnabled: false, getAsset });
      container.append(await createExportDollSvg(entity.characterSnapshot || {}, pose.expression, {
        getAsset, customArtRepo, loadAssetSvg, enforceFit: false, pose, expressionIntensity: pose.expressionIntensity
      }));
    } else if (entity.kind === 'bubble') {
      container.append(createBubbleSvg(entity));
    } else {
      await appendAsset(container, entity.sourceId, { getAsset, customArtRepo, loadAssetSvg, isPreview: true });
    }
  } catch {
    container.replaceChildren(makeAssetPlaceholder(t('play.sceneProp')));
  }
}

export function createSceneOutlineView({ store, $, $$: _$$ = undefined, askConfirm, miniButton, getAsset = getBuiltinAsset, customArtRepo = undefined }) {
  let cancelDrag = null;

  function bindReordering(handle, row, list, instanceId) {
    let drag = null;
    const finish = (commit) => {
      if (!drag) return;
      const { pointerId, moved, layerIndex } = drag;
      drag = null;
      cancelDrag = null;
      row.classList.remove('is-dragging');
      list.classList.remove('is-reordering');
      for (const item of list.children) item.classList.remove('is-drop-before', 'is-drop-after');
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      if (commit && moved) {
        store.dispatch({ type: 'scene/setEntityLayer', instanceId, layerIndex });
      }
      renderSceneOutline();
    };
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      cancelDrag?.();
      drag = { pointerId: event.pointerId, startY: event.clientY, moved: false, layerIndex: list.children.length - 1 - [...list.children].indexOf(row) };
      cancelDrag = () => finish(false);
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (!drag.moved && Math.abs(event.clientY - drag.startY) < 4) return;
      event.preventDefault();
      drag.moved = true;
      row.classList.add('is-dragging');
      list.classList.add('is-reordering');
      const body = list.closest('.outline-dialog-body');
      const bounds = body.getBoundingClientRect();
      if (event.clientY < bounds.top + 40) body.scrollTop -= 16;
      else if (event.clientY > bounds.bottom - 40) body.scrollTop += 16;
      const remaining = [...list.children].filter(other => other !== row);
      const nextRow = remaining.find(other => {
        const rect = other.getBoundingClientRect();
        return event.clientY < rect.top + rect.height / 2;
      });
      for (const item of list.children) item.classList.remove('is-drop-before', 'is-drop-after');
      const dropIndex = nextRow ? remaining.indexOf(nextRow) : remaining.length;
      drag.layerIndex = remaining.length - dropIndex;
      if (nextRow) nextRow.classList.add('is-drop-before');
      else remaining.at(-1)?.classList.add('is-drop-after');
    });
    handle.addEventListener('pointerup', (event) => { if (event.pointerId === drag?.pointerId) finish(true); });
    handle.addEventListener('pointercancel', (event) => { if (event.pointerId === drag?.pointerId) finish(false); });
    handle.addEventListener('lostpointercapture', () => finish(false));
    handle.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      store.dispatch({ type: 'scene/reorderEntity', instanceId, direction: event.key === 'ArrowUp' ? 1 : -1 });
    });
  }

  function renderSceneOutline(state = store.getState()) {
    if (cancelDrag) { cancelDrag(); return; }
    const list = $('#scene-outline-list');
    const summary = $('#scene-outline-summary');
    if (!list) return;
    const entities = state.currentScene?.entities || [];
    if (summary) summary.textContent = t('sceneOutlineDialog.totalItems', { total: entities.length });
    if (entities.length === 0) {
      list.innerHTML = `
        <div class="tray-empty" style="padding: 2rem 1rem; text-align: center;">
          <p><strong>${t('sceneOutlineDialog.emptyStage')}</strong></p>
          <p class="panel-copy">${t('sceneOutlineDialog.emptyStageCopy')}</p>
        </div>
      `;
      return;
    }

    // The first row is the frontmost layer, including automatic room depth.
    const sorted = orderedSceneEntities(state.currentScene, getAsset).reverse();
    const rows = sorted.map((entity, index) => {
      const row = document.createElement('div');
      row.className = `outline-row${entity.pinned ? ' is-pinned' : ''}`;
      row.dataset.instanceId = entity.instanceId;
      row.setAttribute('role', 'listitem');
      let labelText;
      if (entity.kind === 'character') {
        const preset = state.presets.find((p) => p.presetId === entity.sourceId);
        labelText = preset?.name || (entity.sourceId === 'demo_emma' ? 'Emma' : t('play.savedDoll'));
      } else if (entity.kind === 'bubble') {
        labelText = `${t(bubbleStyleLabelKey(entity.bubbleStyle))}: "${entity.text?.slice(0, 22) || t('play.bubblePresetSpeechText')}${entity.text?.length > 22 ? '...' : ''}"`;
      } else {
        labelText = assetName(getAsset(entity.sourceId), t('play.sceneProp'));
      }
      const thumbnail = document.createElement('span');
      thumbnail.className = `outline-thumbnail${entity.flipped ? ' is-flipped' : ''}`;
      thumbnail.setAttribute('aria-hidden', 'true');
      void renderOutlineThumbnail(thumbnail, entity, { getAsset, customArtRepo });

      const handle = miniButton('⠿', t('sceneOutlineDialog.reorderAria', { name: labelText }), () => {});
      handle.classList.add('outline-drag-handle');
      handle.dataset.action = 'reorder';
      bindReordering(handle, row, list, entity.instanceId);
      const info = document.createElement('div');
      info.className = 'outline-info';
      const title = document.createElement('span');
      title.className = 'outline-title';
      title.textContent = labelText;
      const meta = document.createElement('span');
      meta.className = 'outline-meta';
      // Match the effective stage order rather than a stale automatic order field.
      meta.textContent = t('sceneOutlineDialog.layerOrder', { order: sorted.length - index });
      info.append(title, meta);

      const actions = document.createElement('div');
      actions.className = 'outline-actions';
      const upBtn = miniButton('↑', t('sceneOutlineDialog.bringForward'), () => {
        store.dispatch({ type: 'scene/reorderEntity', instanceId: entity.instanceId, direction: 1 });
      });
      upBtn.dataset.action = 'forward';
      upBtn.disabled = index === 0;
      const downBtn = miniButton('↓', t('sceneOutlineDialog.sendBackward'), () => {
        store.dispatch({ type: 'scene/reorderEntity', instanceId: entity.instanceId, direction: -1 });
      });
      downBtn.dataset.action = 'backward';
      downBtn.disabled = index === sorted.length - 1;
      const pinBtn = miniButton(entity.pinned ? '📌' : '📍', entity.pinned ? t('play.unpin') : t('play.pin'), () => {
        store.dispatch({ type: 'scene/togglePin', instanceId: entity.instanceId });
      });
      pinBtn.dataset.action = 'pin';
      pinBtn.setAttribute('aria-pressed', String(Boolean(entity.pinned)));
      const delBtn = miniButton('', t('sceneOutlineDialog.deleteItem'), async () => {
        if (await askConfirm(t('sceneOutlineDialog.deleteConfirmTitle'), t('sceneOutlineDialog.deleteConfirmMessage'))) {
          store.dispatch({ type: 'scene/deleteEntity', instanceId: entity.instanceId });
        }
      });
      delBtn.dataset.action = 'delete';
      delBtn.classList.add('outline-delete-button');
      delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';
      actions.append(upBtn, downBtn, pinBtn, delBtn);
      row.append(thumbnail, handle, info, actions);
      return row;
    });

    const activeEl = /** @type {HTMLElement} */ (document.activeElement);
    const focusedInstanceId = /** @type {HTMLElement} */ (activeEl?.closest?.('.outline-row'))?.dataset.instanceId;
    const focusedAction = activeEl?.dataset?.action;
    list.replaceChildren(...rows);
    if (focusedInstanceId && focusedAction && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        const targetRow = list.querySelector(`.outline-row[data-instance-id="${escapeCss(focusedInstanceId)}"]`);
        const target = targetRow?.querySelector(`button[data-action="${escapeCss(focusedAction)}"]`);
        (target && !target.disabled ? target : targetRow?.querySelector('.outline-drag-handle'))?.focus?.({ preventScroll: true });
      });
    }
  }

  function openSceneOutlineDialog() {
    renderSceneOutline();
    const dialog = $('#scene-outline-dialog');
    dialog?.addEventListener('close', () => cancelDrag?.(), { once: true });
    dialog?.showModal();
  }

  return { renderSceneOutline, openSceneOutlineDialog };
}
