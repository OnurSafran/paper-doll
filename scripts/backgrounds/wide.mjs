import { INK, R, ridge, rng, star4, svg, wave, waveY, wrap } from './lib.mjs';
import { broadleaf, pine, pineFlat, tuft } from './trees.mjs';

const H = 900;

/** Gabled cottage with lit windows and a chimney. */
function cottage(cx, baseY, w, h, { wall, roof, trim = '#f7efe2' }) {
  const hw = w / 2;
  const bodyTop = baseY - h;
  const roofPeak = bodyTop - h * 0.62;
  const win = (x, y, s) => `<rect x="${R(x - 17 * s)}" y="${R(y - 17 * s)}" width="${R(34 * s)}" height="${R(34 * s)}" rx="4" fill="#ffd166" stroke="${INK}" stroke-width="5"/><path d="M${R(x)} ${R(y - 17 * s)}v${R(34 * s)}M${R(x - 17 * s)} ${R(y)}h${R(34 * s)}" fill="none" stroke="${INK}" stroke-width="4"/>`;
  return [
    `<rect x="${R(cx - hw)}" y="${R(bodyTop)}" width="${R(w)}" height="${R(h)}" fill="${wall}" stroke="${INK}" stroke-width="5"/>`,
    `<rect x="${R(cx + hw * 0.42)}" y="${R(roofPeak - h * 0.34)}" width="${R(w * 0.14)}" height="${R(h * 0.62)}" fill="${roof}" stroke="${INK}" stroke-width="5"/>`,
    `<path d="M${R(cx - hw - w * 0.12)} ${R(bodyTop)}L${R(cx)} ${R(roofPeak)}L${R(cx + hw + w * 0.12)} ${R(bodyTop)}Z" fill="${roof}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`,
    win(cx - hw * 0.5, bodyTop + h * 0.34, w / 150),
    win(cx + hw * 0.5, bodyTop + h * 0.34, w / 150),
    `<path d="M${R(cx - w * 0.11)} ${R(baseY)}v${R(-h * 0.52)}q${R(w * 0.11)} ${R(-h * 0.2)} ${R(w * 0.22)} 0V${R(baseY)}Z" fill="${trim}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`,
    `<circle cx="${R(cx + w * 0.07)}" cy="${R(baseY - h * 0.24)}" r="5" fill="${INK}" stroke="none"/>`
  ].join('');
}

