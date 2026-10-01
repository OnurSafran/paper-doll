import { hasValidDisplayName, normalizeDisplayName } from '../core/text.js';
import { PLACEMENT_TARGETS, FREE_PLACEMENT_REASONS, SURFACE_PRESETS, PLACEMENT_LIMITS } from './placement-vocabulary.js';

const EPS = 1e-7;
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
export function validPolygon(points, normalized = true) {
  if (!Array.isArray(points) || points.length < 3 || points.length > PLACEMENT_LIMITS.vertices) return false;
  if (!points.every(p => Array.isArray(p) && p.length === 2 && p.every(n => Number.isFinite(n) && (!normalized || (n >= 0 && n <= 1))))) return false;
  let sign = 0;
  for (let i = 0; i < points.length; i++) {
    const c = cross(points[i], points[(i + 1) % points.length], points[(i + 2) % points.length]);
    if (Math.abs(c) <= EPS) return false;
    if (sign && Math.sign(c) !== sign) return false;
    sign = Math.sign(c);
  }
  // Convex local turns alone do not exclude a self-intersecting star.
  return points.every((a, i) => points.every(p => sign * cross(a, points[(i + 1) % points.length], p) >= -EPS));
}
export function sanitizePlacementRules(raw) {
  if (!raw || !Array.isArray(raw.allowedTargets) || !raw.allowedTargets.length || !raw.allowedTargets.every(t => PLACEMENT_TARGETS.includes(t))) return null;
  const f = raw.contactFootprint;
  if (!f || ![f.width, f.depth].every(n => Number.isFinite(n) && n > 0 && n <= 1)) return null;
  if (!Array.isArray(raw.tags) || raw.tags.length > 8 || !raw.tags.every(t => typeof t === 'string' && /^[a-z][a-z0-9-]{0,29}$/.test(t))) return null;
  return { allowedTargets: [...new Set(raw.allowedTargets)], tags: [...new Set(raw.tags)], contactFootprint: { width: f.width, depth: f.depth }, renderClass: raw.renderClass === 'ground' ? 'ground' : 'upright' };
}
export function sanitizeSurfaces(raw) {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > PLACEMENT_LIMITS.surfaces) return null;
  const ids = new Set();
  const result = [];
  for (const s of raw) {
    if (!s || typeof s.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(s.id) || ids.has(s.id) || !validPolygon(s.polygon)) return null;
    if (!Array.isArray(s.acceptsTags) || !s.acceptsTags.length || s.acceptsTags.length > 8 || !s.acceptsTags.every(t => typeof t === 'string' && /^[a-z][a-z0-9-]{0,29}$/.test(t))) return null;
    if (s.name != null && !hasValidDisplayName(s.name, 30)) return null;
    ids.add(s.id);
    result.push({ id: s.id, ...(s.name ? { name: normalizeDisplayName(s.name, 30) } : {}), ...(typeof s.nameKey === 'string' && s.nameKey.length < 80 ? { nameKey: s.nameKey } : {}), ...(SURFACE_PRESETS.includes(s.authoringPreset) ? { authoringPreset: s.authoringPreset } : {}), polygon: s.polygon.map(p => [...p]), acceptsTags: [...s.acceptsTags] });
  }
  return result;
}
export function sanitizePlacement(raw) {
  if (!raw) return undefined;
  if (raw.kind === 'free') return { kind: 'free', reason: FREE_PLACEMENT_REASONS.includes(raw.reason) ? raw.reason : 'legacy' };
  if (['floor', 'wall'].includes(raw.kind) && typeof raw.regionId === 'string' && raw.regionId.length <= 100) return { kind: raw.kind, regionId: raw.regionId };
  if (raw.kind === 'surface' && typeof raw.surfaceId === 'string' && raw.surfaceId.length <= 80 && [raw.localPoint?.x, raw.localPoint?.y].every(n => Number.isFinite(n) && n >= 0 && n <= 1)) return { kind: 'surface', surfaceId: raw.surfaceId, localPoint: { ...raw.localPoint } };
  return { kind: 'free', reason: 'support-missing' };
}
export function surfacePreset(preset, x, y, width, depth, rearWidth = .7) {
  if (preset === 'oval') return Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8; return [x + width / 2 + Math.cos(a) * width / 2, y + depth / 2 + Math.sin(a) * depth / 2]; });
  if (preset === 'trapezoid') return [[x + width * (1 - rearWidth) / 2, y], [x + width * (1 + rearWidth) / 2, y], [x + width, y + depth], [x, y + depth]];
  return [[x, y], [x + width, y], [x + width, y + depth], [x, y + depth]];
}

/** Clip a convex polygon to n.x*x + n.y*y >= limit. */
export function clipPolygon(polygon, nx, ny, limit) {
  const output = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const da = nx * a[0] + ny * a[1] - limit, db = nx * b[0] + ny * b[1] - limit;
    if (da >= -EPS) output.push(a);
    if ((da < -EPS) !== (db < -EPS)) { const t = da / (da - db); output.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return output;
}
/** Legal contact centers: inset every edge by the rectangular footprint. */
export function insetPolygon(polygon, halfWidth, halfDepth) {
  const sign = Math.sign(cross(polygon[0], polygon[1], polygon[2]));
  let result = polygon;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const nx = -sign * (b[1] - a[1]), ny = sign * (b[0] - a[0]);
    result = clipPolygon(result, nx, ny, nx * a[0] + ny * a[1] + Math.abs(nx) * halfWidth + Math.abs(ny) * halfDepth);
  }
  return result;
}
export function nearestPoint(polygon, point) {
  if (!polygon.length) return null;
  const sign = polygon.length > 2 ? Math.sign(cross(polygon[0], polygon[1], polygon[2])) : 0;
  if (sign && polygon.every((a, i) => sign * cross(a, polygon[(i + 1) % polygon.length], [point.x, point.y]) >= -EPS)) return { ...point };
  let best = null, distance = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((point.x - a[0]) * dx + (point.y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    const p = { x: a[0] + t * dx, y: a[1] + t * dy };
    const d = Math.hypot(p.x - point.x, p.y - point.y);
    if (d < distance) { best = p; distance = d; }
  }
  return best;
}
