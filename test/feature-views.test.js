import test from 'node:test';
import assert from 'node:assert/strict';
import { describeOutfit, previewCustomColor, WARDROBE_SLOTS } from '../js/features/designer/designer-view.js';
import { nextSpawnPoint } from '../js/features/play/play-view.js';
import { createStarterDraft } from '../js/domain/outfit-rules.js';
import { LIMITS } from '../js/domain/vocabulary.js';

import { setLanguage } from '../js/core/i18n.js';

test('describeOutfit generates accessible text for empty and equipped drafts', () => {
  setLanguage('en');
  const emptyDraft = { slots: {} };
  assert.equal(describeOutfit(emptyDraft), 'Paper doll with no outfit pieces.');

  const starter = createStarterDraft();
  const starterDesc = describeOutfit(starter);
  assert.match(starterDesc, /^Paper doll wearing /);
  assert.match(starterDesc, /Sailor stripe tee|High-waist jeans|High ponytail/);

  setLanguage('tr');
  assert.equal(describeOutfit(emptyDraft), 'Kıyafetsiz kâğıt bebek.');
  const trStarterDesc = describeOutfit(starter);
  assert.match(trStarterDesc, /Giyilen parçalar/);
});



test('WARDROBE_SLOTS defines all canonical categories in logical order', () => {
  const slotKeys = WARDROBE_SLOTS.map(([k]) => k);
  assert.deepEqual(slotKeys, ['top', 'bottom', 'dress', 'shoes', 'hair', 'accessory']);
});

test('nextSpawnPoint generates distributed points within stage boundaries', () => {
  for (let i = 0; i < 40; i += 1) {
    const pt = nextSpawnPoint(i);
    assert.ok(pt.x >= 0 && pt.x <= LIMITS.STAGE_WIDTH, `Spawn X out of bounds at ${i}: ${pt.x}`);
    assert.ok(pt.y >= 0 && pt.y <= LIMITS.STAGE_HEIGHT, `Spawn Y out of bounds at ${i}: ${pt.y}`);
  }
});
