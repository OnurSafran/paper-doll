import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createDefaultEnvelope, STORAGE_KEY } from '../js/core/state-schema.js';
import { createStarterDraft } from '../js/domain/outfit-rules.js';
import { createSampleScene } from '../js/domain/scene-rules.js';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'scratch/guide-browser');
await mkdir(output, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'));
  if (!path.startsWith(root + '/')) { res.writeHead(403).end(); return; }
  try { res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream'); res.end(await readFile(path)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const results = [], errors = [];
const envelope = createDefaultEnvelope();
envelope.currentScene = createSampleScene(createStarterDraft());
const prop = envelope.currentScene.entities.find(entity => entity.kind === 'prop');
for (let i = 0; i < 36; i++) envelope.currentScene.entities.push({ ...prop, instanceId: `guide-test-prop-${i}`, order: i + 10 });

async function scrollAreas(page, selector) {
  return page.locator(selector).evaluate(dialog => [dialog, ...dialog.querySelectorAll('*')].filter(node => {
    const style = window.getComputedStyle(node);
    return /auto|scroll/.test(style.overflowY) && node.clientHeight > 0 && node.scrollHeight > node.clientHeight + 2;
  }).map(node => node.id || node.className));
}
try {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  for (const width of [375, 768, 1440]) for (const lang of ['en','tr']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: width < 1000, serviceWorkers: 'block' });
    await context.addInitScript(({ lang, key, envelope }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(envelope));
      localStorage.setItem('paper_doll_language', lang);
    }, { lang, key: STORAGE_KEY, envelope });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/#play`);
    await page.waitForFunction(lang => document.documentElement.lang === lang, lang);
    await page.locator('#guide-menu-btn').click();
    await page.locator('#guide-dialog').waitFor();
    for (const tab of ['quickstart','features','tips','shortcuts']) {
      await page.locator(`#guide-tab-${tab}`).click();
      const panel = page.locator(`#guide-panel-${tab}`);
      assert.ok(await panel.isVisible());
      const content = await panel.innerText();
      assert.ok(!/corner handles|perfect fit|100% Offline|Say Hello|Dollbox'a|Header'daki|köşelerden çek|Selam Ver/.test(content), `${lang} ${tab}: stale instruction`);
      if (lang === 'en') assert.ok(!/Yön Tuşları|Yön tuşları|Boşluk|İPUCU/.test(content), `${tab}: ${content}`);
      if (tab === 'quickstart') {
        const examples = panel.locator('.guide-button-examples');
        assert.equal(await examples.count(), 4, 'every first-scene card has button examples');
        assert.equal(await examples.locator('button, a, [tabindex], [role="button"]').count(), 0, 'examples are static, not actions');
        assert.equal(await examples.locator('[data-i18n="designer.saveDollBtn"]').innerText(), await page.locator('#save-doll-btn').innerText());
        assert.equal(await examples.locator('[data-i18n="play.saveSceneBtn"]').innerText(), await page.locator('#save-scene-btn').innerText());
        assert.equal(await examples.locator('[data-i18n="play.clipBounceShort"]').innerText(), await page.locator('[data-clip-id="happy_bounce"]').innerText());
        assert.ok(await examples.evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth + 1)), 'button examples wrap without overflow');
      }

      const layout = await panel.evaluate(el => ({ client: el.clientWidth, scroll: el.scrollWidth, bodyClient: el.closest('.guide-dialog-body').clientWidth, bodyScroll: el.closest('.guide-dialog-body').scrollWidth }));
      assert.ok(layout.scroll <= layout.client + 1, `${width}px ${lang} ${tab}: panel overflow`);
      assert.ok(layout.bodyScroll <= layout.bodyClient + 1, `${width}px ${lang} ${tab}: guide overflow`);
      const scrollers = await panel.evaluate(el => {
        const dialog = el.closest('dialog');
        return [dialog, ...dialog.querySelectorAll('*')].filter(node => {
          const style = window.getComputedStyle(node);
          return /auto|scroll/.test(style.overflowY) && node.clientHeight > 0 && node.scrollHeight > node.clientHeight + 2;
        }).map(node => node.id || node.className);
      });
      const needsScroll = await page.locator('#guide-dialog').evaluate(el => el.scrollHeight > el.clientHeight + 2);
      assert.deepEqual(scrollers, needsScroll ? ['guide-dialog'] : [], `${width}px ${lang} ${tab}: no nested vertical scrollers`);
      await page.locator('#guide-dialog').evaluate(el => { el.scrollTop = 0; });
      const bounds = await panel.boundingBox();
      await page.mouse.move(bounds.x + bounds.width / 2, Math.min(bounds.y + 80, 650));
      if (needsScroll) {
        await page.mouse.wheel(0, 500);
        await page.waitForFunction(() => document.querySelector('#guide-dialog').scrollTop > 0);
        if (width < 1000 && tab === 'features') {
          await page.locator('#guide-dialog').evaluate(el => { el.scrollTop = 0; });
          const input = await context.newCDPSession(page);
          await input.send('Input.synthesizeScrollGesture', {
            x: bounds.x + bounds.width / 2, y: Math.min(bounds.y + 120, 600), yDistance: -250, gestureSourceType: 'touch'
          });
          await input.detach();
          await page.waitForFunction(() => document.querySelector('#guide-dialog').scrollTop > 0);
        }
      }
      assert.equal(await page.locator('.guide-dialog-body').evaluate(el => el.scrollTop), 0);
      await page.locator('#guide-dialog').evaluate(el => { el.scrollTop = el.scrollHeight; });
      assert.ok(await panel.evaluate(el => el.lastElementChild.getBoundingClientRect().bottom <= el.closest('dialog').getBoundingClientRect().bottom));
      await page.locator('#guide-dialog').evaluate(el => { el.scrollTop = 0; });
      await page.locator('#guide-dialog').screenshot({ path: resolve(output, `${width}-${lang}-${tab}.png`) });
      if (tab === 'shortcuts') {
        const keys = await panel.locator('kbd[data-i18n]').allTextContents();
        assert.deepEqual(keys, lang === 'en' ? ['Arrow keys','Arrow keys','Space'] : ['Yön tuşları','Yön tuşları','Boşluk']);
      }
      if (tab === 'tips') {
        assert.ok(content.includes(lang === 'en' ? 'Family Help' : 'Aileler İçin'));
        assert.ok(content.includes(lang === 'en' ? 'Need Help?' : 'Yardım mı Gerekiyor?'));
      }
    }
    // Reopening the Guide must start at Quick Start, even after reading a long topic.
    await page.locator('#guide-tab-features').click();
    await page.locator('#guide-dialog').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await page.keyboard.press('Escape');
    await page.locator('#guide-menu-btn').click();
    assert.ok(await page.locator('#guide-panel-quickstart').isVisible());
    assert.equal(await page.locator('#guide-dialog').evaluate(el => el.scrollTop), 0);
    await page.locator('#close-guide-dialog').click();
    await page.locator('#settings-menu-btn').click();
    await page.locator('#settings-open-project-btn').click();
    const projectNeedsScroll = await page.locator('#project-dialog').evaluate(el => el.scrollHeight > el.clientHeight + 2);
    assert.deepEqual(await scrollAreas(page, '#project-dialog'), projectNeedsScroll ? ['project-dialog'] : [], 'Project & Backups has no nested vertical scrollers');
    await page.locator('#close-project-dialog').click();

    await page.locator('#scene-outline-btn').click();
    const outline = page.locator('#scene-outline-dialog');
    await outline.waitFor();
    assert.deepEqual(await scrollAreas(page, '#scene-outline-dialog'), ['scene-outline-dialog'], 'Layers has one vertical scroller');
    const firstHandle = outline.locator('.outline-drag-handle').first();
    const handleBox = await firstHandle.boundingBox();
    const outlineBox = await outline.boundingBox();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + handleBox.width / 2, outlineBox.y + outlineBox.height - 15, { steps: 10 });
    assert.ok(await outline.evaluate(el => el.scrollTop > 0), 'dragging a layer scrolls the dialog at its edge');
    assert.equal(await outline.locator('.outline-dialog-body').evaluate(el => el.scrollTop), 0);
    await page.mouse.up();
    await page.keyboard.press('Escape');
    // Narrow screens keep help in the persistent Guide; the header chip is hidden.
    if (width > 600) {
      await page.clock.install();
      await page.reload();
      await page.locator('#quick-tip-chip').click();
      assert.ok(await page.locator('#guide-panel-features').isVisible());
      const visibleTarget = async id => {
        const boxes = await page.locator(`#${id}`).evaluate(el => {
          const target = el.getBoundingClientRect(), body = el.closest('dialog').getBoundingClientRect();
          return { target: target.top, top: body.top, bottom: body.bottom };
        });
        assert.ok(boxes.target >= boxes.top - 2 && boxes.target < boxes.bottom, `${id}: help target is visible`);
      };
      await visibleTarget('guide-feature-play');
      await page.locator('#close-guide-dialog').click();
      await page.mouse.move(0, 0);
      await page.locator('#play-stage').focus();
      await page.clock.fastForward(15000);
      await page.clock.fastForward(200);
      // Fast-forward fires each interval once, so explicitly advance a second tip.
      if (!/Outline|Katmanlar/.test(await page.locator('#quick-tip-text').innerText())) {
        await page.clock.fastForward(7500); await page.clock.fastForward(200);
      }
      await page.locator('#quick-tip-chip').click();
      assert.ok(await page.locator('#guide-panel-tips').isVisible());
      await visibleTarget('guide-tip-layers');
      await page.locator('#close-guide-dialog').click();
      for (const mode of ['paint','designer']) {
        await page.locator(`[data-mode-link="${mode}"]`).click();
        await page.locator(`[data-mode-link="${mode}"][aria-current="page"]`).waitFor();
        await page.mouse.move(0, 0);
        await page.locator(`[data-mode-link="${mode}"]`).focus();
        await page.clock.fastForward(7500); await page.clock.fastForward(200);
        await page.locator('#quick-tip-chip').click();
        assert.ok(await page.locator('#guide-panel-features').isVisible());
        await visibleTarget(`guide-feature-${mode}`);
        await page.locator('#close-guide-dialog').click();
      }
    }
    results.push({ width, lang, panels: 4, tipNavigation: width > 600 });
    console.log(`${width}px ${lang}: guide panels, single-scroll dialogs, layer drag autoscroll, translations, and available topic links passed.`);
    await context.close();
  }
  assert.deepEqual(errors, [], 'browser JavaScript errors');
  await writeFile(resolve(output, 'results.json'), JSON.stringify(results, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