export function snowyVillage() {
  const W = 3200;
  const out = [];
  const rand = rng(1207);

  out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#2c3f60" stroke="none"/>`);
  out.push(`<rect x="0" y="220" width="${W}" height="200" fill="#3a5378" stroke="none"/>`);
  out.push(`<rect x="0" y="380" width="${W}" height="160" fill="#54719a" stroke="none"/>`);

  out.push(`<circle cx="2380" cy="150" r="84" fill="#fff4d2" stroke="${INK}" stroke-width="6"/>`);
  out.push(`<circle cx="2380" cy="150" r="62" fill="#fffaef" stroke="none"/>`);

  const stars = [];
  for (let i = 0; i < 44; i += 1) {
    const x = rand() * W;
    const y = 30 + rand() * 330;
    if (Math.hypot(x - 2380, y - 150) < 160) continue;
    stars.push(wrap(x, W, 24, (px) => `<circle cx="${R(px)}" cy="${R(y)}" r="${R(2.5 + rand() * 4)}" fill="#fff6dc"/>`));
  }
  out.push(`<g stroke="none">${stars.join('')}</g>`);
  out.push(`<g stroke="none">${[320, 1180, 1960, 2880].map((x, i) => wrap(x, W, 30, (px) => star4(px, 100 + i * 46, 17 - i * 2, '#dbeeff'))).join('')}</g>`);

  // Snow-capped ridges.
  out.push(ridge(560, 480, 4, '#41608a', { w: W }));
  out.push(ridge(600, 546, 6, '#63819f', { w: W }));

  const far = [];
  for (let x = -40; x < W + 40; x += 82) far.push(pineFlat(x + (rand() - 0.5) * 24, 640, 130 + rand() * 70, '#33506f'));
  out.push(`<g stroke="none">${far.join('')}</g>`);
  out.push(ridge(636, 596, 8, '#8fadc9', { w: W }));

  // Village row.
  const houses = [
    [220, '#f2d2c4', '#c1584f'], [620, '#d9e3f2', '#3f6f8f'], [1180, '#f6e2bd', '#a3563f'],
    [1760, '#e4d3ee', '#6b4f8f'], [2260, '#f2d2c4', '#c1584f'], [2860, '#d9e3f2', '#3f6f8f'], [3200, '#f6e2bd', '#a3563f']
  ];
  for (const [x, wall, roof] of houses) {
    out.push(wrap(x, W, 200, (px) => cottage(px, 716, 210, 150, { wall, roof })));
  }

  // Snowy pines with capped tiers.
  for (const x of [60, 460, 900, 1500, 2040, 2560, 3100]) {
    out.push(wrap(x, W, 140, (px) => pine(px, 748, 268, { bark: '#5b4636', dark: '#2f5548', mid: '#3b6a56', light: '#4a7f64', sw: 6 })));
  }

  out.push(ridge(742, 706, 8, '#e8f2fb', { w: W, width: 6 }));
  out.push(ridge(818, 790, 8, '#f7fbff', { w: W, width: 6 }));

  // Footprints and snow drifts.
  const drifts = [];
  for (let i = 0; i < 26; i += 1) {
    const x = rand() * W;
    const y = 800 + rand() * 70;
    drifts.push(wrap(x, W, 50, (px) => `<ellipse cx="${R(px)}" cy="${R(y)}" rx="${R(26 + rand() * 26)}" ry="${R(9 + rand() * 6)}" fill="#dceaf6" stroke="none"/>`));
  }
  out.push(drifts.join(''));

  // Falling snow.
  const flakes = [];
  for (let i = 0; i < 70; i += 1) {
    const x = rand() * W;
    const y = rand() * 860;
    flakes.push(wrap(x, W, 20, (px) => `<circle cx="${R(px)}" cy="${R(y)}" r="${R(3 + rand() * 5)}" fill="#ffffff" opacity="0.9"/>`));
  }
  out.push(`<g stroke="none">${flakes.join('')}</g>`);

  return svg('bg_snowy_village', W, H, `  <g id="background" stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    ${out.join('\n    ')}
  </g>`);
}

