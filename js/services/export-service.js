/**
 * Export Service
 * Single authority for deterministic PNG scene export with immutable snapshot isolation.
 */

import { getAsset } from '../core/asset-catalog.js';
import { loadAssetSvg } from '../core/svg-loader.js';
import { paletteValue } from '../core/palette.js';
import { cloneScene } from '../core/state-schema.js';
import { t } from '../core/i18n.js';
import { getEntityBounds } from '../domain/scene-rules.js';
import { isDefaultFace, isWearableCompatible } from '../domain/outfit-rules.js';
import {
  CHARACTER_DIMENSIONS,
  DEFAULT_BASE_DOLL_ID,
  DEFAULT_EXPRESSION,
  LIMITS,
  isCustomAssetId
} from '../domain/vocabulary.js';

export function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

/**
 * Applies mouth expression geometry to a character doll SVG DOM.
 */
export function applyMouthExpression(svg, expression) {
  let mouthEl = svg.querySelector('#doll-mouth-expression');
  if (!mouthEl) {
    mouthEl = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    mouthEl.id = 'doll-mouth-expression';
    const parentG = svg.querySelector('#face-feature') || svg.querySelector('#body') || svg;
    parentG.appendChild(mouthEl);
  }

  const faceFeatureG = svg.querySelector('#face-feature');
  const defaultSmile = svg.querySelector('#doll-mouth-default')
    || svg.querySelector('path[d*="146 73"]')
    || svg.querySelector('path[d="M146 73 C148 76 152 76 154 73"]');

  if (!expression || expression === 'neutral') {
    if (faceFeatureG) {
      mouthEl.innerHTML = '';
      for (const child of faceFeatureG.children) {
        if (child !== mouthEl) child.style.display = '';
      }
    } else {
      mouthEl.innerHTML = '<path d="M146 73 C148 75 152 75 154 73" fill="none" stroke="#2d261e" stroke-width="2" stroke-linecap="round"/>';
    }
    if (defaultSmile) {
      defaultSmile.style.display = '';
    }
    return;
  }

  // Active non-neutral expression: hide resting mouth shapes
  if (faceFeatureG) {
    for (const child of faceFeatureG.children) {
      if (child !== mouthEl) child.style.display = 'none';
    }
  }
  if (defaultSmile) defaultSmile.style.display = 'none';

  mouthEl.innerHTML = '';
  if (expression === 'smile') {
    mouthEl.innerHTML = '<path d="M144 72 C147 77 153 77 156 72" fill="none" stroke="#2d261e" stroke-width="2" stroke-linecap="round"/>';
  } else if (expression === 'happy') {
    mouthEl.innerHTML = '<path d="M144 71 C144 78 156 78 156 71 Z" fill="#e76f51" stroke="#2d261e" stroke-width="1.8" stroke-linecap="round"/>';
  } else if (expression === 'surprised') {
    mouthEl.innerHTML = '<ellipse cx="150" cy="73.5" rx="3.2" ry="4.5" fill="#b84e50" stroke="#2d261e" stroke-width="1.8"/>';
  } else if (expression === 'o_mouth') {
    mouthEl.innerHTML = '<ellipse cx="150" cy="73.2" rx="2.5" ry="3.2" fill="#b84e50" stroke="#2d261e" stroke-width="1.8"/><circle cx="150" cy="73.2" r="1.2" fill="#3a1b1b"/>';
  } else if (expression === 'talking') {
    mouthEl.innerHTML = '<path d="M145 71 C145 77 155 77 155 71 Q 150 74 145 71 Z" fill="#b84e50" stroke="#2d261e" stroke-width="1.8" stroke-linecap="round"/><path d="M147 73 Q 150 75 153 73" fill="none" stroke="#fad2cf" stroke-width="1" stroke-linecap="round"/>';
  } else if (expression === 'wide_open') {
    mouthEl.innerHTML = '<path d="M143 69.5 C143 79 157 79 157 69.5 Q 150 72 143 69.5 Z" fill="#b84e50" stroke="#2d261e" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="150" cy="75.2" rx="3.5" ry="1.8" fill="#e76f51"/>';
  } else {
    mouthEl.innerHTML = '<path d="M146 73 C148 75 152 75 154 73" fill="none" stroke="#2d261e" stroke-width="2" stroke-linecap="round"/>';
  }
}

