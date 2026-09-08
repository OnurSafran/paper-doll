import { DEFAULT_STAGE_WIDTH, STAGE_WIDTHS } from '../domain/vocabulary.js';

export const BACKGROUND_WIDTHS = Object.freeze([...STAGE_WIDTHS]);

/**
 * Works out how a background tile fills a stage of `stageWidth`.
 *
 * Tiles are never stretched: a narrower artwork repeats to cover the stage.
 * Two rules keep those repeats from reading as a glitch:
 *
 * - Every odd tile is mirrored, so a repeat reflects at the seam (walls, floor
 *   lines and horizons stay continuous) instead of restarting mid-wall.
 * - When the tile row cannot divide the stage evenly the overflow is split
 *   between both edges, so a 3200-wide panorama on a 4800 stage loses a little
 *   from each end rather than having its whole right half chopped off.
 */
export function getBackgroundLayout(asset, stageWidth = DEFAULT_STAGE_WIDTH) {
  const normalizedStageWidth = STAGE_WIDTHS.includes(stageWidth) ? stageWidth : DEFAULT_STAGE_WIDTH;
  const tileWidth = BACKGROUND_WIDTHS.includes(asset?.backgroundWidth) ? asset.backgroundWidth : DEFAULT_STAGE_WIDTH;
  const tileCount = tileWidth > normalizedStageWidth ? 1 : Math.ceil(normalizedStageWidth / tileWidth);
  const coveredWidth = tileCount * tileWidth;
  const centered = coveredWidth > normalizedStageWidth;
  const firstTileX = centered ? (normalizedStageWidth - coveredWidth) / 2 : 0;
  const tiles = Object.freeze(Array.from({ length: tileCount }, (_, index) => Object.freeze({
    x: firstTileX + index * tileWidth,
    mirrored: index % 2 === 1
  })));

  return Object.freeze({
    stageWidth: normalizedStageWidth,
    tileWidth,
    tileCount,
    tilePercent: (tileWidth / normalizedStageWidth) * 100,
    centered,
    tiles,
    tilePositions: Object.freeze(tiles.map((tile) => tile.x))
  });
}
