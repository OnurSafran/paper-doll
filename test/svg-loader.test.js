import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSvg, makeAssetPlaceholder } from '../js/core/svg-loader.js';
import { getAsset } from '../js/core/asset-catalog.js';

// Minimal DOM mock for Node environment tests of validateSvg
function createMockElement(tag, attrs = {}, children = []) {
  const attributes = new Map(Object.entries(attrs));
  const classListSet = new Set((attrs.class || '').split(' ').filter(Boolean));
  return {
    localName: tag.toLowerCase(),
    namespaceURI: 'http://www.w3.org/2000/svg',
    dataset: {
      assetId: attrs['data-asset-id']
    },
    attributes: [...attributes.entries()].map(([name, value]) => ({ name, value })),
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute: (name, val) => attributes.set(name, String(val)),
    classList: {
      add: (c) => classListSet.add(c),
      contains: (c) => classListSet.has(c)
    },
    querySelector: (selector) => {
      // Check prohibited tags
      const prohibited = ['script', 'style', 'foreignObject', 'iframe', 'object', 'embed', 'audio', 'video', 'image', 'linearGradient', 'radialGradient', 'filter', 'animate', 'animateMotion', 'animateTransform', 'set'];
      for (const p of prohibited) {
        if (selector.includes(p) && children.some((c) => c.localName === p)) return {};
      }
      // Check group ID
      if (selector.startsWith('#')) {
        const id = selector.slice(1);
        return children.find((c) => c.getAttribute('id') === id) ?? null;
      }
      return null;
    },
    querySelectorAll: (selector) => {
      if (selector === '*') return children;
      return [];
    }
  };
}

test('validateSvg accepts valid catalog-matched SVG', () => {
  const asset = getAsset('top_tshirt');
  const group = createMockElement('g', { id: 'garment' });
  const svg = createMockElement('svg', {
    'data-asset-id': 'top_tshirt',
    viewBox: '0 0 300 450'
  }, [group]);

  assert.doesNotThrow(() => validateSvg(svg, asset));
});

test('validateSvg rejects root element that is not SVG', () => {
  const asset = getAsset('top_tshirt');
  const div = createMockElement('div', { 'data-asset-id': 'top_tshirt', viewBox: '0 0 300 450' });
  assert.throws(() => validateSvg(div, asset), /Asset root must be SVG/);
});

test('validateSvg rejects prohibited script/foreignObject elements', () => {
  const asset = getAsset('top_tshirt');
  const scriptEl = createMockElement('script', {});
  const svg = createMockElement('svg', {
    'data-asset-id': 'top_tshirt',
    viewBox: '0 0 300 450'
  }, [scriptEl]);

  assert.throws(() => validateSvg(svg, asset), /prohibited element/);
});

test('validateSvg rejects mismatched viewBox', () => {
  const asset = getAsset('top_tshirt');
  const group = createMockElement('g', { id: 'garment' });
  const svg = createMockElement('svg', {
    'data-asset-id': 'top_tshirt',
    viewBox: '0 0 100 100'
  }, [group]);

  assert.throws(() => validateSvg(svg, asset), /wrong viewBox/);
});

test('validateSvg rejects mismatched asset ID', () => {
  const asset = getAsset('top_tshirt');
  const group = createMockElement('g', { id: 'garment' });
  const svg = createMockElement('svg', {
    'data-asset-id': 'different_id',
    viewBox: '0 0 300 450'
  }, [group]);

  assert.throws(() => validateSvg(svg, asset), /mismatched asset ID/);
});

test('validateSvg rejects missing required groups', () => {
  const asset = getAsset('top_tshirt'); // requires #garment
  const svg = createMockElement('svg', {
    'data-asset-id': 'top_tshirt',
    viewBox: '0 0 300 450'
  }, []);

  assert.throws(() => validateSvg(svg, asset), /missing #garment/);
});

test('validateSvg rejects event-handler attributes and external href', () => {
  const asset = getAsset('top_tshirt');
  const badGroup = createMockElement('g', { id: 'garment', onclick: 'alert(1)' });
  const svg = createMockElement('svg', {
    'data-asset-id': 'top_tshirt',
    viewBox: '0 0 300 450'
  }, [badGroup]);

  assert.throws(() => validateSvg(svg, asset), /event handler/);
});

test('validateSvg rejects external URL references', () => {
  const asset = getAsset('top_tshirt');
  const badGroup = createMockElement('g', { id: 'garment', href: 'http://example.com' });
  const svg = createMockElement('svg', {
    'data-asset-id': 'top_tshirt',
    viewBox: '0 0 300 450'
  }, [badGroup]);

  assert.throws(() => validateSvg(svg, asset), /external reference/);
});
