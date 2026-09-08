/** Global history/map shortcuts and accessible tab navigation. */

export function createAppShortcuts(context) {
  function handleTabKeys(event) {
    const tab = event.target.closest('[role="tab"]');
    if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const list = tab.closest('[role="tablist"]');
    if (!list) return;
    const allTabs = [...list.querySelectorAll('[role="tab"]')];
    const visibleTabs = allTabs.filter((t) => !t.hidden && t.getAttribute('hidden') === null && t.style.display !== 'none');
    const index = visibleTabs.indexOf(tab);
    if (index === -1) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + visibleTabs.length) % visibleTabs.length;
    else if (event.key === 'ArrowRight') nextIndex = (index + 1) % visibleTabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = visibleTabs.length - 1;
    const targetTab = visibleTabs[nextIndex];
    if (targetTab) {
      for (const t of allTabs) {
        t.setAttribute('tabindex', '-1');
      }
      targetTab.setAttribute('tabindex', '0');
      targetTab.focus();
      targetTab.click();
    }
  }

  function handleGlobalShortcuts(event) {
    if (event.target.matches('input, textarea, select, [contenteditable="true"]') || document.querySelector('dialog[open]')) return;
    const isMac = typeof navigator !== 'undefined' && (/Mac|iPod|iPhone|iPad/.test(navigator.platform) || /Macintosh/.test(navigator.userAgent));
    const modifier = isMac ? event.metaKey : event.ctrlKey;

    // 'm' shortcut for World Map in Play mode without modifier
    if (!modifier && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'm') {
      if (context.store.getState().ui?.mode === 'play') {
        event.preventDefault();
        context.worldMapView.openWorldMapDialog();
        return;
      }
    }

    if (!modifier || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'z') {
      event.preventDefault();
      if (event.shiftKey) context.store.dispatch({ type: 'app/redo' });
      else context.store.dispatch({ type: 'app/undo' });
    } else if (key === 'y' && !isMac) {
      event.preventDefault();
      context.store.dispatch({ type: 'app/redo' });
    }
  }

  return { handleTabKeys, handleGlobalShortcuts };
}