export function citySunset() {
  const W = 3200;
  const out = [];
  const rand = rng(88123);

  // Sunset sky as flat bands rather than a gradient (gradients are not allowed in assets).
  const bands = [['#4a3a6b', 0, 130], ['#7a4a78', 130, 120], ['#b25f74', 250, 110], ['#e07f66', 360, 100], ['#f2a163', 460, 90], ['#f8c47a', 550, 90]];
  out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#f8c47a" stroke="none"/>`);
  out.push(`<g stroke="none">${bands.map(([c, y, h]) => `<rect x="0" y="${y}" width="${W}" height="${h}" fill="${c}"/>`).join('')}</g>`);

  out.push(`<circle cx="2100" cy="560" r="132" fill="#ffd98a" stroke="${INK}" stroke-width="6"/>`);
  out.push(`<circle cx="2100" cy="560" r="104" fill="#fff0c4" stroke="none"/>`);

  // Long stratus clouds, wrapped at the seam.
  const streak = (cx, cy, w, h, fill, op) => `<rect x="${R(cx - w / 2)}" y="${R(cy - h / 2)}" width="${R(w)}" height="${R(h)}" rx="${R(h / 2)}" fill="${fill}" opacity="${op}" stroke="none"/>`;
  const clouds = [];
  for (let i = 0; i < 14; i += 1) {
    const x = rand() * W;
    const y = 90 + rand() * 380;
    const w = 220 + rand() * 460;
    clouds.push(wrap(x, W, w / 2 + 20, (px) => streak(px, y, w, 26 + rand() * 22, i % 3 === 0 ? '#ffd7b0' : '#f6b9a6', 0.55)));
  }
  out.push(clouds.join(''));

  out.push(`<g fill="none" stroke="${INK}" stroke-width="5">${[[700, 250, 1], [760, 215, 0.7], [2600, 300, 0.85]]
    .map(([x, y, s]) => wrap(x, W, 40, (px) => `<path d="M${R(px - 26 * s)} ${R(y)}q${R(13 * s)} ${R(-15 * s)} ${R(26 * s)} 0q${R(13 * s)} ${R(-15 * s)} ${R(26 * s)} 0"/>`)).join('')}</g>`);

  // Far skyline: block towers on a repeating rhythm, silhouetted.
  const skyline = (baseY, fill, step, seed) => {
    const r = rng(seed);
    const parts = [];
    for (let x = -60; x < W + 60; x += step) {
      const bw = step * (0.62 + r() * 0.3);
      const bh = 90 + r() * 210;
      parts.push(`<rect x="${R(x)}" y="${R(baseY - bh)}" width="${R(bw)}" height="${R(bh)}" fill="${fill}"/>`);
      if (r() > 0.66) parts.push(`<rect x="${R(x + bw * 0.32)}" y="${R(baseY - bh - 46)}" width="${R(bw * 0.34)}" height="46" fill="${fill}"/>`);
    }
    return `<g stroke="none">${parts.join('')}</g>`;
  };
  out.push(skyline(660, '#8a5a75', 96, 4242));
  out.push(skyline(700, '#5f3f5e', 128, 9090));

  // Lit windows on the nearer skyline band.
  const lights = [];
  for (let i = 0; i < 220; i += 1) {
    const x = rand() * W;
    const y = 520 + rand() * 170;
    lights.push(`<rect x="${R(x)}" y="${R(y)}" width="9" height="13" fill="#ffd98a" opacity="${R(0.5 + rand() * 0.5)}"/>`);
  }
  out.push(`<g stroke="none">${lights.join('')}</g>`);

  // Foreground rooftop: full-width deck and parapet, both seamless by construction.
  out.push(`<rect x="0" y="700" width="${W}" height="${H - 700}" fill="#8d6b5c" stroke="none"/>`);
  out.push(`<line x1="0" y1="700" x2="${W}" y2="700" stroke="${INK}" stroke-width="6"/>`);
  const deck = [];
  for (let x = 0; x < W; x += 160) deck.push(`<line x1="${x}" y1="700" x2="${x}" y2="${H}"/>`);
  deck.push(`<line x1="0" y1="790" x2="${W}" y2="790"/>`);
  out.push(`<g stroke="#75564a" stroke-width="5" stroke-linecap="butt">${deck.join('')}</g>`);

  out.push(`<rect x="0" y="646" width="${W}" height="58" fill="#a8806c" stroke="none"/>`);
  out.push(`<line x1="0" y1="646" x2="${W}" y2="646" stroke="${INK}" stroke-width="6"/>`);
  out.push(`<line x1="0" y1="704" x2="${W}" y2="704" stroke="${INK}" stroke-width="6"/>`);
  const merlons = [];
  for (let x = 40; x < W; x += 200) merlons.push(`<rect x="${x}" y="606" width="88" height="42" rx="6" fill="#b98d76" stroke="${INK}" stroke-width="6"/>`);
  out.push(merlons.join(''));

  // String lights swung on a seamless swag.
  const swagTop = 470;
  const swagDrop = 92;
  out.push(`<path d="${wave(swagTop, swagTop + swagDrop, 8, W)}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="butt"/>`);
  const bulbColors = ['#ffd166', '#ef476f', '#8ecae6', '#a8e6a1'];
  const bulbs = [];
  for (let x = 40; x < W; x += 80) {
    const y = waveY(swagTop, swagTop + swagDrop, 8, x, W);
    bulbs.push(`<line x1="${x}" y1="${R(y)}" x2="${x}" y2="${R(y + 18)}" stroke="${INK}" stroke-width="4"/><circle cx="${x}" cy="${R(y + 32)}" r="14" fill="${bulbColors[(x / 80) % bulbColors.length]}" stroke="${INK}" stroke-width="5"/>`);
  }
  // Posts at the swag's high points, so the string is visibly supported.
  const posts = [];
  for (let x = 0; x <= W; x += 800) {
    posts.push(wrap(x, W, 30, (px) => `<line x1="${R(px)}" y1="${R(swagTop - 14)}" x2="${R(px)}" y2="646" stroke="${INK}" stroke-width="18" stroke-linecap="round"/><line x1="${R(px)}" y1="${R(swagTop - 14)}" x2="${R(px)}" y2="646" stroke="#c99b80" stroke-width="10" stroke-linecap="round"/><circle cx="${R(px)}" cy="${R(swagTop - 26)}" r="12" fill="#ffd98a" stroke="${INK}" stroke-width="5"/>`));
  }
  out.push(posts.join(''));
  out.push(bulbs.join(''));

  // Rooftop garden pots and a water tower.
  for (const x of [340, 1240, 2340, 3200]) {
    out.push(wrap(x, W, 90, (px) => `<g transform="translate(${R(px)} 700)">
      <path d="M-44 0 -34 -74 34 -74 44 0Z" fill="#c96f52" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
      <rect x="-48" y="-90" width="96" height="22" rx="6" fill="#e08b6b" stroke="${INK}" stroke-width="6"/>
      <circle cx="-22" cy="-120" r="30" fill="#4f8f5f" stroke="${INK}" stroke-width="6"/>
      <circle cx="22" cy="-126" r="26" fill="#5fa46d" stroke="${INK}" stroke-width="6"/>
      <circle cx="0" cy="-156" r="24" fill="#6bb87b" stroke="${INK}" stroke-width="6"/>
    </g>`));
  }
  out.push(wrap(1720, W, 160, (px) => `<g transform="translate(${R(px)} 646)">
    <path d="M-70 0 -70 -150 70 -150 70 0" fill="#7f6a5c" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M-86 -150 0 -216 86 -150Z" fill="#5f4d43" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M-70 -104h140M-70 -58h140" fill="none" stroke="#5f4d43" stroke-width="6"/>
    <path d="M-46 0 -46 44M46 0 46 44" fill="none" stroke="${INK}" stroke-width="7"/>
  </g>`));

  const gravel = [];
  for (let i = 0; i < 40; i += 1) {
    const x = rand() * W;
    gravel.push(wrap(x, W, 20, (px) => `<ellipse cx="${R(px)}" cy="${R(730 + rand() * 150)}" rx="${R(5 + rand() * 5)}" ry="${R(3 + rand() * 3)}" fill="#7a5b4e" stroke="none"/>`));
  }
  out.push(gravel.join(''));
  out.push(tuft(2900, 880, 30, '#6b8f5a', 5));

  return svg('bg_city_sunset', W, H, `  <g id="background" stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    ${out.join('\n    ')}
  </g>`);
}

