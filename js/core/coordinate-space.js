import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from '../domain/vocabulary.js';

const STAGE_WIDTH = VIEWPORT_WIDTH;
const STAGE_HEIGHT = VIEWPORT_HEIGHT;

/** @param {number} cameraX
 * @param {number} stageWidth */
export function clampCameraX(cameraX, stageWidth = STAGE_WIDTH) {
  const num = Number(cameraX) || 0;
  const maxCameraX = Math.max(0, stageWidth - VIEWPORT_WIDTH);
  return Math.round(Math.min(Math.max(0, num), maxCameraX));
}

export function fitStage(containerWidth, containerHeight) {
  const scale = Math.min(containerWidth / STAGE_WIDTH, containerHeight / STAGE_HEIGHT);
  const width = STAGE_WIDTH * scale;
  const height = STAGE_HEIGHT * scale;
  return {
    scale,
    width,
    height,
    offsetX: (containerWidth - width) / 2,
    offsetY: (containerHeight - height) / 2
  };
}

export function clientToLogical(clientX, clientY, stageRect, cameraX = 0) {
  return {
    x: (clientX - stageRect.left) * (STAGE_WIDTH / stageRect.width) + (Number(cameraX) || 0),
    y: (clientY - stageRect.top) * (STAGE_HEIGHT / stageRect.height)
  };
}

export function logicalToClient(x, y, stageRect, cameraX = 0) {
  return {
    x: stageRect.left + (x - (Number(cameraX) || 0)) * (stageRect.width / STAGE_WIDTH),
    y: stageRect.top + y * (stageRect.height / STAGE_HEIGHT)
  };
}

/** The stage's content box: logical coordinates map inside its border, like the rendered world. */
export function stageContentRect(stageEl) {
  const rect = stageEl.getBoundingClientRect();
  const style = globalThis.getComputedStyle?.(stageEl);
  const border = (side) => Number.parseFloat(style?.[`border${side}Width`]) || 0;
  const left = border('Left');
  const top = border('Top');
  return {
    left: rect.left + left,
    top: rect.top + top,
    width: Math.max(1, rect.width - left - border('Right')),
    height: Math.max(1, rect.height - top - border('Bottom'))
  };
}

/**
 * The camera offset the world is drawn at right now. `scene.cameraX` is where the
 * camera is going; the world eases there, so pointer input must map through the
 * rendered offset to land on the artwork the user actually sees. At rest it equals
 * the stored camera exactly.
 */
export function renderedCameraX(stageEl, storedCameraX = 0, stageRect = stageContentRect(stageEl)) {
  const stored = Number(storedCameraX) || 0;
  const world = stageEl.querySelector?.('#scene-world');
  const rect = world?.getBoundingClientRect?.();
  if (!rect || !(rect.width > 0)) return stored;
  const rendered = (stageRect.left - rect.left) * (STAGE_WIDTH / stageRect.width);
  // Sub-pixel layout noise at rest must not perturb committed positions.
  return Number.isFinite(rendered) && Math.abs(rendered - stored) >= 0.5 ? rendered : stored;
}
