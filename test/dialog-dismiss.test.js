import test from 'node:test';
import assert from 'node:assert/strict';
import { enableDialogFocusRestoration, enableDialogLightDismiss } from '../js/core/dialog-dismiss.js';

test('focus restoration preserves the opener on repeated opens and uses a connected fallback', (t) => {
  const original = globalThis.document;
  t.after(() => { globalThis.document = original; });
  const focus = [];
  const opener = { focus: () => focus.push('opener') };
  const inside = { focus: () => focus.push('inside') };
  const fallback = { focus: () => focus.push('fallback') };
  globalThis.document = { activeElement: opener, contains: () => true, querySelector: () => fallback };
  const listeners = {};
  const dialog = { dataset: {}, open: false, addEventListener: (name, fn) => { listeners[name] = fn; }, showModal() { this.open = true; } };
  enableDialogFocusRestoration(dialog, '#fallback');
  dialog.showModal();
  document.activeElement = inside;
  dialog.showModal();
  dialog.open = false;
  listeners.close();
  assert.deepEqual(focus, ['opener']);
  document.activeElement = opener;
  dialog.showModal();
  document.contains = () => false;
  dialog.open = false;
  listeners.close();
  assert.deepEqual(focus, ['opener', 'fallback']);
});

test('enableDialogLightDismiss handles light-dismiss backdrop clicks and protects internal interactions', () => {
  let closed = false;
  const listeners = {};

  const mockDialog = {
    open: true,
    dataset: {},
    addEventListener(event, fn) {
      listeners[event] = fn;
    },
    getBoundingClientRect() {
      return {
        left: 100,
        right: 500,
        top: 50,
        bottom: 450,
        width: 400,
        height: 400
      };
    },
    close() {
      closed = true;
      this.open = false;
    }
  };

  enableDialogLightDismiss(mockDialog);

  assert.equal(mockDialog.dataset.lightDismissBound, 'true');
  assert.ok(typeof listeners.pointerdown === 'function');
  assert.ok(typeof listeners.click === 'function');

  // Case 1: Click inside dialog
  closed = false;
  mockDialog.open = true;
  listeners.pointerdown({
    target: mockDialog,
    clientX: 250,
    clientY: 200
  });
  listeners.click({
    target: mockDialog,
    clientX: 250,
    clientY: 200
  });
  assert.equal(closed, false, 'Click inside dialog should NOT close it');

  // Case 2: Drag from inside to outside
  closed = false;
  mockDialog.open = true;
  listeners.pointerdown({
    target: {}, // Started on child element inside
    clientX: 250,
    clientY: 200
  });
  listeners.click({
    target: mockDialog,
    clientX: 20, // Released outside
    clientY: 20
  });
  assert.equal(closed, false, 'Drag released outside should NOT close dialog');

  // Case 3: Click outside on backdrop (pointerdown outside + click outside)
  closed = false;
  mockDialog.open = true;
  listeners.pointerdown({
    target: mockDialog,
    clientX: 20,
    clientY: 20
  });
  listeners.click({
    target: mockDialog,
    clientX: 20,
    clientY: 20
  });
  assert.equal(closed, true, 'Click on backdrop outside bounds MUST close dialog');

  // Case 4: Programmatic / synthetic click outside without pointerdown
  closed = false;
  mockDialog.open = true;
  listeners.click({
    target: mockDialog,
    clientX: 600, // right of rect.right (500)
    clientY: 200
  });
  assert.equal(closed, true, 'Synthetic click outside bounds MUST close dialog');
});

test('enableDialogFocusRestoration records active element on open and restores it on close', (t) => {
  const original = globalThis.document;
  t.after(() => { globalThis.document = original; });
  let focused = false;
  const mockTrigger = {
    focus() {
      focused = true;
    }
  };

  globalThis.document = {
    activeElement: mockTrigger,
    contains: (el) => el === mockTrigger
  };

  const listeners = {};
  const mockDialog = {
    dataset: {},
    addEventListener(event, fn) {
      listeners[event] = fn;
    },
    showModal() {
      // triggers patched showModal
    }
  };

    enableDialogFocusRestoration(mockDialog);
    assert.equal(mockDialog.dataset.focusRestorationBound, 'true');

    mockDialog.showModal();
    listeners.close();
    assert.equal(focused, true, 'Active trigger element must regain focus on dialog close');
});
