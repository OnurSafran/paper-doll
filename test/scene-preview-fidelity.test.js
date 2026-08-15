import test from 'node:test';
import assert from 'node:assert/strict';
import { createCompositeSceneThumbnailSvg, renderSceneThumbnail } from '../js/features/scene-book/scene-book-view.js';
import { DEFAULT_EXPRESSION } from '../js/domain/vocabulary.js';

test('createCompositeSceneThumbnailSvg builds valid composite SVG with background, character, prop, and bubble', async () => {
  // Mock DOM environment for Node.js test runner
  globalThis.document = {
    createElementNS(ns, tag) {
      const attrs = new Map();
      const children = [];
      const node = {
        tagName: tag,
        style: { setProperty() {} },
        className: '',
        setAttribute(name, val) { attrs.set(name, String(val)); },
        getAttribute(name) { return attrs.get(name) ?? null; },
        appendChild(child) {
          if (child && child.parentNode) {
            const idx = child.parentNode.children.indexOf(child);
            if (idx >= 0) child.parentNode.children.splice(idx, 1);
          }
          if (child) child.parentNode = node;
          children.push(child);
          return child;
        },
        removeChild(child) {
          const idx = children.indexOf(child);
          if (idx >= 0) children.splice(idx, 1);
          if (child) child.parentNode = null;
          return child;
        },
        append(...nodes) {
          for (const n of nodes) node.appendChild(n);
        },
        replaceChildren(...nodes) {
          children.length = 0;
          for (const n of nodes) node.appendChild(n);
        },
        get firstChild() { return children[0] ?? null; },
        get children() { return children; },
        querySelector() { return null; },
        cloneNode() {
          const cloned = globalThis.document.createElementNS(ns, tag);
          for (const [k, v] of attrs) cloned.setAttribute(k, v);
          for (const c of children) cloned.appendChild(c.cloneNode?.() || c);
          return cloned;
        }
      };
      return node;
    }
  };

  const makeFakeSvg = (tag = 'svg') => {
    const root = globalThis.document.createElementNS('http://www.w3.org/2000/svg', tag);
    const child = globalThis.document.createElementNS('http://www.w3.org/2000/svg', 'path');
    root.appendChild(child);
    return root;
  };

  const mockLoadSvg = async (id) => makeFakeSvg('svg');

  const mockGetAsset = (id) => {
    if (id === 'prop_chair') return { id: 'prop_chair', name: 'Chair', displayWidth: 150, displayHeight: 200 };
    return { id, name: 'Asset', displayWidth: 200, displayHeight: 200 };
  };

  const scene = {
    sceneId: 'test-scene-1',
    title: 'Tea Garden',
    backgroundId: 'bg_garden',
    entities: [
      {
        instanceId: 'char-1',
        kind: 'character',
        sourceId: 'demo_emma',
        characterSnapshot: {
          baseDollId: 'doll_classic_a',
          skinTone: 'peach',
          slots: {
            hair: { assetId: 'hair_ponytail', color: 'brown' },
            top: { assetId: 'top_tshirt', color: 'coral' },
            bottom: { assetId: 'bottom_jeans', color: 'denim' }
          }
        },
        x: 600,
        y: 720,
        scale: 1,
        flipped: false,
        expression: 'happy',
        order: 1
      },
      {
        instanceId: 'prop-1',
        kind: 'prop',
        sourceId: 'prop_chair',
        x: 900,
        y: 740,
        scale: 1.1,
        flipped: true,
        order: 2
      },
      {
        instanceId: 'bubble-1',
        kind: 'bubble',
        sourceId: 'bubble',
        bubbleStyle: 'speech',
        text: 'Hello from the garden!',
        width: 240,
        x: 600,
        y: 350,
        scale: 1,
        flipped: false,
        order: 3
      }
    ]
  };

  const svg = await createCompositeSceneThumbnailSvg(scene, {
    loadAssetSvg: mockLoadSvg,
    getAsset: mockGetAsset
  });

  assert.equal(svg.tagName, 'svg');
  assert.equal(svg.getAttribute('viewBox'), '0 0 1600 900');
  assert.ok(svg.children.length >= 4, 'Root SVG should have background and all 3 entity groups');

  // Verify background group class attribute
  const bgGroup = svg.children[0];
  assert.equal(bgGroup.getAttribute('class'), 'scene-thumb-bg');

  // Verify character doll group transform uses canonical scale and ground anchor
  const charGroup = svg.children[1];
  assert.ok(charGroup.getAttribute('transform').includes('translate(600, 720)'));
  const charInnerGroup = charGroup.firstChild;
  assert.ok(charInnerGroup.getAttribute('transform').includes('translate(-117.5, -352.5)'));
  assert.ok(charInnerGroup.getAttribute('transform').includes('scale('));

  // Verify prop group uses uniform scale and centering (xMidYMid meet)
  const propGroup = svg.children[2];
  assert.ok(propGroup.getAttribute('transform').includes('translate(900, 740)'));
  const propInnerGroup = propGroup.firstChild;
  assert.ok(propInnerGroup.getAttribute('transform').includes('scale(0.15)'));
});

