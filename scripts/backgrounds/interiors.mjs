import { INK, R, svg, wave, waveY } from './lib.mjs';

const W = 1600;
const H = 900;

/**
 * Plank floor in light perspective: courses get deeper toward the viewer and
 * carry only a sparse butt joint each, so it reads as boards rather than brick.
 * Joints sit on a period that divides the tile width, so the rhythm survives a seam.
 */
export function plankFloor(topY, rows, plank, seam, period = 800) {
  const depth = H - topY;
  // Geometric course heights summing to the floor depth.
  const ratio = 1.45;
  let unit = 1;
  let total = 0;
  const heights = [];
  for (let r = 0; r < rows; r += 1) { heights.push(unit); total += unit; unit *= ratio; }
  const scaled = heights.map((v) => (v / total) * depth);

  const parts = [`<rect x="0" y="${R(topY)}" width="${W}" height="${R(depth)}" fill="${plank}" stroke="none"/>`];
  const shade = [];
  const joints = [];
  let y = topY;
  for (let r = 0; r < rows; r += 1) {
    const h = scaled[r];
    if (r % 2 === 1) shade.push(`<rect x="0" y="${R(y)}" width="${W}" height="${R(h)}" fill="${seam}" opacity="0.16"/>`);
    if (r > 0) joints.push(`<line x1="0" y1="${R(y)}" x2="${W}" y2="${R(y)}" stroke="${seam}" stroke-width="4"/>`);
    const offset = (r % 2 === 0 ? period * 0.25 : period * 0.7);
    for (let x = offset; x < W; x += period) {
      joints.push(`<line x1="${R(x)}" y1="${R(y)}" x2="${R(x)}" y2="${R(y + h)}" stroke="${seam}" stroke-width="4"/>`);
    }
    y += h;
  }
  return `<g stroke="none">${parts.join('')}${shade.join('')}</g><g stroke-linecap="butt">${joints.join('')}</g>`;
}

/** Running-bond brick courses; the bond offset repeats on a divisor of the tile width. */
export function brickWall(topY, bottomY, fill, mortar, bw = 100, bh = 40) {
  const parts = [`<rect x="0" y="${R(topY)}" width="${W}" height="${R(bottomY - topY)}" fill="${fill}" stroke="none"/>`];
  let row = 0;
  for (let y = topY; y < bottomY; y += bh, row += 1) {
    parts.push(`<line x1="0" y1="${R(y)}" x2="${W}" y2="${R(y)}" stroke="${mortar}" stroke-width="4"/>`);
    const offset = row % 2 === 0 ? 0 : bw / 2;
    for (let x = offset; x < W; x += bw) {
      if (x <= 0) continue;
      parts.push(`<line x1="${R(x)}" y1="${R(y)}" x2="${R(x)}" y2="${R(Math.min(y + bh, bottomY))}" stroke="${mortar}" stroke-width="4"/>`);
    }
  }
  return `<g stroke-linecap="butt">${parts.join('')}</g>`;
}

/** Bunting hung on a seamless swag: the string leaves and re-enters at the same height and slope. */
export function bunting(y, drop, colors, period = 100) {
  const segs = 4;
  const swag = wave(y, y + drop, segs);
  const flags = [];
  for (let i = 0; i < W / period; i += 1) {
    const x = i * period + period / 2;
    const sag = waveY(y, y + drop, segs, x);
    flags.push(`<path d="M${R(x - 22)} ${R(sag)}L${R(x + 22)} ${R(sag)}L${R(x)} ${R(sag + 52)}Z" fill="${colors[i % colors.length]}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`);
  }
  return `<path d="${swag}" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="butt"/>${flags.join('')}`;
}

