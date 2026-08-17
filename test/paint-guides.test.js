import test from 'node:test';
import assert from 'node:assert/strict';
import { getReferenceGuides, guideIsInBounds, REFERENCE_MODELS } from '../js/features/paint/paint-guides.js';

const SLOTS = ['top', 'bottom', 'dress', 'shoes', 'hair', 'accessory'];

test('every supported wearable slot and reference model has bounded declared guides', () => {
  for (const slot of SLOTS) {
    for (const model of REFERENCE_MODELS) {
      const guides = getReferenceGuides(slot, model.id);
      assert.ok(guides.length >= 4, `${slot}/${model.id} needs precision guides`);
      assert.ok(guides.every(guideIsInBounds), `${slot}/${model.id} guides must stay in 300x450`);
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
