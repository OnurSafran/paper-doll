import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSETS,
  dolls,
  dollsByLifeStage,
  getAsset,
  getOfferedWearables,
  wearablesBySlot
} from '../js/core/asset-catalog.js';
import {
  createDefaultFace,
  createStarterDraft,
  DEFAULT_FACE_BY_DOLL,
  equipWearable,
  setBaseDoll
} from '../js/domain/outfit-rules.js';
import {
  createDefaultEnvelope,
  sanitizeDraft
} from '../js/core/state-schema.js';
import { createAppStore } from '../js/core/app-store.js';

test('asset catalog registers all 6 base dolls across 5 life stages', () => {
  const allDolls = dolls();
  assert.equal(allDolls.length, 6);

  const baby = getAsset('doll_baby_a');
  assert.ok(baby);
  assert.equal(baby.fitFamily, 'baby');
  assert.deepEqual(baby.lifeStages, ['baby']);

  const child = getAsset('doll_chibi_a');
  assert.ok(child);
  assert.equal(child.fitFamily, 'child');
  assert.deepEqual(child.lifeStages, ['child']);

  const classicA = getAsset('doll_classic_a');
  assert.ok(classicA);
  assert.equal(classicA.fitFamily, 'teen');
  assert.deepEqual(classicA.lifeStages, ['teen']);

  const classicB = getAsset('doll_classic_b');
  assert.ok(classicB);
  assert.equal(classicB.fitFamily, 'teen');
  assert.deepEqual(classicB.lifeStages, ['teen']);

  const adult = getAsset('doll_adult_a');
  assert.ok(adult);
  assert.equal(adult.fitFamily, 'adult');
  assert.deepEqual(adult.lifeStages, ['adult']);

  const elder = getAsset('doll_elder_a');
  assert.ok(elder);
  assert.equal(elder.fitFamily, 'elder');
  assert.deepEqual(elder.lifeStages, ['elder']);

  assert.equal(dollsByLifeStage('teen').length, 2);
  assert.equal(dollsByLifeStage('baby').length, 1);
  assert.equal(dollsByLifeStage('child').length, 1);
  assert.equal(dollsByLifeStage('adult').length, 1);
  assert.equal(dollsByLifeStage('elder').length, 1);
});

test('DEFAULT_FACE_BY_DOLL defines defaults for all 6 base dolls', () => {
  const dollIds = ['doll_classic_a', 'doll_classic_b', 'doll_chibi_a', 'doll_baby_a', 'doll_adult_a', 'doll_elder_a'];
  for (const id of dollIds) {
    const face = createDefaultFace(id);
    assert.ok(face, `default face exists for ${id}`);
    assert.ok(face.eyes?.assetId, `eyes exist for ${id}`);
    assert.ok(face.eyebrows?.assetId, `eyebrows exist for ${id}`);
    assert.ok(face.nose?.assetId, `nose exists for ${id}`);
    assert.ok(face.mouth?.assetId, `mouth exists for ${id}`);
  }
});

test('getOfferedWearables filters by fitFamily and presentation style', () => {
  // Baby doll only sees baby wearables
  const babyTops = getOfferedWearables('top', 'doll_baby_a', 'all');
  assert.equal(babyTops.length, 0); // No baby tops, baby uses romper dress
  const babyDresses = getOfferedWearables('dress', 'doll_baby_a', 'all');
  assert.ok(babyDresses.some((d) => d.id === 'dress_romper_baby'));
  assert.ok(!babyDresses.some((d) => d.id === 'dress_sundress'));

  // Teen doll sees teen wearables
  const teenTops = getOfferedWearables('top', 'doll_classic_a', 'all');
  assert.ok(teenTops.some((t) => t.id === 'top_tshirt'));
  assert.ok(teenTops.some((t) => t.id === 'top_cardigan_classic'));
  assert.ok(!teenTops.some((t) => t.id === 'top_coat_adult')); // Adult coat doesn't fit teen

  // Adult doll sees adult-compatible tops
  const adultTops = getOfferedWearables('top', 'doll_adult_a', 'all');
  assert.ok(adultTops.some((t) => t.id === 'top_coat_adult'));
  assert.ok(adultTops.some((t) => t.id === 'top_cardigan_classic'));
  assert.ok(!adultTops.some((t) => t.id === 'top_tshirt')); // Standard teen tee doesn't fit adult

  // Presentation style filter
  const feminineTeenTops = getOfferedWearables('top', 'doll_classic_a', 'feminine');
  assert.ok(feminineTeenTops.some((t) => t.id === 'top_blouse'));
  assert.ok(!feminineTeenTops.some((t) => t.id === 'top_cardigan_classic')); // neutral

  const neutralTeenTops = getOfferedWearables('top', 'doll_classic_a', 'neutral');
  assert.ok(neutralTeenTops.some((t) => t.id === 'top_cardigan_classic'));
  assert.ok(!neutralTeenTops.some((t) => t.id === 'top_blouse'));
});

