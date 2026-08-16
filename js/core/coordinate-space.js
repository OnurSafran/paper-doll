import { LIMITS, VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from '../domain/vocabulary.js';

const STAGE_WIDTH = VIEWPORT_WIDTH;
const STAGE_HEIGHT = VIEWPORT_HEIGHT;

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
