import { getEntityBounds, getAttachedDescendants } from './scene-rules.js';
import { resolvePlacement, placeEntity } from './scene-placement.js';
import { clampCameraX } from '../core/coordinate-space.js';

/** A shrink removes cut-off assemblies instead of squeezing or separating them. */
export function previewStageSize(scene, stageWidth, getAsset) {
  let next = { ...scene, stageWidth, cameraX: clampCameraX(scene.cameraX, stageWidth) };
  if (stageWidth >= (scene.stageWidth || 1600)) return { scene: next, removedIds: [] };
  const removed = new Set();
  const roots = scene.entities.filter(e => !e.attachedTo);
  for (const root of roots) {
    const group = [root, ...getAttachedDescendants(scene, root.instanceId)];
    const cutOff = group.some(e => {
      const b = getEntityBounds(e, getAsset), ax = e.flipped ? 1 - b.anchorX : b.anchorX;
      return e.x - b.width * ax < -.01 || e.x + b.width * (1 - ax) > stageWidth + .01;
    });
    const candidate = scene.placementMode === 'room' && ['floor', 'wall'].includes(root.placement?.kind)
      ? resolvePlacement(next, root, root, getAsset, { transfer: true }) : null;
    const noFit = candidate ? Math.hypot(candidate.point.x - root.x, candidate.point.y - root.y) > .01
      : scene.placementMode === 'room' && ['floor', 'wall'].includes(root.placement?.kind);
    if (cutOff || noFit) group.forEach(e => removed.add(e.instanceId));
  }
  next.entities = next.entities.filter(e => !removed.has(e.instanceId));
  for (const root of next.entities.filter(e => !e.attachedTo && ['floor', 'wall'].includes(e.placement?.kind))) {
    if (scene.placementMode !== 'room') continue;
    const pinned = root.pinned;
    next = { ...next, entities: next.entities.map(e => e.instanceId === root.instanceId ? { ...e, pinned: false } : e) };
    next = placeEntity(next, root.instanceId, root, getAsset, { transfer: true });
    if (pinned) next = { ...next, entities: next.entities.map(e => e.instanceId === root.instanceId ? { ...e, pinned: true } : e) };
  }
  return { scene: next, removedIds: [...removed] };
}
