/** Stable scene entity DOM composition and patches. */
import { getEntityBounds } from '../../domain/scene-rules.js';
import { CHARACTER_DIMENSIONS, DEFAULT_EXPRESSION, DEFAULT_EXPRESSION_INTENSITY, bubbleStyleLabelKey, isCustomAssetId } from '../../domain/vocabulary.js';
import { evaluateCharacterPose } from '../../domain/motion-evaluator.js';
import { appendAsset } from '../designer/designer-view.js';
import { createBubbleSvg } from '../../core/bubble-svg.js';
import { assetName, t } from '../../core/i18n.js';

export function createSceneEntityView(context) {
  async function createSceneEntity(entity, isPrimarySelected, isMultiSelected) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `scene-entity-positioner${isPrimarySelected ? ' is-selected' : ''}${isMultiSelected ? ' is-multi-selected' : ''}${entity.pinned ? ' is-pinned' : ''}${entity.kind === 'bubble' ? ' is-bubble-entity' : ''}`;
    button.dataset.instanceId = entity.instanceId;
    button.style.setProperty('--x', String(entity.x));
    button.style.setProperty('--y', String(entity.y));
    button.style.zIndex = String(entity.order);
    const asset = context.getAsset(entity.sourceId);
    const bounds = getEntityBounds(entity, context.getAsset);
    button.style.setProperty('--entity-width', String(bounds.width));
    button.style.setProperty('--entity-height', String(bounds.height));
    button.style.setProperty('--anchor-x', String(bounds.anchorX ?? 0.5));
    button.style.setProperty('--anchor-y', String(bounds.anchorY ?? 1.0));
    button.style.setProperty('--char-width', String(CHARACTER_DIMENSIONS.BASE_WIDTH));
    button.style.setProperty('--char-height', String(CHARACTER_DIMENSIONS.BASE_HEIGHT));
    button.style.aspectRatio = entity.kind === 'character'
      ? '2 / 3'
      : (entity.kind === 'bubble' ? `${bounds.width} / ${bounds.height}` : `${asset?.displayWidth ?? 200} / ${asset?.displayHeight ?? 200}`);

    button.addEventListener('click', (e) => {
      if (e.shiftKey) {
        context.store.dispatch({ type: 'ui/toggleEntitySelection', instanceId: entity.instanceId });
      } else {
        context.store.dispatch({ type: 'ui/selectEntity', instanceId: entity.instanceId });
      }
    });

    const visual = document.createElement('span');
    visual.className = 'scene-entity-visual';
    if (entity.kind === 'prop' && ['prop_chair', 'prop_table'].includes(entity.sourceId)) {
      visual.dataset.paperProp = entity.sourceId;
    }
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
      motion.append(canvas);
      visual.append(motion);
      const preset = context.store.getState().presets.find((item) => item.presetId === entity.sourceId);
      button.setAttribute('aria-label', `${entity.pinned ? `${t('play.pinned')} ` : ''}${preset?.name ?? (entity.sourceId === 'demo_emma' ? 'Emma' : t('play.savedDoll'))}`);
    } else if (entity.kind === 'bubble') {
      const bubbleSvg = createBubbleSvg(entity);
      visual.append(bubbleSvg);
      button.setAttribute('aria-label', `${entity.pinned ? `${t('play.pinned')} ` : ''}${t(bubbleStyleLabelKey(entity.bubbleStyle))}: ${entity.text}`);
      button.addEventListener('dblclick', (event) => {
        event.stopPropagation();
        context.openEditBubbleDialog(entity);
      });
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
    if (entity.pinned) {
      const badge = document.createElement('span');
      badge.className = 'pinned-badge';
      badge.textContent = '📌';
      badge.setAttribute('aria-hidden', 'true');
      button.append(badge);
    }
    button.dataset.renderKey = context.sceneEntityRenderKey(entity);
    return button;
  }

  function patchSceneEntity(element, entity, isPrimarySelected, isMultiSelected) {
    const asset = context.getAsset(entity.sourceId);
    const bounds = getEntityBounds(entity, context.getAsset);
    element.className = `scene-entity-positioner${isPrimarySelected ? ' is-selected' : ''}${isMultiSelected ? ' is-multi-selected' : ''}${entity.pinned ? ' is-pinned' : ''}${entity.kind === 'bubble' ? ' is-bubble-entity' : ''}`;
    element.style.setProperty('--x', String(entity.x));
    element.style.setProperty('--y', String(entity.y));
    element.style.zIndex = String(entity.order);
    element.style.setProperty('--entity-width', String(bounds.width));
    element.style.setProperty('--entity-height', String(bounds.height));
    element.style.setProperty('--anchor-x', String(bounds.anchorX ?? 0.5));
    element.style.setProperty('--anchor-y', String(bounds.anchorY ?? 1.0));
    element.style.setProperty('--char-width', String(CHARACTER_DIMENSIONS.BASE_WIDTH));
    element.style.setProperty('--char-height', String(CHARACTER_DIMENSIONS.BASE_HEIGHT));
    element.style.aspectRatio = entity.kind === 'character'
      ? '2 / 3'
      : (entity.kind === 'bubble' ? `${bounds.width} / ${bounds.height}` : `${asset?.displayWidth ?? 200} / ${asset?.displayHeight ?? 200}`);
    element.querySelector('.scene-entity-visual')?.style.setProperty('--flip', entity.flipped ? '-1' : '1');

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
