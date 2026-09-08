import { canExportInWorker, exportInWorker } from './export-worker-client.js';
/**
 * Export Service
 * Single authority for deterministic PNG scene export with immutable snapshot isolation.
 */

import { getAsset } from '../core/asset-catalog.js';
import { loadAssetSvg } from '../core/svg-loader.js';
import { cloneScene } from '../core/state-schema.js';
import { t } from '../core/i18n.js';
import { getEntityBounds } from '../domain/scene-rules.js';
import { applyMouthExpression } from '../core/mouth-expression.js';
import { getBackgroundLayout } from '../core/background-layout.js';
import { createExportDollSvg } from '../core/doll-svg.js';
import { createBubbleSvg } from '../core/bubble-svg.js';
import {
  CHARACTER_DIMENSIONS,
  LIMITS,
  isCustomAssetId
} from '../domain/vocabulary.js';
import {
  evaluateAttachedEntityTransform,
  evaluateCharacterPose,
  evaluateProceduralBlink,
  resolveEntityAttachmentTransform
} from '../domain/motion-evaluator.js';

export function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

/**
 * Converts an SVG DOM element to an ImageBitmap or fallback Image for canvas drawing.
 * Callers own returned ImageBitmaps and must close them after drawing.
 */
export async function svgElementToImage(svgElement, width, height) {
  const clone = svgElement.cloneNode(true);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  // SVG bitmap decoding is not supported by every browser.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob);
    } catch {
      // Retain the established SVG image decoder as the compatibility path.
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}



/**
 * Creates an Export Service instance that renders snapshot-isolated PNG images.
 */
