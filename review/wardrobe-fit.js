import { ASSETS, getAsset } from '../js/core/asset-catalog.js';
import { paletteValue } from '../js/core/palette.js';
import { loadAssetSvg } from '../js/core/svg-loader.js';
import { wearablePreviewViewBox } from '../js/core/preview-viewboxes.js';
import { createStarterDraft, createDefaultFace } from '../js/domain/outfit-rules.js';
import { appendAsset, renderDollInto } from '../js/features/designer/designer-view.js';
import { createExportDollSvg } from '../js/core/doll-svg.js';
import { svgElementToImage } from '../js/services/export-service.js';

const wearables = ASSETS.filter(a => a.kind === 'wearable');
const dolls = ASSETS.filter(a => a.kind === 'doll');
const fields = Object.fromEntries(['slot', 'mode', 'color', 'previous', 'next', 'page', 'status', 'checks'].map(id => [id, document.getElementById(id)]));
let page = 0;
let renderVersion = 0;
const outfitCases = [
  ['doll_classic_a', 'top_tshirt', 'bottom_overalls', 'shoes_sneakers', 'hair_long', 'accessory_hat'],
  ['doll_classic_b', 'top_hoodie', 'bottom_skirt', 'shoes_rainboots', 'hair_bun', 'accessory_glasses'],
  ['doll_baby_a', 'top_tee_baby', 'bottom_leggings_baby', 'shoes_sneakers_baby', 'hair_baby_curl', 'accessory_rattle_baby'],
  ['doll_chibi_a', 'top_tshirt_child', 'bottom_jeans_child', 'shoes_sneakers_child', 'hair_bob_child', 'accessory_backpack_child'],
  ['doll_adult_a', 'top_cardigan_classic', 'bottom_slacks_adult', 'shoes_loafers', 'hair_short_slick', 'accessory_spectacles_elder'],
  ['doll_elder_a', 'top_coat_adult', 'bottom_trousers_classic', 'shoes_oxfords_classic', 'hair_silver_waves', 'accessory_shawl_elder']
];
function draftFor(dollId, ids) {
  const draft = createStarterDraft();
  draft.baseDollId = dollId;
  draft.face = createDefaultFace(dollId);
  draft.slots = {};
  for (const id of ids) {
    const asset = getAsset(id);
    draft.slots[asset.slot] = { assetId: id, color: fields.color.value === 'default' ? asset.defaultColors.primary : fields.color.value };
  }
  return draft;
}
async function draw() {
  const version = ++renderVersion;
  const entries = fields.slot.value === 'outfits'
    ? outfitCases.map(([dollId, ...ids]) => ({ doll: getAsset(dollId), ids }))
    : wearables.filter(a => a.slot === fields.slot.value).flatMap(a => dolls.filter(d => a.supportedFitFamilies.includes(d.fitFamily)).map(doll => ({ doll, ids: [a.id] })));
  const pages = Math.ceil(entries.length / 12);
  page = Math.min(Math.max(page, 0), pages - 1);
  fields.page.textContent = `${page + 1} / ${pages}`;
  fields.previous.disabled = page === 0;
  fields.next.disabled = page === pages - 1;
  const main = document.querySelector('main');
  main.replaceChildren();
  main.dataset.ready = "false";
  for (const { doll, ids } of entries.slice(page * 12, page * 12 + 12)) {
    if (version !== renderVersion) return;
    const card = document.createElement('article');
    const title = document.createElement('h2'); title.textContent = ids.length === 1 ? ids[0] : 'Complete outfit';
    const name = document.createElement('p'); name.textContent = doll.name;
    const fit = document.createElement('div'); fit.className = 'fit';
    card.append(title, name, fit); main.append(card);
    const draft = draftFor(doll.id, ids);
    const crop = { top: '75 95 150 150', bottom: '95 105 110 310', dress: '60 95 180 330', shoes: '100 320 100 105', hair: '75 0 150 255', accessory: '85 0 145 240' }[fields.slot.value] ?? '60 0 180 430';
    if (fields.mode.value === 'preview' && ids.length === 1) {
      await appendAsset(fit, ids[0], { isPreview: true, color: draft.slots[getAsset(ids[0]).slot].color });
    } else if (fields.mode.value === 'designer') {
      await renderDollInto(fit, draft);
      for (const svg of fit.querySelectorAll('svg')) svg.setAttribute('viewBox', crop);
    } else {
      const svg = await createExportDollSvg(draft);
      if (svg.querySelector('[data-missing-layer]')) throw new Error('Missing export layer');
      svg.setAttribute('viewBox', crop);
      const [, , width, height] = crop.split(' ').map(Number);
      const image = await svgElementToImage(svg, width * 2, height * 2);
      image.style.objectFit = 'contain';
      fit.append(image);
    }
  }
  if (version === renderVersion) main.dataset.ready = 'true';
}
for (const field of ['slot', 'mode', 'color']) fields[field].onchange = () => { page = 0; draw(); };
fields.previous.onclick = () => { page--; draw(); };
fields.next.onclick = () => { page++; draw(); };

