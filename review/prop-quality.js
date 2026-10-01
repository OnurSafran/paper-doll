import { PACK_REGISTRY } from '../js/packs/index.js';
import { loadAssetSvg } from '../js/core/svg-loader.js';

const props = PACK_REGISTRY.assetsByKind('prop');
const fields = Object.fromEntries(['pack', 'scale', 'flip', 'status'].map(id => [id, document.getElementById(id)]));
const artwork = new Map();
const failures = [];

// Exercise the runtime SVG safety validator and actual browser rasterization,
// including the source edges at both review scales and in both orientations.
async function checkEdges(svg, asset) {
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    for (const size of [200, 400]) {
      canvas.width = canvas.height = size;
      for (const flip of [false, true]) {
        context.clearRect(0, 0, size, size);
        context.save();
        if (flip) { context.translate(size, 0); context.scale(-1, 1); }
        context.drawImage(image, 0, 0, size, size);
        context.restore();
        const pixels = context.getImageData(0, 0, size, size).data;
        let hasArt = false;
        let touchesEdge = false;
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const alpha = pixels[(y * size + x) * 4 + 3];
            if (!alpha) continue;
            hasArt = true;
            if (x === 0 || y === 0 || x === size - 1 || y === size - 1) touchesEdge = true;
          }
        }
        if (!hasArt || touchesEdge) throw new Error(`${asset.id}: ${hasArt ? 'art touches source edge' : 'empty render'} at ${size}px${flip ? ', flipped' : ''}`);
      }
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

function draw() {
  const filter = fields.pack.value;
  const entries = props.filter(asset => filter === 'all'
    || (filter === 'comparison' ? ['prop_plant', 'fh_paper_flowers'].includes(asset.id) : asset.metadata.dlc === filter));
  const main = document.querySelector('main');
  main.dataset.zoom = fields.scale.value;
  main.replaceChildren();
  for (const asset of entries) {
    const card = document.createElement('article');
    card.dataset.assetId = asset.id;
    const stage = document.createElement('div');
    stage.className = 'stage';
    const frame = document.createElement('div');
    const fit = Math.min(230 / asset.displayWidth, 220 / asset.displayHeight, 1);
    stage.style.height = `${Math.max(240, asset.displayHeight * fit * Number(fields.scale.value) + 20)}px`;
    frame.style.width = `${asset.displayWidth * fit * Number(fields.scale.value)}px`;
    frame.style.height = `${asset.displayHeight * fit * Number(fields.scale.value)}px`;
    frame.style.transform = fields.flip.checked ? 'scaleX(-1)' : '';
    const svg = artwork.get(asset.id);
    if (svg) frame.append(svg.cloneNode(true));
    stage.append(frame);
    const title = document.createElement('h2');
    title.textContent = asset.name;
    const metadata = document.createElement('small');
    metadata.textContent = `${asset.id} · ${asset.displayWidth} × ${asset.displayHeight}`;
    const tray = document.createElement('div');
    tray.className = 'tray';
    if (svg) {
      const thumbnail = svg.cloneNode(true);
      thumbnail.style.transform = frame.style.transform;
      tray.append(thumbnail);
    }
    const label = document.createElement('small');
    label.textContent = '56px tray preview';
    tray.append(label);
    card.append(stage, title, metadata, tray);
    main.append(card);
  }
}

for (const field of ['pack', 'scale', 'flip']) fields[field].addEventListener('change', draw);
await Promise.all(props.map(async asset => {
  try {
    const svg = await loadAssetSvg(asset.id);
    artwork.set(asset.id, svg);
    await checkEdges(svg, asset);
  } catch (error) {
    failures.push(error.message);
  }
}));
fields.status.dataset.result = failures.length ? 'fail' : 'pass';
fields.status.textContent = failures.length
  ? `${failures.length} issues: ${failures.join('; ')}`
  : `${artwork.size} / ${props.length} props pass SVG loading and transparent-edge checks at 100%, 200% and flipped.`;
draw();
