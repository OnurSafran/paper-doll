const LOGICAL_WIDTH = 300;
const LOGICAL_HEIGHT = 450;

export const REFERENCE_MODELS = Object.freeze([
  Object.freeze({ id: 'doll_classic_a', label: 'Classic' }),
  Object.freeze({ id: 'doll_classic_b', label: 'Joy' }),
  Object.freeze({ id: 'doll_chibi_a', label: 'Chibi' })
]);

const MODEL_TRANSFORMS = Object.freeze({
  doll_classic_a: Object.freeze({ xScale: 1, yScale: 1, xOffset: 0, yOffset: 0 }),
  doll_classic_b: Object.freeze({ xScale: 0.98, yScale: 1, xOffset: 3, yOffset: 0 }),
  doll_chibi_a: Object.freeze({ xScale: 0.9, yScale: 0.84, xOffset: 15, yOffset: 28 })
});

const SLOT_GUIDES = Object.freeze({
  top: Object.freeze([
    { type: 'line', label: 'Shoulders', x1: 75, y1: 112, x2: 225, y2: 112 },
    { type: 'point', label: 'Neck', x: 150, y: 92 },
    { type: 'line', label: 'Bust', x1: 92, y1: 160, x2: 208, y2: 160 },
    { type: 'line', label: 'Waist', x1: 96, y1: 222, x2: 204, y2: 222 }
  ]),
  dress: Object.freeze([
    { type: 'line', label: 'Shoulders', x1: 75, y1: 112, x2: 225, y2: 112 },
    { type: 'point', label: 'Neck', x: 150, y: 92 },
    { type: 'line', label: 'Bust', x1: 92, y1: 160, x2: 208, y2: 160 },
    { type: 'line', label: 'Waist', x1: 96, y1: 222, x2: 204, y2: 222 },
    { type: 'line', label: 'Hem range', x1: 66, y1: 370, x2: 234, y2: 370 }
  ]),
  bottom: Object.freeze([
    { type: 'line', label: 'Waist', x1: 96, y1: 222, x2: 204, y2: 222 },
    { type: 'line', label: 'Hip', x1: 86, y1: 260, x2: 214, y2: 260 },
    { type: 'line', label: 'Knee', x1: 94, y1: 338, x2: 206, y2: 338 },
    { type: 'line', label: 'Hem range', x1: 84, y1: 405, x2: 216, y2: 405 }
  ]),
  shoes: Object.freeze([
    { type: 'ellipse', label: 'Left foot', cx: 118, cy: 416, rx: 34, ry: 16 },
    { type: 'ellipse', label: 'Right foot', cx: 182, cy: 416, rx: 34, ry: 16 },
    { type: 'point', label: 'Left ankle', x: 120, y: 388 },
    { type: 'point', label: 'Right ankle', x: 180, y: 388 },
    { type: 'line', label: 'Ground', x1: 65, y1: 438, x2: 235, y2: 438 }
  ]),
  accessory: Object.freeze([
    { type: 'ellipse', label: 'Head contour', cx: 150, cy: 68, rx: 58, ry: 58 },
    { type: 'line', label: 'Crown', x1: 150, y1: 8, x2: 150, y2: 126 },
    { type: 'point', label: 'Left ear', x: 92, y: 72 },
    { type: 'point', label: 'Right ear', x: 208, y: 72 },
    { type: 'point', label: 'Neck', x: 150, y: 126 }
  ])
});

function transformX(value, transform) {
  return Math.round((value * transform.xScale + transform.xOffset) * 10) / 10;
}

function transformY(value, transform) {
  return Math.round((value * transform.yScale + transform.yOffset) * 10) / 10;
}

export function getReferenceGuides(slot, modelId) {
  const definitions = SLOT_GUIDES[slot] || [];
  const transform = MODEL_TRANSFORMS[modelId] || MODEL_TRANSFORMS.doll_classic_a;
  return definitions.map((guide) => {
    if (guide.type === 'line') {
      return { ...guide, x1: transformX(guide.x1, transform), y1: transformY(guide.y1, transform), x2: transformX(guide.x2, transform), y2: transformY(guide.y2, transform) };
    }
    if (guide.type === 'ellipse') {
      return { ...guide, cx: transformX(guide.cx, transform), cy: transformY(guide.cy, transform), rx: guide.rx * transform.xScale, ry: guide.ry * transform.yScale };
    }
    return { ...guide, x: transformX(guide.x, transform), y: transformY(guide.y, transform) };
  });
}

export function guideIsInBounds(guide) {
  if (guide.type === 'line') {
    return [guide.x1, guide.x2].every((x) => x >= 0 && x <= LOGICAL_WIDTH) &&
      [guide.y1, guide.y2].every((y) => y >= 0 && y <= LOGICAL_HEIGHT);
  }
  if (guide.type === 'ellipse') {
    return guide.cx - guide.rx >= 0 && guide.cx + guide.rx <= LOGICAL_WIDTH &&
      guide.cy - guide.ry >= 0 && guide.cy + guide.ry <= LOGICAL_HEIGHT;
  }
  return guide.x >= 0 && guide.x <= LOGICAL_WIDTH && guide.y >= 0 && guide.y <= LOGICAL_HEIGHT;
}
