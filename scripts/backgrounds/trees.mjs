import { INK, R, trunk } from './lib.mjs';

/** Conifer: tapered trunk plus stacked, slightly drooping tiers. */
export function pine(cx, baseY, h, { bark = '#6b4b34', dark, mid, light, sw = 5 }) {
  const th = h * 0.24;
  const tw = h * 0.08;
  const parts = [trunk(cx, baseY, th + 16, tw * 1.9, tw * 1.2, bark, INK, sw)];
  const tiers = [
    { base: baseY - th, apex: baseY - h * 0.54, half: h * 0.35, fill: dark },
    { base: baseY - h * 0.36, apex: baseY - h * 0.77, half: h * 0.27, fill: mid },
    { base: baseY - h * 0.63, apex: baseY - h, half: h * 0.19, fill: light }
  ];
  for (const t of tiers) {
    parts.push(`<path d="M${R(cx)} ${R(t.apex)}L${R(cx + t.half)} ${R(t.base)}Q${R(cx)} ${R(t.base - h * 0.06)} ${R(cx - t.half)} ${R(t.base)}Z" fill="${t.fill}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`);
  }
  return parts.join('');
}

/** Flat silhouette conifer for distant ridges — still trunked, just unoutlined. */
export function pineFlat(cx, baseY, h, fill) {
  const half = h * 0.3;
  return `<path d="M${R(cx - h * 0.045)} ${R(baseY)}L${R(cx - h * 0.03)} ${R(baseY - h * 0.22)}L${R(cx + h * 0.03)} ${R(baseY - h * 0.22)}L${R(cx + h * 0.045)} ${R(baseY)}Z" fill="${fill}"/>`
    + `<path d="M${R(cx)} ${R(baseY - h)}L${R(cx + half)} ${R(baseY - h * 0.18)}L${R(cx - half)} ${R(baseY - h * 0.18)}Z" fill="${fill}"/>`
    + `<path d="M${R(cx)} ${R(baseY - h * 0.82)}L${R(cx + half * 0.78)} ${R(baseY - h * 0.42)}L${R(cx - half * 0.78)} ${R(baseY - h * 0.42)}Z" fill="${fill}"/>`;
}

/** Round-canopy tree: flared trunk, two forking branches, overlapping leaf clusters. */
export function broadleaf(cx, baseY, h, { bark = '#8b5e34', canopy, canopyDark, canopyLight, sw = 5 }) {
  const th = h * 0.46;
  const topY = baseY - th;
  const r = h * 0.3;
  return [
    trunk(cx, baseY, th, h * 0.13, h * 0.075, bark, INK, sw),
    `<path d="M${R(cx)} ${R(topY + h * 0.1)}L${R(cx - h * 0.16)} ${R(topY - h * 0.07)}M${R(cx)} ${R(topY + h * 0.16)}L${R(cx + h * 0.15)} ${R(topY - h * 0.04)}" fill="none" stroke="${bark}" stroke-width="${sw * 2.4}" stroke-linecap="round"/>`,
    `<path d="M${R(cx)} ${R(topY + h * 0.1)}L${R(cx - h * 0.16)} ${R(topY - h * 0.07)}M${R(cx)} ${R(topY + h * 0.16)}L${R(cx + h * 0.15)} ${R(topY - h * 0.04)}" fill="none" stroke="${INK}" stroke-width="${sw * 0.8}" stroke-linecap="round"/>`,
    `<circle cx="${R(cx - r * 0.72)}" cy="${R(topY - r * 0.18)}" r="${R(r * 0.72)}" fill="${canopyDark}" stroke="${INK}" stroke-width="${sw}"/>`,
    `<circle cx="${R(cx + r * 0.74)}" cy="${R(topY - r * 0.22)}" r="${R(r * 0.7)}" fill="${canopyDark}" stroke="${INK}" stroke-width="${sw}"/>`,
    `<circle cx="${R(cx)}" cy="${R(topY - r * 0.62)}" r="${R(r)}" fill="${canopy}" stroke="${INK}" stroke-width="${sw}"/>`,
    `<circle cx="${R(cx - r * 0.3)}" cy="${R(topY - r * 0.92)}" r="${R(r * 0.42)}" fill="${canopyLight}" stroke="none"/>`
  ].join('');
}

/** Grass tuft / fern frond. */
export function tuft(cx, baseY, h, fill, sw = 4) {
  return `<path d="M${R(cx)} ${R(baseY)}Q${R(cx - h * 0.5)} ${R(baseY - h * 0.6)} ${R(cx - h * 0.62)} ${R(baseY - h)}M${R(cx)} ${R(baseY)}L${R(cx)} ${R(baseY - h * 1.15)}M${R(cx)} ${R(baseY)}Q${R(cx + h * 0.5)} ${R(baseY - h * 0.6)} ${R(cx + h * 0.62)} ${R(baseY - h * 0.95)}" fill="none" stroke="${fill}" stroke-width="${sw}" stroke-linecap="round"/>`;
}

/** Spotted toadstool. */
export function mushroom(cx, baseY, h, cap, sw = 5) {
  const cw = h * 0.85;
  const capY = baseY - h * 0.55;
  return `<path d="M${R(cx - h * 0.17)} ${R(capY)}Q${R(cx - h * 0.22)} ${R(baseY)} ${R(cx - h * 0.26)} ${R(baseY)}L${R(cx + h * 0.26)} ${R(baseY)}Q${R(cx + h * 0.22)} ${R(baseY)} ${R(cx + h * 0.17)} ${R(capY)}Z" fill="#f2e8dc" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`
    + `<path d="M${R(cx - cw)} ${R(capY)}Q${R(cx)} ${R(capY - h * 0.95)} ${R(cx + cw)} ${R(capY)}Z" fill="${cap}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`
    + `<circle cx="${R(cx - cw * 0.42)}" cy="${R(capY - h * 0.2)}" r="${R(h * 0.14)}" fill="#fffaf2"/>`
    + `<circle cx="${R(cx + cw * 0.34)}" cy="${R(capY - h * 0.28)}" r="${R(h * 0.17)}" fill="#fffaf2"/>`
    + `<circle cx="${R(cx - cw * 0.02)}" cy="${R(capY - h * 0.5)}" r="${R(h * 0.12)}" fill="#fffaf2"/>`;
}
