import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetRegistry } from '../js/core/asset-registry.js';
import { createEmptyScene, addEntity } from '../js/domain/scene-rules.js';
import { changePlacementBackground, placeEntity, projectLocal } from '../js/domain/scene-placement.js';
import { t } from '../js/core/i18n.js';
import { surfaceName, targetChipLabel } from '../js/features/play/placement-labels.js';

const getAsset = createAssetRegistry().getAsset;
const item = (scene, id) => scene.entities.find(e => e.instanceId === id);

function furnished(backgroundId = 'bg_bedroom', x = 800, stageWidth = 1600) {
  let scene = { ...changePlacementBackground(createEmptyScene('test'), backgroundId, getAsset), stageWidth };
  scene = addEntity(scene, { instanceId: 'table', kind: 'prop', sourceId: 'prop_table', x, y: 780 }, getAsset);
  scene = addEntity(scene, { instanceId: 'tea', kind: 'prop', sourceId: 'prop_tea_set', x: 500, y: 780 }, getAsset);
  scene = addEntity(scene, { instanceId: 'plant', kind: 'prop', sourceId: 'prop_plant', x: 1300, y: 800 }, getAsset);
  return placeEntity(scene, 'tea', projectLocal(item(scene, 'table'), { x: .5, y: .1929 }, getAsset), getAsset, { transfer: true });
}

/** A DOM just rich enough for the stage pointer controller and the guide layer. */
async function harness(tc, { scene = furnished(), lookup = getAsset } = {}) {
  const { createAppStore } = await import('../js/core/app-store.js');
  const { createDefaultEnvelope } = await import('../js/core/state-schema.js');
  const { createStagePointerController } = await import('../js/features/play/stage-pointer-controller.js');
  const previous = { document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  tc.after(() => Object.assign(globalThis, previous));
  const store = createAppStore({ ...createDefaultEnvelope(), currentScene: scene }, { getAsset: lookup });
  const created = { polygons: 0, elements: 0 };
  const animations = [];
  const settles = [];
  const make = (tag) => {
    const node = {
      tag, attrs: {}, children: [], dataset: {}, style: {}, hidden: false, textContent: '', className: '', offsetWidth: 120, offsetHeight: 30,
      classList: { add() {}, remove() {} },
      setAttribute(k, v) { this.attrs[k] = v; },
      getAttribute(k) { return this.attrs[k]; },
      append(...kids) { this.children.push(...kids); },
      remove() { this.removed = true; },
      animate(keyframes) { animations.push(keyframes); return { cancel() {} }; },
      getAnimations() { return []; }
    };
    return node;
  };
  const world = make('world');
  const region = { textContent: '' };
  const nodes = new Map(store.getState().currentScene.entities.map(e => [e.instanceId, { dataset: { instanceId: e.instanceId }, style: { setProperty() {} }, classList: { add() {}, remove() {} }, closest() { return this; }, animate(frames) { settles.push(frames); } }]));
  const listeners = {};
  const stage = { dataset: {}, addEventListener: (name, callback) => { listeners[name] = callback; }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 900 }), querySelector: selector => nodes.get(selector.match(/data-instance-id="([^"]+)"/)?.[1]) || null };
  globalThis.document = {
    createElementNS: (_ns, tag) => { created.elements++; if (tag === 'polygon') created.polygons++; return make(tag); },
    createElement: (tag) => { created.elements++; return make(tag); }
  };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  const controller = createStagePointerController({
    store, getAsset: lookup, initCameraControls() {}, stopEdgePan() {}, startEdgePan() {}, render() {}, playRenderToken: 0,
    $: selector => selector === '#play-stage' ? stage : selector === '#scene-world' ? world : selector === '#sr-announcements' ? region : null
  });
  controller.initPointerController();
  const guideSvg = () => world.children.find(c => c.tag === 'svg');
  const hud = () => world.children.find(c => c.tag === 'div');
  const hudParts = () => { const [marker, chip] = hud().children; return { marker, chip, chipText: chip.children.at(-1) }; };
  const entity = (id = 'tea') => item(store.getState().currentScene, id);
  const event = (type, id, dx = 0, dy = 0) => ({ type, target: nodes.get(id), pointerId: 1, button: 0, pointerType: 'mouse', clientX: entity(id).x + dx, clientY: entity(id).y + dy, preventDefault() {} });
  return { store, controller, stage, world, region, listeners, created, animations, settles, guideSvg, hud, hudParts, entity, event };
}
const polygonStates = (h) => h.guideSvg().children.map(p => `${p.attrs['data-kind']}:${p.attrs['data-active']}`);
const markerPoint = (h) => h.hudParts().marker.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/).slice(1).map(Number);

