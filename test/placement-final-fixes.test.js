import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetRegistry } from '../js/core/asset-registry.js';
import { createEmptyScene, addEntity, scaleEntity, flipEntity, flipEntities, moveEntity } from '../js/domain/scene-rules.js';
import { changePlacementBackground, placeEntity, projectLocal, orderedSceneEntities } from '../js/domain/scene-placement.js';
import { sanitizeScene } from '../js/core/state-schema.js';
import { placementShadow } from '../js/domain/placement-shadows.js';

const getAsset = createAssetRegistry().getAsset;
const item = (scene, id) => scene.entities.find(e => e.instanceId === id);
function furnished(backgroundId = 'bg_park', x = 125, y = 780) {
  let scene = changePlacementBackground(createEmptyScene('test'), backgroundId, getAsset);
  scene = addEntity(scene, { instanceId: 'table', kind: 'prop', sourceId: 'prop_table', x, y }, getAsset);
  scene = addEntity(scene, { instanceId: 'tea', kind: 'prop', sourceId: 'prop_tea_set', x: 500, y: 780 }, getAsset);
  return placeEntity(scene, 'tea', projectLocal(item(scene, 'table'), { x: .5, y: .1929 }, getAsset), getAsset, { transfer: true });
}

test('Free furnished transforms reject stage overflow and accepted transforms survive reload', () => {
  for (const [x, y] of [[125, 780], [1475, 780], [800, 220]]) {
    const scene = furnished('bg_park', x, y);
    assert.equal(item(scene, 'tea').placement.kind, 'surface');
    assert.equal(scaleEntity(scene, 'table', 1.5, getAsset), scene, `${x},${y}`);
  }
  const lookup = id => id === 'prop_table' ? { ...getAsset(id), groundAnchor: { x: .5, y: .8 } } : getAsset(id);
  let bottom = addEntity(createEmptyScene('bottom'), { instanceId: 'table', kind: 'prop', sourceId: 'prop_table', x: 800, y: 854 }, lookup);
  bottom = addEntity(bottom, { instanceId: 'tea', kind: 'prop', sourceId: 'prop_tea_set', x: 500, y: 780 }, lookup);
  bottom = placeEntity(bottom, 'tea', projectLocal(item(bottom, 'table'), { x: .5, y: .1929 }, lookup), lookup, { transfer: true });
  assert.equal(item(bottom, 'tea').placement.kind, 'surface');
  assert.equal(scaleEntity(bottom, 'table', 1.5, lookup), bottom, 'bottom overflow');
  let scene = furnished('bg_park', 800);
  scene = scaleEntity(scene, 'table', 1.5, getAsset);
  scene = flipEntity(scene, 'table', getAsset);
  const loaded = sanitizeScene(scene, getAsset);
  for (const id of ['table', 'tea']) {
    assert.equal(item(loaded, id).x, item(scene, id).x);
    assert.equal(item(loaded, id).y, item(scene, id).y);
  }
});

test('Asymmetric standalone and batch flips cannot clip beyond a free stage', () => {
  const lookup = id => id === 'prop_table' ? { ...getAsset(id), groundAnchor: { x: .9, y: 1 } } : getAsset(id);
  const scene = addEntity(createEmptyScene('test'), { instanceId: 'table', kind: 'prop', sourceId: 'prop_table', x: 1500, y: 780 }, lookup);
  assert.equal(flipEntity(scene, 'table', lookup), scene);
  assert.equal(flipEntities(scene, ['table'], lookup), scene);
  const centered = moveEntity(scene, 'table', 800, 780, lookup);
  const flipped = flipEntity(centered, 'table', lookup);
  assert.equal(item(flipped, 'table').flipped, true);
  assert.equal(item(sanitizeScene(flipped, lookup), 'table').x, 800);
});

test('Generic descendants are included in free assembly transform bounds', () => {
  let scene = furnished('bg_park', 800);
  const tea = item(scene, 'tea');
  scene = addEntity(scene, { instanceId: 'caption', kind: 'bubble', attachedTo: 'tea', x: tea.x, y: 100, text: 'Tea', width: 180 }, getAsset);
  assert.equal(scaleEntity(scene, 'table', 1.5, getAsset), scene);
});

