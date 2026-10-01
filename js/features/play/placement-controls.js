import { getPlacementTargets, legalContactPolygon, sameTarget } from '../../domain/scene-placement.js';
import { nearestPoint } from '../../domain/placement-geometry.js';
import { assetName, t, getCurrentLanguage } from '../../core/i18n.js';

/** Native controls provide the same placement operation without dragging. */
export function createPlacementControls({ store, $, getAsset }) {
  let root = null, signature = null;
  function render(state) {
    const stage = $('#play-stage');
    if (!stage?.parentElement) return;
    if (!root) {
      root = document.createElement('div'); root.className = 'placement-controls';
      stage.parentElement.parentElement.insertBefore(root, stage.parentElement);
    }
    const scene = state.currentScene;
    const nextSignature = JSON.stringify([getCurrentLanguage(), state.ui.selectedEntityId, scene]);
    if (signature === nextSignature) return;
    signature = nextSignature;
    const hadFocus = root.contains(document.activeElement);
    root.replaceChildren();
    const entity = scene.entities.find(e => e.instanceId === state.ui.selectedEntityId);
    if (!entity) return;
    const status = document.createElement('span'); status.textContent = t(`placement.${entity.placement?.kind === 'surface' ? 'onSurface' : entity.placement?.kind === 'floor' ? 'onFloor' : entity.placement?.kind === 'wall' ? 'onWall' : 'free'}`);
    if (entity.placement?.reason === 'support-missing') status.textContent = t('placement.supportMissing');
    root.append(status);
    const label = document.createElement('label'); label.textContent = t('placement.placeOn');
    const select = document.createElement('select'); select.setAttribute('aria-label', t('placement.placeOn'));
    const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = t('placement.choose'); select.append(placeholder);
    const targets = getPlacementTargets(scene, entity, getAsset).filter(target => nearestPoint(legalContactPolygon(scene, entity, target, getAsset), entity));
    targets.forEach((target, index) => {
      const option = document.createElement('option'); option.value = String(index);
      const host = scene.entities.find(e => e.instanceId === target.hostId);
      option.textContent = target.kind === 'surface' ? `${assetName(getAsset(host.sourceId))} — ${target.surface.name || t(target.surface.nameKey || 'placement.tabletop')}` : t(`placement.${target.kind}`);
      if (sameTarget(entity, target)) option.textContent += ` (${t('placement.current')})`;
      select.append(option);
    });
    select.disabled = entity.pinned || !targets.length;
    select.addEventListener('change', () => {
      if (select.value === '') return;
      const target = targets[Number(select.value)];
      store.dispatch({ type: 'scene/placeEntity', instanceId: entity.instanceId, target: target.kind === 'surface' ? { kind: 'surface', hostId: target.hostId, surfaceId: target.surface.id } : { kind: target.kind, regionId: target.placement.regionId } });
    });
    label.append(select); root.append(label);
    if (hadFocus) select.focus();
  }
  return { render };
}