export function bedroom() {
  const out = [];
  const wallBottom = 620;

  out.push(`<rect x="0" y="0" width="${W}" height="${wallBottom}" fill="#fdf0ed" stroke="none"/>`);
  // Wallpaper stripes on a 100px period, fully inside the tile so the rhythm wraps cleanly.
  const stripes = [];
  for (let x = 50; x < W; x += 100) stripes.push(`<line x1="${x}" y1="0" x2="${x}" y2="${wallBottom}" stroke="#f8ded8" stroke-width="40"/>`);
  out.push(`<g stroke-linecap="butt">${stripes.join('')}</g>`);
  const sprigs = [];
  for (let x = 0; x < W; x += 100) {
    for (let y = 60; y < wallBottom - 40; y += 120) {
      const px = x + (Math.floor(y / 120) % 2 === 0 ? 0 : 50);
      if (px >= W) continue;
      sprigs.push(`<path d="M${px} ${y}v-18M${px} ${y}l-13 -13M${px} ${y}l13 -13" fill="none" stroke="#f1cdc4" stroke-width="4" stroke-linecap="round"/>`);
    }
  }
  out.push(sprigs.join(''));

  // Two arched windows, 800 apart, so the spacing continues across the seam.
  for (const cx of [400, 1200]) {
    out.push(`<g transform="translate(${cx - 130} 110)">
      <path d="M0 130A130 130 0 0 1 260 130L260 380L0 380Z" fill="#cfe7f2" stroke="#ffffff" stroke-width="14" stroke-linejoin="round"/>
      <path d="M0 130A130 130 0 0 1 260 130L260 380L0 380Z" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M130 4 130 380M6 130 254 130M6 260 254 260" fill="none" stroke="#ffffff" stroke-width="9"/>
      <path d="M-34 -6q40 200 12 386L-72 380 -72 -6Z" fill="#f3b8bf" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M294 -6q-40 200 -12 386L332 380 332 -6Z" fill="#f3b8bf" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    </g>`);
  }

  out.push(bunting(70, 46, ['#e76f51', '#2a9d8f', '#e9c46a', '#b56576', '#457b9d', '#f4a261']));

  // Picture rail, baseboard, floor.
  out.push(`<rect x="0" y="${wallBottom - 18}" width="${W}" height="18" fill="#e7d6c6" stroke="none"/>`);
  out.push(`<line x1="0" y1="${wallBottom - 18}" x2="${W}" y2="${wallBottom - 18}" stroke="${INK}" stroke-width="5"/>`);
  out.push(`<rect x="0" y="${wallBottom}" width="${W}" height="26" fill="#e2d5c3" stroke="none"/>`);
  out.push(`<line x1="0" y1="${wallBottom}" x2="${W}" y2="${wallBottom}" stroke="${INK}" stroke-width="5"/>`);
  out.push(`<line x1="0" y1="${wallBottom + 26}" x2="${W}" y2="${wallBottom + 26}" stroke="${INK}" stroke-width="5"/>`);
  out.push(plankFloor(wallBottom + 26, 4, '#d9c2b2', '#bb9d89', 800));

  // Soft rug, kept clear of both edges.
  out.push(`<ellipse cx="800" cy="810" rx="330" ry="72" fill="#f6d9d3" stroke="${INK}" stroke-width="5"/>`);
  out.push(`<ellipse cx="800" cy="810" rx="240" ry="48" fill="none" stroke="#e5b6ae" stroke-width="6"/>`);

  return svg('bg_bedroom', W, H, `  <g id="background" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    ${out.join('\n    ')}
  </g>`);
}

