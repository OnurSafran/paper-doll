import test from 'node:test';
import assert from 'node:assert/strict';
import { createExportDrawList, renderExportDrawList } from '../js/services/export-draw-list.js';
import { exportInWorker } from '../js/services/export-worker-client.js';
import { createExportService } from '../js/services/export-service.js';

function bitmap() { return { closes: 0, close() { this.closes++; } }; }
function globals(values) {
  const saved = Object.fromEntries(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, values);
  return () => { for (const [key, descriptor] of Object.entries(saved)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } };
}

test('draw list preserves transforms, styles, image reuse, and releases worker images', async () => {
  const copy = bitmap();
  const restore = globals({ createImageBitmap: async () => copy });
  const list = createExportDrawList();
  try {
    list.width = 4800; list.height = 900;
    const ctx = list.getContext();
    const source = bitmap();
    ctx.fillStyle = '#f6efe4'; ctx.fillRect(0, 0, 4800, 900);
    ctx.save(); ctx.translate(300, 700); ctx.rotate(0.5); ctx.scale(-2, 2);
    ctx.drawImage(source, -50, -100, 100, 100);
    ctx.drawImage(source, 50, -100, 100, 100); ctx.restore();
    await list.flush();
    const payload = list.payload();
    assert.equal(payload.images.length, 1);
    const calls = [];
    const replay = new Proxy({}, { set: (_, key, value) => { calls.push(['set', key, value]); return true; }, get: (_, key) => (...args) => calls.push([key, ...args]) });
    const blob = await renderExportDrawList(payload, (width, height) => {
      assert.deepEqual([width, height], [4800, 900]);
      return { getContext: () => replay, convertToBlob: async () => new Blob(['png']) };
    });
    assert.equal(blob.size, 3);
    assert.deepEqual(calls, payload.commands.map(([op, ...args]) => op === 'drawImage' ? [op, copy, ...args.slice(1)] : [op, ...args]));
    assert.equal(copy.closes, 1);
    assert.equal(source.closes, 0);
  } finally { restore(); }
});

test('worker client transfers bitmap copies and terminates on success, error, timeout, and cancellation', async () => {
  for (const mode of ['success', 'error', 'messageerror', 'timeout', 'abort', 'post-failure']) {
    const copy = bitmap();
    const restore = globals({ createImageBitmap: async () => copy });
    const abort = new AbortController();
    let terminated = 0;
    const worker = {
      terminate() { terminated++; },
      postMessage(payload, transfer) {
        assert.equal(payload.images[0], copy);
        assert.deepEqual(transfer, [copy]);
        if (mode === 'post-failure') throw new Error('transfer failed');
        queueMicrotask(() => {
          if (mode === 'success') this.onmessage({ data: { ok: true, blob: new Blob(['png']) } });
          if (mode === 'error') this.onerror({ preventDefault() {} });
          if (mode === 'messageerror') this.onmessageerror();
          if (mode === 'abort') abort.abort();
        });
      }
    };
    try {
      const result = exportInWorker(async list => {
        list.getContext().drawImage({}, 0, 0, 10, 10);
        await list.flush();
      }, abort.signal, { createWorker: () => worker, timeoutMs: 10 });
      if (mode === 'success') assert.equal((await result).size, 3);
      else await assert.rejects(result, /failed|timed out|cancelled/);
      assert.equal(terminated, 1, mode);
      assert.equal(copy.closes, 1, mode);
      assert.equal(worker.onmessage, null, mode);
    } finally { restore(); }
  }
});

test('bitmap preparation failure and late cancellation clean up without starting a worker', async () => {
  for (const mode of ['decode', 'abort']) {
    const copy = bitmap();
    const abort = new AbortController();
    let count = 0;
    const restore = globals({ createImageBitmap: async () => {
      count++;
      if (count === 2 && mode === 'decode') throw new Error('decode failed');
      if (mode === 'abort') abort.abort();
      return copy;
    } });
    try {
      await assert.rejects(exportInWorker(async list => {
        list.getContext().drawImage({}, 0, 0, 10, 10);
        if (mode === 'decode') list.getContext().drawImage({}, 10, 0, 10, 10);
        await list.flush();
      }, abort.signal, { createWorker: () => assert.fail('Should not create worker') }), /decode failed|cancelled/);
      assert.equal(copy.closes, 1);
    } finally { restore(); }
  }
});

