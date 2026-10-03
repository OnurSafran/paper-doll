/** Shared placement rules for commands, pointer previews, reload, and renderers. */
import { getEntityBounds, getAttachedDescendants, clampCompoundEntityPoint } from './scene-rules.js';
import { getBackgroundLayout } from '../core/background-layout.js';
import { clipPolygon, insetPolygon, nearestPoint, validPolygon } from './placement-geometry.js';

export function placementRules(entity, getAsset) {
  if (entity.kind === 'character') return { allowedTargets: ['floor'], tags: [], contactFootprint: { width: .3, depth: .02 }, renderClass: 'upright' };
  return getAsset(entity.sourceId)?.placementRules;
}
export function projectLocal(host, point, getAsset) {
  const b = getEntityBounds(host, getAsset);
  return { x: host.x + (point.x - b.anchorX) * b.width * (host.flipped ? -1 : 1), y: host.y + (point.y - b.anchorY) * b.height };
}
export function unprojectLocal(host, point, getAsset) {
  const b = getEntityBounds(host, getAsset);
  return { x: b.anchorX + (point.x - host.x) / b.width * (host.flipped ? -1 : 1), y: b.anchorY + (point.y - host.y) / b.height };
}
export function getPlacementRegions(scene, getAsset) {
  const asset = getAsset(scene.backgroundId);
  const regions = asset?.placementProfile?.regions;
  if (!Array.isArray(regions) || regions.length > 8) return [];
  const layout = getBackgroundLayout(asset, scene.stageWidth);
  const validRegions = regions.filter(r => ['floor', 'wall'].includes(r.kind) && typeof r.id === 'string' && validPolygon(r.polygon, false));
  // Full-width rectangular planes join across artwork seams. Islands stay separate.
  const continuous = new Set(validRegions.filter(r => {
    const xs = [...new Set(r.polygon.map(p => p[0]))], ys = [...new Set(r.polygon.map(p => p[1]))];
    return r.polygon.length === 4 && xs.length === 2 && ys.length === 2 && Math.min(...xs) === 0 && Math.max(...xs) === layout.tileWidth;
  }).map(r => r.id));
  return layout.tiles.flatMap((tile, index) => validRegions.filter(r => !continuous.has(r.id) || index === 0).map(r => continuous.has(r.id) ? {
    ...r, regionId: `${r.id}:0`, regionIds: layout.tiles.map((_, i) => `${r.id}:${i}`),
    polygon: [[0, Math.min(...r.polygon.map(p => p[1]))], [layout.stageWidth, Math.min(...r.polygon.map(p => p[1]))], [layout.stageWidth, Math.max(...r.polygon.map(p => p[1]))], [0, Math.max(...r.polygon.map(p => p[1]))]]
  } : {
    ...r, regionId: `${r.id}:${index}`, polygon: r.polygon.map(([x, y]) => [tile.x + (tile.mirrored ? layout.tileWidth - x : x), y])
  }));
}
export function getPlacementTargets(scene, entity, getAsset) {
  const rules = placementRules(entity, getAsset);
  if (!rules) return [];
  const targets = getPlacementRegions(scene, getAsset).filter(r => rules.allowedTargets.includes(r.kind)).map(r => ({ ...r, placement: { kind: r.kind, regionId: r.regionId }, hostId: null }));
  if (!rules.allowedTargets.includes('surface')) return targets;
  const excluded = new Set([entity.instanceId, ...getAttachedDescendants(scene, entity.instanceId).map(e => e.instanceId)]);
  for (const host of scene.entities) {
    if (getAsset(host.sourceId)?.status === 'missing' || getAsset(host.sourceId)?.status === 'corrupt' || excluded.has(host.instanceId) || host.attachedTo || host.placement?.kind === 'surface' || host.kind !== 'prop') continue;
    const hostRules = placementRules(host, getAsset);
    if (!hostRules || !hostRules.allowedTargets.includes('floor') || hostRules.allowedTargets.includes('surface') || hostRules.allowedTargets.includes('wall')) continue;
    for (const surface of getAsset(host.sourceId)?.supportSurfaces || []) {
      if (!validPolygon(surface.polygon) || !surface.acceptsTags.some(tag => rules.tags.includes(tag))) continue;
      targets.push({ kind: 'surface', hostId: host.instanceId, surface, placement: { kind: 'surface', surfaceId: surface.id }, polygon: surface.polygon.map(([x, y]) => { const p = projectLocal(host, { x, y }, getAsset); return [p.x, p.y]; }) });
    }
  }
  return targets;
}
export function sameTarget(entity, target) {
  return entity.placement?.kind === target.kind && (target.kind === 'surface' ? entity.attachedTo === target.hostId && entity.placement.surfaceId === target.surface.id : entity.placement?.regionId === target.placement.regionId || target.regionIds?.includes(entity.placement?.regionId));
}
/** Visible support boundaries, only where this item can actually fit. */
export function getPlacementGuides(scene, entity, getAsset) {
  return getPlacementTargets(scene, entity, getAsset)
    .filter(target => (scene.placementMode === 'room' || target.kind === 'surface') &&
      legalContactPolygon(scene, entity, target, getAsset).length > 0)
    .map(target => ({ ...target, active: sameTarget(entity, target) }));
}
export function usesPlacementDrag(scene, entity, getAsset) {
  return Boolean(entity && entity.kind !== 'bubble' && (entity.placement?.kind === 'surface' ||
    (!entity.attachedTo && (scene.placementMode === 'room' && entity.placement?.kind !== 'free' || placementRules(entity, getAsset)?.allowedTargets.includes('surface')))));
}
export function legalContactPolygon(scene, entity, target, getAsset) {
  const b = getEntityBounds(entity, getAsset);
  const f = placementRules(entity, getAsset)?.contactFootprint || { width: .1, depth: .02 };
  let polygon;
  if (target.kind === 'wall') {
    // Wall decor fits the complete visible rectangle. Shift its center back to the contact anchor.
    const cx = (0.5 - b.anchorX) * b.width * (entity.flipped ? -1 : 1), cy = (0.5 - b.anchorY) * b.height;
    polygon = insetPolygon(target.polygon, b.width / 2, b.height / 2).map(([x, y]) => [x - cx, y - cy]);
  } else polygon = insetPolygon(target.polygon, b.width * f.width / 2, b.height * f.depth / 2);
  const group = [entity, ...getAttachedDescendants(scene, entity.instanceId)];
  for (const e of group) {
    const eb = getEntityBounds(e, getAsset), ax = e.flipped ? 1 - eb.anchorX : eb.anchorX;
    const dx = e.x - entity.x, dy = e.y - entity.y;
    polygon = clipPolygon(polygon, 1, 0, eb.width * ax - dx);
    polygon = clipPolygon(polygon, -1, 0, -((scene.stageWidth || 1600) - eb.width * (1 - ax) - dx));
    polygon = clipPolygon(polygon, 0, 1, eb.height * eb.anchorY - dy);
    polygon = clipPolygon(polygon, 0, -1, -(900 - eb.height * (1 - eb.anchorY) - dy));
  }
  return polygon;
}
export function resolvePlacement(scene, entity, point, getAsset, { target = null, transfer = false, snapDistance = 16, releaseDistance = 24, currentTarget = null } = {}) {
  const options = getPlacementTargets(scene, entity, getAsset).filter(t => !target || (t.kind === target.kind && (t.kind === 'surface' ? t.hostId === target.hostId && t.surface.id === target.surfaceId : t.placement.regionId === target.regionId || t.regionIds?.includes(target.regionId))));
  const candidates = options.map(t => { const p = nearestPoint(legalContactPolygon(scene, entity, t, getAsset), point); return p ? { ...t, point: p, distance: Math.hypot(point.x - p.x, point.y - p.y) } : null; }).filter(Boolean);
  if (target) return candidates.sort((a, b) => a.distance - b.distance)[0] || null;
  const current = candidates.find(t => sameTarget(entity, t));
  if (!transfer && current) return current;
  if (transfer) {
    const isCurrent = t => currentTarget ? t.kind === 'surface' && t.hostId === currentTarget.hostId && t.surface.id === currentTarget.surfaceId : sameTarget(entity, t);
    const supports = candidates.filter(t => t.kind === 'surface' && t.distance <= (isCurrent(t) ? releaseDistance : snapDistance));
    supports.sort((a, b) => Number(isCurrent(b)) - Number(isCurrent(a)) || a.distance - b.distance || scene.entities.find(e => e.instanceId === b.hostId).y - scene.entities.find(e => e.instanceId === a.hostId).y || a.hostId.localeCompare(b.hostId) || a.surface.id.localeCompare(b.surface.id));
    if (supports.length) return supports[0];
    if (scene.placementMode === 'free') return {
      kind: 'free', hostId: null, placement: { kind: 'free', reason: 'legacy' },
      point: clampCompoundEntityPoint(point.x, point.y, scene, entity.instanceId, getAsset)
    };
  }
  return candidates.filter(t => t.kind !== 'surface').sort((a, b) => a.distance - b.distance || a.placement.regionId.localeCompare(b.placement.regionId))[0] || null;
}
export function applyPlacement(scene, instanceId, candidate) {
  const root = scene.entities.find(e => e.instanceId === instanceId);
  if (!root || root.pinned || !candidate) return scene;
  const host = candidate.hostId ? scene.entities.find(e => e.instanceId === candidate.hostId) : null;
  const point = candidate.point;
  const placement = candidate.kind === 'surface' ? { ...candidate.placement, localPoint: candidate.localPoint } : candidate.placement;
  const descendants = new Set(getAttachedDescendants(scene, instanceId).map(e => e.instanceId));
  const entities = scene.entities.map(e => e === root ? { ...e, ...point, placement, attachedTo: host?.instanceId || null, attachOffset: host ? { dx: point.x - host.x, dy: point.y - host.y } : null, attachJoint: 'root' } : descendants.has(e.instanceId) ? { ...e, x: e.x + point.x - root.x, y: e.y + point.y - root.y } : e);
  if (JSON.stringify(entities) === JSON.stringify(scene.entities)) return scene;
  return { ...scene, entities, updatedAt: new Date().toISOString() };
}
export function placeEntity(scene, instanceId, point, getAsset, options = {}) {
  const entity = scene.entities.find(e => e.instanceId === instanceId);
  if (!entity || entity.pinned) return scene;
  const candidate = resolvePlacement(scene, entity, point, getAsset, options);
  if (!candidate) return scene;
  if (candidate.kind === 'surface') candidate.localPoint = unprojectLocal(scene.entities.find(e => e.instanceId === candidate.hostId), candidate.point, getAsset);
  return applyPlacement(scene, instanceId, candidate);
}
export function recoverSurfacePlacements(scene, getAsset, warnings = [], affectedIds = null) {
  const entities = scene.entities.map(e => ({ ...e }));
  const before = new Map(scene.entities.map(e => [e.instanceId, e]));
  const byId = new Map(entities.map(e => [e.instanceId, e]));
  const depth = e => { let n = 0, parent = e.attachedTo; const visited = new Set([e.instanceId]); while (parent && !visited.has(parent)) { visited.add(parent); n++; parent = byId.get(parent)?.attachedTo; } return n; };
  for (const e of [...entities].sort((a, b) => depth(a) - depth(b))) {
    if (affectedIds && !affectedIds.has(e.instanceId)) continue;
    if (e.attachedTo && e.placement?.kind !== 'surface') {
      const parent = byId.get(e.attachedTo), oldParent = before.get(e.attachedTo);
      if (parent && oldParent) { e.x += parent.x - oldParent.x; e.y += parent.y - oldParent.y; }
    }
    if (e.placement?.kind !== 'surface') {
      if (scene.placementMode === 'room' && ['floor','wall'].includes(e.placement?.kind)) {
        const target = getPlacementTargets({ ...scene, entities }, e, getAsset).find(t => sameTarget(e, t));
        const point = target && nearestPoint(legalContactPolygon({ ...scene, entities }, e, target, getAsset), e);
        if (!point || Math.hypot(point.x-e.x, point.y-e.y) > .01) { e.placement = { kind: 'free', reason: 'no-valid-target' }; warnings.push('A room placement is unavailable; the item was preserved in place.'); }
        else e.placement = { ...target.placement };
      }
      continue;
    }
    const currentScene = { ...scene, entities };
    const host = entities.find(h => h.instanceId === e.attachedTo);
    const target = getPlacementTargets(currentScene, e, getAsset).find(t => sameTarget(e, t));
    const point = host && e.placement.localPoint ? projectLocal(host, e.placement.localPoint, getAsset) : null;
    const nearest = target && point ? nearestPoint(legalContactPolygon(currentScene, e, target, getAsset), point) : null;
    if (!nearest || Math.hypot(nearest.x - point.x, nearest.y - point.y) > .01) {
      e.placement = { kind: 'free', reason: 'support-missing' }; e.attachedTo = null; e.attachOffset = null;
      warnings.push('A furniture support is unavailable; the item was preserved in place.');
    } else { e.x = point.x; e.y = point.y; e.attachOffset = { dx: point.x - host.x, dy: point.y - host.y }; }
  }
  return { ...scene, entities };
}
export function setPlacementMode(scene, mode, getAsset) {
  if (!['room', 'free'].includes(mode) || mode === scene.placementMode || (mode === 'room' && !getPlacementRegions(scene, getAsset).length)) return scene;
  let next = { ...scene, placementMode: mode };
  if (mode === 'room') {
    for (const entity of next.entities) {
      if (entity.placement?.kind === 'surface' || entity.attachedTo || entity.kind === 'bubble') continue;
      const candidate = resolvePlacement(next, entity, entity, getAsset);
      if (candidate) {
        // Conversion may move pinned fixtures, without unlocking them.
        const pinned = entity.pinned;
        next = { ...next, entities: next.entities.map(e => e.instanceId === entity.instanceId ? { ...e, pinned: false } : e) };
        next = placeEntity(next, entity.instanceId, entity, getAsset);
        if (pinned) next = { ...next, entities: next.entities.map(e => e.instanceId === entity.instanceId ? { ...e, pinned } : e) };
      } else next = { ...next, entities: next.entities.map(e => e.instanceId === entity.instanceId ? { ...e, placement: { kind: 'free', reason: placementRules(e, getAsset) ? 'no-valid-target' : 'unclassified' } } : e) };
    }
  }
  return { ...next, updatedAt: new Date().toISOString() };
}
export function orderedSceneEntities(scene, getAsset) {
  if (scene.placementMode !== 'room' || scene.layerOrderMode === 'manual') return [...scene.entities].sort((a, b) => a.order - b.order);
  const roots = scene.entities.filter(e => !e.attachedTo && e.kind !== 'bubble');
  const band = e => e.kind === 'bubble' || e.placement?.kind === 'free' || !e.placement ? 3 : e.placement.kind === 'wall' ? 0 : placementRules(e, getAsset)?.renderClass === 'ground' ? 1 : 2;
  roots.sort((a, b) => band(a) - band(b) || (band(a) === 2 ? a.y - b.y : 0) || a.order - b.order || a.instanceId.localeCompare(b.instanceId));
  const result = [], visited = new Set();
  const visit = e => {
    if (visited.has(e.instanceId)) return;
    visited.add(e.instanceId); result.push(e);
    const children = scene.entities.filter(c => c.attachedTo === e.instanceId && c.kind !== 'bubble')
      .sort((a, b) => a.order - b.order || a.instanceId.localeCompare(b.instanceId));
    const supported = children.filter(c => c.placement?.kind === 'surface')
      .sort((a, b) => a.placement.localPoint.y - b.placement.localPoint.y || a.order - b.order || a.instanceId.localeCompare(b.instanceId));
    // Retain generic attachment slots while ordering supported siblings by depth.
    let surfaceIndex = 0;
    children.forEach(c => visit(c.placement?.kind === 'surface' ? supported[surfaceIndex++] : c));
  };
  roots.forEach(visit);
  scene.entities.filter(e => e.kind !== 'bubble').forEach(visit);
  scene.entities.filter(e => e.kind === 'bubble').sort((a, b) => a.order - b.order).forEach(visit);
  return result;
}

export function changePlacementBackground(scene, backgroundId, getAsset) {
  const next = { ...scene, backgroundId };
  if (!getPlacementRegions(next, getAsset).length) return { ...next, placementMode: 'free' };
  return setPlacementMode({ ...next, placementMode: 'free' }, 'room', getAsset);
}
export function placementChangeCounts(before, after) {
  return { moved: after.entities.filter(e => { const old = before.entities.find(o => o.instanceId === e.instanceId); return old && (e.x !== old.x || e.y !== old.y); }).length, unsupported: after.entities.filter(e => e.placement?.kind === 'free').length };
}
