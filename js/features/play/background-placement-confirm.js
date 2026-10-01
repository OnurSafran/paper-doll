import { previewStageSize } from '../../domain/stage-sizing.js';
import { changePlacementBackground, placementChangeCounts } from '../../domain/scene-placement.js';
import { t } from '../../core/i18n.js';

export async function confirmBackgroundPlacement({ store, getAsset, askConfirm }, backgroundId) {
  const scene = store.getState().currentScene;
  if (scene.placementMode === 'room') {
    const preview = changePlacementBackground(scene, backgroundId, getAsset);
    const counts = placementChangeCounts(scene, preview);
    if ((counts.moved || counts.unsupported || preview.placementMode !== 'room') && !await askConfirm(t('placement.room'), t('placement.backgroundChange', counts))) return false;
  }
  store.dispatch({ type: 'scene/setBackground', backgroundId });
  return true;
}

export async function confirmStageSize({ store, getAsset, askConfirm }, stageWidth) {
  const current = store.getState().currentScene;
  const preview = previewStageSize(current, stageWidth, getAsset);
  if (preview.removedIds.length && !await askConfirm(t('placement.shrinkTitle'), t('placement.shrinkMessage', { count: preview.removedIds.length }), { okText: t('common.yes'), cancelText: t('common.cancel'), danger: true })) return false;
  // A dialog approves this exact scene, never a newer arrangement.
  if (store.getState().currentScene !== current) return false;
  const result = store.dispatch({ type: 'scene/setStageWidth', stageWidth, allowRemoval: true });
  return result.ok;
}