test('Surface siblings follow contact depth while generic attachments retain their slots', () => {
  let scene = furnished('bg_bedroom', 800);
  scene = scaleEntity(scene, 'table', 2, getAsset);
  scene = placeEntity(scene, 'tea', projectLocal(item(scene, 'table'), { x: .5, y: .2522 }, getAsset), getAsset);
  scene = addEntity(scene, { instanceId: 'generic', kind: 'prop', sourceId: 'prop_camera', attachedTo: 'table', x: 900, y: 650 }, getAsset);
  scene = addEntity(scene, { instanceId: 'rear', kind: 'prop', sourceId: 'prop_tea_set', x: 1000, y: 800 }, getAsset);
  scene = placeEntity(scene, 'rear', projectLocal(item(scene, 'table'), { x: .5, y: .1335 }, getAsset), getAsset, { target: { kind: 'surface', hostId: 'table', surfaceId: 'tabletop' } });
  const ids = s => orderedSceneEntities(s, getAsset).map(e => e.instanceId);
  assert.deepEqual(ids(scene), ['table', 'rear', 'generic', 'tea']);
  assert.deepEqual(ids(flipEntity(scene, 'table', getAsset)), ids(scene));
  assert.deepEqual(ids(sanitizeScene(scene, getAsset)), ids(scene));
  const sameDepth = { ...scene, entities: scene.entities.map(e => e.instanceId === 'rear' ? { ...e, placement: { ...e.placement, localPoint: { ...e.placement.localPoint, y: item(scene, 'tea').placement.localPoint.y } } } : e) };
  assert.deepEqual(ids(sameDepth), ['table', 'tea', 'generic', 'rear']);
  assert.deepEqual(ids({ ...scene, placementMode: 'free' }), ['table', 'tea', 'generic', 'rear']);
});

test('Contact shadows follow surface support on free backgrounds and use wall geometry in rooms', () => {
  const scene = furnished();
  assert.equal(placementShadow(scene, item(scene, 'tea'), getAsset, true).shape, 'ellipse');
  assert.equal(placementShadow(scene, item(scene, 'table'), getAsset, true), null);
  const room = furnished('bg_bedroom', 800);
  assert.equal(placementShadow(room, item(room, 'table'), getAsset, true).shape, 'ellipse');
  const painting = { instanceId: 'painting', kind: 'prop', sourceId: 'prop_painting', x: 800, y: 300, scale: 1, placement: { kind: 'wall' } };
  const shadow = placementShadow(room, painting, getAsset, true);
  assert.equal(shadow.shape, 'rect');
  assert.equal(shadow.x, 803);
  assert.ok(Math.abs(shadow.y - 312.2) < 1e-9);
  assert.ok(shadow.width < getAsset('prop_painting').displayWidth);
  assert.equal(placementShadow(scene, painting, getAsset, true), null);
  assert.equal(placementShadow(room, { ...painting, placement: { kind: 'free' } }, getAsset, true), null);
});

test('Thumbnail and PNG renderer use the same wall shadow and free surface contact', async (t) => {
  const { createCompositeSceneThumbnailSvg } = await import('../js/features/scene-book/scene-book-view.js');
  const { createExportService } = await import('../js/services/export-service.js');
  const previousDocument = globalThis.document;
  t.after(() => { globalThis.document = previousDocument; });
  function node(tagName) {
    const children = [], attrs = {};
    return { tagName, children, attrs, style: { setProperty() {} },
      setAttribute(k, v) { attrs[k] = String(v); }, getAttribute(k) { return attrs[k] ?? null; },
      append(...items) { children.push(...items); }, appendChild(child) { children.push(child); },
      querySelector() { return null; }, cloneNode() { return node(tagName); }, get firstChild() { return null; } };
  }
  globalThis.document = { createElementNS: (_ns, tag) => node(tag) };
  const loadAssetSvg = async () => node('svg');
  const renderer = createExportService({ getAsset, loadAssetSvg, svgElementToImage: async () => ({}) });
  const wall = { ...createEmptyScene('wall'), placementMode: 'room', entities: [{ instanceId: 'painting', kind: 'prop', sourceId: 'prop_painting', x: 800, y: 300, scale: 1, flipped: false, order: 1, placement: { kind: 'wall' } }] };
  for (const scene of [wall, furnished()]) {
    const expected = placementShadow(scene, scene.entities.at(-1), getAsset, true);
    const svg = await createCompositeSceneThumbnailSvg(scene, { getAsset, loadAssetSvg, shadowsEnabled: true });
    const shadow = svg.children.find(n => n.attrs.fill === expected.fill);
    assert.ok(shadow, 'thumbnail includes contact shadow');
    const plain = await createCompositeSceneThumbnailSvg(scene, { getAsset, loadAssetSvg });
    assert.equal(plain.children.some(n => n.attrs.fill === expected.fill), false, 'default thumbnail has no shadows');
    const operations = [];
    const ctx = { save() {}, restore() {}, translate() {}, scale() {}, drawImage() {}, beginPath() {}, fill() {},
      ellipse(...args) { operations.push(['ellipse', ...args]); }, fillRect(...args) { operations.push(['rect', ...args]); } };
    await renderer.renderSceneToCanvas(scene, { width: 0, height: 0, getContext: () => ctx }, { shadowsEnabled: true });
    const withoutShadows = [];
    const plainContext = { ...ctx, ellipse: (...args) => withoutShadows.push(args), fillRect: (...args) => withoutShadows.push(args) };
    await renderer.renderSceneToCanvas(scene, { width: 0, height: 0, getContext: () => plainContext });
    assert.equal(withoutShadows.some(args => args[0] === expected.x || args[0] === expected.x - expected.width / 2), false, 'default PNG has no contact shadow');
    if (expected.shape === 'rect') {
      assert.equal(shadow.tagName, 'rect');
      assert.equal(Number(shadow.attrs.x), expected.x - expected.width / 2);
      assert.ok(operations.some(op => op[0] === 'rect' && op[1] === expected.x - expected.width / 2 && op[2] === expected.y - expected.height / 2 && op[3] === expected.width && op[4] === expected.height));
    } else {
      assert.equal(shadow.tagName, 'ellipse');
      assert.equal(Number(shadow.attrs.cx), expected.x);
      assert.ok(operations.some(op => op[0] === 'ellipse' && op[1] === expected.x && op[2] === expected.y && op[3] === expected.width / 2 && op[4] === expected.height / 2));
    }
  }
});

