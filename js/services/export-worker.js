import { renderExportDrawList } from './export-draw-list.js';

// A worker owns one export. Terminating it cancels rendering and releases its canvas.
globalThis.onmessage = async ({ data }) => {
  try {
    const blob = await renderExportDrawList(data);
    globalThis.postMessage({ ok: true, blob });
  } catch (error) {
    globalThis.postMessage({ ok: false, message: error?.message || 'Worker export failed' });
  }
};
