/**
 * Mouth Expression Engine
 * Applies facial expressions to doll SVGs with intensity modulation.
 */

import { DEFAULT_EXPRESSION_INTENSITY } from '../domain/vocabulary.js';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(val) {
  return Math.round(val * 100) / 100;
}

/**
 * Applies an expression and intensity to the mouth layer of a doll SVG.
 */
export function applyMouthExpression(svg, expression, intensity = DEFAULT_EXPRESSION_INTENSITY) {
  if (!svg || typeof svg.querySelector !== 'function') return;

  let mouthEl = svg.querySelector('#doll-mouth-expression');
  if (!mouthEl) {
    const ownerDoc = svg.ownerDocument || globalThis.document;
    if (!ownerDoc?.createElementNS) return;
    mouthEl = ownerDoc.createElementNS('http://www.w3.org/2000/svg', 'g');
    mouthEl.id = 'doll-mouth-expression';
    const parentG = svg.querySelector('#face-feature') || svg.querySelector('#body') || svg;
    if (typeof parentG?.appendChild === 'function') {
      parentG.appendChild(mouthEl);
    }
  }

  const faceFeatureG = svg.querySelector('#face-feature');
  const defaultSmile = svg.querySelector('#doll-mouth-default') ||
    svg.querySelector('path[d*="146 73"]') ||
    svg.querySelector('path[d="M146 73 C148 76 152 76 154 73"]');

  const normalizedIntensity = Number.isFinite(intensity)
    ? clamp(intensity, 0.1, 1.5)
    : DEFAULT_EXPRESSION_INTENSITY;

  const roundedIntensity = round(normalizedIntensity);
  const cacheKey = `${expression || 'neutral'}:${roundedIntensity}`;
  const currentKey = mouthEl.dataset ? mouthEl.dataset.renderedKey : mouthEl.getAttribute?.('data-rendered-key');
  if (currentKey === cacheKey) {
    return;
  }
  if (mouthEl.dataset) {
    mouthEl.dataset.renderedKey = cacheKey;
  } else if (typeof mouthEl.setAttribute === 'function') {
    mouthEl.setAttribute('data-rendered-key', cacheKey);
  }

  if (!expression || expression === 'neutral') {
    mouthEl.innerHTML = '';
    if (faceFeatureG) {
      for (const child of faceFeatureG.children) {
        if (child !== mouthEl) child.style.display = '';
      }
    } else {
      const curveY = round(74.5 + (normalizedIntensity - 0.65) * 1.5);
      mouthEl.innerHTML = `<path d="M146 73 C148 ${curveY} 152 ${curveY} 154 73" fill="none" stroke="#2d261e" stroke-width="2" stroke-linecap="round"/>`;
    }
    if (defaultSmile) defaultSmile.style.display = '';
    return;
  }

  if (faceFeatureG) {
    for (const child of faceFeatureG.children) {
      if (child !== mouthEl) child.style.display = 'none';
    }
  }
  if (defaultSmile) defaultSmile.style.display = 'none';

  const scale = 0.75 + normalizedIntensity * 0.45; // ~0.9 at subtle (0.35), 1.04 at normal (0.65), 1.20 at amplified (1.0)

  if (expression === 'smile') {
    const halfW = round(6 * (0.8 + normalizedIntensity * 0.35));
    const depth = round(72 + 5 * (0.6 + normalizedIntensity * 0.65));
    mouthEl.innerHTML = `<path d="M${150 - halfW} 72 C${150 - halfW / 2} ${depth} ${150 + halfW / 2} ${depth} ${150 + halfW} 72" fill="none" stroke="#2d261e" stroke-width="2" stroke-linecap="round"/>`;
  } else if (expression === 'happy') {
    const halfW = round(6 * (0.8 + normalizedIntensity * 0.35));
    const bottomY = round(71 + 7 * (0.65 + normalizedIntensity * 0.55));
    mouthEl.innerHTML = `<path d="M${150 - halfW} 71 C${150 - halfW} ${bottomY} ${150 + halfW} ${bottomY} ${150 + halfW} 71 Z" fill="#e76f51" stroke="#2d261e" stroke-width="1.8" stroke-linecap="round"/>`;
  } else if (expression === 'surprised') {
    const rx = round(3.2 * scale);
    const ry = round(4.5 * scale);
    mouthEl.innerHTML = `<ellipse cx="150" cy="73.5" rx="${rx}" ry="${ry}" fill="#b84e50" stroke="#2d261e" stroke-width="1.8"/>`;
  } else if (expression === 'o_mouth') {
    const rx = round(2.5 * scale);
    const ry = round(3.2 * scale);
    const r = round(1.2 * scale);
    mouthEl.innerHTML = `<ellipse cx="150" cy="73.2" rx="${rx}" ry="${ry}" fill="#b84e50" stroke="#2d261e" stroke-width="1.8"/><circle cx="150" cy="73.2" r="${r}" fill="#3a1b1b"/>`;
  } else if (expression === 'talking') {
    const halfW = round(5 * (0.8 + normalizedIntensity * 0.35));
    const bottomY = round(71 + 6 * (0.65 + normalizedIntensity * 0.55));
    const upperY = round(73.5 + (normalizedIntensity - 0.65) * 1.2);
    mouthEl.innerHTML = `<path d="M${150 - halfW} 71 C${150 - halfW} ${bottomY} ${150 + halfW} ${bottomY} ${150 + halfW} 71 Q 150 ${upperY} ${150 - halfW} 71 Z" fill="#b84e50" stroke="#2d261e" stroke-width="1.8" stroke-linecap="round"/><path d="M${150 - halfW + 2} 73 Q 150 75 ${150 + halfW - 2} 73" fill="none" stroke="#fad2cf" stroke-width="1" stroke-linecap="round"/>`;
  } else if (expression === 'wide_open') {
    const halfW = round(7 * (0.8 + normalizedIntensity * 0.35));
    const bottomY = round(69.5 + 9.5 * (0.65 + normalizedIntensity * 0.55));
    const upperY = round(71.5 + (normalizedIntensity - 0.65) * 1.5);
    const tongueY = round(75.2 + (normalizedIntensity - 0.65) * 1.2);
    const tongueRx = round(3.5 * scale);
    const tongueRy = round(1.8 * scale);
    mouthEl.innerHTML = `<path d="M${150 - halfW} 69.5 C${150 - halfW} ${bottomY} ${150 + halfW} ${bottomY} ${150 + halfW} 69.5 Q 150 ${upperY} ${150 - halfW} 69.5 Z" fill="#b84e50" stroke="#2d261e" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="150" cy="${tongueY}" rx="${tongueRx}" ry="${tongueRy}" fill="#e76f51"/>`;
  } else {
    mouthEl.innerHTML = '<path d="M146 73 C148 75 152 75 154 73" fill="none" stroke="#2d261e" stroke-width="2" stroke-linecap="round"/>';
  }
}
