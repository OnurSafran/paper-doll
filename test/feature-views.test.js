import test from 'node:test';
import assert from 'node:assert/strict';
import { describeOutfit, previewCustomColor, WARDROBE_SLOTS } from '../js/features/designer/designer-view.js';
import { getWheelPanDelta, nextSpawnPoint } from '../js/features/play/play-view.js';
import { createStarterDraft } from '../js/domain/outfit-rules.js';
import { LIMITS } from '../js/domain/vocabulary.js';

import { createSelectionInspectorController } from '../js/features/play/selection-inspector-controller.js';

import { setLanguage } from '../js/core/i18n.js';
import { APP_VERSION, createDefaultEnvelope, createRuntimeState, persistedProjection, sanitizeEnvelope } from '../js/core/state-schema.js';
import { serializeProjectPackage } from '../js/services/project-portability.js';

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

test('nextSpawnPoint places tray clicks inside the visible camera region', () => {
  assert.deepEqual(nextSpawnPoint(0, 0), { x: 650, y: 690 });
  assert.deepEqual(nextSpawnPoint(0, 1600), { x: 2250, y: 690 });
});

test('wheel panning claims horizontal gestures but preserves vertical scrolling', () => {
  assert.equal(getWheelPanDelta({ deltaX: 120, deltaY: 20, shiftKey: false }), 120);
  assert.equal(getWheelPanDelta({ deltaX: 20, deltaY: 120, shiftKey: false }), 0);
  assert.equal(getWheelPanDelta({ deltaX: 0, deltaY: 120, shiftKey: true }), 120);
});


test('Play panels follow the current selection, including direct prop-to-character changes', () => {
  const panels = {
    '#spawn-panel-section': { hidden: false },
    '#play-inspector-panel': { hidden: true },
    '#attach-joint-controls': { hidden: false }
  };
  const controller = createSelectionInspectorController({
    $: (selector) => panels[selector] || null,
    $$: () => []
  });
  const entities = [
    { instanceId: 'prop', kind: 'prop' },
    { instanceId: 'character', kind: 'character' },
    { instanceId: 'bubble', kind: 'bubble' }
  ];
  function select(id) {
    controller.renderSelectedActions({
      ui: { selectedEntityId: id, selectedEntityIds: id ? [id] : [] },
      currentScene: { entities }
    });
  }
  select('prop');
  assert.equal(panels['#spawn-panel-section'].hidden, true);
  select('character');
  assert.equal(panels['#play-inspector-panel'].hidden, false);
  assert.equal(panels['#spawn-panel-section'].hidden, true);
  select('prop');
  assert.equal(panels['#play-inspector-panel'].hidden, true);
  select('bubble');
  assert.equal(panels['#play-inspector-panel'].hidden, false);
  select(null);
  assert.equal(panels['#spawn-panel-section'].hidden, true);
  assert.equal(panels['#play-inspector-panel'].hidden, true);
});


test('Panel handle toggles the tray and a new selection reopens the inspector', () => {
  let click;
  let expanded;
  let state = { ui: { selectedEntityId: null, selectedEntityIds: [] }, currentScene: { entities: [{ instanceId: 'character', kind: 'character' }] } };
  const panels = {
    '#play-rail-content': { hidden: true },
    '#spawn-panel-section': { hidden: true },
    '#play-inspector-panel': { hidden: true },
    '#scene-tray-toggle': { dataset: {}, addEventListener: (_event, handler) => { click = handler; }, setAttribute: (_key, value) => { expanded = value; } }
  };
  const controller = createSelectionInspectorController({ $: selector => panels[selector] || null, $$: () => [], store: { getState: () => state } });
  controller.renderSelectedActions();
  assert.equal(expanded, 'false');
  click();
  assert.equal(panels['#spawn-panel-section'].hidden, false);
  assert.equal(expanded, 'true');
  click();
  assert.equal(panels['#play-rail-content'].hidden, true);
  state = { ...state, ui: { selectedEntityId: 'character', selectedEntityIds: ['character'] } };
  controller.renderSelectedActions();
  assert.equal(panels['#play-inspector-panel'].hidden, false);
  click();
  controller.renderSelectedActions();
  assert.equal(panels['#play-rail-content'].hidden, true, 'same selection does not undo manual close');
  click();
  assert.equal(panels['#spawn-panel-section'].hidden, false, 'Handle opens the tray while a character remains selected');
});


test('v2.0.0 is recorded consistently in local saves and exported projects', () => {
  const defaults = createDefaultEnvelope();
  const state = createRuntimeState(defaults);
  const save = persistedProjection(state);
  const exported = JSON.parse(serializeProjectPackage(state));
  assert.equal(APP_VERSION, '2.0.0');
  for (const value of [defaults, state, save, exported, exported.state, sanitizeEnvelope(save).envelope]) {
    assert.equal(value.appVersion, APP_VERSION);
  }
});
