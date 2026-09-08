/** Background picker and asset spawning trays. */
import { PROP_COLLECTIONS } from '../../core/asset-catalog.js';
import { renderAssetPreview } from '../designer/designer-view.js';
import { createBubbleSvg } from '../../core/bubble-svg.js';
import { assetName, getCurrentLanguage, t } from '../../core/i18n.js';
import { getLandmarkByBackgroundId } from '../../domain/world-map-catalog.js';

export function createTraySpawnerView(context) {
  let spawnTab = 'characters';

  let propCollection = 'home';

  let spawnTraySignature = null;

  let lastRenderedBgId = null;

  function renderBackgroundSelect(state) {
    const currentBgId = state.currentScene.backgroundId;
    const select = context.$('#background-select');
    if (select) {
      select.replaceChildren(...context.getAssetsByKind('background').map((asset) =>
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
    const list = context.$('#spawn-items');
    if (!tabs || !list) return;

    const traySignature = JSON.stringify({
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

    const focusedTabId = /** @type {HTMLElement} */ (document.activeElement?.closest?.('#spawn-tabs [role="tab"]'))?.id;
    tabs.replaceChildren(...[['characters', t('play.trayDollsTab')], ['props', t('play.trayPropsTab')], ['bubbles', t('play.trayBubblesTab')]].map(([id, label]) => {
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
      empty.innerHTML = `<p>${t('play.emptySceneCopy')}</p><a class="button secondary" href="#designer">${t('nav.designer')}</a>`;
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
          context.store.dispatch({
            type: 'scene/spawnBubble',
            bubbleStyle: preset.style,
            text: defaultText,
            ...context.nextSpawnPoint(state.currentScene.entities.length, state.currentScene.cameraX)
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
      kindLabel.textContent = spawnTab === 'characters' ? t('play.savedDoll') : (source.custom ? t('play.customPropBadge') : t('play.sceneProp'));
      card.append(thumb, kindLabel, label);
      card.setAttribute('aria-label', t('play.traySpawnAria', { name: sourceName, custom: source.custom ? t('play.customArtSuffix') : '' }));

      card.addEventListener('click', () => {
        if (spawnTab === 'characters') {
          context.store.dispatch({ type: 'scene/spawnCharacter', presetId: source.presetId, ...context.nextSpawnPoint(state.currentScene.entities.length, state.currentScene.cameraX) });
        } else {
          context.store.dispatch({ type: 'scene/spawnProp', assetId: source.id, ...context.nextSpawnPoint(state.currentScene.entities.length, state.currentScene.cameraX) });
        }
      });

      card.addEventListener('dragstart', (event) => {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain', `paper-doll-spawn:${kind}:${sourceId}`);
        card.classList.add('is-dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('is-dragging'));

      if (spawnTab === 'characters') {
        void context.renderDollInto(thumb, source, { customArtRepo: context.customArtRepo, getAsset: context.getAsset, enforceFit: false }).then(() => { if (token !== context.playRenderToken) thumb.replaceChildren(); });
      } else {
        void renderAssetPreview(thumb, source, { customArtRepo: context.customArtRepo, getAsset: context.getAsset });
      }
      return card;
    });

    if (spawnTab === 'props') {
      const paintPropCard = document.createElement('button');
      paintPropCard.type = 'button';
      paintPropCard.className = 'spawn-item paint-prop-action-card';
      paintPropCard.setAttribute('aria-label', t('play.paintPropAria'));
      const thumb = document.createElement('span');
      thumb.className = 'spawn-thumb';
      thumb.textContent = '🎨';
      const kindLabel = document.createElement('span');
      kindLabel.className = 'spawn-kind';
      kindLabel.textContent = t('play.customPropBadge');
      const label = document.createElement('span');
      label.className = 'spawn-name';
      label.textContent = t('play.paintPropCard');
      paintPropCard.append(thumb, kindLabel, label);
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
      cards.push(paintPropCard);
    }

    list.replaceChildren(...cards);
  }

  return { renderBackgroundSelect, triggerPageFlip, renderSpawnTray };
}
