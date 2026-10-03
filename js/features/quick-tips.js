import { t } from '../core/i18n.js';

export const QUICK_TIP_KEYS = Object.freeze([
  'select', 'animation', 'layers', 'map', 'pin', 'attach', 'undo', 'paint', 'voice'
].map((key) => `header.quickTips.${key}`));

/** Header hints pause while being read; language updates cancel pending fades. */
export function wireQuickTips(context, openGuide) {
  const group = context.$('#quick-tips');
  const chip = context.$('#quick-tip-chip');
  const text = context.$('#quick-tip-text');
  if (!group || !chip || !text) return;

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let hovered = false;
  let focused = false;
  let index = 0;
  let fade;
  let timer;

  function render() {
    clearTimeout(fade);
    text.classList.remove('tip-fade-out');
    const tip = t(QUICK_TIP_KEYS[index]);
    text.textContent = tip;
    // The title exposes the complete hint if the header has to truncate it.
    chip.title = `${tip} — ${t('header.tipTitle')}`;
    group.classList.toggle('is-paused', hovered || focused);
  }

  function restart() {
    clearInterval(timer);
    render();
    if (hovered || focused || document.hidden) return;
    timer = setInterval(() => {
      if (!group.getClientRects().length || document.querySelector('dialog[open]')) return;
      if (!motion.matches) text.classList.add('tip-fade-out');
      fade = setTimeout(() => {
        index = (index + 1) % QUICK_TIP_KEYS.length;
        render();
      }, motion.matches ? 0 : 200);
    }, 7500);
  }

  const listeners = [];
  function listen(target, name, handler) {
    target.addEventListener(name, handler);
    listeners.push(() => target.removeEventListener(name, handler));
  }
  listen(chip, 'click', openGuide);
  listen(group, 'mouseenter', () => { hovered = true; restart(); });
  listen(group, 'mouseleave', () => { hovered = false; restart(); });
  listen(group, 'focusin', () => { focused = true; restart(); });
  listen(group, 'focusout', (event) => {
    focused = group.contains(event.relatedTarget);
    restart();
  });
  listen(window, 'languagechange', restart);
  listen(document, 'visibilitychange', restart);
  listen(motion, 'change', restart);
  restart();

  return () => {
    clearInterval(timer);
    clearTimeout(fade);
    listeners.forEach((remove) => remove());
  };
}
