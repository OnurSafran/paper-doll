import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetRegistry, customAssetToDescriptor } from '../js/core/asset-registry.js';
import { getAsset } from '../js/core/asset-catalog.js';

test('customAssetToDescriptor produces valid descriptor for wearable and prop', () => {
  const wearableMeta = {
    assetId: 'custom_top_sparkle',
    name: 'Sparkle Top',
    kind: 'wearable',
    slot: 'top',
    logicalWidth: 300,
    logicalHeight: 450,
    pixelWidth: 600,
    pixelHeight: 900,
    sha256: 'abcdef123456',
    libraryVisible: true,
    status: 'available'
  };

  const wearableDesc = customAssetToDescriptor(wearableMeta);
  assert.ok(wearableDesc);
  assert.equal(wearableDesc.id, 'custom_top_sparkle');
  assert.equal(wearableDesc.kind, 'wearable');
  assert.equal(wearableDesc.slot, 'top');
  assert.equal(wearableDesc.custom, true);
  assert.equal(wearableDesc.tintable, false);
  assert.deepEqual(wearableDesc.viewBox, [0, 0, 300, 450]);

  const propMeta = {
    assetId: 'custom_prop_lamp',
    name: 'Studio Lamp',
    kind: 'prop',
    displayWidth: 220,
    displayHeight: 280,
    groundAnchor: { x: 0.5, y: 1.0 },
    sha256: 'fedcba654321',
    libraryVisible: true,
    status: 'available'
  };

  const propDesc = customAssetToDescriptor(propMeta);
  assert.ok(propDesc);
  assert.equal(propDesc.id, 'custom_prop_lamp');
  assert.equal(propDesc.kind, 'prop');
  assert.equal(propDesc.custom, true);
  assert.equal(propDesc.displayWidth, 220);
  assert.equal(propDesc.displayHeight, 280);
});

test('createAssetRegistry unifies built-in catalog and custom assets', () => {
  const customAssets = [
    {
      assetId: 'custom_top_1',
      name: 'Custom Top 1',
      kind: 'wearable',
      slot: 'top',
      libraryVisible: true,
      status: 'available'
    },
    {
      assetId: 'custom_top_hidden',
      name: 'Hidden Top',
      kind: 'wearable',
      slot: 'top',
      libraryVisible: false,
      status: 'available'
    },
    {
      assetId: 'custom_prop_tree',
      name: 'Magic Tree',
      kind: 'prop',
      libraryVisible: true,
      status: 'available'
    }
  ];

  const registry = createAssetRegistry(customAssets);

  // 1. Built-in lookup
  const builtinDoll = registry.getAsset('doll_classic_a');
  assert.ok(builtinDoll);
  assert.equal(builtinDoll.kind, 'doll');
  assert.equal(registry.isCustom('doll_classic_a'), false);

  // 2. Custom lookup
  const customTop = registry.getAsset('custom_top_1');
  assert.ok(customTop);
  assert.equal(customTop.name, 'Custom Top 1');
  assert.equal(customTop.custom, true);
  assert.equal(registry.isCustom('custom_top_1'), true);

  // 3. wearablesBySlot respects visibility filter
  const visibleTops = registry.wearablesBySlot('top');
  assert.ok(visibleTops.some((t) => t.id === 'top_tshirt')); // built-in
  assert.ok(visibleTops.some((t) => t.id === 'custom_top_1')); // custom
  assert.equal(visibleTops.some((t) => t.id === 'custom_top_hidden'), false); // hidden excluded

  const allTops = registry.wearablesBySlot('top', { includeHidden: true });
  assert.ok(allTops.some((t) => t.id === 'custom_top_hidden'));

  // 4. Props
  const props = registry.assetsByKind('prop');
  assert.ok(props.some((p) => p.id === 'custom_prop_tree'));
  assert.ok(props.some((p) => p.id === 'prop_chair'));
});
