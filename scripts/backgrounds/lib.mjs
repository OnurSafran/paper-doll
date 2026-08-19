// Shared helpers for authoring seamless paper-craft backgrounds.
export const INK = '#2d261e';
export const R = (n) => Math.round(n * 100) / 100;

/**
 * Horizontal wave whose tangent is flat at every node, so a tile's right edge
 * meets the next tile's left edge with identical y and identical slope.
 * `segs` must be even so the curve ends back on `a`.
 */
export function wave(a, b, segs, w = 1600) {
  if (segs % 2 !== 0) throw new Error('wave: segs must be even to stay seamless');
  const span = w / segs;
  const k = span / 3;
  let d = `M0 ${R(a)}`;
  for (let i = 0; i < segs; i += 1) {
    const xa = i * span;
    const xb = xa + span;
    const from = i % 2 === 0 ? a : b;
    const to = i % 2 === 0 ? b : a;
    d += `C${R(xa + k)} ${R(from)} ${R(xb - k)} ${R(to)} ${R(xb)} ${R(to)}`;
  }
  return d;
}

/** Same wave closed down to the bottom edge, for the filled land mass. */
export function band(a, b, segs, w = 1600, h = 900) {
  return `${wave(a, b, segs, w)}L${w} ${h}L0 ${h}Z`;
}

/** Filled land + a separate butt-capped contour so no vertical stroke lands on the seam. */
export function ridge(a, b, segs, fill, { w = 1600, h = 900, stroke = INK, width = 5 } = {}) {
  return `<path d="${band(a, b, segs, w, h)}" fill="${fill}" stroke="none"/>
    <path d="${wave(a, b, segs, w)}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="butt"/>`;
}

/** Deterministic PRNG so regenerating the art never reshuffles it. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Draw at x, plus a wrapped copy when the shape would be clipped by a tile edge,
 * so the halves rejoin across the seam.
 */
export function wrap(x, w, margin, draw) {
  const out = [draw(x)];
  if (x < margin) out.push(draw(x + w));
  if (x > w - margin) out.push(draw(x - w));
  return out.join('\n');
}

export function svg(id, w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" data-asset-id="${id}">
${body}
</svg>
`;
}

/** Tapered trunk with a flared base — the shape the old triangle-only trees were missing. */
export function trunk(cx, baseY, height, baseWidth, topWidth, fill = '#7a563c', stroke = INK, width = 5) {
  const b = baseWidth / 2;
  const t = topWidth / 2;
  const topY = baseY - height;
  const midY = baseY - height * 0.45;
  return `<path d="M${R(cx - b)} ${R(baseY)}Q${R(cx - t * 1.35)} ${R(midY)} ${R(cx - t)} ${R(topY)}L${R(cx + t)} ${R(topY)}Q${R(cx + t * 1.35)} ${R(midY)} ${R(cx + b)} ${R(baseY)}Z" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"/>`;
}

export function star4(cx, cy, r, fill) {
  const a = r * 0.32;
  return `<path d="M${R(cx)} ${R(cy - r)}L${R(cx + a)} ${R(cy - a)}L${R(cx + r)} ${R(cy)}L${R(cx + a)} ${R(cy + a)}L${R(cx)} ${R(cy + r)}L${R(cx - a)} ${R(cy + a)}L${R(cx - r)} ${R(cy)}L${R(cx - a)} ${R(cy - a)}Z" fill="${fill}"/>`;
}

/**
 * Evaluate `wave` at x. The x control points are evenly spaced, so x is linear
 * in t and each segment reduces to a smoothstep between the two node heights.
 */
export function waveY(a, b, segs, x, w = 1600) {
  const span = w / segs;
  const i = Math.min(segs - 1, Math.max(0, Math.floor(x / span)));
  const t = (x - i * span) / span;
  const from = i % 2 === 0 ? a : b;
  const to = i % 2 === 0 ? b : a;
  return from + (to - from) * (t * t * (3 - 2 * t));
}
