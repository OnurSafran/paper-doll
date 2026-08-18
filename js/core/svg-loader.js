import { getAsset } from './asset-catalog.js';

const templateCache = new Map();
const prohibitedSelector = [
  'script', 'style', 'foreignObject', 'iframe', 'object', 'embed', 'audio', 'video', 'image',
  'linearGradient', 'radialGradient', 'filter', 'animate', 'animateMotion', 'animateTransform', 'set'
].join(', ');
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

export async function loadAssetSvg(assetId) {
  const asset = getAsset(assetId);
  if (!asset) throw assetError('ASSET_UNKNOWN', `Unknown asset: ${assetId}`);
  if (!asset.path.startsWith('assets/') || /(?:^|\/)\.\.(?:\/|$)/.test(asset.path)) {
    throw assetError('ASSET_PATH', `Unsafe asset path: ${asset.path}`);
  }

  if (!templateCache.has(asset.id)) templateCache.set(asset.id, fetchAndParse(asset));
  try {
    const template = await templateCache.get(asset.id);
    return template.cloneNode(true);
  } catch (error) {
    templateCache.delete(asset.id);
    throw error;
  }
}

async function fetchAndParse(asset) {
  const response = await fetch(new URL(asset.path, document.baseURI), { credentials: 'same-origin' });
  if (!response.ok) throw assetError('ASSET_FETCH', `${asset.name} could not be loaded.`);
  const text = await response.text();
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw assetError('ASSET_XML', `${asset.name} contains unsupported XML declarations.`);
  const documentNode = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (documentNode.querySelector('parsererror')) throw assetError('ASSET_PARSE', `${asset.name} is not valid SVG.`);
  const svg = documentNode.documentElement;
  validateSvg(svg, asset);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('asset-svg');
  return document.importNode(svg, true);
}

export function validateSvg(svg, asset) {
  if (svg.localName !== 'svg') throw assetError('ASSET_ROOT', 'Asset root must be SVG.');
  if (svg.querySelector(prohibitedSelector)) throw assetError('ASSET_UNSAFE_ELEMENT', `${asset.name} contains a prohibited element.`);

  const expectedViewBox = asset.viewBox.join(' ');
  const actualViewBox = svg.getAttribute('viewBox')?.trim().replace(/\s+/g, ' ');
  if (actualViewBox !== expectedViewBox) throw assetError('ASSET_VIEWBOX', `${asset.name} has the wrong viewBox.`);
  if (svg.dataset.assetId !== asset.id) throw assetError('ASSET_ID', `${asset.name} has a mismatched asset ID.`);

  const escapeCss = globalThis.CSS?.escape ?? ((str) => String(str).replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1'));
  for (const groupId of asset.requiredGroups ?? []) {
    if (!svg.querySelector(`#${escapeCss(groupId)}`)) throw assetError('ASSET_GROUP', `${asset.name} is missing #${groupId}.`);
  }

  for (const element of [svg, ...svg.querySelectorAll('*')]) {
    if (element.namespaceURI !== SVG_NAMESPACE) throw assetError('ASSET_NAMESPACE', `${asset.name} contains an unexpected namespace.`);
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith('xmlns:')) throw assetError('ASSET_NAMESPACE', `${asset.name} contains an unexpected namespace.`);
      if (name.startsWith('on')) throw assetError('ASSET_EVENT', `${asset.name} contains an event handler.`);
      if ((name === 'href' || name === 'xlink:href') && value && !value.startsWith('#')) {
        throw assetError('ASSET_REFERENCE', `${asset.name} contains an external reference.`);
      }
      if (/url\((?!\s*['"]?#)/i.test(value) || /@import/i.test(value) || /^data:/i.test(value)) {
        throw assetError('ASSET_REFERENCE', `${asset.name} contains an unsafe reference.`);
      }
    }
  }
}

export function makeAssetPlaceholder(label) {
  const node = document.createElement('div');
  node.className = 'asset-placeholder';
  node.textContent = label;
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', t('assets.unavailable', { name: label }));
  return node;
}

function assetError(code, message) {
  return Object.assign(new Error(message), { code });
}
import { t } from './i18n.js';