/** Lollipop tree: candy-cane stick under a swirled disc. Disc size is independent of height. */
function lollipop(cx, baseY, h, r, disc, swirl) {
  const topY = baseY - h;
  const sw = Math.max(9, r * 0.16);
  const stickW = Math.max(20, r * 0.34);
  const stripes = [];
  const stickTop = topY + r * 0.7;
  for (let y = baseY - 18; y > stickTop; y -= 34) {
    stripes.push(`<path d="M${R(cx - stickW / 2)} ${R(y)}l${R(stickW)} ${R(-stickW * 0.7)}" fill="none" stroke="#ef7f8f" stroke-width="${R(stickW * 0.34)}" stroke-linecap="butt"/>`);
  }
  return [
    `<rect x="${R(cx - stickW / 2)}" y="${R(stickTop)}" width="${R(stickW)}" height="${R(baseY - stickTop)}" rx="${R(stickW / 2)}" fill="#fffaf2" stroke="${INK}" stroke-width="6"/>`,
    `<g>${stripes.join('')}</g>`,
    `<rect x="${R(cx - stickW / 2)}" y="${R(stickTop)}" width="${R(stickW)}" height="${R(baseY - stickTop)}" rx="${R(stickW / 2)}" fill="none" stroke="${INK}" stroke-width="6"/>`,
    `<circle cx="${R(cx)}" cy="${R(topY + r)}" r="${R(r)}" fill="${disc}" stroke="${INK}" stroke-width="6"/>`,
    `<path d="M${R(cx)} ${R(topY + r)}m0 ${R(-r * 0.68)}a${R(r * 0.68)} ${R(r * 0.68)} 0 1 1 ${R(-r * 0.48)} ${R(r * 0.2)}a${R(r * 0.42)} ${R(r * 0.42)} 0 1 0 ${R(r * 0.3)} ${R(r * 0.28)}" fill="none" stroke="${swirl}" stroke-width="${R(sw)}" stroke-linecap="round"/>`
  ].join('');
}

