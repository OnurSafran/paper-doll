/** Panoramic camera transforms, edge panning, and minimap controls. */
import { CAMERA_CONSTANTS, DEFAULT_STAGE_WIDTH, VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from '../../domain/vocabulary.js';
import { getBackgroundLayout } from '../../core/background-layout.js';

export function createCameraController(context) {
  let edgePanRaf = null;

  let edgePanDirection = 0;

  function stopEdgePan() {
    if (edgePanRaf) {
      cancelAnimationFrame(edgePanRaf);
      edgePanRaf = null;
    }
    edgePanDirection = 0;
    context.$('#play-stage')?.classList.remove('is-panning');
  }

  function startEdgePan(direction) {
    edgePanDirection = direction;
    if (edgePanRaf) return;
    context.$('#play-stage')?.classList.add('is-panning');
    function tick() {
      if (edgePanDirection === 0) {
        stopEdgePan();
        return;
      }
      const state = context.store.getState();
      const stageWidth = state.currentScene.stageWidth || DEFAULT_STAGE_WIDTH;
      const currentX = state.currentScene.cameraX || 0;
      const delta = edgePanDirection * CAMERA_CONSTANTS.EDGE_SPEED;
      const maxCameraX = Math.max(0, stageWidth - VIEWPORT_WIDTH);
      const nextX = Math.min(Math.max(0, currentX + delta), maxCameraX);
      if (nextX === currentX) {
        stopEdgePan();
        return;
      }
      context.store.dispatch({ type: 'scene/setCameraX', cameraX: nextX });
      if (context.activeDragInstanceId && context.latestDragPoint) {
        context.updateDragPreview(context.activeDragInstanceId, context.latestDragPoint);
      }
      edgePanRaf = requestAnimationFrame(tick);
    }
    edgePanRaf = requestAnimationFrame(tick);
  }

  function initCameraControls() {
    const stageEl = context.$('#play-stage');
    const widthSelect = context.$('#stage-width-select');
    const slider = context.$('#camera-slider');
    const panLeftBtn = context.$('#camera-pan-left');
    const panRightBtn = context.$('#camera-pan-right');
    const minimap = context.$('#stage-minimap');

    if (widthSelect && !widthSelect.dataset.bound) {
      widthSelect.dataset.bound = 'true';
      widthSelect.addEventListener('change', (e) => {
        context.store.dispatch({ type: 'scene/setStageWidth', stageWidth: Number(e.target.value) });
      });
    }

    if (panLeftBtn && !panLeftBtn.dataset.bound) {
      panLeftBtn.dataset.bound = 'true';
      panLeftBtn.addEventListener('click', () => {
        context.store.dispatch({ type: 'scene/panCamera', deltaX: -CAMERA_CONSTANTS.STEP });
      });
    }

    if (panRightBtn && !panRightBtn.dataset.bound) {
      panRightBtn.dataset.bound = 'true';
      panRightBtn.addEventListener('click', () => {
        context.store.dispatch({ type: 'scene/panCamera', deltaX: CAMERA_CONSTANTS.STEP });
      });
    }

    if (slider && !slider.dataset.bound) {
      slider.dataset.bound = 'true';
      slider.addEventListener('input', (e) => {
        context.store.dispatch({ type: 'scene/setCameraX', cameraX: Number(e.target.value) });
      });
    }

    if (minimap && !minimap.dataset.bound) {
      minimap.dataset.bound = 'true';
      let isSeekingMinimap = false;

      const seekFromMinimap = (event) => {
        const rect = minimap.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        const stageWidth = context.store.getState().currentScene.stageWidth || DEFAULT_STAGE_WIDTH;
        const targetX = ratio * stageWidth - VIEWPORT_WIDTH / 2;
        context.store.dispatch({ type: 'scene/setCameraX', cameraX: Math.round(targetX) });
      };

      minimap.addEventListener('pointerdown', (event) => {
        isSeekingMinimap = true;
        minimap.setPointerCapture(event.pointerId);
        seekFromMinimap(event);
      });
      minimap.addEventListener('pointermove', (event) => {
        if (isSeekingMinimap) seekFromMinimap(event);
      });
      minimap.addEventListener('pointerup', (event) => {
        if (isSeekingMinimap) {
          isSeekingMinimap = false;
          try { minimap.releasePointerCapture(event.pointerId); } catch {}
        }
      });
      minimap.addEventListener('pointercancel', () => { isSeekingMinimap = false; });
      minimap.addEventListener('keydown', (event) => {
        const stageWidth = context.store.getState().currentScene.stageWidth || DEFAULT_STAGE_WIDTH;
        const maxCameraX = Math.max(0, stageWidth - VIEWPORT_WIDTH);
        let nextCameraX = null;
        if (event.key === 'ArrowLeft' || event.key === 'PageUp') nextCameraX = (context.store.getState().currentScene.cameraX || 0) - CAMERA_CONSTANTS.STEP;
        if (event.key === 'ArrowRight' || event.key === 'PageDown') nextCameraX = (context.store.getState().currentScene.cameraX || 0) + CAMERA_CONSTANTS.STEP;
        if (event.key === 'Home') nextCameraX = 0;
        if (event.key === 'End') nextCameraX = maxCameraX;
        if (nextCameraX === null) return;
        event.preventDefault();
        context.store.dispatch({ type: 'scene/setCameraX', cameraX: nextCameraX });
      });
    }

    if (stageEl && !stageEl.dataset.wheelBound) {
      stageEl.dataset.wheelBound = 'true';
      stageEl.addEventListener('wheel', (event) => {
        const stageWidth = context.store.getState().currentScene.stageWidth || DEFAULT_STAGE_WIDTH;
        if (stageWidth <= VIEWPORT_WIDTH) return;
        const delta = context.getWheelPanDelta(event);
        if (!delta) return;
        event.preventDefault();
        context.store.dispatch({ type: 'scene/panCamera', deltaX: delta });
      }, { passive: false });
    }
  }

  function renderCameraHud(state, includeSceneMap = true) {
    const stageWidth = state.currentScene.stageWidth || DEFAULT_STAGE_WIDTH;
    const cameraX = state.currentScene.cameraX || 0;
    const hud = context.$('#camera-hud');
    const widthSelect = context.$('#stage-width-select');
    if (widthSelect && widthSelect.value !== String(stageWidth)) {
      widthSelect.value = String(stageWidth);
    }
    if (!hud) return;
    const isPanoramic = stageWidth > VIEWPORT_WIDTH;
    hud.hidden = !isPanoramic;
    if (!isPanoramic) return;

    const maxCameraX = stageWidth - VIEWPORT_WIDTH;
    const slider = context.$('#camera-slider');
    if (slider) {
      slider.max = String(maxCameraX);
      slider.value = String(cameraX);
    }
    const panLeftBtn = context.$('#camera-pan-left');
    if (panLeftBtn) panLeftBtn.disabled = cameraX <= 0;
    const panRightBtn = context.$('#camera-pan-right');
    if (panRightBtn) panRightBtn.disabled = cameraX >= maxCameraX;

    const minimap = context.$('#stage-minimap');
    if (minimap) {
      const minimapBg = context.$('#minimap-bg');
      const background = context.getAsset(state.currentScene.backgroundId);
      const mapKey = `${background?.id ?? ''}:${stageWidth}`;
      if (includeSceneMap && minimapBg && background && minimapBg.dataset.mapKey !== mapKey) {
        const layout = getBackgroundLayout(background, stageWidth);
        minimapBg.style.justifyContent = layout.centered ? 'center' : 'flex-start';
        minimapBg.replaceChildren(...layout.tiles.map((tile) => {
          const panel = document.createElement('span');
          panel.className = tile.mirrored ? 'minimap-bg-panel is-mirrored' : 'minimap-bg-panel';
          panel.style.flex = `0 0 ${layout.tilePercent}%`;
          panel.style.backgroundImage = `url("${background.path}")`;
          return panel;
        }));
        minimapBg.dataset.mapKey = mapKey;
      }
      const lensWidthPct = (VIEWPORT_WIDTH / stageWidth) * 100;
      const lensLeftPct = (cameraX / stageWidth) * 100;
      minimap.style.setProperty('--lens-width', `${lensWidthPct}%`);
      minimap.style.setProperty('--lens-left', `${lensLeftPct}%`);
      minimap.setAttribute('aria-valuemax', String(maxCameraX));
      minimap.setAttribute('aria-valuenow', String(cameraX));

      const minimapEntities = context.$('#minimap-entities');
      if (includeSceneMap && minimapEntities) {
        const dots = state.currentScene.entities.map((e) => {
          const dot = document.createElement('span');
          dot.className = 'minimap-dot';
          dot.style.left = `${(e.x / stageWidth) * 100}%`;
          dot.style.top = `${(e.y / VIEWPORT_HEIGHT) * 100}%`;
          return dot;
        });
        minimapEntities.replaceChildren(...dots);
      }
    }
  }

  function syncCamera(state = context.store.getState()) {
    const stageEl = context.$('#play-stage');
    if (stageEl) {
      stageEl.style.setProperty('--stage-width', String(state.currentScene.stageWidth || DEFAULT_STAGE_WIDTH));
      stageEl.style.setProperty('--camera-x', String(state.currentScene.cameraX || 0));
    }
    renderCameraHud(state, false);
  }

  return { stopEdgePan, startEdgePan, initCameraControls, renderCameraHud, syncCamera };
}