/**
 * Converts an SVG DOM element to an HTMLImageElement for canvas drawing.
 */
export function svgElementToImage(svgElement, width, height) {
  return new Promise((resolve, reject) => {
    const clone = svgElement.cloneNode(true);
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Composites layered SVG geometry for an exported character doll.
 */
export async function createExportDollSvg(draft, expression = DEFAULT_EXPRESSION, options = {}) {
  const loadSvg = options.loadAssetSvg ?? loadAssetSvg;
  const resolveAsset = options.getAsset ?? getAsset;
  const customArtRepo = options.customArtRepo;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 300 450');
  svg.setAttribute('width', '300');
  svg.setAttribute('height', '450');
  svg.style.setProperty('--skin-color', paletteValue(draft?.skinTone, 'peach'));

  const layers = [];
  const hair = draft?.slots?.hair;
  const showBakedFace = isDefaultFace(draft?.face, draft?.baseDollId) && expression === DEFAULT_EXPRESSION;
  if (hair && isWearableCompatible(draft, resolveAsset(hair.assetId), resolveAsset) && !isCustomAssetId(hair.assetId)) {
    layers.push([10, hair.assetId, hair.color, 'hairBack', 'hair']);
  }
  layers.push([20, draft?.baseDollId || DEFAULT_BASE_DOLL_ID, null, null, 'skin']);

  const face = draft?.face;
  if (face && !showBakedFace) {
    if (face.eyes) layers.push([22, face.eyes.assetId, null, null, 'face-eyes', face.eyes.irisColor]);
    if (face.eyebrows) layers.push([24, face.eyebrows.assetId, null, null, 'face-eyebrows']);
    if (face.detail) layers.push([25, face.detail.assetId, null, null, 'face-detail']);
    if (face.nose) layers.push([26, face.nose.assetId, null, null, 'face-nose']);
    if (face.mouth) layers.push([28, face.mouth.assetId, null, null, 'face-mouth']);
  }

  for (const [slot, order] of [['bottom', 30], ['shoes', 35], ['top', 40], ['dress', 45]]) {
    const item = draft?.slots?.[slot];
    if (item && isWearableCompatible(draft, resolveAsset(item.assetId), resolveAsset)) {
      layers.push([order, item.assetId, item.color, null, slot]);
    }
  }
  if (hair && isWearableCompatible(draft, resolveAsset(hair.assetId), resolveAsset)) {
    layers.push([70, hair.assetId, hair.color, 'hairFront', 'hair']);
  }
  const accessory = draft?.slots?.accessory;
  if (accessory && isWearableCompatible(draft, resolveAsset(accessory.assetId), resolveAsset)) {
    layers.push([80, accessory.assetId, accessory.color, null, 'accessory']);
  }

  for (const [order, id, color, group, slot, extra] of layers) {
    try {
      if (isCustomAssetId(id)) {
        const url = await customArtRepo?.getTrackedObjectUrl?.(id) || await options.getCustomArtUrl?.(id);
        if (url) {
          const imgEl = document.createElementNS('http://www.w3.org/2000/svg', 'image');
          imgEl.setAttribute('href', url);
          imgEl.setAttribute('x', '0');
          imgEl.setAttribute('y', '0');
          imgEl.setAttribute('width', '300');
          imgEl.setAttribute('height', '450');
          imgEl.setAttribute('preserveAspectRatio', 'none');
          svg.appendChild(imgEl);
          continue;
        }
      }
      const assetSvg = await loadSvg(id);
      const clone = assetSvg.cloneNode(true);
      const groupEl = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      groupEl.style.setProperty('--skin-color', paletteValue(draft?.skinTone, 'peach'));
      groupEl.style.setProperty('--hair-color', paletteValue(color, 'brown'));
      groupEl.style.setProperty('--asset-color-primary', paletteValue(color, 'coral'));
      if (slot === 'face-eyes' && extra) {
        groupEl.style.setProperty('--iris-color', paletteValue(extra, 'cocoa'));
      }
      if (group) {
        for (const candidate of ['hairBack', 'hairFront']) {
          const node = clone.querySelector(`#${candidate}`);
          if (node && candidate !== group) node.style.display = 'none';
        }
      }
      if (slot === 'skin') {
        const baked = clone.querySelector('#baked-face');
        if (baked && face) {
          baked.style.display = 'none';
        } else if (!face) {
          applyMouthExpression(clone, expression);
        }
      }
      if (slot === 'face-mouth') {
        if (expression && expression !== 'neutral') {
          applyMouthExpression(clone, expression);
        }
      }
      while (clone.firstChild) groupEl.appendChild(clone.firstChild);
      svg.appendChild(groupEl);
    } catch {
      const placeholder = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      placeholder.setAttribute('data-missing-layer', slot || 'asset');
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '90');
      rect.setAttribute('y', slot === 'hair' ? '20' : '55');
      rect.setAttribute('width', '120');
      rect.setAttribute('height', '24');
      rect.setAttribute('rx', '6');
      rect.setAttribute('fill', '#fff4d6');
      rect.setAttribute('stroke', '#8b6f47');
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', '150');
      label.setAttribute('y', slot === 'hair' ? '36' : '71');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '9');
      label.setAttribute('fill', '#5d4930');
      label.textContent = t('designer.missingArtwork');
      placeholder.appendChild(rect);
      placeholder.appendChild(label);
      svg.appendChild(placeholder);
    }
  }
  return svg;
}

/**
 * Wraps text into lines given an approximate character line capacity.
 */
export function wrapBubbleText(text, maxCharsPerLine = 22) {
  if (!text) return [''];
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}

/**
 * Creates an SVG Element safely across browser DOM and Node.js environments.
 */
function createSvgElement(tag) {
  if (typeof globalThis.document !== 'undefined' && globalThis.document.createElementNS) {
    return globalThis.document.createElementNS('http://www.w3.org/2000/svg', tag);
  }
  const attrs = new Map();
  const children = [];
  return {
    tagName: tag,
    style: {},
    className: { baseVal: '' },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.get(name) ?? null; },
    appendChild(child) { children.push(child); return child; },
    append(...nodes) { children.push(...nodes); },
    replaceChildren(...nodes) { children.length = 0; children.push(...nodes); },
    get textContent() { return this._text || ''; },
    set textContent(v) { this._text = v; },
    querySelector(sel) {
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        if (this.className?.baseVal?.includes(cls)) return this;
        for (const c of children) {
          const match = c.querySelector?.(sel);
          if (match) return match;
        }
      } else if (sel === 'text') {
        if (this.tagName === 'text') return this;
        for (const c of children) {
          const match = c.querySelector?.(sel);
          if (match) return match;
        }
      }
      return null;
    },
    cloneNode() { return createSvgElement(tag); }
  };
}

