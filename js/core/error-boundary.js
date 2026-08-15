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

export function executeSafeTeardown({ cancelPointer, stopAudio, cancelExport, cancelStorage, onNotify } = {}) {
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

  if (typeof cancelStorage === 'function') {
    try {
      cancelStorage();
    } catch (err) {
      warnings.push(`Storage cancel failed: ${err?.message || 'unknown'}`);
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
