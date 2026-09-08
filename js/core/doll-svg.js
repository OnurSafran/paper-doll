/**
 * Composites layered SVG geometry for an exported or previewed character doll.
 * Shares full styling and rigging parity with the stage renderer.
 */

import { getAsset, getLimbBoundChannel, isHeadBoundLayer, isLimbBoundLayer } from './asset-catalog.js';
import { loadAssetSvg } from './svg-loader.js';
import { paletteValue, customColorOutline } from './palette.js';
import { t } from './i18n.js';
import { isDefaultFace, isWearableCompatible } from '../domain/outfit-rules.js';
import { applyMouthExpression } from './mouth-expression.js';
import {
  DEFAULT_BASE_DOLL_ID,
  DEFAULT_EXPRESSION,
  DEFAULT_EXPRESSION_INTENSITY,
  isCustomAssetId
} from '../domain/vocabulary.js';

export function createJointTransformAttr(t, pivot) {
  if (!t || (!t.x && !t.y && !t.rotate && (t.scaleX === undefined || t.scaleX === 1) && (t.scaleY === undefined || t.scaleY === 1))) {
    return '';
  }
  const px = pivot?.x ?? 150;
  const py = pivot?.y ?? 90;
  const tx = t.x || 0;
  const ty = t.y || 0;
  const rot = t.rotate || 0;
  const sx = t.scaleX ?? 1;
  const sy = t.scaleY ?? 1;
  return `translate(${tx}, ${ty}) translate(${px}, ${py}) rotate(${rot}) scale(${sx}, ${sy}) translate(${-px}, ${-py})`;
}

/**
 * Composites layered SVG geometry for an exported character doll.
 */