/** Gingerbread cottage: icing-scalloped roof, sugar-pane windows and gumdrop trim. */
function gingerbread(cx, baseY, w, h, roof) {
  const hw = w / 2;
  const top = baseY - h;
  const eave = w * 0.11;
  const peak = top - h * 0.72;
  const drops = ['#ef476f', '#4cc9a7', '#ffd166', '#a78bc4', '#8ecae6'];
  const scallops = [];
  const steps = 6;
  for (let i = 0; i < steps; i += 1) scallops.push(`q${R((w + eave * 2) / steps / 2)} 26 ${R((w + eave * 2) / steps)} 0`);
  const pane = (px, py, s) => `<rect x="${R(px - s)}" y="${R(py - s)}" width="${R(s * 2)}" height="${R(s * 2)}" rx="6" fill="#ffe9a8" stroke="${INK}" stroke-width="6"/>`
    + `<path d="M${R(px)} ${R(py - s)}v${R(s * 2)}M${R(px - s)} ${R(py)}h${R(s * 2)}" fill="none" stroke="#e2a95c" stroke-width="5"/>`;
  return [
    `<rect x="${R(cx - hw)}" y="${R(top)}" width="${R(w)}" height="${R(h)}" rx="12" fill="#d9924e" stroke="${INK}" stroke-width="6"/>`,
    // Piped icing along the walls.
    `<path d="M${R(cx - hw + 14)} ${R(baseY - 16)}h${R(w - 28)}" fill="none" stroke="#fffaf2" stroke-width="9" stroke-linecap="round"/>`,
    `<path d="M${R(cx - hw - eave)} ${R(top)}L${R(cx)} ${R(peak)}L${R(cx + hw + eave)} ${R(top)}Z" fill="${roof}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`,
    `<path d="M${R(cx - hw - eave)} ${R(top)}${scallops.join('')}" fill="none" stroke="#fffaf2" stroke-width="12" stroke-linecap="round"/>`,
    // Candy-cane door frame with a gumdrop knob.
    `<path d="M${R(cx - w * 0.15)} ${R(baseY)}v${R(-h * 0.58)}q${R(w * 0.15)} ${R(-h * 0.26)} ${R(w * 0.3)} 0V${R(baseY)}Z" fill="#f6e3c6" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`,
    `<circle cx="${R(cx + w * 0.09)}" cy="${R(baseY - h * 0.26)}" r="${R(w * 0.022)}" fill="#ef476f" stroke="${INK}" stroke-width="4"/>`,
    pane(cx - hw * 0.58, top + h * 0.34, w * 0.085),
    pane(cx + hw * 0.58, top + h * 0.34, w * 0.085),
    // Gumdrop buttons under the eaves.
    drops.map((c, i) => `<circle cx="${R(cx - hw + w * 0.1 + i * w * 0.2)}" cy="${R(peak + h * 0.5)}" r="${R(w * 0.042)}" fill="${c}" stroke="${INK}" stroke-width="5"/>`).join('')
  ].join('');
}

/** Wrapped boiled sweet, used as sky confetti. */
function sweet(cx, cy, s, fill, tilt) {
  return `<g transform="rotate(${tilt} ${R(cx)} ${R(cy)})" stroke="${INK}" stroke-width="5" stroke-linejoin="round">
    <path d="M${R(cx - 34 * s)} ${R(cy)}l${R(-24 * s)} ${R(-19 * s)}v${R(38 * s)}Z" fill="${fill}"/>
    <path d="M${R(cx + 34 * s)} ${R(cy)}l${R(24 * s)} ${R(-19 * s)}v${R(38 * s)}Z" fill="${fill}"/>
    <circle cx="${R(cx)}" cy="${R(cy)}" r="${R(34 * s)}" fill="${fill}"/>
    <path d="M${R(cx - 16 * s)} ${R(cy - 12 * s)}a${R(20 * s)} ${R(20 * s)} 0 0 1 ${R(26 * s)} ${R(24 * s)}" fill="none" stroke="#fffaf2" stroke-width="${R(9 * s)}" stroke-linecap="round"/>
  </g>`;
}

