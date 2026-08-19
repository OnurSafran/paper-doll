import { INK, R, ridge, rng, star4, svg, wrap } from './lib.mjs';
import { broadleaf, mushroom, pine, pineFlat, tuft } from './trees.mjs';

const W = 1600;
const H = 900;

export default function forest() {
  const out = [];
  const rand = rng(20260819);

  // Night sky, layered rather than gradient-filled.
  out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#24313f" stroke="none"/>`);
  out.push(`<rect x="0" y="330" width="${W}" height="140" fill="#2b3a4a" stroke="none"/>`);
  out.push(`<rect x="0" y="440" width="${W}" height="130" fill="#3a5063" stroke="none"/>`);

  // Crescent paper moon.
  out.push(`<circle cx="1240" cy="150" r="76" fill="#ffe9a8" stroke="${INK}" stroke-width="5"/>`);
  out.push(`<circle cx="1284" cy="118" r="66" fill="#2b3a4a" stroke="none"/>`);

  // Stars, wrapped so none is cut in half at a seam.
  const stars = [];
  for (let i = 0; i < 26; i += 1) {
    const x = rand() * W;
    const y = 40 + rand() * 340;
    if (Math.hypot(x - 1240, y - 150) < 150) continue;
    const r = 3 + rand() * 4;
    stars.push(wrap(x, W, 24, (px) => `<circle cx="${R(px)}" cy="${R(y)}" r="${R(r)}" fill="#fff4cf"/>`));
  }
  out.push(`<g stroke="none">${stars.join('')}</g>`);
  out.push(`<g stroke="none">${[180, 640, 1090, 1470].map((x, i) => wrap(x, W, 30, (px) => star4(px, 90 + i * 55, 16 - i * 2, '#cfe8ff'))).join('')}</g>`);

  // Far ridge of silhouetted conifers, their feet buried by the next ridge.
  const far = [];
  for (let x = -40; x < W + 40; x += 74) {
    const jitter = (rand() - 0.5) * 26;
    far.push(pineFlat(x + jitter, 585, 120 + rand() * 70, '#2f4a52'));
  }
  out.push(`<g stroke="none">${far.join('')}</g>`);
  out.push(ridge(575, 535, 4, '#33544f'));

  // Midground conifers, now with real trunks.
  const midPines = [70, 250, 430, 800, 980, 1310, 1600];
  out.push(midPines.map((x, i) => wrap(x, W, 110, (px) => pine(px, 690, 250 + (i % 3) * 42, {
    bark: '#5c4130', dark: '#2f5b45', mid: '#3a6d51', light: '#48815d'
  }))).join(''));
  out.push(ridge(680, 640, 4, '#41695d'));

  // Foreground pair of round-canopy trees; one deliberately straddles the tile seam.
  out.push(wrap(0, W, 200, (px) => broadleaf(px, 800, 400, {
    bark: '#6b4b34', canopy: '#4a7c59', canopyDark: '#3c6a4b', canopyLight: '#5d9468'
  })));
  out.push(broadleaf(620, 790, 340, {
    bark: '#6b4b34', canopy: '#52886a', canopyDark: '#3f6f57', canopyLight: '#65a07d'
  }));
  out.push(broadleaf(1150, 800, 375, {
    bark: '#6b4b34', canopy: '#4a7c59', canopyDark: '#3c6a4b', canopyLight: '#5d9468'
  }));
  out.push(ridge(790, 758, 4, '#54866a'));

  // Front bank: ferns, toadstools and fireflies.
  out.push(ridge(848, 826, 4, '#6d9b65'));
  const ferns = [];
  for (let i = 0; i < 22; i += 1) {
    const x = rand() * W;
    ferns.push(wrap(x, W, 40, (px) => tuft(px, 830 + rand() * 50, 34 + rand() * 22, '#3f6f4a')));
  }
  out.push(`<g>${ferns.join('')}</g>`);

  out.push(wrap(120, W, 80, (px) => mushroom(px, 848, 62, '#ef476f')));
  out.push(wrap(196, W, 80, (px) => mushroom(px, 858, 40, '#ffd166')));
  out.push(wrap(880, W, 80, (px) => mushroom(px, 852, 54, '#9d4edd')));
  out.push(wrap(1420, W, 80, (px) => mushroom(px, 845, 58, '#ef476f')));
  out.push(wrap(1490, W, 80, (px) => mushroom(px, 856, 36, '#ffd166')));

  const flies = [[320, 700, 9], [520, 660, 10], [740, 720, 8], [1000, 675, 10], [1300, 715, 9], [1540, 668, 8]];
  out.push(flies.map(([x, y, r]) => wrap(x, W, 30, (px) => `<circle cx="${R(px)}" cy="${y}" r="${r}" fill="#ffef5a" stroke="${INK}" stroke-width="3"/>`)).join(''));

  return svg('bg_forest', W, H, `  <g id="background" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    ${out.join('\n    ')}
  </g>`);
}
