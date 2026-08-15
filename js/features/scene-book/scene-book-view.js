/**
 * Scene Book (Scene Library) & Templates Feature Module
 * Owns saved scene collections, high-fidelity composite vector thumbnails,
 * template showcase, open/save/update/duplicate/delete dialogs.
 */

import { getAsset } from '../../core/asset-catalog.js';
import { loadAssetSvg } from '../../core/svg-loader.js';
import { createBubbleSvg, createExportDollSvg } from '../../services/export-service.js';
import { getEntityBounds } from '../../domain/scene-rules.js';
import { CHARACTER_DIMENSIONS, DEFAULT_EXPRESSION, defaultMakeId } from '../../domain/vocabulary.js';
import { createStarterDraft } from '../../domain/outfit-rules.js';
import { instantiateSceneTemplate, SCENE_TEMPLATES } from '../../domain/scene-templates.js';

/**
 * Creates a high-fidelity composite vector SVG representing a full scene (background + entities).
 */
export async function createCompositeSceneThumbnailSvg(scene, options = {}) {
  const loadSvg = options.loadAssetSvg ?? loadAssetSvg;
  const getAssetFn = options.getAsset ?? getAsset;

  const rootSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  rootSvg.setAttribute('viewBox', '0 0 1600 900');
  rootSvg.setAttribute('width', '100%');
  rootSvg.setAttribute('height', '100%');
  rootSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  rootSvg.style.display = 'block';

  // 1. Background layer
  try {
    const bgSvg = await loadSvg(scene.backgroundId);
    const bgG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    bgG.setAttribute('class', 'scene-thumb-bg');

    const vbStr = bgSvg.getAttribute?.('viewBox') || '0 0 800 500';
    const vbParts = vbStr.trim().split(/[\s,]+/).map(Number);
    const bvx = Number.isFinite(vbParts[0]) ? vbParts[0] : 0;
    const bvy = Number.isFinite(vbParts[1]) ? vbParts[1] : 0;
    const bvw = Number.isFinite(vbParts[2]) && vbParts[2] > 0 ? vbParts[2] : 800;
    const bvh = Number.isFinite(vbParts[3]) && vbParts[3] > 0 ? vbParts[3] : 500;

    const bgScale = Math.max(1600 / bvw, 900 / bvh);
    const bgOffsetX = (1600 - bvw * bgScale) / 2 - bvx * bgScale;
    const bgOffsetY = (900 - bvh * bgScale) / 2 - bvy * bgScale;
    bgG.setAttribute('transform', `translate(${bgOffsetX}, ${bgOffsetY}) scale(${bgScale})`);

    const clone = bgSvg.cloneNode(true);
    while (clone.firstChild) bgG.appendChild(clone.firstChild);
    rootSvg.appendChild(bgG);
  } catch {
    const fallbackRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    fallbackRect.setAttribute('width', '1600');
    fallbackRect.setAttribute('height', '900');
    fallbackRect.setAttribute('fill', '#f6efe4');
    rootSvg.appendChild(fallbackRect);
  }

  // 2. Ordered entity layers
  const ordered = [...(scene.entities || [])].sort((a, b) => a.order - b.order);
  for (const entity of ordered) {
    const flipSign = entity.flipped ? -1 : 1;
    const entityScale = entity.scale ?? 1;
    const entityG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    entityG.setAttribute('transform', `translate(${entity.x}, ${entity.y}) scale(${flipSign * entityScale}, ${entityScale})`);

    if (entity.kind === 'character') {
      try {
        const dollSvg = await createExportDollSvg(
          entity.characterSnapshot || {},
          entity.expression || DEFAULT_EXPRESSION,
          { loadAssetSvg: loadSvg }
        );
        const dollG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const scaleX = CHARACTER_DIMENSIONS.BASE_WIDTH / 300;
        const scaleY = CHARACTER_DIMENSIONS.BASE_HEIGHT / 450;
        const offsetX = -CHARACTER_DIMENSIONS.BASE_WIDTH * CHARACTER_DIMENSIONS.GROUND_ANCHOR.x;
        const offsetY = -CHARACTER_DIMENSIONS.BASE_HEIGHT * CHARACTER_DIMENSIONS.GROUND_ANCHOR.y;
        dollG.setAttribute('transform', `translate(${offsetX}, ${offsetY}) scale(${scaleX}, ${scaleY})`);
        while (dollSvg.firstChild) dollG.appendChild(dollSvg.firstChild);
        entityG.appendChild(dollG);
      } catch {
        // graceful placeholder fallback
      }
    } else if (entity.kind === 'bubble') {
      try {
        const bounds = getEntityBounds(entity, getAssetFn);
        const bubbleSvg = createBubbleSvg(entity);
        const renderW = bounds.width / entityScale;
        const renderH = bounds.height / entityScale;
        const bubbleG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        bubbleG.setAttribute('transform', `translate(${-renderW * bounds.anchorX}, ${-renderH * bounds.anchorY})`);
        while (bubbleSvg.firstChild) bubbleG.appendChild(bubbleSvg.firstChild);
        entityG.appendChild(bubbleG);
      } catch {
        // graceful placeholder fallback
      }
    } else {
      const bounds = getEntityBounds(entity, getAssetFn);
      const renderW = bounds.width / entityScale;
      const renderH = bounds.height / entityScale;
      const asset = getAssetFn(entity.sourceId);
      let rendered = false;
      if (asset) {
        try {
          const propSvg = await loadSvg(asset.id);
          const propG = document.createElementNS('http://www.w3.org/2000/svg', 'g');

          const vbStr = propSvg.getAttribute?.('viewBox') || '0 0 1000 1000';
          const vbParts = vbStr.trim().split(/[\s,]+/).map(Number);
          const pvx = Number.isFinite(vbParts[0]) ? vbParts[0] : 0;
          const pvy = Number.isFinite(vbParts[1]) ? vbParts[1] : 0;
          const pvw = Number.isFinite(vbParts[2]) && vbParts[2] > 0 ? vbParts[2] : 1000;
          const pvh = Number.isFinite(vbParts[3]) && vbParts[3] > 0 ? vbParts[3] : 1000;

          const uniformScale = Math.min(renderW / pvw, renderH / pvh);
          const fittedW = pvw * uniformScale;
          const fittedH = pvh * uniformScale;
          const alignOffsetX = (renderW - fittedW) / 2;
          const alignOffsetY = (renderH - fittedH) / 2;

          const propOffsetX = -renderW * bounds.anchorX + alignOffsetX - pvx * uniformScale;
          const propOffsetY = -renderH * bounds.anchorY + alignOffsetY - pvy * uniformScale;

          propG.setAttribute('transform', `translate(${propOffsetX}, ${propOffsetY}) scale(${uniformScale})`);
          const clone = propSvg.cloneNode(true);
          while (clone.firstChild) propG.appendChild(clone.firstChild);
          entityG.appendChild(propG);
          rendered = true;
        } catch {
          rendered = false;
        }
      }
      if (!rendered) {
        const placeholderG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        placeholderG.setAttribute('transform', `translate(${-renderW * bounds.anchorX}, ${-renderH * bounds.anchorY})`);
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', String(renderW));
        rect.setAttribute('height', String(renderH));
        rect.setAttribute('rx', '8');
        rect.setAttribute('fill', '#f5f0eb');
        rect.setAttribute('stroke', '#d0c4b4');
        rect.setAttribute('stroke-dasharray', '4,4');
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(renderW / 2));
        text.setAttribute('y', String(renderH / 2 + 5));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#8c7e6c');
        text.setAttribute('font-size', '14');
        text.setAttribute('font-weight', 'bold');
        text.textContent = '?';
        placeholderG.appendChild(rect);
        placeholderG.appendChild(text);
        entityG.appendChild(placeholderG);
      }
    }
    rootSvg.appendChild(entityG);
  }

  return rootSvg;
}

