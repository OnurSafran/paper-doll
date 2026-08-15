import test from 'node:test';
import assert from 'node:assert/strict';
import { getAsset } from '../js/core/asset-catalog.js';
import { clearOutfit, createStarterDraft, equipWearable, removeSlot, setSlotColor } from '../js/domain/outfit-rules.js';

test('starter draft is immediately usable', () => {
  const draft = createStarterDraft();
  assert.equal(draft.baseDollId, 'doll_classic_a');
  assert.equal(draft.slots.top.assetId, 'top_tshirt');
  assert.equal(draft.slots.bottom.assetId, 'bottom_jeans');
  assert.equal(draft.slots.hair.assetId, 'hair_ponytail');
});

test('equipping a dress clears top and bottom', () => {
  const original = createStarterDraft();
  const result = equipWearable(original, getAsset('dress_sundress'));
  assert.equal(result.draft.slots.dress.assetId, 'dress_sundress');
  assert.equal(result.draft.slots.top, null);
  assert.equal(result.draft.slots.bottom, null);
  assert.match(result.message, /Replaced top and bottom/);
  assert.equal(original.slots.top.assetId, 'top_tshirt');
});

test('equipping a top clears a dress', () => {
  const withDress = equipWearable(createStarterDraft(), getAsset('dress_sundress')).draft;
  const result = equipWearable(withDress, getAsset('top_blouse'));
  assert.equal(result.draft.slots.dress, null);
  assert.equal(result.draft.slots.top.assetId, 'top_blouse');
  assert.match(result.message, /Replaced dress/);
});

test('same-slot items replace deterministically', () => {
  const result = equipWearable(createStarterDraft(), getAsset('hair_long'));
  assert.equal(result.draft.slots.hair.assetId, 'hair_long');
  assert.equal(Object.keys(result.draft.slots).length, 6);
});

test('remove and recolor do not mutate the previous draft', () => {
  const original = createStarterDraft();
  const recolored = setSlotColor(original, 'top', 'sky');
  const removed = removeSlot(recolored, 'top');
  assert.equal(original.slots.top.color, 'coral');
  assert.equal(recolored.slots.top.color, 'sky');
  assert.equal(removed.draft.slots.top, null);
});

test('take off outfit keeps hair and skin while clearing wearable clothing', () => {
  const original = equipWearable(createStarterDraft(), getAsset('accessory_bow')).draft;
  const cleared = clearOutfit(original);
  assert.equal(cleared.skinTone, 'peach');
  assert.equal(cleared.slots.hair.assetId, 'hair_ponytail');
  for (const slot of ['top', 'bottom', 'dress', 'shoes', 'accessory']) assert.equal(cleared.slots[slot], null);
  assert.equal(original.slots.accessory.assetId, 'accessory_bow');
});
