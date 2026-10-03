/**
 * Drag feedback for placement. Target outlines are built once per drag (their
 * geometry is in logical stage coordinates and nothing else moves while a piece
 * is dragged); each pointer move only toggles which target is active and moves a
 * fixed-pixel contact marker and label chip that sit above the dragged artwork.
 */
import { getPlacementGuides, sameTarget } from '../../domain/scene-placement.js';
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from '../../domain/vocabulary.js';
import { escapeCss } from '../../core/css-escape.js';
import { targetChipLabel, targetLabel } from './placement-labels.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CHIP_MARGIN = 8;
const CHIP_GAP = 20;
const GLYPHS = {
  floor: '<ellipse cx="12" cy="16" rx="9" ry="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4v7M9 8l3 3 3-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  wall: '<rect x="4" y="5" width="16" height="14" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="4" r="1.6" fill="currentColor"/>',
  surface: '<path d="M4 9h16M7 9v10M17 9v10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 3v3M10 4.5l2 2 2-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
};

export function createPlacementGuide(context) {
  /** @type {null | { entityId: string, virtualBase: any, world: Element, stageEl: any, svg: any, hud: any, marker: any, ring: any, chip: any, chipText: any, chipW: number, chipH: number, announceReady: boolean, targets: any[], activeIndex: number, sceneEntities: any[], backgroundId: string, stageWidth: number, placementMode: string }} */
  let session = null;
  /** The "Held by …" chip shown instead of targets while a tray prop hovers over a doll. */
  let note = null;

  function motionAllowed() {
    const mode = context.store.getState().settings.reducedMotion || 'system';
    if (mode === 'reduce') return false;
    if (mode === 'full') return true;
    return !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  }

  function announce(text) {
    const region = context.$('#sr-announcements');
    if (!region || !text) return;
    region.textContent = '';
    globalThis.setTimeout(() => { region.textContent = text; }, 50);
  }

  function buildHud() {
    const hud = document.createElement('div');
    hud.className = 'placement-drop-hud';
    hud.setAttribute('aria-hidden', 'true');
    const marker = document.createElement('div');
    marker.className = 'placement-contact-marker';
    const ring = document.createElement('span');
    ring.className = 'placement-contact-ring';
    marker.append(ring);
    const chip = document.createElement('div');
    chip.className = 'placement-guide-chip';
    chip.innerHTML = Object.entries(GLYPHS).map(([kind, body]) => `<svg class="placement-guide-glyph" data-glyph="${kind}" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${body}</svg>`).join('');
    const chipText = document.createElement('span');
    chipText.className = 'placement-guide-chip-text';
    chip.append(chipText);
    marker.hidden = true;
    chip.hidden = true;
    hud.append(marker, chip);
    return { hud, marker, ring, chip, chipText };
  }

  /** Geometry for the current drag. The only place guide geometry is computed. */
  function build(scene, entity) {
    const targets = getPlacementGuides(scene, entity, context.getAsset);
    for (const { polygon } of session.targets) polygon.remove();
    session.targets = targets.map((target) => {
      const polygon = document.createElementNS(SVG_NS, 'polygon');
      polygon.setAttribute('points', target.polygon.map(p => p.join(',')).join(' '));
      polygon.setAttribute('data-kind', target.kind);
      polygon.setAttribute('data-active', 'false');
      session.svg.append(polygon);
      return { target, polygon };
    });
    session.activeIndex = -1;
    session.sceneEntities = scene.entities;
    session.backgroundId = scene.backgroundId;
    session.stageWidth = scene.stageWidth;
    session.placementMode = scene.placementMode;
    session.svg.setAttribute('viewBox', `0 0 ${scene.stageWidth || VIEWPORT_WIDTH} ${VIEWPORT_HEIGHT}`);
    return targets.length;
  }

  /** Guide inputs are the background, stage, mode and entity objects; camera moves and previews leave them untouched. */
  function isStale(scene) {
    const s = session;
    if (scene.backgroundId !== s.backgroundId || scene.stageWidth !== s.stageWidth || scene.placementMode !== s.placementMode || scene.entities.length !== s.sceneEntities.length) return true;
    for (let i = 0; i < scene.entities.length; i++) if (scene.entities[i] !== s.sceneEntities[i]) return true;
    return false;
  }

  /** @returns {number} how many targets are available; 0 draws nothing. */
  function start(scene, entity, stageEl, { virtual = false } = {}) {
    clear();
    const world = context.$('#scene-world');
    if (!world || !entity) return 0;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'placement-drop-guide');
    svg.setAttribute('aria-hidden', 'true');
    const motion = context.store.getState().settings.reducedMotion || 'system';
    svg.setAttribute('data-motion', motion);
    const parts = buildHud();
    session = { entityId: entity.instanceId, virtualBase: virtual ? entity : null, world, stageEl, svg, ...parts, chipW: 0, chipH: 0, announceReady: false, targets: [], activeIndex: -1, sceneEntities: scene.entities, backgroundId: scene.backgroundId, stageWidth: scene.stageWidth, placementMode: scene.placementMode };
    session.hud.setAttribute('data-motion', motion);
    if (!build(scene, entity)) { session = null; delete stageEl.dataset.placementPreview; return 0; }
    world.append(svg, session.hud);
    // A plain body attribute: the toolbar lives outside the stage, and `:has()` would re-match on every style write.
    if (document.body) document.body.dataset.placementDrag = '';
    return session.targets.length;
  }

  function setActive(index, announceChange) {
    const s = session;
    if (s.activeIndex >= 0) s.targets[s.activeIndex]?.polygon.setAttribute('data-active', 'false');
    s.activeIndex = index;
    const active = s.targets[index];
    if (!active) {
      s.marker.hidden = true;
      s.chip.hidden = true;
      s.stageEl.dataset.placementPreview = 'available';
      return;
    }
    active.polygon.setAttribute('data-active', 'true');
    const { target } = active;
    s.stageEl.dataset.placementPreview = target.kind;
    s.hud.dataset.kind = target.kind;
    s.chipText.textContent = targetChipLabel(target);
    s.marker.hidden = false;
    s.chip.hidden = false;
    // Measured only when the text changes, never per move.
    s.chipW = s.chip.offsetWidth || 0;
    s.chipH = s.chip.offsetHeight || 0;
    if (announceChange) {
      announce(targetLabel(target, host(target), context.getAsset));
      if (motionAllowed()) s.ring.animate?.([{ scale: 1 }, { scale: 1.25 }, { scale: 1 }], { duration: 200, easing: 'ease-out' });
    }
  }

  function host(target) {
    return target.hostId ? session.sceneEntities.find(e => e.instanceId === target.hostId) : null;
  }

  /**
   * Per pointer move. `scene` is the committed scene (guide inputs); `entity` is the
   * preview entity at its snapped position. Constant work: no geometry, no node creation.
   */
  function update(scene, entity, view) {
    if (!session || !entity) return;
    if (isStale(scene)) {
      const base = session.virtualBase ?? scene.entities.find(e => e.instanceId === session.entityId);
      if (!base || !build(scene, base)) { clear(); return; }
    }
    let index = -1;
    for (let i = 0; i < session.targets.length; i++) if (sameTarget(entity, session.targets[i].target)) { index = i; break; }
    if (index !== session.activeIndex) setActive(index, session.announceReady);
    session.announceReady = true;
    if (session.activeIndex < 0) return;
    position(entity, view);
  }

  /** Keeps a chip inside the visible camera window with a safe margin, below the point or flipped above when low. */
  function placeChip(chip, w, h, x, y, view) {
    const kx = view.stageRect.width / VIEWPORT_WIDTH;
    const left = (Number(view.cameraX) || 0) * kx + CHIP_MARGIN;
    const right = (Number(view.cameraX) || 0) * kx + view.stageRect.width - CHIP_MARGIN;
    const maxX = right - w;
    const cx = maxX < left ? (left + right - w) / 2 : Math.min(Math.max(x - w / 2, left), maxX);
    const maxY = view.stageRect.height - CHIP_MARGIN - h;
    let cy = y + CHIP_GAP;
    if (cy > maxY) cy = y - CHIP_GAP - h;
    cy = Math.min(Math.max(cy, CHIP_MARGIN), Math.max(CHIP_MARGIN, maxY));
    chip.style.transform = `translate(${cx}px, ${cy}px)`;
  }

  function position(entity, view) {
    const s = session;
    const x = entity.x * (view.stageRect.width / VIEWPORT_WIDTH), y = entity.y * (view.stageRect.height / VIEWPORT_HEIGHT);
    s.marker.style.transform = `translate(${x}px, ${y}px)`;
    placeChip(s.chip, s.chipW, s.chipH, x, y, view);
  }

  /** A text-only chip at a stage point, for a hover that has no placement targets (a tray prop over a doll). */
  function showNote(stageEl, text, point, view) {
    if (!note) {
      const world = context.$('#scene-world');
      if (!world) return;
      const parts = buildHud();
      parts.hud.setAttribute('data-motion', context.store.getState().settings.reducedMotion || 'system');
      parts.hud.dataset.kind = 'held';
      world.append(parts.hud);
      note = { ...parts, text: '', w: 0, h: 0 };
      if (document.body) document.body.dataset.placementDrag = '';
    }
    if (note.text !== text) {
      note.text = text;
      note.chipText.textContent = text;
      note.chip.hidden = false;
      note.w = note.chip.offsetWidth || 0;
      note.h = note.chip.offsetHeight || 0;
      announce(text);
    }
    placeChip(note.chip, note.w, note.h, point.x * (view.stageRect.width / VIEWPORT_WIDTH), point.y * (view.stageRect.height / VIEWPORT_HEIGHT), view);
  }

  function clearNote() {
    if (!note) return;
    note.hud.remove();
    note = null;
    if (!session && document.body) delete document.body.dataset.placementDrag;
  }

  /** Pickup: show the item's current support as active, positioned where it rests. */
  function show(scene, entity, view) {
    if (!session) return;
    session.announceReady = false;
    update(scene, entity, view);
  }

  /** A short squash anchored at the piece's contact point, so a drop reads as landing. Transform-only. */
  function settle(stageEl, instanceId) {
    if (!motionAllowed()) return;
    const visual = stageEl.querySelector(`.scene-entity-positioner[data-instance-id="${escapeCss(instanceId)}"] > .scene-entity-visual`);
    visual?.animate?.([{ scale: '1 1' }, { scale: '1.05 0.93', offset: 0.35 }, { scale: '1 1' }], { duration: 180, easing: 'ease-out' });
  }

  function clear() {
    clearNote();
    if (!session) return;
    session.ring.getAnimations?.().forEach(a => a.cancel());
    session.svg.remove();
    session.hud.remove();
    delete session.stageEl.dataset.placementPreview;
    if (document.body) delete document.body.dataset.placementDrag;
    session = null;
  }

  return { start, show, update, showNote, clearNote, settle, clear, get active() { return Boolean(session) || Boolean(note); } };
}
