import test from 'node:test';
import assert from 'node:assert/strict';
import { PointerController } from '../js/core/pointer-controller.js';

function harness() {
  const listeners = new Map();
  const root = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); }
  };
  const subject = {
    captured: false,
    closest: () => subject,
    setPointerCapture() { subject.captured = true; },
    hasPointerCapture() { return subject.captured; },
    releasePointerCapture() { subject.captured = false; }
  };
  return { root, subject, listeners };
}

test('non-primary pointer input does not start a session', () => {
  const { root, subject, listeners } = harness();
  const controller = new PointerController(root, { selector: '.entity', getId: () => 'item-1' });
  listeners.get('pointerdown')({ target: subject, pointerId: 1, pointerType: 'mouse', button: 2, isPrimary: true, clientX: 0, clientY: 0 });
  assert.equal(controller.session, null);
  controller.destroy();
});

test('pointer down on empty background invokes onDeselect', () => {
  const { root, listeners } = harness();
  const emptyTarget = { closest: () => null };
  let deselected = false;
  const controller = new PointerController(root, {
    selector: '.entity',
    getId: () => 'item-1',
    onDeselect: () => { deselected = true; }
  });
  listeners.get('pointerdown')({ target: emptyTarget, pointerId: 1, pointerType: 'mouse', button: 0, isPrimary: true, clientX: 50, clientY: 50 });
  assert.equal(deselected, true);
  controller.destroy();
});

test('cancel clears an active drag and releases pointer capture', () => {
  const previousRequest = globalThis.requestAnimationFrame;
  const previousCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = () => 7;
  let cancelledFrame = null;
  globalThis.cancelAnimationFrame = (frame) => { cancelledFrame = frame; };
  try {
    const { root, subject, listeners } = harness();
    const cancelled = [];
    const controller = new PointerController(root, {
      selector: '.entity', getId: () => 'item-1', onCancel: (id) => cancelled.push(id)
    });
    listeners.get('pointerdown')({ target: subject, pointerId: 3, pointerType: 'mouse', button: 0, isPrimary: true, clientX: 10, clientY: 10 });
    listeners.get('pointermove')({ pointerId: 3, clientX: 30, clientY: 10, preventDefault() {} });
    assert.equal(subject.captured, true);
    controller.cancel();
    assert.equal(controller.session, null);
    assert.equal(subject.captured, false);
    assert.equal(cancelledFrame, 7);
    assert.deepEqual(cancelled, ['item-1']);
    controller.destroy();
  } finally {
    globalThis.requestAnimationFrame = previousRequest;
    globalThis.cancelAnimationFrame = previousCancel;
  }
});

test('pointer release flushes the final preview before commit', () => {
  const previousRequest = globalThis.requestAnimationFrame;
  const previousCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = () => 9;
  globalThis.cancelAnimationFrame = () => {};
  try {
    const { root, subject, listeners } = harness();
    const previews = [];
    const commits = [];
    const controller = new PointerController(root, {
      selector: '.entity',
      getId: () => 'item-1',
      onPreview: (id, _subject, event) => previews.push([id, event.clientX]),
      onCommit: (id, _subject, event) => commits.push([id, event.clientX])
    });
    listeners.get('pointerdown')({ target: subject, pointerId: 4, pointerType: 'mouse', button: 0, isPrimary: true, clientX: 10, clientY: 10 });
    listeners.get('pointermove')({ pointerId: 4, clientX: 30, clientY: 10, preventDefault() {} });
    listeners.get('pointerup')({ pointerId: 4, clientX: 42, clientY: 10, type: 'pointerup' });
    assert.deepEqual(previews, [['item-1', 42]]);
    assert.deepEqual(commits, [['item-1', 42]]);
    controller.destroy();
  } finally {
    globalThis.requestAnimationFrame = previousRequest;
    globalThis.cancelAnimationFrame = previousCancel;
  }
});