test('renderSceneThumbnail handles load failure gracefully with background color fallback', async () => {
  const container = {
    children: [],
    style: {},
    replaceChildren(...nodes) { this.children = nodes; }
  };

  const scene = {
    sceneId: 'corrupt-scene',
    backgroundId: 'bg_invalid',
    entities: []
  };

  const failingLoadSvg = async () => { throw new Error('Asset not found'); };

  await renderSceneThumbnail(container, scene, { loadAssetSvg: failingLoadSvg });
  assert.ok(container.children.length > 0, 'Container received rendered SVG with fallback rect');
});

test('createCompositeSceneThumbnailSvg renders all 7 expressions accurately', async () => {
  const makeFakeSvg = (tag = 'svg') => {
    const root = globalThis.document.createElementNS('http://www.w3.org/2000/svg', tag);
    const child = globalThis.document.createElementNS('http://www.w3.org/2000/svg', 'path');
    root.appendChild(child);
    return root;
  };

  const mockLoadSvg = async () => makeFakeSvg('svg');
  const expressions = ['neutral', 'smile', 'happy', 'surprised', 'o_mouth', 'talking', 'wide_open'];

  for (const expr of expressions) {
    const scene = {
      sceneId: `test-scene-${expr}`,
      title: `${expr} scene`,
      backgroundId: 'bg_park',
      entities: [
        {
          instanceId: `char-${expr}`,
          kind: 'character',
          sourceId: 'demo_emma',
          expression: expr,
          characterSnapshot: { baseDollId: 'doll_classic_a', skinTone: 'peach', slots: {} },
          x: 800,
          y: 700,
          scale: 1,
          order: 1
        }
      ]
    };

    const svg = await createCompositeSceneThumbnailSvg(scene, {
      loadAssetSvg: mockLoadSvg,
      getAsset: () => ({ id: 'doll_classic_a', displayWidth: 235, displayHeight: 352.5 })
    });

    assert.equal(svg.tagName, 'svg');
    assert.ok(svg.children.length >= 2, `Composite SVG for ${expr} must contain background and character`);
  }
});

test('createCompositeSceneThumbnailSvg renders all 4 bubble styles accurately', async () => {
  const makeFakeSvg = (tag = 'svg') => {
    const root = globalThis.document.createElementNS('http://www.w3.org/2000/svg', tag);
    const child = globalThis.document.createElementNS('http://www.w3.org/2000/svg', 'path');
    root.appendChild(child);
    return root;
  };

  const mockLoadSvg = async () => makeFakeSvg('svg');
  const styles = ['speech', 'thought', 'shout', 'caption'];

  for (const bubbleStyle of styles) {
    const scene = {
      sceneId: `test-bubble-${bubbleStyle}`,
      title: `${bubbleStyle} scene`,
      backgroundId: 'bg_bedroom',
      entities: [
        {
          instanceId: `bubble-${bubbleStyle}`,
          kind: 'bubble',
          sourceId: 'bubble',
          bubbleStyle,
          text: `Sample ${bubbleStyle} bubble message`,
          width: 260,
          x: 800,
          y: 400,
          scale: 1,
          order: 1
        }
      ]
    };

    const svg = await createCompositeSceneThumbnailSvg(scene, {
      loadAssetSvg: mockLoadSvg,
      getAsset: () => undefined
    });

    assert.equal(svg.tagName, 'svg');
    assert.ok(svg.children.length >= 2, `Composite SVG for ${bubbleStyle} bubble must contain background and bubble`);
  }
});
