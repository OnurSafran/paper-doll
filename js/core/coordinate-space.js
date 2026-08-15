import { LIMITS } from '../domain/vocabulary.js';

const { STAGE_WIDTH, STAGE_HEIGHT } = LIMITS;

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

export function clientToLogical(clientX, clientY, stageRect) {
  return {
    x: (clientX - stageRect.left) * (STAGE_WIDTH / stageRect.width),
    y: (clientY - stageRect.top) * (STAGE_HEIGHT / stageRect.height)
  };
}

export function logicalToClient(x, y, stageRect) {
  return {
    x: stageRect.left + x * (stageRect.width / STAGE_WIDTH),
    y: stageRect.top + y * (stageRect.height / STAGE_HEIGHT)
  };
}
