import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BUBBLE_STYLES,
  DEFAULT_BUBBLE_STYLE,
  DEFAULT_BUBBLE_TEXT,
  ENTITY_KINDS,
  isBubbleStyle,
  isEntityKind,
  LIMITS
} from '../js/domain/vocabulary.js';
import { sanitizeEnvelope, createDefaultEnvelope } from '../js/core/state-schema.js';
import {
  addEntity,
  attachEntity,
  clampCompoundEntityPoint,
  createEmptyScene,
  deleteEntity,
  getCompoundEntityRange,
  getEntityBounds,
  moveEntity,
  setBubbleStyle,
  setBubbleText,
  setBubbleWidth
} from '../js/domain/scene-rules.js';
import { createAppStore } from '../js/core/app-store.js';
import { createBubbleSvg, createExportService, wrapBubbleText } from '../js/services/export-service.js';

test('Bubble vocabulary defines entity kinds, styles, and limits', () => {
  assert.ok(ENTITY_KINDS.includes('bubble'), 'ENTITY_KINDS includes bubble');
  assert.ok(isEntityKind('bubble'), 'isEntityKind recognises bubble');
  assert.deepEqual([...BUBBLE_STYLES], ['speech', 'thought', 'shout', 'caption']);
  assert.ok(isBubbleStyle('speech'));
  assert.ok(isBubbleStyle('thought'));
  assert.ok(isBubbleStyle('shout'));
  assert.ok(isBubbleStyle('caption'));
  assert.ok(!isBubbleStyle('unknown_style'));
  assert.equal(DEFAULT_BUBBLE_STYLE, 'speech');
  assert.equal(DEFAULT_BUBBLE_TEXT, 'Hello!');
  assert.equal(LIMITS.MAX_BUBBLE_TEXT_LENGTH, 120);
});

test('wrapBubbleText breaks text into balanced lines', () => {
  const shortText = 'Hello there';
  assert.deepEqual(wrapBubbleText(shortText, 20), ['Hello there']);

  const longText = 'Once upon a time in a magical forest there lived a little paper doll.';
  const wrapped = wrapBubbleText(longText, 20);
  assert.ok(wrapped.length > 1, 'Splits long text across multiple lines');
  for (const line of wrapped) {
    assert.ok(line.length <= 25, `Line length ${line.length} is within capacity`);
  }
});

test('createBubbleSvg generates valid SVG element with proper geometry for all 4 styles', () => {
  const styles = ['speech', 'thought', 'shout', 'caption'];
  for (const style of styles) {
    const svg = createBubbleSvg({
      instanceId: `bubble-${style}`,
      kind: 'bubble',
      bubbleStyle: style,
      text: `Testing ${style} bubble with some nice text!`,
      width: 260
    });
    assert.ok(svg, `SVG created for ${style}`);
    assert.equal(svg.tagName.toLowerCase(), 'svg');
    assert.equal(svg.getAttribute('width'), '260');
    assert.ok(svg.querySelector(`.bubble-${style}`), `Contains .bubble-${style} class`);
    assert.ok(svg.querySelector('text'), 'Contains text nodes');
  }
});

test('getEntityBounds calculates height dynamically for bubble entities', () => {
  const shortBubble = { kind: 'bubble', width: 240, text: 'Hi', scale: 1 };
  const longBubble = { kind: 'bubble', width: 240, text: 'This is a much longer text that spans across several lines of speech and increases bubble height.', scale: 1 };
  
  const shortBounds = getEntityBounds(shortBubble);
  const longBounds = getEntityBounds(longBubble);

  assert.equal(shortBounds.width, 240);
  assert.equal(shortBounds.anchorX, 0.5);
  assert.equal(shortBounds.anchorY, 1.0);
  assert.ok(longBounds.height > shortBounds.height, 'Longer text yields larger bubble height');
});

