/** Background picker and asset spawning trays. */
import { PROP_COLLECTIONS } from '../../core/asset-catalog.js';
import { renderAssetPreview } from '../designer/designer-view.js';
import { createBubbleSvg } from '../../core/bubble-svg.js';
import { assetName, getCurrentLanguage, t } from '../../core/i18n.js';
import { getLandmarkByBackgroundId } from '../../domain/world-map-catalog.js';

export function createTraySpawnerView(context) {
  let spawnTab = 'props';

  let propCollection = 'home';

  let spawnTraySignature = null;

  let lastRenderedBgId = null;

  function renderBackgroundSelect(state) {
    const currentBgId = state.currentScene.backgroundId;
    const select = context.$('#background-select');
    if (select) {
      const offered = context.getAssetsByKind('background');
      const current = context.getAsset(currentBgId);
      const backgrounds = current && !offered.some((asset) => asset.id === currentBgId) ? [current, ...offered] : offered;
      select.replaceChildren(...backgrounds.map((asset) =>
        new Option(assetName(asset, asset.name), asset.id, false, asset.id === currentBgId)
      ));
    }

    const currentLocName = context.$('#current-location-name');
    if (currentLocName) {
      const landmark = getLandmarkByBackgroundId(currentBgId);
      const asset = context.getAsset(currentBgId);
      currentLocName.textContent = landmark
        ? t(landmark.nameKey, assetName(asset, asset?.name || 'Oda'))
        : assetName(asset, asset?.name || 'Oda');
    }

    if (lastRenderedBgId !== null && lastRenderedBgId !== currentBgId) {
      triggerPageFlip();
    }
    lastRenderedBgId = currentBgId;
  }

  function triggerPageFlip() {
    const stage = context.$('#play-stage');
    if (!stage) return;
    stage.classList.remove('is-page-flipping');
    void stage.offsetWidth;
    stage.classList.add('is-page-flipping');
    setTimeout(() => stage.classList.remove('is-page-flipping'), 450);
  }

  const BUBBLE_PRESETS = [
    { style: 'speech', nameKey: 'play.bubblePresetSpeechName', textKey: 'play.bubblePresetSpeechText', descKey: 'play.bubblePresetSpeechDesc' },
    { style: 'thought', nameKey: 'play.bubblePresetThoughtName', textKey: 'play.bubblePresetThoughtText', descKey: 'play.bubblePresetThoughtDesc' },
    { style: 'shout', nameKey: 'play.bubblePresetShoutName', textKey: 'play.bubblePresetShoutText', descKey: 'play.bubblePresetShoutDesc' },
    { style: 'caption', nameKey: 'play.bubblePresetCaptionName', textKey: 'play.bubblePresetCaptionText', descKey: 'play.bubblePresetCaptionDesc' }
  ];

  function renderSpawnTray(state, token) {
    const tabs = context.$('#spawn-tabs');
    const collectionTabs = context.$('#spawn-collection-tabs');
    const packFilter = context.$('#play-pack-filter');
    const dollActions = context.$('#play-doll-actions');
    const list = context.$('#spawn-items');
    if (!tabs || !list) return;

    const traySignature = JSON.stringify({
      packFilter: state.ui.packFilter,
      hiddenPacks: state.settings?.hiddenPacks,
      language: getCurrentLanguage(),
      tab: spawnTab,
      propCollection,
      presets: state.presets.map((preset) => [preset.presetId, preset.name, preset.updatedAt, preset.characterSnapshot]),
      customProps: (state.customAssets || [])
        .filter((asset) => asset.kind === 'prop')
        .map((asset) => [asset.assetId, asset.name, asset.status, asset.libraryVisible, asset.updatedAt, asset.collections])
    });
    if (traySignature === spawnTraySignature) return;
    spawnTraySignature = traySignature;

    if (packFilter) packFilter.hidden = spawnTab !== 'props';
    if (dollActions) dollActions.hidden = spawnTab !== 'characters';
    const focusedTabId = /** @type {HTMLElement} */ (document.activeElement?.closest?.('#spawn-tabs [role="tab"], #spawn-collection-tabs [role="tab"]'))?.id;
    tabs.replaceChildren(...[['props', t('play.trayPropsTab')], ['characters', t('play.trayDollsTab')], ['bubbles', t('play.trayBubblesTab')]].map(([id, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.role = 'tab';
      button.id = `spawn-tab-${id}`;
      button.setAttribute('aria-controls', 'spawn-items');
      button.setAttribute('aria-selected', String(spawnTab === id));
      button.tabIndex = spawnTab === id ? 0 : -1;
      button.textContent = label;
      button.addEventListener('click', () => { spawnTab = id; void context.render(); });
      return button;
    }));
    if (collectionTabs) {
      collectionTabs.hidden = spawnTab !== 'props';
      collectionTabs.replaceChildren(...(spawnTab === 'props' ? PROP_COLLECTIONS.map(({ id, labelKey }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.role = 'tab';
        button.id = `spawn-collection-tab-${id}`;
        button.setAttribute('aria-controls', 'spawn-items');
        button.setAttribute('aria-selected', String(propCollection === id));
        button.tabIndex = propCollection === id ? 0 : -1;
        button.textContent = t(labelKey);
        button.addEventListener('click', () => { propCollection = id; void context.render(); });
        return button;
      }) : []));
    }
    if (focusedTabId) requestAnimationFrame(() => {
      if (token === context.playRenderToken) context.$(`#${focusedTabId}`)?.focus();
    });

    list.setAttribute('aria-labelledby', spawnTab === 'props'
      ? `spawn-collection-tab-${propCollection}`
      : `spawn-tab-${spawnTab}`);
    if (spawnTab === 'characters' && !state.presets.length) {
      const empty = document.createElement('div');
      empty.className = 'tray-empty';
      empty.textContent = t('play.emptyDollsCopy');
      list.replaceChildren(empty);
      return;
    }

    if (spawnTab === 'bubbles') {
      list.replaceChildren(...BUBBLE_PRESETS.map((preset) => {
        const name = t(preset.nameKey);
        const defaultText = t(preset.textKey);
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'spawn-item spawn-bubble-card';
        card.draggable = true;
        card.setAttribute('aria-label', t('play.trayAddBubbleAria', { name }));
        const thumb = document.createElement('span');
        thumb.className = 'spawn-thumb spawn-bubble-thumb';
        thumb.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.className = 'spawn-name';
        label.textContent = name;
        const kindLabel = document.createElement('span');
        kindLabel.className = 'spawn-kind';
        kindLabel.textContent = t(preset.descKey);
        card.append(thumb, kindLabel, label);

        card.addEventListener('click', () => {
          const scene = context.store.getState().currentScene;
          context.store.dispatch({
            type: 'scene/spawnBubble',
            bubbleStyle: preset.style,
            text: defaultText,
            ...context.nextSpawnPoint(scene.entities.length, scene.cameraX)
          });
        });

        card.addEventListener('dragstart', (event) => {
          event.dataTransfer.effectAllowed = 'copy';
          event.dataTransfer.setData('text/plain', `paper-doll-spawn:bubble:${preset.style}:${encodeURIComponent(defaultText)}`);
          card.classList.add('is-dragging');
        });
        card.addEventListener('dragend', () => card.classList.remove('is-dragging'));

        const bubbleThumbSvg = createBubbleSvg({
          width: 140,
          text: defaultText,
          bubbleStyle: preset.style
        });
        thumb.replaceChildren(bubbleThumbSvg);
        return card;
      }));
      return;
    }

    const sources = spawnTab === 'characters'
      ? state.presets
      : context.getAssetsByKind('prop', { collectionId: propCollection });

    const cards = sources.map((source) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `spawn-item${source.custom ? ' is-custom-spawn-item' : ''}`;
      card.draggable = true;
      const thumb = document.createElement('span');
      thumb.className = 'spawn-thumb';
      thumb.setAttribute('aria-hidden', 'true');
      const kind = spawnTab === 'characters' ? 'character' : 'prop';
      const sourceId = kind === 'character' ? source.presetId : source.id;
      const sourceName = kind === 'character' ? source.name : assetName(source, source.name);
      const label = document.createElement('span');
      label.className = 'spawn-name';
      label.textContent = sourceName;
      const kindLabel = document.createElement('span');
      kindLabel.className = 'spawn-kind';
      kindLabel.textContent = spawnTab === 'characters' ? t('play.savedDoll') : source.supportSurfaces?.length ? t('placement.holdsProps') : source.placementRules?.allowedTargets.includes('surface') ? t('placement.smallProp') : (source.custom ? t('play.customPropBadge') : t('play.sceneProp'));
      card.append(thumb, kindLabel, label);
      card.setAttribute('aria-label', t('play.traySpawnAria', { name: sourceName, custom: source.custom ? t('play.customArtSuffix') : '' }));

      card.addEventListener('click', () => {
        const scene = context.store.getState().currentScene;
        const point = context.nextSpawnPoint(scene.entities.length, scene.cameraX);
        if (kind === 'character') {
          context.store.dispatch({ type: 'scene/spawnCharacter', presetId: source.presetId, ...point });
        } else {
          context.store.dispatch({ type: 'scene/spawnProp', assetId: source.id, ...point });
        }
      });

      card.addEventListener('dragstart', (event) => {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain', `paper-doll-spawn:${kind}:${sourceId}`);
        card.classList.add('is-dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('is-dragging'));

      if (spawnTab === 'characters') {
        // Each card owns its thumbnail; scene renders can reuse it while artwork loads.
        void context.renderDollInto(thumb, source, { customArtRepo: context.customArtRepo, getAsset: context.getAsset, enforceFit: false });
      } else {
        void renderAssetPreview(thumb, source, { customArtRepo: context.customArtRepo, getAsset: context.getAsset });
      }
      return card;
    });

    if (spawnTab === 'props') {
      const paintPropCard = document.createElement('button');
      paintPropCard.type = 'button';
      paintPropCard.className = 'button paint-prop-action-card';
      paintPropCard.setAttribute('aria-label', t('play.paintPropAria'));
      const icon = document.createElement('span');
      icon.className = 'paint-prop-action-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="m10.5 2.5 3 3M3 10l-1 4 4-1 7.5-7.5a2.1 2.1 0 0 0-3-3Z"/></svg>';
      const copy = document.createElement('span');
      copy.className = 'paint-prop-action-copy';
      const label = document.createElement('strong');
      label.textContent = t('play.paintPropShort');
      paintPropCard.title = t('play.paintPropAria');
      copy.append(label);
      paintPropCard.append(icon, copy);
      paintPropCard.addEventListener('click', () => {
        if (context.openPaintStudio) {
          context.openPaintStudio({
            itemType: 'prop',
            originContext: 'play'
          });
        } else {
          window.location.hash = '#paint';
        }
      });
      if (packFilter) {
        packFilter.querySelector('.paint-prop-action-card')?.remove();
        packFilter.prepend(paintPropCard);
      }
      if (!sources.length) {
        const empty = document.createElement('p');
        empty.className = 'tray-empty';
        empty.textContent = t('play.noPropsInFilter');
        cards.push(empty);
      }
    }

    list.replaceChildren(...cards);
  }

  return { renderBackgroundSelect, triggerPageFlip, renderSpawnTray };
}
