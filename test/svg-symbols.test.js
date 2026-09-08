import test from 'node:test';
import assert from 'node:assert/strict';
import { createPropSymbolRegistry } from '../js/core/svg-symbols.js';

class SvgNode {
  constructor(name) { this.localName = name; this.children = []; this.attrs = new Map(); this.style = {}; this.classList = { add() {} }; }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
  append(node) { this.children.push(node); node.parent = this; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
  querySelectorAll(selector) {
    const nodes = this.children.flatMap(node => [node, ...node.querySelectorAll('*')]);
    return selector === '[id]' ? nodes.filter(node => node.getAttribute('id')) : nodes;
  }
}
function artwork() {
  const svg = new SvgNode('svg'); svg.setAttribute('viewBox', '0 0 100 100');
  const shape = new SvgNode('path'); shape.setAttribute('id', 'shape');
  const use = new SvgNode('use'); use.setAttribute('href', '#shape'); use.setAttribute('clip-path', 'url(#shape)');
  svg.append(shape); svg.append(use);
  return svg;
}
const asset = { id: 'prop', kind: 'prop', viewBox: [0, 0, 100, 100] };

test('duplicate props share one symbol, scope local references, and prune unused artwork', async () => {
  const previous = globalThis.document;
  globalThis.document = { createElementNS: (_, tag) => new SvgNode(tag) };
  try {
    const host = new SvgNode('div');
    let loads = 0;
    const registry = createPropSymbolRegistry({ getHost: () => host, resolveAsset: () => asset, loadSvg: async () => { loads++; return artwork(); } });
    const instances = await Promise.all(Array.from({ length: 20 }, () => registry.create('prop')));
    assert.equal(loads, 1);
    const symbol = host.children[0].children[0].children[0];
    assert.equal(symbol.localName, 'symbol');
    const [shape, use] = symbol.children[0].children;
    assert.notEqual(shape.getAttribute('id'), 'shape');
    assert.equal(use.getAttribute('href'), `#${shape.getAttribute('id')}`);
    assert.equal(use.getAttribute('clip-path'), `url(#${shape.getAttribute('id')})`);
    for (const instance of instances) {
      assert.equal(instance.children.length, 1);
      assert.equal(instance.children[0].getAttribute('href'), `#${symbol.getAttribute('id')}`);
    }
    registry.retain(['prop']);
    assert.equal(host.children[0].children[0].children.length, 1);
    registry.retain([]);
    assert.equal(host.children[0].children[0].children.length, 0);
    registry.destroy();
    assert.equal(host.children.length, 0);
  } finally { globalThis.document = previous; }
});

test('symbol registries exclude mutable assets, have unique IDs, retry failures, and reject late completions', async () => {
  const previous = globalThis.document;
  globalThis.document = { createElementNS: (_, tag) => new SvgNode(tag) };
  try {
    const host = new SvgNode('div');
    const options = { getHost: () => host, resolveAsset: () => asset, loadSvg: async () => artwork() };
    const first = createPropSymbolRegistry(options), second = createPropSymbolRegistry(options);
    assert.notEqual((await first.create('prop')).children[0].getAttribute('href'), (await second.create('prop')).children[0].getAttribute('href'));
    for (const excluded of [{ ...asset, custom: true }, { ...asset, kind: 'wearable' }, null]) {
      const registry = createPropSymbolRegistry({ ...options, resolveAsset: () => excluded });
      assert.equal(await registry.create('prop'), null);
    }
    let attempts = 0;
    const retry = createPropSymbolRegistry({ ...options, loadSvg: async () => { if (++attempts === 1) throw new Error('offline'); return artwork(); } });
    await assert.rejects(retry.create('prop'), /offline/);
    assert.ok(await retry.create('prop'));
    let finish;
    const late = createPropSymbolRegistry({ ...options, loadSvg: () => new Promise(resolve => { finish = resolve; }) });
    const pending = late.create('prop');
    late.destroy(); finish(artwork());
    assert.equal(await pending, null);
    assert.equal(await late.create('prop'), null);
    first.destroy(); second.destroy(); retry.destroy();
    assert.equal(host.children.length, 0);
  } finally { globalThis.document = previous; }
});
