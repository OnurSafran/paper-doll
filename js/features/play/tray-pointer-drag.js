/**
 * Pointer-driven drag for tray prop cards. Native drag and drop gives no visible piece on phones and
 * freezes page scrolling, so a held prop is driven by pointer events instead:
 *   - a floating copy of the card art follows the pointer (lifted above a finger so it is not hidden);
 *   - over the stage the real ghost + placement guides take over (tray-drag-preview.js);
 *   - near the top or bottom of the screen the page scrolls, so the stage can be reached from the tray;
 *   - touch needs a short press to pick up, so swiping the tray still scrolls it; a tap still adds the prop.
 * Everything is torn down by one function, from every exit (up, cancel, Escape, blur, hidden tab).
 */
import { isStageArtworkEvent } from './stage-pointer-controller.js';

const HOLD_MS = 220;
const SLOP = { touch: 9, mouse: 5 };
const LIFT_TOUCH = 64;
const EDGE = 80;
const MAX_SCROLL = 12;
const FLOATER = 76;

export function createTrayPointerDrag(context) {
  const { preview } = context;
  /** @type {null | { card: any, assetId: string, pointerId: number, touch: boolean, startX: number, startY: number, x: number, y: number, armed: boolean, timer: any, raf: any, stageEl: any, scroller: any, moved: boolean }} */
  let drag = null;
  let floater = null;
  let clickBlockedUntil = 0;

  function attach(card, assetId) {
    card.addEventListener('pointerdown', (event) => start(event, card, assetId));
    // A held card must never also start a native drag or open a context menu.
    card.addEventListener('dragstart', (event) => event.preventDefault());
    card.addEventListener('contextmenu', (event) => { if (drag?.card === card) event.preventDefault(); });
    // Once the page would scroll, the browser decides; before that a held piece keeps the page still.
    card.addEventListener('touchmove', (event) => { if (drag?.armed && event.cancelable) event.preventDefault(); }, { passive: false });
    // The click that follows a drag must not also add the prop.
    card.addEventListener('click', (event) => {
      if (Date.now() < clickBlockedUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
  }

  function start(event, card, assetId) {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    finish(false);
    const touch = event.pointerType !== 'mouse';
    drag = { card, assetId, pointerId: event.pointerId, touch, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, armed: false, timer: null, raf: null, stageEl: context.$('#play-stage'), scroller: null, moved: false };
    const win = globalThis.window;
    win.addEventListener('pointermove', onMove);
    win.addEventListener('pointerup', onUp);
    win.addEventListener('pointercancel', onCancel);
    win.addEventListener('keydown', onKey);
    win.addEventListener('blur', onCancel);
    globalThis.document.addEventListener('visibilitychange', onCancel);
    if (touch) drag.timer = setTimeout(arm, HOLD_MS);
  }

  function arm() {
    const d = drag;
    if (!d || d.armed) return;
    if (!preview.begin(d.assetId)) { finish(false); return; }
    d.armed = true;
    d.timer = null;
    d.card.classList.add('is-dragging');
    globalThis.document.body.classList.add('is-tray-dragging');
    try { d.card.setPointerCapture?.(d.pointerId); } catch { /* the window listeners still deliver */ }
    showFloater(d.card);
    if (d.touch) globalThis.navigator?.vibrate?.(8);
    d.raf = requestAnimationFrame(tick);
    update();
  }

  function onMove(event) {
    const d = drag;
    if (!d || event.pointerId !== d.pointerId) return;
    d.x = event.clientX;
    d.y = event.clientY;
    if (d.armed) { update(); return; }
    if (Math.hypot(d.x - d.startX, d.y - d.startY) <= (d.touch ? SLOP.touch : SLOP.mouse)) return;
    // Mouse: a drag. Touch: the finger is scrolling the tray, so the press is no longer a pick-up.
    if (d.touch) finish(false); else arm();
  }

  function onUp(event) {
    const d = drag;
    if (!d || event.pointerId !== d.pointerId) return;
    d.x = event.clientX;
    d.y = event.clientY;
    if (!d.armed) { finish(false); return; }
    const probe = probeAt(d);
    clickBlockedUntil = Date.now() + 400;
    if (isOverStage(d, probe)) preview.drop(probe); else preview.end();
    finish(false);
  }

  function onCancel() { finish(true); }
  function onKey(event) { if (event.key === 'Escape') finish(true); }

  /** The point a held piece is judged at: a finger's lifted point, or the cursor itself. */
  function probeAt(d) {
    const y = d.y - (d.touch ? LIFT_TOUCH : 0);
    return { clientX: d.x, clientY: y, target: globalThis.document.elementFromPoint?.(d.x, y) ?? null };
  }

  function isOverStage(d, probe) {
    return Boolean(d.stageEl && probe.target && isStageArtworkEvent(d.stageEl, probe));
  }

  function update() {
    const d = drag;
    if (!d?.armed) return;
    const probe = probeAt(d);
    const over = isOverStage(d, probe);
    d.stageEl?.classList.toggle('is-spawn-target', over);
    if (over) preview.over(probe); else preview.leave();
    syncFloater(probe, over);
  }

  /** The real piece replaces the floating copy once it is on the stage; the copy stays on screen at the edges. */
  function syncFloater(probe, over) {
    if (!floater) return;
    floater.hidden = over && preview.ghostShown();
    const x = Math.min(Math.max(probe.clientX, FLOATER / 2), globalThis.window.innerWidth - FLOATER / 2);
    const y = Math.max(probe.clientY, FLOATER / 2);
    floater.style.transform = `translate3d(${Math.round(x - FLOATER / 2)}px, ${Math.round(y - FLOATER / 2)}px, 0) rotate(-3deg) scale(1.05)`;
  }

  /** Per frame while held: scroll the page when the finger rests near a screen edge. */
  function tick() {
    const d = drag;
    if (!d?.armed) return;
    const h = globalThis.window.innerHeight;
    // The ghost is built asynchronously; this hands over from the floating copy as soon as it exists.
    const probe = probeAt(d);
    syncFloater(probe, isOverStage(d, probe));
    const dy = d.y < EDGE ? -(1 - Math.max(d.y, 0) / EDGE) * MAX_SCROLL : d.y > h - EDGE ? (1 - Math.max(h - d.y, 0) / EDGE) * MAX_SCROLL : 0;
    if (dy) {
      const scroller = d.scroller ??= findScroller(d.stageEl);
      const before = scroller.scrollTop;
      scroller.scrollTop += dy;
      // The stage moved under a still pointer, so the preview needs a fresh look.
      if (scroller.scrollTop !== before) update();
    }
    d.raf = requestAnimationFrame(tick);
  }

  function findScroller(from) {
    for (let node = from?.parentElement; node && node !== globalThis.document.body; node = node.parentElement) {
      const overflowY = globalThis.getComputedStyle(node).overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
    }
    return globalThis.document.scrollingElement ?? globalThis.document.documentElement;
  }

  function showFloater(card) {
    const doc = globalThis.document;
    if (!floater) {
      floater = doc.createElement('div');
      floater.className = 'tray-drag-floater';
      floater.setAttribute('aria-hidden', 'true');
      doc.body.append(floater);
    }
    const thumb = card.querySelector?.('.spawn-thumb');
    floater.replaceChildren(...(thumb ? [thumb.cloneNode(true)] : []));
    floater.hidden = false;
  }

  /** Single exit for every way a drag can end. `cancelled` only matters to callers reading intent. */
  function finish(cancelled) {
    const d = drag;
    drag = null;
    const win = globalThis.window;
    win?.removeEventListener('pointermove', onMove);
    win?.removeEventListener('pointerup', onUp);
    win?.removeEventListener('pointercancel', onCancel);
    win?.removeEventListener('keydown', onKey);
    win?.removeEventListener('blur', onCancel);
    globalThis.document?.removeEventListener('visibilitychange', onCancel);
    if (d) {
      clearTimeout(d.timer);
      if (d.raf) cancelAnimationFrame(d.raf);
      d.card.classList.remove('is-dragging');
      d.stageEl?.classList.remove('is-spawn-target');
      try { d.card.releasePointerCapture?.(d.pointerId); } catch { /* already released */ }
      if (d.armed && cancelled) clickBlockedUntil = Date.now() + 400;
    }
    globalThis.document?.body?.classList.remove('is-tray-dragging');
    floater?.remove();
    floater = null;
    preview.end();
  }

  return { attach, cancel: () => finish(true), get active() { return Boolean(drag?.armed); } };
}
