/** Shared prop finish defaults for catalog descriptors and saved custom metadata. */
export const CARDBOARD_MODES = Object.freeze(['none', 'edge', 'stand']);

/** Strict check for untrusted metadata: absent, or a known finish on a prop. */
export function hasValidCardboardFinish(asset) {
  return asset?.cardboard == null || (asset.kind === 'prop' && CARDBOARD_MODES.includes(asset.cardboard));
}

export function propCardboardMode(asset) {
  if (CARDBOARD_MODES.includes(asset?.cardboard)) return asset.cardboard;
  const rules = asset?.placementRules;
  if (rules?.renderClass === 'ground' ||
      (rules?.allowedTargets?.length && rules.allowedTargets.every(target => ['wall', 'ceiling'].includes(target))) ||
      asset?.groundAnchor?.y === 0.5) return 'none';
  return 'edge';
}
