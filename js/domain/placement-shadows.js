import { getEntityBounds } from './scene-rules.js';

export function placementShadow(scene, entity, getAsset) {
  if (scene.placementMode !== 'room' || !['floor', 'surface'].includes(entity.placement?.kind)) return null;
  const b = getEntityBounds(entity, getAsset);
  return { x: entity.x, y: entity.y, width: b.width * .5, height: Math.max(3, b.height * .018), fill: '#493c3429' };
}