test('Scene rules allow adding, updating text/style/width on bubble entities', () => {
  let scene = createEmptyScene('test-scene');
  scene = addEntity(scene, {
    instanceId: 'b-1',
    kind: 'bubble',
    sourceId: 'bubble',
    bubbleStyle: 'speech',
    text: 'Hello world',
    width: 240,
    x: 800,
    y: 400
  });

  assert.equal(scene.entities.length, 1);
  assert.equal(scene.entities[0].kind, 'bubble');
  assert.equal(scene.entities[0].text, 'Hello world');
  assert.equal(scene.entities[0].bubbleStyle, 'speech');

  scene = setBubbleText(scene, 'b-1', 'Updated greeting');
  assert.equal(scene.entities[0].text, 'Updated greeting');

  scene = setBubbleStyle(scene, 'b-1', 'thought');
  assert.equal(scene.entities[0].bubbleStyle, 'thought');

  scene = setBubbleWidth(scene, 'b-1', 320);
  assert.equal(scene.entities[0].width, 320);
});

test('State schema sanitizes bubble entities and truncates oversized text to 120 characters', () => {
  const dummyAsset = (id) => id === 'bg_classic' ? { id, kind: 'background' } : undefined;
  const long150Chars = 'A'.repeat(150);
  const envelope = {
    schemaVersion: 2,
    revision: 1,
    savedAt: new Date().toISOString(),
    settings: { reducedMotion: 'system', soundEnabled: false },
    presets: [],
    scenes: [
      {
        sceneId: 'sc-1',
        name: 'Story Scene',
        backgroundId: 'bg_classic',
        entities: [
          {
            instanceId: 'b-over',
            kind: 'bubble',
            sourceId: 'bubble',
            text: long150Chars,
            bubbleStyle: 'invalid_style',
            width: 9999,
            x: 800,
            y: 400
          }
        ],
        updatedAt: new Date().toISOString()
      }
    ],
    currentSceneId: 'sc-1'
  };

  const { envelope: sanitized } = sanitizeEnvelope(envelope, dummyAsset);
  assert.ok(sanitized, 'Envelope is valid');
  const entity = sanitized.scenes[0].entities[0];
  assert.equal(entity.kind, 'bubble');
  assert.equal(entity.text.length, 120, 'Text truncated to 120 graphemes');
  assert.equal(entity.bubbleStyle, 'speech', 'Invalid style falls back to default speech style');
  assert.equal(entity.width, 420, 'Width clamped to maximum 420');
});

test('AppStore handles scene/spawnBubble targeting an entity with auto-attachment and positioning', () => {
  const envelope = createDefaultEnvelope();
  const store = createAppStore(envelope, {
    getAsset: (id) => (id === 'bg_bedroom' ? { id, kind: 'background' } : { id, kind: 'prop', displayWidth: 100, displayHeight: 100 })
  });
  store.dispatch({ type: 'scene/new' });
  store.dispatch({ type: 'preset/save', name: 'Emma' });
  const presetId = store.getState().presets[0].presetId;

  // Spawn doll
  store.dispatch({
    type: 'scene/spawnCharacter',
    presetId,
    x: 800,
    y: 700
  });

  const dollId = store.getState().currentScene.entities[0].instanceId;
  store.dispatch({ type: 'ui/selectEntity', instanceId: dollId });

  // Spawn bubble while doll is selected
  store.dispatch({
    type: 'scene/spawnBubble',
    bubbleStyle: 'speech',
    text: 'Hello from Emma!'
  });

  const scene = store.getState().currentScene;
  assert.equal(scene.entities.length, 2);
  const bubble = scene.entities.find((e) => e.kind === 'bubble');
  assert.ok(bubble, 'Bubble exists in scene');
  assert.equal(bubble.text, 'Hello from Emma!');
  assert.equal(bubble.attachedTo, dollId, 'Bubble is attached to Emma doll');
  assert.ok(bubble.y < 700, 'Bubble is positioned above the doll');

  // Moving Emma propagates to bubble
  store.dispatch({
    type: 'scene/moveEntity',
    instanceId: dollId,
    x: 900,
    y: 750
  });

  const movedScene = store.getState().currentScene;
  const movedEmma = movedScene.entities.find((e) => e.instanceId === dollId);
  const movedBubble = movedScene.entities.find((e) => e.instanceId === bubble.instanceId);
  assert.equal(movedEmma.x, 900);
  assert.equal(movedBubble.x, 900, 'Bubble moved along with Emma horizontally');
});

