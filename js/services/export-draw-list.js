/** Record the export renderer's canvas operations without allocating a stage canvas. */
export function createExportDrawList() {
  const commands = [];
  const images = [];
  const pending = [];
  const indices = new Map();
  let decodeError = null;
  const context = {
    drawImage(image, ...args) {
      if (!indices.has(image)) {
        const index = images.length;
        indices.set(image, index);
        images.push(null);
        // Copy before the renderer releases its source bitmap. The copy is transferred.
        pending.push(createImageBitmap(image).then(bitmap => { images[index] = bitmap; }, error => { decodeError = error; }));
      }
      commands.push(['drawImage', indices.get(image), ...args]);
    }
  };
  for (const name of ['save', 'restore', 'translate', 'rotate', 'scale', 'fillRect', 'strokeRect', 'setLineDash', 'fillText']) {
    context[name] = (...args) => commands.push([name, ...args]);
  }
  for (const name of ['fillStyle', 'strokeStyle', 'lineWidth', 'font', 'textAlign', 'textBaseline']) {
    Object.defineProperty(context, name, { set: value => { commands.push(['set', name, value]); } });
  }
  return {
    width: 0,
    height: 0,
    getContext: () => context,
    async flush() {
      await Promise.all(pending);
      if (decodeError) throw decodeError;
    },
    payload() { return { width: this.width, height: this.height, commands, images }; },
    async dispose() {
      await Promise.all(pending);
      for (const image of images) image?.close();
    }
  };
}

/** Shared replay function keeps the worker protocol small and directly testable. */
export async function renderExportDrawList({ width, height, commands, images }, makeCanvas = (w, h) => new OffscreenCanvas(w, h)) {
  try {
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Worker canvas is unavailable');
    for (const [operation, ...args] of commands) {
      if (operation === 'set') ctx[args[0]] = args[1];
      else if (operation === 'drawImage') ctx.drawImage(images[args[0]], args[1], args[2], args[3], args[4]);
      else ctx[operation](...args);
    }
    return await canvas.convertToBlob({ type: 'image/png' });
  } finally {
    for (const image of images) image?.close();
  }
}