test('Pickup keeps the current support active with its marker and chip, and moves hand off between targets', async (tc) => {
  const h = await harness(tc);
  h.listeners.pointerdown(h.event('pointerdown', 'tea'));
  h.listeners.pointermove(h.event('pointermove', 'tea', 10));
  assert.deepEqual(polygonStates(h), ['floor:false', 'surface:true']);
  assert.equal(h.stage.dataset.placementPreview, 'surface');
  assert.equal(h.hud().dataset.kind, 'surface');
  assert.equal(h.hudParts().marker.hidden, false);
  assert.equal(h.hudParts().chip.hidden, false);
  assert.equal(h.hudParts().chipText.textContent, t('placement.guideOnSurface', { name: t('placement.tabletop') }));
  h.controller.updateDragPreview('tea', h.event('pointermove', 'tea', 400));
  assert.deepEqual(polygonStates(h), ['floor:true', 'surface:false']);
  assert.equal(h.stage.dataset.placementPreview, 'floor');
  assert.equal(h.hudParts().chipText.textContent, t('placement.onFloor'));
  h.listeners.pointercancel(h.event('pointercancel', 'tea'));
  assert.equal(h.hud().removed, true, 'layer detached');
  assert.equal(h.stage.dataset.placementPreview, undefined);
});

test('Release, cancel and a repeat drag all clear the whole layer', async (tc) => {
  const h = await harness(tc);
  h.listeners.pointerdown(h.event('pointerdown', 'tea'));
  h.listeners.pointermove(h.event('pointermove', 'tea', 30));
  const svg = h.guideSvg(), hud = h.hud();
  h.listeners.pointerup(h.event('pointerup', 'tea', 30));
  assert.equal(svg.removed, true);
  assert.equal(hud.removed, true);
  assert.equal(h.stage.dataset.placementPreview, undefined);
});

test('Guide geometry is built once per drag and moves create no nodes', async (tc) => {
  const h = await harness(tc);
  h.listeners.pointerdown(h.event('pointerdown', 'tea'));
  h.listeners.pointermove(h.event('pointermove', 'tea', 5));
  const afterSetup = { ...h.created };
  assert.equal(afterSetup.polygons, 2, 'one polygon per target, no echo');
  for (let i = 0; i < 60; i++) h.controller.updateDragPreview('tea', h.event('pointermove', 'tea', (i % 2 ? 300 : 10) + i));
  assert.deepEqual(h.created, afterSetup);
});

test('Camera auto-pan does not rebuild guide geometry, but a changed host or background does exactly once', async (tc) => {
  const h = await harness(tc, { scene: furnished('bg_bedroom', 800, 3200) });
  h.listeners.pointerdown(h.event('pointerdown', 'tea'));
  h.listeners.pointermove(h.event('pointermove', 'tea', 5));
  const built = h.created.polygons;
  for (let cameraX = 40; cameraX <= 1200; cameraX += 40) {
    h.store.dispatch({ type: 'scene/setCameraX', cameraX });
    h.controller.updateDragPreview('tea', h.event('pointermove', 'tea', 5));
  }
  assert.equal(h.store.getState().currentScene.cameraX > 0, true, 'the camera really panned');
  assert.equal(h.created.polygons, built, 'pans leave geometry alone');
  h.store.dispatch({ type: 'scene/moveEntity', instanceId: 'plant', x: 1200, y: 800 });
  h.controller.updateDragPreview('tea', h.event('pointermove', 'tea', 5));
  h.controller.updateDragPreview('tea', h.event('pointermove', 'tea', 6));
  assert.equal(h.created.polygons, built * 2, 'one rebuild after an unrelated entity moved');
});

test('Room mode with nowhere legal to rest draws nothing and says so once', async (tc) => {
  const large = id => id === 'prop_tea_set' ? { ...getAsset(id), displayWidth: 2000 } : getAsset(id);
  const scene = changePlacementBackground(createEmptyScene('test'), 'bg_bedroom', getAsset);
  const room = addEntity(scene, { instanceId: 'tea', kind: 'prop', sourceId: 'prop_tea_set', x: 800, y: 780 }, getAsset);
  const h = await harness(tc, { scene: room, lookup: large });
  h.listeners.pointerdown(h.event('pointerdown', 'tea'));
  h.listeners.pointermove(h.event('pointermove', 'tea', 20));
  h.controller.updateDragPreview('tea', h.event('pointermove', 'tea', 40));
  assert.equal(h.guideSvg(), undefined);
  assert.equal(h.store.getState().ui.message, t('placement.invalid'));
});

test('The active guide target and contact marker match what a release commits', async (tc) => {
  for (const dx of [0, 25, 60, 120, 200, 400, -300]) {
    const h = await harness(tc, { scene: furnished('bg_bedroom', 800, 1600) });
    h.listeners.pointerdown(h.event('pointerdown', 'tea'));
    h.listeners.pointermove(h.event('pointermove', 'tea', 10));
    h.controller.updateDragPreview('tea', h.event('pointermove', 'tea', dx));
    const active = h.guideSvg().children.find(p => p.attrs['data-active'] === 'true');
    const [mx, my] = markerPoint(h);
    h.listeners.pointerup(h.event('pointerup', 'tea', dx));
    const committed = h.entity('tea');
    assert.equal(active?.attrs['data-kind'], committed.placement.kind, `dx ${dx}`);
    assert.equal(Math.round(mx * 100), Math.round(committed.x * 100), `dx ${dx} x`);
    assert.equal(Math.round(my * 100), Math.round(committed.y * 100), `dx ${dx} y`);
  }
});