test('AppStore mutates bubble style and text with undo/redo support', () => {
  const envelope = createDefaultEnvelope();
  const store = createAppStore(envelope);
  store.dispatch({ type: 'scene/new' });

  store.dispatch({
    type: 'scene/spawnBubble',
    bubbleStyle: 'speech',
    text: 'Initial text'
  });

  const bubbleId = store.getState().currentScene.entities[0].instanceId;
  assert.equal(store.getState().currentScene.entities[0].text, 'Initial text');

  // Update text
  store.dispatch({
    type: 'scene/setBubbleText',
    instanceId: bubbleId,
    text: 'Second text'
  });
  assert.equal(store.getState().currentScene.entities[0].text, 'Second text');

  // Update style
  store.dispatch({
    type: 'scene/setBubbleStyle',
    instanceId: bubbleId,
    bubbleStyle: 'shout'
  });
  assert.equal(store.getState().currentScene.entities[0].bubbleStyle, 'shout');

  // Undo style change
  store.dispatch({ type: 'app/undo' });
  assert.equal(store.getState().currentScene.entities[0].bubbleStyle, 'speech');

  // Undo text change
  store.dispatch({ type: 'app/undo' });
  assert.equal(store.getState().currentScene.entities[0].text, 'Initial text');

  // Redo
  store.dispatch({ type: 'app/redo' });
  assert.equal(store.getState().currentScene.entities[0].text, 'Second text');
});

test('Export service renders bubble entities to canvas without errors', async () => {
  const drawnItems = [];
  const fakeCtx = {
    save() {},
    restore() {},
    translate(x, y) { drawnItems.push({ type: 'translate', x, y }); },
    scale(sx, sy) { drawnItems.push({ type: 'scale', sx, sy }); },
    drawImage(img, dx, dy, dw, dh) { drawnItems.push({ type: 'image', dx, dy, dw, dh }); },
    fillRect() {}
  };

  const fakeCanvas = {
    getContext: () => fakeCtx,
    width: 0,
    height: 0
  };

  const exportService = createExportService({
    getAsset: () => ({ id: 'bg', kind: 'background' }),
    loadAssetSvg: async () => ({ cloneNode: () => ({ setAttribute() {} }) }),
    svgElementToImage: async (svg, w, h) => ({ width: w, height: h })
  });

  const scene = {
    sceneId: 'test-export',
    name: 'Export Scene',
    backgroundId: 'bg_classic',
    entities: [
      {
        instanceId: 'b-1',
        kind: 'bubble',
        sourceId: 'bubble',
        bubbleStyle: 'shout',
        text: 'Boom!',
        width: 240,
        x: 800,
        y: 400,
        scale: 1,
        flipped: false,
        order: 1
      }
    ],
    updatedAt: new Date().toISOString()
  };

  await exportService.renderSceneToCanvas(scene, fakeCanvas);
  const imagesDrawn = drawnItems.filter((i) => i.type === 'image');
  assert.ok(imagesDrawn.length >= 2, 'Rendered background and bubble image onto canvas');
});

test('AppStore handles scene/spawnBubble with explicit (x,y) and targetEntityId to attach bubble and calculate attachOffset', () => {
  const store = createAppStore(createDefaultEnvelope());
  store.dispatch({ type: 'preset/save', name: 'Doll Emma' });
  const presetId = store.getState().presets[0].presetId;
  store.dispatch({ type: 'scene/new' });
  store.dispatch({ type: 'scene/spawnCharacter', presetId, x: 500, y: 600 });
  const charId = store.getState().currentScene.entities[0].instanceId;

  // Drag and drop bubble onto character with explicit drop coordinates
  store.dispatch({
    type: 'scene/spawnBubble',
    bubbleStyle: 'speech',
    text: 'Attached bubble',
    targetEntityId: charId,
    x: 520,
    y: 320
  });

  const entities = store.getState().currentScene.entities;
  assert.equal(entities.length, 2);
  const bubble = entities.find((e) => e.kind === 'bubble');
  assert.equal(bubble.attachedTo, charId);
  assert.deepEqual(bubble.attachOffset, { dx: 20, dy: -280 });

  // Move parent character and verify attached bubble receives delta shift
  store.dispatch({ type: 'scene/moveEntity', instanceId: charId, x: 700, y: 600 });
  const movedBubble = store.getState().currentScene.entities.find((e) => e.kind === 'bubble');
  assert.equal(movedBubble.x, 720);
  assert.equal(movedBubble.y, 320);
});