export function candyLand() {
  const W = 4800;
  const out = [];
  const rand = rng(5150);
  const gum = ['#ef476f', '#4cc9a7', '#ffd166', '#8ecae6', '#c77dff'];

  // Sky, banded from high blue down to a pink horizon.
  out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffeef6" stroke="none"/>`);
  out.push(`<rect x="0" y="0" width="${W}" height="210" fill="#c4dcff" stroke="none"/>`);
  out.push(`<rect x="0" y="190" width="${W}" height="150" fill="#ded5ff" stroke="none"/>`);
  out.push(`<rect x="0" y="320" width="${W}" height="150" fill="#ffdcee" stroke="none"/>`);

  // Sun with candy-stripe rays.
  out.push(`<g transform="translate(3700 162)" stroke="${INK}" stroke-width="6" stroke-linecap="round">
    ${Array.from({ length: 12 }, (_, i) => {
      const a = (Math.PI / 6) * i;
      return `<line x1="${R(Math.cos(a) * 132)}" y1="${R(Math.sin(a) * 132)}" x2="${R(Math.cos(a) * 176)}" y2="${R(Math.sin(a) * 176)}" stroke="#ffcf5e"/>`;
    }).join('')}
    <circle cx="0" cy="0" r="118" fill="#ffe08a"/>
    <circle cx="0" cy="0" r="88" fill="#fff4c8" stroke="none"/>
  </g>`);

  // Cotton-candy clouds, larger and at mixed depths so the sky is not dead space.
  const puff = (cx, cy, s, fill) => `<g stroke="${INK}" stroke-width="6" stroke-linejoin="round"><circle cx="${R(cx - 78 * s)}" cy="${R(cy + 12 * s)}" r="${R(56 * s)}" fill="${fill}"/><circle cx="${R(cx + 76 * s)}" cy="${R(cy + 14 * s)}" r="${R(50 * s)}" fill="${fill}"/><circle cx="${R(cx - 10 * s)}" cy="${R(cy - 32 * s)}" r="${R(74 * s)}" fill="${fill}"/><circle cx="${R(cx + 44 * s)}" cy="${R(cy - 8 * s)}" r="${R(54 * s)}" fill="${fill}"/></g>`;
  const clouds = [[260, 190, 1.25, '#ffd6ea'], [900, 110, 0.85, '#ffffff'], [1500, 250, 1.05, '#e2ecff'],
    [2120, 140, 1.35, '#ffffff'], [2760, 235, 0.9, '#ffd6ea'], [3180, 120, 1, '#e2ecff'],
    [4180, 175, 1.2, '#ffffff'], [4640, 265, 0.8, '#ffd6ea'], [4800, 120, 1.05, '#ffd6ea']];
  out.push(clouds.map(([x, y, s, f]) => wrap(x, W, 170 * s, (px) => puff(px, y, s, f))).join(''));

  // Wrapped sweets drifting between the clouds.
  const confetti = [[620, 300, 0.85, '#ef476f', -18], [1780, 205, 0.7, '#4cc9a7', 24], [2480, 330, 0.8, '#ffd166', -8],
    [3760, 300, 0.75, '#c77dff', 16], [4420, 235, 0.65, '#8ecae6', -26]];
  out.push(confetti.map(([x, y, s, f, t]) => wrap(x, W, 70 * s, (px) => sweet(px, y, s, f, t))).join(''));

  // Frosting ranges. The far one sits high so the scene has real depth.
  out.push(ridge(470, 372, 4, '#c9b6ff', { w: W, width: 6 }));
  out.push(ridge(566, 494, 6, '#ffb8d8', { w: W, width: 6 }));

  // Gumdrop domes bedded into the pink range.
  const mounds = [];
  for (let i = 0; i < 16; i += 1) {
    const x = rand() * W;
    const r = 42 + rand() * 40;
    mounds.push(wrap(x, W, r + 14, (px) => `<g><path d="M${R(px - r)} 592a${R(r)} ${R(r)} 0 0 1 ${R(r * 2)} 0Z" fill="${gum[i % gum.length]}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/><path d="M${R(px - r * 0.5)} ${R(592 - r * 0.5)}a${R(r * 0.62)} ${R(r * 0.62)} 0 0 1 ${R(r * 0.5)} ${R(-r * 0.3)}" fill="none" stroke="#fffaf2" stroke-width="8" stroke-linecap="round" opacity="0.8"/></g>`));
  }
  out.push(mounds.join(''));

  out.push(ridge(648, 604, 8, '#ffe3f1', { w: W, width: 6 }));

  // Tall lollipops standing behind the village.
  // One feature per bay between the cottages: four lollipops plus the arch.
  const tall = [[1180, 404, 112, '#4cc9a7', '#f0fff9'], [3060, 432, 120, '#ffd166', '#fffaea'],
    [4020, 486, 138, '#8ecae6', '#f0faff'], [4800, 450, 126, '#ef476f', '#fff0f5']];
  for (const [x, h, r, disc, swirl] of tall) {
    out.push(wrap(x, W, r + 40, (px) => lollipop(px, 660, h, r, disc, swirl)));
  }

  // Gingerbread village, large enough to read as houses rather than huts.
  const village = [[640, '#ef7f8f'], [1560, '#7fd8c0'], [2500, '#f2b3d8'], [3480, '#ffcf5e'], [4400, '#7fd8c0']];
  for (const [x, roof] of village) {
    out.push(wrap(x, W, 250, (px) => gingerbread(px, 668, 380, 232, roof)));
  }

  out.push(ridge(726, 692, 8, '#b8e6c8', { w: W, width: 6 }));

  // Candy-cane fence: chunky posts on a 400px period with a single top rail. It
  // sits behind the front lawn, so the band where dolls stand stays clear.
  const posts = [];
  for (let x = 200; x < W; x += 400) {
    posts.push(`<rect x="${R(x - 17)}" y="700" width="34" height="112" rx="16" fill="#fffaf2" stroke="${INK}" stroke-width="6"/>`);
    posts.push(`<path d="M${R(x - 16)} 728l32 -22M${R(x - 16)} 768l32 -22" fill="none" stroke="#ef7f8f" stroke-width="11" stroke-linecap="butt"/>`);
  }
  out.push(`<path d="M0 744h${W}" fill="none" stroke="#fffaf2" stroke-width="20" stroke-linecap="butt"/>`);
  out.push(`<path d="M0 734h${W}M0 754h${W}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="butt"/>`);
  out.push(`<g>${posts.join('')}</g>`);

  // A candy-cane arch marks the middle of the panorama.
  out.push(`<g transform="translate(2030 726)" stroke="${INK}" stroke-width="6">
    <path d="M-190 0v-150a190 190 0 0 1 380 0V0" fill="none" stroke="${INK}" stroke-width="46" stroke-linecap="round"/>
    <path d="M-190 0v-150a190 190 0 0 1 380 0V0" fill="none" stroke="#fffaf2" stroke-width="34" stroke-linecap="round"/>
    ${Array.from({ length: 13 }, (_, i) => {
      const t = i / 12;
      // Sample the arch: two uprights joined by a semicircle.
      const total = 150 + Math.PI * 190 + 150;
      const d = t * total;
      let x; let y; let ang;
      if (d < 150) { x = -190; y = -d; ang = 90; }
      else if (d < 150 + Math.PI * 190) {
        const a = Math.PI - (d - 150) / 190;
        x = Math.cos(a) * 190; y = -150 - Math.sin(a) * 190; ang = 90 - (a * 180) / Math.PI;
      } else { x = 190; y = -(total - d); ang = 90; }
      return `<path d="M${R(x - 15)} ${R(y)}l30 -20" fill="none" stroke="#ef7f8f" stroke-width="12" stroke-linecap="butt" transform="rotate(${R(ang - 90)} ${R(x)} ${R(y)})"/>`;
    }).join('')}
  </g>`);

  out.push(ridge(806, 780, 8, '#a5dcb8', { w: W, width: 6 }));

  // A few short lollipops in the front band.
  const front = [[1020, 250, 78, '#ffd166', '#fffaea'], [2960, 232, 70, '#8ecae6', '#f0faff'], [4260, 262, 84, '#4cc9a7', '#f0fff9']];
  for (const [x, h, r, disc, swirl] of front) {
    out.push(wrap(x, W, r + 30, (px) => lollipop(px, 838, h, r, disc, swirl)));
  }

  // Sprinkles in the foreground, fewer and larger than a scatter of noise.
  const sprinkles = [];
  for (let i = 0; i < 48; i += 1) {
    const x = rand() * W;
    const y = 856 + rand() * 36;
    const a = Math.round(rand() * 180);
    sprinkles.push(wrap(x, W, 24, (px) => `<rect x="${R(px)}" y="${R(y)}" width="26" height="10" rx="5" fill="${gum[i % gum.length]}" transform="rotate(${a} ${R(px + 13)} ${R(y + 5)})"/>`));
  }
  out.push(`<g stroke="none">${sprinkles.join('')}</g>`);

  return svg('bg_candy_land', W, H, `  <g id="background" stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    ${out.join('\n    ')}
  </g>`);
}

