import { INK, R, ridge, rng, svg, wave, wrap } from './lib.mjs';
import { broadleaf, tuft } from './trees.mjs';

const W = 1600;
const H = 900;

const cloud = (cx, cy, s) => `<path d="M${R(cx - 90 * s)} ${R(cy)}q${R(-26 * s)} ${R(-30 * s)} ${R(10 * s)} ${R(-40 * s)}q${R(6 * s)} ${R(-34 * s)} ${R(52 * s)} ${R(-24 * s)}q${R(26 * s)} ${R(-32 * s)} ${R(62 * s)} ${R(-2 * s)}q${R(44 * s)} ${R(-6 * s)} ${R(44 * s)} ${R(34 * s)}q${R(34 * s)} ${R(6 * s)} ${R(18 * s)} ${R(34 * s)}Z" fill="#ffffff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;

const flower = (cx, cy, petal) => `<g stroke="none"><circle cx="${R(cx - 9)}" cy="${R(cy)}" r="7" fill="${petal}"/><circle cx="${R(cx + 9)}" cy="${R(cy)}" r="7" fill="${petal}"/><circle cx="${R(cx)}" cy="${R(cy - 9)}" r="7" fill="${petal}"/><circle cx="${R(cx)}" cy="${R(cy + 9)}" r="7" fill="${petal}"/><circle cx="${R(cx)}" cy="${R(cy)}" r="6" fill="#fff3c4"/></g>`;

export default function park() {
  const out = [];
  const rand = rng(770421);

  out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#dff3e6" stroke="none"/>`);
  out.push(`<rect x="0" y="0" width="${W}" height="380" fill="#c3e7f2" stroke="none"/>`);
  out.push(`<rect x="0" y="330" width="${W}" height="120" fill="#d5eee8" stroke="none"/>`);

  out.push(`<circle cx="1280" cy="140" r="72" fill="#ffe08a" stroke="${INK}" stroke-width="5"/>`);
  out.push(`<circle cx="1280" cy="140" r="54" fill="#fff2c2" stroke="none"/>`);

  out.push([[210, 130, 1], [700, 90, 0.8], [1030, 175, 0.65], [1560, 120, 0.9]]
    .map(([x, y, s]) => wrap(x, W, 160 * s, (px) => cloud(px, y, s))).join(''));

  // Birds.
  out.push(`<g fill="none" stroke="${INK}" stroke-width="4">${[[420, 200, 1], [470, 175, 0.75], [900, 235, 0.85]]
    .map(([x, y, s]) => wrap(x, W, 40, (px) => `<path d="M${R(px - 22 * s)} ${R(y)}q${R(11 * s)} ${R(-13 * s)} ${R(22 * s)} 0q${R(11 * s)} ${R(-13 * s)} ${R(22 * s)} 0"/>`)).join('')}</g>`);

  // Rolling hills, each contour butt-capped so the seam has no vertical stroke.
  out.push(ridge(470, 400, 2, '#9fd8b8'));
  out.push(ridge(560, 505, 4, '#7fc9a0'));

  // Tree line: the leftmost tree straddles the seam and rejoins on the next tile.
  out.push(wrap(0, W, 220, (px) => broadleaf(px, 690, 330, {
    bark: '#8b5e34', canopy: '#52b788', canopyDark: '#40916c', canopyLight: '#74d3a4'
  })));
  out.push(broadleaf(430, 700, 300, { bark: '#8b5e34', canopy: '#5cc49a', canopyDark: '#45a077', canopyLight: '#7ddcb2' }));
  out.push(broadleaf(1080, 695, 320, { bark: '#8b5e34', canopy: '#52b788', canopyDark: '#40916c', canopyLight: '#74d3a4' }));

  // Lawn.
  out.push(ridge(680, 640, 4, '#74c69d'));

  // Winding path, drawn with a seamless wave so it leaves and re-enters at the same height.
  out.push(`<path d="${wave(760, 735, 2)}" fill="none" stroke="#e6cfa6" stroke-width="72" stroke-linecap="butt"/>`);
  out.push(`<path d="${wave(760, 735, 2)}" fill="none" stroke="#d3b788" stroke-width="6" stroke-linecap="butt" opacity="0.7"/>`);

  out.push(ridge(858, 838, 4, '#8ed4ac'));

  const grass = [];
  for (let i = 0; i < 26; i += 1) {
    const x = rand() * W;
    grass.push(wrap(x, W, 40, (px) => tuft(px, 845 + rand() * 45, 26 + rand() * 18, '#3f9d76')));
  }
  out.push(`<g>${grass.join('')}</g>`);

  const petals = ['#ffb703', '#ef476f', '#b56576', '#ffd166'];
  const flowers = [];
  for (let i = 0; i < 16; i += 1) {
    const x = rand() * W;
    const y = 700 + rand() * 170;
    flowers.push(wrap(x, W, 24, (px) => flower(px, y, petals[i % petals.length])));
  }
  out.push(flowers.join(''));

  return svg('bg_park', W, H, `  <g id="background" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    ${out.join('\n    ')}
  </g>`);
}
