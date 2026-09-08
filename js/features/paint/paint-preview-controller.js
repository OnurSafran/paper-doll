/** Alignment guides and frame-throttled live previews. */
import { getReferenceGuides, guideIsInBounds } from './paint-guides.js';

export function createPaintPreviewController(context) {
  let livePreviewToken = 0;

  let livePreviewMode = null;

  let livePreviewCanvas = null;

  let livePreviewDollWrap = null;

  let livePreviewDollId = null;

  const previewStage = /** @type {HTMLElement} */ (context.rootElement.querySelector('#paint-preview-stage'));

  async function renderGuideLayer() {
    if (!context.guideLayer) return;
    const token = ++context.guideRenderToken;
    context.guideLayer.replaceChildren();
    const state = context.session.getState();
    context.guideLayer.style.setProperty('--reference-opacity', String(state.referenceOpacity / 100));

    if (state.itemType === 'wearable') {
      const doc = context.guideLayer.ownerDocument || document;
      const baseDollId = state.baseDollId || 'doll_classic_a';
      const bodyLayer = doc.createElement('div');
      bodyLayer.className = 'paint-reference-body';
      bodyLayer.hidden = !state.referenceVisible;
      context.guideLayer.appendChild(bodyLayer);

      const cutout = context.getTrustedCutout(state.cutoutAssetId, state.slot);
      if (cutout?.path && state.cutoutReferenceVisible) {
        const cutoutImage = doc.createElement('img');
        cutoutImage.className = 'paint-reference-cutout';
        cutoutImage.src = cutout.path;
        cutoutImage.alt = '';
        cutoutImage.setAttribute('aria-hidden', 'true');
        context.guideLayer.appendChild(cutoutImage);
      }

      if (state.guidesVisible) {
        context.guideLayer.appendChild(createAlignmentGuideSvg(doc, state.slot, baseDollId));
      }

      if (context.svgLoader && state.referenceVisible) {
        try {
          const dollSvg = await context.svgLoader.load(baseDollId);
          if (dollSvg && token === context.guideRenderToken && context.session.getState().itemType === 'wearable' &&
              context.session.getState().baseDollId === baseDollId) {
            const clone = dollSvg.cloneNode(true);
            clone.setAttribute('aria-hidden', 'true');
            bodyLayer.appendChild(clone);
          }
        } catch {
          // ignore
        }
      }
    } else {
      const groundLine = document.createElement('div');
      groundLine.className = 'paint-guide-groundline';
      context.guideLayer.appendChild(groundLine);
    }
  }

  function createAlignmentGuideSvg(doc, slot, modelId) {
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = doc.createElementNS(namespace, 'svg');
    svg.setAttribute('class', 'paint-alignment-guides');
    svg.setAttribute('viewBox', '0 0 300 450');
    svg.setAttribute('aria-hidden', 'true');

    for (const guide of getReferenceGuides(slot, modelId).filter(guideIsInBounds)) {
      let shape;
      if (guide.type === 'line') {
        shape = doc.createElementNS(namespace, 'line');
        for (const attr of ['x1', 'y1', 'x2', 'y2']) shape.setAttribute(attr, String(guide[attr]));
      } else if (guide.type === 'ellipse') {
        shape = doc.createElementNS(namespace, 'ellipse');
        for (const attr of ['cx', 'cy', 'rx', 'ry']) shape.setAttribute(attr, String(guide[attr]));
      } else {
        shape = doc.createElementNS(namespace, 'circle');
        shape.setAttribute('cx', String(guide.x));
        shape.setAttribute('cy', String(guide.y));
        shape.setAttribute('r', '4');
      }
      shape.setAttribute('class', `paint-guide-shape paint-guide-${guide.type}`);
      svg.appendChild(shape);

      const text = doc.createElementNS(namespace, 'text');
      const labelX = guide.x ?? guide.x1 ?? guide.cx;
      const labelY = guide.y ?? guide.y1 ?? (guide.cy - guide.ry);
      text.setAttribute('x', String(Math.min(250, labelX + 6)));
      text.setAttribute('y', String(Math.max(12, labelY - 5)));
      text.setAttribute('class', 'paint-guide-label');
      text.textContent = guide.label;
      svg.appendChild(text);
    }
    return svg;
  }

  function scheduleLivePreview() {
    if (context.previewRafId !== null) return;
    if (typeof requestAnimationFrame === 'function') {
      context.previewRafId = requestAnimationFrame(() => {
        context.previewRafId = null;
        updateLivePreview();
      });
    } else {
      updateLivePreview();
    }
  }

  function flushLivePreview() {
    if (context.previewRafId !== null) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(context.previewRafId);
      }
      context.previewRafId = null;
    }
    updateLivePreview();
  }

  async function updateLivePreview() {
    if (!previewStage) return;
    const renderToken = ++livePreviewToken;
    const state = context.session.getState();
    const mode = state.itemType === 'wearable' ? 'wearable' : 'prop';

    if (mode !== livePreviewMode) {
      previewStage.replaceChildren();
      livePreviewMode = mode;
      livePreviewCanvas = null;
      livePreviewDollWrap = null;
      livePreviewDollId = null;
    }

    if (!livePreviewCanvas) {
      livePreviewCanvas = document.createElement('canvas');
      livePreviewCanvas.style.width = '100%';
      livePreviewCanvas.style.height = '100%';
      livePreviewCanvas.style.position = 'absolute';
      livePreviewCanvas.style.inset = '0';
      livePreviewCanvas.style.zIndex = '2';
    }
    if (livePreviewCanvas.width !== context.canvas.width) livePreviewCanvas.width = context.canvas.width;
    if (livePreviewCanvas.height !== context.canvas.height) livePreviewCanvas.height = context.canvas.height;
    livePreviewCanvas.getContext('2d').drawImage(context.canvas, 0, 0);

    if (state.itemType === 'wearable') {
      if (!livePreviewDollWrap) {
        livePreviewDollWrap = document.createElement('div');
        livePreviewDollWrap.className = 'preview-doll-mini';
        livePreviewDollWrap.style.position = 'relative';
        livePreviewDollWrap.style.width = '100%';
        livePreviewDollWrap.style.height = '100%';
        livePreviewDollWrap.appendChild(livePreviewCanvas);
        previewStage.appendChild(livePreviewDollWrap);
      }

      if (context.svgLoader) {
        const baseDollId = state.baseDollId || 'doll_classic_a';
        if (baseDollId !== livePreviewDollId) {
          livePreviewDollId = baseDollId;
          livePreviewDollWrap.querySelector?.('.preview-doll-base')?.remove?.();
          try {
            const dollSvg = await context.svgLoader.load(baseDollId);
            if (renderToken !== livePreviewToken || context.session.getState().itemType !== 'wearable') return;
            if (dollSvg) {
            const clone = dollSvg.cloneNode(true);
            clone.classList.add('preview-doll-base');
            clone.setAttribute('aria-hidden', 'true');
            clone.style.width = '100%';
            clone.style.height = '100%';
            clone.style.position = 'absolute';
            clone.style.inset = '0';
            clone.style.opacity = '0.75';
            livePreviewDollWrap.insertBefore(clone, livePreviewCanvas);
            }
          } catch {
            // ignore
          }
        }
      }
    } else {
      livePreviewCanvas.className = 'preview-prop-mini';
      if (livePreviewCanvas.parentNode !== previewStage) previewStage.appendChild(livePreviewCanvas);
    }
  }

  return { renderGuideLayer, createAlignmentGuideSvg, scheduleLivePreview, flushLivePreview, updateLivePreview };
}