test('worker renderer releases images when a context or encoder fails', async () => {
  for (const mode of ['context', 'encoder']) {
    const image = bitmap();
    await assert.rejects(renderExportDrawList({ width: 1600, height: 900, images: [image], commands: [] }, () => ({
      getContext: () => mode === 'context' ? null : {},
      convertToBlob: async () => { throw new Error('encoder failed'); }
    })), /unavailable|encoder failed/);
    assert.equal(image.closes, 1);
  }
});

test('export service falls back after worker failure and retains the snapshot and in-flight lock', async () => {
  const draws = [];
  let sourceClosed = 0;
  let workerTerminated = 0;
  let unblock;
  const blocked = new Promise(resolve => { unblock = resolve; });
  const restore = globals({
    createImageBitmap: async () => bitmap(),
    Worker: class { postMessage() { queueMicrotask(() => this.onerror({})); } terminate() { workerTerminated++; } },
    OffscreenCanvas: class { getContext() { return null; } },
    document: { createElement: () => ({
      getContext: () => ({ drawImage: (...args) => draws.push(args), fillRect() {} }),
      toBlob: callback => callback(new Blob(['fallback']))
    }) }
  });
  const loaded = [];
  const scene = { backgroundId: 'bg_original', stageWidth: 4800, entities: [] };
  const service = createExportService({
    getAsset: () => null,
    loadAssetSvg: async id => { loaded.push(id); await blocked; return {}; },
    svgElementToImage: async () => ({ close() { sourceClosed++; } })
  });
  try {
    const result = service.exportSceneBlob(scene);
    scene.backgroundId = 'bg_changed';
    assert.equal((await service.exportSceneBlob(scene)).code, 'EXPORT_IN_PROGRESS');
    unblock();
    assert.equal((await result).ok, true);
    assert.deepEqual(loaded, ['bg_original', 'bg_original']);
    assert.ok(draws.length > 0);
    assert.equal(sourceClosed, 2);
    assert.equal(workerTerminated, 1);
    assert.equal(service.isExporting(), false);
  } finally { restore(); }
});

test('cancelling an active worker export skips fallback and releases the service lock', async () => {
  let startWorker;
  const started = new Promise(resolve => { startWorker = resolve; });
  let terminated = 0;
  const restore = globals({
    createImageBitmap: async () => bitmap(),
    Worker: class { postMessage() { startWorker(); } terminate() { terminated++; } },
    OffscreenCanvas: class {},
    document: { createElement: () => assert.fail('Cancelled export must not fall back') }
  });
  try {
    const service = createExportService({ getAsset: () => null, loadAssetSvg: async () => ({}), svgElementToImage: async () => bitmap() });
    const result = service.exportSceneBlob({ backgroundId: 'bg', entities: [] });
    await started;
    service.cancel();
    assert.equal((await result).code, 'EXPORT_CANCELLED');
    assert.equal(service.isExporting(), false);
    assert.equal(terminated, 1);
  } finally { restore(); }
});

test('renderExportDrawList supports 3, 5, and 9 argument drawImage commands', async () => {
  const img = { close: () => {} };
  const calls = [];
  const fakeCtx = {
    drawImage: (...args) => calls.push(args)
  };
  const payload = {
    width: 100,
    height: 100,
    images: [img],
    commands: [
      ['drawImage', 0, 10, 20],
      ['drawImage', 0, 10, 20, 30, 40],
      ['drawImage', 0, 1, 2, 3, 4, 5, 6, 7, 8]
    ]
  };
  await renderExportDrawList(payload, () => ({
    getContext: () => fakeCtx,
    convertToBlob: async () => new Blob(['ok'])
  }));
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0], [img, 10, 20]);
  assert.deepEqual(calls[1], [img, 10, 20, 30, 40]);
  assert.deepEqual(calls[2], [img, 1, 2, 3, 4, 5, 6, 7, 8]);
});
