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
