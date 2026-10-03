import { assetName, t } from '../../core/i18n.js';

/** Custom furniture carries a plain `name`; built-ins carry a translated `nameKey`. */
export function surfaceName(surface) {
  return surface.name || t(surface.nameKey || 'placement.tabletop');
}

/** Full destination name: "Dining table — Tabletop", or "Floor" / "Wall". Shared by the chooser and announcements. */
export function targetLabel(target, host, getAsset) {
  return target.kind === 'surface'
    ? `${assetName(getAsset(host?.sourceId))} — ${surfaceName(target.surface)}`
    : t(`placement.${target.kind}`);
}

/** Short drag-chip text. A template, never concatenation: word order differs by language. */
export function targetChipLabel(target) {
  if (target.kind === 'surface') return t('placement.guideOnSurface', { name: surfaceName(target.surface) });
  return t(target.kind === 'wall' ? 'placement.onWall' : 'placement.onFloor');
}
