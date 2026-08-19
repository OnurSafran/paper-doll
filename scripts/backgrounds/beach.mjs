import { INK, R, ridge, rng, svg, wave, wrap } from './lib.mjs';

const W = 1600;
const H = 900;

/** Palm: curved trunk with ring texture, fronds fanning from the crown. */
function palm(cx, baseY, h, lean = 1) {
  const topX = cx + 74 * lean;
  const topY = baseY - h;
  const midX = cx + 10 * lean;
  const midY = baseY - h * 0.5;
  const spine = `M${R(cx)} ${R(baseY)}Q${R(midX)} ${R(midY)} ${R(topX)} ${R(topY)}`;
  const rings = [];
  for (let i = 1; i <= 7; i += 1) {
    const t = i / 8;
    const x = (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * midX + t * t * topX;
    const y = (1 - t) * (1 - t) * baseY + 2 * (1 - t) * t * midY + t * t * topY;
    rings.push(`<path d="M${R(x - 16 + t * 5)} ${R(y)}q${R(16 - t * 5)} 9 ${R(32 - t * 10)} 0" fill="none" stroke="#7d5334" stroke-width="4" stroke-linecap="round"/>`);
  }
  const frond = (dx, dy, cxo, cyo, fill) => `<path d="M${R(topX)} ${R(topY)}Q${R(topX + cxo)} ${R(topY + cyo)} ${R(topX + dx)} ${R(topY + dy)}Q${R(topX + cxo * 0.7)} ${R(topY + cyo + 34)} ${R(topX)} ${R(topY + 12)}Z" fill="${fill}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`;
  return [
    `<path d="${spine}" fill="none" stroke="${INK}" stroke-width="34" stroke-linecap="round"/>`,
    `<path d="${spine}" fill="none" stroke="#9a6b45" stroke-width="24" stroke-linecap="round"/>`,
    rings.join(''),
    frond(-190, 16, -100, -70, '#4f8f5f'),
    frond(190, 22, 100, -74, '#5fa46d'),
    frond(-140, 116, -130, 26, '#3f7c51'),
    frond(150, 110, 138, 20, '#4f8f5f'),
    frond(-24, -104, -80, -108, '#5fa46d'),
    `<circle cx="${R(topX - 20)}" cy="${R(topY + 20)}" r="13" fill="#8a5a3b" stroke="${INK}" stroke-width="4"/>`,
    `<circle cx="${R(topX + 14)}" cy="${R(topY + 28)}" r="12" fill="#8a5a3b" stroke="${INK}" stroke-width="4"/>`
  ].join('');
}

export default function beach() {
  const out = [];
  const rand = rng(31415);

  out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#dff1fa" stroke="none"/>`);
  out.push(`<rect x="0" y="0" width="${W}" height="250" fill="#bfe4f5" stroke="none"/>`);
  out.push(`<rect x="0" y="230" width="${W}" height="160" fill="#ddf0f7" stroke="none"/>`);

  out.push(`<circle cx="1180" cy="140" r="78" fill="#ffd166" stroke="${INK}" stroke-width="5"/>`);
  out.push(`<circle cx="1180" cy="140" r="60" fill="#ffe9a8" stroke="none"/>`);

  const puff = (cx, cy, s) => `<path d="M${R(cx - 96 * s)} ${R(cy)}q${R(-24 * s)} ${R(-30 * s)} ${R(12 * s)} ${R(-38 * s)}q${R(10 * s)} ${R(-34 * s)} ${R(56 * s)} ${R(-22 * s)}q${R(28 * s)} ${R(-30 * s)} ${R(64 * s)} 0q${R(42 * s)} ${R(-2 * s)} ${R(40 * s)} ${R(36 * s)}q${R(32 * s)} ${R(8 * s)} ${R(14 * s)} ${R(24 * s)}Z" fill="#ffffff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
  out.push([[300, 160, 1], [780, 110, 0.75], [1520, 190, 0.85]].map(([x, y, s]) => wrap(x, W, 170 * s, (px) => puff(px, y, s))).join(''));

  // Sea. Horizon is a straight full-width edge, so it always lines up across tiles.
  out.push(`<rect x="0" y="400" width="${W}" height="240" fill="#3f95c8" stroke="none"/>`);
  out.push(`<line x1="0" y1="400" x2="${W}" y2="400" stroke="${INK}" stroke-width="5"/>`);

  // Sailboat, safely away from both edges.
  out.push(`<g transform="translate(940 300)"><path d="M40 0 40 96 4 96Z" fill="#ffffff" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M50 22 50 96 92 96Z" fill="#ef476f" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><line x1="44" y1="0" x2="44" y2="104" stroke="${INK}" stroke-width="5"/><path d="M-2 100q48 18 100 0l-14 26q-38 12 -74 0Z" fill="#9a6b45" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/></g>`);

  out.push(`<path d="${wave(462, 444, 4)}" fill="none" stroke="#63b7dd" stroke-width="10" stroke-linecap="butt"/>`);
  out.push(`<path d="${wave(516, 500, 6)}" fill="none" stroke="#7fcbe8" stroke-width="10" stroke-linecap="butt"/>`);
  out.push(ridge(560, 540, 4, '#5cc8e0'));
  out.push(ridge(620, 600, 4, '#8fe3e0'));

  // Foam line where the sea meets the sand.
  out.push(ridge(668, 646, 4, '#e8fbfd'));
  out.push(`<path d="${wave(690, 668, 4)}" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="butt"/>`);

  // Sand.
  out.push(ridge(716, 694, 4, '#fbe0b4'));
  out.push(`<path d="${wave(790, 776, 4)}" fill="none" stroke="#eccd9c" stroke-width="6" stroke-linecap="butt"/>`);
  out.push(`<path d="${wave(858, 846, 4)}" fill="none" stroke="#eccd9c" stroke-width="6" stroke-linecap="butt"/>`);

  // Palms — one anchored on the seam so its trunk continues onto the next tile.
  out.push(wrap(0, W, 300, (px) => palm(px, 792, 420, 1)));
  out.push(palm(1420, 806, 350, -1));

  // Shells, starfish and pebbles scattered on the sand.
  const shell = (cx, cy) => `<g><path d="M${R(cx - 30)} ${R(cy + 14)}a30 26 0 0 1 60 0Z" fill="#f7cf9c" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M${R(cx)} ${R(cy + 14)} ${R(cx)} ${R(cy - 12)}M${R(cx - 15)} ${R(cy + 14)} ${R(cx - 8)} ${R(cy - 8)}M${R(cx + 15)} ${R(cy + 14)} ${R(cx + 8)} ${R(cy - 8)}" fill="none" stroke="#b98a55" stroke-width="3"/></g>`;
  const starfish = (cx, cy, fill) => {
    const pts = [];
    for (let i = 0; i < 10; i += 1) {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const r = i % 2 === 0 ? 28 : 12;
      pts.push(`${R(cx + Math.cos(a) * r)} ${R(cy + Math.sin(a) * r)}`);
    }
    return `<path d="M${pts.join('L')}Z" fill="${fill}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
  };
  out.push(wrap(240, W, 60, (px) => starfish(px, 800, '#ef476f')));
  out.push(wrap(1560, W, 60, (px) => starfish(px, 866, '#f4845f')));
  out.push(wrap(660, W, 60, (px) => shell(px, 826)));
  out.push(wrap(1120, W, 60, (px) => shell(px, 872)));
  const pebbles = [];
  for (let i = 0; i < 14; i += 1) {
    const x = rand() * W;
    const y = 730 + rand() * 155;
    pebbles.push(wrap(x, W, 26, (px) => `<ellipse cx="${R(px)}" cy="${R(y)}" rx="${R(7 + rand() * 6)}" ry="${R(5 + rand() * 4)}" fill="#e6c99a" stroke="none"/>`));
  }
  out.push(pebbles.join(''));

  return svg('bg_beach', W, H, `  <g id="background" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    ${out.join('\n    ')}
  </g>`);
}
