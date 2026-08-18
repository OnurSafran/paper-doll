import test from 'node:test';
import assert from 'node:assert/strict';
import { getReferenceGuides, guideIsInBounds } from '../js/features/paint/paint-guides.js';
import { REFERENCE_DOLL_IDS } from '../js/domain/vocabulary.js';

const SLOTS = ['top', 'bottom', 'dress', 'shoes', 'hair', 'accessory'];

test('reference model choices expose life stages instead of teen variants', () => {
  assert.deepEqual([...REFERENCE_DOLL_IDS], [
    'doll_classic_a', 'doll_classic_b', 'doll_chibi_a', 'doll_baby_a', 'doll_adult_a', 'doll_elder_a'
  ]);
});

test('every supported wearable slot and reference model has bounded declared guides', () => {
  for (const slot of SLOTS) {
    for (const modelId of REFERENCE_DOLL_IDS) {
      const guides = getReferenceGuides(slot, modelId);
      assert.ok(guides.length >= 4, `${slot}/${modelId} needs precision guides`);
      assert.ok(guides.every(guideIsInBounds), `${slot}/${modelId} guides must stay in 300x450`);
      assert.ok(guides.every((guide) => typeof guide.label === 'string' && guide.label.length > 0));
    }
  }
});

test('model transforms are deterministic and do not mutate source guide definitions', () => {
  const classic = getReferenceGuides('top', 'doll_classic_a');
  const chibi = getReferenceGuides('top', 'doll_chibi_a');
  assert.notDeepEqual(chibi, classic);
  assert.deepEqual(getReferenceGuides('top', 'doll_classic_a'), classic);
  assert.deepEqual(getReferenceGuides('top', 'unknown-model'), classic);
});
