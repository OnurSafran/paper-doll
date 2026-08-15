import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENE_TEMPLATES, instantiateSceneTemplate } from '../js/domain/scene-templates.js';
import { createAppStore } from '../js/core/app-store.js';

test('SCENE_TEMPLATES defines 5 rich storytelling templates across varied categories', () => {
  assert.equal(SCENE_TEMPLATES.length, 5);
  const categories = new Set(SCENE_TEMPLATES.map((t) => t.category));
  assert.ok(categories.size >= 4, 'Should cover diverse categories');

  for (const template of SCENE_TEMPLATES) {
    assert.ok(template.id, 'Template should have an id');
    assert.ok(template.title, 'Template should have a title');
    assert.ok(template.description, 'Template should have a description');
    assert.ok(template.backgroundId, 'Template should have a background');
    assert.ok(Array.isArray(template.entities), 'Template should have entities array');
    assert.ok(template.entities.length >= 2, 'Template should contain multiple entities for storytelling');
  }
});

test('instantiateSceneTemplate produces fresh independent IDs and preserved DAG attachments', () => {
  let idCounter = 100;
  const makeId = () => `inst-${idCounter++}`;
  const starterDraft = {
    baseDollId: 'doll_classic_a',
    skinTone: 'honey',
    slots: {
      hair: { assetId: 'hair_ponytail', color: 'black' }
    }
  };

  const scene = instantiateSceneTemplate('template_tea_party', makeId, starterDraft);
  assert.equal(scene.title, 'Afternoon Tea Party');
  assert.equal(scene.backgroundId, 'bg_park');
  assert.ok(scene.entities.length >= 4);

  // Check unique IDs
  const idSet = new Set(scene.entities.map((e) => e.instanceId));
  assert.equal(idSet.size, scene.entities.length, 'All instantiated entity IDs must be distinct');

  // Check character snapshot was applied
  const chars = scene.entities.filter((e) => e.kind === 'character');
  assert.ok(chars.length >= 1);
  assert.equal(chars[0].characterSnapshot.skinTone, 'honey');

  // Check bubbles have valid text and styles
  const bubbles = scene.entities.filter((e) => e.kind === 'bubble');
  assert.ok(bubbles.length >= 1);
  assert.ok(bubbles[0].text.length > 0);

  // Check attachments mapped to new instance IDs without dangling references
  for (const ent of scene.entities) {
    if (ent.attachedTo) {
      assert.ok(idSet.has(ent.attachedTo), `Attached target ${ent.attachedTo} must exist in scene`);
    }
  }
});

test('instantiateSceneTemplate falls back to safe starter draft when no snapshot is provided', () => {
  const scene = instantiateSceneTemplate('template_tea_party', () => `id-${Math.random().toString(36).slice(2)}`, null);
  const char = scene.entities.find((e) => e.kind === 'character');
  assert.ok(char);
  assert.equal(char.characterSnapshot.baseDollId, 'doll_classic_a');
  assert.equal(char.characterSnapshot.skinTone, 'peach');
});

test('instantiateSceneTemplate rejects unsafe or colliding generated IDs', () => {
  const scene = instantiateSceneTemplate('template_tea_party', () => 'unsafe.id');
  assert.equal(scene, null);

  const duplicateScene = instantiateSceneTemplate('template_tea_party', () => 'same-id');
  assert.equal(duplicateScene, null);
});

test('AppStore handles scene/loadTemplate and replaces current stage layout atomically with undo', () => {
  const store = createAppStore({
    version: 2,
    presets: [{ presetId: 'doll_custom', name: 'My Doll', slots: {} }],
    scenes: [],
    currentScene: {
      sceneId: 'old-scene',
      title: 'Old Scene',
      backgroundId: 'bg_bedroom',
      entities: [{ instanceId: 'old-1', kind: 'prop', sourceId: 'prop_lamp', x: 200, y: 300, scale: 1, order: 1 }]
    },
    designer: { draft: { slots: {} }, selectedSlot: 'top', dirty: false }
  }, { getAsset: () => ({ displayWidth: 200, displayHeight: 200 }) });

  store.dispatch({ type: 'scene/loadTemplate', templateId: 'template_atelier' });
  const newScene = store.getState().currentScene;
  assert.equal(newScene.title, 'Artisan Atelier Studio');
  assert.ok(newScene.entities.length >= 3);

  // Undo restores the previous scene
  store.dispatch({ type: 'app/undo' });
  assert.equal(store.getState().currentScene.title, 'Old Scene');
  assert.equal(store.getState().currentScene.entities[0].instanceId, 'old-1');
});
