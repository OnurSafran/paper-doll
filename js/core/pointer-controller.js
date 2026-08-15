export class PointerController {
  constructor(root, options) {
    this.root = root;
    this.options = options;
    this.session = null;
    this.frame = 0;
    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onEnd = this.onEnd.bind(this);
    root.addEventListener('pointerdown', this.onDown);
    root.addEventListener('pointermove', this.onMove);
    root.addEventListener('pointerup', this.onEnd);
    root.addEventListener('pointercancel', this.onEnd);
    root.addEventListener('lostpointercapture', this.onEnd);
  }

  onDown(event) {
    if (event.isPrimary === false || event.button !== 0) return;
    const subject = event.target.closest(this.options.selector);
    if (!subject) {
      if (!event.target.closest?.('.context-ring') && !event.target.closest?.('.scene-picker-group')) {
        this.options.onDeselect?.(event);
      }
      return;
    }
    if (this.session) return;
    const id = this.options.getId(subject);
    if (!id) return;
    this.options.onSelect?.(id, subject, event);
    this.session = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      subject,
      id,
      startX: event.clientX,
      startY: event.clientY,
      latestEvent: event,
      dragging: false,
      cancelled: false
    };
  }

  onMove(event) {
    const session = this.session;
    if (!session || event.pointerId !== session.pointerId) return;
    const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
    const threshold = session.pointerType === 'touch' ? 8 : 4;

    if (!session.dragging && distance >= threshold) {
      session.dragging = true;
      session.subject.setPointerCapture?.(event.pointerId);
      this.options.onStart?.(session.id, session.subject, event);
    }
    if (!session.dragging) return;

    event.preventDefault();
    session.latestEvent = event;
    if (!this.frame) {
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        if (this.session?.dragging) this.options.onPreview?.(session.id, session.subject, session.latestEvent);
      });
    }
  }

  onEnd(event) {
    const session = this.session;
    if (!session || event.pointerId !== session.pointerId) return;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    const cancelled = event.type !== 'pointerup';
    // A release can arrive before the queued preview frame runs. Flush the
    // final pointer position so consumers can commit the actual drop point.
    if (session.dragging && !cancelled) this.options.onPreview?.(session.id, session.subject, event);
    this.session = null;
    if (session.dragging) {
      if (cancelled) this.options.onCancel?.(session.id, session.subject, event);
      else this.options.onCommit?.(session.id, session.subject, event);
    }
    if (session.subject.hasPointerCapture?.(event.pointerId)) {
      session.subject.releasePointerCapture(event.pointerId);
    }
  }

  cancel() {
    const session = this.session;
    if (!session) return;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.session = null;
    if (session.dragging) this.options.onCancel?.(session.id, session.subject);
    if (session.subject.hasPointerCapture?.(session.pointerId)) {
      session.subject.releasePointerCapture(session.pointerId);
    }
  }

  destroy() {
    this.cancel();
    this.root.removeEventListener('pointerdown', this.onDown);
    this.root.removeEventListener('pointermove', this.onMove);
    this.root.removeEventListener('pointerup', this.onEnd);
    this.root.removeEventListener('pointercancel', this.onEnd);
    this.root.removeEventListener('lostpointercapture', this.onEnd);
  }
}
