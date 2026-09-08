import { getAsset } from './asset-catalog.js';
import { loadAssetSvg } from './svg-loader.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
let nextRegistryId = 0;

/** Stage-local symbols share built-in prop artwork, never mutable dolls or custom art. */
export function createPropSymbolRegistry({ getHost, loadSvg = loadAssetSvg, resolveAsset = getAsset }) {
  const prefix = `scene-props-${++nextRegistryId}`;
  const entries = new Map();
  let root = null;
  let defs = null;
  let nextSymbolId = 0;
  let destroyed = false;

  async function create(assetId) {
    const asset = resolveAsset(assetId);
    if (destroyed || !asset || asset.kind !== 'prop' || asset.custom) return null;
    const host = getHost();
    if (!host) return null;
    if (!root) {
      root = document.createElementNS(SVG_NS, 'svg');
      root.setAttribute('width', '0');
      root.setAttribute('height', '0');
      root.setAttribute('aria-hidden', 'true');
      root.setAttribute('focusable', 'false');
      root.style.position = 'absolute';
      root.style.pointerEvents = 'none';
      defs = document.createElementNS(SVG_NS, 'defs');
      root.append(defs);
      host.append(root);
    }
    if (!entries.has(assetId)) {
      const id = `${prefix}-${++nextSymbolId}`;
      const entry = { id, symbol: null, ready: null };
      entry.ready = loadSvg(assetId).then(svg => {
        if (destroyed || entries.get(assetId) !== entry) return null;
        // Namespace every internal ID and local reference to avoid collisions with clones elsewhere.
        const ids = new Map();
        for (const node of [svg, ...svg.querySelectorAll('[id]')]) {
          const oldId = node.getAttribute('id');
          if (oldId) { ids.set(oldId, `${id}-${ids.size}`); node.setAttribute('id', ids.get(oldId)); }
        }
        for (const node of [svg, ...svg.querySelectorAll('*')]) {
          for (const attr of [...node.attributes]) {
            let value = attr.value.replace(/url\(\s*(['"]?)#([^)'"\s]+)\1\s*\)/g,
              (match, _quote, ref) => ids.has(ref) ? `url(#${ids.get(ref)})` : match);
            if ((attr.name === 'href' || attr.name === 'xlink:href') && ids.has(value.slice(1))) value = `#${ids.get(value.slice(1))}`;
            if (value !== attr.value) node.setAttribute(attr.name, value);
          }
        }
        const symbol = document.createElementNS(SVG_NS, 'symbol');
        symbol.setAttribute('id', id);
        symbol.setAttribute('viewBox', svg.getAttribute('viewBox'));
        // Keeping the SVG root preserves its inherited fills, strokes, and aspect ratio.
        symbol.append(svg);
        defs.append(symbol);
        entry.symbol = symbol;
        return symbol;
      }).catch(error => {
        if (entries.get(assetId) === entry) entries.delete(assetId);
        throw error;
      });
      entries.set(assetId, entry);
    }
    const entry = entries.get(assetId);
    if (!await entry.ready || destroyed) return null;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', asset.viewBox.join(' '));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('data-asset-id', assetId);
    svg.classList.add('asset-svg');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', `#${entry.id}`);
    svg.append(use);
    return svg;
  }

  function retain(assetIds) {
    const active = new Set(assetIds);
    for (const [assetId, entry] of entries) {
      if (!active.has(assetId)) {
        entry.symbol?.remove();
        entries.delete(assetId);
      }
    }
  }

  function destroy() {
    destroyed = true;
    entries.clear();
    root?.remove();
    root = defs = null;
  }

  return { create, retain, destroy };
}
