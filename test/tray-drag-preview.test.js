import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetRegistry } from '../js/core/asset-registry.js';
import { createEmptyScene, addEntity } from '../js/domain/scene-rules.js';
import { changePlacementBackground, projectLocal } from '../js/domain/scene-placement.js';
import { createAppStore } from '../js/core/app-store.js';
import { createDefaultEnvelope } from '../js/core/state-schema.js';
import { createTrayDragPreview } from '../js/features/play/tray-drag-preview.js';
import { LIMITS } from '../js/domain/vocabulary.js';
import { t } from '../js/core/i18n.js';

globalThis.Image ??= class { };
const getAsset = createAssetRegistry().getAsset;
const item = (scene, id) => scene.entities.find(e => e.instanceId === id);

function roomWithTable() {
  let scene = changePlacementBackground(createEmptyScene('test'), 'bg_bedroom', getAsset);
  scene = addEntity(scene, { instanceId: 'table', kind: 'prop', sourceId: 'prop_table', x: 800, y: 780 }, getAsset);
  return addEntity(scene, { instanceId: 'plant', kind: 'prop', sourceId: 'prop_plant', x: 1300, y: 800 }, getAsset);
}

function harness(tc, scene = roomWithTable()) {
  const previous = globalThis.document;
  tc.after(() => { globalThis.document = previous; });
  const store = createAppStore({ ...createDefaultEnvelope(), currentScene: scene }, { getAsset });
  const created = { polygons: 0, ghosts: 0 };
  const make = (tag) => ({
    tag, attrs: {}, children: [], dataset: {}, style: { setProperty(k, v) { this[k] = v; } }, hidden: false, textContent: '', offsetWidth: 120, offsetHeight: 30,
    classList: { add() {}, remove() {} },
    setAttribute(k, v) { this.attrs[k] = v; }, append(...kids) { this.children.push(...kids); }, remove() { this.removed = true; },
    animate() { return { cancel() {} }; }, getAnimations() { return []; }
  });
  globalThis.document = {
    createElementNS: (_ns, tag) => { if (tag === 'polygon') created.polygons++; return make(tag); },
    createElement: (tag) => make(tag)
  };
  const world = make('world');
  const stage = { dataset: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 900 }), querySelector: () => null };
  const region = { textContent: '' };
  let pointer = { point: { x: 800, y: 700 }, element: null };
  const dispatches = [];
  store.subscribe(() => dispatches.push(1));
  const preview = createTrayDragPreview({
    store, getAsset,
    $: selector => selector === '#play-stage' ? stage : selector === '#scene-world' ? world : selector === '#sr-announcements' ? region : null,
    stagePointAt: () => pointer,
    createSceneEntity: async () => { created.ghosts++; return make('button'); }
  });
  const tick = () => new Promise(resolve => setTimeout(resolve, 5));
  return { store, preview, world, stage, created, dispatches, tick, region, at: (x, y, element = null) => { pointer = { point: { x, y }, element }; } };
}
const polygons = (h) => h.world.children.find(c => c.tag === 'svg')?.children.map(p => `${p.attrs['data-kind']}:${p.attrs['data-active']}`);
const hudChip = (h) => h.world.children.find(c => c.tag === 'div').children[1];

test('A tray prop previews against the scene without adding anything to it', async (tc) => {
  const h = harness(tc);
  const before = h.store.getState().currentScene;
  const dataTransfer = { calls: 0, setDragImage() { this.calls++; } };
  assert.equal(h.preview.begin('prop_tea_set', dataTransfer), true);
  assert.equal(dataTransfer.calls, 1, 'the card image is replaced by the real artwork');
  const table = item(before, 'table');
  const top = projectLocal(table, { x: .5, y: .1929 }, getAsset);
  h.at(top.x, top.y);
  h.preview.over({});
  await h.tick();
  h.preview.over({});
  assert.equal(h.created.ghosts, 1, 'one ghost, reused');
  assert.deepEqual(polygons(h), ['floor:false', 'surface:true']);
  assert.equal(hudChip(h).children.at(-1).textContent, t('placement.guideOnSurface', { name: t('placement.tabletop') }));
  assert.equal(h.store.getState().currentScene, before, 'the committed scene is untouched');
  assert.equal(h.dispatches.length, 0, 'no store traffic, so no history entry');
  h.preview.end();
});

