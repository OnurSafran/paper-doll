/** Project backup, import, and export workflows. */
import { getAsset } from './core/asset-catalog.js';
import { persistedProjection } from './core/state-schema.js';
import { LIMITS } from './domain/vocabulary.js';
import { clearProjectBackup, exportProjectPackage, formatProjectExportFilename, getAvailableBackup, mergeProjectEnvelopes, saveProjectBackup, validateImportPayload } from './services/project-portability.js';
import { t } from './core/i18n.js';

export function createAppProjectController(context) {
  let pendingImportArtwork = [];

  function openProjectDialog() {
    const state = context.store.getState();
    const statsContainer = context.$('#project-export-stats');
    if (statsContainer) {
      const dollCount = state.presets.length;
      const sceneCount = state.scenes.length;
      const entityCount = state.currentScene?.entities?.length ?? 0;
      const customCount = state.customAssets?.length ?? 0;
      statsContainer.replaceChildren(
        Object.assign(document.createElement('span'), { className: 'stat-chip', textContent: t('projectDialog.statDolls', { count: dollCount }) }),
        Object.assign(document.createElement('span'), { className: 'stat-chip', textContent: t('projectDialog.statScenes', { count: sceneCount }) }),
        Object.assign(document.createElement('span'), { className: 'stat-chip', textContent: entityCount > 0 ? t('projectDialog.statActiveStage', { count: entityCount }) : t('projectDialog.statEmptyStage') }),
        ...(customCount > 0 ? [Object.assign(document.createElement('span'), { className: 'stat-chip', textContent: t('projectDialog.statCustomArt', { count: customCount }) })] : [])
      );
    }

    const backupSection = context.$('#project-backup-section');
    const backupRes = getAvailableBackup(context.storageRef, getAsset);
    if (backupSection) {
      if (backupRes.available) {
        backupSection.hidden = false;
        const backupTime = context.$('#backup-timestamp');
        const backupDetails = context.$('#backup-details');
        if (backupTime) backupTime.textContent = t('projectDialog.backupFrom', { date: new Date(backupRes.backedUpAt).toLocaleString() });
        if (backupDetails) backupDetails.textContent = t('projectDialog.backupDetails', { presets: backupRes.summary.presetCount, scenes: backupRes.summary.sceneCount });
      } else {
        backupSection.hidden = true;
      }
    }

    const previewCard = context.$('#import-preview-card');
    if (previewCard) previewCard.hidden = true;
    const fileInput = context.$('#project-file-input');
    if (fileInput) fileInput.value = '';
    context.pendingImportEnvelope = null;
    pendingImportArtwork = [];

    context.$('#project-dialog')?.showModal();
  }

  async function exportProjectJsonFile() {
    try {
      const state = context.store.getState();
      const jsonStr = await exportProjectPackage(state, context.customArtRepo);
      const filename = formatProjectExportFilename();
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 6000);
      context.showToast(t('toasts.projectDownloaded'));
    } catch {
      context.showToast(t('toasts.projectExportFailed'));
    }
  }

  async function handleProjectFile(file) {
    if (!file) return;
    if (file.size > LIMITS.MAX_PACKAGE_BYTES) {
      context.showToast(t('toasts.packageTooLarge'));
      return;
    }
    try {
      const text = await file.text();
      const res = await validateImportPayload(text, getAsset);
      if (!res.ok) {
        context.showToast(res.error || t('toasts.projectParseError'));
        return;
      }
      context.pendingImportEnvelope = res.envelope;
      pendingImportArtwork = res.customArtwork || [];

      const previewCard = context.$('#import-preview-card');
      const filenameEl = context.$('#import-filename');
      const badgesEl = context.$('#import-summary-badges');
      const warningsEl = context.$('#import-warnings-box');

      if (filenameEl) filenameEl.textContent = file.name || 'project.json';
      if (badgesEl) {
        badgesEl.replaceChildren(
          Object.assign(document.createElement('span'), { className: 'stat-chip', textContent: t('projectDialog.statDolls', { count: res.summary.presetCount }) }),
          Object.assign(document.createElement('span'), { className: 'stat-chip', textContent: t('projectDialog.statScenes', { count: res.summary.sceneCount }) }),
          Object.assign(document.createElement('span'), { className: 'stat-chip', textContent: res.summary.hasCurrentScene ? t('projectDialog.statActiveStage', { count: res.summary.currentSceneEntityCount }) : t('projectDialog.statEmptyStage') }),
          ...(res.summary.customAssetCount > 0 ? [Object.assign(document.createElement('span'), { className: 'stat-chip', textContent: t('projectDialog.statCustomArt', { count: res.summary.customAssetCount }) })] : [])
        );
      }

      if (warningsEl) {
        if (res.warnings.length > 0) {
          warningsEl.hidden = false;
          warningsEl.textContent = `Note: ${res.warnings.join(' ')}`;
        } else {
          warningsEl.hidden = true;
        }
      }

      if (previewCard) previewCard.hidden = false;
    } catch {
      context.showToast(t('toasts.projectReadError'));
    }
  }

  async function executeImportMerge() {
    if (!context.pendingImportEnvelope) return;
    const currentEnv = persistedProjection(context.store.getState());
    const merged = mergeProjectEnvelopes(currentEnv, context.pendingImportEnvelope, pendingImportArtwork);

    const sessionId = 'merge_' + Date.now();
    const staged = await context.customArtRepo.stageArtworkBatch(sessionId, merged.customArtwork || []);
    if (!staged.ok) {
      context.showToast(t('toasts.mergeStagingError', { error: staged.error || 'storage issue' }));
      return;
    }
    const committed = await context.customArtRepo.commitStagedArtwork(sessionId);
    if (!committed.ok) {
      await context.customArtRepo.pruneStaging(sessionId);
      context.showToast(t('toasts.mergeCommitError', { error: committed.error || 'storage issue' }));
      return;
    }

    context.store.dispatch({
      type: 'project/importMerge',
      envelope: merged.envelope,
      messageKey: 'toasts.importMergedStats',
      messageParams: {
        dolls: merged.stats.addedPresets,
        scenes: merged.stats.addedScenes,
        custom: merged.stats.addedCustomAssets ?? 0
      }
    });
    context.$('#project-dialog')?.close();
  }

  async function executeImportReplace() {
    if (!context.pendingImportEnvelope) return;
    const confirmed = await context.askConfirm(
      t('projectDialog.replaceConfirmTitle'),
      t('projectDialog.replaceConfirmMessage')
    );
    if (!confirmed) return;

    const currentEnv = persistedProjection(context.store.getState());
    const backupResult = saveProjectBackup(context.storageRef, currentEnv);
    const currentArtworkIds = new Set((currentEnv.customAssets || [])
      .filter((asset) => asset.status === 'available')
      .map((asset) => asset.assetId));
    const currentArtwork = (await context.customArtRepo.getAllArtwork())
      .filter((item) => currentArtworkIds.has(item.assetId));
    const customBackupResult = await context.customArtRepo.saveBackup('latest', currentEnv, currentArtwork);
    if (!backupResult.ok || !customBackupResult.ok) {
      clearProjectBackup(context.storageRef);
      context.showToast(t('toasts.replaceBackupError', { error: backupResult.error || customBackupResult.error || 'storage issue' }));
      return;
    }

    const sessionId = 'import_' + Date.now();
    const staged = await context.customArtRepo.stageArtworkBatch(sessionId, pendingImportArtwork);
    if (!staged.ok) {
      await context.customArtRepo.pruneStaging(sessionId);
      context.showToast(t('toasts.replaceStagingError', { error: staged.error || 'storage issue' }));
      return;
    }
    const committed = await context.customArtRepo.commitStagedArtwork(sessionId);
    if (!committed.ok) {
      await context.customArtRepo.pruneStaging(sessionId);
      context.showToast(t('toasts.replaceCommitError', { error: committed.error || 'storage issue' }));
      return;
    }

    context.store.dispatch({
      type: 'project/importReplace',
      envelope: context.pendingImportEnvelope,
      messageKey: backupResult.ok
        ? 'toasts.importReplacedWithBackup'
        : 'toasts.importReplaced'
    });
    const importedCustomIds = (context.pendingImportEnvelope.customAssets || []).map((asset) => asset.assetId);
    const orphanIds = await context.customArtRepo.scanOrphans(importedCustomIds);
    await context.customArtRepo.pruneOrphans(orphanIds, importedCustomIds);
    context.$('#project-dialog')?.close();
  }

  async function executeRestoreBackup() {
    const backup = getAvailableBackup(context.storageRef, getAsset);
    if (!backup.available) {
      context.showToast(t('toasts.noBackupFound'));
      return;
    }
    const confirmed = await context.askConfirm(
      t('projectDialog.restoreBackupBtn'),
      t('projectDialog.backupCopy')
    );
    if (!confirmed) return;

    const latestArtBackup = await context.customArtRepo.getLatestBackup();
    if (backup.envelope.customAssets?.length && !latestArtBackup) {
      context.showToast(t('toasts.backupRestoreUnavailable'));
      return;
    }
    if (latestArtBackup) {
      const restored = await context.customArtRepo.restoreBackup(latestArtBackup.backupId);
      if (!restored.ok) {
        context.showToast(t('toasts.backupRestoreError', { error: restored.error || 'custom artwork could not be restored.' }));
        return;
      }
    }

    context.store.dispatch({
      type: 'project/restoreBackup',
      envelope: backup.envelope,
      messageKey: 'toasts.backupRestored'
    });

    const saveResult = context.storage.flush({ force: true });
    if (saveResult?.ok) {
      clearProjectBackup(context.storageRef);
    }
    context.$('#project-dialog')?.close();
  }

  function executeDismissBackup() {
    clearProjectBackup(context.storageRef);
    const backupSection = context.$('#project-backup-section');
    if (backupSection) backupSection.hidden = true;
    context.showToast(t('toasts.backupDismissed'));
  }

  return { openProjectDialog, exportProjectJsonFile, handleProjectFile, executeImportMerge, executeImportReplace, executeRestoreBackup, executeDismissBackup };
}
