/**
 * The Papercraft World Map (Diyar Haritası) View Controller
 * Manages the unfolding map modal, the pannable wide-canvas camera, interactive
 * landmarks, active doll marker, easter egg micro-animations, collectible
 * souvenir stamps, and room travel.
 *
 * Landmark placement is never hard-coded here or in index.html: every anchor is
 * positioned from `WORLD_MAP_LANDMARKS[].coord`, so a new (possibly locked)
 * realm only needs a catalog entry plus its artwork group in the SVG.
 */

import {
  BIOMES,
  MAP_CANVAS,
  SOUVENIR_STAMPS,
  WORLD_MAP_LANDMARKS,
  cameraXForLandmark,
  clampCameraX,
  getLandmarkByBackgroundId,
  getLandmarkById,
  isLandmarkUnlocked,
  landmarkMapRatio
} from '../../domain/world-map-catalog.js';
import { createPaperAudio } from '../../core/paper-audio.js';
import { assetName, t } from '../../core/i18n.js';

/** Map units the doll marker floats above its landmark anchor. */
const MARKER_LIFT = 50;
/** Fraction of the visible window a pan button step moves. */
const PAN_STEP_RATIO = 0.6;

export function createWorldMapView({
  store,
  $,
  $$,
  renderDollInto,
  customArtRepo,
  getAsset
}) {
  const paperAudio = createPaperAudio(() => Boolean(store?.getState()?.settings?.soundEnabled));
  let selectedLandmarkId = null;
  let markerRenderToken = 0;
  let fitWholeMap = false;
  let cameraGlideId = 0;

  function getDialog() {
    return $('#world-map-dialog');
  }

  function getCamera() {
    return $('#world-map-camera');
  }

  function getActiveBackgroundId() {
    return store.getState()?.currentScene?.backgroundId || 'bg_bedroom';
  }

  function getSettings() {
    return store.getState()?.settings || {};
  }

  /**
   * Resolves the landmark for a background, or null when the background has no
   * realm on the map yet (custom or newly shipped rooms). Callers must handle
   * null rather than silently falling back to another realm.
   */
  function getLandmarkForActiveBackground() {
    return getLandmarkByBackgroundId(getActiveBackgroundId());
  }

  /**
   * Updates the compact header pill label to match active background.
   */
  function syncHeaderPill(state = store.getState()) {
    const nameEl = $('#current-location-name');
    if (!nameEl) return;
    const bgId = state.currentScene?.backgroundId || 'bg_bedroom';
    const landmark = getLandmarkByBackgroundId(bgId);
    const asset = getAsset(bgId);
    nameEl.textContent = landmark
      ? t(landmark.nameKey, assetName(asset, asset?.name || 'Oda'))
      : assetName(asset, 'Oda');
  }

  // ==========================================================================
  // Landmark placement — catalog is the single source of truth
  // ==========================================================================

  /**
   * Positions every landmark anchor from the catalog and applies lock state.
   * Art groups in the SVG carry no coordinates of their own.
   */
  function layoutLandmarks() {
    const settings = getSettings();

    for (const landmark of WORLD_MAP_LANDMARKS) {
      const anchor = $(`.map-landmark-anchor[data-landmark-id="${landmark.id}"]`);
      const body = $(`#landmark-${landmark.id}`);
      if (!anchor || !body) continue;

      anchor.setAttribute('transform', `translate(${landmark.coord.x}, ${landmark.coord.y})`);

      const unlocked = isLandmarkUnlocked(landmark, settings);
      body.classList.toggle('is-locked', !unlocked);
      body.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
      const egg = body.querySelector('.easter-egg-trigger');
      egg?.setAttribute('tabindex', unlocked ? '0' : '-1');
      egg?.setAttribute('aria-disabled', unlocked ? 'false' : 'true');

      const name = t(landmark.nameKey, landmark.id);
      body.setAttribute('aria-label', unlocked ? name : `${name} (${t('worldMap.lockedBadge')})`);
    }
  }

  /**
   * Positions the active doll marker over the current landmark and renders the
   * mini doll cutout. Hides the marker when the active background has no realm.
   */
  async function renderActiveDollMarker(landmark) {
    // Invalidate the previous render even when this location has no doll.
    const token = ++markerRenderToken;
    const dollContainer = $('#active-marker-doll-slot');
    dollContainer?.replaceChildren();
    const marker = $('#active-doll-marker');
    if (!marker) return;

    if (!landmark) {
      marker.setAttribute('hidden', 'hidden');
      marker.style.display = 'none';
      return;
    }
    marker.removeAttribute('hidden');
    marker.style.display = '';
    marker.setAttribute('transform', `translate(${landmark.coord.x}, ${landmark.coord.y - MARKER_LIFT})`);

    if (!dollContainer || !renderDollInto) return;

    const state = store.getState();
    const entities = state.currentScene?.entities || [];
    const primaryId = state.ui?.primarySelectedId;
    const activeEntity =
      entities.find((e) => e.instanceId === primaryId && e.kind === 'character' && e.characterSnapshot) ||
      entities.find((e) => e.kind === 'character' && e.characterSnapshot);
    const dollDraft = activeEntity ? activeEntity.characterSnapshot : state.designer?.draft;
    if (!dollDraft) return;

    // Guard against overlapping renders when the dialog is reopened quickly.
    try {
      const fragment = document.createElement('div');
      await renderDollInto(fragment, dollDraft, { customArtRepo, getAsset, enforceFit: false });
      if (token !== markerRenderToken) return;
      dollContainer.replaceChildren(...fragment.childNodes);
    } catch {
      /* the marker is decorative — a failed doll render must not break the map */
    }
  }

  // ==========================================================================
  // Wide-map camera
  // ==========================================================================

  /**
   * Sizes the SVG so the map either fits entirely, or fills the camera height
   * and scrolls horizontally. Returns the visible width in map units.
   */
  function applyCameraZoom() {
    const camera = getCamera();
    const svg = $('.world-map-svg');
    if (!camera || !svg) return MAP_CANVAS.width;

    const cameraWidth = camera.clientWidth;
    const cameraHeight = camera.clientHeight;
    const aspect = MAP_CANVAS.width / MAP_CANVAS.height;

    // The dialog may not be laid out yet (or the tab is hidden). Sizing from a
    // zero-width camera would collapse the map, so wait for a real measurement.
    if (cameraWidth <= 0 || cameraHeight <= 0) {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
          if (getDialog()?.open) {
            applyCameraZoom();
            renderMinimap();
          }
        });
      }
      return MAP_CANVAS.width;
    }

    // "Fit" shows the whole canvas; otherwise fill the height and pan sideways.
    const fitWidth = Math.min(cameraWidth, cameraHeight * aspect);
    const fillWidth = cameraHeight * aspect;
    const renderWidth = fitWholeMap ? fitWidth : fillWidth;

    svg.style.width = `${Math.round(renderWidth)}px`;
    svg.style.height = `${Math.round(renderWidth / aspect)}px`;
    camera.classList.toggle('is-fit', fitWholeMap);

    const toggle = $('#world-map-zoom-toggle');
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(fitWholeMap));
      toggle.setAttribute('aria-label', t(fitWholeMap ? 'worldMap.zoomCloseAria' : 'worldMap.zoomToggleAria'));
    }

    return (cameraWidth / renderWidth) * MAP_CANVAS.width;
  }

  /** Visible width of the camera window, expressed in map units. */
  function visibleMapWidth() {
    const camera = getCamera();
    const svg = $('.world-map-svg');
    if (!camera || !svg) return MAP_CANVAS.width;
    const renderWidth = svg.clientWidth || camera.clientWidth;
    if (!renderWidth || !camera.clientWidth) return MAP_CANVAS.width;
    return Math.min(MAP_CANVAS.width, (camera.clientWidth / renderWidth) * MAP_CANVAS.width);
  }

  /** Current camera offset in map units. */
  function getCameraX() {
    const camera = getCamera();
    const svg = $('.world-map-svg');
    if (!camera || !svg) return 0;
    const renderWidth = svg.clientWidth;
    if (!renderWidth) return 0;
    return (camera.scrollLeft / renderWidth) * MAP_CANVAS.width;
  }

  function setCameraX(mapX, { smooth = true } = {}) {
    const camera = getCamera();
    const svg = $('.world-map-svg');
    if (!camera || !svg) return;
    const renderWidth = svg.clientWidth || 1;
    const clamped = clampCameraX(mapX, visibleMapWidth());
    const targetScroll = (clamped / MAP_CANVAS.width) * renderWidth;

    if (!smooth || prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      cancelCameraGlide();
      camera.scrollLeft = targetScroll;
      renderMinimap();
      return;
    }
    glideCameraTo(camera, targetScroll);
  }

  /**
   * Eased scroll animation. `scrollTo({ behavior: 'smooth' })` is unreliable for
   * scrollers inside a top-layer <dialog>, so the glide is driven manually.
   */
  function glideCameraTo(camera, targetScroll) {
    cancelCameraGlide();
    const from = camera.scrollLeft;
    const distance = targetScroll - from;
    if (Math.abs(distance) < 1) {
      renderMinimap();
      return;
    }
    const duration = Math.min(520, 160 + Math.abs(distance) * 0.45);
    const startedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    const step = (now) => {
      const elapsed = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      camera.scrollLeft = from + distance * eased;
      renderMinimap();
      cameraGlideId = elapsed < 1 ? requestAnimationFrame(step) : 0;
    };
    cameraGlideId = requestAnimationFrame(step);
  }

  function cancelCameraGlide() {
    if (cameraGlideId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(cameraGlideId);
    }
    cameraGlideId = 0;
  }

  function prefersReducedMotion() {
    const preference = getSettings().reducedMotion;
    if (preference === 'reduce') return true;
    if (preference === 'full') return false;
    return typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function panCamera(direction) {
    const step = visibleMapWidth() * PAN_STEP_RATIO;
    setCameraX(getCameraX() + direction * step);
  }

  function centerCameraOn(landmark, options) {
    if (!landmark) return;
    setCameraX(cameraXForLandmark(landmark, visibleMapWidth()), options);
  }

  /** Draws the minimap dots once, then keeps the viewport window in sync. */
  function renderMinimap() {
    const minimap = $('#world-map-minimap');
    if (!minimap) return;

    const dots = $('#world-map-minimap-dots');
    if (dots && dots.dataset.rendered !== 'true') {
      dots.dataset.rendered = 'true';
      dots.replaceChildren(...WORLD_MAP_LANDMARKS.map((landmark) => {
        const dot = document.createElement('span');
        dot.className = `minimap-dot biome-${landmark.biome}`;
        dot.dataset.landmarkId = landmark.id;
        dot.style.left = `${landmarkMapRatio(landmark) * 100}%`;
        dot.style.top = `${(landmark.coord.y / MAP_CANVAS.height) * 100}%`;
        return dot;
      }));
    }

    if (dots) {
      const activeLandmark = getLandmarkForActiveBackground();
      dots.querySelectorAll('.minimap-dot').forEach((dot) => {
        dot.classList.toggle('is-selected', dot.dataset.landmarkId === selectedLandmarkId);
        dot.classList.toggle('is-current', Boolean(activeLandmark) && dot.dataset.landmarkId === activeLandmark.id);
      });
    }

    const win = $('#world-map-minimap-window');
    const visible = visibleMapWidth();
    if (win) {
      win.style.left = `${(getCameraX() / MAP_CANVAS.width) * 100}%`;
      win.style.width = `${Math.min(100, (visible / MAP_CANVAS.width) * 100)}%`;
    }

    const maxX = Math.max(0, MAP_CANVAS.width - visible);
    minimap.setAttribute('aria-valuemin', '0');
    minimap.setAttribute('aria-valuemax', String(Math.round(maxX)));
    minimap.setAttribute('aria-valuenow', String(Math.round(getCameraX())));
  }

  /** Wires camera controls once per document. */
  function bindCameraControls() {
    const camera = getCamera();
    if (!camera || camera.dataset.cameraBound === 'true') return;
    camera.dataset.cameraBound = 'true';

    camera.addEventListener('scroll', renderMinimap, { passive: true });
    camera.addEventListener('wheel', cancelCameraGlide, { passive: true });

    // Drag-to-pan for mouse/pen; touch uses native scrolling.
    let dragging = false;
    let dragStartX = 0;
    let dragStartScroll = 0;

    camera.addEventListener('pointerdown', (event) => {
      cancelCameraGlide();
      if (event.pointerType === 'touch' || event.button !== 0) return;
      if (event.target.closest('.map-landmark, .easter-egg-trigger')) return;
      dragging = true;
      dragStartX = event.clientX;
      dragStartScroll = camera.scrollLeft;
      camera.classList.add('is-dragging');
    });

    camera.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      camera.scrollLeft = dragStartScroll - (event.clientX - dragStartX);
    });

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      camera.classList.remove('is-dragging');
    };
    camera.addEventListener('pointerup', endDrag);
    camera.addEventListener('pointercancel', endDrag);
    camera.addEventListener('pointerleave', endDrag);
    getDialog()?.addEventListener('close', endDrag);

    $('#world-map-pan-left')?.addEventListener('click', () => panCamera(-1));
    $('#world-map-pan-right')?.addEventListener('click', () => panCamera(1));
    $('#world-map-zoom-toggle')?.addEventListener('click', () => {
      fitWholeMap = !fitWholeMap;
      paperAudio.playPaperRustle();
      applyCameraZoom();
      const landmark = getLandmarkById(selectedLandmarkId);
      if (landmark) centerCameraOn(landmark, { smooth: false });
      renderMinimap();
    });

    const minimap = $('#world-map-minimap');
    if (minimap) {
      const jumpToRatio = (clientX) => {
        const rect = minimap.getBoundingClientRect();
        if (!rect.width) return;
        const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        setCameraX(ratio * MAP_CANVAS.width - visibleMapWidth() / 2, { smooth: false });
      };
      minimap.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        minimap.setPointerCapture?.(event.pointerId);
        jumpToRatio(event.clientX);
      });
      minimap.addEventListener('pointermove', (event) => {
        if (event.buttons === 1) jumpToRatio(event.clientX);
      });
      minimap.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
          event.preventDefault();
          panCamera(-1);
        } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
          event.preventDefault();
          panCamera(1);
        } else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          setCameraX(event.key === 'Home' ? 0 : MAP_CANVAS.width, { smooth: false });
        }
      });
    }

    if (typeof window !== 'undefined' && typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(() => {
        if (!getDialog()?.open) return;
        cancelCameraGlide();
        applyCameraZoom();
        renderMinimap();
      });
      observer.observe(camera);
    }
  }

  // ==========================================================================
  // Dialog lifecycle
  // ==========================================================================

  function openWorldMapDialog() {
    const dialog = getDialog();
    if (!dialog || dialog.open) return;

    $('#open-world-map-btn')?.setAttribute('aria-expanded', 'true');
    paperAudio.playPaperRustle();

    const currentLandmark = getLandmarkForActiveBackground();
    const focusLandmark = currentLandmark || WORLD_MAP_LANDMARKS[0];
    selectedLandmarkId = focusLandmark.id;

    layoutLandmarks();
    renderMapHeader();
    renderPassportStamps();
    renderActiveDollMarker(currentLandmark);
    renderPreviewDock(focusLandmark);
    attachLandmarkHandlers();
    attachEasterEggHandlers();

    if (!dialog.dataset.closeBound) {
      dialog.dataset.closeBound = 'true';
      dialog.addEventListener('close', () => {
        // Native Escape/backdrop dismissal follows this path too.
        if (dialog.open) return;
        cancelCameraGlide();
        markerRenderToken++;
        $('#open-world-map-btn')?.setAttribute('aria-expanded', 'false');
        $('#open-world-map-btn')?.focus();
      });
    }
    // Backdrop light-dismiss is wired centrally by enableDialogLightDismiss()
    // in app.js for every dialog.library-dialog, including this one.

    dialog.showModal();

    // The camera can only be measured once the dialog is laid out.
    bindCameraControls();
    applyCameraZoom();
    centerCameraOn(focusLandmark, { smooth: false });
    renderMinimap();

    $(`#landmark-${focusLandmark.id}`)?.focus();
  }

  function closeWorldMapDialog() {
    const dialog = getDialog();
    if (!dialog || !dialog.open) return;
    cancelCameraGlide();
    markerRenderToken++;
    dialog.close();
    $('#open-world-map-btn')?.setAttribute('aria-expanded', 'false');
    $('#open-world-map-btn')?.focus();
  }

  /**
   * Renders the header stamp counter and title.
   */
  function renderMapHeader() {
    const stamps = getSettings().stamps || [];
    const countBadge = $('#world-map-stamp-counter');
    if (countBadge) {
      countBadge.textContent = t('worldMap.stampCount', {
        found: stamps.length,
        total: SOUVENIR_STAMPS.length
      });
    }
  }

  /**
   * Renders location preview dock details for selected landmark.
   */
  function renderPreviewDock(landmark) {
    const dock = $('#world-map-preview-dock');
    if (!dock || !landmark) return;

    const settings = getSettings();
    const unlocked = isLandmarkUnlocked(landmark, settings);
    const isCurrent = landmark.backgroundId === getActiveBackgroundId();

    // Biome badge
    const biome = BIOMES[landmark.biome];
    const biomeBadge = dock.querySelector('.dock-biome-badge');
    if (biomeBadge) {
      biomeBadge.className = `dock-biome-badge ${landmark.biome}`;
      biomeBadge.textContent = `${biome?.icon || '📍'} ${t(biome?.nameKey, landmark.biome)}`;
    }

    // Title
    const titleEl = dock.querySelector('.dock-title');
    if (titleEl) {
      titleEl.textContent = t(landmark.nameKey, landmark.id);
    }

    // Room thumbnail
    const thumbContainer = dock.querySelector('.dock-thumb-container');
    if (thumbContainer) {
      renderLandmarkThumbnail(thumbContainer, landmark.backgroundId, unlocked);
    }

    // Description
    const descEl = dock.querySelector('.dock-description');
    if (descEl) {
      descEl.textContent = t(landmark.descKey, '');
    }

    // Easter egg hint
    const hintEl = dock.querySelector('.dock-hint');
    if (hintEl) {
      hintEl.textContent = `💡 ${t(landmark.easterEggHintKey, '')}`;
    }

    // Travel / Locked action button
    const actionContainer = dock.querySelector('.dock-action-area');
    if (actionContainer) {
      actionContainer.replaceChildren();

      if (!unlocked) {
        const lockedBox = document.createElement('div');
        lockedBox.className = 'dock-locked-box';
        const clue = landmark.unlockClueKey
          ? t(landmark.unlockClueKey, t('worldMap.defaultUnlockClue'))
          : t('worldMap.defaultUnlockClue');
        lockedBox.textContent = `🔒 ${t('worldMap.lockedBadge')}: ${clue}`;
        actionContainer.appendChild(lockedBox);
      } else if (isCurrent) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'button secondary dock-travel-btn is-current';
        btn.disabled = true;
        btn.textContent = t('worldMap.currentLocation');
        actionContainer.appendChild(btn);
      } else {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'button primary dock-travel-btn';
        btn.textContent = t('worldMap.travelBtn');
        btn.addEventListener('click', () => travelToLandmark(landmark));
        actionContainer.appendChild(btn);
      }
    }

    // Highlight selected landmark on SVG
    $$('.map-landmark').forEach((el) => el.classList.remove('is-active-landmark'));
    $(`#landmark-${landmark.id}`)?.classList.add('is-active-landmark');
    renderMinimap();
  }

  /**
   * Renders thumbnail SVG into container for the preview dock.
   */
  function renderLandmarkThumbnail(container, backgroundId, unlocked = true) {
    container.replaceChildren();
    container.classList.toggle('is-locked', !unlocked);
    const asset = getAsset(backgroundId);
    if (!asset?.path) return;

    const img = document.createElement('img');
    img.src = asset.path;
    img.alt = assetName(asset, asset.name || 'Background Preview');
    img.className = 'dock-thumb-svg';
    container.appendChild(img);
  }

  /**
   * Travels to selected landmark: plays page turn sound and dispatches background change.
   * Note: play-view.js reactively observes background changes and runs the stage page-turn curl.
   */
  function travelToLandmark(landmark) {
    if (!landmark || !landmark.backgroundId) return;
    // Defence in depth: the dock hides the button for locked realms, but never
    // let a stray call travel somewhere the player has not unlocked.
    if (!isLandmarkUnlocked(landmark, getSettings())) return;

    paperAudio.playPageTurn();
    closeWorldMapDialog();

    store.dispatch({
      type: 'scene/setBackground',
      backgroundId: landmark.backgroundId
    });
  }

  /**
   * Selects a landmark, updating the dock, highlight and camera.
   */
  function selectLandmark(landmark, { center = false } = {}) {
    if (!landmark) return;
    selectedLandmarkId = landmark.id;
    renderPreviewDock(landmark);
    if (center) centerCameraOn(landmark);
  }

  /**
   * Handles landmark clicks & keyboard arrow navigation.
   */
  function attachLandmarkHandlers() {
    WORLD_MAP_LANDMARKS.forEach((landmark, index) => {
      const el = $(`#landmark-${landmark.id}`);
      if (!el) return;

      el.onclick = (event) => {
        // Prevent click if clicking an easter egg inside
        if (event.target.closest('.easter-egg-trigger')) return;
        selectLandmark(landmark);
      };

      el.onkeydown = (event) => {
        let nextIndex = index;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          nextIndex = (index + 1) % WORLD_MAP_LANDMARKS.length;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          nextIndex = (index - 1 + WORLD_MAP_LANDMARKS.length) % WORLD_MAP_LANDMARKS.length;
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectLandmark(landmark);
          return;
        } else {
          return;
        }

        const nextLandmark = WORLD_MAP_LANDMARKS[nextIndex];
        selectLandmark(nextLandmark, { center: true });
        $(`#landmark-${nextLandmark.id}`)?.focus();
      };

      // Keyboard focus must bring the realm into the camera window.
      el.onfocus = () => centerCameraOn(landmark);
    });
  }

  /**
   * Attaches easter egg tap triggers and unlocks souvenir stamps.
   */
  function attachEasterEggHandlers() {
    WORLD_MAP_LANDMARKS.forEach((landmark) => {
      const eggGroup = $(`#landmark-${landmark.id} .easter-egg-trigger`);
      if (!eggGroup) return;

      eggGroup.onclick = (event) => {
        event.stopPropagation();
        triggerEasterEgg(landmark, eggGroup);
      };

      eggGroup.onkeydown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          triggerEasterEgg(landmark, eggGroup);
        }
      };
    });
  }

  /**
   * Triggers micro-animation, sound, and souvenir stamp unlock.
   */
  function triggerEasterEgg(landmark, eggElement) {
    if (!landmark || !landmark.stampId) return;
    if (!isLandmarkUnlocked(landmark, getSettings())) return;

    // Trigger visual micro-animation across all matching particles in landmark
    const targetAnims = eggElement.querySelectorAll(
      '.smoke-puff, .hidden-kitten, .paint-splash, .owl-sprite, ' +
      '.flutter-butterfly, .bobbing-bottle, .curious-squirrel, ' +
      '.firefly, .snowflake-puff, .balloon-drift, .spinning-pinwheel'
    );
    targetAnims.forEach((targetAnim) => {
      targetAnim.classList.remove('is-triggered');
      if (prefersReducedMotion()) return;
      // SVG elements have no offsetWidth. Measure layout to restart the effect.
      targetAnim.getBoundingClientRect();
      targetAnim.onanimationend = (event) => {
        if (event.target === targetAnim) targetAnim.classList.remove('is-triggered');
      };
      targetAnim.classList.add('is-triggered');
    });

    // Play tactile sound per landmark biome/vibe
    if (landmark.id === 'cafe') {
      paperAudio.playPurr();
    } else if (landmark.id === 'bedroom' || landmark.id === 'snowy-village') {
      paperAudio.playPaperRustle();
    } else if (landmark.id === 'beach' || landmark.id === 'atelier' || landmark.id === 'city-sunset' || landmark.id === 'candy-land') {
      paperAudio.playPop();
    } else {
      paperAudio.playStampThud();
    }

    // Dispatch stamp unlock to store
    const result = store.dispatch({
      type: 'settings/unlockStamp',
      stampId: landmark.stampId
    });

    if (result?.ok) {
      paperAudio.playChime();
      renderMapHeader();
      renderPassportStamps(landmark.stampId);
      // A stamp can satisfy an unlock requirement, so re-evaluate the map.
      layoutLandmarks();

      const stamp = SOUVENIR_STAMPS.find((s) => s.id === landmark.stampId);
      const stampName = stamp ? t(stamp.nameKey, stamp.id) : landmark.stampId;
      store.dispatch({
        type: 'ui/message',
        message: t('worldMap.easterEggDiscovered', { name: stampName })
      });

      if (result.newlyUnlockedBackgrounds?.length) {
        store.dispatch({ type: 'ui/message', message: t('worldMap.unlockedNotice') });
      }
    }
    selectLandmark(landmark);
  }

  /**
   * Renders the souvenir stamps along the passport border strip.
   */
  function renderPassportStamps(justInkedStampId = null) {
    const list = $('#stamp-passport-list');
    if (!list) return;

    const collectedStamps = getSettings().stamps || [];
    list.replaceChildren();

    SOUVENIR_STAMPS.forEach((stamp) => {
      const isCollected = collectedStamps.includes(stamp.id);
      const item = document.createElement('div');
      item.setAttribute('role', 'listitem');
      item.className = 'souvenir-stamp-item';

      const slot = document.createElement(isCollected ? 'button' : 'div');
      if (isCollected) slot.type = 'button';
      slot.className = `souvenir-stamp-slot ${isCollected ? 'is-collected' : 'is-empty'}`;
      if (stamp.id === justInkedStampId) {
        slot.classList.add('just-inked');
      }

      const stampName = t(stamp.nameKey, stamp.id);
      const label = isCollected
        ? stampName
        : `${stampName} (${t('worldMap.lockedBadge')}) - ${t('worldMap.stampClueHint')}`;
      slot.title = label;
      slot.setAttribute('aria-label', label);
      slot.textContent = isCollected ? stamp.icon : '·';

      if (isCollected) {
        slot.addEventListener('click', () => {
          paperAudio.playStampThud();
          const landmark = getLandmarkById(stamp.landmarkId);
          if (landmark) {
            selectLandmark(landmark, { center: true });
            $(`#landmark-${landmark.id}`)?.focus();
          }
        });
      } else {
        slot.setAttribute('aria-hidden', 'false');
      }

      item.appendChild(slot);
      list.appendChild(item);
    });
  }

  // Internationalization change listener
  if (typeof window !== 'undefined') {
    window.addEventListener('languagechange', () => {
      syncHeaderPill();
      if (getDialog()?.open) {
        layoutLandmarks();
        renderMapHeader();
        renderPassportStamps();
        applyCameraZoom();
        const landmark = getLandmarkById(selectedLandmarkId) || WORLD_MAP_LANDMARKS[0];
        renderPreviewDock(landmark);
      }
    });
  }

  return {
    openWorldMapDialog,
    closeWorldMapDialog,
    syncHeaderPill
  };
}
