/** Trusted cutout selection and cancellable raster imports. */
import { t } from '../../core/i18n.js';
import { captureHistorySnapshot, historySnapshotChanged, restoreHistorySnapshot } from './paint-history.js';

export function createPaintCutoutController(context) {
  let activeCutoutUrl = null;

  const cutoutGrid = /** @type {HTMLElement} */ (context.rootElement.querySelector('#paint-cutout-grid'));

  const cutoutStatus = /** @type {HTMLElement} */ (context.rootElement.querySelector('#paint-cutout-status'));

  async function loadCutoutsForSlot(slot) {
    if (!cutoutGrid) return;
    cutoutGrid.replaceChildren();
    cancelCutoutAction();
    const requestedCutoutId = context.session.getState().cutoutAssetId;
    const selectedCutoutId = getTrustedCutout(requestedCutoutId, slot) ? requestedCutoutId : null;
    context.session.setCutoutAssetId(selectedCutoutId);
    updateCutoutActions();

    if (context.session.getState().itemType !== 'wearable') return;

    const slotAssets = context.assetRegistry?.wearablesBySlot
      ? context.assetRegistry.wearablesBySlot(slot)
      : (context.assetRegistry?.getCategoryAssets?.('wardrobe', slot) || []);
    const approvedCutouts = slotAssets
      .filter((asset) => asset && asset.kind === 'wearable' && asset.slot === slot && !asset.custom)
      .slice(0, 8);

    if (approvedCutouts.length === 0) {
      setCutoutStatus(t('paint.noCutoutsAvailable'));
      return;
    }

    setCutoutStatus(selectedCutoutId ? t('paint.cutoutSelectedHelp') : t('paint.cutoutHelpStatus'));

    // Dedicated None card
    const noneCard = document.createElement('button');
    noneCard.type = 'button';
    noneCard.className = 'cutout-card cutout-none-card';
    noneCard.dataset.assetId = '';
    noneCard.setAttribute('role', 'option');
    noneCard.setAttribute('aria-selected', String(!selectedCutoutId));
    noneCard.classList.toggle('active', !selectedCutoutId);
    noneCard.title = t('paint.noneCutoutTitle');
    noneCard.setAttribute('aria-label', t('paint.noneCutoutTitle'));
    const noneIcon = document.createElement('span');
    noneIcon.className = 'cutout-none-icon';
    noneIcon.setAttribute('aria-hidden', 'true');
    noneIcon.textContent = '🚫';
    noneCard.appendChild(noneIcon);
    noneCard.addEventListener('click', () => {
      cancelCutoutAction();
      context.session.setCutoutAssetId(null);
      cutoutGrid.querySelectorAll('.cutout-card').forEach((c) => {
        c.classList.toggle('active', c === noneCard);
        c.setAttribute('aria-selected', String(c === noneCard));
      });
      updateCutoutActions();
      context.renderGuideLayer();
      context.saveService.checkpointReferencePreferences();
      setCutoutStatus(t('paint.cutoutUnselected'));
      context.announceStatus(t('paint.cutoutUnselected'));
    });
    cutoutGrid.appendChild(noneCard);

    approvedCutouts.forEach((asset) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'cutout-card';
      card.dataset.assetId = asset.id;
      card.setAttribute('role', 'option');
      card.setAttribute('aria-selected', String(asset.id === selectedCutoutId));
      card.classList.toggle('active', asset.id === selectedCutoutId);
      card.title = asset.name || asset.id;
      if (context.svgLoader?.load) {
        context.svgLoader.load(asset.id).then((svg) => {
          if (svg) {
            const clone = svg.cloneNode(true);
            clone.setAttribute('width', '100%');
            clone.setAttribute('height', '100%');
            clone.setAttribute('aria-hidden', 'true');
            card.replaceChildren(clone);
            context.fitCutoutSvg(clone, slot);
            requestAnimationFrame(() => context.fitCutoutSvg(clone, slot));
          }
        }).catch(() => {
          if (asset.path) {
            const image = document.createElement('img');
            image.src = asset.path;
            image.alt = '';
            image.setAttribute('aria-hidden', 'true');
            card.replaceChildren(image);
          }
        });
      } else if (asset.path) {
        const image = document.createElement('img');
        image.src = asset.path;
        image.alt = '';
        image.setAttribute('aria-hidden', 'true');
        card.appendChild(image);
      } else {
        const icon = document.createElement('span');
        icon.className = 'cutout-fallback-icon';
        icon.textContent = '✂️';
        icon.setAttribute('aria-hidden', 'true');
        card.appendChild(icon);
      }

      card.addEventListener('click', () => {
        cancelCutoutAction();
        const isCurrentlySelected = context.session.getState().cutoutAssetId === asset.id;
        if (isCurrentlySelected) {
          // Unselect on re-clicking the active card
          context.session.setCutoutAssetId(null);
          cutoutGrid.querySelectorAll('.cutout-card').forEach((c) => {
            c.classList.toggle('active', c === noneCard);
            c.setAttribute('aria-selected', String(c === noneCard));
          });
          updateCutoutActions();
          context.renderGuideLayer();
          context.saveService.checkpointReferencePreferences();
          setCutoutStatus(t('paint.cutoutUnselected'));
          context.announceStatus(t('paint.cutoutUnselected'));
          return;
        }

        cutoutGrid.querySelectorAll('.cutout-card').forEach((c) => {
          const active = c === card;
          c.classList.toggle('active', active);
          c.setAttribute('aria-selected', String(active));
        });
        context.session.setCutoutAssetId(asset.id);
        context.session.setCutoutReferenceVisible(true);
        if (context.cutoutReferenceVisible) context.cutoutReferenceVisible.checked = true;
        updateCutoutActions();
        context.renderGuideLayer();
        context.saveService.checkpointReferencePreferences();
        setCutoutStatus(t('paint.cutoutSelectedStatus', { name: asset.name || asset.id }));
        context.announceStatus(t('paint.cutoutSelectedAnnounce', { name: asset.name || asset.id }));
      });

      cutoutGrid.appendChild(card);
    });
    if (selectedCutoutId) {
      const selected = getTrustedCutout(selectedCutoutId, slot);
      setCutoutStatus(t('paint.cutoutRestoredStatus', { name: selected?.name || selectedCutoutId }));
    }
  }

  function setCutoutStatus(message) {
    if (cutoutStatus) cutoutStatus.textContent = message;
  }

  function cancelCutoutAction() {
    context.cutoutActionToken += 1;
    context.cutoutActionPending = false;
    if (activeCutoutUrl) {
      URL.revokeObjectURL(activeCutoutUrl);
      activeCutoutUrl = null;
    }
    updateCutoutActions();
  }

  function updateCutoutActions() {
    const enabled = Boolean(context.session.getState().cutoutAssetId) && !context.cutoutActionPending;
    if (context.cutoutAddBtn) context.cutoutAddBtn.disabled = !enabled;
    if (context.cutoutReplaceBtn) context.cutoutReplaceBtn.disabled = !enabled;
  }

  function getTrustedCutout(assetId, slot = context.session.getState().slot) {
    const asset = context.assetRegistry?.getAsset?.(assetId);
    return context.isTrustedCutoutDescriptor(asset, slot) ? asset : null;
  }

  function canvasHasPixels() {
    const pixels = context.ctx.getImageData(0, 0, context.canvas.width, context.canvas.height).data;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] !== 0) return true;
    }
    return false;
  }

  async function rasterizeCutoutIntoCanvas(assetId, mode = 'add') {
    if (!context.svgLoader || !assetId || context.cutoutActionPending) return false;
    const initialState = context.session.getState();
    const initialAsset = getTrustedCutout(assetId, initialState.slot);
    if (!initialAsset) {
      setCutoutStatus(t('paint.cutoutUnavailable'));
      return false;
    }
    if (mode === 'replace' && canvasHasPixels()) {
      const confirmed = await (context.askConfirm?.(
        t('paint.replaceCutoutTitle'),
        t('paint.replaceCutoutMessage')
      ) ?? true);
      if (!confirmed) {
        setCutoutStatus(t('paint.artworkKeptStatus'));
        return false;
      }
    }

    const requestSession = context.session;
    const requestSlot = initialState.slot;
    const requestToken = ++context.cutoutActionToken;
    let url = null;
    let before = null;
    context.cutoutActionPending = true;
    updateCutoutActions();
    setCutoutStatus(t('paint.loadingCutout', { name: initialAsset.name || assetId }));
    try {
      const svgElement = await context.svgLoader.load(assetId);
      if (!svgElement) throw new Error('Cutout SVG is unavailable.');

      const xml = new XMLSerializer().serializeToString(svgElement);
      const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      url = URL.createObjectURL(blob);
      activeCutoutUrl = url;
      const img = new Image();

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });

      if (requestToken !== context.cutoutActionToken || requestSession !== context.session ||
          context.session.getState().slot !== requestSlot || !getTrustedCutout(assetId, requestSlot)) {
        return false;
      }

      before = captureHistorySnapshot(context.ctx);
      if (mode === 'replace') context.ctx.clearRect(0, 0, context.canvas.width, context.canvas.height);
      context.ctx.drawImage(img, 0, 0, context.canvas.width, context.canvas.height);
      if (!historySnapshotChanged(context.ctx, before)) {
        setCutoutStatus(t('paint.cutoutNoChange'));
        return false;
      }
      context.session.pushHistory(before);
      context.updateHistoryButtons();
      context.updateUIFromState();
      context.updateLivePreview();
      context.saveService.scheduleDraftCheckpoint();
      setCutoutStatus(mode === 'replace' ? t('paint.cutoutReplaced', { name: initialAsset.name || assetId }) : t('paint.cutoutAdded', { name: initialAsset.name || assetId }));
      context.announceStatus(mode === 'replace' ? t('paint.cutoutReplaceDone') : t('paint.cutoutAddDone'));
      return true;
    } catch (err) {
      if (before) restoreHistorySnapshot(context.ctx, before);
      if (requestToken === context.cutoutActionToken) {
        console.warn('Could not rasterize cutout:', err);
        setCutoutStatus(t('paint.cutoutLoadError'));
      }
      return false;
    } finally {
      if (url) URL.revokeObjectURL(url);
      if (activeCutoutUrl === url) activeCutoutUrl = null;
      if (requestToken === context.cutoutActionToken) {
        context.cutoutActionPending = false;
        updateCutoutActions();
      }
    }
  }

  return { loadCutoutsForSlot, setCutoutStatus, cancelCutoutAction, updateCutoutActions, getTrustedCutout, canvasHasPixels, rasterizeCutoutIntoCanvas };
}
