import {
  DEFAULT_BASE_DOLL_ID,
  DEFAULT_GARMENT_COLOR,
  DEFAULT_SKIN_TONE,
  isOutfitSlot,
  OUTFIT_SLOTS
} from './vocabulary.js';

export { OUTFIT_SLOTS, isOutfitSlot };

export function emptySlots() {
  return Object.fromEntries(OUTFIT_SLOTS.map((slot) => [slot, null]));
}

export function createStarterDraft() {
  return {
    baseDollId: DEFAULT_BASE_DOLL_ID,
    skinTone: DEFAULT_SKIN_TONE,
    slots: {
      ...emptySlots(),
      hair: { assetId: 'hair_ponytail', color: 'brown' },
      top: { assetId: 'top_tshirt', color: 'coral' },
      bottom: { assetId: 'bottom_jeans', color: 'denim' },
      shoes: { assetId: 'shoes_sneakers', color: 'cream' }
    }
  };
}

export function cloneDraft(draft) {
  return {
    baseDollId: draft.baseDollId,
    skinTone: draft.skinTone,
    slots: Object.fromEntries(
      OUTFIT_SLOTS.map((slot) => [slot, draft.slots?.[slot] ? { ...draft.slots[slot] } : null])
    )
  };
}

export function equipWearable(draft, asset, color) {
  if (!asset || asset.kind !== 'wearable' || !isOutfitSlot(asset.slot)) {
    return { draft, changed: false, message: 'That item cannot be equipped.' };
  }

  const next = cloneDraft(draft);
  const cleared = [];

  if (asset.slot === 'dress') {
    for (const slot of ['top', 'bottom']) {
      if (next.slots[slot]) cleared.push(slot);
      next.slots[slot] = null;
    }
  } else if ((asset.slot === 'top' || asset.slot === 'bottom') && next.slots.dress) {
    next.slots.dress = null;
    cleared.push('dress');
  }

  next.slots[asset.slot] = {
    assetId: asset.id,
    color: color ?? asset.defaultColors?.primary ?? DEFAULT_GARMENT_COLOR
  };

  const replacement = cleared.length ? ` Replaced ${cleared.join(' and ')}.` : '';
  return { draft: next, changed: true, message: `${asset.name} equipped.${replacement}` };
}

export function removeSlot(draft, slot) {
  if (!OUTFIT_SLOTS.includes(slot) || !draft.slots?.[slot]) {
    return { draft, changed: false, message: 'Nothing to remove.' };
  }

  const next = cloneDraft(draft);
  next.slots[slot] = null;
  return { draft: next, changed: true, message: `${slotLabel(slot)} removed.` };
}

export function clearOutfit(draft) {
  const next = cloneDraft(draft);
  for (const slot of ['top', 'bottom', 'dress', 'shoes', 'accessory']) next.slots[slot] = null;
  return next;
}

export function setSlotColor(draft, slot, color) {
  if (!OUTFIT_SLOTS.includes(slot) || !draft.slots?.[slot]) return draft;
  const next = cloneDraft(draft);
  next.slots[slot].color = color;
  return next;
}

export function slotLabel(slot) {
  return ({ hair: 'Hair', top: 'Top', bottom: 'Bottom', dress: 'Dress', shoes: 'Shoes', accessory: 'Accessory' })[slot] ?? slot;
}
