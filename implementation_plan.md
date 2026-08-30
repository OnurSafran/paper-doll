# Implementation Plan: Play Stage Full-Height Layout, Dedicated Play-Status Row, and UI Polish

## Goal
1. Ensure `#play-stage` / `.play-grid` extends all the way to the bottom of the viewport without being pushed up by a bottom footer.
2. Move `#play-status` into its own dedicated separate row above the stage (between `.play-heading` and `.play-grid`).
3. Move `.scene-rail-actions` (Voice Puppetry, Templates, Outline) into `.scene-meta-actions` within `.play-heading`.
4. Fix related UI issues across Play and Paint screens (status row in Paint, dropdown z-index, context-ring bottom-edge clamping).

## User Review Required
> [!NOTE]
> The scene action buttons (`🎙️ Voice`, `✦ Templates`, `📋 Outline`) will now sit cleanly alongside `💾 Save Scene`, `📚 Scene ▾`, and `📸 Export ▾` in the top toolbar (`.play-heading`), allowing `.play-grid` (stage and inspector) to occupy 100% of the screen height down to the bottom.

## Proposed Changes

### Component: Play Screen & HTML Structure

#### [MODIFY] [index.html](index.html)
- Move `#voice-puppetry-btn`, `#scene-templates-btn`, and `#scene-outline-btn` into `.scene-meta-actions` inside `.play-heading`.
- Insert `<div class="play-status-row"><div id="play-status" class="play-status-pill" role="status" aria-live="polite"></div></div>` between `.play-heading` and `.play-grid`.
- Remove the old `<footer class="paper-panel play-screen-footer scene-rail-actions">` from the bottom of `#play-screen`.
- Similarly in `#paint-screen`, move `#paint-status` into `<div class="paint-status-row"><div id="paint-status" class="paint-status-pill" role="status" aria-live="polite"></div></div>` above `.paint-grid`.

### Component: Stylesheets

#### [MODIFY] [css/features/play.css](css/features/play.css)
- Set `#play-screen` grid layout: `grid-template-rows: auto auto minmax(0, 1fr); gap: 6px;`.
- Add `.play-status-row` and `.play-status-pill` styles with smooth discrete pill styling and `:empty { display: none; }`.
- Update `.play-stage` sizing to `width: auto; height: 100%; max-width: 100%; max-height: 100%; aspect-ratio: 16 / 9;`.
- Ensure `.scene-meta-actions` wraps flexibly and supports all scene actions with consistent pill button styles.
- Set `z-index: 1200` on `.menu-dropdown-panel`.

#### [MODIFY] [css/features/paint.css](css/features/paint.css)
- Set `#paint-screen` grid layout: `grid-template-rows: auto auto minmax(0, 1fr); gap: 6px;`.
- Add `.paint-status-row` and `.paint-status-pill` styles.

#### [MODIFY] [css/responsive/responsive.css](css/responsive/responsive.css)
- Update responsive rules for `#play-screen`, `.play-status-row`, and `#paint-screen`.

### Component: JavaScript Features

#### [MODIFY] [js/features/play/play-view.js](js/features/play/play-view.js)
- Enhance `renderContextRing` to clamp positioning or flip above entity when `ringY > 740` near the bottom edge of the stage.

### Component: Test Suite

#### [MODIFY] [test/ui-contract.test.js](test/ui-contract.test.js)
- Update UI contract assertions for scene actions and status row.

## Verification Plan
1. **Automated Tests**:
   - Run `npm test` to verify all 406+ tests pass.
2. **Browser Verification**:
   - Navigate to `http://localhost:8080/#play`.
   - Verify `#play-stage-viewport` stretches all the way to the bottom.
   - Verify `#play-status` renders cleanly in its own separate row between toolbar and stage.
   - Verify `Voice`, `Templates`, `Outline` open their respective dialogs from `.play-heading`.
   - Verify entity selection, scaling, and context ring when entities are placed near bottom/edges.
