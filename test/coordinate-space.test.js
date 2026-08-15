import test from 'node:test';
import assert from 'node:assert/strict';
import { clientToLogical, fitStage, logicalToClient } from '../js/core/coordinate-space.js';

test('wide containers letterbox horizontally', () => {
  const fit = fitStage(1800, 900);
  assert.equal(fit.scale, 1);
  assert.equal(fit.offsetX, 100);
  assert.equal(fit.offsetY, 0);
});

test('tall containers letterbox vertically', () => {
  const fit = fitStage(800, 900);
  assert.equal(fit.scale, 0.5);
  assert.equal(fit.height, 450);
  assert.equal(fit.offsetY, 225);
});

test('logical and client points round-trip', () => {
  const rect = { left: 100, top: 50, width: 800, height: 450 };
  const client = logicalToClient(1200, 600, rect);
  assert.deepEqual(client, { x: 700, y: 350 });
  assert.deepEqual(clientToLogical(client.x, client.y, rect), { x: 1200, y: 600 });
});