test('Authored wall shadow bounds reject invalid or incompatible pack metadata', async () => {
  const { validatePackManifest } = await import('../js/packs/pack-registry.js');
  const { CORE_PACK_MANIFEST } = await import('../js/packs/core/manifest.js');
  for (const wallShadow of [{ x: .5, y: .5, width: -1, height: .5 }, { x: 0, y: .5, width: .5, height: .5 }, { x: NaN, y: .5, width: .5, height: .5 }]) {
    const manifest = { ...CORE_PACK_MANIFEST, assets: CORE_PACK_MANIFEST.assets.map(a => a.id === 'prop_painting' ? { ...a, wallShadow } : a) };
    assert.equal(validatePackManifest(manifest).valid, false);
  }
});

test('Drag guides expose all fitting surfaces and full authored floor boundaries', async () => {
  const { getPlacementGuides } = await import('../js/domain/scene-placement.js');
  const room = furnished('bg_bedroom', 800);
  const tea = item(room, 'tea');
  const guides = getPlacementGuides(room, tea, getAsset);
  assert.deepEqual(guides.map(g => g.kind), ['floor', 'surface']);
  assert.equal(guides.find(g => g.kind === 'surface').active, true);
  assert.equal(Math.min(...guides[0].polygon.map(p => p[0])), 0);
  assert.equal(Math.max(...guides[0].polygon.map(p => p[0])), 1600);
  assert.equal(getPlacementGuides(room, item(room, 'table'), getAsset).some(g => g.kind === 'surface'), false);
  assert.deepEqual(getPlacementGuides({ ...room, placementMode: 'free' }, tea, getAsset).map(g => g.kind), ['surface']);
  const large = id => id === 'prop_tea_set' ? { ...getAsset(id), displayWidth: 2000 } : getAsset(id);
  assert.equal(getPlacementGuides(room, tea, large).some(g => g.kind === 'surface'), false);
});

test('Backgrounds retain distinct multiple floor areas rather than filling authored gaps', async () => {
  const { getPlacementGuides, getPlacementRegions } = await import('../js/domain/scene-placement.js');
  const regions = [
    { id: 'left', kind: 'floor', polygon: [[0, 700], [700, 700], [700, 900], [0, 900]] },
    { id: 'right', kind: 'floor', polygon: [[900, 740], [1600, 740], [1600, 900], [900, 900]] }
  ];
  const lookup = id => id === 'bg_bedroom' ? { ...getAsset(id), placementProfile: { regions } } : getAsset(id);
  let scene = changePlacementBackground(createEmptyScene('areas'), 'bg_bedroom', lookup);
  scene = addEntity(scene, { instanceId: 'table', kind: 'prop', sourceId: 'prop_table', x: 400, y: 800 }, lookup);
  assert.deepEqual(getPlacementRegions(scene, lookup).map(g => g.polygon), regions.map(r => r.polygon));
  assert.equal(getPlacementGuides(scene, item(scene, 'table'), lookup).length, 2);
  const moved = placeEntity(scene, 'table', { x: 800, y: 800 }, lookup, { transfer: true });
  assert.ok(item(moved, 'table').x < 700 || item(moved, 'table').x > 900);
  assert.equal(getPlacementRegions({ ...scene, stageWidth: 3200 }, lookup).length, 4);
});

