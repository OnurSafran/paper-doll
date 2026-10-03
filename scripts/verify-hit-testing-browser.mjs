// Run with a local Playwright installation (or PLAYWRIGHT_MODULE pointing to one).
// The server and browser are isolated; this never changes saved app data.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!path.startsWith(root + '/')) { res.writeHead(403).end(); return; }
  try { res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream'); res.end(await readFile(path)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const errors = [];
try {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const url = `http://127.0.0.1:${server.address().port}/test/fixtures/hit-testing-browser.html`;
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 768, height: 1024 }, { width: 375, height: 812 }]) {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width === 375 });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.waitForFunction(() => Boolean(window.fixture));
    const selected = () => page.evaluate(() => window.fixture.state.ui.selectedEntityId || null);
    async function click(x, y, shift = false) {
      const p = await page.evaluate(([x, y]) => window.fixture.at(x, y), [x, y]);
      // A floating toolbar is real UI over the scene. Dismiss it when this
      // regression intends to click artwork it currently covers.
      if (!shift) await page.evaluate(p => {
        if (document.elementFromPoint(p.x, p.y)?.closest('.context-ring')) window.fixture.store.dispatch({ type: 'ui/clearSelection' });
      }, p);
      if (shift) await page.keyboard.down('Shift');
      await page.mouse.click(p.x, p.y);
      if (shift) await page.keyboard.up('Shift');
    }
    await page.evaluate(() => window.fixture.renderingChecks());
    for (const cameraX of [0, 400]) {
      await page.evaluate(x => window.fixture.overlap(x), cameraX);
      await click(860, 500); assert.equal(await selected(), 'front', 'ring edge selects front raster');
      await click(800, 500); assert.equal(await selected(), 'back', 'ring center passes through two entities');
      await click(722, 500); assert.equal(await selected(), 'middle', 'visible padded artwork selects middle');
      await click(705, 405); assert.equal(await selected(), 'back', 'empty corners pass through');
      const p = await page.evaluate(() => window.fixture.at(862, 500));
      await page.mouse.click(p.x + 2, p.y); assert.equal(await selected(), 'back', 'exact artwork behind beats the ring edge tolerance');
      await page.mouse.click(p.x + 5, p.y); assert.equal(await selected(), 'back', 'five CSS pixels outside edge fall through');
      // With nothing exact behind it, the same near miss is forgiven.
      await page.evaluate(async x => { const f = window.fixture; await f.scene([f.entity('ring', 'custom_ring', 1)], x); }, cameraX);
      await page.mouse.click(p.x + 2, p.y); assert.equal(await selected(), 'ring', 'two CSS pixels from a thin ring with nothing behind it');
      await page.mouse.click(p.x + 5, p.y); assert.equal(await selected(), null, 'five CSS pixels away stays empty');
      await page.evaluate(x => window.fixture.overlap(x), cameraX);
    }
    await page.evaluate(() => window.fixture.overlap());
    await click(800, 500);
    await click(860, 500, true);
    assert.deepEqual(await page.evaluate(() => window.fixture.state.ui.selectedEntityIds), ['back', 'front'], 'Shift toggles once');
    assert.equal(await page.evaluate(() => window.fixture.actions.filter(a => a.type === 'ui/toggleEntitySelection').length), 1);
    const groupStart = await page.evaluate(() => window.fixture.at(800, 500));
    await page.mouse.move(groupStart.x, groupStart.y); await page.mouse.down(); await page.mouse.move(groupStart.x + 12, groupStart.y + 12); await page.mouse.up();
    const group = await page.evaluate(() => window.fixture.state.currentScene.entities);
    assert.equal(group[0].x, group[2].x, 'multi-selected entities move together');
    assert.ok(group[0].x > 800);
    await page.keyboard.press('Tab');
    await page.locator('[data-instance-id="middle"]').focus();
    assert.deepEqual(await page.evaluate(() => {
      const e = document.activeElement;
      return [window.getComputedStyle(e).outlineStyle, window.getComputedStyle(e.querySelector('.scene-entity-visual'), '::after').content];
    }), ['none', '""'], 'keyboard focus has an arrow without a rectangular outline');
    await page.keyboard.press('Enter'); assert.equal(await selected(), 'middle');
    await page.keyboard.press('Space'); assert.equal(await selected(), 'middle');
    await page.locator('#stage-control').click(); assert.equal(await selected(), 'middle', 'stage UI preserves selection');
    await page.evaluate(async () => { const f = window.fixture; await f.scene([f.entity('back', 'custom_large', 1, { y: 650 }), f.entity('bicycle', 'prop_bicycle', 2, { scale: 2 })]); });
    for (const [userX, userY, expected] of [[245, 630, 'bicycle'], [500, 550, 'back'], [83, 316, 'back']]) {
      const p = await page.evaluate(([x, y]) => { const p = window.fixture.propPoint('bicycle', x, y); return { x: p.x, y: p.y }; }, [userX, userY]);
      await page.mouse.click(p.x, p.y); assert.equal(await selected(), expected, `shared SVG at ${userX},${userY}`);
    }
    if (viewport.width === 375) {
      await page.evaluate(() => window.fixture.overlap());
      const p = await page.evaluate(() => window.fixture.at(800, 500));
      await page.touchscreen.tap(p.x, p.y); assert.equal(await selected(), 'back', 'touch falls through');
      const touch = await page.context().newCDPSession(page);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x + 12, y: p.y + 9 }] });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      assert.equal(await page.locator('.is-dragging').count(), 0, 'touch cancellation clears drag state');

      // A native touch drag that falls through transparent foreground artwork must commit, not cancel itself.
      await page.evaluate(() => window.fixture.overlap());
      const lift = await page.evaluate(() => window.fixture.at(800, 500));
      const drop = await page.context().newCDPSession(page);
      await drop.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: lift.x, y: lift.y }] });
      for (const step of [6, 12, 20, 28]) await drop.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: lift.x + step, y: lift.y + step / 2 }] });
      await drop.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      assert.equal(await selected(), 'back', 'the touch selected the artwork behind the transparent foreground');
      const dropped = await page.evaluate(() => ({ back: window.fixture.state.currentScene.entities.find(e => e.instanceId === 'back'), rect: window.fixture.rect() }));
      assert.equal(dropped.back.x, Math.round(800 + 28 * 1600 / dropped.rect.width), 'a touch drag that fell through commits its movement');
      assert.equal(await page.locator('.is-dragging').count(), 0);
    }

    // A release outside the stage must not leave a gesture open that swallows the next click.
    await page.evaluate(() => window.fixture.overlap());
    const pressed = await page.evaluate(() => window.fixture.at(800, 500));
    await page.mouse.move(pressed.x, pressed.y); await page.mouse.down();
    await page.mouse.move(1, 1); await page.mouse.up();
    assert.equal(await page.locator('.is-dragging').count(), 0, 'releasing outside the stage ends the drag');
    await page.evaluate(() => window.fixture.overlap());
    await click(860, 500); assert.equal(await selected(), 'front', 'the click after an outside release is not swallowed');

    // While the world eases toward a new camera, input maps to the artwork as drawn, not to its destination.
    await page.evaluate(async () => {
      const f = window.fixture;
      await f.overlap(400);
      const world = document.querySelector('#scene-world');
      world.getAnimations().forEach(animation => animation.finish());
      world.style.transition = 'transform 2s linear';
      f.state.currentScene.cameraX = 0;
      document.querySelector('#play-stage').style.setProperty('--camera-x', 0);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const [animation] = world.getAnimations();
      animation.pause();
      animation.currentTime = 1000;
    });
    const easing = await page.evaluate(() => {
      const stage = document.querySelector('#play-stage').getBoundingClientRect();
      const box = (id) => document.querySelector(`[data-instance-id="${id}"]`).getBoundingClientRect();
      const back = box('back'), middle = box('middle');
      return { stage: { left: stage.left, right: stage.right }, back: { x: back.left + back.width / 2, y: back.top + back.height / 2 },
        middle: { x: middle.left + middle.width * .17, y: middle.top + middle.height * .5 } };
    });
    assert.ok(easing.back.x > easing.stage.left && easing.back.x < easing.stage.right, 'the drawn artwork is inside the stage mid-transition');
    await page.evaluate(() => window.fixture.store.dispatch({ type: 'ui/clearSelection' }));
    await page.mouse.click(easing.back.x, easing.back.y); assert.equal(await selected(), 'back', 'the drawn artwork is clickable mid-transition');
    await page.evaluate(() => window.fixture.store.dispatch({ type: 'ui/clearSelection' }));
    await page.mouse.click(easing.middle.x, easing.middle.y); assert.equal(await selected(), 'middle', 'padded artwork resolves where it is drawn mid-transition');
    await page.evaluate(() => { const world = document.querySelector('#scene-world'); world.getAnimations().forEach(animation => animation.finish()); world.style.transition = ''; });

    // The cursor follows visible artwork, not the rectangular button over it.
    const cursorAt = async (x, y) => {
      await page.mouse.move(x, y);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      return page.evaluate(([x, y]) => window.getComputedStyle(document.elementFromPoint(x, y)).cursor, [x, y]);
    };
    await page.evaluate(async () => { const f = window.fixture; await f.scene([f.entity('ring', 'custom_ring', 1)]); });
    const edge = await page.evaluate(() => window.fixture.at(860, 500));
    const corner = await page.evaluate(() => window.fixture.at(705, 405));
    assert.equal(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.scene-entity-positioner')?.dataset.instanceId, [corner.x, corner.y]), 'ring', 'the transparent corner is covered by the entity button');
    assert.equal(await cursorAt(edge.x, edge.y), 'grab', 'visible artwork shows the grab cursor');
    assert.equal(await cursorAt(corner.x, corner.y), 'auto', 'transparent corners of the same button do not');
    assert.equal(await cursorAt(edge.x, edge.y), 'grab');
    await page.mouse.down();
    await page.mouse.move(edge.x + 30, edge.y + 10);
    assert.equal(await page.evaluate(() => document.querySelector('#play-stage').dataset.cursor), 'grabbing', 'the stage shows grabbing for the whole drag');
    await page.mouse.up();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => document.querySelector('#play-stage').dataset.cursor ?? null), 'grab', 'after the drop the pointer is still over the artwork');
    await page.evaluate(async () => { const f = window.fixture; await f.scene([f.entity('ring', 'custom_ring', 1, { pinned: true })]); });
    const pinnedEdge = await page.evaluate(() => window.fixture.at(860, 500));
    assert.equal(await cursorAt(pinnedEdge.x, pinnedEdge.y), 'auto', 'pinned artwork cannot be grabbed');
    await page.mouse.move(2, 2);
    assert.equal(await page.evaluate(() => document.querySelector('#play-stage').dataset.cursor ?? null), null, 'leaving the stage clears the cursor');

    await page.evaluate(() => window.fixture.overlap());
    const start = await page.evaluate(() => window.fixture.at(800, 500));
    await click(800, 500);
    const toolbarBeforeDrag = await page.locator('.context-ring').boundingBox();
    await page.evaluate(() => { window.fixture.dragToolbar = document.querySelector('.context-ring'); });
    const builds = await page.evaluate(() => window.fixture.hitTester.timings.builds);
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(start.x + 20, start.y + 15);
    await page.waitForFunction(top => Math.abs(document.querySelector('.context-ring').getBoundingClientRect().top - top - 15) < .5, toolbarBeforeDrag.y);
    assert.ok(await page.evaluate(() => {
      const ring = document.querySelector('.context-ring');
      return ring === window.fixture.dragToolbar && ring.classList.contains('is-dragging') && window.getComputedStyle(ring).pointerEvents === 'none';
    }), 'the same toolbar follows live drag previews without intercepting the pointer');
    assert.equal(await page.evaluate(() => document.querySelector('#play-stage').hasPointerCapture(1)), true, 'the stage owns the gesture with real pointer capture');
    await page.mouse.up();
    const moved = await page.evaluate(() => ({ entity: window.fixture.state.currentScene.entities[0], rect: window.fixture.rect(), builds: window.fixture.hitTester.timings.builds, actions: window.fixture.actions }));
    assert.equal(moved.entity.x, Math.round(800 + 20 * 1600 / moved.rect.width));
    assert.equal(moved.entity.y, Math.round(600 + 15 * 900 / moved.rect.height));
    assert.equal(moved.builds, builds, 'drag never rebuilds masks');
    await page.evaluate(async () => { const f = window.fixture; await f.scene([f.entity('pinned', 'custom_back', 1, { pinned: true })]); });
    await click(800, 500); assert.equal(await selected(), 'pinned');
    await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(start.x + 30, start.y); await page.mouse.up();
    assert.equal(await page.evaluate(() => window.fixture.state.currentScene.entities[0].x), 800, 'pinned art stays put');
    for (const flipped of [false, true]) {
      await page.evaluate(flip => window.fixture.movingDoll(flip), flipped);
      const x = flipped ? 663 : 937;
      assert.equal(await page.evaluate(([x, y]) => window.fixture.resolve(x, y), [x, 380.67]), 'doll', 'moving arm outside the frame resolves');
      assert.equal(await page.evaluate(([x, y]) => window.fixture.resolve(x, y), [flipped ? 780 : 820, 443.3]), null, 'old arm location is empty');
      await click(x, 380.67); assert.equal(await selected(), 'doll', 'overflow artwork receives real pointer selection');
      await page.waitForFunction(() => document.activeElement?.dataset.instanceId === 'doll');
    }
    await page.evaluate(() => window.fixture.layeredDoll());
    await click(800, 460); assert.equal(await selected(), 'doll', 'layered clothing is clickable');
    await click(700, 370); assert.equal(await selected(), null, 'doll padding falls through');
    await page.evaluate(() => window.fixture.customDoll());
    await click(800, 490); assert.equal(await selected(), null, 'custom doll hollow center stays empty');
    await click(729.5, 490); assert.equal(await selected(), 'doll', 'custom full-doll raster outline is clickable');
    await page.evaluate(async () => { const f = window.fixture; await f.scene([f.entity('bubble', '', 1, { kind: 'bubble', bubbleStyle: 'speech', text: 'Hello', width: 260 })]); });
    // Aim at the filled body, whole pixels away from any edge: mouse input is integer-valued, so a point
    // found only inside the edge tolerance can truncate out of it on small stages.
    const bubblePoint = await page.evaluate(() => {
      const box = document.querySelector('[data-instance-id="bubble"]').getBoundingClientRect();
      return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) };
    });
    await page.mouse.dblclick(bubblePoint.x, bubblePoint.y);
    assert.equal(await page.evaluate(() => window.fixture.actions.filter(a => a.type === 'editBubble').length), 1);

    // The toolbar may cross the clipped stage, but stays within the window.
    await page.locator('#play-stage').evaluate(stage => { stage.style.width = '60vw'; stage.style.marginLeft = '20vw'; });
    let overflowedStage = false;
    for (const cameraX of [0, 400]) {
      for (const [x, y] of [[cameraX + 80, 600], [cameraX + 1580, 850], [cameraX + 800, 130]]) {
        const metrics = await page.evaluate(async ([x, y, cameraX]) => {
          const f = window.fixture;
          await f.scene([f.entity('padded', 'custom_padded', 1, { x, y })], cameraX);
          f.store.dispatch({ type: 'ui/selectEntity', instanceId: 'padded' });
          const stage = f.rect();
          const ring = document.querySelector('.context-ring');
          const box = ring.getBoundingClientRect();
          const entity = document.querySelector('[data-instance-id="padded"]');
          const visual = entity.querySelector('.scene-entity-visual');
          const arrow = window.getComputedStyle(visual, '::after');
          const bounds = f.hitTester.artworkBounds(entity);
          const a = f.at(bounds.left, bounds.top), b = f.at(bounds.right, bounds.bottom);
          const minimap = document.querySelector('.camera-hud:not([hidden])')?.getBoundingClientRect();
          return { left: box.left, width: box.width, parent: ring.parentElement.tagName,
            inside: box.left >= 11.5 && box.right <= window.innerWidth - 11.5 && box.top >= 11.5 && box.bottom <= window.innerHeight - 11.5,
            overflow: box.left < stage.left || box.right > stage.left + stage.width,
            artCenter: (a.x + b.x) / 2, clearArt: box.top >= b.y + 11.5 || box.bottom <= a.y - 11.5,
            minimapClear: !minimap || box.left >= minimap.right || box.right <= minimap.left || box.top >= minimap.bottom || box.bottom <= minimap.top,
            markerX: Number(entity.style.getPropertyValue('--selection-center-x')), markerY: Number(entity.style.getPropertyValue('--selection-top')),
            arrow: { left: parseFloat(arrow.left), top: parseFloat(arrow.top), border: parseFloat(arrow.borderTopWidth), pointerEvents: arrow.pointerEvents },
            visualWidth: visual.getBoundingClientRect().width, visualTop: visual.getBoundingClientRect().top,
            frame: window.getComputedStyle(entity, '::after').content };
        }, [x, y, cameraX]);
        assert.equal(metrics.parent, 'BODY', 'overlay is outside stage clipping ancestors');
        assert.ok(metrics.inside, 'actions stay inside the window with a margin');
        assert.ok(Math.abs(metrics.left - Math.max(12, Math.min(viewport.width - 12 - metrics.width, metrics.artCenter - metrics.width / 2))) < .5, 'only the window limits horizontal centering');
        assert.ok(metrics.clearArt, 'actions stay above or below the painted artwork');
        assert.ok(metrics.minimapClear, 'camera overview remains reachable');
        overflowedStage ||= metrics.overflow;
        assert.ok(Math.abs(metrics.markerX - .175) < 1e-9);
        assert.equal(metrics.markerY, .4);
        assert.ok(Math.abs(metrics.arrow.left - metrics.visualWidth * .175) < .5);
        assert.equal(metrics.arrow.border, 14);
        assert.equal(metrics.arrow.pointerEvents, 'none');
        assert.equal(metrics.frame, 'none');
        assert.ok(metrics.arrow.top + metrics.visualTop - 20 >= 0);
      }
    }
    assert.ok(overflowedStage, 'toolbar visibly extends beyond the scene without clipping');
    await page.locator('#play-stage').evaluate(stage => { stage.style.width = ''; stage.style.marginLeft = ''; });
    const flip = page.locator('.context-ring [data-action="flip"]');
    await flip.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement?.dataset.action === 'flip');
    assert.equal(await page.evaluate(() => window.fixture.state.currentScene.entities[0].flipped), true, 'floating action preserves activation and focus');
    if (viewport.width === 375) {
      const box = await flip.boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      assert.equal(await page.evaluate(() => window.fixture.state.currentScene.entities[0].flipped), false, 'touch activates the floating toolbar without deselecting');
      assert.equal(await selected(), 'padded');
    }
    await page.locator('.context-ring [data-action="flip"]').focus();
    await page.keyboard.press('Escape');
    assert.equal(await selected(), null);
    assert.equal(await page.locator('.context-ring').count(), 0, 'Escape dismisses toolbar and markers');
    await page.evaluate(() => window.fixture.overlap());
    await click(800, 500); await click(860, 500, true);
    const markers = await page.evaluate(() => Array.from(document.querySelectorAll('.scene-entity-positioner')).filter(e => window.getComputedStyle(e.querySelector('.scene-entity-visual'), '::after').content === '""').map(e => e.dataset.instanceId));
    assert.deepEqual(markers, ['back', 'front'], 'all members of a multi-selection have arrows');
    await page.locator('.context-ring [data-action="delete"]').focus();
    await page.evaluate(() => window.fixture.store.dispatch({ type: 'ui/message', message: 'Refresh controls' }));
    await page.waitForFunction(() => document.activeElement?.dataset.action === 'delete');
    assert.ok(await page.evaluate(() => {
      const ring = document.querySelector('.context-ring').getBoundingClientRect(), button = document.activeElement.getBoundingClientRect();
      return button.left >= ring.left && button.right <= ring.right;
    }), 'keyboard focus scrolls narrow multi-select actions into view');
    await page.evaluate(() => window.fixture.layeredDoll());
    await click(800, 460);
    assert.deepEqual(await page.evaluate(() => {
      const e = document.querySelector('[data-instance-id="doll"]');
      return [window.getComputedStyle(e.querySelector('.scene-entity-visual'), '::after').content, window.getComputedStyle(e.querySelector('.scene-entity-motion'), '::after').content];
    }), ['none', '""'], 'doll has one marker within the live root motion transform');
    await page.screenshot({ path: `/private/tmp/paper-doll-selection-${viewport.width}.png` });
    await page.emulateMedia({ forcedColors: 'active' });
    assert.equal(await page.locator('[data-instance-id="doll"]').evaluate(e => window.getComputedStyle(e).borderTopWidth), '0px', 'forced colors retains the marker without a button rectangle');
    assert.equal(await page.locator('.scene-entity-motion').evaluate(e => window.getComputedStyle(e, '::after').forcedColorAdjust), 'none');
    await page.emulateMedia({ forcedColors: 'none' });
    await page.evaluate(async () => {
      const f = window.fixture, stage = document.querySelector('#play-stage');
      stage.style.marginTop = `${Math.max(0, window.innerHeight - stage.getBoundingClientRect().height - 40)}px`;
      await f.scene([f.entity('bottom', 'custom_back', 1, { y: 900 })]);
      f.store.dispatch({ type: 'ui/selectEntity', instanceId: 'bottom' });
    });
    assert.ok(await page.locator('.context-ring').evaluate(ring => {
      const box = ring.getBoundingClientRect();
      return ring.classList.contains('is-above') && box.top >= 12 && box.bottom <= window.innerHeight - 12;
    }), 'toolbar flips above artwork near the window bottom');
    await page.setViewportSize({ width: viewport.width - 40, height: viewport.height });
    await page.waitForFunction(() => {
      const box = document.querySelector('.context-ring').getBoundingClientRect();
      return box.left >= 11.5 && box.right <= window.innerWidth - 11.5 && box.width > 100;
    });
    await page.setViewportSize(viewport);
    await page.locator('#play-stage').evaluate(stage => { stage.style.marginTop = ''; });
    if (viewport.width === 1440) {
      const ids = await page.evaluate(() => window.fixture.catalog());
      for (const id of ids) {
        const box = page.locator(`#standalone-${id}`);
        const standalone = await box.screenshot();
        // Use the same screen position: the paper texture depends on coordinates.
        await page.evaluate(id => document.querySelector(`#standalone-${id}`).replaceChildren(document.querySelector(`#symbol-${id} svg`)), id);
        const symbol = await box.screenshot();
        if (!symbol.equals(standalone)) {
          const difference = await page.evaluate(async urls => {
            const pixels = await Promise.all(urls.map(async url => {
              const bitmap = await createImageBitmap(await (await fetch(url)).blob());
              const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
              const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close();
              return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            }));
            let sum = 0; let max = 0; let outliers = 0;
            for (let i = 0; i < pixels[0].length; i += 4) {
              let pixelMax = 0;
              for (let channel = 0; channel < 4; channel++) {
                const d = Math.abs(pixels[0][i + channel] - pixels[1][i + channel]);
                sum += d; pixelMax = Math.max(pixelMax, d);
              }
              max = Math.max(max, pixelMax);
              if (pixelMax > 16) outliers++;
            }
            return { mean: sum / pixels[0].length, max, outlierFraction: outliers / (pixels[0].length / 4) };
          }, [standalone, symbol].map(png => 'data:image/png;base64,' + png.toString('base64')));
          // Chrome redistributes stroke antialiasing across two adjacent pixels
          // for fh_board_game (17/255 per channel, mean 0.0022). Permit sparse
          // edge noise while still rejecting broad changes or stronger artifacts.
          assert.ok(difference.mean < .15 && difference.max <= 20 && difference.outlierFraction <= .001,
            `${id}: SVG screenshot mismatch ${JSON.stringify(difference)}`);
        }
      }
      console.log(`Actual SVG rendering: ${ids.length} built-in props match standalone/shared-symbol screenshots.`);
      const timings = await page.evaluate(async () => {
        const f = window.fixture;
        await f.scene(Array.from({ length: 40 }, (_, i) => f.entity(`doll-${i}`, 'demo_emma', i, { kind: 'character', scale: 1, characterSnapshot: f.dollSnapshot })));
        const builds = f.hitTester.timings.builds;
        const samples = [];
        for (let i = 0; i < 100; i++) { f.resolve(700, 370); samples.push(f.hitTester.timings.lastResolveMs); }
        return { medianMs: samples.sort((a, b) => a - b)[50], maxMs: Math.max(...samples), buildsBefore: builds, buildsAfter: f.hitTester.timings.builds };
      });
      assert.equal(timings.buildsAfter, timings.buildsBefore);
      console.log('40-doll transparent-point resolution:', timings);
    }
    console.log(`${viewport.width}px: pointer regressions, artwork arrows, following window overlay, multi-select, keyboard focus, minimap clearance and custom/layered dolls passed.`);
    await context.close();
  }
  // Check the composition root too: toolbar rebuilds, route teardown and the
  // surrounding responsive layout are absent from the isolated fixtures.
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 375, height: 812 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url.replace('/test/fixtures/hit-testing-browser.html', '/index.html#play'));
    const doll = page.locator('.scene-entity-positioner.is-character-entity').first();
    await doll.waitFor();
    await doll.focus(); await page.keyboard.press('Enter');
    const larger = page.locator('body > .context-ring [data-action="larger"]');
    await larger.focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement?.dataset.action === 'larger');
    assert.ok(await doll.evaluate(entity => {
      const box = entity.getBoundingClientRect(), ring = document.querySelector('body > .context-ring').getBoundingClientRect();
      const center = box.left + Number(entity.style.getPropertyValue('--selection-center-x')) * box.width;
      const expected = Math.max(12, Math.min(window.innerWidth - 12 - ring.width, center - ring.width / 2));
      // The toolbar centers on painted bounds; the marker uses the body center. Asymmetric hair or clothing may differ by a few pixels.
      return Math.abs(ring.left - expected) < box.width * .1 && ring.left >= 11.5 && ring.right <= window.innerWidth - 11.5;
    }), 'full app actions follow selected art after a size change');
    assert.ok(await page.locator('body > .context-ring').evaluate(ring => {
      const box = ring.getBoundingClientRect(), controls = document.querySelector('.play-stage-controls').getBoundingClientRect();
      return box.right <= controls.left || box.left >= controls.right || box.bottom <= controls.top || box.top >= controls.bottom;
    }), 'floating actions do not cover stage transport controls');
    await page.screenshot({ path: `/private/tmp/paper-doll-selection-app-${viewport.width}.png` });
    await page.locator('#stage-width-select').selectOption('3200');
    await page.waitForFunction(() => !document.querySelector('#camera-hud').hidden);
    await page.locator('body > .context-ring [data-action="larger"]').focus();
    await page.keyboard.press('PageDown');
    await page.waitForFunction(() => Number(document.querySelector('#stage-minimap').getAttribute('aria-valuenow')) > 0);
    await page.waitForFunction(() => {
      const entity = document.querySelector('.scene-entity-positioner.is-selected'), ring = document.querySelector('body > .context-ring').getBoundingClientRect();
      const box = entity.getBoundingClientRect(), center = box.left + Number(entity.style.getPropertyValue('--selection-center-x')) * box.width;
      return Math.abs(ring.left - Math.max(12, Math.min(window.innerWidth - 12 - ring.width, center - ring.width / 2))) < box.width * .1;
    });
    if (viewport.width === 375) {
      await page.setViewportSize({ width: 375, height: 400 });
      await page.locator('main').evaluate(main => {
        main.scrollTop = Math.ceil(document.querySelector('.scene-entity-positioner.is-selected').getBoundingClientRect().bottom - main.getBoundingClientRect().top + 10);
      });
      await page.waitForFunction(() => document.querySelector('body > .context-ring').hidden);
      await page.locator('main').evaluate(main => { main.scrollTop = 0; });
      await page.setViewportSize(viewport);
      await page.waitForFunction(() => !document.querySelector('body > .context-ring').hidden);
    }
    await page.locator('[data-mode-link="designer"]').click();
    await page.waitForFunction(() => !document.querySelector('body > .context-ring'));
    assert.equal(await page.locator('body > .context-ring').count(), 0, 'route teardown removes the floating toolbar');
    console.log(`${viewport.width}px: full app selection, scale-action focus, following actions and route teardown passed.`);
    await context.close();
  }
  assert.deepEqual(errors, [], 'no browser exceptions');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