export function atelier() {
  const out = [];
  const wallBottom = 640;

  out.push(brickWall(0, wallBottom, '#f4ece7', '#e3d2c9'));

  // Full-width shelf. Objects sit on a 400px rhythm so they repeat across the
  // seam, but only one group per bay — the wall reads as a working studio, not a
  // display case, and the long empty stretches give the dolls a clean backdrop.
  const shelfY = 300;
  out.push(`<rect x="0" y="${shelfY}" width="${W}" height="16" fill="#c9a377" stroke="none"/>`);
  out.push(`<line x1="0" y1="${shelfY}" x2="${W}" y2="${shelfY}" stroke="${INK}" stroke-width="5"/>`);
  out.push(`<line x1="0" y1="${shelfY + 16}" x2="${W}" y2="${shelfY + 16}" stroke="${INK}" stroke-width="5"/>`);
  // Triangular brackets on a 400px period, in phase at x = 0 so they carry across the seam.
  out.push([200, 600, 1000, 1400].map((x) => `<path d="M${x - 26} ${shelfY + 16}L${x + 26} ${shelfY + 16}L${x} ${shelfY + 62}Z" fill="#c9a377" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`).join(''));

  // Bay 0: a pair of pigment jars.
  out.push(`<g transform="translate(90 ${shelfY - 62})">
    <rect x="0" y="12" width="54" height="50" rx="8" fill="#e76f51" stroke="${INK}" stroke-width="5"/>
    <rect x="13" y="-4" width="28" height="20" rx="4" fill="#f2e8dc" stroke="${INK}" stroke-width="5"/>
    <rect x="70" y="24" width="44" height="38" rx="7" fill="#457b9d" stroke="${INK}" stroke-width="5"/>
    <rect x="81" y="10" width="22" height="18" rx="4" fill="#f2e8dc" stroke="${INK}" stroke-width="5"/>
  </g>`);

  // Bay 1: a single brush pot, with the rest of the bay left empty.
  out.push(`<g transform="translate(560 ${shelfY - 92})">
    <rect x="0" y="42" width="46" height="50" rx="6" fill="#f2e8dc" stroke="${INK}" stroke-width="5"/>
    <path d="M9 42 9 4M23 42 23 -6M37 42 37 8" fill="none" stroke="#9a6b45" stroke-width="7" stroke-linecap="round"/>
    <circle cx="9" cy="2" r="8" fill="#b56576" stroke="none"/><circle cx="23" cy="-8" r="8" fill="#2a9d8f" stroke="none"/><circle cx="37" cy="6" r="8" fill="#e9c46a" stroke="none"/>
  </g>`);

  // Bay 2: a finished canvas leaning against the wall.
  out.push(`<g transform="translate(940 ${shelfY - 132})">
    <path d="M6 132 0 8 118 0 124 126Z" fill="#fffaf2" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <circle cx="46" cy="52" r="27" fill="#ef7f72" stroke="none"/>
    <circle cx="80" cy="74" r="20" fill="#e9c46a" stroke="none"/>
    <path d="M14 104 112 98" fill="none" stroke="#e3d7c6" stroke-width="6"/>
  </g>`);

  // Bay 3 stays empty.

  // Two pinned studies rather than a gallery row.
  const studies = [[430, 392, -4, 168, 190, '#ef7f72', '#2a9d8f'], [1120, 408, 3, 138, 156, '#a78bc4', '#e9c46a']];
  for (const [x, y, rot, w, h, a, b] of studies) {
    out.push(`<g transform="translate(${x} ${y}) rotate(${rot})">
      <rect x="0" y="0" width="${w}" height="${h}" rx="6" fill="#fffdf6" stroke="${INK}" stroke-width="5"/>
      <circle cx="${R(w * 0.35)}" cy="${R(h * 0.36)}" r="${R(w * 0.2)}" fill="${a}" stroke="none"/>
      <circle cx="${R(w * 0.63)}" cy="${R(h * 0.5)}" r="${R(w * 0.14)}" fill="${b}" stroke="none" opacity="0.85"/>
      <path d="M${R(w * 0.15)} ${R(h * 0.78)}h${R(w * 0.7)}M${R(w * 0.15)} ${R(h * 0.89)}h${R(w * 0.45)}" fill="none" stroke="#cbb9a6" stroke-width="5" stroke-linecap="round"/>
      <circle cx="${R(w / 2)}" cy="-2" r="9" fill="#d64b4b" stroke="${INK}" stroke-width="4"/>
    </g>`);
  }

  // Floor.
  out.push(`<rect x="0" y="${wallBottom}" width="${W}" height="24" fill="#cbb299" stroke="none"/>`);
  out.push(`<line x1="0" y1="${wallBottom}" x2="${W}" y2="${wallBottom}" stroke="${INK}" stroke-width="5"/>`);
  out.push(`<line x1="0" y1="${wallBottom + 24}" x2="${W}" y2="${wallBottom + 24}" stroke="${INK}" stroke-width="5"/>`);
  out.push(plankFloor(wallBottom + 24, 4, '#e0d6c6', '#c3b7a1', 800));
  out.push(`<g stroke="none" opacity="0.7">${[['#ef7f72', 640, 812, 22], ['#a78bc4', 900, 858, 15], ['#e9c46a', 1460, 826, 18]]
    .map(([c, cx, cy, r]) => `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${R(r * 0.5)}" fill="${c}"/>`).join('')}</g>`);

  // Leaning canvases and a studio plant, kept clear of the tile edges.
  out.push(`<g transform="translate(300 880)">
    <path d="M0 0 -18 -196 128 -212 146 -16Z" fill="#fffaf2" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <circle cx="52" cy="-124" r="38" fill="#8ecae6" stroke="none"/>
    <path d="M-6 -22 138 -36" fill="none" stroke="#e3d7c6" stroke-width="5"/>
    <path d="M120 0 116 -168 214 -178 220 -10Z" fill="#f2e8dc" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M138 -60 168 -122 200 -66Z" fill="#e9c46a" stroke="none"/>
  </g>`);
  out.push(`<g transform="translate(1240 880)">
    <path d="M-52 0 -40 -104 40 -104 52 0Z" fill="#c96f52" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <rect x="-58" y="-122" width="116" height="26" rx="6" fill="#e08b6b" stroke="${INK}" stroke-width="5"/>
    <path d="M-4 -122q-56 -34 -66 -110q52 6 68 108" fill="#4f8f5f" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M4 -122q56 -40 60 -128q-52 14 -62 126" fill="#5fa46d" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M0 -124q-8 -74 6 -140q26 62 6 140" fill="#6bb87b" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
  </g>`);

  return svg('bg_atelier', W, H, `  <g id="background" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    ${out.join('\n    ')}
  </g>`);
}

export function cafe() {
  const out = [];
  const wallBottom = 640;

  out.push(`<rect x="0" y="0" width="${W}" height="${wallBottom}" fill="#fcf5ea" stroke="none"/>`);
  out.push(brickWall(0, 200, '#faede1', '#ecd9c8', 100, 40));

  // Striped awning: 20 stripes of 80, plus a scallop on the same 80px period.
  const stripes = [];
  for (let i = -1; i < 20; i += 1) {
    const x = i * 80;
    stripes.push(`<path d="M${x} 0L${x + 30} 118L${x + 110} 118L${x + 80} 0Z" fill="${((i % 2) + 2) % 2 === 0 ? '#ef7f72' : '#fffdf7'}" stroke="none"/>`);
  }
  out.push(`<g>${stripes.join('')}</g>`);
  // Scallop period 40 divides 1600, and it is drawn past both edges so the arc continues across the seam.
  const scallop = [];
  for (let i = 0; i < 42; i += 1) scallop.push('q20 26 40 0');
  out.push(`<path d="M-40 118${scallop.join('')}" fill="none" stroke="${INK}" stroke-width="5"/>`);
  out.push(`<line x1="0" y1="0" x2="${W}" y2="0" stroke="${INK}" stroke-width="5"/>`);

  // Showcase windows on an 800px period so the storefront rhythm survives the seam.
  for (const cx of [400, 1200]) {
    out.push(`<g transform="translate(${cx - 230} 200)">
      <rect x="0" y="0" width="460" height="360" rx="12" fill="#e3f2f8" stroke="#9a6b45" stroke-width="12"/>
      <rect x="0" y="0" width="460" height="360" rx="12" fill="none" stroke="${INK}" stroke-width="5"/>
      <path d="M230 0 230 360M0 170 460 170" fill="none" stroke="#9a6b45" stroke-width="10"/>
      <path d="M52 26 172 250M92 26 152 138" fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round" opacity="0.75"/>
    </g>`);
  }

  // Chalkboard menu, centred in the gap between the windows.
  out.push(`<g transform="translate(724 250)">
    <rect x="0" y="0" width="152" height="210" rx="10" fill="#3c342d" stroke="#9a6b45" stroke-width="12"/>
    <rect x="0" y="0" width="152" height="210" rx="10" fill="none" stroke="${INK}" stroke-width="5"/>
    <path d="M30 46h92M30 84h68M30 112h84M30 140h56" fill="none" stroke="#f6ead6" stroke-width="5" stroke-linecap="round"/>
    <circle cx="76" cy="180" r="16" fill="#ef7f72" stroke="none"/>
  </g>`);

  // Pendant lamps on a 400px period.
  for (let i = 0; i < 4; i += 1) {
    const x = 200 + i * 400;
    out.push(`<g transform="translate(${x} 118)">
      <line x1="0" y1="0" x2="0" y2="86" stroke="${INK}" stroke-width="5"/>
      <path d="M-38 138q0 -52 38 -52q38 0 38 52Z" fill="#e9aa3a" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <ellipse cx="0" cy="146" rx="16" ry="12" fill="#fff2c2" stroke="${INK}" stroke-width="5"/>
    </g>`);
  }

  // Windowsill ledge with herb pots, on the same 400px rhythm as the lamps.
  out.push(`<rect x="0" y="566" width="${W}" height="14" fill="#c9a377" stroke="none"/>`);
  out.push(`<line x1="0" y1="566" x2="${W}" y2="566" stroke="${INK}" stroke-width="5"/>`);
  out.push(`<line x1="0" y1="580" x2="${W}" y2="580" stroke="${INK}" stroke-width="5"/>`);
  for (let i = 0; i < 4; i += 1) {
    const x = 120 + i * 400;
    out.push(`<g transform="translate(${x} 566)">
      <path d="M-26 0 -20 -44 20 -44 26 0Z" fill="#c96f52" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <circle cx="-13" cy="-64" r="17" fill="#4f8f5f" stroke="${INK}" stroke-width="5"/>
      <circle cx="14" cy="-68" r="15" fill="#5fa46d" stroke="${INK}" stroke-width="5"/>
      <circle cx="0" cy="-86" r="14" fill="#6bb87b" stroke="${INK}" stroke-width="5"/>
    </g>`);
  }

  // Baseboard and checkerboard tile floor.
  out.push(`<rect x="0" y="${wallBottom}" width="${W}" height="26" fill="#cbb299" stroke="none"/>`);
  out.push(`<line x1="0" y1="${wallBottom}" x2="${W}" y2="${wallBottom}" stroke="${INK}" stroke-width="5"/>`);
  out.push(`<line x1="0" y1="${wallBottom + 26}" x2="${W}" y2="${wallBottom + 26}" stroke="${INK}" stroke-width="5"/>`);

  const floorTop = wallBottom + 26;
  const depth = H - floorTop;
  out.push(`<rect x="0" y="${floorTop}" width="${W}" height="${depth}" fill="#ede0d4" stroke="none"/>`);
  // Courses deepen toward the viewer; column width 100 divides 1600 so the checker survives the seam.
  const rowHeights = [];
  let unit = 1;
  let total = 0;
  for (let r = 0; r < 4; r += 1) { rowHeights.push(unit); total += unit; unit *= 1.5; }
  const scaled = rowHeights.map((v) => (v / total) * depth);
  const tiles = [];
  const grid = [];
  let y = floorTop;
  for (let r = 0; r < 4; r += 1) {
    const h = scaled[r];
    for (let c = 0; c < 16; c += 1) {
      if ((r + c) % 2) continue;
      tiles.push(`<rect x="${c * 100}" y="${R(y)}" width="100" height="${R(h)}" fill="#cdb9a7"/>`);
    }
    if (r > 0) grid.push(`<line x1="0" y1="${R(y)}" x2="${W}" y2="${R(y)}"/>`);
    y += h;
  }
  for (let c = 1; c < 16; c += 1) grid.push(`<line x1="${c * 100}" y1="${floorTop}" x2="${c * 100}" y2="${H}"/>`);
  out.push(`<g stroke="none">${tiles.join('')}</g>`);
  out.push(`<g stroke="#b09d8d" stroke-width="4" stroke-linecap="butt">${grid.join('')}</g>`);

  return svg('bg_cafe', W, H, `  <g id="background" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    ${out.join('\n    ')}
  </g>`);
}

export function library() {
  const out = [];
  const wallBottom = 640;
  const bookColors = ['#e76f51', '#2a9d8f', '#e9c46a', '#457b9d', '#a78bc4', '#b56576', '#52b788', '#264653', '#f4a261'];

  out.push(`<rect x="0" y="0" width="${W}" height="${wallBottom}" fill="#f4ebd9" stroke="none"/>`);
  out.push(brickWall(0, wallBottom, '#f4ebd9', '#e8dcc4', 160, 80));

  // Arched windows on an 800px period; one sits on the seam and rejoins next tile.
  for (const cx of [0, 800, 1600]) {
    out.push(`<g transform="translate(${cx - 120} 90)">
      <path d="M0 120A120 120 0 0 1 240 120L240 380L0 380Z" fill="#203a52" stroke="#9a6b45" stroke-width="14" stroke-linejoin="round"/>
      <path d="M0 120A120 120 0 0 1 240 120L240 380L0 380Z" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      ${cx === 800
        ? '<circle cx="70" cy="86" r="7" fill="#fff6d8" stroke="none"/><circle cx="150" cy="60" r="5" fill="#fff6d8" stroke="none"/><circle cx="186" cy="150" r="6" fill="#fff6d8" stroke="none"/><circle cx="60" cy="200" r="5" fill="#fff6d8" stroke="none"/><circle cx="140" cy="300" r="6" fill="#fff6d8" stroke="none"/><circle cx="196" cy="252" r="5" fill="#fff6d8" stroke="none"/>'
        : '<circle cx="168" cy="98" r="26" fill="#ffd166" stroke="none"/><circle cx="66" cy="72" r="6" fill="#fff6d8" stroke="none"/><circle cx="104" cy="168" r="5" fill="#fff6d8" stroke="none"/><circle cx="52" cy="220" r="6" fill="#fff6d8" stroke="none"/>'}
      <path d="M120 6 120 380M6 120 234 120M6 250 234 250" fill="none" stroke="#9a6b45" stroke-width="9"/>
    </g>`);
  }

  // Bookcases on the same 800px period, filling the bays between the windows.
  // Each case gets its own seed so the two are not visibly the same object twice.
  [[140, 0], [940, 5]].forEach(([bx, seed]) => {
    out.push(`<g transform="translate(${bx} 120)">
      <rect x="-16" y="-16" width="552" height="536" rx="8" fill="#6f4e37" stroke="${INK}" stroke-width="5"/>
      ${[0, 1, 2, 3].map((row) => {
        const y = row * 128;
        const shelf = `<rect x="0" y="${y}" width="520" height="112" fill="#583e2e" stroke="none"/>`;
        const lip = `<rect x="-8" y="${y + 108}" width="536" height="16" fill="#8b6244" stroke="${INK}" stroke-width="4"/>`;
        const items = [];
        let x = 12;
        let i = (row + seed) * 7;
        // One shelf per case holds keepsakes instead of a solid run of spines.
        const keepsake = row === (seed % 4 === 0 ? 2 : 1);
        const stop = keepsake ? 250 : 470;
        while (x < stop) {
          const w = 26 + ((i * 13) % 26);
          const h = 78 + ((i * 7) % 22);
          items.push(`<rect x="${x}" y="${R(y + 108 - h)}" width="${w}" height="${h}" rx="3" fill="${bookColors[i % bookColors.length]}" stroke="${INK}" stroke-width="4"/>`);
          x += w + 3;
          i += 1;
        }
        if ((row + seed) % 3 !== 1) {
          const leaningBookX = Math.min(x + 6, 460);
          items.push(`<path d="M${R(leaningBookX)} ${y + 108}L${R(leaningBookX + 14)} ${y + 40}L${R(leaningBookX + 42)} ${y + 48}L${R(leaningBookX + 28)} ${y + 108}Z" fill="${bookColors[(i + 3) % bookColors.length]}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`);
          x += 54;
        }
        if (keepsake) {
          // A stack of books laid flat, a globe and a small pot.
          items.push(`<g transform="translate(${R(x + 30)} ${y + 108})">
            <rect x="0" y="-26" width="118" height="26" rx="4" fill="${bookColors[(i + 1) % bookColors.length]}" stroke="${INK}" stroke-width="4"/>
            <rect x="10" y="-48" width="100" height="24" rx="4" fill="${bookColors[(i + 4) % bookColors.length]}" stroke="${INK}" stroke-width="4"/>
            <rect x="22" y="-68" width="82" height="22" rx="4" fill="${bookColors[(i + 6) % bookColors.length]}" stroke="${INK}" stroke-width="4"/>
          </g>`);
          items.push(`<g transform="translate(${R(x + 196)} ${y + 108})">
            <path d="M-22 0h44M0 0v-16" fill="none" stroke="#9a6b45" stroke-width="7" stroke-linecap="round"/>
            <circle cx="0" cy="-50" r="35" fill="#7fb3c8" stroke="${INK}" stroke-width="4"/>
            <path d="M-30 -62q30 14 60 0M-30 -38q30 14 60 0M0 -85v70" fill="none" stroke="#4f8f7a" stroke-width="4"/>
          </g>`);
          items.push(`<g transform="translate(${R(x + 268)} ${y + 108})">
            <path d="M-20 0 -15 -34 15 -34 20 0Z" fill="#c96f52" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
            <circle cx="-10" cy="-48" r="13" fill="#4f8f5f" stroke="${INK}" stroke-width="4"/>
            <circle cx="11" cy="-52" r="12" fill="#6bb87b" stroke="${INK}" stroke-width="4"/>
          </g>`);
        }
        return `${shelf}${items.join('')}${lip}`;
      }).join('')}
    </g>`);
  });

  // Rolling ladder hooked on the rail of the left bookcase, both ends on the case.
  out.push(`<g transform="translate(356 104)">
    <path d="M0 0 40 536M74 0 114 536" fill="none" stroke="#9a6b45" stroke-width="12" stroke-linecap="round"/>
    <path d="M0 0 40 536M74 0 114 536" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    ${[0, 1, 2, 3, 4, 5, 6].map((r) => {
      const t = 0.08 + r * 0.14;
      return `<line x1="${R(t * 40)}" y1="${R(t * 536)}" x2="${R(74 + t * 40)}" y2="${R(t * 536)}" stroke="#c9a377" stroke-width="11" stroke-linecap="round"/>`;
    }).join('')}
    <circle cx="42" cy="540" r="14" fill="#3c342d" stroke="${INK}" stroke-width="4"/>
    <circle cx="116" cy="540" r="14" fill="#3c342d" stroke="${INK}" stroke-width="4"/>
  </g>`);

  out.push(`<rect x="0" y="${wallBottom}" width="${W}" height="26" fill="#583e2e" stroke="none"/>`);
  out.push(`<line x1="0" y1="${wallBottom}" x2="${W}" y2="${wallBottom}" stroke="${INK}" stroke-width="5"/>`);
  out.push(`<line x1="0" y1="${wallBottom + 26}" x2="${W}" y2="${wallBottom + 26}" stroke="${INK}" stroke-width="5"/>`);
  out.push(plankFloor(wallBottom + 26, 4, '#b58a63', '#8b5e34', 800));
  out.push(`<ellipse cx="800" cy="812" rx="300" ry="68" fill="#a8465c" stroke="${INK}" stroke-width="5"/>`);
  out.push(`<ellipse cx="800" cy="812" rx="222" ry="46" fill="none" stroke="#e9c46a" stroke-width="7"/>`);
  out.push(`<ellipse cx="800" cy="812" rx="140" ry="28" fill="none" stroke="#e9c46a" stroke-width="7"/>`);
  out.push(`<g transform="translate(1246 848)">
    <rect x="-64" y="-28" width="128" height="28" rx="5" fill="#457b9d" stroke="${INK}" stroke-width="5"/>
    <rect x="-54" y="-52" width="110" height="26" rx="5" fill="#e9c46a" stroke="${INK}" stroke-width="5"/>
    <rect x="-44" y="-74" width="92" height="24" rx="5" fill="#b56576" stroke="${INK}" stroke-width="5"/>
    <path d="M-30 -96 -30 -74 30 -74 30 -96Z" fill="#f2e8dc" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M0 -96v22" fill="none" stroke="${INK}" stroke-width="4"/>
  </g>`);

  return svg('bg_library', W, H, `  <g id="background" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    ${out.join('\n    ')}
  </g>`);
}
