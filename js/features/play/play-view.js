import { orderedSceneEntities } from '../../domain/scene-placement.js';
import { createPropSymbolRegistry } from '../../core/svg-symbols.js';
import { createSceneEntityView } from './scene-entity-view.js';
import { createSelectionHudController } from './selection-hud-controller.js';
import { createSelectionInspectorController } from './selection-inspector-controller.js';
import { createTraySpawnerView } from './tray-spawner-view.js';
import { createStagePointerController } from './stage-pointer-controller.js';
import { createStageHitTester } from './stage-hit-testing.js';
import { createCameraController } from './camera-controller.js';
/**
 * Play View Feature Module
 * Owns sandbox stage, entity composition, visual spawner tray, multi-selection,
 * batch transforms, alignment, and quick controls.
 */

import { assetsByKind, getAsset as getBuiltinAsset } from '../../core/asset-catalog.js';

import { DEFAULT_EXPRESSION, DEFAULT_EXPRESSION_INTENSITY, DEFAULT_STAGE_WIDTH, DEFAULT_STATIC_POSE, VIEWPORT_WIDTH } from '../../domain/vocabulary.js';

import { appendAsset } from '../designer/designer-view.js';
import { entityArtworkRevisions } from '../../domain/artwork-revision.js';
import { getBackgroundLayout } from '../../core/background-layout.js';

import { assetName, getCurrentLanguage, t } from '../../core/i18n.js';

/** Identity of everything that changes an entity's DOM, including custom artwork revisions. */
export function sceneEntityRenderKey(entity, getAsset = undefined) {
  return JSON.stringify({
    language: getCurrentLanguage(),
    kind: entity.kind,
    sourceId: entity.sourceId,
    artwork: entityArtworkRevisions(entity, getAsset),
    characterSnapshot: entity.kind === 'character' ? entity.characterSnapshot : null,
    expression: entity.kind === 'character' ? entity.expression || DEFAULT_EXPRESSION : null,
    expressionIntensity: entity.kind === 'character' ? entity.expressionIntensity ?? DEFAULT_EXPRESSION_INTENSITY : null,
    pose: entity.kind === 'character' ? entity.pose || DEFAULT_STATIC_POSE : null,
    animation: entity.kind === 'character' && entity.animation ? [
      entity.animation.clipId,
      entity.animation.enabled,
      entity.animation.intensity,
      entity.animation.phaseOffset
    ] : null,
    bubble: entity.kind === 'bubble' ? [entity.bubbleStyle, entity.text, entity.width] : null
  });
}

export function nextSpawnPoint(index, cameraX = 0) {
  return { x: cameraX + 650 + (index % 5) * 80, y: 690 + (index % 3) * 45 };
}

export function getWheelPanDelta(event, pageWidth = VIEWPORT_WIDTH) {
  if (event.ctrlKey || event.metaKey) return 0;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? pageWidth : 1;
  const x = event.deltaX || 0, y = event.deltaY || 0;
  const delta = event.shiftKey ? (Math.abs(x) > Math.abs(y) ? x : y)
    : Math.abs(x) > Math.abs(y) ? x : 0;
  return delta * unit;
}

export function getContextRingFocusAction(activeElement) {
  return activeElement?.closest?.('.context-ring') ? activeElement.dataset?.action || null : null;
}

export function findSceneSkinSvg(instanceId, queryAll = (selector) => globalThis.document?.querySelectorAll?.(selector) || []) {
  const entity = [...queryAll('.scene-entity-positioner')]
    .find((element) => element.dataset.instanceId === instanceId);
  return entity?.querySelector('[data-slot="face-mouth"] svg')
    || entity?.querySelector('[data-slot="skin"] svg')
    || entity?.querySelector('svg[data-asset-id="doll_classic_a"]')
    || entity?.querySelector('svg');
}

