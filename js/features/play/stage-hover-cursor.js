/**
 * Stage cursor feedback that follows visible artwork.
 *
 * Entity buttons are rectangles, so a CSS cursor on them would show "grab" over
 * transparent corners where a press falls through. Instead the stage carries one
 * `data-cursor` attribute, resolved with the same hit test a press uses.
 *
 * Cost model: pointer moves only record the latest position; at most one hit
 * test runs per animation frame, only for mouse/pen input, never during a drag
 * or over stage UI, and the DOM is written only when the result changes.
 */

/**
 * @param {{
 *   stageEl: HTMLElement,
 *   resolve: (event: {clientX: number, clientY: number, target: any}) => (Element | null),
 *   isArtworkEvent: (event: any) => boolean,
 *   schedule?: (callback: () => void) => number,
 *   cancel?: (handle: number) => void
 * }} options
 */
export function createStageHoverCursor({
  stageEl,
  resolve,
  isArtworkEvent,
  schedule = (callback) => requestAnimationFrame(callback),
  cancel = (handle) => cancelAnimationFrame(handle)
}) {
  let pending = null;
  let frame = 0;
  let dragging = false;
  let current = null;
  /** Last pointer position, kept so the cursor can be re-evaluated after a drag. */
  let last = null;

  function apply(value) {
    if (value === current) return;
    current = value;
    if (value) stageEl.dataset.cursor = value;
    else delete stageEl.dataset.cursor;
  }

  function evaluate() {
    frame = 0;
    const event = pending;
    pending = null;
    if (!event || dragging) return;
    if (!isArtworkEvent(event)) { apply(null); return; }
    const element = resolve(event);
    // Pinned entities select but never move, so they keep the plain cursor.
    apply(!element || element.classList?.contains('is-pinned') ? null : 'grab');
  }

  function request(event) {
    pending = event;
    if (!frame) frame = schedule(evaluate);
  }

  return {
    /** Mouse and pen only: touch has no hover. */
    onMove(event) {
      if (event.pointerType === 'touch') return;
      last = { clientX: event.clientX, clientY: event.clientY, target: event.target, pointerType: event.pointerType };
      if (!dragging) request(last);
    },
    /** The stage keeps the grabbing cursor for the whole drag, since it owns pointer capture. */
    setDragging(value) {
      dragging = Boolean(value);
      if (dragging) {
        pending = null;
        if (frame) { cancel(frame); frame = 0; }
        apply('grabbing');
      } else {
        apply(null);
        if (last) request(last);
      }
    },
    /** The pointer left the stage, or the stage is being torn down. */
    clear() {
      pending = null;
      last = null;
      if (frame) { cancel(frame); frame = 0; }
      if (!dragging) apply(null);
    },
    get current() { return current; }
  };
}
