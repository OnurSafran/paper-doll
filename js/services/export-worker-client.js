import { createExportDrawList } from './export-draw-list.js';

export function canExportInWorker() {
  return typeof globalThis.Worker === 'function'
    && typeof OffscreenCanvas === 'function'
    && typeof createImageBitmap === 'function';
}

/** SVG DOM assembly stays on the main thread; stage composition and encoding run in a worker. */
export async function exportInWorker(render, signal, {
  createWorker = () => new globalThis.Worker(new URL('./export-worker.js', import.meta.url), { type: 'module' }),
  timeoutMs = 30000
} = {}) {
  const drawList = createExportDrawList();
  let worker;
  try {
    if (signal?.aborted) throw new Error('Export cancelled');
    await render(drawList);
    if (signal?.aborted) throw new Error('Export cancelled');
    worker = createWorker();
    return await new Promise((resolve, reject) => {
      const finish = (error, blob = null) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        worker.onmessage = worker.onerror = worker.onmessageerror = null;
        if (error) reject(error);
        else resolve(blob);
      };
      const onAbort = () => finish(new Error('Export cancelled'));
      const timer = setTimeout(() => finish(new Error('Export worker timed out')), timeoutMs);
      worker.onmessage = ({ data }) => {
        if (data?.ok && data.blob instanceof Blob && data.blob.size > 0) finish(null, data.blob);
        else finish(new Error(data?.message || 'Invalid worker export response'));
      };
      worker.onerror = (event) => {
        event.preventDefault?.();
        finish(new Error('Export worker failed'));
      };
      worker.onmessageerror = () => finish(new Error('Export worker message failed'));
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) { onAbort(); return; }
      const payload = drawList.payload();
      try { worker.postMessage(payload, payload.images); }
      catch (error) { finish(error); }
    });
  } finally {
    worker?.terminate();
    await drawList.dispose();
  }
}