test('setBaseDoll retains compatible items and preserves incompatible references', () => {
  let draft = createStarterDraft();
  // Equip versatile cardigan, teen-only jeans, versatile shoes, and teen-only accessory
  draft = equipWearable(draft, getAsset('top_cardigan_classic')).draft;
  draft = equipWearable(draft, getAsset('bottom_jeans')).draft;
  draft = equipWearable(draft, getAsset('accessory_spectacles_elder')).draft;

  assert.equal(draft.slots.top.assetId, 'top_cardigan_classic');
  assert.equal(draft.slots.bottom.assetId, 'bottom_jeans');
  assert.equal(draft.slots.accessory.assetId, 'accessory_spectacles_elder');

  // Switch to Adult doll
  const resAdult = setBaseDoll(draft, 'doll_adult_a', getAsset);
  assert.equal(resAdult.changed, true);
  assert.equal(resAdult.draft.baseDollId, 'doll_adult_a');

  // cardigan_classic and spectacles_elder fit adult; incompatible items remain referenced but are hidden
  assert.equal(resAdult.draft.slots.top.assetId, 'top_cardigan_classic');
  assert.equal(resAdult.draft.slots.accessory.assetId, 'accessory_spectacles_elder');
  assert.equal(resAdult.draft.slots.bottom.assetId, 'bottom_jeans');
  assert.deepEqual(resAdult.incompatibleSlots, ['hair', 'bottom', 'shoes']);

  // Switch to Baby doll
  const resBaby = setBaseDoll(resAdult.draft, 'doll_baby_a', getAsset);
  assert.equal(resBaby.changed, true);
  assert.equal(resBaby.draft.baseDollId, 'doll_baby_a');
  // Neither cardigan nor spectacles fit baby, but both references are preserved
  assert.equal(resBaby.draft.slots.top.assetId, 'top_cardigan_classic');
  assert.equal(resBaby.draft.slots.accessory.assetId, 'accessory_spectacles_elder');
  assert.ok(resBaby.incompatibleSlots.includes('top'));
  assert.ok(resBaby.incompatibleSlots.includes('accessory'));

  // Now equip baby romper and baby booties
  const withRomper = equipWearable(resBaby.draft, getAsset('dress_romper_baby')).draft;
  const withBooties = equipWearable(withRomper, getAsset('shoes_booties_baby')).draft;
  assert.equal(withBooties.slots.dress.assetId, 'dress_romper_baby');
  assert.equal(withBooties.slots.shoes.assetId, 'shoes_booties_baby');
});

test('AppStore handles designer/setBaseDoll and designer/setStyleFilter with undo/redo', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset });

  // Set style filter
  store.dispatch({ type: 'designer/setStyleFilter', style: 'feminine' });
  assert.equal(store.getState().designer.selectedStyleFilter, 'feminine');

  // Equip versatile cardigan
  store.dispatch({ type: 'designer/equip', assetId: 'top_cardigan_classic' });
  assert.equal(store.getState().designer.draft.slots.top.assetId, 'top_cardigan_classic');

  // Change base doll to adult
  store.dispatch({ type: 'designer/setBaseDoll', baseDollId: 'doll_adult_a' });
  assert.equal(store.getState().designer.draft.baseDollId, 'doll_adult_a');
  assert.equal(store.getState().designer.draft.slots.top.assetId, 'top_cardigan_classic'); // retained

  // Change base doll to baby
  store.dispatch({ type: 'designer/setBaseDoll', baseDollId: 'doll_baby_a' });
  assert.equal(store.getState().designer.draft.baseDollId, 'doll_baby_a');
  assert.equal(store.getState().designer.draft.slots.top.assetId, 'top_cardigan_classic'); // preserved but hidden due to fit

  const rejected = store.dispatch({ type: 'designer/equip', assetId: 'top_tshirt' });
  assert.equal(rejected.ok, false);
  assert.equal(store.getState().designer.draft.slots.top.assetId, 'top_cardigan_classic');

  // Undo back to adult
  store.dispatch({ type: 'app/undo' });
  assert.equal(store.getState().designer.draft.baseDollId, 'doll_adult_a');
  assert.equal(store.getState().designer.draft.slots.top.assetId, 'top_cardigan_classic');

  // Undo back to classic
  store.dispatch({ type: 'app/undo' });
  assert.equal(store.getState().designer.draft.baseDollId, 'doll_classic_a');

  // Redo
  store.dispatch({ type: 'app/redo' });
  assert.equal(store.getState().designer.draft.baseDollId, 'doll_adult_a');
});