/**
 * Creates an SVG Element representing a speech, thought, shout, or caption bubble.
 */
export function createBubbleSvg(entity) {
  const width = Math.round(Number(entity?.width) || LIMITS.DEFAULT_BUBBLE_WIDTH);
  const text = typeof entity?.text === 'string' ? entity.text : 'Hello!';
  const style = entity?.bubbleStyle || 'speech';

  const charsPerLine = Math.max(10, Math.floor(width / 11));
  const lines = wrapBubbleText(text, charsPerLine);
  const lineHeight = 20;
  const paddingY = 16;
  const textBlockHeight = lines.length * lineHeight;
  const tailHeight = style === 'caption' ? 0 : 18;
  const bubbleBodyHeight = Math.max(48, textBlockHeight + paddingY * 2);
  const totalHeight = bubbleBodyHeight + tailHeight;

  const svg = createSvgElement('svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${totalHeight}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(totalHeight));
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.style.overflow = 'visible';

  const g = createSvgElement('g');
  g.className.baseVal = `bubble-shape bubble-${style}`;

  if (style === 'speech') {
    const rx = 16;
    const bodyW = width - 4;
    const bodyH = bubbleBodyHeight;
    const tailX = width / 2;
    const pathD = `
      M ${rx + 2} 2
      H ${bodyW - rx}
      A ${rx} ${rx} 0 0 1 ${bodyW} ${rx + 2}
      V ${bodyH - rx}
      A ${rx} ${rx} 0 0 1 ${bodyW - rx} ${bodyH}
      H ${tailX + 12}
      L ${tailX} ${totalHeight - 2}
      L ${tailX - 8} ${bodyH}
      H ${rx + 2}
      A ${rx} ${rx} 0 0 1 2 ${bodyH - rx}
      V ${rx + 2}
      A ${rx} ${rx} 0 0 1 ${rx + 2} 2
      Z
    `.replace(/\s+/g, ' ').trim();

    const path = createSvgElement('path');
    path.setAttribute('d', pathD);
    path.setAttribute('fill', '#ffffff');
    path.setAttribute('stroke', '#2d261e');
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('stroke-linejoin', 'round');
    g.appendChild(path);
  } else if (style === 'thought') {
    const rx = 20;
    const bodyW = width - 4;
    const bodyH = bubbleBodyHeight;
    const rect = createSvgElement('rect');
    rect.setAttribute('x', '2');
    rect.setAttribute('y', '2');
    rect.setAttribute('width', String(bodyW));
    rect.setAttribute('height', String(bodyH));
    rect.setAttribute('rx', String(rx));
    rect.setAttribute('ry', String(rx));
    rect.setAttribute('fill', '#ffffff');
    rect.setAttribute('stroke', '#2d261e');
    rect.setAttribute('stroke-width', '2.5');
    g.appendChild(rect);

    const tailX = width / 2;
    const circles = [
      { cx: tailX, cy: bodyH + 5, r: 4.5 },
      { cx: tailX - 4, cy: bodyH + 11, r: 3 },
      { cx: tailX - 7, cy: bodyH + 15, r: 1.8 }
    ];
    for (const c of circles) {
      const circle = createSvgElement('circle');
      circle.setAttribute('cx', String(c.cx));
      circle.setAttribute('cy', String(c.cy));
      circle.setAttribute('r', String(c.r));
      circle.setAttribute('fill', '#ffffff');
      circle.setAttribute('stroke', '#2d261e');
      circle.setAttribute('stroke-width', '2');
      g.appendChild(circle);
    }
  } else if (style === 'shout') {
    const w = width - 4;
    const h = bubbleBodyHeight;
    const tailX = width / 2;
    const points = [
      `2,${h * 0.3}`, `12,8`, `${w * 0.25},2`, `${w * 0.4},10`, `${w * 0.6},2`, `${w * 0.75},10`, `${w - 8},4`,
      `${w},${h * 0.35}`, `${w - 6},${h * 0.55}`, `${w},${h * 0.75}`, `${w - 10},${h - 4}`,
      `${w * 0.75},${h - 2}`, `${w * 0.6},${h - 8}`, `${tailX + 14},${h - 2}`, `${tailX},${totalHeight - 1}`, `${tailX - 8},${h - 2}`,
      `${w * 0.35},${h - 8}`, `${w * 0.2},${h - 2}`, `8,${h - 6}`, `2,${h * 0.7}`, `8,${h * 0.5}`
    ];
    const polygon = createSvgElement('polygon');
    polygon.setAttribute('points', points.join(' '));
    polygon.setAttribute('fill', '#fffdf2');
    polygon.setAttribute('stroke', '#d93829');
    polygon.setAttribute('stroke-width', '2.5');
    polygon.setAttribute('stroke-linejoin', 'round');
    g.appendChild(polygon);
  } else {
    const rect = createSvgElement('rect');
    rect.setAttribute('x', '2');
    rect.setAttribute('y', '2');
    rect.setAttribute('width', String(width - 4));
    rect.setAttribute('height', String(bubbleBodyHeight));
    rect.setAttribute('rx', '6');
    rect.setAttribute('fill', '#fff9ee');
    rect.setAttribute('stroke', '#7c5e3f');
    rect.setAttribute('stroke-width', '2.5');
    g.appendChild(rect);

    const bar = createSvgElement('rect');
    bar.setAttribute('x', '2');
    bar.setAttribute('y', '2');
    bar.setAttribute('width', String(width - 4));
    bar.setAttribute('height', '5');
    bar.setAttribute('rx', '3');
    bar.setAttribute('fill', '#d4a373');
    g.appendChild(bar);
  }

  const startY = (bubbleBodyHeight - textBlockHeight) / 2 + lineHeight * 0.75;
  const textColor = style === 'shout' ? '#8b0000' : (style === 'caption' ? '#4a3525' : '#2d261e');
  const fontWeight = style === 'shout' ? 'bold' : '600';

  lines.forEach((line, index) => {
    const textEl = createSvgElement('text');
    textEl.setAttribute('x', String(width / 2));
    textEl.setAttribute('y', String(startY + index * lineHeight));
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('fill', textColor);
    textEl.setAttribute('font-family', 'system-ui, -apple-system, sans-serif');
    textEl.setAttribute('font-size', '14px');
    textEl.setAttribute('font-weight', fontWeight);
    textEl.textContent = line;
    g.appendChild(textEl);
  });

  svg.appendChild(g);
  return svg;
}

/**
 * Creates an Export Service instance that renders snapshot-isolated PNG images.
 */
export function createExportService(options = {}) {
  let isExporting = false;
  let activeGeneration = 0;
  let abortController = null;
  const getAssetFn = options.getAsset ?? getAsset;
  const loadSvgFn = options.loadAssetSvg ?? loadAssetSvg;
  const toImageFn = options.svgElementToImage ?? svgElementToImage;
  const customArtRepo = options.customArtRepo;
  const now = options.now ?? (() => new Date());
  const onProgress = options.onProgress ?? (() => {});

  function cancel() {
    if (abortController) {
      abortController.abort();
    }
    onProgress({ percent: 0, phase: 'cancelled' });
  }

  async function renderSceneToCanvas(sceneSnapshot, canvas = document.createElement('canvas'), signal = null) {
    if (signal?.aborted) throw new Error('Export cancelled');
    const snapshot = cloneScene(sceneSnapshot);
    const stageWidth = snapshot.stageWidth || LIMITS.STAGE_WIDTH;
    canvas.width = stageWidth;
    canvas.height = LIMITS.STAGE_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not acquire 2D canvas context');

    try {
      const bgSvg = await loadSvgFn(snapshot.backgroundId);
      const bgImg = await toImageFn(bgSvg, LIMITS.STAGE_WIDTH, LIMITS.STAGE_HEIGHT);
      for (let x = 0; x < stageWidth; x += LIMITS.STAGE_WIDTH) {
        ctx.drawImage(bgImg, x, 0, LIMITS.STAGE_WIDTH, LIMITS.STAGE_HEIGHT);
      }
    } catch {
      ctx.fillStyle = '#f6efe4';
      ctx.fillRect(0, 0, stageWidth, LIMITS.STAGE_HEIGHT);
    }

    const ordered = [...snapshot.entities].sort((a, b) => a.order - b.order);
    for (const entity of ordered) {
      if (signal?.aborted) throw new Error('Export cancelled');
      ctx.save();
      ctx.translate(entity.x, entity.y);
      const flipSign = entity.flipped ? -1 : 1;
      ctx.scale(flipSign * entity.scale, entity.scale);

      if (entity.kind === 'character') {
        const dollSvg = await createExportDollSvg(entity.characterSnapshot, entity.expression || DEFAULT_EXPRESSION, {
          loadAssetSvg: loadSvgFn,
          customArtRepo,
          getAsset: getAssetFn
        });
        const dollImg = await toImageFn(dollSvg, 300, 450);
        ctx.drawImage(
          dollImg,
          -CHARACTER_DIMENSIONS.BASE_WIDTH * CHARACTER_DIMENSIONS.GROUND_ANCHOR.x,
          -CHARACTER_DIMENSIONS.BASE_HEIGHT * CHARACTER_DIMENSIONS.GROUND_ANCHOR.y,
          CHARACTER_DIMENSIONS.BASE_WIDTH,
          CHARACTER_DIMENSIONS.BASE_HEIGHT
        );
      } else if (entity.kind === 'bubble') {
        const bounds = getEntityBounds(entity, getAssetFn);
        const bubbleSvg = createBubbleSvg(entity);
        const renderW = bounds.width / entity.scale;
        const renderH = bounds.height / entity.scale;
        const bubbleImg = await toImageFn(bubbleSvg, renderW, renderH);
        ctx.drawImage(
          bubbleImg,
          -renderW * bounds.anchorX,
          -renderH * bounds.anchorY,
          renderW,
          renderH
        );
      } else {
        const bounds = getEntityBounds(entity, getAssetFn);
        const renderW = bounds.width / entity.scale;
        const renderH = bounds.height / entity.scale;
        const asset = getAssetFn(entity.sourceId);
        let rendered = false;
        if (isCustomAssetId(entity.sourceId)) {
          const url = await customArtRepo?.getTrackedObjectUrl?.(entity.sourceId);
          if (url) {
            try {
              const propImg = await loadImageFromUrl(url);
              ctx.drawImage(
                propImg,
                -renderW * bounds.anchorX,
                -renderH * bounds.anchorY,
                renderW,
                renderH
              );
              rendered = true;
            } catch {
              rendered = false;
            }
          }
        } else if (asset) {
          try {
            const propSvg = await loadSvgFn(asset.id);
            const propImg = await toImageFn(propSvg, renderW, renderH);
            ctx.drawImage(
              propImg,
              -renderW * bounds.anchorX,
              -renderH * bounds.anchorY,
              renderW,
              renderH
            );
            rendered = true;
          } catch {
            rendered = false;
          }
        }
        if (!rendered) {
          const px = -renderW * bounds.anchorX;
          const py = -renderH * bounds.anchorY;
          ctx.fillStyle = 'rgba(235, 230, 220, 0.85)';
          ctx.strokeStyle = '#c4b5a2';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(px, py, renderW, renderH);
          ctx.fillRect(px, py, renderW, renderH);
          ctx.setLineDash([]);
          ctx.fillStyle = '#8c7e6c';
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('?', px + renderW / 2, py + renderH / 2);
        }
      }
      ctx.restore();
    }

    return canvas;
  }

  async function exportSceneBlob(sceneSnapshot, { onProgress: progressCb, signal } = {}) {
    if (isExporting) {
      return { ok: false, code: 'EXPORT_IN_PROGRESS', message: 'An export is already in progress.' };
    }
    isExporting = true;
    const currentGeneration = ++activeGeneration;
    abortController = new AbortController();
    const onExternalAbort = () => abortController?.abort();
    if (signal?.aborted) abortController.abort();
    else signal?.addEventListener('abort', onExternalAbort, { once: true });
    const effectiveSignal = abortController.signal;
    const reportProgress = progressCb || onProgress;

    try {
      reportProgress({ percent: 10, phase: 'preparing' });
      if (effectiveSignal.aborted) throw new Error('Export cancelled');
      const snapshot = cloneScene(sceneSnapshot);
      reportProgress({ percent: 30, phase: 'rendering' });
      const canvas = await renderSceneToCanvas(snapshot, document.createElement('canvas'), effectiveSignal);
      if (effectiveSignal.aborted) throw new Error('Export cancelled');
      reportProgress({ percent: 75, phase: 'encoding' });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) {
        return { ok: false, code: 'BLOB_CREATION_FAILED', message: 'Could not generate PNG image blob.' };
      }
      if (effectiveSignal.aborted) throw new Error('Export cancelled');
      reportProgress({ percent: 100, phase: 'complete' });
      const filename = `paper-doll-scene-${now().toISOString().slice(0, 10)}.png`;
      return { ok: true, blob, filename };
    } catch (error) {
      if (effectiveSignal?.aborted || error?.message === 'Export cancelled') {
        return { ok: false, code: 'EXPORT_CANCELLED', message: 'Export was cancelled.' };
      }
      return { ok: false, code: 'EXPORT_FAILED', error, message: 'Could not export scene image.' };
    } finally {
      signal?.removeEventListener('abort', onExternalAbort);
      if (activeGeneration === currentGeneration) {
        isExporting = false;
        abortController = null;
      }
    }
  }

  async function exportSceneAndDownload(sceneSnapshot, exportOptions = {}) {
    const result = await exportSceneBlob(sceneSnapshot, exportOptions);
    if (!result.ok) return result;

    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 6000);
    return { ok: true, filename: result.filename };
  }

  return {
    isExporting: () => isExporting,
    cancel,
    renderSceneToCanvas,
    exportSceneBlob,
    exportSceneAndDownload
  };
}
