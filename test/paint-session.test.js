import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateArtworkName,
  createPaintSession,
  MAX_HISTORY_STEPS,
  MAX_HISTORY_BYTES
} from '../js/features/paint/paint-session.js';

test('validateArtworkName rejects empty or oversized names', () => {
  assert.equal(validateArtworkName('').valid, false);
  assert.equal(validateArtworkName('   ').valid, false);
  assert.equal(validateArtworkName('Valid Shirt').valid, true);

  const longName = 'a'.repeat(35);
  assert.equal(validateArtworkName(longName).valid, false);
});

test('createPaintSession initializes with sound defaults for wearables', () => {
  const session = createPaintSession({ itemType: 'wearable', slot: 'dress' });
  const state = session.getState();

  assert.equal(state.itemType, 'wearable');
  assert.equal(state.slot, 'dress');
  assert.equal(session.logicalWidth, 300);
  assert.equal(session.logicalHeight, 450);
  assert.equal(session.pixelWidth, 600);
  assert.equal(session.pixelHeight, 900);
  assert.equal(session.mirrorAxisX, 150);
  assert.equal(state.tool, 'brush');
  assert.equal(state.brushSize, 10);
  assert.equal(state.mirror, false);
  assert.equal(state.dirty, false);
});

test('createPaintSession initializes with sound defaults for props', () => {
  const session = createPaintSession({ itemType: 'prop' });
  const state = session.getState();

  assert.equal(state.itemType, 'prop');
  assert.equal(session.logicalWidth, 500);
  assert.equal(session.logicalHeight, 500);
  assert.equal(session.pixelWidth, 1000);
  assert.equal(session.pixelHeight, 1000);
  assert.equal(session.mirrorAxisX, 250);
  assert.equal(state.propSize, 'medium');
  assert.equal(state.propPlacement, 'surface');
});

test('createPaintSession manages tool, shape, color, brush, and mirror state mutations', () => {
  const session = createPaintSession();

  session.setTool('eraser');
  assert.equal(session.getState().tool, 'eraser');

  session.setTool('invalid'); // ignored
  assert.equal(session.getState().tool, 'eraser');

  session.setShapeType('ellipse');
  assert.equal(session.getState().shapeType, 'ellipse');

  session.setShapeFilled(true);
  assert.equal(session.getState().shapeFilled, true);

  session.setBrushSize(1);
  assert.equal(session.getState().brushSize, 1);

  session.setBrushSize(50);
  assert.equal(session.getState().brushSize, 50);

  session.setBrushSize(25);
  assert.equal(session.getState().brushSize, 25);

  session.setBrushSize(0); // out of bounds: ignored
  assert.equal(session.getState().brushSize, 25);

  session.setBrushSize(51); // out of bounds: ignored
  assert.equal(session.getState().brushSize, 25);

  session.setColor('#123456');
  assert.equal(session.getState().color, '#123456');

  session.toggleMirror();
  assert.equal(session.getState().mirror, true);
  session.toggleMirror();
  assert.equal(session.getState().mirror, false);

  session.setZoom(2);
  assert.equal(session.getState().zoom, 2);
});

test('wearable slot changes preserve raster history and generated-name semantics', () => {
  const session = createPaintSession({ itemType: 'wearable', slot: 'top' });
  const snapshot = { id: 'paint-before-slot-change' };
  session.pushHistory(snapshot);

  assert.equal(session.setSlot('dress'), true);
  assert.equal(session.getState().slot, 'dress');
  assert.equal(session.getState().name, 'My dress');
  assert.equal(session.getState().dirty, true);
  assert.equal(session.canUndo(), true);
  assert.equal(session.undo({ id: 'current' }), snapshot);
  assert.equal(session.getState().slot, 'dress');
  assert.equal(session.getState().dirty, true);

  session.setName('Moonlight costume');
  assert.equal(session.setSlot('shoes'), true);
  assert.equal(session.getState().name, 'Moonlight costume');
  assert.equal(session.setSlot('hair'), false);
  assert.equal(session.getState().slot, 'shoes');
});

test('reference preferences are bounded and do not dirty the artwork', () => {
  const session = createPaintSession();
  session.setBaseDollId('doll_chibi_a');
  session.setReferenceVisible(false);
  session.setReferenceOpacity(77);
  session.setGuidesVisible(false);
  session.setCutoutReferenceVisible(false);
  session.setCutoutAssetId('top_tshirt');

  const state = session.getState();
  assert.equal(state.baseDollId, 'doll_chibi_a');
  assert.equal(state.referenceVisible, false);
  assert.equal(state.referenceOpacity, 80);
  assert.equal(state.guidesVisible, false);
  assert.equal(state.cutoutReferenceVisible, false);
  assert.equal(state.cutoutAssetId, 'top_tshirt');
  assert.equal(state.dirty, false);
});

test('createPaintSession enforces bounded Undo/Redo stack with maximum 20 steps', () => {
  const session = createPaintSession();
  assert.equal(session.canUndo(), false);
  assert.equal(session.canRedo(), false);

  // Push 25 snapshots
  for (let i = 1; i <= 25; i++) {
    session.pushHistory({ id: i });
  }

  assert.equal(session.getState().dirty, true);
  assert.equal(session.canUndo(), true);

  // Pop undo
  const last = session.undo({ id: 'current' });
  assert.equal(last.id, 25);
  assert.equal(session.canRedo(), true);

  // Redo
  const redone = session.redo({ id: 25 });
  assert.equal(redone.id, 'current');

  // Push new history clears redo
  session.pushHistory({ id: 'new_fork' });
  assert.equal(session.canRedo(), false);

  // Count max undos available (must not exceed MAX_HISTORY_STEPS)
  let count = 0;
  while (session.canUndo()) {
    session.undo();
    count++;
  }
  assert.equal(count <= MAX_HISTORY_STEPS, true);
});

test('createPaintSession enforces the combined history memory budget', () => {
  const session = createPaintSession();
  const snapshotBytes = Math.floor(MAX_HISTORY_BYTES / 4) + 1;
  const snapshot = () => ({ data: new Uint8Array(snapshotBytes) });

  for (let i = 0; i < 20; i += 1) session.pushHistory(snapshot());

  let count = 0;
  while (session.canUndo()) {
    session.undo();
    count += 1;
  }
  assert.ok(count < 20, `expected the byte budget to evict entries, got ${count}`);
  assert.ok(count * snapshotBytes <= MAX_HISTORY_BYTES);
});
