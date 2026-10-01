import { getPlacementTargets, legalContactPolygon, sameTarget } from '../../domain/scene-placement.js';
import { nearestPoint } from '../../domain/placement-geometry.js';
import { escapeCss } from '../../core/css-escape.js';
import { assetName, t } from '../../core/i18n.js';
import { enableDialogLightDismiss, enableDialogFocusRestoration } from '../../core/dialog-dismiss.js';

/** Secondary non-drag actions; Play has no persistent destination selector. */
export function getPlacementChoices(scene, entity, getAsset) {
  if (!entity || entity.pinned || entity.kind === 'bubble') return [];
  return getPlacementTargets(scene, entity, getAsset).filter(target => !sameTarget(entity, target) && nearestPoint(legalContactPolygon(scene, entity, target, getAsset), entity));
}

export function openPlacementActions({ store, getAsset }, instanceId) {
  const scene = store.getState().currentScene;
  const entity = scene.entities.find(e => e.instanceId === instanceId);
  const targets = getPlacementChoices(scene, entity, getAsset);
  if (!targets.length) return;
  const fromOutline = Boolean(document.activeElement?.closest('#scene-outline-dialog'));
  const dialog = document.createElement('dialog');
  dialog.className = 'library-dialog placement-actions-dialog';
  dialog.setAttribute('aria-label', t('placement.placeOn'));
  dialog.setAttribute('closedby', 'any');
  const header = document.createElement('div'); header.className = 'dialog-header';
  const title = document.createElement('h2'); title.textContent = t('placement.placeOn');
  const close = document.createElement('button'); close.type = 'button'; close.className = 'icon-close-btn'; close.textContent = '✕'; close.setAttribute('aria-label', t('common.close'));
  close.addEventListener('click', () => dialog.close());
  header.append(title, close);
  const actions = document.createElement('div'); actions.className = 'placement-destination-actions';
  for (const target of targets) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'button secondary';
    const host = scene.entities.find(e => e.instanceId === target.hostId);
    button.textContent = target.kind === 'surface' ? `${assetName(getAsset(host.sourceId))} — ${target.surface.name || t(target.surface.nameKey || 'placement.tabletop')}` : t(`placement.${target.kind}`);
    button.addEventListener('click', () => {
      store.dispatch({ type: 'scene/placeEntity', instanceId, target: target.kind === 'surface' ? { kind: 'surface', hostId: target.hostId, surfaceId: target.surface.id } : { kind: target.kind, regionId: target.placement.regionId } });
      dialog.close();
    });
    actions.append(button);
  }
  dialog.append(header, actions);
  document.body.append(dialog);
  enableDialogLightDismiss(dialog);
  enableDialogFocusRestoration(dialog, '#play-stage');
  dialog.addEventListener('close', () => {
    // Placement renders fresh buttons, so the original trigger may be gone.
    const outline = document.querySelector('#scene-outline-dialog[open]');
    const row = outline?.querySelector(`.outline-row[data-instance-id="${escapeCss(instanceId)}"]`);
    const target = fromOutline && outline
      ? row?.querySelector('button:not(:disabled)') || row?.querySelector('input') || outline.querySelector('#close-scene-outline')
      : document.querySelector('.context-ring button[data-action="placeOn"]') || document.querySelector('#play-stage');
    /** @type {HTMLElement} */ (target)?.focus({ preventScroll: true });
  });
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.showModal();
}
