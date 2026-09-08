/** Queued application dialogs and accessible announcements. */
import { t } from './core/i18n.js';

export function createAppDialogs(context) {
  let confirmQueue = Promise.resolve();

  function miniButton(label, title, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.title = title;
    button.setAttribute('aria-label', title);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  function announceForScreenReader(message) {
    if (!message) return;
    const region = context.$('#sr-announcements');
    if (region) {
      region.textContent = '';
      window.setTimeout(() => {
        region.textContent = message;
      }, 50);
    }
  }

  function showToast(message) {
    if (!message) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    context.$('#toast-region')?.append(toast);
    window.setTimeout(() => toast.remove(), 2900);
    announceForScreenReader(message);
  }

  function askConfirm(title, message) {
    const show = () => new Promise((resolve) => {
      const dialog = context.$('#confirm-dialog');
      if (!dialog) {
        resolve(true);
        return;
      }
      dialog.returnValue = '';
      context.$('#confirm-title').textContent = title;
      context.$('#confirm-message').textContent = message;
      const ok = context.$('#confirm-ok');
      const cancel = context.$('#confirm-cancel');
      const onOk = () => { cleanup(); resolve(true); };
      const onCancel = () => { cleanup(); resolve(false); };
      const onClose = () => { cleanup(); resolve(dialog.returnValue === 'ok'); };
      function cleanup() {
        ok?.removeEventListener('click', onOk);
        cancel?.removeEventListener('click', onCancel);
        dialog?.removeEventListener('close', onClose);
        if (dialog.open) dialog.close();
      }
      ok?.addEventListener('click', onOk);
      cancel?.addEventListener('click', onCancel);
      dialog.addEventListener('close', onClose);
      dialog.showModal();
    });
    const result = confirmQueue.then(show, show);
    confirmQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  let alertQueue = Promise.resolve();

  function showAlert(message, title = t('alertDialog.defaultTitle')) {
    const show = () => new Promise((resolve) => {
      const dialog = context.$('#alert-dialog');
      dialog.returnValue = '';
      context.$('#alert-title').textContent = title;
      context.$('#alert-message').textContent = message;
      const ok = context.$('#alert-ok');
      const onOk = () => { cleanup(); resolve(undefined); };
      const onClose = () => { cleanup(); resolve(undefined); };
      function cleanup() {
        ok.removeEventListener('click', onOk);
        dialog.removeEventListener('close', onClose);
        if (dialog.open) dialog.close();
      }
      ok.addEventListener('click', onOk);
      dialog.addEventListener('close', onClose);
      dialog.showModal();
      ok.focus();
    });
    const result = alertQueue.then(show, show);
    alertQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  let promptQueue = Promise.resolve();

  function askPrompt(title, message, initialValue = '') {
    const show = () => new Promise((resolve) => {
      const dialog = context.$('#prompt-dialog');
      if (!dialog) { resolve(null); return; }
      dialog.returnValue = '';
      context.$('#prompt-title').textContent = title;
      context.$('#prompt-message').textContent = message;
      const input = context.$('#prompt-input');
      const form = context.$('#prompt-form');
      const cancel = context.$('#prompt-cancel');
      input.value = initialValue;
      let settled = false;
      const finish = (value) => { if (settled) return; settled = true; cleanup(); resolve(value); };
      // Submit rather than the OK button's click: Enter inside the field reaches the
      // form directly, so the prompt does not depend on implicit-submission quirks.
      const onSubmit = (event) => { event.preventDefault(); finish(input.value); };
      const onCancel = () => finish(null);
      const onClose = () => finish(dialog.returnValue === 'ok' ? input.value : null);
      function cleanup() {
        form.removeEventListener('submit', onSubmit);
        cancel.removeEventListener('click', onCancel);
        dialog.removeEventListener('close', onClose);
        if (dialog.open) dialog.close();
      }
      form.addEventListener('submit', onSubmit);
      cancel.addEventListener('click', onCancel);
      dialog.addEventListener('close', onClose);
      dialog.showModal();
      input.focus();
      input.select?.();
    });
    const result = promptQueue.then(show, show);
    promptQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  return { miniButton, announceForScreenReader, showToast, askConfirm, showAlert, askPrompt };
}
