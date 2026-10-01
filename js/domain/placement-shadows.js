import { getEntityBounds } from './scene-rules.js';

export function placementShadow(scene, entity, getAsset, enabled = false) {
  if (!enabled) return null;
  const kind = entity.placement?.kind;
  if (kind !== 'surface' && (scene.placementMode !== 'room' || !['floor', 'wall'].includes(kind))) return null;
  const b = getEntityBounds(entity, getAsset);
  if (kind === 'wall') {
    const authored = getAsset(entity.sourceId)?.wallShadow;
    // Unclassified silhouettes get a restrained central mounting shadow.
    const area = authored || { x: .5, y: .5, width: .4, height: .4 };
    return { shape: authored ? 'rect' : 'ellipse',
      x: entity.x + b.width * (area.x - b.anchorX) * (entity.flipped ? -1 : 1) + 3 * (entity.scale ?? 1),
      y: entity.y + b.height * (area.y - b.anchorY) + 5 * (entity.scale ?? 1),
      width: b.width * area.width, height: b.height * area.height, fill: '#493c3420' };
  }
  return { shape: 'ellipse', x: entity.x, y: entity.y, width: b.width * .5, height: Math.max(3, b.height * .018), fill: '#493c3429' };
}
