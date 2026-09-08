import { createPropSymbolRegistry } from '../../core/svg-symbols.js';
import { createSceneEntityView } from './scene-entity-view.js';
import { createSelectionHudController } from './selection-hud-controller.js';
import { createSelectionInspectorController } from './selection-inspector-controller.js';
import { createTraySpawnerView } from './tray-spawner-view.js';
import { createStagePointerController } from './stage-pointer-controller.js';
import { createCameraController } from './camera-controller.js';
/**
 * Play View Feature Module
 * Owns sandbox stage, entity composition, visual spawner tray, multi-selection,
 * batch transforms, alignment, and quick controls.
 */

import { assetsByKind, getAsset as getBuiltinAsset } from '../../core/asset-catalog.js';

import { DEFAULT_EXPRESSION, DEFAULT_EXPRESSION_INTENSITY, DEFAULT_STAGE_WIDTH, DEFAULT_STATIC_POSE, VIEWPORT_HEIGHT } from '../../domain/vocabulary.js';

import { appendAsset } from '../designer/designer-view.js';
import { getBackgroundLayout } from '../../core/background-layout.js';

import { assetName, getCurrentLanguage, t } from '../../core/i18n.js';

// Context ring placement, in stage logical units. The ring flips above the
// selection once the selection reaches the stage's lower band, and is otherwise
// kept clear of the stage's top and bottom edges.
const CONTEXT_RING_FLIP_THRESHOLD_Y = VIEWPORT_HEIGHT - 160;
const CONTEXT_RING_MAX_Y = VIEWPORT_HEIGHT - 60;
const CONTEXT_RING_MIN_Y = 25;
const CONTEXT_RING_GAP_ABOVE = 15;
const CONTEXT_RING_GAP_BELOW = 35;

export function sceneEntityRenderKey(entity) {
  return JSON.stringify({
    language: getCurrentLanguage(),
    kind: entity.kind,
    sourceId: entity.sourceId,
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

export function getWheelPanDelta(event) {
  if (event.shiftKey) return event.deltaY || 0;
  return Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : 0;
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
  const propSymbols = createPropSymbolRegistry({ getHost: () => $('#play-stage') });
  let playRenderToken = 0;

  let activeDragInstanceId = null;
  let latestDragPoint = null;

  let dropdownsBound = false;

  async function render(state = store.getState()) {
    const token = ++playRenderToken;
    const focusedEntityId = /** @type {HTMLElement} */ (document.activeElement?.closest?.('.scene-entity-positioner'))?.dataset.instanceId;
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

    if (widthChip) widthChip.textContent = `${stageWidth}px`;

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
    const ordered = [...state.currentScene.entities].sort((a, b) => a.order - b.order);
    const selectedSet = new Set(state.ui.selectedEntityIds || (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : []));

    for (const entity of ordered) {
      if (token !== playRenderToken) return;
      const isSelected = selectedSet.has(entity.instanceId);
      const isPrimary = state.ui.selectedEntityId === entity.instanceId;
      const isMulti = isSelected && selectedSet.size > 1;
      const existing = existingEntities.get(entity.instanceId);
      const element = existing?.dataset.renderKey === sceneEntityRenderKey(entity)
        ? existing
        : await createSceneEntity(entity, isPrimary, isMulti);
      if (token !== playRenderToken) return;
      if (element === existing) patchSceneEntity(element, entity, isPrimary, isMulti);
      nextElements.push(element);
    }
    const orderUnchanged = nextElements.length === entityRoot.children.length
      && nextElements.every((element, index) => element === entityRoot.children[index]);
    if (!orderUnchanged) {
      entityRoot.replaceChildren(...nextElements);
      invalidateAnimationDomCache?.();
    }
    propSymbols.retain(state.currentScene.entities.filter(entity => entity.kind === 'prop').map(entity => entity.sourceId));
    // The entity root is only replaced when order or membership changes; stable nodes are patched in place.
    renderCameraHud(state);
    renderContextRing(state);
    if (focusedEntityId) {
      requestAnimationFrame(() => {
        if (token !== playRenderToken) return;
        [...entityRoot.querySelectorAll('.scene-entity-positioner')]
          .find((element) => element.dataset.instanceId === focusedEntityId)
          ?.focus({ preventScroll: true });
      });
    }
  }

  function bumpToken() {
    playRenderToken += 1;
  }

  function teardown() {
    bumpToken();
    cancelPointerController();
    propSymbols.destroy();
    if (dropdownsBound && typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
      document.removeEventListener('click', handleDropdownOutsideClick);
      dropdownsBound = false;
    }
  }

  const { stopEdgePan, startEdgePan, initCameraControls, renderCameraHud, syncCamera } = createCameraController({
    get getWheelPanDelta() { return getWheelPanDelta; },
    store,
    $,
    getAsset,
    get activeDragInstanceId() { return activeDragInstanceId; }, set activeDragInstanceId(value) { activeDragInstanceId = value; },
    get latestDragPoint() { return latestDragPoint; }, set latestDragPoint(value) { latestDragPoint = value; },
    get updateDragPreview() { return updateDragPreview; }
  });

  const { cancelPointerController, initPointerController, updateDragPreview } = createStagePointerController({
    store,
    $,
    getAsset,
    get playRenderToken() { return playRenderToken; }, set playRenderToken(value) { playRenderToken = value; },
    get activeDragInstanceId() { return activeDragInstanceId; }, set activeDragInstanceId(value) { activeDragInstanceId = value; },
    get latestDragPoint() { return latestDragPoint; }, set latestDragPoint(value) { latestDragPoint = value; },
    get stopEdgePan() { return stopEdgePan; },
    get startEdgePan() { return startEdgePan; },
    get initCameraControls() { return initCameraControls; },
    get render() { return render; }
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

  const { renderSelectedActions, handleDropdownOutsideClick } = createSelectionInspectorController({
    store,
    $,
    $$,
    get dropdownsBound() { return dropdownsBound; }, set dropdownsBound(value) { dropdownsBound = value; }
  });

  const { renderContextRing, handleEntityAction, handleStageKeydown, openEditBubbleDialog } = createSelectionHudController({
    get CONTEXT_RING_FLIP_THRESHOLD_Y() { return CONTEXT_RING_FLIP_THRESHOLD_Y; },
    get CONTEXT_RING_MAX_Y() { return CONTEXT_RING_MAX_Y; },
    get CONTEXT_RING_MIN_Y() { return CONTEXT_RING_MIN_Y; },
    get CONTEXT_RING_GAP_ABOVE() { return CONTEXT_RING_GAP_ABOVE; },
    get CONTEXT_RING_GAP_BELOW() { return CONTEXT_RING_GAP_BELOW; },
    get getContextRingFocusAction() { return getContextRingFocusAction; },
    store,
    $,
    askConfirm,
    openSceneOutlineDialog,
    openWorldMapDialog,
    getAsset
  });

  const { createSceneEntity, patchSceneEntity } = createSceneEntityView({
    propSymbols,
    get sceneEntityRenderKey() { return sceneEntityRenderKey; },
    store,
    renderDollInto,
    customArtRepo,
    getAsset,
    get openEditBubbleDialog() { return openEditBubbleDialog; }
  });

  return {
    render,
    bumpToken,
    initPointerController,
    cancelPointerController,
    renderSelectedActions,
    renderContextRing,
    syncCamera,
    handleEntityAction,
    handleStageKeydown,
    teardown,
    destroy: teardown
  };
}