/**
 * Asynchronously renders a full composite thumbnail into a container.
 */
export async function renderSceneThumbnail(container, scene, options = {}) {
  try {
    const compositeSvg = await createCompositeSceneThumbnailSvg(scene, options);
    container.replaceChildren(compositeSvg);
  } catch {
    container.style.background = 'var(--paper-deep)';
  }
}

export function createSceneBookView({
  store,
  $,
  $$,
  askConfirm,
  miniButton
}) {
  let libraryRenderToken = 0;

  async function renderSceneLibrary(state = store.getState()) {
    const token = ++libraryRenderToken;
    const grid = $('#scene-library-grid');
    if (!grid) return;

    if (!state.scenes?.length) {
      grid.innerHTML = `
        <div class="tray-empty" style="grid-column: 1 / -1; padding: 2.5rem 1rem; text-align: center;">
          <p><strong>Your Scene Book is ready.</strong></p>
          <p class="panel-copy">Save your current stage layout or try a Scene Template to start your collection!</p>
        </div>
      `;
      return;
    }

    const cards = [];
    for (const scene of state.scenes) {
      const card = document.createElement('article');
      card.className = `scene-card${scene.sceneId === state.ui.activeSceneLibraryId ? ' is-active-scene' : ''}`;

      const thumb = document.createElement('div');
      thumb.className = 'scene-card-thumb';
      thumb.setAttribute('aria-hidden', 'true');
      void renderSceneThumbnail(thumb, scene).then(() => {
        if (token !== libraryRenderToken) thumb.replaceChildren();
      });

      const info = document.createElement('div');
      info.className = 'scene-card-info';

      const title = document.createElement('div');
      title.className = 'scene-card-title';
      title.textContent = scene.title;
      title.title = scene.title;

      const meta = document.createElement('div');
      meta.className = 'scene-card-meta';
      const bgName = getAsset(scene.backgroundId)?.name ?? 'Scene';
      const updatedDate = new Date(scene.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      meta.textContent = `${bgName} · ${scene.entities.length} item${scene.entities.length === 1 ? '' : 's'} · ${updatedDate}`;

      info.append(title, meta);

      const actions = document.createElement('div');
      actions.className = 'scene-card-actions';

      const loadBtn = document.createElement('button');
      loadBtn.type = 'button';
      loadBtn.className = 'button primary';
      loadBtn.textContent = 'Open';
      loadBtn.title = `Load "${scene.title}" onto stage`;
      loadBtn.addEventListener('click', async () => {
        const hasEntities = store.getState().currentScene.entities.length > 0;
        if (!hasEntities || await askConfirm(`Open "${scene.title}"?`, 'This will replace the current stage layout.')) {
          store.dispatch({ type: 'scene/loadFromLibrary', sceneId: scene.sceneId });
          $('#scene-library-dialog')?.close();
        }
      });

      const renameBtn = miniButton('Aa', `Rename "${scene.title}"`, () => {
        const nextTitle = window.prompt('Rename this scene', scene.title);
        if (nextTitle != null && nextTitle.trim()) {
          store.dispatch({ type: 'scene/renameLibraryScene', sceneId: scene.sceneId, name: nextTitle });
          void renderSceneLibrary();
        }
      });

      const dupBtn = miniButton('⧉', `Duplicate "${scene.title}"`, () => {
        store.dispatch({ type: 'scene/duplicateLibraryScene', sceneId: scene.sceneId });
        void renderSceneLibrary();
      });

      const delBtn = miniButton('×', `Delete "${scene.title}"`, async () => {
        if (await askConfirm(`Delete "${scene.title}"?`, 'This removes the scene from your Scene Book.')) {
          store.dispatch({ type: 'scene/deleteLibraryScene', sceneId: scene.sceneId });
          void renderSceneLibrary();
        }
      });

      actions.append(loadBtn, renameBtn, dupBtn, delBtn);
      card.append(thumb, info, actions);
      cards.push(card);
    }
    grid.replaceChildren(...cards);
  }

  async function renderSceneTemplates(state = store.getState()) {
    const grid = $('#scene-templates-grid');
    if (!grid) return;

    const cards = [];
    for (const template of SCENE_TEMPLATES) {
      const card = document.createElement('article');
      card.className = 'scene-card template-card';

      const thumb = document.createElement('div');
      thumb.className = 'scene-card-thumb';
      thumb.setAttribute('aria-hidden', 'true');

      const starterDraft = state.designer?.draft || state.presets?.[0] || createStarterDraft();
      const previewScene = instantiateSceneTemplate(template.id, defaultMakeId, starterDraft);
      if (previewScene) void renderSceneThumbnail(thumb, previewScene);

      const info = document.createElement('div');
      info.className = 'scene-card-info';

      const catBadge = document.createElement('span');
      catBadge.className = 'template-badge';
      catBadge.textContent = template.category;

      const title = document.createElement('div');
      title.className = 'scene-card-title';
      title.textContent = template.title;

      const desc = document.createElement('p');
      desc.className = 'panel-copy template-desc';
      desc.textContent = template.description;

      info.append(catBadge, title, desc);

      const actions = document.createElement('div');
      actions.className = 'scene-card-actions';

      const loadBtn = document.createElement('button');
      loadBtn.type = 'button';
      loadBtn.className = 'button primary';
      loadBtn.textContent = 'Load Template';
      loadBtn.title = `Load "${template.title}" onto stage`;
      loadBtn.addEventListener('click', async () => {
        const hasEntities = store.getState().currentScene.entities.length > 0;
        if (!hasEntities || await askConfirm(`Load "${template.title}"?`, 'This will replace the current stage layout.')) {
          store.dispatch({ type: 'scene/loadTemplate', templateId: template.id });
          $('#scene-templates-dialog')?.close();
        }
      });

      actions.append(loadBtn);
      card.append(thumb, info, actions);
      cards.push(card);
    }
    grid.replaceChildren(...cards);
  }

  function openSaveSceneDialog(state = store.getState()) {
    const activeLib = state.scenes?.find((s) => s.sceneId === state.ui.activeSceneLibraryId);
    const titleInput = $('#scene-title-input');
    if (titleInput) {
      titleInput.value = activeLib ? activeLib.title : (state.currentScene.title !== 'Current Scene' ? state.currentScene.title : '');
    }
    const updateBtn = $('#update-existing-scene');
    if (updateBtn) updateBtn.disabled = !activeLib;
    $('#save-scene-dialog')?.showModal();
  }

  function openSceneLibraryDialog() {
    void renderSceneLibrary();
    $('#scene-library-dialog')?.showModal();
  }

  function openSceneTemplatesDialog() {
    void renderSceneTemplates();
    $('#scene-templates-dialog')?.showModal();
  }

  return {
    renderSceneLibrary,
    renderSceneTemplates,
    openSaveSceneDialog,
    openSceneLibraryDialog,
    openSceneTemplatesDialog
  };
}