export function moonlitMeadow() {
  const W = 3200;
  const out = [];
  const rand = rng(90210);

  out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#263b55" stroke="none"/>`);
  out.push(`<rect x="0" y="210" width="${W}" height="190" fill="#2f4763" stroke="none"/>`);
  out.push(`<rect x="0" y="370" width="${W}" height="170" fill="#3a5878" stroke="none"/>`);

  // Crescent moon.
  out.push(`<circle cx="2480" cy="170" r="92" fill="#fff1b8" stroke="${INK}" stroke-width="6"/>`);
  out.push(`<circle cx="2522" cy="140" r="80" fill="#2f4763" stroke="none"/>`);

  const stars = [];
  for (let i = 0; i < 40; i += 1) {
    const x = rand() * W;
    const y = 30 + rand() * 340;
    if (Math.hypot(x - 2480, y - 170) < 170) continue;
    stars.push(wrap(x, W, 22, (px) => `<circle cx="${R(px)}" cy="${R(y)}" r="${R(3 + rand() * 5)}" fill="#fff1b8"/>`));
  }
  out.push(`<g stroke="none">${stars.join('')}</g>`);
  out.push(`<g stroke="none">${[210, 900, 1780, 2910].map((x, i) => wrap(x, W, 30, (px) => star4(px, 90 + i * 42, 19 - i * 2, '#bde0fe'))).join('')}</g>`);

  // Meadow ridges.
  out.push(ridge(500, 430, 4, '#5a7d74', { w: W, width: 6 }));
  out.push(ridge(590, 530, 6, '#41695d', { w: W, width: 6 }));

  // Cottage with a lit window, sitting on the second ridge.
  out.push(wrap(1780, W, 190, (px) => `<g transform="translate(${R(px)} 596)">
    <rect x="-92" y="-124" width="184" height="124" fill="#e8d3ae" stroke="${INK}" stroke-width="6"/>
    <path d="M-116 -124 0 -212 116 -124Z" fill="#a8564b" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
    <rect x="46" y="-208" width="30" height="60" fill="#8f4b42" stroke="${INK}" stroke-width="6"/>
    <rect x="-64" y="-88" width="46" height="46" rx="4" fill="#ffd166" stroke="${INK}" stroke-width="6"/>
    <path d="M-41 -88v46M-64 -65h46" fill="none" stroke="${INK}" stroke-width="5"/>
    <path d="M18 0v-70q26 -22 52 0V0Z" fill="#8a6642" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  </g>`));

  // Broadleaf trees, one straddling the seam.
  const trees = [[0, 360], [520, 320], [1120, 380], [2360, 330], [2900, 355]];
  for (const [x, h] of trees) {
    out.push(wrap(x, W, 220, (px) => broadleaf(px, 700, h, {
      bark: '#815b43', canopy: '#4f8f74', canopyDark: '#3f7660', canopyLight: '#63a888', sw: 6
    })));
  }

  out.push(ridge(690, 638, 8, '#4d7c6a', { w: W, width: 6 }));

  // Moonlit footpath: a seamless wave, so it leaves and re-enters at the same height.
  out.push(`<path d="${wave(772, 742, 4, W)}" fill="none" stroke="#b79a70" stroke-width="86" stroke-linecap="butt"/>`);
  out.push(`<path d="${wave(772, 742, 4, W)}" fill="none" stroke="#d5bd91" stroke-width="30" stroke-linecap="butt"/>`);

  out.push(ridge(838, 808, 8, '#6d9b65', { w: W, width: 6 }));

  const grass = [];
  for (let i = 0; i < 40; i += 1) {
    const x = rand() * W;
    grass.push(wrap(x, W, 44, (px) => tuft(px, 830 + rand() * 60, 30 + rand() * 22, '#3f6f4a', 5)));
  }
  out.push(`<g>${grass.join('')}</g>`);

  const flies = [[300, 660], [740, 700], [1340, 648], [1980, 690], [2600, 656], [3120, 700]];
  out.push(flies.map(([x, y]) => wrap(x, W, 30, (px) => `<circle cx="${R(px)}" cy="${y}" r="11" fill="#ffef5a" stroke="${INK}" stroke-width="4"/>`)).join(''));

  return svg('bg_moonlit_meadow', W, H, `  <g id="background" stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    ${out.join('\n    ')}
  </g>`);
}
