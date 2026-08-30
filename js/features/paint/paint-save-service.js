/**
 * Custom Paint Studio — save, draft checkpoint, and draft recovery flows.
 */

import { FIT_FAMILIES, defaultMakeId, defaultNow } from '../../domain/vocabulary.js';
import { calculatePropDisplayDimensions, canvasToBlob, computeNonTransparentBounds } from './paint-raster.js';
import { validateArtworkName } from './paint-session.js';
import { t } from '../../core/i18n.js';

export function createPaintSaveService({
  rootElement = document,
  store,
  customArtRepo,
  onNavigate,
  showAlert,
  getSession,
  getCanvasState,
  resetCanvas,
  updateLivePreview,
  announceStatus
} = {}) {
  const doc = rootElement?.ownerDocument || (typeof document !== 'undefined' ? document : rootElement);
  const saveDialog = rootElement.querySelector('#paint-save-dialog');
  const saveForm = rootElement.querySelector('#paint-save-form');
  const saveThumb = rootElement.querySelector('#paint-save-thumb');
  const saveFitNote = rootElement.querySelector('#paint-save-fit-note');
  const nameInput = rootElement.querySelector('#paint-artwork-name');
  const saveMyArtBtn = rootElement.querySelector('#paint-save-myart-btn');
  const saveContextBtn = rootElement.querySelector('#paint-save-context-btn');
  const cancelSaveBtn = rootElement.querySelector('#paint-cancel-save-btn');
  const recoveryDialog = rootElement.querySelector('#paint-draft-recovery-dialog');
  const recoverContinueBtn = rootElement.querySelector('#paint-recover-continue-btn');
  const recoverDiscardBtn = rootElement.querySelector('#paint-recover-discard-btn');
  let draftTimer = null;
  let draftCheckpointInFlight = false;
  let draftCheckpointPending = false;
  let saveInFlight = false;

  function scheduleDraftCheckpoint() {
    if (!customArtRepo) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => void flushDraftCheckpoint(), 500);
  }

  async function flushDraftCheckpoint() {
    clearTimeout(draftTimer);
    draftTimer = null;
    const paintSession = getSession();
    if (!customArtRepo || !paintSession.getState().dirty) return;
    if (draftCheckpointInFlight) {
      // The canvas changed while an earlier write was still settling. Remember the
      // request instead of dropping it, or those strokes never reach the draft.
      draftCheckpointPending = true;
      return;
    }
    draftCheckpointInFlight = true;
    try {
      const { canvas } = getCanvasState();
      const blob = await canvasToBlob(canvas);
      const state = paintSession.getState();
      await customArtRepo.saveDraft(blob, {
        itemType: state.itemType,
        slot: state.slot,
        nameIsGenerated: state.nameIsGenerated,
        baseDollId: state.baseDollId,
        referenceVisible: state.referenceVisible,
        referenceOpacity: state.referenceOpacity,
        guidesVisible: state.guidesVisible,
        cutoutReferenceVisible: state.cutoutReferenceVisible,
        cutoutAssetId: state.cutoutAssetId,
        propSize: state.propSize,
        propPlacement: state.propPlacement,
        name: state.name
      });
    } catch (err) {
      console.warn('Draft checkpoint failed:', err);
    } finally {
      draftCheckpointInFlight = false;
      if (draftCheckpointPending) {
        draftCheckpointPending = false;
        void flushDraftCheckpoint();
      }
    }
  }

  function checkpointReferencePreferences() {
    if (getSession().getState().dirty) scheduleDraftCheckpoint();
  }

  async function openSaveDialog() {
    if (!saveDialog) return;
    const state = getSession().getState();
    if (nameInput) nameInput.value = state.name;
    if (saveFitNote) saveFitNote.hidden = state.itemType !== 'wearable';
    if (saveThumb) {
      saveThumb.replaceChildren();
      const { canvas } = getCanvasState();
      const thumb = doc.createElement('canvas');
      thumb.width = canvas.width;
      thumb.height = canvas.height;
      thumb.getContext('2d').drawImage(canvas, 0, 0);
      saveThumb.appendChild(thumb);
    }
    if (saveContextBtn) {
      if (state.originContext === 'designer') {
        saveContextBtn.textContent = t('paint.saveAndWear');
        saveContextBtn.hidden = false;
      } else if (state.originContext === 'play') {
        saveContextBtn.textContent = t('paint.saveAndAddToStage');
        saveContextBtn.hidden = false;
      } else {
        saveContextBtn.hidden = true;
      }
    }
    saveDialog.showModal();
    nameInput?.focus();
    nameInput?.select?.();
  }

  async function commitSave(andUse = false) {
    if (saveInFlight) return;
    saveInFlight = true;
    const paintSession = getSession();
    const rawName = nameInput ? nameInput.value : paintSession.getState().name;
    const validation = validateArtworkName(rawName);
    if (!validation.valid) {
      await showAlert?.(validation.error);
      saveInFlight = false;
      return;
    }

    paintSession.setName(validation.name);
    const session = paintSession.getState();
    const { canvas, ctx } = getCanvasState();
    const assetId = `custom_${defaultMakeId()}`;
    const now = defaultNow().toISOString();
    let binarySaved = false;
    let metadataCommitted = false;
    try {
      let blobToSave;
      let savePixelWidth = canvas.width;
      let savePixelHeight = canvas.height;
      let saveLogicalWidth = paintSession.logicalWidth;
      let saveLogicalHeight = paintSession.logicalHeight;
      let propBounds = null;

      if (session.itemType === 'prop') {
        propBounds = computeNonTransparentBounds(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (!propBounds.empty) {
          const cropCanvas = doc.createElement('canvas');
          cropCanvas.width = propBounds.width;
          cropCanvas.height = propBounds.height;
          const cropCtx = cropCanvas.getContext('2d');
          cropCtx.drawImage(canvas, propBounds.x, propBounds.y, propBounds.width, propBounds.height, 0, 0, propBounds.width, propBounds.height);
          blobToSave = await canvasToBlob(cropCanvas);
          savePixelWidth = propBounds.width;
          savePixelHeight = propBounds.height;
          const scaleFactor = canvas.width > 0 && paintSession.logicalWidth > 0 ? (canvas.width / paintSession.logicalWidth) : 2;
          saveLogicalWidth = Math.max(1, Math.round(propBounds.width / scaleFactor));
          saveLogicalHeight = Math.max(1, Math.round(propBounds.height / scaleFactor));
        } else {
          blobToSave = await canvasToBlob(canvas);
        }
      } else {
        blobToSave = await canvasToBlob(canvas);
      }

      if (!customArtRepo?.computeSha256) throw new Error('Artwork digest service is unavailable.');
      const sha256 = await customArtRepo.computeSha256(blobToSave);
      const customMetadata = {
        assetId,
        name: validation.name,
        kind: session.itemType,
        format: 'image/png',
        logicalWidth: saveLogicalWidth,
        logicalHeight: saveLogicalHeight,
        pixelWidth: savePixelWidth,
        pixelHeight: savePixelHeight,
        byteLength: blobToSave.size,
        sha256,
        createdAt: now,
        updatedAt: now,
        libraryVisible: true,
        status: 'available'
      };

      if (session.itemType === 'wearable') {
        customMetadata.slot = session.slot;
        customMetadata.supportedFitFamilies = [...FIT_FAMILIES];
        customMetadata.presentationStyles = ['neutral'];
      } else {
        const bounds = propBounds || { aspectRatio: 1, empty: true };
        const dims = calculatePropDisplayDimensions(bounds.aspectRatio, session.propSize);
        customMetadata.displayWidth = dims.displayWidth;
        customMetadata.displayHeight = dims.displayHeight;
        customMetadata.groundAnchor = session.propPlacement === 'surface'
          ? { x: 0.5, y: 1.0 }
          : { x: 0.5, y: 0.5 };
      }

      const binaryResult = await customArtRepo.saveArtwork(assetId, blobToSave, customMetadata);
      if (!binaryResult?.ok) throw new Error(binaryResult?.error || 'Artwork binary could not be saved.');
      binarySaved = true;
      const metadataResult = store.dispatch({ type: 'customAsset/add', asset: customMetadata });
      if (!metadataResult?.ok) {
        throw new Error(metadataResult?.code === 'LIMIT' ? t('paint.limitReached') : t('paint.metadataCommitFailed'));
      }
      metadataCommitted = true;
      await customArtRepo.clearDraft('active');
      paintSession.markDirty(false);
      saveDialog?.close();

      if (andUse && session.originContext === 'designer' && session.itemType === 'wearable') {
        store.dispatch({ type: 'designer/equip', assetId });
        onNavigate?.('designer');
      } else if (andUse && session.originContext === 'play' && session.itemType === 'prop') {
        store.dispatch({ type: 'scene/spawnProp', assetId });
        onNavigate?.('play');
      } else {
        announceStatus(t('paint.savedStatus', { name: validation.name }));
      }
    } catch (err) {
      if (binarySaved && !metadataCommitted) {
        try {
          await customArtRepo.deleteArtwork?.(assetId);
        } catch (cleanupError) {
          console.warn('Could not clean up failed artwork save:', cleanupError);
        }
      }
      console.error('Save artwork failed:', err);
      await showAlert?.(t('paint.saveError', { error: err.message || 'Storage failure' }));
    } finally {
      saveInFlight = false;
    }
  }

  async function checkDraftRecovery() {
    if (!customArtRepo || !recoveryDialog) return;
    try {
      const draft = await customArtRepo.getDraft('active');
      if (draft?.blob) recoveryDialog.showModal();
    } catch {
      // ignore
    }
  }

  async function restoreActiveDraft() {
    if (!customArtRepo) return;
    try {
      const draft = await customArtRepo.getDraft('active');
      if (!draft?.blob) return;
      const url = URL.createObjectURL(draft.blob);
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
      const metadata = draft.metadata || draft;
      resetCanvas({
        itemType: metadata.itemType || 'wearable',
        slot: metadata.slot || 'top',
        nameIsGenerated: metadata.nameIsGenerated,
        baseDollId: metadata.baseDollId,
        referenceVisible: metadata.referenceVisible,
        referenceOpacity: metadata.referenceOpacity,
        guidesVisible: metadata.guidesVisible,
        cutoutReferenceVisible: metadata.cutoutReferenceVisible,
        cutoutAssetId: metadata.cutoutAssetId,
        propSize: metadata.propSize || 'medium',
        propPlacement: metadata.propPlacement || 'surface',
        name: metadata.name || t('paint.recoveredArt')
      });
      const { canvas, ctx } = getCanvasState();
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      getSession().markDirty(true);
      updateLivePreview();
    } catch (err) {
      console.warn('Could not restore draft:', err);
    }
  }

  function bindEvents() {
    saveForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      commitSave(true);
    });
    saveMyArtBtn?.addEventListener('click', () => commitSave(false));
    cancelSaveBtn?.addEventListener('click', () => saveDialog?.close());
    recoverContinueBtn?.addEventListener('click', async () => {
      recoveryDialog?.close();
      await restoreActiveDraft();
    });
    recoverDiscardBtn?.addEventListener('click', async () => {
      recoveryDialog?.close();
      await customArtRepo?.clearDraft();
    });
  }

  function refreshLanguage() {
    if (!saveDialog?.open) return;
    const state = getSession().getState();
    if (saveFitNote) saveFitNote.hidden = state.itemType !== 'wearable';
    if (!saveContextBtn) return;
    if (state.originContext === 'designer') {
      saveContextBtn.textContent = t('paint.saveAndWear');
      saveContextBtn.hidden = false;
    } else if (state.originContext === 'play') {
      saveContextBtn.textContent = t('paint.saveAndAddToStage');
      saveContextBtn.hidden = false;
    } else {
      saveContextBtn.hidden = true;
    }
  }

  function destroy() {
    clearTimeout(draftTimer);
  }

  return {
    bindEvents,
    scheduleDraftCheckpoint,
    flushDraftCheckpoint,
    checkpointReferencePreferences,
    openSaveDialog,
    commitSave,
    checkDraftRecovery,
    refreshLanguage,
    destroy
  };
}
