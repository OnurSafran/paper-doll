// Run with Playwright, or PLAYWRIGHT_MODULE pointing to an existing installation.
// All interaction checks use isolated storage, preserving the user's saved scenes.
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
envelope.settings.reducedMotion = 'full';
const draft = createStarterDraft();
envelope.presets = [{ ...draft, presetId: 'saved-doll', name: 'Test doll', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
let scene = { ...createEmptyScene('play-audit'), backgroundId: 'bg_park', placementMode: 'free', stageWidth: 4800 };
for (const entity of [
  { instanceId: 'chair', kind: 'prop', sourceId: 'prop_chair', x: 500, y: 800 },
  { instanceId: 'doll', kind: 'character', sourceId: 'saved-doll', characterSnapshot: draft, x: 900, y: 800 },
  { instanceId: 'bubble-a', kind: 'bubble', text: 'First bubble', x: 500, y: 250 },
  { instanceId: 'bubble-b', kind: 'bubble', text: 'Second bubble', x: 1000, y: 250 }
]) scene = addEntity(scene, entity, getAsset);
envelope.currentScene = scene;
let browser;
const errors = [];
const failures = [];
try {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 375, height: 812 }]) {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width === 375, serviceWorkers: 'block' });
    await context.addInitScript(({ key, envelope }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(envelope));
    }, { key: STORAGE_KEY, envelope });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    const url = `http://127.0.0.1:${server.address().port}/#play`;
    const entity = id => page.locator(`.scene-entity-positioner[data-instance-id="${id}"]`);
    async function load() {
      await page.goto(url);
      await entity('doll').waitFor();
    }
    async function select(id) {
      await entity(id).focus();
      await entity(id).press('Space');
      try {
        await page.locator(`.scene-entity-positioner.is-selected[data-instance-id="${id}"]`).waitFor();
      } catch (error) {
        const details = await page.evaluate(() => ({
          active: document.activeElement.outerHTML.slice(0, 300),
          selected: [...document.querySelectorAll('.scene-entity-positioner.is-selected')].map(el => el.dataset.instanceId),
          route: location.hash
        }));
        throw new Error(`${error.message}\nSelection state: ${JSON.stringify(details)}`, { cause: error });
      }
    }
    async function check(name, run) {
      try { await run(); console.log(`${viewport.width}px: ${name} passed.`); }
      catch (error) { failures.push(`${viewport.width}px ${name}: ${error.message}`); console.error(failures.at(-1)); }
    }

    await load();
    await check('render completion preserves focus moved by the player', async () => {
      await select('chair');
      const focusedId = await page.evaluate(async () => {
        const chair = document.querySelector('[data-instance-id="chair"]');
        chair.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
        document.querySelector('[data-instance-id="doll"]').focus();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return document.activeElement.dataset.instanceId;
      });
      assert.equal(focusedId, 'doll', 'the delayed render cannot steal the new focus');
      await page.locator('#undo-button').click();
      const afterToolbar = await page.evaluate(async () => {
        const action = document.querySelector('.context-ring [data-action="larger"]');
        action.focus();
        action.click();
        document.querySelector('[data-instance-id="doll"]').focus();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return document.activeElement.dataset.instanceId;
      });
      assert.equal(afterToolbar, 'doll', 'a rebuilt toolbar cannot steal the new focus');
      await page.locator('#undo-button').click();
      await page.locator('#play-stage').press('Escape');
    });
    await check('cached tray spawning follows the camera and distributes repeated clicks', async () => {
      await page.locator('#stage-minimap').press('End');
      const card = page.locator('#spawn-items .spawn-item').first();
      for (let i = 0; i < 2; i++) {
        await card.click();
        await page.waitForFunction(count => document.querySelectorAll('.scene-entity-positioner').length === count, 5 + i);
        const point = await page.locator('.scene-entity-positioner').last().evaluate(el => ({ x: Number(el.style.getPropertyValue('--x')), y: Number(el.style.getPropertyValue('--y')) }));
        assert.deepEqual(point, { x: 3200 + 650 + ((4 + i) % 5) * 80, y: 690 + ((4 + i) % 3) * 45 });
      }
      await page.locator('#stage-minimap').press('Home');
    });

    await check('Enter selects the focused entity instead of editing another selected bubble', async () => {
      await page.locator('#stage-minimap').press('Home');
      await select('bubble-a');
      await entity('bubble-b').focus();
      await entity('bubble-b').press('Enter');
      assert.equal(await page.locator('#bubble-text-dialog').isVisible(), false, 'first Enter selects the other bubble');
      await page.locator('.scene-entity-positioner.is-selected[data-instance-id="bubble-b"]').waitFor();
      await entity('bubble-b').press('Enter');
      await page.locator('#bubble-text-dialog').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#bubble-text-input').inputValue(), 'Second bubble');
      await page.locator('#bubble-text-input').fill('Edited second bubble');
      await page.locator('#bubble-text-form button[type="submit"]').click();
      await page.waitForFunction(() => document.querySelector('[data-instance-id="bubble-b"]').getAttribute('aria-label').includes('Edited second bubble'));
      assert.match(await entity('bubble-a').getAttribute('aria-label'), /First bubble/);
    });
    if (await page.locator('#bubble-text-dialog').isVisible()) await page.locator('#cancel-bubble-text').click();

    await check('pin and unpin update accessible labels for props, dolls and bubbles', async () => {
      const pinned = await page.evaluate(async () => (await import('./js/core/i18n.js')).t('play.pinned'));
      for (const id of ['chair', 'doll', 'bubble-a']) {
        await select(id);
        const before = await entity(id).getAttribute('aria-label');
        await entity(id).press('p');
        await page.locator(`[data-instance-id="${id}"].is-pinned`).waitFor();
        assert.equal(await entity(id).getAttribute('aria-label'), `${pinned} ${before}`);
        await entity(id).press('p');
        await page.waitForFunction(id => !document.querySelector(`[data-instance-id="${id}"]`).classList.contains('is-pinned'), id);
        assert.equal(await entity(id).getAttribute('aria-label'), before);
      }
    });

    await check('pinned pointer drags give feedback without moving the item or camera', async () => {
      await select('doll');
      await entity('doll').press('p');
      await page.locator('[data-instance-id="doll"].is-pinned').waitFor();
      await page.locator('#play-stage').scrollIntoViewIfNeeded();
      const coordinates = await page.evaluate(async () => {
        const { stageContentRect, logicalToClient } = await import('./js/core/coordinate-space.js');
        const stage = document.querySelector('#play-stage'), rect = stageContentRect(stage);
        return { start: logicalToClient(900, 650, rect, 0), end: { x: rect.left + rect.width - 5, y: logicalToClient(900, 650, rect, 0).y } };
      });
      const before = await entity('doll').evaluate(el => [el.style.getPropertyValue('--x'), el.style.getPropertyValue('--y')]);
      const help = await page.evaluate(async () => (await import('./js/core/i18n.js')).t('play.pinnedMoveBlocked'));
      const touch = viewport.width === 375 ? await context.newCDPSession(page) : null;
      try {
        if (touch) {
          await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [coordinates.start] });
          await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [coordinates.end] });
        } else {
          await page.mouse.move(coordinates.start.x, coordinates.start.y);
          await page.mouse.down();
          await page.mouse.move(coordinates.end.x, coordinates.end.y, { steps: 8 });
        }
        await page.waitForFunction(help => document.querySelector('#sr-announcements').textContent === help, help);
        assert.ok(await page.locator('#toast-region .toast').filter({ hasText: help }).count());
        assert.equal(await page.locator('#play-stage').evaluate(el => Number(el.style.getPropertyValue('--camera-x'))), 0);
        assert.deepEqual(await entity('doll').evaluate(el => [el.style.getPropertyValue('--x'), el.style.getPropertyValue('--y')]), before);
        assert.equal(await entity('doll').evaluate(el => el.classList.contains('is-dragging')), false);
      } finally {
        if (touch) { await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await touch.detach(); }
        else await page.mouse.up();
      }
      await entity('doll').press('p');
      await page.locator('#play-stage').press('Escape');
    });

    await check('wheel input handles both Shift axes, line/page units and browser zoom', async () => {
      const cases = [
        { deltaX: 80, shiftKey: true }, { deltaY: 80, shiftKey: true },
        { deltaX: 3, deltaMode: 1 }, { deltaX: 1, deltaMode: 2 },
        { deltaY: 80 }, { deltaX: 80, ctrlKey: true }
      ];
      for (const input of cases) {
        await page.locator('#stage-minimap').press('Home');
        const result = await page.evaluate(async input => {
          const { stageContentRect } = await import('./js/core/coordinate-space.js');
          const stage = document.querySelector('#play-stage'), width = stageContentRect(stage).width;
          const event = new window.WheelEvent('wheel', { bubbles: true, cancelable: true, ...input });
          stage.dispatchEvent(event);
          return { width, cameraX: Number(stage.style.getPropertyValue('--camera-x')), prevented: event.defaultPrevented };
        }, input);
        const claimed = !input.ctrlKey && Boolean(input.deltaX || input.shiftKey);
        const pixels = (input.deltaX || input.deltaY || 0) * (input.deltaMode === 1 ? 16 : input.deltaMode === 2 ? result.width : 1);
        assert.equal(result.cameraX, claimed ? Math.round(pixels * 1600 / result.width) : 0, JSON.stringify(input));
        assert.equal(result.prevented, claimed, 'unclaimed wheel input keeps its browser behavior');
      }
      await page.locator('#stage-minimap').press('Home');
    });

    await check('doll thumbnails survive a playback render while loading', async () => {
      await page.evaluate(() => {
        document.querySelector('#spawn-tab-characters').click();
        document.querySelector('#play-animation-btn').click();
      });
      await page.locator('#spawn-items .spawn-thumb svg').first().waitFor();
      assert.ok(await page.locator('#spawn-items .spawn-thumb svg').count());
      await page.locator('#play-animation-btn').click();
      assert.ok(await page.locator('#spawn-items .spawn-thumb svg').count());
      await page.locator('#spawn-tab-props').click();
    });

    await check('multi-selection uses distinct middle and bottom alignment controls', async () => {
      await select('chair');
      await entity('doll').press('Shift+Space');
      const middle = page.locator('.context-ring button[data-action="alignMiddle"]');
      const bottom = page.locator('.context-ring button[data-action="alignBottom"]');
      assert.notEqual(await middle.textContent(), await bottom.textContent());
      assert.notEqual(await middle.getAttribute('aria-label'), await bottom.getAttribute('aria-label'));
      await page.locator('#play-stage').press('Escape');
    });

    await check('expressions, poses, animation, undo and redo', async () => {
      // Restore a clean fixture so a failed check cannot affect later checks.
      await page.evaluate(({ key, envelope }) => localStorage.setItem(key, JSON.stringify(envelope)), { key: STORAGE_KEY, envelope });
      await page.reload();
      await entity('doll').waitFor();
      await select('doll');
      const expression = page.locator('#character-expression-controls [data-expression="happy"]');
      await expression.click();
      assert.equal(await expression.getAttribute('aria-pressed'), 'true', 'happy expression is selected');
      await page.locator('#character-pose-controls [data-pose="lean_left"]').click();
      assert.equal(await page.locator('#character-pose-controls [data-pose="lean_left"]').getAttribute('aria-pressed'), 'true', 'lean left pose is selected');
      await page.locator('#inspector-tab-motion').click();
      const clipButton = page.locator('#character-animation-clip-controls button:not([hidden]):not([data-clip-id="none"])').first();
      await clipButton.click();
      assert.equal(await clipButton.getAttribute('aria-pressed'), 'true', 'animation clip is selected');
      const transport = page.locator('#play-animation-btn');
      assert.equal(await transport.getAttribute('aria-pressed'), 'true', 'selecting a clip starts playback');
      await transport.click();
      assert.equal(await transport.getAttribute('aria-pressed'), 'false', 'playback pauses');
      await transport.click();
      assert.equal(await transport.getAttribute('aria-pressed'), 'true', 'playback resumes');
      await transport.click();
      await entity('chair').focus();
      await entity('chair').press('Space');
      const x = await entity('chair').evaluate(el => el.style.getPropertyValue('--x'));
      await entity('chair').press('ArrowRight');
      await page.waitForFunction(x => Number(document.querySelector('[data-instance-id="chair"]').style.getPropertyValue('--x')) === Number(x) + 10, x);
      await page.locator('#undo-button').click();
      await page.waitForFunction(x => document.querySelector('[data-instance-id="chair"]').style.getPropertyValue('--x') === x, x);
      await page.locator('#redo-button').click();
      await page.waitForFunction(x => Number(document.querySelector('[data-instance-id="chair"]').style.getPropertyValue('--x')) === Number(x) + 10, x);
    });

    await check('scene save, reload, library preview and PNG export', async () => {
      await page.locator('#play-scene-dropdown summary').click();
      await page.locator('#save-scene-btn').click();
      await page.locator('#scene-title-input').fill('Play audit saved scene');
      await page.locator('#confirm-save-scene').click();
      await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).scenes?.length === 1, STORAGE_KEY);
      await page.reload();
      await entity('doll').waitFor();
      await page.locator('#play-scene-dropdown summary').click();
      await page.locator('#scene-library-btn').click();
      await page.locator('#scene-library-grid .scene-card-thumb > svg').waitFor();
      assert.match(await page.locator('#scene-library-grid .scene-card-title').textContent(), /Play audit saved scene/);
      await page.locator('#close-scene-library').click();
      await page.locator('#play-export-dropdown summary').click();
      const downloaded = page.waitForEvent('download');
      await page.locator('#export-scene-png').click();
      const download = await downloaded;
      const png = await readFile(await download.path());
      assert.equal(png.readUInt32BE(16), 4800);
      assert.equal(png.readUInt32BE(20), 900);
    });
    await check('empty Dolls tray gives localized guidance and a working Create action', async () => {
      await page.evaluate(({ key, envelope }) => localStorage.setItem(key, JSON.stringify({ ...envelope, presets: [] })), { key: STORAGE_KEY, envelope });
      await page.reload();
      await entity('doll').waitFor();
      await page.locator('#spawn-tab-characters').click();
      for (const language of ['en', 'tr']) {
        const copy = await page.evaluate(async language => {
          const { setLanguage, t } = await import('./js/core/i18n.js');
          setLanguage(language);
          return t('play.emptyDollsCopy');
        }, language);
        assert.equal(await page.locator('#spawn-items .tray-empty').textContent(), copy);
        assert.equal(await page.locator('#spawn-items .spawn-item').count(), 0);
        assert.equal(await page.locator('#play-doll-actions a[href="#designer"]').isVisible(), true);
      }
      await page.locator('#play-doll-actions a[href="#designer"]').click();
      await page.locator('#designer-screen').waitFor({ state: 'visible' });
    });
    await context.close();
  }
  assert.deepEqual(errors, [], 'no browser exceptions');
  assert.deepEqual(failures, [], 'Play feature checks');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
