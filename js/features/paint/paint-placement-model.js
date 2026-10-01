import { sanitizePlacementRules, sanitizeSurfaces } from '../../domain/placement-geometry.js';

export function defaultPaintPlacement() {
  return { groundAnchor: { x: .5, y: 1 }, placementRules: { allowedTargets: ['floor'], tags: [], contactFootprint: { width: .15, depth: .02 }, renderClass: 'upright' }, supportSurfaces: [] };
}
export function validatePaintPlacement(value) {
  if (!value || ![value.groundAnchor?.x, value.groundAnchor?.y].every(n => Number.isFinite(n) && n >= 0 && n <= 1)) return null;
  const placementRules = sanitizePlacementRules(value.placementRules), supportSurfaces = sanitizeSurfaces(value.supportSurfaces);
  if (!placementRules || !supportSurfaces || (supportSurfaces.length && placementRules.allowedTargets.join(',') !== 'floor')) return null;
  return { groundAnchor: { ...value.groundAnchor }, placementRules, supportSurfaces };
}
/** Geometry is normalized to the full drawing until the final raster crop is known. */
export function cropPaintPlacement(metadata, crop, pixelWidth, pixelHeight) {
  if (!metadata) return null;
  const width = crop.width / pixelWidth, height = crop.height / pixelHeight;
  const x = crop.x / pixelWidth, y = crop.y / pixelHeight;
  const convert = p => ({ x: (p.x - x) / width, y: (p.y - y) / height });
  // An untouched suggested anchor follows the cropped artwork's base/center.
  const anchor = metadata.anchorAuthored ? convert(metadata.groundAnchor) : metadata.placementRules.allowedTargets.includes('wall') ? { x: .5, y: .5 } : { x: .5, y: 1 };
  const result = {
    groundAnchor: anchor,
    placementRules: { ...metadata.placementRules, contactFootprint: metadata.footprintAuthored ? { width: metadata.placementRules.contactFootprint.width / width, depth: metadata.placementRules.contactFootprint.depth / height } : metadata.placementRules.contactFootprint },
    supportSurfaces: metadata.supportSurfaces.map(s => ({ ...s, polygon: s.polygon.map(([px, py]) => { const point = convert({ x: px, y: py }); return [point.x, point.y]; }) }))
  };
  const validated = validatePaintPlacement(result);
  if (!validated) throw new Error('PLACEMENT_OUTSIDE_CROP');
  return validated;
}
