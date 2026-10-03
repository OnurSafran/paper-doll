// Run with Playwright (or PLAYWRIGHT_MODULE pointing to an existing installation).
// Uses isolated browser storage; saved user scenes are never changed.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createDefaultEnvelope, STORAGE_KEY } from '../js/core/state-schema.js';
import { createEmptyScene, addEntity } from '../js/domain/scene-rules.js';
import { createStarterDraft } from '../js/domain/outfit-rules.js';
import { getAsset } from '../js/core/asset-catalog.js';

const root = resolve(import.meta.dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!path.startsWith(root + '/')) { res.writeHead(403).end(); return; }
  try { res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream'); res.end(await readFile(path)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const envelope = createDefaultEnvelope();
let scene = createEmptyScene('outline-test');
for (const entity of [
  { instanceId: 'table', kind: 'prop', sourceId: 'prop_table', x: 500, y: 800, pinned: true },
  { instanceId: 'chair', kind: 'prop', sourceId: 'prop_chair', x: 800, y: 800 },
  { instanceId: 'doll', kind: 'character', sourceId: 'demo_emma', characterSnapshot: createStarterDraft(), x: 1000, y: 800 },
  { instanceId: 'bubble', kind: 'bubble', bubbleStyle: 'thought', text: 'Hello', width: 240, x: 1000, y: 200 },
  { instanceId: 'bicycle', kind: 'prop', sourceId: 'prop_bicycle', x: 1200, y: 800 }
]) scene = addEntity(scene, entity, getAsset);
envelope.currentScene = scene;
let browser;
const errors = [];
try {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 375, height: 812 }]) {
    const touch = viewport.width === 375;
    const context = await browser.newContext({ viewport, hasTouch: touch, serviceWorkers: 'block' });
    const page = await context.newPage();
    await context.addInitScript(({ key, envelope }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(envelope));
    }, { key: STORAGE_KEY, envelope });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/#play`);
    // Every stage control must be what a pointer actually lands on at its centre,
    // fully on screen, and (on touch) at least 44px: an overlapped control passes
    // keyboard checks while being untappable.
    const unreachable = await page.evaluate(({ touch }) => [...document.querySelectorAll('.play-stage-controls button, .play-stage-controls select')]
      .filter(el => el.getBoundingClientRect().width > 0)
      .flatMap(el => {
        const rect = el.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        const problems = [];
        if (!(hit === el || el.contains(hit))) problems.push(`covered by ${hit?.id || hit?.className || hit?.tagName}`);
        if (rect.left < -0.5 || rect.right > window.innerWidth + 0.5) problems.push('off screen');
        if (touch && (rect.width < 43.5 || rect.height < 43.5)) problems.push(`${Math.round(rect.width)}x${Math.round(rect.height)} touch target`);
        return problems.length ? [`${el.id || el.dataset.playbackRate}: ${problems.join(', ')}`] : [];
      }), { touch });
    assert.deepEqual(unreachable, [], `stage controls reachable by pointer at ${viewport.width}px`);
    async function openOutline() {
      if (touch) await page.locator('#scene-outline-btn').tap();
      else await page.locator('#scene-outline-btn').click();
    }
    await openOutline();
    const rows = page.locator('#scene-outline-list .outline-row');
    await rows.first().locator('.outline-thumbnail svg').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.outline-thumbnail > svg').length === 5);
    const ids = () => rows.evaluateAll(rows => rows.map(row => row.dataset.instanceId));
    const original = await ids();
    assert.deepEqual(original, ['bicycle', 'bubble', 'doll', 'chair', 'table']);
    assert.equal(await page.locator('#scene-outline-dialog input[type="checkbox"], .outline-icon, .outline-bulk-actions').count(), 0);
    assert.equal(await rows.first().locator('[data-action="forward"]').isDisabled(), true);
    assert.equal(await rows.last().locator('[data-action="backward"]').isDisabled(), true);
    assert.equal(await rows.locator('[data-action="delete"] svg').count(), 5);
    assert.equal(await rows.locator('.outline-actions button').count(), 20);
    assert.equal(await page.locator('#scene-outline-dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth), true);
    assert.equal(await rows.locator('.outline-thumbnail').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().height > 0 && node.firstElementChild.getBoundingClientRect().width > 0)), true);

    async function dragFirstToBottom(cancel = false) {
      const handle = await rows.first().locator('.outline-drag-handle').boundingBox();
      const target = await rows.last().boundingBox();
      const start = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };
      const endY = target.y + target.height - 4;
      if (touch) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x, y: endY }] });
        await cdp.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
        await cdp.detach();
      } else {
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x, endY, { steps: 10 });
        if (cancel) await page.locator('.outline-drag-handle').evaluateAll(handles => {
          const active = handles.find(handle => handle.hasPointerCapture(1));
          active.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }));
        });
        await page.mouse.up();
      }
    }
    await dragFirstToBottom(true);
    assert.deepEqual(await ids(), original, 'cancel restores the original list');
    await dragFirstToBottom();
    const dropped = [...original.slice(1), original[0]];
    assert.deepEqual(await ids(), dropped, `${touch ? 'touch' : 'mouse'} drop moves through multiple rows`);
    assert.equal(await page.locator('.outline-list.is-reordering, .outline-row.is-dragging').count(), 0);
    await page.locator('#close-scene-outline').click();
    await page.keyboard.press('ControlOrMeta+z');
    await openOutline();
    assert.deepEqual(await ids(), original, 'one undo restores the whole drop');
    await rows.nth(1).locator('.outline-drag-handle').focus();
    await page.keyboard.press('ArrowUp');
    assert.deepEqual(await ids(), ['bubble', 'bicycle', 'doll', 'chair', 'table']);
    await page.waitForFunction(() => document.activeElement?.dataset.action === 'reorder');
    assert.equal(await page.evaluate(() => document.activeElement.closest('.outline-row').dataset.instanceId), 'bubble');
    const tableRow = page.locator('.outline-row[data-instance-id="table"]');
    await tableRow.locator('[data-action="pin"]').click();
    assert.equal(await tableRow.locator('[data-action="pin"]').getAttribute('aria-pressed'), 'false');
    await page.waitForFunction(() => document.activeElement?.dataset.action === 'pin');
    await tableRow.locator('[data-action="pin"]').click();
    assert.equal(await tableRow.locator('[data-action="pin"]').getAttribute('aria-pressed'), 'true');
    await tableRow.locator('[data-action="delete"]').click();
    await page.locator('#confirm-cancel').click();
    assert.equal(await tableRow.count(), 1, 'cancel keeps the item');
    await tableRow.locator('[data-action="delete"]').click();
    await page.locator('#confirm-ok').click();
    await page.waitForFunction(() => !document.querySelector('.outline-row[data-instance-id="table"]'));
    assert.equal(await rows.count(), 4, 'trash removes only the confirmed item');

    // A custom raster prop uses its stored artwork, rather than an emoji or missing SVG.
    assert.equal(await page.evaluate(async () => {
      const { renderOutlineThumbnail } = await import('/js/features/play/scene-outline-view.js');
      const container = document.createElement('span');
      await renderOutlineThumbnail(container, { kind: 'prop', sourceId: 'custom_outline' }, {
        getAsset: () => ({ name: 'Painted prop' }),
        customArtRepo: { getTrackedObjectUrl: async () => 'data:image/png;base64,iVBORw0KGgo=' }
      });
      return container.querySelector('img')?.getAttribute('src') === 'data:image/png;base64,iVBORw0KGgo=';
    }), true);
    await page.screenshot({ path: `/private/tmp/paper-doll-outline-${viewport.width}.png` });
    console.log(`Scene Outline passed at ${viewport.width}px: artwork, ${touch ? 'touch' : 'mouse'} drag/cancel, undo, keyboard, pin, delete, focus, layout.`);
    await context.close();
  }
  assert.deepEqual(errors, [], 'no browser runtime errors');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