test('Scene shadows default off and settings preserve opt-in through save/load', async () => {
  const { createDefaultEnvelope, sanitizeEnvelope, persistedProjection } = await import('../js/core/state-schema.js');
  const { createAppStore } = await import('../js/core/app-store.js');
  const initial = createDefaultEnvelope();
  assert.equal(initial.settings.shadowsEnabled, false);
  const scene = furnished('bg_bedroom', 800);
  assert.equal(placementShadow(scene, item(scene, 'tea'), getAsset), null);
  const store = createAppStore(initial, { getAsset });
  store.dispatch({ type: 'settings/setShadows', enabled: true });
  assert.equal(store.getState().settings.shadowsEnabled, true);
  const saved = persistedProjection(store.getState());
  assert.equal(sanitizeEnvelope(saved, getAsset).envelope.settings.shadowsEnabled, true);
  store.dispatch({ type: 'settings/setShadows', enabled: false });
  assert.equal(store.getState().settings.shadowsEnabled, false);
  const prior = { ...saved, settings: { ...saved.settings } };
  delete prior.settings.shadowsEnabled;
  assert.equal(sanitizeEnvelope(prior, getAsset).envelope.settings.shadowsEnabled, false);
});

test('Pointer drag outlines floor and compatible tabletop together and clears both on cancel', async (t) => {
  const { createAppStore } = await import('../js/core/app-store.js');
  const { createDefaultEnvelope } = await import('../js/core/state-schema.js');
  const { createStagePointerController } = await import('../js/features/play/stage-pointer-controller.js');
  const previous = { document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  t.after(() => Object.assign(globalThis, previous));
  const store = createAppStore({ ...createDefaultEnvelope(), currentScene: furnished('bg_bedroom', 800) }, { getAsset });
  const listeners = {}, overlays = [];
  const nodes = new Map(store.getState().currentScene.entities.map(e => [e.instanceId, { dataset: { instanceId: e.instanceId }, style: { setProperty() {} }, classList: { add() {}, remove() {} }, closest() { return this; } }]));
  const stage = { dataset: {}, addEventListener: (name, callback) => { listeners[name] = callback; }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 900 }), querySelector: selector => nodes.get(selector.match(/data-instance-id="([^"]+)"/)?.[1]) || null };
  globalThis.document = { createElementNS: (_ns, tag) => ({ tag, attrs: {}, children: [], setAttribute(k, v) { this.attrs[k] = v; }, append(child) { this.children.push(child); }, remove() { this.removed = true; } }) };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  const controller = createStagePointerController({ store, getAsset, $: selector => selector === '#play-stage' ? stage : selector === '#scene-world' ? { append: node => overlays.push(node) } : null, initCameraControls() {}, stopEdgePan() {}, startEdgePan() {}, render() {}, playRenderToken: 0 });
  controller.initPointerController();
  const tea = item(store.getState().currentScene, 'tea');
  const event = (type, dx = 0) => ({ type, target: nodes.get('tea'), pointerId: 1, button: 0, pointerType: 'mouse', clientX: tea.x + dx, clientY: tea.y, preventDefault() {} });
  listeners.pointerdown(event('pointerdown'));
  listeners.pointermove(event('pointermove', 10));
  assert.deepEqual(overlays.at(-1).children.map(p => p.attrs['data-kind']), ['floor', 'surface', 'surface']);
  assert.equal(overlays.at(-1).children[1].attrs['data-active'], 'true');
  const surfaceNode = overlays.at(-1).children[1];
  const echoNode = overlays.at(-1).children[2];
  assert.equal(echoNode.attrs.class, 'tabletop-guide-echo');
  assert.equal(echoNode.attrs.points, surfaceNode.attrs.points, 'echo shares the fixed boundary geometry');
  assert.equal(echoNode.attrs['data-active'], 'true');
  controller.updateDragPreview('tea', event('pointermove', 12));
  assert.equal(overlays.length, 1, 'pointer previews keep the overlay alive');
  assert.equal(overlays[0].children[1], surfaceNode, 'fixed boundary uses a stable surface node');
  assert.equal(overlays[0].children[2], echoNode, 'bob uses a stable echo node');
  controller.updateDragPreview('tea', event('pointermove', 400));
  assert.equal(surfaceNode.attrs['data-active'], 'false', 'released tabletop becomes an available target');
  assert.equal(echoNode.attrs['data-active'], 'false');
  store.dispatch({ type: 'settings/setReducedMotion', mode: 'reduce' });
  controller.updateDragPreview('tea', event('pointermove', 400));
  assert.equal(overlays[0].attrs['data-motion'], 'reduce');
  listeners.pointercancel(event('pointercancel'));
  assert.equal(overlays.at(-1).removed, true);
  assert.equal(stage.dataset.placementPreview, undefined);
});
