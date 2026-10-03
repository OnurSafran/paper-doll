/**
 * Preview for a prop dragged out of the tray. The piece is not in the scene yet, so it is previewed as
 * a virtual entity against the committed scene: the real artwork follows the snapped position and the
 * same placement guides, marker and chip as a stage drag are shown. Nothing is dispatched, persisted or
 * added to history until the drop, which commits exactly what was previewed.
 */
import { addEntity } from '../../domain/scene-rules.js';
import { placeEntity } from '../../domain/scene-placement.js';
import { LIMITS, VIEWPORT_WIDTH } from '../../domain/vocabulary.js';
import { renderedCameraX, stageContentRect } from '../../core/coordinate-space.js';
import { t } from '../../core/i18n.js';
import { createPlacementGuide } from './placement-guide.js';

const HELD_ID = '__held__';
let blankDragImage = null;
/** A 1×1 transparent image: the real artwork replaces the browser's drag image of the tray card. */
function getBlankDragImage() {
  if (!blankDragImage && typeof Image === 'function') blankDragImage = Object.assign(new Image(), { src: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' });
  return blankDragImage;
}

export function createTrayDragPreview(context) {
  const guide = createPlacementGuide(context);
  /** @type {null | { assetId: string, ghost: any, ghostPending: boolean, held: any, withHeld: any, committedEntities: any, previewTarget: any, last: any, guideOn: boolean, started: boolean, holdingDoll: boolean }} */
  let session = null;

  /** Starts a preview for a prop card; false leaves the browser's own drag image in place. */
  function begin(assetId, dataTransfer) {
    end();
    const asset = context.getAsset(assetId);
    if (!asset || asset.kind !== 'prop' || context.store.getState().currentScene.entities.length >= LIMITS.MAX_ENTITIES) return false;
    session = { assetId, ghost: null, ghostPending: false, held: null, withHeld: null, committedEntities: null, previewTarget: null, last: null, guideOn: false, started: false, holdingDoll: false };
    const blank = getBlankDragImage();
    if (blank) dataTransfer?.setDragImage?.(blank, 0, 0);
    return true;
  }

  /** The committed scene plus the held piece, rebuilt only when the committed entities change. */
  function sceneWithHeld(scene, point) {
    const s = session;
    if (s.withHeld && s.committedEntities === scene.entities) return s.withHeld;
    s.withHeld = addEntity(scene, { instanceId: HELD_ID, kind: 'prop', sourceId: s.assetId, x: point.x, y: point.y }, context.getAsset);
    s.committedEntities = scene.entities;
    s.held = s.withHeld.entities.find(e => e.instanceId === HELD_ID) || null;
    return s.withHeld;
  }

  async function ensureGhost(entity) {
    const s = session;
    if (s.ghost || s.ghostPending) return;
    s.ghostPending = true;
    let element;
    try { element = await context.createSceneEntity(entity, false, false); } catch { element = null; }
    if (session !== s) return;
    if (!element) { s.ghostPending = false; return; }
    // A picture only: never focusable, never hit-tested, never mistaken for a scene piece.
    element.classList.add('is-held-ghost', 'is-dragging');
    element.tabIndex = -1;
    element.setAttribute('aria-hidden', 'true');
    delete element.dataset.instanceId;
    s.ghost = element;
    context.$('#scene-world')?.append(element);
    positionGhost();
  }

  function positionGhost() {
    const s = session;
    const at = s?.last;
    if (!s?.ghost || !at) return;
    s.ghost.hidden = false;
    s.ghost.style.setProperty('--x', String(at.x));
    s.ghost.style.setProperty('--y', String(at.y));
  }

  /** Stage dragover. Constant work per event once the guide session is built. */
  function over(event) {
    const s = session;
    if (!s) return;
    const stageEl = context.$('#play-stage');
    if (!stageEl) return;
    const scene = context.store.getState().currentScene;
    const stageRect = stageContentRect(stageEl);
    const view = { stageRect, cameraX: renderedCameraX(stageEl, scene.cameraX, stageRect) };
    const { point, element } = context.stagePointAt(event);
    const withHeld = sceneWithHeld(scene, point);
    if (!s.held) return;
    void ensureGhost(s.held);

    // Over a doll the prop is held, not placed: no targets, just the note and the ghost at the pointer.
    const doll = element ? scene.entities.find(e => e.instanceId === element.dataset?.instanceId && e.kind === 'character') : null;
    if (doll) {
      if (!s.holdingDoll) { guide.clear(); s.guideOn = false; s.holdingDoll = true; }
      s.last = { x: point.x, y: point.y, target: null, committed: false };
      guide.showNote(stageEl, t('placement.guideHeldBy', { name: dollName(doll) }), point, view);
      positionGhost();
      return;
    }
    if (s.holdingDoll) { guide.clearNote(); s.holdingDoll = false; s.guideOn = false; s.started = false; }

    const next = placeEntity(withHeld, HELD_ID, point, context.getAsset, {
      transfer: true, currentTarget: s.previewTarget,
      snapDistance: 16 * VIEWPORT_WIDTH / stageRect.width, releaseDistance: 24 * VIEWPORT_WIDTH / stageRect.width
    });
    // `next === withHeld` just means the piece already rests where the pointer resolves; only an
    // explicit "no valid target" marks a spot that cannot take it.
    const entity = next.entities.find(e => e.instanceId === HELD_ID);
    if (!entity || (entity.placement?.kind === 'free' && entity.placement.reason === 'no-valid-target')) {
      // Nothing here can take it: the piece follows the pointer unsnapped, and a drop lands it free right there.
      s.last = { x: point.x, y: point.y, target: null, committed: false };
      s.previewTarget = null;
      positionGhost();
      return;
    }
    s.previewTarget = entity.placement?.kind === 'surface' ? { kind: 'surface', hostId: entity.attachedTo, surfaceId: entity.placement.surfaceId }
      : entity.placement?.regionId ? { kind: entity.placement.kind, regionId: entity.placement.regionId } : null;
    s.last = { x: entity.x, y: entity.y, target: s.previewTarget, committed: true };
    positionGhost();

    if (!s.started) {
      s.started = true;
      s.guideOn = guide.start(scene, s.held, stageEl, { virtual: true }) > 0;
      if (s.guideOn) guide.show(scene, entity, view);
    } else if (s.guideOn) guide.update(scene, entity, view);
  }

  /** The pointer left the stage: hide everything but keep the held piece for a re-entry. */
  function leave() {
    const s = session;
    if (!s) return;
    guide.clear();
    if (s.ghost) s.ghost.hidden = true;
    s.guideOn = false;
    s.started = false;
    s.holdingDoll = false;
    s.last = null;
    s.previewTarget = null;
  }

  /** What a drop should commit, or null when the pointer is over nothing placeable. Read before `end`. */
  function finish() {
    const at = session?.last;
    return at?.committed ? { x: at.x, y: at.y, placementTarget: at.target } : null;
  }

  /** Commits a drop at a client point: the previewed position and target, or the raw point over a doll. */
  function drop(event) {
    const s = session;
    if (!s) return;
    const previewed = finish();
    end();
    const { point, element } = context.stagePointAt(event);
    context.store.dispatch({
      type: 'scene/spawnProp', assetId: s.assetId, targetEntityId: element?.dataset?.instanceId, transfer: true,
      ...(previewed ? { x: previewed.x, y: previewed.y, placementTarget: previewed.placementTarget } : point)
    });
  }

  /** Fail-safe: also sweeps ghosts a lost session could have left in the world. */
  function end() {
    session?.ghost?.remove();
    for (const stray of context.$('#scene-world')?.querySelectorAll?.('.is-held-ghost') ?? []) stray.remove();
    guide.clear();
    session = null;
  }

  function ghostShown() {
    return Boolean(session?.ghost && !session.ghost.hidden && session.last);
  }

  function dollName(doll) {
    const preset = context.store.getState().presets.find(p => p.presetId === doll.sourceId);
    return preset?.name ?? (doll.sourceId === 'demo_emma' ? 'Emma' : t('play.savedDoll'));
  }

  return { begin, over, leave, finish, drop, end, ghostShown, get active() { return Boolean(session); } };
}
