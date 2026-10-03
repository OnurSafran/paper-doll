import { t } from '../core/i18n.js';

const QUICK_TIPS = Object.freeze([
  { key: 'select', mode: 'play', tab: 'features', target: 'guide-feature-play' },
  { key: 'animation', mode: 'play', tab: 'features', target: 'guide-feature-animation' },
  { key: 'layers', mode: 'play', tab: 'tips', target: 'guide-tip-layers' },
  { key: 'map', mode: 'play', tab: 'features', target: 'guide-feature-map' },
  { key: 'pin', mode: 'play', tab: 'tips', target: 'guide-tip-pin' },
  { key: 'undo', tab: 'tips', target: 'guide-tip-undo' },
  { key: 'paint', mode: 'paint', tab: 'features', target: 'guide-feature-paint' },
  { key: 'voice', mode: 'play', tab: 'features', target: 'guide-feature-animation' },
  { key: 'designer', mode: 'designer', tab: 'features', target: 'guide-feature-designer' }
]);

export const QUICK_TIP_KEYS = Object.freeze(QUICK_TIPS.map(({ key }) => `header.quickTips.${key}`));

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
  let mode = context.store.getState().ui.mode;
  let tips = tipsForMode();

  function tipsForMode() {
    return QUICK_TIPS.filter(tip => !tip.mode || tip.mode === mode);
  }

  function render() {
    clearTimeout(fade);
    text.classList.remove('tip-fade-out');
    const tip = t(`header.quickTips.${tips[index].key}`);
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
        index = (index + 1) % tips.length;
        render();
      }, motion.matches ? 0 : 200);
    }, 7500);
  }

  const listeners = [];
  function listen(target, name, handler) {
    target.addEventListener(name, handler);
    listeners.push(() => target.removeEventListener(name, handler));
  }
  listen(chip, 'click', () => openGuide(tips[index]));
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
  const unsubscribe = context.store.subscribe(({ state }) => {
    if (mode === state.ui.mode) return;
    mode = state.ui.mode;
    tips = tipsForMode();
    index = 0;
    restart();
  });
  restart();

  return () => {
    clearInterval(timer);
    clearTimeout(fade);
    unsubscribe();
    listeners.forEach((remove) => remove());
  };
}
