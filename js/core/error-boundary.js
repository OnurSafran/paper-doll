/**
 * Top-level error classification and safe teardown.
 * Ensures diagnostic codes are privacy-safe and never leak player content or PII.
 */

export function classifyError(error) {
  if (!error) return 'ERR_RUNTIME_UNKNOWN';

  const name = typeof error === 'object' && error?.name ? String(error.name) : '';
  const message = typeof error === 'object' && error?.message ? String(error.message) : String(error);

  if (name === 'QuotaExceededError' || /quota/i.test(message)) {
    return 'ERR_STORAGE_QUOTA';
  }
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || /permission|microphone|audio/i.test(message)) {
    return 'ERR_MEDIA_PERMISSION';
  }
  if (name === 'TypeError') {
    return 'ERR_RUNTIME_TYPE';
  }
  if (name === 'ReferenceError') {
    return 'ERR_RUNTIME_REFERENCE';
  }
  if (name === 'SyntaxError') {
    return 'ERR_SYNTAX';
  }
  if (name === 'NetworkError' || /fetch|network|offline/i.test(message)) {
    return 'ERR_NETWORK';
  }
  if (name === 'SecurityError') {
    return 'ERR_SECURITY';
  }
  return 'ERR_RUNTIME';
}

export function createDisposableRegistry() {
  const disposables = new Map();
  return {
    register(disposable) {
      const cleanup = typeof disposable === 'function' ? disposable
        : typeof disposable?.teardown === 'function' ? () => disposable.teardown()
        : typeof disposable?.destroy === 'function' ? () => disposable.destroy()
        : null;
      if (!cleanup) return () => {};
      disposables.set(disposable, cleanup);
      return () => disposables.delete(disposable);
    },
    unregister(disposable) {
      disposables.delete(disposable);
    },
    disposeAll() {
      const warnings = [];
      const pending = [...disposables.values()];
      // Clear first so nested disposal cannot invoke a cleanup twice.
      disposables.clear();
      for (const cleanup of pending) {
        try {
          cleanup();
        } catch (err) {
          warnings.push(err?.message || 'teardown error');
        }
      }
      return { ok: true, warnings };
    },
    get size() {
      return disposables.size;
    }
  };
}

export function executeSafeTeardown(options = {}) {
  // If a DisposableRegistry instance was directly passed:
  if (options && typeof options.disposeAll === 'function') {
    return options.disposeAll();
  }

  const {
    cancelPointer,
    stopAudio,
    stopAnimation,
    cancelExport,
    cancelStorage,
    cancelPaint,
    registry,
    disposables,
    onNotify
  } = options;

  const warnings = [];

  if (typeof cancelPointer === 'function') {
    try {
      cancelPointer();
    } catch (err) {
      warnings.push(`Pointer cancel failed: ${err?.message || 'unknown'}`);
    }
  }

  if (typeof stopAudio === 'function') {
    try {
      stopAudio();
    } catch (err) {
      warnings.push(`Audio teardown failed: ${err?.message || 'unknown'}`);
    }
  }

  if (typeof cancelExport === 'function') {
    try {
      cancelExport();
    } catch (err) {
      warnings.push(`Export cancel failed: ${err?.message || 'unknown'}`);
    }
  }

  if (typeof stopAnimation === 'function') {
    try {
      stopAnimation();
    } catch (err) {
      warnings.push(`Animation teardown failed: ${err?.message || 'unknown'}`);
    }
  }

  if (typeof cancelStorage === 'function') {
    try {
      cancelStorage();
    } catch (err) {
      warnings.push(`Storage cancel failed: ${err?.message || 'unknown'}`);
    }
  }

  if (typeof cancelPaint === 'function') {
    try {
      cancelPaint();
    } catch (err) {
      warnings.push(`Paint cancel failed: ${err?.message || 'unknown'}`);
    }
  }

  if (registry && typeof registry.disposeAll === 'function') {
    const regResult = registry.disposeAll();
    if (Array.isArray(regResult?.warnings)) {
      warnings.push(...regResult.warnings);
    }
  }

  if (Array.isArray(disposables) || disposables instanceof Set) {
    for (const item of disposables) {
      try {
        if (typeof item === 'function') item();
        else if (typeof item?.teardown === 'function') item.teardown();
        else if (typeof item?.destroy === 'function') item.destroy();
      } catch (err) {
        warnings.push(err?.message || 'disposable error');
      }
    }
  }

  if (typeof onNotify === 'function') {
    try {
      onNotify({ ok: true, warnings });
    } catch {
      // Best effort notification
    }
  }

  return { ok: true, warnings };
}
