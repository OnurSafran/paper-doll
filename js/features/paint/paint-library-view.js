/**
 * Custom Paint Studio — My Art library and artwork impact flows.
 */

import { countAssetUses, slotLabel } from '../../domain/outfit-rules.js';
import { t } from '../../core/i18n.js';
import { validateArtworkName } from './paint-session.js';
import { captureHistorySnapshot } from './paint-history.js';

export function createPaintLibraryView({
  rootElement = document,
  store,
  customArtRepo,
  onNavigate,
  askConfirm,
  showAlert,
  getSession,
  getCanvasState,
  resetCanvas,
  updateLivePreview,
  updateHistoryButtons,
  announceStatus,
  checkDirtyBeforeAction
} = {}) {
  const doc = rootElement?.ownerDocument || rootElement || document;
  const myArtBtn = rootElement.querySelector('#paint-myart-btn');
  const myArtDialog = rootElement.querySelector('#paint-myart-dialog');
  const closeMyArtBtn = rootElement.querySelector('#close-myart-dialog');
  const myArtGrid = rootElement.querySelector('#paint-myart-grid');
  const myArtTabs = rootElement.querySelectorAll('#paint-myart-dialog .myart-tab-btn');
  const myArtTrashActions = rootElement.querySelector('#myart-trash-actions');
  const myArtEmptyTrashBtn = rootElement.querySelector('#myart-empty-trash-btn');
  const impactDialog = rootElement.querySelector('#paint-impact-dialog');
  const impactThumb = rootElement.querySelector('#impact-art-thumb');
  const impactName = rootElement.querySelector('#impact-art-name');
  const impactSummary = rootElement.querySelector('#impact-art-summary');
  const impactDetailsBox = rootElement.querySelector('#impact-details-box');
  const impactCancelBtn = rootElement.querySelector('#paint-impact-cancel-btn');
  const impactRemoveBtn = rootElement.querySelector('#paint-impact-remove-btn');
  const impactDeleteAllBtn = rootElement.querySelector('#paint-impact-delete-all-btn');
  const renameDialog = rootElement.querySelector('#paint-rename-dialog');
  const renameForm = rootElement.querySelector('#paint-rename-form');
  const renameInput = rootElement.querySelector('#paint-rename-input');
  const renameCancelBtn = rootElement.querySelector('#paint-rename-cancel-btn');

  let currentMyArtTab = 'all';
  let activeImpactAsset = null;
  let activeRenameAsset = null;

  function renderMyArtCards() {
    if (!myArtGrid) return;
    myArtGrid.replaceChildren();
    const state = store?.getState?.() || {};
    const allCustoms = state.customAssets || [];

    let filtered = [];
    if (currentMyArtTab === 'trash') {
      filtered = allCustoms.filter((a) => a.status === 'trashed' || a.libraryVisible === false);
    } else if (currentMyArtTab === 'wearable') {
      filtered = allCustoms.filter((a) => (a.status === 'available' || a.status == null) && a.libraryVisible !== false && a.kind === 'wearable');
    } else if (currentMyArtTab === 'prop') {
      filtered = allCustoms.filter((a) => (a.status === 'available' || a.status == null) && a.libraryVisible !== false && a.kind === 'prop');
    } else {
      filtered = allCustoms.filter((a) => (a.status === 'available' || a.status == null) && a.libraryVisible !== false);
    }

    if (filtered.length === 0) {
      const emptyP = doc.createElement('p');
      emptyP.className = 'panel-copy';
      emptyP.style.gridColumn = '1 / -1';
      emptyP.style.textAlign = 'center';
      emptyP.style.padding = '2rem 1rem';
      emptyP.textContent = currentMyArtTab === 'trash'
        ? t('paintMyArtDialog.emptyTrash')
        : (currentMyArtTab === 'wearable' ? t('paintMyArtDialog.emptyWearable') : (currentMyArtTab === 'prop' ? t('paintMyArtDialog.emptyProp') : t('paintMyArtDialog.emptyAll')));
      myArtGrid.appendChild(emptyP);
      return;
    }

    for (const asset of filtered) {
      const card = doc.createElement('article');
      card.className = `myart-card ${asset.status === 'trashed' ? 'is-trashed' : ''}`;
      card.setAttribute('role', 'listitem');

      const thumbWrap = doc.createElement('div');
      thumbWrap.className = 'myart-card-thumb-wrap';

      const img = doc.createElement('img');
      img.alt = asset.name || t('paint.customArtwork');
      img.loading = 'lazy';
      if (customArtRepo?.getTrackedObjectUrl) {
        customArtRepo.getTrackedObjectUrl(asset.assetId).then((url) => {
          if (url) {
            img.src = url;
          } else {
            const missingLabel = doc.createElement('span');
            missingLabel.className = 'missing-art-label';
            missingLabel.textContent = `🎨 ${asset.status === 'trashed' ? t('paintMyArtDialog.trashed') : t('paintMyArtDialog.noPreview')}`;
            thumbWrap.replaceChildren(missingLabel);
          }
        }).catch(() => {});
      }
      thumbWrap.appendChild(img);
      card.appendChild(thumbWrap);

      const info = doc.createElement('div');
      info.className = 'myart-card-info';
      const titleRow = doc.createElement('div');
      titleRow.className = 'myart-card-title-row';
      const title = doc.createElement('strong');
      title.className = 'myart-card-title';
      title.textContent = asset.name || t('paint.untitled');
      title.title = asset.name || t('paint.untitled');
      titleRow.appendChild(title);
      info.appendChild(titleRow);

      const meta = doc.createElement('span');
      meta.className = 'myart-card-meta';
      const slotText = asset.kind === 'wearable'
        ? (t('wardrobeSlots.' + asset.slot) || slotLabel(asset.slot) || t('paint.wearableTypeLabel'))
        : t('paint.propTypeLabel');
      meta.textContent = `${slotText} • ${new Date(asset.createdAt || Date.now()).toLocaleDateString()}`;
      info.appendChild(meta);

      const impact = countAssetUses(asset.assetId, state);
      const usageBadge = doc.createElement('span');
      usageBadge.className = 'panel-copy';
      usageBadge.style.fontSize = '0.78rem';
      usageBadge.textContent = t('paintMyArtDialog.usedInCount', { count: impact.totalUses });
      info.appendChild(usageBadge);
      card.appendChild(info);

      const actions = doc.createElement('div');
      actions.className = 'myart-card-actions';
      if (currentMyArtTab === 'trash') {
        const restoreBtn = doc.createElement('button');
        restoreBtn.type = 'button';
        restoreBtn.className = 'button secondary myart-card-btn';
        restoreBtn.textContent = '↺ ' + t('projectDialog.restoreArtworkLabel');
        restoreBtn.title = t('paintMyArtDialog.restoreTitle');
        restoreBtn.addEventListener('click', () => handleRestoreArtwork(asset.assetId));
        actions.appendChild(restoreBtn);

        const purgeBtn = doc.createElement('button');
        purgeBtn.type = 'button';
        purgeBtn.className = 'button danger-fill myart-card-btn';
        purgeBtn.textContent = '🗑 ' + t('play.deleteItem');
        purgeBtn.title = t('paintMyArtDialog.deleteTitle');
        purgeBtn.addEventListener('click', () => handleDeletePermanently(asset.assetId));
        actions.appendChild(purgeBtn);
      } else {
        const useBtn = doc.createElement('button');
        useBtn.type = 'button';
        useBtn.className = 'button primary myart-card-btn';
        useBtn.textContent = asset.kind === 'wearable' ? '👗 ' + t('designer.useArtworkLabel') : '➕ ' + t('projectDialog.addArtworkLabel');
        useBtn.title = asset.kind === 'wearable' ? t('designer.equipAssetAria', { name: asset.name, custom: '' }) : t('play.paintPropAria');
        useBtn.addEventListener('click', () => {
          myArtDialog.close();
          if (asset.kind === 'wearable') {
            store.dispatch({ type: 'designer/equip', assetId: asset.assetId });
            onNavigate?.('designer');
          } else {
            store.dispatch({ type: 'scene/spawnProp', assetId: asset.assetId });
            onNavigate?.('play');
          }
        });
        actions.appendChild(useBtn);

        const copyBtn = doc.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'button secondary myart-card-btn';
        copyBtn.textContent = '📝 ' + t('play.saveCopyLabel');
        copyBtn.title = t('paintMyArtDialog.editCopyTitle', { name: asset.name });
        copyBtn.addEventListener('click', () => editCopyOfArtwork(asset.assetId));
        actions.appendChild(copyBtn);

        const renameBtn = doc.createElement('button');
        renameBtn.type = 'button';
        renameBtn.className = 'button secondary myart-card-btn';
        renameBtn.textContent = '✏️ ' + t('paintRenameDialog.renameLabel');
        renameBtn.title = t('paintMyArtDialog.renameTitle');
        renameBtn.addEventListener('click', () => openRenameDialog(asset));
        actions.appendChild(renameBtn);

        const impactBtn = doc.createElement('button');
        impactBtn.type = 'button';
        impactBtn.className = 'button secondary myart-card-btn';
        impactBtn.textContent = '🗑 ' + t('paintImpactDialog.removeBtn');
        impactBtn.title = t('paintMyArtDialog.deleteTitle');
        impactBtn.addEventListener('click', () => openImpactDialog(asset));
        actions.appendChild(impactBtn);
      }
      card.appendChild(actions);
      myArtGrid.appendChild(card);
    }
  }

  async function editCopyOfArtwork(assetId) {
    if (!assetId) return;
    const state = store?.getState?.() || {};
    const asset = (state.customAssets || []).find((a) => a.assetId === assetId);
    if (!asset) return;
    const sessionState = getSession().getState();

    checkDirtyBeforeAction(async () => {
      try {
        let record = await customArtRepo?.getArtwork?.(assetId);
        if (!record && customArtRepo?.getDraft) {
          const draft = await customArtRepo.getDraft('active');
          if (draft?.metadata?.assetId === assetId) record = draft;
        }
        if (!record?.blob) {
          await showAlert?.(t('paint.pixelsNotFound'));
          return;
        }

        const url = URL.createObjectURL(record.blob);
        const img = new Image();
        try {
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = url;
          });
        } finally {
          URL.revokeObjectURL(url);
        }

        resetCanvas({
          itemType: asset.kind || 'wearable',
          slot: asset.slot || 'top',
          propSize: asset.displayWidth > 240 ? 'large' : (asset.displayWidth < 180 ? 'small' : 'medium'),
          propPlacement: asset.groundAnchor?.y === 0.5 ? 'hang' : 'surface',
          name: t('paint.copyName', { name: asset.name }),
          baseDollId: sessionState.baseDollId,
          originContext: sessionState.originContext
        });

        const { canvas, ctx } = getCanvasState();
        const blankCanvasSnapshot = captureHistorySnapshot(ctx);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        getSession().pushHistory(blankCanvasSnapshot);
        updateLivePreview();
        updateHistoryButtons();
        myArtDialog?.close();
        announceStatus(t('paint.openedCopyStatus', { name: asset.name }));
      } catch (err) {
        console.error('Edit copy failed:', err);
        await showAlert?.(t('paint.editCopyFailed'));
      }
    });
  }

  function openImpactDialog(asset) {
    if (!impactDialog || !asset) return;
    activeImpactAsset = asset;
    const state = store?.getState?.() || {};
    const impact = countAssetUses(asset.assetId, state);
    if (impactName) impactName.textContent = asset.name || t('paint.untitled');
    if (impactSummary) impactSummary.textContent = impact.formattedSummary;

    if (impactThumb) {
      impactThumb.replaceChildren();
      const img = doc.createElement('img');
      img.alt = asset.name || t('paint.customArtwork');
      customArtRepo?.getTrackedObjectUrl?.(asset.assetId).then((url) => {
        if (url) img.src = url;
      }).catch(() => {});
      impactThumb.appendChild(img);
    }

    if (impactDetailsBox) {
      impactDetailsBox.replaceChildren();
      const list = doc.createElement('ul');
      list.className = 'impact-details-list';
      if (impact.inDesignerDraft) {
        const li = doc.createElement('li');
        li.textContent = `👗 ${t('paintImpactDialog.equippedInDraft')}`;
        list.appendChild(li);
      }
      for (const p of impact.presets) {
        const li = doc.createElement('li');
        const icon = doc.createElement('span');
        icon.textContent = '🎀';
        const text = doc.createElement('span');
        text.append(`${t('paintImpactDialog.dollboxPreset')}: `);
        const name = doc.createElement('strong');
        name.textContent = p.name || t('paint.untitled');
        text.append(name, ` (${p.count} ${t(p.count === 1 ? 'paint.usesOne' : 'paint.usesMany')})`);
        li.append(icon, ' ', text);
        list.appendChild(li);
      }
      if (impact.currentSceneUses > 0) {
        const li = doc.createElement('li');
        li.textContent = `🎬 ${t('paintImpactDialog.activeStageScene', { count: impact.currentSceneUses })}`;
        list.appendChild(li);
      }
      for (const s of impact.scenes) {
        const li = doc.createElement('li');
        const icon = doc.createElement('span');
        icon.textContent = '📖';
        const text = doc.createElement('span');
        text.append(`${t('paintImpactDialog.savedScene')}: `);
        const title = doc.createElement('strong');
        title.textContent = s.title || t('paint.untitledScene');
        text.append(title, ` (${s.count} ${t(s.count === 1 ? 'paint.itemsOne' : 'paint.itemsMany')})`);
        li.append(icon, ' ', text);
        list.appendChild(li);
      }
      if (impact.totalUses === 0) {
        const li = doc.createElement('li');
        li.textContent = `✨ ${t('paintImpactDialog.notCurrentlyUsed')}`;
        list.appendChild(li);
      }
      impactDetailsBox.appendChild(list);
    }
    if (!impactDialog.open) impactDialog.showModal();
  }

  async function handleRemoveFromMyArt(assetId) {
    if (!assetId) return;
    try {
      const moved = await customArtRepo?.moveToTrash?.(assetId, 'user_removed');
      if (!moved?.ok) throw new Error(moved?.error || 'Artwork could not be moved to trash.');
      const removed = store.dispatch({ type: 'customAsset/remove', assetId });
      if (!removed?.ok) {
        await customArtRepo.restoreFromTrash(assetId);
        throw new Error('Artwork metadata could not be updated.');
      }
      impactDialog?.close();
      renderMyArtCards();
      announceStatus(t('paintMyArtDialog.removedStatus'));
    } catch (err) {
      console.error('Remove artwork failed:', err);
      await showAlert?.(t('paintMyArtDialog.removeFailed'));
    }
  }

  async function handleDeleteWithUses(assetId) {
    if (!assetId) return;
    try {
      const moved = await customArtRepo?.moveToTrash?.(assetId, 'user_deleted_all_uses');
      if (!moved?.ok) throw new Error(moved?.error || 'Artwork could not be moved to trash.');
      const deleted = store.dispatch({ type: 'customAsset/deleteWithUses', assetId });
      if (!deleted?.ok) {
        await customArtRepo.restoreFromTrash(assetId);
        throw new Error('Artwork uses could not be deleted.');
      }
      impactDialog?.close();
      renderMyArtCards();
      announceStatus(t('paintMyArtDialog.deletedWithUsesStatus'));
    } catch (err) {
      console.error('Delete with uses failed:', err);
      await showAlert?.(t('paintMyArtDialog.deleteFailed'));
    }
  }

  function openRenameDialog(asset) {
    if (!renameDialog || !asset) return;
    activeRenameAsset = asset;
    if (renameInput) renameInput.value = asset.name || '';
    renameDialog.showModal();
    renameInput?.focus();
    renameInput?.select?.();
  }

  async function handleSaveRename(e) {
    e?.preventDefault?.();
    if (!activeRenameAsset) return;
    const validation = validateArtworkName(renameInput?.value || '');
    if (!validation.valid) {
      await showAlert?.(validation.error);
      return;
    }
    store.dispatch({ type: 'customAsset/rename', assetId: activeRenameAsset.assetId, name: validation.name });
    renameDialog?.close();
    renderMyArtCards();
    announceStatus(t('paintMyArtDialog.renamedStatus', { name: validation.name }));
  }

  async function handleRestoreArtwork(assetId) {
    if (!assetId) return;
    try {
      const restored = await customArtRepo?.restoreFromTrash?.(assetId);
      if (!restored?.ok) throw new Error(restored?.error || 'Artwork could not be restored from trash.');
      const metadataResult = store.dispatch({ type: 'customAsset/restore', assetId });
      if (!metadataResult?.ok) {
        await customArtRepo.moveToTrash(assetId, 'metadata_restore_failed');
        throw new Error('Artwork metadata could not be restored.');
      }
      renderMyArtCards();
      announceStatus(t('paintMyArtDialog.restoredStatus'));
    } catch (err) {
      console.error('Restore artwork failed:', err);
      await showAlert?.(t('paintMyArtDialog.restoreFailed'));
    }
  }

  async function handleDeletePermanently(assetId) {
    if (!assetId) return;
    if (!await (askConfirm?.(t('paintMyArtDialog.permanentDeleteConfirm'), t('paintMyArtDialog.permanentDeleteConfirmMessage')) ?? true)) return;
    try {
      const binaryResult = await customArtRepo?.deleteArtwork?.(assetId);
      if (!binaryResult?.ok) throw new Error(binaryResult?.error || 'Artwork pixels could not be deleted.');
      const deleted = store.dispatch({ type: 'customAsset/deleteWithUses', assetId });
      if (!deleted?.ok) throw new Error('Artwork metadata could not be deleted.');
      renderMyArtCards();
      announceStatus(t('paintMyArtDialog.permanentDeletedStatus'));
    } catch (err) {
      console.error('Permanent deletion failed:', err);
      await showAlert?.(t('paintMyArtDialog.deleteFailed'));
    }
  }

  async function handleEmptyTrash() {
    const currentState = store?.getState?.() || {};
    const referencedTrashCount = (currentState.customAssets || []).filter((asset) =>
      (asset.status === 'trashed' || asset.libraryVisible === false) && countAssetUses(asset.assetId, currentState).totalUses > 0
    ).length;
    const confirmation = referencedTrashCount > 0
      ? t('paintMyArtDialog.emptyTrashRetainedConfirm', { count: referencedTrashCount })
      : t('paintMyArtDialog.emptyTrashConfirmMessage');
    if (!await (askConfirm?.(t('paintMyArtDialog.emptyTrashConfirmTitle'), confirmation) ?? true)) return;
    try {
      const state = store?.getState?.() || {};
      const trashed = (state.customAssets || []).filter((asset) => asset.status === 'trashed' || asset.libraryVisible === false);
      const deletableIds = trashed.filter((asset) => countAssetUses(asset.assetId, state).totalUses === 0).map((asset) => asset.assetId);
      if (deletableIds.length > 0) {
        const emptied = await customArtRepo?.emptyTrash?.(deletableIds);
        if (!emptied?.ok) throw new Error(emptied?.error || 'Trash could not be emptied.');
        const purged = store.dispatch({ type: 'customAsset/purgeTrash', assetIds: deletableIds });
        if (!purged?.ok) throw new Error('Trashed artwork metadata could not be deleted.');
      }
      renderMyArtCards();
      const retainedCount = trashed.length - deletableIds.length;
      announceStatus(retainedCount > 0
        ? t('paintMyArtDialog.trashEmptiedRetained', { count: retainedCount })
        : t('paintMyArtDialog.trashEmptied'));
    } catch (err) {
      console.error('Empty trash failed:', err);
      await showAlert?.(t('paintMyArtDialog.emptyTrashFailed'));
    }
  }

  function openMyArtDialog(tab = 'all') {
    if (!myArtDialog) return;
    currentMyArtTab = tab;
    myArtTabs?.forEach((btn) => {
      const active = btn.dataset.tab === currentMyArtTab;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    if (myArtTrashActions) myArtTrashActions.hidden = currentMyArtTab !== 'trash';
    renderMyArtCards();
    myArtDialog.showModal();
  }

  function bindEvents() {
    myArtBtn?.addEventListener('click', () => openMyArtDialog('all'));
    closeMyArtBtn?.addEventListener('click', () => myArtDialog?.close());
    myArtTabs?.forEach((tabBtn) => tabBtn.addEventListener('click', () => openMyArtDialog(tabBtn.dataset.tab)));
    myArtEmptyTrashBtn?.addEventListener('click', handleEmptyTrash);
    impactCancelBtn?.addEventListener('click', () => impactDialog?.close());
    impactRemoveBtn?.addEventListener('click', () => {
      if (activeImpactAsset) handleRemoveFromMyArt(activeImpactAsset.assetId);
    });
    impactDeleteAllBtn?.addEventListener('click', () => {
      if (activeImpactAsset) handleDeleteWithUses(activeImpactAsset.assetId);
    });
    renameCancelBtn?.addEventListener('click', () => renameDialog?.close());
    renameForm?.addEventListener('submit', handleSaveRename);
  }

  function refreshLanguage() {
    if (myArtDialog?.open) renderMyArtCards();
    if (impactDialog?.open && activeImpactAsset) openImpactDialog(activeImpactAsset);
  }

  return {
    bindEvents,
    openMyArtDialog,
    renderMyArtCards,
    editCopyOfArtwork,
    refreshLanguage
  };
}
