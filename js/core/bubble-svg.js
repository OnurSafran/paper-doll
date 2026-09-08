/**
 * Procedural speech, thought, shout, and caption bubble SVG generator.
 * Provides exact visual and geometric parity across DOM preview and canvas export.
 */

import { LIMITS } from '../domain/vocabulary.js';

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
export function createSvgElement(tag) {
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
