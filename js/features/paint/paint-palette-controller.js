/** Palette, brush, and shape tool controls. */
import { t } from '../../core/i18n.js';

const CURATED_PALETTE = [
  '#2d261e', '#ffffff', '#e76f51', '#f4a261',
  '#e9c46a', '#2a9d8f', '#264653', '#9b5de5',
  '#f15bb5', '#fee440', '#00bbf9', '#00f5d4',
  '#8d5b4c', '#d4a373', '#ccd5ae', '#e07a5f'
];

export function createPaintPaletteController(context) {
  const paletteGrid = /** @type {HTMLElement} */ (context.rootElement.querySelector('#paint-palette-grid'));

  const activeColorSwatch = /** @type {HTMLButtonElement} */ (context.rootElement.querySelector('#paint-active-color'));

  function selectColor(hex) {
    if (!hex) return;
    context.session.setColor(hex);
    if (context.colorPicker) context.colorPicker.value = hex;
    const currentTool = context.session.getState().tool;
    if (currentTool === 'eraser' || currentTool === 'select' || currentTool === 'eyedropper') {
      context.session.setTool('brush');
      context.updateUIFromState();
    }
    updatePaletteActive();
  }

  function renderPalette() {
    if (!paletteGrid) return;
    paletteGrid.replaceChildren();
    CURATED_PALETTE.forEach((hex) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'paint-swatch';
      btn.style.backgroundColor = hex;
      btn.title = hex;
      btn.setAttribute('aria-label', t('paint.colorSwatchAria', { color: hex }));
      const active = hex.toLowerCase() === context.session.getState().color.toLowerCase();
      btn.setAttribute('aria-pressed', String(active));
      if (active) {
        btn.classList.add('active');
      }
      btn.addEventListener('click', () => {
        selectColor(hex);
      });
      paletteGrid.appendChild(btn);
    });
  }

  function updatePaletteActive() {
    const currentColor = context.session.getState().color.toLowerCase();
    /** @type {NodeListOf<HTMLButtonElement>} */ (paletteGrid?.querySelectorAll('.paint-swatch'))?.forEach((btn) => {
      const active = btn.title.toLowerCase() === currentColor;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    if (activeColorSwatch) {
      activeColorSwatch.style.backgroundColor = context.session.getState().color;
      activeColorSwatch.setAttribute('aria-label', `${t('paint.activeColorAria')} ${context.session.getState().color}`);
    }
  }

  function bindPaletteEvents() {
    context.toolsToolbar?.addEventListener('click', (e) => {
      const btn = /** @type {HTMLButtonElement} */ (/** @type {Element} */ (e.target).closest('.tool-btn'));
      if (btn?.dataset.tool) {
        context.session.setTool(btn.dataset.tool);
        context.updateUIFromState();
      }
    });

    context.brushSizeSlider?.addEventListener('input', (e) => {
      const size = Number(/** @type {HTMLInputElement} */ (e.target).value);
      context.session.setBrushSize(size);
      if (context.brushSizeValue) context.brushSizeValue.value = `${size}px`;
      context.updateVirtualCursor();
    });

    context.brushSizeSlider?.addEventListener('change', (e) => {
      const size = Number(/** @type {HTMLInputElement} */ (e.target).value);
      context.session.setBrushSize(size);
      if (context.brushSizeValue) context.brushSizeValue.value = `${size}px`;
      context.updateVirtualCursor();
      context.announceStatus(t('paint.brushSizeStatus', { size }));
    });

    context.shapeOptions?.addEventListener('click', (e) => {
      const chip = /** @type {HTMLButtonElement} */ (/** @type {Element} */ (e.target).closest('.shape-chip'));
      if (chip?.dataset.shape) {
        context.session.setShapeType(chip.dataset.shape);
        /** @type {NodeListOf<HTMLButtonElement>} */ (context.shapeOptions.querySelectorAll('.shape-chip')).forEach((c) => {
          const active = c.dataset.shape === chip.dataset.shape;
          c.classList.toggle('active', active);
          c.setAttribute('aria-checked', String(active));
        });
      }
    });

    context.shapeFilledCheckbox?.addEventListener('change', (e) => {
      context.session.setShapeFilled(/** @type {HTMLInputElement} */ (e.target).checked);
    });

    activeColorSwatch?.addEventListener('click', () => {
      context.colorPicker?.click();
    });

    context.colorPicker?.addEventListener('input', (e) => {
      selectColor(/** @type {HTMLInputElement} */ (e.target).value);
    });

    context.colorPicker?.addEventListener('change', (e) => {
      selectColor(/** @type {HTMLInputElement} */ (e.target).value);
    });

    // Dirty dialog
  }

  return { selectColor, renderPalette, updatePaletteActive, bindPaletteEvents };
}
