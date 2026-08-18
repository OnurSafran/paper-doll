/**
 * Canvas history snapshots.
 * Stores the old pixels for only the rectangle an operation can change.
 */

export function normalizeHistoryRect(rect, canvasWidth, canvasHeight) {
  const source = rect || { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
  const x = Math.max(0, Math.min(canvasWidth, Math.floor(source.x ?? 0)));
  const y = Math.max(0, Math.min(canvasHeight, Math.floor(source.y ?? 0)));
  const right = Math.max(x, Math.min(canvasWidth, Math.ceil((source.x ?? 0) + (source.width ?? canvasWidth))));
  const bottom = Math.max(y, Math.min(canvasHeight, Math.ceil((source.y ?? 0) + (source.height ?? canvasHeight))));
  return { x, y, width: right - x, height: bottom - y };
}

function makeImageData(data, width, height) {
  if (typeof ImageData !== 'undefined') return new ImageData(data, width, height);
  return { data, width, height };
}

function markSnapshotRegion(imageData, rect) {
  imageData.x = rect.x;
  imageData.y = rect.y;
  return imageData;
}

export function captureHistorySnapshot(ctx, rect = null) {
  const bounds = normalizeHistoryRect(rect, ctx.canvas.width, ctx.canvas.height);
  return markSnapshotRegion(
    ctx.getImageData(bounds.x, bounds.y, bounds.width, bounds.height),
    bounds
  );
}

export function cropHistorySnapshot(imageData, rect) {
  const bounds = normalizeHistoryRect(rect, imageData.width, imageData.height);
  const rowBytes = bounds.width * 4;
  const data = new Uint8ClampedArray(bounds.width * bounds.height * 4);
  for (let row = 0; row < bounds.height; row += 1) {
    const sourceStart = ((bounds.y + row) * imageData.width + bounds.x) * 4;
    data.set(imageData.data.subarray(sourceStart, sourceStart + rowBytes), row * rowBytes);
  }
  return markSnapshotRegion(makeImageData(data, bounds.width, bounds.height), bounds);
}

export function snapshotRect(snapshot, canvasWidth, canvasHeight) {
  return normalizeHistoryRect({
    x: snapshot?.x ?? 0,
    y: snapshot?.y ?? 0,
    width: snapshot?.width ?? canvasWidth,
    height: snapshot?.height ?? canvasHeight
  }, canvasWidth, canvasHeight);
}

function regionDataEqual(currentData, snapshot, bounds, sourceX, sourceY) {
  const rowBytes = bounds.width * 4;
  const wordCount = Math.floor(rowBytes / 4);
  const currentWords = new Uint32Array(currentData.buffer, currentData.byteOffset, currentData.byteLength / 4);
  const snapshotWords = new Uint32Array(snapshot.data.buffer, snapshot.data.byteOffset, snapshot.data.byteLength / 4);
  const currentRowWords = rowBytes / 4;
  const snapshotRowWords = snapshot.width;

  for (let row = 0; row < bounds.height; row += 1) {
    const currentOffset = row * currentRowWords;
    const snapshotOffset = ((sourceY + row) * snapshotRowWords) + sourceX;
    for (let word = 0; word < wordCount; word += 1) {
      if (currentWords[currentOffset + word] !== snapshotWords[snapshotOffset + word]) return false;
    }
  }

  const tailStart = wordCount * 4;
  for (let row = 0; row < bounds.height; row += 1) {
    const currentOffset = row * rowBytes + tailStart;
    const snapshotOffset = ((sourceY + row) * snapshot.width + sourceX) * 4 + tailStart;
    for (let byte = tailStart; byte < rowBytes; byte += 1) {
      if (currentData[currentOffset + byte - tailStart] !== snapshot.data[snapshotOffset + byte - tailStart]) return false;
    }
  }
  return true;
}

export function historySnapshotChanged(ctx, snapshot, rect = null) {
  if (!snapshot) return false;
  const bounds = rect
    ? normalizeHistoryRect(rect, ctx.canvas.width, ctx.canvas.height)
    : snapshotRect(snapshot, ctx.canvas.width, ctx.canvas.height);
  const sourceX = bounds.x - (snapshot.x ?? 0);
  const sourceY = bounds.y - (snapshot.y ?? 0);
  if (sourceX < 0 || sourceY < 0 || sourceX + bounds.width > snapshot.width || sourceY + bounds.height > snapshot.height) {
    return true;
  }
  const current = ctx.getImageData(bounds.x, bounds.y, bounds.width, bounds.height);
  return !regionDataEqual(current.data, snapshot, bounds, sourceX, sourceY);
}

export function restoreHistorySnapshot(ctx, snapshot) {
  if (!snapshot) return;
  ctx.putImageData(snapshot, snapshot.x ?? 0, snapshot.y ?? 0);
}