export async function createExportDollSvg(draft, expression = DEFAULT_EXPRESSION, options = {}) {
  const loadSvg = options.loadAssetSvg ?? loadAssetSvg;
  const resolveAsset = options.getAsset ?? getAsset;
  const customArtRepo = options.customArtRepo;
  const enforceFit = options.enforceFit !== false;
  const expressionIntensity = options.expressionIntensity ?? draft?.expressionIntensity ?? DEFAULT_EXPRESSION_INTENSITY;
  const canRenderWearable = (item) => item && (!enforceFit || isWearableCompatible(draft, resolveAsset(item.assetId), resolveAsset));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 300 450');
  svg.setAttribute('width', '300');
  svg.setAttribute('height', '450');
  svg.style.setProperty('--skin-color', paletteValue(draft?.skinTone, 'peach'));

  const baseDoll = resolveAsset(draft?.baseDollId || DEFAULT_BASE_DOLL_ID);
  const headPivot = baseDoll?.headPivot || { x: 150, y: 90 };
  const shoulderLeftPivot = baseDoll?.shoulderLeftPivot || { x: 126, y: 120 };
  const shoulderRightPivot = baseDoll?.shoulderRightPivot || { x: 174, y: 120 };
  const hipLeftPivot = baseDoll?.hipLeftPivot || { x: 138, y: 230 };
  const hipRightPivot = baseDoll?.hipRightPivot || { x: 162, y: 230 };

  const head = options.headTransform || options.pose?.head;
  const armLeft = options.armLeftTransform || options.pose?.armLeft;
  const armRight = options.armRightTransform || options.pose?.armRight;
  const legLeft = options.legLeftTransform || options.pose?.legLeft;
  const legRight = options.legRightTransform || options.pose?.legRight;

  const headTransformAttr = createJointTransformAttr(head, headPivot);
  const armLeftTransformAttr = createJointTransformAttr(armLeft, shoulderLeftPivot);
  const armRightTransformAttr = createJointTransformAttr(armRight, shoulderRightPivot);
  const legLeftTransformAttr = createJointTransformAttr(legLeft, hipLeftPivot);
  const legRightTransformAttr = createJointTransformAttr(legRight, hipRightPivot);

  const eyesHeadTransform = (head || Number.isFinite(options.blinkScaleY))
    ? {
        x: head?.x || 0,
        y: head?.y || 0,
        rotate: head?.rotate || 0,
        scaleX: head?.scaleX ?? 1,
        scaleY: (head?.scaleY ?? 1) * (Number.isFinite(options.blinkScaleY) ? options.blinkScaleY : 1)
      }
    : null;
  const eyesTransformAttr = createJointTransformAttr(eyesHeadTransform, headPivot);

  const layers = [];
  const hair = draft?.slots?.hair;
  const showBakedFace = isDefaultFace(draft?.face, draft?.baseDollId) && expression === DEFAULT_EXPRESSION;
  if (hair && canRenderWearable(hair) && !isCustomAssetId(hair.assetId)) {
    layers.push([10, hair.assetId, hair.color, 'hairBack', 'hair']);
  }
  const customFullId = draft?.customArtId || (isCustomAssetId(draft?.baseDollId) ? draft?.baseDollId : null) || (draft?.kind === 'custom_full' ? (draft?.customArtId || draft?.baseDollId) : null);
  const isCustomFull = Boolean(draft?.kind === 'custom_full' || customFullId);
  if (isCustomFull && customFullId) {
    layers.push([20, customFullId, null, null, 'skin']);
  } else {
    layers.push([20, draft?.baseDollId || DEFAULT_BASE_DOLL_ID, null, null, 'skin']);
  }

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
    if (canRenderWearable(item)) {
      layers.push([resolveAsset(item.assetId)?.layerOrder ?? order, item.assetId, item.color, null, slot]);
    }
  }
  if (canRenderWearable(hair)) {
    layers.push([70, hair.assetId, hair.color, 'hairFront', 'hair']);
  }
  const accessory = draft?.slots?.accessory;
  if (canRenderWearable(accessory)) {
    layers.push([80, accessory.assetId, accessory.color, null, 'accessory']);
  }

  for (const [order, id, color, group, slot, extra] of layers.sort((a, b) => a[0] - b[0])) {
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
      groupEl.style.setProperty('--asset-outline-color', customColorOutline(color));
      if (slot === 'face-eyes') {
        if (extra) {
          groupEl.style.setProperty('--iris-color', paletteValue(extra, 'cocoa'));
        }
      }
      if (group) {
        for (const candidate of ['hairBack', 'hairFront']) {
          const node = clone.querySelector(`#${candidate}`);
          if (node && candidate !== group) node.style.display = 'none';
        }
      }
      if (slot === 'skin') {
        const baked = clone.querySelector('#baked-face');
        if (baked && face && !showBakedFace) {
          baked.style.display = 'none';
        } else if (!face) {
          applyMouthExpression(clone, expression, expressionIntensity);
        }
      }
      if (headTransformAttr) {
        const poseHead = clone.querySelector('#pose-head');
        if (poseHead) poseHead.setAttribute('transform', headTransformAttr);
      }
      if (armLeftTransformAttr) {
        const armLeftEl = clone.querySelector('#pose-arm-left') || clone.querySelector('#arm-left');
        if (armLeftEl) armLeftEl.setAttribute('transform', armLeftTransformAttr);
      }
      if (armRightTransformAttr) {
        const armRightEl = clone.querySelector('#pose-arm-right') || clone.querySelector('#arm-right');
        if (armRightEl) armRightEl.setAttribute('transform', armRightTransformAttr);
      }
      if (legLeftTransformAttr) {
        const legLeftEl = clone.querySelector('#pose-leg-left') || clone.querySelector('#leg-left');
        if (legLeftEl) legLeftEl.setAttribute('transform', legLeftTransformAttr);
      }
      if (legRightTransformAttr) {
        const legRightEl = clone.querySelector('#pose-leg-right') || clone.querySelector('#leg-right');
        if (legRightEl) legRightEl.setAttribute('transform', legRightTransformAttr);
      }

      if (slot !== 'skin') {
        if (slot === 'face-eyes' && eyesTransformAttr) {
          groupEl.setAttribute('transform', eyesTransformAttr);
        } else if (headTransformAttr && isHeadBoundLayer(slot, id, resolveAsset)) {
          groupEl.setAttribute('transform', headTransformAttr);
        } else {
          const limbChannel = getLimbBoundChannel(slot, id, resolveAsset);
          if (limbChannel === 'armLeft' && armLeftTransformAttr) {
            groupEl.setAttribute('transform', armLeftTransformAttr);
          } else if (limbChannel === 'armRight' && armRightTransformAttr) {
            groupEl.setAttribute('transform', armRightTransformAttr);
          } else if (limbChannel === 'legLeft' && legLeftTransformAttr) {
            groupEl.setAttribute('transform', legLeftTransformAttr);
          } else if (limbChannel === 'legRight' && legRightTransformAttr) {
            groupEl.setAttribute('transform', legRightTransformAttr);
          }
        }
      }
      if (slot === 'face-mouth') {
        if (expression && expression !== 'neutral') {
          applyMouthExpression(clone, expression, expressionIntensity);
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