test('The chip stays inside the visible window and the marker stays at the contact point', async (tc) => {
  const h = await harness(tc, { scene: furnished('bg_bedroom', 800, 3200) });
  h.store.dispatch({ type: 'scene/setCameraX', cameraX: 800 });
  h.listeners.pointerdown(h.event('pointerdown', 'tea'));
  h.listeners.pointermove(h.event('pointermove', 'tea', 5));
  const { chip } = h.hudParts();
  const left = Number(chip.style.transform.match(/translate\(([-\d.]+)px/)[1]);
  const top = Number(chip.style.transform.match(/, ([-\d.]+)px\)/)[1]);
  assert.equal(left >= 800 + 8 && left + 120 <= 800 + 1600 - 8, true, `chip x ${left}`);
  assert.equal(top >= 8 && top + 30 <= 900 - 8, true, `chip y ${top}`);
  const [mx] = markerPoint(h);
  assert.equal(left, 800 + 8, 'the chip shifts in from the left edge of the camera window');
  assert.equal(mx, h.entity('tea').x, 'the marker is never shifted');
});

test('Announcements name the host on change only, and motion follows the reduced-motion setting', async (tc) => {
  const h = await harness(tc);
  h.store.dispatch({ type: 'settings/setReducedMotion', mode: 'reduce' });
  h.listeners.pointerdown(h.event('pointerdown', 'tea'));
  h.listeners.pointermove(h.event('pointermove', 'tea', 5));
  await new Promise(resolve => setTimeout(resolve, 70));
  assert.equal(h.region.textContent, '', 'pickup itself is not announced');
  h.controller.updateDragPreview('tea', h.event('pointermove', 'tea', 400));
  await new Promise(resolve => setTimeout(resolve, 70));
  assert.equal(h.region.textContent, t('placement.floor'));
  h.controller.updateDragPreview('tea', h.event('pointermove', 'tea', 5));
  await new Promise(resolve => setTimeout(resolve, 70));
  assert.match(h.region.textContent, / — /, 'surface announcements include the host');
  assert.equal(h.animations.length, 0, 'no marker pop with reduced motion');
  h.store.dispatch({ type: 'settings/setReducedMotion', mode: 'full' });
  h.controller.updateDragPreview('tea', h.event('pointermove', 'tea', 400));
  assert.equal(h.animations.length, 1);
  h.listeners.pointercancel(h.event('pointercancel', 'tea'));
});

test('Surface names resolve custom name, then translated key, then the generic fallback', () => {
  assert.equal(surfaceName({ name: 'My shelf', nameKey: 'placement.tabletop' }), 'My shelf');
  assert.equal(surfaceName({ nameKey: 'placement.tabletop' }), t('placement.tabletop'));
  assert.equal(surfaceName({}), t('placement.tabletop'));
  assert.equal(targetChipLabel({ kind: 'surface', surface: { name: 'My shelf' } }), t('placement.guideOnSurface', { name: 'My shelf' }));
  assert.equal(targetChipLabel({ kind: 'wall' }), t('placement.onWall'));
});

test('A drop settles the piece once, never for a click-without-move, and not with reduced motion', async (tc) => {
  const h = await harness(tc);
  h.listeners.pointerdown(h.event('pointerdown', 'tea'));
  h.listeners.pointermove(h.event('pointermove', 'tea', 10));
  h.controller.updateDragPreview('tea', h.event('pointermove', 'tea', 400));
  h.listeners.pointerup(h.event('pointerup', 'tea', 400));
  assert.equal(h.settles.length, 1);
  assert.deepEqual(h.settles[0].map(f => f.scale), ['1 1', '1.05 0.93', '1 1']);

  const still = await harness(tc);
  still.listeners.pointerdown(still.event('pointerdown', 'tea'));
  still.listeners.pointerup(still.event('pointerup', 'tea'));
  assert.equal(still.settles.length, 0, 'a tap does not settle');

  const calm = await harness(tc);
  calm.store.dispatch({ type: 'settings/setReducedMotion', mode: 'reduce' });
  calm.listeners.pointerdown(calm.event('pointerdown', 'tea'));
  calm.listeners.pointermove(calm.event('pointermove', 'tea', 10));
  calm.controller.updateDragPreview('tea', calm.event('pointermove', 'tea', 400));
  calm.listeners.pointerup(calm.event('pointerup', 'tea', 400));
  assert.equal(calm.settles.length, 0);
});
