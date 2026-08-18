/**
 * Scene Outline Feature Module
 * Provides an accessible keyboard-navigable list and inspector for active scene entities,
 * layer management, multi-selection toggles, pinning, and deletion.
 */

import { getAsset as getBuiltinAsset } from '../../core/asset-catalog.js';
import { bubbleStyleLabelKey } from '../../domain/vocabulary.js';
import { assetName, t } from '../../core/i18n.js';

const escapeCss = (val) => globalThis.CSS?.escape ? CSS.escape(String(val)) : String(val).replace(/["\\]/g, '\\$&');

export function createSceneOutlineView({
  store,
  $,
  $$,
  askConfirm,
  miniButton,
  getAsset = getBuiltinAsset
}) {
  function renderSceneOutline(state = store.getState()) {
    const list = $('#scene-outline-list');
    const summary = $('#scene-outline-summary');
    if (!list) return;

    const entities = state.currentScene?.entities || [];
    if (summary) {
      const selectedCount = state.ui.selectedEntityIds?.length || (state.ui.selectedEntityId ? 1 : 0);
      summary.textContent = t('sceneOutlineDialog.totalSelected', { total: entities.length, selected: selectedCount });
    }

    if (entities.length === 0) {
      list.innerHTML = `
        <div class="tray-empty" style="padding: 2rem 1rem; text-align: center;">
          <p><strong>${t('sceneOutlineDialog.emptyStage')}</strong></p>
          <p class="panel-copy">${t('sceneOutlineDialog.emptyStageCopy')}</p>
        </div>
      `;
      return;
    }

    // Sort descending by order so top layer appears first
    const sorted = [...entities].sort((a, b) => b.order - a.order);
    const selectedSet = new Set(state.ui.selectedEntityIds || (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : []));

    const rows = sorted.map((entity) => {
      const row = document.createElement('div');
      const isSelected = selectedSet.has(entity.instanceId);
      row.className = `outline-row${isSelected ? ' is-selected' : ''}${entity.pinned ? ' is-pinned' : ''}`;
      row.dataset.instanceId = entity.instanceId;

      // Select toggle checkbox
      const selectBox = document.createElement('input');
      selectBox.type = 'checkbox';
      selectBox.className = 'outline-select-checkbox';
      selectBox.checked = isSelected;
      selectBox.addEventListener('change', () => {
        store.dispatch({ type: 'ui/toggleEntitySelection', instanceId: entity.instanceId });
      });

      // Icon & Type
      const icon = document.createElement('span');
      icon.className = 'outline-icon';
      icon.setAttribute('aria-hidden', 'true');

      let labelText = '';
      if (entity.kind === 'character') {
        icon.textContent = '👗';
        const preset = state.presets.find((p) => p.presetId === entity.sourceId);
        labelText = preset?.name || (entity.sourceId === 'demo_emma' ? 'Emma' : t('play.savedDoll'));
      } else if (entity.kind === 'bubble') {
        icon.textContent = entity.bubbleStyle === 'thought' ? '💭' : (entity.bubbleStyle === 'shout' ? '💥' : (entity.bubbleStyle === 'caption' ? '📜' : '💬'));
        labelText = `${t(bubbleStyleLabelKey(entity.bubbleStyle))}: "${entity.text?.slice(0, 22) || t('play.bubblePresetSpeechText')}${entity.text?.length > 22 ? '...' : ''}"`;
      } else {
        icon.textContent = '🪑';
        labelText = assetName(getAsset(entity.sourceId), t('play.sceneProp'));
      }

      selectBox.setAttribute('aria-label', t('play.selectOutlineAria', { name: labelText }));

      const info = document.createElement('div');
      info.className = 'outline-info';

      const title = document.createElement('span');
      title.className = 'outline-title';
      title.textContent = labelText;

      const meta = document.createElement('span');
      meta.className = 'outline-meta';
      const orderText = t('sceneOutlineDialog.layerOrder', { order: entity.order });
      const attachedText = entity.attachedTo ? ` · ${t('sceneOutlineDialog.attached')}` : '';
      const pinnedText = entity.pinned ? ` · ${t('sceneOutlineDialog.pinned')}` : '';
      meta.textContent = `${orderText}${attachedText}${pinnedText}`;

      info.append(title, meta);

      // Actions
      const actions = document.createElement('div');
      actions.className = 'outline-actions';

      const upBtn = miniButton('↑', t('sceneOutlineDialog.bringForward'), () => {
        store.dispatch({ type: 'scene/reorderEntity', instanceId: entity.instanceId, direction: 1 });
      });

      const downBtn = miniButton('↓', t('sceneOutlineDialog.sendBackward'), () => {
        store.dispatch({ type: 'scene/reorderEntity', instanceId: entity.instanceId, direction: -1 });
      });

      const pinBtn = miniButton(entity.pinned ? '📌' : '📍', entity.pinned ? t('play.pinned') : t('play.pin'), () => {
        store.dispatch({ type: 'scene/togglePin', instanceId: entity.instanceId });
      });

      const delBtn = miniButton('×', t('sceneOutlineDialog.deleteItem'), async () => {
        if (await askConfirm(t('sceneOutlineDialog.deleteConfirmTitle'), t('sceneOutlineDialog.deleteConfirmMessage'))) {
          store.dispatch({ type: 'scene/deleteEntity', instanceId: entity.instanceId });
        }
      });

      actions.append(upBtn, downBtn, pinBtn, delBtn);
      row.append(selectBox, icon, info, actions);
      return row;
    });

    const activeEl = document.activeElement;
    const focusedInstanceId = activeEl?.closest?.('.outline-row')?.dataset?.instanceId;
    const focusedActionTitle = activeEl?.getAttribute?.('title');
    const isCheckbox = activeEl?.classList?.contains?.('outline-select-checkbox');

    list.replaceChildren(...rows);

    if (focusedInstanceId && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        const targetRow = list.querySelector(`.outline-row[data-instance-id="${escapeCss(focusedInstanceId)}"]`);
        if (targetRow) {
          if (isCheckbox) {
            targetRow.querySelector('.outline-select-checkbox')?.focus?.({ preventScroll: true });
          } else if (focusedActionTitle) {
            const btn = [...targetRow.querySelectorAll('button')].find((b) => b.title === focusedActionTitle);
            btn?.focus?.({ preventScroll: true });
          }
        }
      });
    }
  }

  function openSceneOutlineDialog() {
    renderSceneOutline();
    $('#scene-outline-dialog')?.showModal();
  }

  return {
    renderSceneOutline,
    openSceneOutlineDialog
  };
}
