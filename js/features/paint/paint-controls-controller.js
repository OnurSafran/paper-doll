/** Paint control state and session setup events. */
import { slotLabel } from '../../domain/outfit-rules.js';
import { t } from '../../core/i18n.js';
import { captureHistorySnapshot, historySnapshotChanged } from './paint-history.js';

export function createPaintControlsController(context) {
  const itemBadge = /** @type {HTMLElement} */ (context.rootElement.querySelector('#paint-item-label'));

  const backBtn = /** @type {HTMLButtonElement} */ (context.rootElement.querySelector('#paint-back-btn'));

  const newBtn = /** @type {HTMLButtonElement} */ (context.rootElement.querySelector('#paint-new-btn'));

  const mirrorBtn = /** @type {HTMLButtonElement} */ (context.rootElement.querySelector('#paint-mirror-btn'));

  const clearBtn = /** @type {HTMLButtonElement} */ (context.rootElement.querySelector('#paint-clear-btn'));

  const saveBtn = /** @type {HTMLButtonElement} */ (context.rootElement.querySelector('#paint-save-btn'));

  const itemChipText = /** @type {HTMLElement} */ (context.rootElement.querySelector('#paint-item-chip-text'));

  const typeWearableBtn = /** @type {HTMLButtonElement} */ (context.rootElement.querySelector('#paint-type-wearable'));

  const typePropBtn = /** @type {HTMLButtonElement} */ (context.rootElement.querySelector('#paint-type-prop'));

  const wearableConfig = /** @type {HTMLElement} */ (context.rootElement.querySelector('#paint-wearable-config'));

  const propConfig = /** @type {HTMLElement} */ (context.rootElement.querySelector('#paint-prop-config'));

  const slotSelect = /** @type {HTMLSelectElement} */ (context.rootElement.querySelector('#paint-slot-select'));

  const propSizeSelect = /** @type {HTMLSelectElement} */ (context.rootElement.querySelector('#paint-prop-size-select'));

  const propPlacementSelect = /** @type {HTMLSelectElement} */ (context.rootElement.querySelector('#paint-prop-placement-select'));

  const referenceControls = /** @type {HTMLDetailsElement} */ (context.rootElement.querySelector('#paint-reference-controls'));

  const referenceVisible = /** @type {HTMLInputElement} */ (context.rootElement.querySelector('#paint-reference-visible'));

  const referenceModel = /** @type {HTMLSelectElement} */ (context.rootElement.querySelector('#paint-reference-model'));

  const referenceOpacity = /** @type {HTMLInputElement} */ (context.rootElement.querySelector('#paint-reference-opacity'));

  const referenceOpacityValue = /** @type {HTMLOutputElement} */ (context.rootElement.querySelector('#paint-reference-opacity-value'));

  const guidesVisible = /** @type {HTMLInputElement} */ (context.rootElement.querySelector('#paint-guides-visible'));

  const brushSizeGroup = /** @type {HTMLElement} */ (context.rootElement.querySelector('#paint-brush-size-group'));

  const selectionOptions = /** @type {HTMLElement} */ (context.rootElement.querySelector('#paint-selection-options'));

  const selectionDeleteBtn = /** @type {HTMLButtonElement} */ (context.rootElement.querySelector('#paint-selection-delete-btn'));

  const selectionCancelBtn = /** @type {HTMLButtonElement} */ (context.rootElement.querySelector('#paint-selection-cancel-btn'));

  const selectionFlipBtn = /** @type {HTMLButtonElement} */ (context.rootElement.querySelector('#paint-selection-flip-btn'));

  const selectionDuplicateBtn = /** @type {HTMLButtonElement} */ (context.rootElement.querySelector('#paint-selection-duplicate-btn'));

  const tabDraw = /** @type {HTMLElement} */ (context.rootElement.querySelector('#paint-tab-draw'));

  const tabSetup = /** @type {HTMLElement} */ (context.rootElement.querySelector('#paint-tab-setup'));

  const panelDraw = /** @type {HTMLElement} */ (context.rootElement.querySelector('#paint-panel-draw'));

  const panelSetup = /** @type {HTMLElement} */ (context.rootElement.querySelector('#paint-panel-setup'));

  const dirtyKeepBtn = /** @type {HTMLButtonElement} */ (context.rootElement.querySelector('#paint-dirty-keep-btn'));

  const dirtyDiscardBtn = /** @type {HTMLButtonElement} */ (context.rootElement.querySelector('#paint-dirty-discard-btn'));

  const dirtySaveBtn = /** @type {HTMLButtonElement} */ (context.rootElement.querySelector('#paint-dirty-save-btn'));

  function updateUIFromState() {
    const state = context.session.getState();

    context.canvas?.setAttribute('aria-label', t('paint.canvasAria', {
      type: state.itemType === 'wearable' ? t('paint.wearableTypeBtn') : t('paint.propTypeLabel'),
      tool: t('paint.toolLabels.' + state.tool) || state.tool,
      zoom: state.zoom === 2 ? '2x' : '1x',
      status: state.dirty ? t('paint.unsavedStatus') : t('paint.cleanStatus')
    }));

    if (itemBadge) {
      itemBadge.textContent = state.itemType === 'wearable'
        ? `${t('wardrobeSlots.' + state.slot) || state.slot.toUpperCase()} ${t('paint.cutoutSuffix')}`
        : t('paint.propTypeLabel');
    }

    if (itemChipText) {
      itemChipText.textContent = state.itemType === 'wearable'
        ? `👗 ${t('paint.wearableTypeBtn') || 'Kıyafet'} · ${t('wardrobeSlots.' + state.slot) || state.slot}`
        : `🧸 ${t('paint.propTypeBtn') || 'Eşya'}`;
    }

    typeWearableBtn?.classList.toggle('active', state.itemType === 'wearable');
    typePropBtn?.classList.toggle('active', state.itemType === 'prop');
    if (wearableConfig) wearableConfig.hidden = state.itemType !== 'wearable';
    if (propConfig) propConfig.hidden = state.itemType !== 'prop';
    // Reference controls are now a <details> element; toggle display instead of hidden
    if (referenceControls) {
      referenceControls.style.display = state.itemType !== 'wearable' ? 'none' : '';
    }

    if (slotSelect) slotSelect.value = state.slot;
    if (propSizeSelect) propSizeSelect.value = state.propSize;
    if (propPlacementSelect) propPlacementSelect.value = state.propPlacement;
    if (referenceVisible) referenceVisible.checked = state.referenceVisible;
    if (referenceModel) referenceModel.value = state.baseDollId;
    if (referenceOpacity) referenceOpacity.value = String(state.referenceOpacity);
    if (referenceOpacityValue) referenceOpacityValue.value = `${state.referenceOpacity}%`;
    if (guidesVisible) guidesVisible.checked = state.guidesVisible;
    if (context.cutoutReferenceVisible) context.cutoutReferenceVisible.checked = state.cutoutReferenceVisible;

    /** @type {NodeListOf<HTMLButtonElement>} */ (context.toolsToolbar?.querySelectorAll('.tool-btn'))?.forEach((btn) => {
      const active = btn.dataset.tool === state.tool;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    if (context.shapeOptions) context.shapeOptions.hidden = state.tool !== 'shape';
    if (selectionOptions) {
      const showSelectionOptions = state.tool === 'select' || Boolean(context.selectionRect);
      selectionOptions.hidden = !showSelectionOptions;
      const hasActiveSelection = Boolean(context.selectionRect);
      if (selectionDeleteBtn) selectionDeleteBtn.disabled = !hasActiveSelection;
      if (selectionCancelBtn) selectionCancelBtn.disabled = !hasActiveSelection;
      if (selectionFlipBtn) selectionFlipBtn.disabled = !hasActiveSelection;
      if (selectionDuplicateBtn) selectionDuplicateBtn.disabled = !hasActiveSelection;
    }
    if (context.shapeFilledCheckbox) context.shapeFilledCheckbox.checked = state.shapeFilled;

    // Contextual: show brush-size only for brush/eraser
    if (brushSizeGroup) {
      brushSizeGroup.hidden = state.tool !== 'brush' && state.tool !== 'eraser';
    }

    if (context.brushSizeSlider) context.brushSizeSlider.value = String(state.brushSize);
    if (context.brushSizeValue) context.brushSizeValue.value = `${state.brushSize}px`;

    mirrorBtn?.setAttribute('aria-pressed', String(state.mirror));
    mirrorBtn?.classList.toggle('active', state.mirror);

    if (context.zoomBtn) {
      context.zoomBtn.textContent = state.zoom === 2 ? '🔍 2×' : '🔍 1×';
    }

    context.updatePaletteActive();
  }

  function switchSidebarTab(tab) {
    if (tabDraw) {
      tabDraw.classList.toggle('active', tab === 'draw');
      tabDraw.setAttribute('aria-selected', String(tab === 'draw'));
    }
    if (tabSetup) {
      tabSetup.classList.toggle('active', tab === 'setup');
      tabSetup.setAttribute('aria-selected', String(tab === 'setup'));
    }
    if (panelDraw) panelDraw.hidden = tab !== 'draw';
    if (panelSetup) panelSetup.hidden = tab !== 'setup';
  }

  function bindEvents() {
    context.canvas.addEventListener('pointerdown', context.handlePointerDown);
    context.canvas.addEventListener('pointermove', context.handlePointerMove);
    context.canvas.addEventListener('pointerup', context.handlePointerUp);
    context.canvas.addEventListener('pointercancel', context.handlePointerCancel);
    window.addEventListener('keydown', context.handleKeyDown);

    // Close item chip popover on outside click
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('click', context.handleDocumentClick);
    }

    // Sidebar tab switching (backward compatibility)
    tabDraw?.addEventListener('click', () => switchSidebarTab('draw'));
    tabSetup?.addEventListener('click', () => switchSidebarTab('setup'));

    context.undoBtn?.addEventListener('click', context.handleUndo);
    context.redoBtn?.addEventListener('click', context.handleRedo);

    selectionDeleteBtn?.addEventListener('click', () => {
      context.deleteSelection();
    });
    selectionCancelBtn?.addEventListener('click', () => {
      context.selectionRect = null;
      context.selectionPixels = null;
      context.updateSelectionOutline();
      updateUIFromState();
    });
    selectionFlipBtn?.addEventListener('click', () => {
      context.flipSelectionHorizontally();
    });
    selectionDuplicateBtn?.addEventListener('click', () => {
      context.moveSelectionBy(10, 10, true);
    });

    newBtn?.addEventListener('click', () => {
      if (context.session.getState().dirty) {
        context.checkDirtyBeforeAction(() => context.resetCanvas());
      } else {
        context.resetCanvas();
      }
    });

    backBtn?.addEventListener('click', () => {
      const origin = context.session.getState().originContext || 'designer';
      if (context.session.getState().dirty) {
        context.checkDirtyBeforeAction(() => {
          if (context.onNavigate) context.onNavigate(origin);
        });
      } else {
        if (context.onNavigate) context.onNavigate(origin);
      }
    });

    mirrorBtn?.addEventListener('click', () => {
      context.session.toggleMirror();
      updateUIFromState();
    });

    context.zoomBtn?.addEventListener('click', () => {
      const nextZoom = context.session.getState().zoom === 1 ? 2 : 1;
      context.session.setZoom(nextZoom);
      if (context.canvasStage) {
        context.canvasStage.style.setProperty('--paint-zoom', nextZoom === 2 ? '2' : '1');
      }
      if (context.zoomBtn) context.zoomBtn.textContent = nextZoom === 2 ? '🔍 2×' : '🔍 1×';
    });

    clearBtn?.addEventListener('click', async () => {
      if (context.canvasHasPixels()) {
        const confirmed = await (context.askConfirm?.(
          t('paint.clearCanvasTitle'),
          t('paint.clearCanvasMessage')
        ) ?? true);
        if (!confirmed) return;
      }
      const before = captureHistorySnapshot(context.ctx);
      context.ctx.clearRect(0, 0, context.canvas.width, context.canvas.height);
      if (!historySnapshotChanged(context.ctx, before)) return;
      context.session.pushHistory(before);
      context.session.markDirty(true);
      context.updateHistoryButtons();
      updateUIFromState();
      context.updateLivePreview();
      context.saveService.scheduleDraftCheckpoint();
    });

    saveBtn?.addEventListener('click', context.saveService.openSaveDialog);

    // Type toggles
    bindSetupEvents();
    context.bindPaletteEvents();
    bindDirtyEvents();
    context.saveService.bindEvents();
    context.libraryView.bindEvents();
  }

  function bindSetupEvents() {
    typeWearableBtn?.addEventListener('click', () => {
      if (context.session.getState().itemType !== 'wearable') {
        context.checkDirtyBeforeAction(() => context.resetCanvas({ itemType: 'wearable', slot: slotSelect?.value || 'top' }));
      }
    });

    typePropBtn?.addEventListener('click', () => {
      if (context.session.getState().itemType !== 'prop') {
        context.checkDirtyBeforeAction(() => context.resetCanvas({ itemType: 'prop' }));
      }
    });

    slotSelect?.addEventListener('change', (e) => {
      const slot = /** @type {HTMLInputElement} */ (e.target).value;
      context.cancelTransientOperation({ clearSelection: true });
      if (!context.session.setSlot(slot)) return;
      updateUIFromState();
      context.loadCutoutsForSlot(slot);
      context.renderGuideLayer();
      context.updateLivePreview();
      context.saveService.scheduleDraftCheckpoint();
      context.announceStatus(t('paint.slotChanged', { slot: slotLabel(slot) || slot }));
    });

    context.cutoutAddBtn?.addEventListener('click', () => {
      context.rasterizeCutoutIntoCanvas(context.session.getState().cutoutAssetId, 'add');
    });

    context.cutoutReplaceBtn?.addEventListener('click', () => {
      context.rasterizeCutoutIntoCanvas(context.session.getState().cutoutAssetId, 'replace');
    });

    propSizeSelect?.addEventListener('change', (e) => {
      context.session.setPropSize(/** @type {HTMLInputElement} */ (e.target).value);
      updateUIFromState();
      context.saveService.scheduleDraftCheckpoint();
    });

    propPlacementSelect?.addEventListener('change', (e) => {
      context.session.setPropPlacement(/** @type {HTMLInputElement} */ (e.target).value);
      updateUIFromState();
      context.saveService.scheduleDraftCheckpoint();
    });

    referenceVisible?.addEventListener('change', (e) => {
      context.session.setReferenceVisible(/** @type {HTMLInputElement} */ (e.target).checked);
      context.renderGuideLayer();
      context.saveService.checkpointReferencePreferences();
      context.announceStatus(/** @type {HTMLInputElement} */ (e.target).checked ? t('paint.referenceShown') : t('paint.referenceHidden'));
    });

    referenceModel?.addEventListener('change', (e) => {
      if (!context.session.setBaseDollId(/** @type {HTMLInputElement} */ (e.target).value)) return;
      context.renderGuideLayer();
      context.updateLivePreview();
      context.saveService.checkpointReferencePreferences();
      context.announceStatus(t('paint.modelChanged', { name: /** @type {HTMLSelectElement} */ (e.target).selectedOptions?.[0]?.textContent || 'selected model' }));
    });

    referenceOpacity?.addEventListener('input', (e) => {
      context.session.setReferenceOpacity(Number(/** @type {HTMLInputElement} */ (e.target).value));
      const value = context.session.getState().referenceOpacity;
      if (referenceOpacityValue) referenceOpacityValue.value = `${value}%`;
      if (context.guideLayer) context.guideLayer.style.setProperty('--reference-opacity', String(value / 100));
      context.saveService.checkpointReferencePreferences();
    });

    referenceOpacity?.addEventListener('change', () => {
      context.announceStatus(t('paint.opacityChanged', { percent: context.session.getState().referenceOpacity }));
    });

    guidesVisible?.addEventListener('change', (e) => {
      context.session.setGuidesVisible(/** @type {HTMLInputElement} */ (e.target).checked);
      context.renderGuideLayer();
      context.saveService.checkpointReferencePreferences();
      context.announceStatus(/** @type {HTMLInputElement} */ (e.target).checked ? t('paint.guidesShown') : t('paint.guidesHidden'));
    });

    context.cutoutReferenceVisible?.addEventListener('change', (e) => {
      context.session.setCutoutReferenceVisible(/** @type {HTMLInputElement} */ (e.target).checked);
      context.renderGuideLayer();
      context.saveService.checkpointReferencePreferences();
      context.announceStatus(/** @type {HTMLInputElement} */ (e.target).checked ? t('paint.cutoutRefShown') : t('paint.cutoutRefHidden'));
    });

    // Tools
  }

  function bindDirtyEvents() {
    dirtyKeepBtn?.addEventListener('click', () => {
      context.dirtyDialog?.close();
      context.pendingNavigationHref = null;
    });

    dirtyDiscardBtn?.addEventListener('click', () => {
      context.dirtyDialog?.close();
      context.session.markDirty(false);
      context.customArtRepo?.clearDraft();
      if (typeof context.pendingNavigationHref === 'function') {
        context.pendingNavigationHref();
      }
      context.pendingNavigationHref = null;
    });

    dirtySaveBtn?.addEventListener('click', () => {
      context.dirtyDialog?.close();
      context.saveService.openSaveDialog();
    });

  }

  return { updateUIFromState, switchSidebarTab, bindEvents, bindSetupEvents, bindDirtyEvents };
}