test('Geometry is built once per drag and moves create no nodes', async (tc) => {
  const h = harness(tc);
  h.preview.begin('prop_tea_set', null);
  h.at(800, 700);
  h.preview.over({});
  await h.tick();
  const built = h.created.polygons;
  assert.equal(built > 0, true);
  for (let i = 0; i < 80; i++) { h.at(300 + i * 12, 640 + (i % 5) * 30); h.preview.over({}); }
  assert.equal(h.created.polygons, built);
  assert.equal(h.created.ghosts, 1);
});

test('The previewed position and target are exactly what a drop commits', async (tc) => {
  const base = roomWithTable();
  const top = projectLocal(item(base, 'table'), { x: .5, y: .1929 }, getAsset);
  for (const [x, y] of [[top.x, top.y], [top.x + 20, top.y + 6], [top.x + 90, top.y + 40], [300, 760], [1000, 700], [top.x, top.y - 24]]) {
    const h = harness(tc);
    h.preview.begin('prop_tea_set', null);
    h.at(x - 30, y + 20);
    h.preview.over({});
    h.at(x, y);
    h.preview.over({});
    const previewed = h.preview.finish();
    assert.ok(previewed, `${x},${y}`);
    h.preview.end();
    h.store.dispatch({ type: 'scene/spawnProp', assetId: 'prop_tea_set', transfer: true, x: previewed.x, y: previewed.y, placementTarget: previewed.placementTarget });
    const placed = h.store.getState().currentScene.entities.at(-1);
    assert.equal(placed.x, previewed.x, `${x},${y} x`);
    assert.equal(placed.y, previewed.y, `${x},${y} y`);
    const kind = previewed.placementTarget?.kind;
    assert.equal(placed.placement?.kind, kind, `${x},${y} target`);
  }
});

test('Leaving, ending and dropping clear the ghost, guide and marker', async (tc) => {
  const h = harness(tc);
  h.preview.begin('prop_tea_set', null);
  h.at(800, 700);
  h.preview.over({});
  await h.tick();
  const svg = h.world.children.find(c => c.tag === 'svg');
  h.preview.leave();
  assert.equal(svg.removed, true);
  assert.equal(h.preview.finish(), null, 'nothing to commit while outside the stage');
  h.at(820, 700);
  h.preview.over({});
  assert.ok(h.world.children.filter(c => c.tag === 'svg' && !c.removed).length === 1, 'returning rebuilds the layer');
  const ghost = h.world.children.find(c => c.tag === 'button');
  h.preview.end();
  assert.equal(ghost.removed, true);
  assert.equal(h.preview.active, false);
  assert.equal(h.preview.finish(), null);
  assert.equal(h.stage.dataset.placementPreview, undefined);
});

test('Over a doll the prop is held: a note, no targets, and nothing placement-previewed', async (tc) => {
  let scene = roomWithTable();
  scene = addEntity(scene, { instanceId: 'doll', kind: 'character', sourceId: 'demo_emma', characterSnapshot: {}, x: 400, y: 800 }, getAsset);
  const h = harness(tc, scene);
  h.preview.begin('prop_tea_set', null);
  h.at(400, 700, { dataset: { instanceId: 'doll' } });
  h.preview.over({});
  await h.tick();
  assert.equal(polygons(h), undefined, 'no placement targets');
  const chip = hudChip(h);
  assert.match(chip.children.at(-1).textContent, new RegExp(t('placement.guideHeldBy', { name: '.+' }).replace('.+', '.+')));
  assert.equal(h.preview.finish(), null, 'the drop keeps the existing held-prop path');
});

test('Cards that cannot preview keep the browser drag image', (tc) => {
  const h = harness(tc);
  const transfer = { calls: 0, setDragImage() { this.calls++; } };
  assert.equal(h.preview.begin('bg_park', transfer), false);
  assert.equal(h.preview.begin('missing_prop', transfer), false);
  assert.equal(transfer.calls, 0);
  let scene = changePlacementBackground(createEmptyScene('full'), 'bg_bedroom', getAsset);
  for (let i = 0; i < LIMITS.MAX_ENTITIES; i++) scene = addEntity(scene, { instanceId: `piece${i}`, kind: 'prop', sourceId: 'prop_plant', x: 100 + (i % 20) * 70, y: 700 + (i % 5) * 30 }, getAsset);
  const full = harness(tc, scene);
  assert.equal(full.preview.begin('prop_tea_set', transfer), false, 'a full scene cannot take a piece');
});
