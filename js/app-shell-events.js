/** Designer actions, shell commands, and native drop targets. */
import { clientToLogical } from './core/coordinate-space.js';
import { previewCustomColor } from './features/designer/designer-view.js';
import { CLEARABLE_OUTFIT_SLOTS } from './domain/vocabulary.js';
import { setLanguage, getCurrentLanguage, t } from './core/i18n.js';

export function createAppShellEvents(context) {
  function wireDesignerEvents() {
    context.$('#save-preset-form').addEventListener('submit', (event) => {
      event.preventDefault();
      context.store.dispatch({ type: 'preset/save', name: String(new FormData(event.currentTarget).get('dollName') ?? '') });
    });
    context.$('#update-preset').addEventListener('click', () => context.store.dispatch({ type: 'preset/update', name: context.$('#doll-name').value }));
    context.$('#remove-piece').addEventListener('click', () => context.store.dispatch({ type: 'designer/remove' }));
    context.$('#shuffle-outfit').addEventListener('click', () => context.store.dispatch({ type: 'designer/shuffle' }));
    context.$('#clear-outfit').addEventListener('click', async () => {
      const dressed = CLEARABLE_OUTFIT_SLOTS.some((slot) => context.store.getState().designer.draft.slots[slot]);
      if (!dressed || await context.askConfirm(t('designer.clearOutfitTitle'), t('designer.clearOutfitMessage'))) {
        context.store.dispatch({ type: 'designer/clearOutfit' });
      }
    });
    context.$('#custom-color').addEventListener('input', (event) => previewCustomColor(event.target.value, context.store.getState().designer.selectedSlot));
    context.$('#custom-color').addEventListener('change', (event) => {
      const slot = context.store.getState().designer.selectedSlot;
      context.store.dispatch({ type: 'designer/setColor', slot, color: event.target.value });
    });
    context.$('#designer-mode-wardrobe')?.addEventListener('click', () => context.store.dispatch({ type: 'designer/setActiveTab', tab: 'wardrobe' }));
    context.$('#designer-mode-face')?.addEventListener('click', () => context.store.dispatch({ type: 'designer/setActiveTab', tab: 'face' }));
    context.$('#reset-doll').addEventListener('click', async () => {
      if (!context.store.getState().designer.dirty || await context.askConfirm(t('designer.resetDollTitle'), t('designer.resetDollMessage'))) {
        context.store.dispatch({ type: 'designer/reset' });
      }
    });
  }

  function wireShellEvents() {
    context.$('#lang-toggle-btn')?.addEventListener('click', () => {
      const nextLang = getCurrentLanguage() === 'tr' ? 'en' : 'tr';
      setLanguage(nextLang);
    });

    // Guide Dialog & Tabs wiring
    function selectGuideTab(tabKey) {
      const tabButtons = context.$$('#guide-tabs [data-guide-tab]');
      const panels = context.$$('.guide-tab-panel');
      tabButtons.forEach((btn) => {
        const isActive = btn.dataset.guideTab === tabKey;
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-selected', String(isActive));
      });
      panels.forEach((panel) => {
        const isTarget = panel.id === `guide-panel-${tabKey}`;
        panel.hidden = !isTarget;
        panel.classList.toggle('is-active', isTarget);
      });
    }

    context.$('#guide-tabs')?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-guide-tab]');
      if (btn) {
        selectGuideTab(btn.dataset.guideTab);
      }
    });

    context.$('#guide-menu-btn')?.addEventListener('click', () => {
      selectGuideTab('quickstart');
      context.$('#guide-dialog')?.showModal();
    });
    context.$('#close-guide-dialog')?.addEventListener('click', () => context.$('#guide-dialog')?.close());
    context.$('#project-menu-btn')?.addEventListener('click', () => context.openProjectDialog());
    context.$('#close-project-dialog')?.addEventListener('click', () => context.$('#project-dialog')?.close());
    context.$('#export-project-btn')?.addEventListener('click', () => context.exportProjectJsonFile());

    async function handleHardResetAction() {
      const confirmed = await context.askConfirm(
        t('projectDialog.forceReloadBtn'),
        t('projectDialog.updateCopy')
      );
      if (confirmed) {
        context.showToast(t('toasts.clearingReloading'));
        await window.hardRefresh();
      }
    }

    context.$('#project-hard-reset-btn')?.addEventListener('click', () => void handleHardResetAction());
    context.$('#footer-hard-reset-btn')?.addEventListener('click', () => void handleHardResetAction());
    context.$('#browse-project-file-btn')?.addEventListener('click', () => context.$('#project-file-input')?.click());
    context.$('#project-file-input')?.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (file) void context.handleProjectFile(file);
    });

    const importDropzone = context.$('#import-dropzone');
    if (importDropzone) {
      importDropzone.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        importDropzone.classList.add('is-drop-target');
      });
      importDropzone.addEventListener('dragleave', () => {
        importDropzone.classList.remove('is-drop-target');
      });
      importDropzone.addEventListener('drop', (event) => {
        event.preventDefault();
        importDropzone.classList.remove('is-drop-target');
        const file = event.dataTransfer.files?.[0];
        if (file) void context.handleProjectFile(file);
      });
    }

    context.$('#import-merge-btn')?.addEventListener('click', () => void context.executeImportMerge());
    context.$('#import-replace-btn')?.addEventListener('click', () => void context.executeImportReplace());
    context.$('#import-cancel-btn')?.addEventListener('click', () => {
      const previewCard = context.$('#import-preview-card');
      if (previewCard) previewCard.hidden = true;
      const fileInput = context.$('#project-file-input');
      if (fileInput) fileInput.value = '';
      context.pendingImportEnvelope = null;
    });

    context.$('#restore-backup-btn')?.addEventListener('click', () => void context.executeRestoreBackup());
    context.$('#dismiss-backup-btn')?.addEventListener('click', () => context.executeDismissBackup());

    // Global action buttons
    context.$('#undo-button')?.addEventListener('click', () => context.store.dispatch({ type: 'app/undo' }));
    context.$('#redo-button')?.addEventListener('click', () => context.store.dispatch({ type: 'app/redo' }));
    context.$('#export-scene-png')?.addEventListener('click', () => void context.exportSceneAsPng());
    context.$('#export-frame-btn')?.addEventListener('click', () => void context.exportCurrentFrameAsPng());
    context.$('#play-stage')?.addEventListener('keydown', context.playView.handleStageKeydown);
    context.$('#camera-hud')?.addEventListener('keydown', context.playView.handleStageKeydown);
    document.addEventListener('keydown', context.handleTabKeys);
    document.addEventListener('keydown', context.handleGlobalShortcuts);

    // Ensure reliable virtual keyboard activation on iPad/iOS Safari upon click/tap
    document.addEventListener('pointerup', (event) => {
      const input = /** @type {HTMLInputElement | HTMLTextAreaElement} */ (/** @type {Element} */ (event.target)?.closest?.('input:not([type="file"]):not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="color"]), textarea'));
      if (input && document.activeElement !== input) {
        input.focus();
      }
    });

    // Drag & drop into designer
  }

  function wireDropEvents() {
    const designerStage = context.$('.designer-stage');
    designerStage.addEventListener('dragover', (event) => {
      if (!Array.from(event.dataTransfer.types).includes('text/plain')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      designerStage.classList.add('is-drop-target');
    });
    designerStage.addEventListener('dragleave', (event) => {
      if (!designerStage.contains(event.relatedTarget)) designerStage.classList.remove('is-drop-target');
    });
    designerStage.addEventListener('drop', (event) => {
      event.preventDefault();
      designerStage.classList.remove('is-drop-target');
      const payload = event.dataTransfer.getData('text/plain');
      const match = payload.match(/^paper-doll-wearable:([a-z0-9_-]+)$/);
      if (match) context.store.dispatch({ type: 'designer/equip', assetId: match[1] });
    });

    // Drag & drop into play stage
    const playStage = context.$('#play-stage');
    playStage.addEventListener('dragover', (event) => {
      if (!Array.from(event.dataTransfer.types).includes('text/plain')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      playStage.classList.add('is-spawn-target');
    });
    playStage.addEventListener('dragleave', (event) => {
      if (!playStage.contains(event.relatedTarget)) playStage.classList.remove('is-spawn-target');
    });
    playStage.addEventListener('drop', (event) => {
      event.preventDefault();
      playStage.classList.remove('is-spawn-target');
      const match = event.dataTransfer.getData('text/plain').match(/^paper-doll-spawn:(character|prop|bubble):([a-zA-Z0-9_-]+)(?::(.*))?$/);
      if (!match) return;
      const cameraX = context.store.getState().currentScene.cameraX || 0;
      const point = clientToLogical(event.clientX, event.clientY, playStage.getBoundingClientRect(), cameraX);
      const hostElement = event.target.closest?.('.scene-entity-positioner');
      const targetEntityId = hostElement?.dataset?.instanceId;

      if (match[1] === 'character') context.store.dispatch({ type: 'scene/spawnCharacter', presetId: match[2], ...point });
      else if (match[1] === 'bubble') context.store.dispatch({ type: 'scene/spawnBubble', bubbleStyle: match[2], text: match[3] ? decodeURIComponent(match[3]) : 'Hello!', targetEntityId, ...point });
      else context.store.dispatch({ type: 'scene/spawnProp', assetId: match[2], targetEntityId, ...point });
    });

  }

  return { wireDesignerEvents, wireShellEvents, wireDropEvents };
}
