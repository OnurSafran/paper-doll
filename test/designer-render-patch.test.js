import test from 'node:test';
import assert from 'node:assert/strict';
import { cloneDraft, createStarterDraft } from '../js/domain/outfit-rules.js';
import { patchDollColors } from '../js/features/designer/designer-view.js';

function makeLayer(slot) {
  const values = {};
  return {
    dataset: { slot },
    style: { setProperty(name, value) { values[name] = value; } },
    values
  };
}

function makeStage(...slots) {
  const layers = slots.map(makeLayer);
  return {
    layers,
    querySelectorAll() { return layers; },
    setAttribute() {}
  };
}

test('Designer patches color-only doll changes without rebuilding layers', () => {
  const previous = createStarterDraft();
  previous.face.eyes.assetId = 'eyes_sparkle';
  const next = cloneDraft(previous);
  next.skinTone = 'honey';
  next.slots.top.color = 'sky';
  next.slots.hair.color = 'blonde';
  next.face.eyes.irisColor = 'lavender';

  const stage = makeStage('skin', 'top', 'hair', 'face-eyes');
  assert.equal(patchDollColors(stage, previous, next), true);
  assert.equal(stage.layers[0].values['--skin-color'], '#dca878');
  assert.equal(stage.layers[1].values['--asset-color-primary'], '#78add2');
  assert.equal(stage.layers[2].values['--hair-color'], '#d8aa52');
  assert.equal(stage.layers[3].values['--iris-color'], '#a78bc4');
});

test('Designer requests a rebuild when the doll layer structure changes', () => {
  const previous = createStarterDraft();
  const next = cloneDraft(previous);
  next.baseDollId = 'doll_adult_a';
  const stage = makeStage('skin', 'top', 'hair');

  assert.equal(patchDollColors(stage, previous, next), false);
  assert.deepEqual(stage.layers.map((layer) => layer.values), [{}, {}, {}]);
});

test('Default-face iris changes rebuild so the baked face can be replaced', () => {
  const previous = createStarterDraft();
  const next = cloneDraft(previous);
  next.face.eyes.irisColor = 'lavender';

  assert.equal(patchDollColors(makeStage('skin'), previous, next), false);
});