export function createExportService(options = {}) {
  let isExporting = false;
  let activeGeneration = 0;
  let abortController = null;
  const getAssetFn = options.getAsset ?? getAsset;
  const loadSvgFn = options.loadAssetSvg ?? loadAssetSvg;
  const toImageFn = options.svgElementToImage ?? svgElementToImage;
  const customArtRepo = options.customArtRepo;
  const now = options.now ?? (() => new Date());
  const onProgress = options.onProgress ?? (() => {});

  function cancel() {
    if (abortController) {
      abortController.abort();
    }
    onProgress({ percent: 0, phase: 'cancelled' });
  }

  /** @param {HTMLCanvasElement | OffscreenCanvas | ReturnType<typeof import('./export-draw-list.js').createExportDrawList>} canvas */
  async function renderSceneToCanvas(sceneSnapshot, canvas = document.createElement('canvas'), signal = null, options = {}) {
    const effectiveSignal = (signal && typeof signal.aborted === 'boolean') ? signal : null;
    const effectiveOptions = (signal && typeof signal === 'object' && typeof signal.aborted !== 'boolean') ? signal : (options || {});
    if (effectiveSignal?.aborted) throw new Error('Export cancelled');

    const animTimeMs = Number.isFinite(effectiveOptions.animationTimeMs) ? effectiveOptions.animationTimeMs : 0;
    const isAnimatedExport = animTimeMs > 0 || Boolean(effectiveOptions.playbackEnabled);

    const snapshot = cloneScene(sceneSnapshot);
    const stageWidth = snapshot.stageWidth || LIMITS.STAGE_WIDTH;
    canvas.width = stageWidth;
    canvas.height = LIMITS.STAGE_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not acquire 2D canvas context');

    const bitmaps = new Set();
    const decodeImage = async (...args) => {
      const image = await toImageFn(...args);
      if (typeof image?.close === 'function') bitmaps.add(image);
      return image;
    };
    try {
      try {
        const layout = getBackgroundLayout(getAssetFn(snapshot.backgroundId), stageWidth);
        const bgSvg = await loadSvgFn(snapshot.backgroundId);
        const bgImg = await decodeImage(bgSvg, layout.tileWidth, LIMITS.STAGE_HEIGHT);
        for (const tileX of layout.tilePositions) {
          ctx.drawImage(bgImg, tileX, 0, layout.tileWidth, LIMITS.STAGE_HEIGHT);
        }
      } catch {
        ctx.fillStyle = '#f6efe4';
        ctx.fillRect(0, 0, stageWidth, LIMITS.STAGE_HEIGHT);
      }

      const isLooping = snapshot.animationSettings?.loop !== false;
      const allEntitiesMap = new Map(snapshot.entities.map((e) => [e.instanceId, e]));
      const attachedTransformMemo = new Map();
      const characterEntities = new Map();
      const characterPoses = new Map();
      for (const ent of snapshot.entities) {
        if (ent.kind === 'character') {
          characterEntities.set(ent.instanceId, ent);
          characterPoses.set(ent.instanceId, evaluateCharacterPose(ent, animTimeMs, { playbackEnabled: isAnimatedExport, loop: isLooping, getAsset: getAssetFn }));
        }
      }

      const ordered = [...snapshot.entities].sort((a, b) => a.order - b.order);
      for (const entity of ordered) {
        if (effectiveSignal?.aborted) throw new Error('Export cancelled');
        ctx.save();

        let attachedTransform = null;
        if (entity.attachedTo) {
          attachedTransform = resolveEntityAttachmentTransform(
            entity,
            allEntitiesMap,
            characterPoses,
            getAssetFn,
            attachedTransformMemo
          );
        }

        ctx.translate(entity.x, entity.y);
        if (attachedTransform) {
          ctx.translate(attachedTransform.tx, attachedTransform.ty);
          if (attachedTransform.rot) ctx.rotate(attachedTransform.rot * Math.PI / 180);
        }
        const flipSign = entity.flipped ? -1 : 1;
        ctx.scale(flipSign * entity.scale, entity.scale);

        if (entity.kind === 'character') {
          const pose = characterPoses.get(entity.instanceId) || evaluateCharacterPose(entity, animTimeMs, { playbackEnabled: isAnimatedExport, loop: isLooping, getAsset: getAssetFn });
          ctx.translate(pose.root.x, pose.root.y);
          if (pose.root.rotate) ctx.rotate(pose.root.rotate * Math.PI / 180);
          ctx.scale(pose.root.scaleX, pose.root.scaleY);

          const blink = (isAnimatedExport && pose.isAnimated)
            ? evaluateProceduralBlink(entity.instanceId, animTimeMs, { reducedMotion: false })
            : { scaleY: 1.0 };

          const dollSvg = await createExportDollSvg(entity.characterSnapshot, pose.expression, {
            loadAssetSvg: loadSvgFn,
            customArtRepo,
            getAsset: getAssetFn,
            enforceFit: false,
            expressionIntensity: pose.expressionIntensity,
            headTransform: pose.head,
            blinkScaleY: blink.scaleY,
            pose
          });
          const dollImg = await decodeImage(dollSvg, 300, 450);
          ctx.drawImage(
            dollImg,
            -CHARACTER_DIMENSIONS.BASE_WIDTH * CHARACTER_DIMENSIONS.GROUND_ANCHOR.x,
            -CHARACTER_DIMENSIONS.BASE_HEIGHT * CHARACTER_DIMENSIONS.GROUND_ANCHOR.y,
            CHARACTER_DIMENSIONS.BASE_WIDTH,
            CHARACTER_DIMENSIONS.BASE_HEIGHT
          );
        } else if (entity.kind === 'bubble') {
          const bounds = getEntityBounds(entity, getAssetFn);
          const bubbleSvg = createBubbleSvg(entity);
          const renderW = bounds.width / entity.scale;
          const renderH = bounds.height / entity.scale;
          const bubbleImg = await decodeImage(bubbleSvg, renderW, renderH);
          ctx.drawImage(
            bubbleImg,
            -renderW * bounds.anchorX,
            -renderH * bounds.anchorY,
            renderW,
            renderH
          );
        } else {
          const bounds = getEntityBounds(entity, getAssetFn);
          const renderW = bounds.width / entity.scale;
          const renderH = bounds.height / entity.scale;
          const asset = getAssetFn(entity.sourceId);
          let rendered = false;
          if (isCustomAssetId(entity.sourceId)) {
            const url = await customArtRepo?.getTrackedObjectUrl?.(entity.sourceId);
            if (url) {
              try {
                const propImg = await loadImageFromUrl(url);
                ctx.drawImage(
                  propImg,
                  -renderW * bounds.anchorX,
                  -renderH * bounds.anchorY,
                  renderW,
                  renderH
                );
                rendered = true;
              } catch {
                rendered = false;
              }
            }
          } else if (asset) {
            try {
              const propSvg = await loadSvgFn(asset.id);
              const propImg = await decodeImage(propSvg, renderW, renderH);
              ctx.drawImage(
                propImg,
                -renderW * bounds.anchorX,
                -renderH * bounds.anchorY,
                renderW,
                renderH
              );
              rendered = true;
            } catch {
              rendered = false;
            }
          }
          if (!rendered) {
            const px = -renderW * bounds.anchorX;
            const py = -renderH * bounds.anchorY;
            ctx.fillStyle = 'rgba(235, 230, 220, 0.85)';
            ctx.fillRect(px, py, renderW, renderH);
            ctx.strokeStyle = '#c4b5a2';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(px, py, renderW, renderH);
            ctx.setLineDash([]);
            ctx.fillStyle = '#8c7e6c';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', px + renderW / 2, py + renderH / 2);
          }
        }
        ctx.restore();
      }

      return canvas;
    } finally {
      try {
        if ('flush' in canvas) await canvas.flush();
      } finally {
        for (const bitmap of bitmaps) bitmap.close();
      }
    }
  }

  async function exportSceneBlob(sceneSnapshot, options = {}) {
    if (isExporting) {
      return { ok: false, code: 'EXPORT_IN_PROGRESS', message: 'An export is already in progress.' };
    }
    isExporting = true;
    const currentGeneration = ++activeGeneration;
    abortController = new AbortController();
    const onExternalAbort = () => abortController?.abort();
    if (options.signal?.aborted) abortController.abort();
    else options.signal?.addEventListener('abort', onExternalAbort, { once: true });
    const effectiveSignal = abortController.signal;
    const reportProgress = options.onProgress || onProgress;

    try {
      reportProgress({ percent: 10, phase: 'preparing' });
      if (effectiveSignal.aborted) throw new Error('Export cancelled');
      const snapshot = cloneScene(sceneSnapshot);
      reportProgress({ percent: 30, phase: 'rendering' });
      let blob;
      if (options.useWorker !== false && canExportInWorker()) {
        try {
          blob = await exportInWorker(
            canvas => renderSceneToCanvas(snapshot, canvas, effectiveSignal, options),
            effectiveSignal
          );
        } catch {
          if (effectiveSignal.aborted) throw new Error('Export cancelled');
          // Unsupported worker contexts, transfer failures, or failed encoders use the same snapshot.
        }
      }
      if (!blob) {
        const canvas = createExportCanvas();
        await renderSceneToCanvas(snapshot, canvas, effectiveSignal, options);
        if (effectiveSignal.aborted) throw new Error('Export cancelled');
        reportProgress({ percent: 75, phase: 'encoding' });
        if ('convertToBlob' in canvas) {
          try {
            blob = await canvas.convertToBlob({ type: 'image/png' });
          } catch {
            if (effectiveSignal.aborted) throw new Error('Export cancelled');
            const fallbackCanvas = document.createElement('canvas');
            await renderSceneToCanvas(snapshot, fallbackCanvas, effectiveSignal, options);
            blob = await new Promise((resolve) => fallbackCanvas.toBlob(resolve, 'image/png'));
          }
        } else {
          blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        }
      }
      if (!blob) {
        return { ok: false, code: 'BLOB_CREATION_FAILED', message: 'Could not generate PNG image blob.' };
      }
      if (effectiveSignal.aborted) throw new Error('Export cancelled');
      reportProgress({ percent: 100, phase: 'complete' });
      const filename = `paper-doll-scene-${now().toISOString().slice(0, 10)}.png`;
      return { ok: true, blob, filename };
    } catch (error) {
      if (effectiveSignal?.aborted || error?.message === 'Export cancelled') {
        return { ok: false, code: 'EXPORT_CANCELLED', message: 'Export was cancelled.' };
      }
      return { ok: false, code: 'EXPORT_FAILED', error, message: 'Could not export scene image.' };
    } finally {
      if (currentGeneration === activeGeneration) isExporting = false;
      options.signal?.removeEventListener?.('abort', onExternalAbort);
      if (activeGeneration === currentGeneration) {
        isExporting = false;
        abortController = null;
      }
    }
  }

  async function exportSceneAndDownload(sceneSnapshot, exportOptions = {}) {
    const result = await exportSceneBlob(sceneSnapshot, exportOptions);
    if (!result.ok) return result;

    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 6000);
    return { ok: true, filename: result.filename };
  }

  return {
    isExporting: () => isExporting,
    cancel,
    renderSceneToCanvas,
    exportSceneBlob,
    exportSceneAndDownload
  };
}

function createExportCanvas() {
  if (typeof OffscreenCanvas === 'function') {
    try {
      const canvas = new OffscreenCanvas(1, 1);
      if (typeof canvas.convertToBlob === 'function' && canvas.getContext('2d')) return canvas;
    } catch {
      // Some environments expose the API without a usable 2D implementation.
    }
  }
  return document.createElement('canvas');
}
