import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

test('manifest updater discovers CSS and JS, removes deleted files, preserves script versions and is idempotent', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'paper-doll-manifest-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const dir of ['scripts', 'css/nested', 'js/core']) await mkdir(join(root, dir), { recursive: true });
  for (const script of ['update-sw-manifest.mjs', 'validate-cache-busting.mjs']) {
    await copyFile(new URL(`../scripts/${script}`, import.meta.url), join(root, 'scripts', script));
  }
  await writeFile(join(root, 'index.html'), '<link rel="stylesheet" href="./css/app.css"><script type="module" src="./js/app.js?v=99"></script>');
  await writeFile(join(root, 'manifest.webmanifest'), '{}');
  await writeFile(join(root, 'css/app.css'), '@import "nested/parent.css";');
  await writeFile(join(root, 'css/nested/parent.css'), '@import "child.css";');
  await writeFile(join(root, 'css/nested/child.css'), 'body { color: red; }');
  await writeFile(join(root, 'js/app.js'), 'import "./core/new.js";');
  await writeFile(join(root, 'js/core/new.js'), 'export const value = 1;');
  await writeFile(join(root, 'sw.js'), "const CACHE_NAME = 'paper-doll-studio-v0';\nconst APP_SHELL = ['./', './index.html', './manifest.webmanifest', './css/deleted.css?v=0', './js/deleted.js'];\n");
  const run = (name) => execFileSync(process.execPath, [join(root, 'scripts', name)], { cwd: root, encoding: 'utf8' });
  run('update-sw-manifest.mjs');
  run('validate-cache-busting.mjs');
  const before = await readFile(join(root, 'sw.js'), 'utf8');
  assert.match(before, /\.\/css\/nested\/child\.css\?v=[a-f0-9]{8}/);
  assert.match(before, /\.\/js\/core\/new\.js/);
  assert.match(before, /\.\/js\/app\.js\?v=99/);
  assert.doesNotMatch(before, /deleted/);
  run('update-sw-manifest.mjs');
  assert.equal(await readFile(join(root, 'sw.js'), 'utf8'), before);
  await rm(join(root, 'css/nested/child.css'));
  await writeFile(join(root, 'css/nested/parent.css'), 'body { color: blue; }');
  await rm(join(root, 'js/core/new.js'));
  await writeFile(join(root, 'js/app.js'), '');
  run('update-sw-manifest.mjs');
  run('validate-cache-busting.mjs');
  const after = await readFile(join(root, 'sw.js'), 'utf8');
  assert.doesNotMatch(after, /child\.css|core\/new\.js/);
  assert.notEqual(after, before);
});
