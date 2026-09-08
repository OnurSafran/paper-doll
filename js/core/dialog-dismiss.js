/**
 * Enables light-dismiss (close when clicking outside on the backdrop)
 * for native <dialog> elements.
 *
 * Checks boundary coordinates to distinguish backdrop clicks from
 * internal content/padding/scrollbar clicks, and tracks pointerdown
 * to prevent accidental closes during text selection or dragging.
 */
export function enableDialogLightDismiss(dialog) {
  if (!dialog || dialog.dataset.lightDismissBound) return;
  dialog.dataset.lightDismissBound = 'true';

  let pointerDownOnBackdrop = false;
  let pointerDownFired = false;

  dialog.addEventListener('pointerdown', (event) => {
    pointerDownFired = true;
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      pointerDownOnBackdrop = (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      );
    } else {
      pointerDownOnBackdrop = false;
    }
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog && dialog.open) {
      const rect = dialog.getBoundingClientRect();
      const isOutside = (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      );
      const validBackdropClick = pointerDownFired ? pointerDownOnBackdrop : true;
      if (isOutside && validBackdropClick) {
        dialog.close();
      }
    }
    pointerDownFired = false;
    pointerDownOnBackdrop = false;
  });
}

/**
 * Enables context-aware focus restoration for native <dialog> elements.
 * Records document.activeElement when the dialog opens, and restores
 * focus to that trigger element upon dialog close.
 */
export function enableDialogFocusRestoration(dialog, fallbackSelector = null) {
  if (!dialog || dialog.dataset.focusRestorationBound) return;
  dialog.dataset.focusRestorationBound = 'true';

  let triggerElement = null;

  if (typeof dialog.showModal === 'function') {
    const originalShowModal = dialog.showModal;
    dialog.showModal = function (...args) {
      if (!this.open && typeof document !== 'undefined' && document.activeElement) {
        triggerElement = document.activeElement;
      }
      return originalShowModal.apply(this, args);
    };
  }

  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    if (triggerElement && typeof triggerElement.focus === 'function' && (typeof document === 'undefined' || document.contains?.(triggerElement))) {
      triggerElement.focus();
    } else if (fallbackSelector && typeof document !== 'undefined') {
      document.querySelector(fallbackSelector)?.focus();
    }
    triggerElement = null;
  });
}
