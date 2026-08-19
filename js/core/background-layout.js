import { DEFAULT_STAGE_WIDTH, STAGE_WIDTHS } from '../domain/vocabulary.js';

export const BACKGROUND_WIDTHS = Object.freeze([...STAGE_WIDTHS]);

export function getBackgroundLayout(asset, stageWidth = DEFAULT_STAGE_WIDTH) {
  const normalizedStageWidth = STAGE_WIDTHS.includes(stageWidth) ? stageWidth : DEFAULT_STAGE_WIDTH;
  const tileWidth = BACKGROUND_WIDTHS.includes(asset?.backgroundWidth) ? asset.backgroundWidth : DEFAULT_STAGE_WIDTH;
  const tileCount = tileWidth > normalizedStageWidth ? 1 : Math.ceil(normalizedStageWidth / tileWidth);
  const firstTileX = tileWidth > normalizedStageWidth ? (normalizedStageWidth - tileWidth) / 2 : 0;

  return Object.freeze({
    stageWidth: normalizedStageWidth,
    tileWidth,
    tileCount,
    tilePercent: (tileWidth / normalizedStageWidth) * 100,
    centered: tileWidth > normalizedStageWidth,
    tilePositions: Object.freeze(Array.from({ length: tileCount }, (_, index) => firstTileX + index * tileWidth))
  });
}