export function createPlayView({
  store,
  $,
  $$,
  renderDollInto,
  askConfirm,
  openSceneOutlineDialog,
  openWorldMapDialog,
  customArtRepo,
  openPaintStudio,
  getAsset = getBuiltinAsset,
  getAssetsByKind = (kind, options = {}) => assetsByKind(kind, options),
  invalidateAnimationDomCache
}) {
  const renderKeyOf = (entity) => sceneEntityRenderKey(entity, getAsset);
  const propSymbols = createPropSymbolRegistry({ getHost: () => $('#play-stage'), resolveAsset: getAsset });
  const hitTester = createStageHitTester({ getAsset, customArtRepo });
  let playRenderToken = 0;

  let activeDragInstanceId = null;
  let latestDragPoint = null;

  let dropdownsBound = false;

  async function render(state = store.getState()) {
    const token = ++playRenderToken;
    const focusedElement = document.activeElement;
    const focusedEntityId = /** @type {HTMLElement} */ (focusedElement?.closest?.('.scene-entity-positioner'))?.dataset.instanceId;
    const stageWidth = state.currentScene.stageWidth || DEFAULT_STAGE_WIDTH;

    syncCamera(state);

    renderBackgroundSelect(state);
    renderSpawnTray(state, token);
    renderSelectedActions(state);

    const emptyScene = $('#empty-scene');
    if (emptyScene) emptyScene.hidden = state.currentScene.entities.length > 0;
    const currentBackground = getAsset(state.currentScene.backgroundId);
    const sceneNameChip = $('#scene-name-chip');
    if (sceneNameChip) sceneNameChip.textContent = assetName(currentBackground, t('play.paperScene'));
    const sceneCountChip = $('#scene-count-chip');
    if (sceneCountChip) sceneCountChip.textContent = t('play.itemCount', { count: state.currentScene.entities.length });
    const widthChip = $('#scene-width-chip');

    if (widthChip) widthChip.textContent = t(stageWidth === 4800 ? 'play.stagePanoramic' : stageWidth === 3200 ? 'play.stageWide' : 'play.stageStandard');

    const background = $('#scene-background');
    const backgroundRenderKey = `${state.currentScene.backgroundId}:${stageWidth}`;
    if (background && background.dataset.renderKey !== backgroundRenderKey) {
      const layout = getBackgroundLayout(currentBackground, stageWidth);
      background.style.justifyContent = layout.centered ? 'center' : 'flex-start';
      const panels = [];
      for (const tile of layout.tiles) {
        const panel = document.createElement('div');
        panel.className = tile.mirrored ? 'scene-bg-panel is-mirrored' : 'scene-bg-panel';
        panel.style.flex = `0 0 ${layout.tilePercent}%`;
        await appendAsset(panel, state.currentScene.backgroundId, {});
        panels.push(panel);
      }
      if (token !== playRenderToken) return;
      background.replaceChildren(...panels);
      background.dataset.renderKey = backgroundRenderKey;
    }

    const entityRoot = $('#scene-entities');
    if (!entityRoot) {
      renderCameraHud(state);
      return;
    }
    const existingEntities = new Map([...entityRoot.children].map((element) => [element.dataset.instanceId, element]));
    const nextElements = [];
    const ordered = orderedSceneEntities(state.currentScene, getAsset);
    const selectedSet = new Set(state.ui.selectedEntityIds || (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : []));

    for (const entity of ordered) {
      if (token !== playRenderToken) return;
      const isSelected = selectedSet.has(entity.instanceId);
      const isPrimary = state.ui.selectedEntityId === entity.instanceId;
      const isMulti = isSelected && selectedSet.size > 1;
      const existing = existingEntities.get(entity.instanceId);
      const element = existing?.dataset.renderKey === renderKeyOf(entity)
        ? existing
        : await createSceneEntity(entity, isPrimary, isMulti);
      if (token !== playRenderToken) return;
      if (element === existing) patchSceneEntity(element, entity, isPrimary, isMulti);
      element.style.zIndex = String(nextElements.length + 1);
      nextElements.push(element);
    }
    const orderUnchanged = nextElements.length === entityRoot.children.length
      && nextElements.every((element, index) => element === entityRoot.children[index]);
    if (!orderUnchanged) {
      entityRoot.replaceChildren(...nextElements);
      invalidateAnimationDomCache?.();
    }
    propSymbols.retain(state.currentScene.entities.filter(entity => entity.kind === 'prop').map(entity => entity.sourceId));
    hitTester.retain(state.currentScene.entities);
    // The entity root is only replaced when order or membership changes; stable nodes are patched in place.
    renderCameraHud(state);
    renderContextRing(state);
    if (focusedEntityId) {
      requestAnimationFrame(() => {
        if (token !== playRenderToken) return;
        // Restore a replaced entity, but respect focus moved by the player while rendering.
        if (document.activeElement !== focusedElement
          && !(document.activeElement === document.body && !focusedElement.isConnected)) return;
        [...entityRoot.querySelectorAll('.scene-entity-positioner')]
          .find((element) => element.dataset.instanceId === focusedEntityId)
          ?.focus({ preventScroll: true });
      });
    }
  }

  function bumpToken() {
    playRenderToken += 1;
    removeContextRing();
  }

  function teardown() {
    bumpToken();
    destroyPointerController();
    destroyCameraController();
    destroyInspectorController();
    propSymbols.destroy();
    hitTester.destroy();
    removeContextRing();
    if (dropdownsBound && typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
      document.removeEventListener('click', handleDropdownOutsideClick);
      dropdownsBound = false;
    }
  }

  const { stopEdgePan, startEdgePan, initCameraControls, renderCameraHud, syncCamera, destroy: destroyCameraController } = createCameraController({
    get getWheelPanDelta() { return getWheelPanDelta; },
    askConfirm,
    get cancelPointerController() { return cancelPointerController; },
    store,
    $,
    getAsset,
    get activeDragInstanceId() { return activeDragInstanceId; }, set activeDragInstanceId(value) { activeDragInstanceId = value; },
    get latestDragPoint() { return latestDragPoint; }, set latestDragPoint(value) { latestDragPoint = value; },
    get updateDragPreview() { return updateDragPreview; },
    get updateContextRingPosition() { return updateContextRingPosition; }
  });

  const { cancelPointerController, initPointerController, updateDragPreview, stagePointAt, destroy: destroyPointerController } = createStagePointerController({
    store,
    $,
    getAsset,
    get playRenderToken() { return playRenderToken; }, set playRenderToken(value) { playRenderToken = value; },
    get activeDragInstanceId() { return activeDragInstanceId; }, set activeDragInstanceId(value) { activeDragInstanceId = value; },
    get latestDragPoint() { return latestDragPoint; }, set latestDragPoint(value) { latestDragPoint = value; },
    get stopEdgePan() { return stopEdgePan; },
    get startEdgePan() { return startEdgePan; },
    get initCameraControls() { return initCameraControls; },
    get render() { return render; },
    hitTester,
    get updateContextRingPosition() { return updateContextRingPosition; },
    get openEditBubbleDialog() { return openEditBubbleDialog; }
  });

  const { renderBackgroundSelect, renderSpawnTray } = createTraySpawnerView({
    get nextSpawnPoint() { return nextSpawnPoint; },
    store,
    $,
    renderDollInto,
    customArtRepo,
    openPaintStudio,
    getAsset,
    getAssetsByKind,
    get playRenderToken() { return playRenderToken; }, set playRenderToken(value) { playRenderToken = value; },
    get render() { return render; }
  });

  const { renderSelectedActions, handleDropdownOutsideClick, destroy: destroyInspectorController } = createSelectionInspectorController({
    store,
    $,
    $$,
    get dropdownsBound() { return dropdownsBound; }, set dropdownsBound(value) { dropdownsBound = value; }
  });

  const { renderContextRing, updateContextRingPosition, removeContextRing, handleEntityAction, handleStageKeydown, openEditBubbleDialog } = createSelectionHudController({
    get getContextRingFocusAction() { return getContextRingFocusAction; },
    store,
    $,
    askConfirm,
    openSceneOutlineDialog,
    openWorldMapDialog,
    getAsset,
    hitTester,
    get activeDragInstanceId() { return activeDragInstanceId; }
  });

  const { createSceneEntity, patchSceneEntity } = createSceneEntityView({
    propSymbols,
    hitTester,
    sceneEntityRenderKey: renderKeyOf,
    store,
    renderDollInto,
    customArtRepo,
    getAsset
  });

  return {
    render,
    bumpToken,
    initPointerController,
    cancelPointerController,
    stagePointAt,
    renderSelectedActions,
    renderContextRing,
    updateContextRingPosition,
    syncCamera,
    handleEntityAction,
    handleStageKeydown,
    teardown,
    destroy: teardown
  };
}