async function pixels(svg) {
  const image = await svgElementToImage(svg, 300, 450);
  const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 450;
  const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, 300, 450).data;
}
const at = (data, x, y) => Array.from(data.slice((y * 300 + x) * 4, (y * 300 + x) * 4 + 4));
async function checkWardrobe() {
  const errors = [];
  let checks = 0;
  const check = (ok, message) => { checks++; if (!ok) errors.push(message); };
  const masks = new Map();
  for (const asset of wearables) {
    const svg = await loadAssetSvg(asset.id);
    svg.style.setProperty('--asset-color-primary', '#1265ab');
    svg.style.setProperty('--hair-color', '#1265ab');
    const measurement = document.createElement('div'); measurement.className = 'measurement';
    measurement.append(svg); document.body.append(measurement);
    const bounds = svg.getBBox();
    check(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 300 && bounds.y + bounds.height <= 450, `${asset.id}: artwork extends outside its canvas`);
    measurement.remove();
    const data = await pixels(svg); masks.set(asset.id, data);
    let tinted = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] === 18 && data[i + 1] === 101 && data[i + 2] === 171 && data[i + 3] > 200) tinted++;
    check(tinted > 0, `${asset.id}: primary color is missing from standalone export`);
    const [x, y, w, h] = wearablePreviewViewBox(asset).split(' ').map(Number);
    let outside = 0;
    for (let py = 0; py < 450; py++) for (let px = 0; px < 300; px++) {
      if (data[(py * 300 + px) * 4 + 3] > 100 && (px < x || px > x + w || py < y || py > y + h)) outside++;
    }
    check(outside === 0, `${asset.id}: ${outside} painted pixels outside wardrobe thumbnail`);
  }
  const covered = {
    bottom_cargo: [[125, 205], [175, 205], [150, 230]],
    bottom_culottes: [[125, 205], [175, 205], [150, 230]],
    bottom_leggings_baby: [[120, 210], [180, 210], [150, 235]],
    bottom_slacks_adult: [[150, 220], [150, 232]],
    dress_romper_baby: [[121, 237], [179, 237]],
    dress_pinafore: [[130, 160], [170, 160]],
    dress_play_child: [[125, 160], [175, 160]],
    dress_sun_baby: [[118, 165], [182, 165]],
    dress_party_baby: [[118, 165], [182, 165]],
    accessory_rattle_baby: [[202, 193]],
    shoes_loafers: [[114, 411], [143, 411], [157, 411], [186, 411]],
    shoes_oxfords_classic: [[114, 411], [143, 411], [157, 411], [186, 411]]
  };
  for (const [id, points] of Object.entries(covered)) for (const [x, y] of points) check(at(masks.get(id), x, y)[3] > 200, `${id}: coverage gap at ${x},${y}`);
  for (const id of ['accessory_glasses', 'accessory_spectacles_elder', 'accessory_bonnet_baby', 'accessory_hairclip', 'accessory_flower']) {
    for (const x of [136, 164]) check(at(masks.get(id), x, 61)[3] < 100, `${id}: covers an eye at ${x},61`);
  }
  const longHair = await loadAssetSvg('hair_long'); longHair.querySelector('#hairBack').remove();
  const hairPixels = await pixels(longHair);
  for (const x of [136, 164]) check(at(hairPixels, x, 61)[3] === 0, 'Long fringe covers an eye');
  // Verify the real two render paths, including recoloring and layer order.
  const draft = draftFor('doll_classic_a', ['top_tshirt', 'bottom_overalls']);
  const exported = await createExportDollSvg(draft);
  const result = await pixels(exported);
  const expected = paletteValue(draft.slots.bottom.color).match(/[0-9a-f]{2}/g).map(hex => parseInt(hex, 16));
  check(at(result, 135, 156).slice(0, 3).every((v, i) => v === expected[i]), 'Overalls bib is hidden by the shirt in export');
  const stage = document.createElement('div'); stage.className = 'measurement'; document.body.append(stage);
  await renderDollInto(stage, draft);
  check(Number(stage.querySelector('[data-slot="bottom"]').style.zIndex) > Number(stage.querySelector('[data-slot="top"]').style.zIndex), 'Designer hides overalls under shirt');
  stage.remove();
  fields.status.dataset.result = errors.length ? 'fail' : 'pass';
  fields.status.textContent = `${checks - errors.length}/${checks} checks passed across ${wearables.length} wearables.`;
  fields.checks.textContent = errors.length ? errors.join('\n') : 'Standalone recoloring, thumbnail bounds, coverage landmarks, clear eyes, hand attachment, and designer/export layering passed.';
}
try { await draw(); await checkWardrobe(); } catch (error) { fields.status.dataset.result = 'fail'; fields.status.textContent = error.stack; }
