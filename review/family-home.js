import { PACK_REGISTRY } from '../js/packs/index.js';
import { FAMILY_OUTFITS } from '../js/packs/family-home/recipes.js';
import { FAMILY_TEMPLATES } from '../js/packs/family-home/stories.js';
import { createDefaultFace } from '../js/domain/outfit-rules.js';
import { createExportDollSvg } from '../js/core/doll-svg.js';
import { instantiateSceneTemplate } from '../js/domain/scene-templates.js';
import { renderSceneThumbnail } from '../js/features/scene-book/scene-book-view.js';
import { setLanguage, t } from '../js/core/i18n.js';
setLanguage('en');
const fields = Object.fromEntries(['kind', 'prev', 'next', 'page', 'status'].map(id => [id, document.getElementById(id)]));
let page = 0;
async function draw() {
  const kind = fields.kind.value;
  const entries = kind === 'outfits' ? FAMILY_OUTFITS : kind === 'scenes' ? FAMILY_TEMPLATES : PACK_REGISTRY.assetsByKind(kind, { packId: 'pack_family_home' });
  const pages = Math.ceil(entries.length / 8);
  page = Math.min(Math.max(page, 0), pages - 1);
  fields.page.textContent = `${page + 1} / ${pages}`;
  const main = document.querySelector('main');
  main.replaceChildren();
  for (const item of entries.slice(page * 8, page * 8 + 8)) {
    const card = document.createElement('article');
    const art = document.createElement('div');
    const label = document.createElement('h2');
    label.textContent = t(item.nameKey || item.titleKey) || item.name;
    card.append(art, label); main.append(card);
    if (kind === 'outfits' || kind === 'wearable') {
      const doll = kind === 'outfits' ? item : PACK_REGISTRY.assetsByKind('doll').find(d => d.fitFamily === item.supportedFitFamilies[0]);
      const draft = kind === 'outfits' ? item : { baseDollId: doll.id, skinTone: 'peach', face: createDefaultFace(doll.id), slots: { [item.slot]: { assetId: item.id, color: item.defaultColors.primary } } };
      art.append(await createExportDollSvg(draft, 'smile', { getAsset: PACK_REGISTRY.getAsset }));
    } else if (kind === 'scenes') {
      await renderSceneThumbnail(art, instantiateSceneTemplate(item.id), { getAsset: PACK_REGISTRY.getAsset });
    } else {
      const image = document.createElement('img'); image.src = item.path; art.append(image);
    }
  }
  fields.status.textContent = `${entries.length} entries · rendered page ${page + 1}`;
}
fields.kind.onchange = () => { page = 0; void draw(); };
fields.prev.onclick = () => { page--; void draw(); };
fields.next.onclick = () => { page++; void draw(); };
void draw();
