import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSETS,
  dolls,
  facesByGroup,
  getAsset,
  getOfferedWearables,
  wearablesBySlot
} from '../js/core/asset-catalog.js';
import {
  createDefaultEnvelope,
  sanitizeDraft
} from '../js/core/state-schema.js';
import { createAppStore } from '../js/core/app-store.js';
import { FACE_GROUPS, FIT_FAMILIES } from '../js/domain/vocabulary.js';

test('catalog contains all 19 modular face features across 5 face groups', () => {
  assert.equal(ASSETS.filter((a) => a.kind === 'face').length, 19);

  for (const group of FACE_GROUPS) {
    const items = facesByGroup(group);
    assert.ok(items.length >= 2, `Group ${group} should have at least 2 options`);
    for (const item of items) {
      assert.equal(item.kind, 'face');
      assert.equal(item.faceGroup, group);
      assert.deepEqual(item.viewBox, [0, 0, 300, 450]);
    }
  }

  // Verify new Gate 3 face additions
  assert.ok(getAsset('eyes_calm'));
  assert.ok(getAsset('eyes_curious'));
  assert.ok(getAsset('brows_bold'));
  assert.ok(getAsset('brows_expressive'));
  assert.ok(getAsset('nose_soft_curve'));
  assert.ok(getAsset('mouth_playful'));
  assert.ok(getAsset('mouth_smirk'));
});

test('catalog contains all 58 wearables with valid fitFamily declarations', () => {
  const wearables = ASSETS.filter((a) => a.kind === 'wearable');
  assert.equal(wearables.length, 58);

  for (const item of wearables) {
    assert.ok(Array.isArray(item.supportedFitFamilies), `${item.id} has supportedFitFamilies array`);
    assert.ok(item.supportedFitFamilies.length > 0, `${item.id} has at least 1 supported fit family`);
    for (const fit of item.supportedFitFamilies) {
      assert.ok(FIT_FAMILIES.includes(fit), `${item.id} specifies valid fit family ${fit}`);
    }
  }

  // Verify new Gate 3 wearable additions
  assert.ok(getAsset('hair_baby_curl'));
  assert.ok(getAsset('hair_silver_waves'));
  assert.ok(getAsset('hair_short_slick'));
  assert.ok(getAsset('bottom_trousers_classic'));
  assert.ok(getAsset('shoes_oxfords_classic'));
});

test('designer/shuffle produces strictly compatible outfits across all 5 life-stage dolls', () => {
  const allDolls = dolls();
  assert.equal(allDolls.length, 6);

  for (const doll of allDolls) {
    const store = createAppStore(createDefaultEnvelope(), { getAsset, assets: ASSETS });
    store.dispatch({ type: 'designer/setBaseDoll', baseDollId: doll.id });

    // Run 50 successive shuffles for this doll model
    for (let i = 0; i < 50; i += 1) {
      store.dispatch({ type: 'designer/shuffle' });
      const draft = store.getState().designer.draft;

      // 1. Model identity preserved
      assert.equal(draft.baseDollId, doll.id);

      // 2. Mutual exclusivity: dress vs top/bottom
      if (draft.slots.dress) {
        assert.equal(draft.slots.top, null, `Doll ${doll.id}: dress equipped but top is not null`);
        assert.equal(draft.slots.bottom, null, `Doll ${doll.id}: dress equipped but bottom is not null`);
      }

      // 3. Strict fit-family compatibility for all equipped slots
      for (const [slot, item] of Object.entries(draft.slots)) {
        if (!item) continue;
        const asset = getAsset(item.assetId);
        assert.ok(asset, `Doll ${doll.id}: equipped asset ${item.assetId} must exist`);
        assert.ok(
          asset.supportedFitFamilies.includes(doll.fitFamily),
          `Doll ${doll.id} (${doll.fitFamily}) cannot wear ${asset.id} (${asset.supportedFitFamilies.join(',')})`
        );
      }

      // 4. Face feature integrity
      assert.ok(draft.face?.eyes?.assetId, `Doll ${doll.id}: eyes present`);
      assert.ok(draft.face?.eyebrows?.assetId, `Doll ${doll.id}: eyebrows present`);
      assert.ok(draft.face?.nose?.assetId, `Doll ${doll.id}: nose present`);
      assert.ok(draft.face?.mouth?.assetId, `Doll ${doll.id}: mouth present`);

      // 5. Draft passes schema sanitization
      const sanitized = sanitizeDraft(draft, getAsset);
      assert.deepEqual(sanitized, draft, `Doll ${doll.id}: shuffled draft matches sanitized form`);
    }
  }
});

test('designer/shuffle supports undo and redo cleanly', () => {
  const store = createAppStore(createDefaultEnvelope(), { getAsset, assets: ASSETS });
  const initialDraft = store.getState().designer.draft;

  store.dispatch({ type: 'designer/shuffle' });
  const firstShuffle = store.getState().designer.draft;
  assert.notDeepEqual(firstShuffle, initialDraft);

  store.dispatch({ type: 'designer/shuffle' });
  const secondShuffle = store.getState().designer.draft;
  assert.notDeepEqual(secondShuffle, firstShuffle);

  // Undo second shuffle
  store.dispatch({ type: 'app/undo' });
  assert.deepEqual(store.getState().designer.draft, firstShuffle);

  // Undo first shuffle
  store.dispatch({ type: 'app/undo' });
  assert.deepEqual(store.getState().designer.draft, initialDraft);

  // Redo first shuffle
  store.dispatch({ type: 'app/redo' });
  assert.deepEqual(store.getState().designer.draft, firstShuffle);
});
