import { propCardboardMode } from '../../domain/cardboard.js';
import { placementShadow } from '../../domain/placement-shadows.js';
/** Stable scene entity DOM composition and patches. */
import { getEntityBounds } from '../../domain/scene-rules.js';
import { CHARACTER_DIMENSIONS, DEFAULT_EXPRESSION, DEFAULT_EXPRESSION_INTENSITY, bubbleStyleLabelKey, isCustomAssetId } from '../../domain/vocabulary.js';
import { evaluateCharacterPose } from '../../domain/motion-evaluator.js';
import { characterCanvasStyle, characterStandStyle, customFullArtId, getCharacterContact } from '../../domain/character-geometry.js';
import { makeAssetPlaceholder } from '../../core/svg-loader.js';
import { appendAsset } from '../designer/designer-view.js';
import { createBubbleSvg } from '../../core/bubble-svg.js';
import { assetName, t } from '../../core/i18n.js';

export function createSceneEntityView(context) {
  function updateShadow(element, entity) {
    const state = context.store.getState();
    const scene = state.currentScene;
    const shadow = placementShadow(scene, entity, context.getAsset, state.settings.shadowsEnabled === true);
    let node = element.querySelector('.placement-contact-shadow');
    if (!shadow) { node?.remove(); return; }
    if (!node) { node = document.createElement('span'); node.className = 'placement-contact-shadow'; node.setAttribute('aria-hidden', 'true'); element.prepend(node); }
    const b = getEntityBounds(entity, context.getAsset);
    node.style.width = `${shadow.width / b.width * 100}%`;
    node.style.height = `${shadow.height / b.height * 100}%`;
    // The positioner keeps the unflipped anchor; its visual flips around it.
    node.style.left = `${(b.anchorX + (shadow.x - entity.x) / b.width) * 100}%`;
    node.style.top = `${(b.anchorY + (shadow.y - entity.y) / b.height) * 100}%`;
    node.style.borderRadius = shadow.shape === 'rect' ? '0' : '50%';
    node.style.background = shadow.fill;
  }

  function positionerClassName(entity, isPrimarySelected, isMultiSelected) {
    return `scene-entity-positioner${isPrimarySelected ? ' is-selected' : ''}${isMultiSelected ? ' is-multi-selected' : ''}${entity.pinned ? ' is-pinned' : ''}${entity.kind === 'bubble' ? ' is-bubble-entity' : ''}${entity.kind === 'character' ? ' is-character-entity' : ''}`;
  }

  /** Geometry shared by create and patch; the envelope ratio is derived, never assumed. */
  function applyPositionerGeometry(element, entity) {
    const asset = context.getAsset(entity.sourceId);
    const bounds = getEntityBounds(entity, context.getAsset);
    element.style.setProperty('--x', String(entity.x));
    element.style.setProperty('--y', String(entity.y));
    element.style.zIndex = String(entity.order);
    element.style.setProperty('--entity-width', String(bounds.width));
    element.style.setProperty('--entity-height', String(bounds.height));
    element.style.setProperty('--anchor-x', String(bounds.anchorX ?? 0.5));
    element.style.setProperty('--anchor-y', String(bounds.anchorY ?? 1.0));
    element.style.setProperty('--char-width', String(CHARACTER_DIMENSIONS.BASE_WIDTH));
    element.style.setProperty('--char-height', String(CHARACTER_DIMENSIONS.BASE_HEIGHT));
    if (entity.kind === 'character') {
      const contact = { x: bounds.contactX, y: bounds.contactY };
      const geometry = { ...characterCanvasStyle(contact), ...characterStandStyle(entity.characterSnapshot, context.getAsset) };
      for (const [name, value] of Object.entries(geometry)) element.style.setProperty(name, value);
    }
    element.style.aspectRatio = entity.kind === 'prop'
      ? `${asset?.displayWidth ?? 200} / ${asset?.displayHeight ?? 200}`
      : `${bounds.width} / ${bounds.height}`;
  }

  async function createSceneEntity(entity, isPrimarySelected, isMultiSelected) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = positionerClassName(entity, isPrimarySelected, isMultiSelected);
    button.dataset.instanceId = entity.instanceId;
    const asset = context.getAsset(entity.sourceId);
    if (entity.kind === 'character') await context.hitTester?.measureCharacter?.(entity.characterSnapshot);
    applyPositionerGeometry(button, entity);

    // Pointer selection is resolved by the stage hit tester on pointerdown; this
    // handler only serves keyboard activation (Enter/Space report detail 0).
    button.addEventListener('click', (e) => {
      if (e.detail > 0) return;
      if (e.shiftKey) {
        context.store.dispatch({ type: 'ui/toggleEntitySelection', instanceId: entity.instanceId });
      } else {
        context.store.dispatch({ type: 'ui/selectEntity', instanceId: entity.instanceId });
      }
    });

    const visual = document.createElement('span');
    visual.className = 'scene-entity-visual';
    if (entity.kind === 'prop') visual.dataset.cardboard = propCardboardMode(asset);
    visual.style.setProperty('--flip', entity.flipped ? '-1' : '1');

    if (entity.kind === 'character') {
      const staticPose = evaluateCharacterPose(entity, 0, { playbackEnabled: false, getAsset: context.getAsset });
      const motion = document.createElement('span');
      motion.className = 'scene-entity-motion';
      motion.style.setProperty('--motion-tx', String(Math.round(staticPose.root.x * 10) / 10));
      motion.style.setProperty('--motion-ty', String(Math.round(staticPose.root.y * 10) / 10));
      motion.style.setProperty('--motion-rot', String(Math.round(staticPose.root.rotate * 10) / 10));
      motion.style.setProperty('--motion-scale-x', String(Math.round(staticPose.root.scaleX * 100) / 100));
      motion.style.setProperty('--motion-scale-y', String(Math.round(staticPose.root.scaleY * 100) / 100));
      motion.style.setProperty('--motion-head-tx', String(Math.round(staticPose.head.x * 10) / 10));
      motion.style.setProperty('--motion-head-ty', String(Math.round(staticPose.head.y * 10) / 10));
      motion.style.setProperty('--motion-head-rot', String(Math.round(staticPose.head.rotate * 10) / 10));
      motion.style.setProperty('--motion-head-scale-x', String(Math.round(staticPose.head.scaleX * 100) / 100));
      motion.style.setProperty('--motion-head-scale-y', String(Math.round(staticPose.head.scaleY * 100) / 100));

      if (staticPose.armLeft) {
        motion.style.setProperty('--motion-arm-left-tx', String(Math.round(staticPose.armLeft.x * 10) / 10));
        motion.style.setProperty('--motion-arm-left-ty', String(Math.round(staticPose.armLeft.y * 10) / 10));
        motion.style.setProperty('--motion-arm-left-rot', String(Math.round(staticPose.armLeft.rotate * 10) / 10));
        motion.style.setProperty('--motion-arm-left-scale-x', String(Math.round(staticPose.armLeft.scaleX * 100) / 100));
        motion.style.setProperty('--motion-arm-left-scale-y', String(Math.round(staticPose.armLeft.scaleY * 100) / 100));
      }
      if (staticPose.armRight) {
        motion.style.setProperty('--motion-arm-right-tx', String(Math.round(staticPose.armRight.x * 10) / 10));
        motion.style.setProperty('--motion-arm-right-ty', String(Math.round(staticPose.armRight.y * 10) / 10));
        motion.style.setProperty('--motion-arm-right-rot', String(Math.round(staticPose.armRight.rotate * 10) / 10));
        motion.style.setProperty('--motion-arm-right-scale-x', String(Math.round(staticPose.armRight.scaleX * 100) / 100));
        motion.style.setProperty('--motion-arm-right-scale-y', String(Math.round(staticPose.armRight.scaleY * 100) / 100));
      }
      if (staticPose.legLeft) {
        motion.style.setProperty('--motion-leg-left-tx', String(Math.round(staticPose.legLeft.x * 10) / 10));
        motion.style.setProperty('--motion-leg-left-ty', String(Math.round(staticPose.legLeft.y * 10) / 10));
        motion.style.setProperty('--motion-leg-left-rot', String(Math.round(staticPose.legLeft.rotate * 10) / 10));
        motion.style.setProperty('--motion-leg-left-scale-x', String(Math.round(staticPose.legLeft.scaleX * 100) / 100));
        motion.style.setProperty('--motion-leg-left-scale-y', String(Math.round(staticPose.legLeft.scaleY * 100) / 100));
      }
      if (staticPose.legRight) {
        motion.style.setProperty('--motion-leg-right-tx', String(Math.round(staticPose.legRight.x * 10) / 10));
        motion.style.setProperty('--motion-leg-right-ty', String(Math.round(staticPose.legRight.y * 10) / 10));
        motion.style.setProperty('--motion-leg-right-rot', String(Math.round(staticPose.legRight.rotate * 10) / 10));
        motion.style.setProperty('--motion-leg-right-scale-x', String(Math.round(staticPose.legRight.scaleX * 100) / 100));
        motion.style.setProperty('--motion-leg-right-scale-y', String(Math.round(staticPose.legRight.scaleY * 100) / 100));
      }

      const canvas = document.createElement('span');
      canvas.className = 'scene-character-canvas';
      await context.renderDollInto(canvas, entity.characterSnapshot, {
        expression: entity.expression || DEFAULT_EXPRESSION,
        expressionIntensity: entity.expressionIntensity ?? DEFAULT_EXPRESSION_INTENSITY,
        customArtRepo: context.customArtRepo,
        getAsset: context.getAsset,
        enforceFit: false
      });
      // Custom art with no qualifying pixel has no contact; show the unavailable-artwork placeholder.
      if (customFullArtId(entity.characterSnapshot) && getCharacterContact(entity.characterSnapshot, context.getAsset).source === 'unavailable') {
        const placeholder = makeAssetPlaceholder(assetName(context.getAsset(customFullArtId(entity.characterSnapshot)), t('play.savedDoll')));
        placeholder.classList.add('scene-character-placeholder');
        canvas.replaceChildren(placeholder);
      }
      motion.append(canvas);
      visual.append(motion);
      const preset = context.store.getState().presets.find((item) => item.presetId === entity.sourceId);
      button.setAttribute('aria-label', `${entity.pinned ? `${t('play.pinned')} ` : ''}${preset?.name ?? (entity.sourceId === 'demo_emma' ? 'Emma' : t('play.savedDoll'))}`);
    } else if (entity.kind === 'bubble') {
      const bubbleSvg = createBubbleSvg(entity);
      visual.append(bubbleSvg);
      button.setAttribute('aria-label', `${entity.pinned ? `${t('play.pinned')} ` : ''}${t(bubbleStyleLabelKey(entity.bubbleStyle))}: ${entity.text}`);
    } else {
      if (isCustomAssetId(entity.sourceId)) {
        const url = await context.customArtRepo?.getTrackedObjectUrl?.(entity.sourceId);
        if (url) {
          const img = document.createElement('img');
          img.src = url;
          img.className = 'scene-custom-prop-img';
          img.alt = assetName(asset, t('play.customPropBadge'));
          img.draggable = false;
          visual.append(img);
        } else {
          await appendAsset(visual, entity.sourceId, { customArtRepo: context.customArtRepo, getAsset: context.getAsset });
        }
      } else {
        let sharedSvg = null;
        try { sharedSvg = await context.propSymbols.create(entity.sourceId); } catch { /* use the regular placeholder path */ }
        if (sharedSvg) visual.append(sharedSvg);
        else await appendAsset(visual, entity.sourceId, { customArtRepo: context.customArtRepo, getAsset: context.getAsset });
      }
      button.setAttribute('aria-label', `${entity.pinned ? `${t('play.pinned')} ` : ''}${assetName(asset, t('play.sceneProp'))}`);
    }
    button.append(visual);
    updateShadow(button, entity);
    if (entity.pinned) {
      const badge = document.createElement('span');
      badge.className = 'pinned-badge';
      badge.textContent = '📌';
      badge.setAttribute('aria-hidden', 'true');
      button.append(badge);
    }
    button.dataset.renderKey = context.sceneEntityRenderKey(entity);
    // Masks are ready before the element is interactive, so transparent corners never select it.
    await context.hitTester?.prepare?.(entity, button);
    return button;
  }

  function patchSceneEntity(element, entity, isPrimarySelected, isMultiSelected) {
    element.className = positionerClassName(entity, isPrimarySelected, isMultiSelected);
    applyPositionerGeometry(element, entity);
    if (entity.kind === 'prop') {
      const visual = element.querySelector('.scene-entity-visual');
      if (visual) visual.dataset.cardboard = propCardboardMode(context.getAsset(entity.sourceId));
    }
    element.querySelector('.scene-entity-visual')?.style.setProperty('--flip', entity.flipped ? '-1' : '1');

    updateShadow(element, entity);
    const pinnedBadge = element.querySelector('.pinned-badge');
    if (entity.pinned && !pinnedBadge) {
      const badge = document.createElement('span');
      badge.className = 'pinned-badge';
      badge.textContent = '📌';
      badge.setAttribute('aria-hidden', 'true');
      element.append(badge);
    } else if (!entity.pinned) {
      pinnedBadge?.remove?.();
    }
    element.dataset.renderKey = context.sceneEntityRenderKey(entity);
  }

  return { createSceneEntity, patchSceneEntity };
}
