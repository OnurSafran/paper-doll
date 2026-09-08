# Architecture & Feature Foundation Improvement Roadmap

**Project**: Paper Doll Studio  
**Current Version**: v1.20.0  
**Status**: Active Architecture Review & Improvement Roadmap  
**Related Documents**: [ARCHITECTURE.md](ARCHITECTURE.md) · [DECISIONS.md](DECISIONS.md) · [ROADMAP.md](ROADMAP.md) · [QUALITY.md](QUALITY.md)

---

## Executive Summary

Paper Doll Studio is a high-performance, zero-runtime-dependency web application engineered around pure functional state (`AppStore`), deterministic SVG vector rendering, strict input validation, and an installable offline Progressive Web App (PWA) shell.

A thorough inspection of the current codebase (`v1.20.0`, 461 passing tests) reveals a mature, reliable foundation, but also clear opportunities where technical debt and modular bloat have accumulated as major features (Panoramic Stages, Custom Paint Studio, Modular Faces, Looping Animations, and the World Map) were introduced.

This document compiles, validates, and prioritizes architectural, performance, accessibility, and developer-experience improvements, complete with quantitative evaluation metrics and a phased execution roadmap.

---

## Metrics & Evaluation Matrix

Each opportunity is assessed across five key metrics:
- **Effort / Feasibility (1–5)**: `1` = Trivial (<1 hour), `2` = Easy (half-day), `3` = Moderate (1–2 days), `4` = Substantial (3–5 days), `5` = Major Architectural Overhaul.
- **Impact (1–5)**: `1` = Minor polish, `2` = Noticeable improvement, `3` = Significant value, `4` = Major architectural/UX win, `5` = Critical/Transformative foundation.
- **Risk Level**: `Low` (isolated change, zero regression surface), `Medium` (requires test updates or state coordination), `High` (touches core persistence or rendering pipeline).
- **ROI Rating**: `Very High`, `High`, `Medium`, or `Low`.
- **Status in Codebase**: Current verification status in the repository.

| # | Improvement Area | Category | Effort (1–5) | Impact (1–5) | Risk | ROI | Recommended Phase | Code Verification Status |
|:--|:---|:---|:---:|:---:|:---:|:---:|:---:|:---|
| 1 | **Split Monolithic `i18n.js`** | Architecture | 1 | 4 | Low | Very High | Phase 1 | **Completed**: Extracted to `locales/tr.js` and `en.js`; `i18n.js` is now ~150 lines |
| 2 | **Domain Slice Reducers in `app-store.js`** | Architecture | 3 | 5 | Medium | Very High | Phase 2 | **Completed**: Decomposed into 6 pure domain reducers under `js/core/reducers/` with direct prefix dispatch; `app-store.js` reduced from 1,774L to ~200L |
| 3 | **Sub-Controllers for Large Views** | Architecture | 4 | 5 | Medium | High | Phase 3 | **Completed**: play, paint, and app orchestration each stay below 500 lines, with focused sub-controllers |
| 4 | **Generalized Teardown / Disposable Pattern** | Architecture | 2 | 4 | Low | Very High | Phase 2 | **Completed**: Introduced `createDisposableRegistry` in `error-boundary.js` and wired `appDisposables` in `app.js` |
| 5 | **Eliminate Global Dropdown State in `play-view.js`** | Architecture | 1 | 3 | Low | Very High | Phase 1 | **Completed**: Global removed; listener scoped with `teardown()` and `destroy` methods |
| 6 | **JSDoc / TypeScript Static Checking (`checkJs`)** | Type Safety | 2 | 4 | Low | Very High | Phase 2 | **Completed**: Added `js/types.js` with typedefs, `jsconfig.json`, `tsconfig.json`, and `npm run check:types` |
| 7 | **Automated Dictionary Key Symmetry Test** | Type Safety | 0 | 5 | None | Complete | Done | **Already Implemented**: `test/i18n.test.js` lines 92–136 test deep key parity |
| 8 | **Action Payload Contract Validation** | Type Safety | 2 | 3 | Low | High | Phase 2 | **Completed**: Defined `ACTION_PAYLOAD_VALIDATORS` and `validateActionPayload` in `js/core/reducers/action-validator.js` |
| 9 | **RAF-Throttled Live Preview in Paint Studio** | Performance | 1 | 4 | Low | Very High | Phase 1 | **Completed**: Wrapped in `scheduleLivePreview()` using `requestAnimationFrame` |
| 10 | **OffscreenCanvas & ImageBitmap in Export** | Performance | 2 | 4 | Low | High | Phase 3 | **Completed**: worker composition/encoding with transferable bitmaps, cancellation, and existing DOM/Image fallbacks |
| 11 | **SVG Symbology `<use>` for Duplicate Props** | Performance | 3 | 3 | Medium | Medium | Phase 3 | **Completed**: stage-local symbols share built-in props; dolls, custom art, previews, and export remain independent |
| 12 | **Bounding Box Calculation Memoization** | Performance | 1 | 3 | Low | High | Phase 3 | **Completed**: bounded per-instance geometry cache with metadata-aware invalidation |
| 13 | **Context-Aware Focus Restoration on Dialog Close** | a11y & UX | 1 | 4 | Low | Very High | Phase 1 | **Completed**: `dialog-dismiss.js` and `world-map-view.js` restore focus to active trigger |
| 14 | **Screen Reader Announcements for Batch Actions** | a11y & UX | 1 | 4 | Low | Very High | Phase 1 | **Completed**: `#sr-announcements` live region added and mirrored in `showToast` |
| 15 | **Dynamic Outline Contrast for Dark Custom Colors** | a11y & UX | 2 | 3 | Low | High | Phase 3 | **Completed**: dark custom wearable colors use an alternate stroke across previews, stage, and PNG export |
| 16 | **Keyboard Panoramic Navigation Shortcuts** | a11y & UX | 1 | 3 | Low | High | Phase 2 | **Completed**: `PageUp`, `PageDown`, and `Shift+Arrows` supported on stage, camera HUD, and slider |
| 17 | **Automated Service Worker Manifest & Hash Sync** | Tooling / DX | 2 | 5 | Low | Very High | Phase 1 | **Completed**: `scripts/update-sw-manifest.mjs` and `npm run update:sw` added |
| 18 | **Lightweight Headless Browser E2E Suite** | Tooling / DX | 3 | 4 | Low | High | Phase 4 | Confirmed: 456 unit tests use mock DOM; real CSS transform & dialogs untested |
| 19 | **Lightweight Linter & Code Quality Rules** | Tooling / DX | 1 | 3 | Low | High | Phase 2 | **Completed**: Configured `eslint.config.js`, added `npm run lint`, wired into `npm run check` |

---

## Detailed Evaluation of Findings & Proposals

### 1. Architecture & Modularization

#### 1.1 Split the Monolithic `i18n.js` (130 KB, 2,460 lines)
- **Current State**: `js/core/i18n.js` is 129,788 bytes (2,460 lines). Lines 13 to 2,331 (~95% of the file) consist of deep literal dictionary trees for Turkish (`tr`) and English (`en`). Only lines 2,332 to 2,459 (~128 lines) contain translation logic (`t`, `setLanguage`, `translateMessage`, `updateDomTranslations`).
- **Issues**:
  - Unnecessary git diff contention: adding or revising localized copy modifies the engine file.
  - Slower parsing and navigation during feature development.
- **Proposed Solution**:
  - Extract `TRANSLATIONS.tr` into `js/core/locales/tr.js`.
  - Extract `TRANSLATIONS.en` into `js/core/locales/en.js`.
  - In `js/core/i18n.js`, import and freeze the dictionaries:
    ```javascript
    import { tr } from './locales/tr.js';
    import { en } from './locales/en.js';
    export const TRANSLATIONS = Object.freeze({ tr, en });
    ```
  - Preserve all existing exports so no consuming files require changes.
- **Effort**: `1` (Trivial) | **Impact**: `4` (High) | **Risk**: `Low`.

#### 1.2 Domain Slice Reducers in `app-store.js` (74 KB, 1,774 lines)
- **Current State**: `js/core/app-store.js` houses all application mutations inside a single `switch (action.type)` spanning lines 330 to 1,680+ (>1,350 lines). It combines 7 distinct domains:
  1. `ui/*`: Mode switching, selection, modals, status messages, voice toggles.
  2. `designer/*`: Equipping garments, color/iris modifications, face features, body switching.
  3. `preset/*`: Dollbox creation, updates, renames, deletions.
  4. `scene/*`: Placement, geometry, batch manipulation, attachment, pinning, expressions, bubbles, camera.
  5. `scene/*` (Library): Persistence, duplication, loading, template instantiation.
  6. `customAsset/*`: Custom artwork lifecycle, collections tagging.
  7. `project/*` & `settings/*`: Portability backups, reduced motion, sound, souvenir stamps.
- **Issues**:
  - High risk of regression when modifying unrelated domains.
  - Difficult to test state transitions in isolation without constructing full app state envelopes.
- **Proposed Solution**:
  - Decompose into pure slice reducer functions matching domain boundaries:
    - `js/core/reducers/ui-reducer.js`
    - `js/core/reducers/designer-reducer.js`
    - `js/core/reducers/scene-reducer.js`
    - `js/core/reducers/preset-reducer.js`
    - `js/core/reducers/custom-asset-reducer.js`
    - `js/core/reducers/settings-reducer.js`
  - In `app-store.js`, the central dispatcher delegates by action prefix or slice mapping:
    ```javascript
    const reducers = [uiReducer, designerReducer, sceneReducer, presetReducer, customAssetReducer, settingsReducer];
    // Each reducer handles its recognized actions and returns { state, persist?, result? } or null
    ```
- **Effort**: `3` (Moderate) | **Impact**: `5` (Very High) | **Risk**: `Medium`.

#### 1.3 Sub-Controller Decomposition for Large Feature Views
- **Current State**:
  - `play-view.js` (1,628 lines): Manages stage rendering, camera transforms, slider/stepper HUD, tray spawner, selection bounding boxes, multi-select transforms, context radial ring, and inspector tabs.
  - `paint-view.js` (1,777 lines): Manages canvas viewports, drawing loop, raster operations, guide rails, palette chips, and 6 modal dialogs.
  - `app.js` (1,317 lines): Coordinates bootstrap, URL/mode routing, global keyboard shortcuts, error boundary wiring, voice puppetry lifecycle, and dialog triggers.
- **Issues**:
  - Breaches single responsibility principle.
  - Difficult to isolate UI bugs (e.g., stage coordinates vs. context ring positioning).
- **Proposed Solution**:
  - Decompose `play-view.js` into:
    - `camera-controller.js`: Camera slider, minimap lens, and GPU translate synchronization.
    - `selection-hud-controller.js`: Multi-select bounding box, alignment handles, and radial context ring.
    - `tray-spawner-view.js`: Asset picker rails and spawn drag lifecycle.
  - Decompose `paint-view.js` into:
    - `paint-canvas-controller.js`: Direct pointer event processing and canvas stroke rendering.
    - `paint-palette-controller.js`: Color chips, custom palette, and brush size selection.
  - Decompose `app.js` into:
    - `app-shortcuts.js`: Global keyboard event map (`m`, `Ctrl+Z`, `Space`, `Escape`).
    - `app-router.js`: Navigation tabs and route transitions.
- **Effort**: `4` (Substantial) | **Impact**: `5` (Very High) | **Risk**: `Medium`.

#### 1.4 Generalized Teardown / Disposable Pattern
- **Current State**: `js/core/error-boundary.js` exposes `executeSafeTeardown({ cancelPointer, stopAudio, stopAnimation, cancelExport, cancelStorage, cancelPaint, onNotify })`. In `app.js:969`, all 6 specific callbacks are manually enumerated. Views such as `play-view.js` do not export standard `destroy()` or `teardown()` hooks.
- **Issues**:
  - Every time a new subsystem is created, `error-boundary.js` signature and `app.js` wiring must be manually updated.
  - Risk of dangling listeners or memory leaks during view transitions or runtime error recovery.
- **Proposed Solution**:
  - Introduce a lightweight `DisposableRegistry`:
    ```javascript
    export function createDisposableRegistry() {
      const disposables = new Set();
      return {
        register(fn) {
          disposables.add(fn);
          return () => disposables.delete(fn);
        },
        disposeAll() {
          const warnings = [];
          for (const fn of disposables) {
            try { fn(); } catch (err) { warnings.push(err?.message || 'teardown error'); }
          }
          disposables.clear();
          return { ok: true, warnings };
        }
      };
    }
    ```
  - Allow views (`playView`, `paintView`, `designerView`) and services to register cleanup callbacks upon instantiation.
- **Effort**: `2` (Easy) | **Impact**: `4` (High) | **Risk**: `Low`.

#### 1.5 Eliminate Global Dropdown State in `play-view.js`
- **Current State**: In `js/features/play/play-view.js` lines 1499–1513:
  ```javascript
  if (typeof window !== 'undefined' && !window.__playDropdownsBound) {
    window.__playDropdownsBound = true;
    document.addEventListener('click', (event) => {
      if (!event.target.closest('#play-scene-dropdown')) { ... }
      if (!event.target.closest('#play-export-dropdown')) { ... }
    });
  }
  ```
- **Issues**:
  - Attaches an untracked, permanent click listener to `document`.
  - Relies on a global variable on `window`.
  - Leaks state across test runs and view lifecycles.
- **Proposed Solution**:
  - Leverage HTML native `<details>` element close-on-click-outside behavior, or store the listener reference inside the view instance and deregister it on view teardown.
- **Effort**: `1` (Trivial) | **Impact**: `3` (Medium) | **Risk**: `Low`.

---

### 2. Type Safety & Contract Verification

#### 2.1 JSDoc / TypeScript Static Checking (`tsc --noEmit --checkJs`)
- **Current State**: The repository uses vanilla ES modules without build-time compilation or static type verification. There is currently no `jsconfig.json` or `tsconfig.json`.
- **Issues**:
  - Silent property misnomers (e.g. `entity.instanceId` vs `entity.id`, `ui.mode` vs `ui.activeTab`) can only be caught if explicit unit test coverage exists.
- **Proposed Solution**:
  - Add `jsconfig.json`:
    ```json
    {
      "compilerOptions": {
        "checkJs": true,
        "allowJs": true,
        "noEmit": true,
        "target": "ES2022",
        "module": "NodeNext",
        "moduleResolution": "NodeNext"
      },
      "include": ["js/**/*", "test/**/*", "scripts/**/*"]
    }
    ```
  - Add `typescript` as a developer tool dependency (`devDependencies`), fully compliant with Decision **D-011** ("Keep runtime dependency-free; allow platform dev tools").
  - Add `npm run check:types` (`npx tsc --noEmit`) to `npm run check`.
  - Author JSDoc `@typedef` definitions for `AppState`, `SceneRecord`, `SceneEntity`, `CustomAsset`, and `StoreAction`.
- **Effort**: `2` (Easy) | **Impact**: `4` (High) | **Risk**: `Low`.

#### 2.2 Automated Dictionary Key Symmetry Test
- **Current State**: **Already implemented and passing in CI.**
- **Verification Details**:
  In `test/i18n.test.js`:
  - Lines 92–114: `test('all keys in Turkish dictionary exist in English dictionary')` recursively walks both `TRANSLATIONS.tr` and `TRANSLATIONS.en`, verifying that zero keys are missing in either locale (`assert.deepEqual(missingInEn, [])` and `assert.deepEqual(missingInTr, [])`).
  - Lines 116–136: `test('translation placeholders stay aligned between languages')` verifies that all parameter interpolations (`{count}`, `{name}`, etc.) match identically between Turkish and English.
  - Lines 138–154: `test('every built-in catalog asset has a localized name in both languages')`.
- **Recommendation**: Maintain this strong test suite when splitting `i18n.js` into separate locale modules.
- **Effort**: `0` (Complete) | **Impact**: `5` (Critical Quality Guardrail) | **Risk**: `None`.

#### 2.3 Store Action Contract Validation
- **Current State**: Action payload validation is scattered across individual `switch` cases in `app-store.js`.
- **Proposed Solution**:
  - Introduce an optional development-time action assertion dictionary `ACTION_PAYLOAD_VALIDATORS` that validates payloads against known shapes in development, warning if invalid types or excess parameters are passed.
- **Effort**: `2` (Easy) | **Impact**: `3` (Medium) | **Risk**: `Low`.

---

### 3. Performance & Memory Optimizations

#### 3.1 RequestAnimationFrame-Throttled Live Preview in Paint Studio
- **Current State**: In `js/features/paint/paint-view.js` (lines 959, 988, 1005, 1017), `updateLivePreview()` is invoked synchronously on every `pointermove` event during brush drawing and shape dragging.
  Inside `updateLivePreview()` (line 1373):
  `livePreviewCanvas.getContext('2d').drawImage(canvas, 0, 0);`
- **Issues**:
  - High-frequency pointer input (e.g. 120Hz on Apple Pencil / iPad Pro) triggers up to 120 synchronous canvas context draws and DOM updates per second.
  - Contends with the active stroke interpolation rendering loop, causing dropped frames.
- **Proposed Solution**:
  - Throttle live preview updates using a single queued `requestAnimationFrame`:
    ```javascript
    let previewRafId = null;
    function scheduleLivePreview() {
      if (previewRafId) return;
      previewRafId = requestAnimationFrame(() => {
        previewRafId = null;
        updateLivePreview();
      });
    }
    ```
  - Call `scheduleLivePreview()` during stroke/drag events, and flush synchronously only on `pointerup`.
- **Effort**: `1` (Trivial) | **Impact**: `4` (High) | **Risk**: `Low`.

#### 3.2 OffscreenCanvas and ImageBitmap Acceleration in Export Service
- **Current State**: `js/services/export-service.js` creates a DOM canvas element (`document.createElement('canvas')`) and uses `new Image()` with `URL.createObjectURL(blob)` on the main browser UI thread for rasterizing SVG layers into PNG.
- **Issues**:
  - Main thread rasterization causes UI latency during high-resolution panoramic scene exports (up to 4,800 × 900 px).
  - DOM image instantiation allocates unnecessary memory.
- **Proposed Solution**:
  - Feature-detect `createImageBitmap` and `OffscreenCanvas`:
    ```javascript
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(stageWidth, LIMITS.STAGE_HEIGHT)
      : document.createElement('canvas');
    ```
  - Use `createImageBitmap(blob)` where available, bypassing `HTMLImageElement` creation and freeing object URLs faster.
- **Effort**: `2` (Easy) | **Impact**: `4` (High) | **Risk**: `Low`.

#### 3.3 SVG Reuse / Symbology for High Entity Counts
- **Current State**: `js/core/svg-loader.js:21` executes `template.cloneNode(true)` for every entity placed on the stage.
- **Issues**:
  - In panoramic stages with 20+ duplicated decorative props (e.g. multiple trees, flowers, clouds, stars), every entity creates an entirely distinct SVG DOM subtree.
- **Proposed Solution**:
  - For props that do not require custom color property cascading, render instances as `<svg class="scene-entity-svg"><use href="#symbol-{assetId}" /></svg>` pointing to a central `<defs>` catalog.
  - Retain `cloneNode(true)` for modular dolls and recolorable clothing where CSS custom properties (`--garment-color`, `--hair-color`, `--iris-color`) must cascade to internal paths.
- **Effort**: `3` (Moderate) | **Impact**: `3` (Medium) | **Risk**: `Medium`.

#### 3.4 Bounding Box Calculation Memoization
- **Current State**: `getEntityBounds` in `js/domain/scene-rules.js` computes entity geometry (scale clamps, character base dimensions, bubble text line estimation) on every move and drag calculation.
- **Proposed Solution**:
  - Add a fast LRU or Map memoization keyed by `assetId` + `scale` + `bubbleTextLength`, reducing geometry recalculations to single cache lookups during batch pointer manipulation.
- **Effort**: `1` (Trivial) | **Impact**: `3` (Medium) | **Risk**: `Low`.

---

### 4. Accessibility (a11y) & User Experience

#### 4.1 Context-Aware Focus Restoration on Dialog Close
- **Current State**: In `js/features/world-map/world-map-view.js` (lines 456, 480):
  `$('#open-world-map-btn')?.focus();`
  Closing the World Map always shifts keyboard focus to the World Map header button, even if the user opened the map via the `m` keyboard shortcut while editing an entity on the stage. Similar issues exist across other dialogs (Guide, Project, Scene Book).
- **Issues**:
  - Violates WCAG 2.1 Success Criterion 2.4.3 (Focus Order).
  - Disrupts keyboard-only and screen reader navigation flow.
- **Proposed Solution**:
  - Centralize focus management in `js/core/dialog-dismiss.js`:
    ```javascript
    export function openModalWithFocusRestoration(dialog, triggerElement = document.activeElement) {
      dialog.showModal();
      const onClose = () => {
        dialog.removeEventListener('close', onClose);
        if (triggerElement && typeof triggerElement.focus === 'function') {
          triggerElement.focus();
        }
      };
      dialog.addEventListener('close', onClose);
    }
    ```
- **Effort**: `1` (Trivial) | **Impact**: `4` (High) | **Risk**: `Low`.

#### 4.2 Screen Reader Announcements for Batch Multi-Select Actions
- **Current State**:
  - `#toast-region` in `index.html:1755` is explicitly marked `aria-hidden="true"`.
  - When batch operations occur (e.g. `scene/alignEntities`, `scene/deleteEntities`), the store emits a localized message (`play.statusItemsAligned`, `play.statusItemsRemoved`), but it is only displayed in `#toast-region`.
  - `#play-status` is an `aria-live="polite"` element, but is only populated during full view re-renders, not on toast-action dispatches.
- **Issues**:
  - Screen reader users receive no auditory feedback when aligning or bulk-deleting items via keyboard shortcuts.
- **Proposed Solution**:
  - Introduce an accessible live announcer `#sr-announcements` with `role="status"` and `aria-live="polite"` (with `.sr-only` CSS offscreen positioning).
  - Update `showToast(message)` to mirror announcements into the live region so every visual notification is accessible.
- **Effort**: `1` (Trivial) | **Impact**: `4` (High) | **Risk**: `Low`.

#### 4.3 Dynamic Outline Contrast for Dark Custom Colors
- **Current State**: In built-in and painted vector assets, outline strokes are rendered using `#2d261e` (`rgb(45, 38, 30)`).
- **Issues**:
  - When a player applies very dark custom colors (e.g. `#111111`, `#1c1917`, or dark navy) to clothing or hair, the internal stroke artwork disappears due to near-zero contrast.
- **Proposed Solution**:
  - In `js/core/palette.js`, add a luminance calculation:
    ```javascript
    export function getRelativeLuminance(hex) { ... }
    export function isDarkTone(hex) { return getRelativeLuminance(hex) < 0.08; }
    ```
  - When a dark custom tone is active, apply a subtle CSS filter (`drop-shadow(0 0 1px rgba(255,255,255,0.4))`) or alternate stroke class so linework remains crisp and legible.
- **Effort**: `2` (Easy) | **Impact**: `3` (Medium) | **Risk**: `Low`.

#### 4.4 Keyboard Panoramic Navigation Shortcuts
- **Current State**: Camera panning across panoramic stages (1,600 / 3,200 / 4,800 px) currently requires dragging the stage, clicking HUD stepper buttons, or manipulating the minimap slider.
- **Proposed Solution**:
  - Wire `PageUp` / `PageDown` (or `Shift + Left/Right`) when the stage or camera HUD has focus to nudge the virtual camera smoothly by 400 logical units.
- **Effort**: `1` (Trivial) | **Impact**: `3` (Medium) | **Risk**: `Low`.

---

### 5. Tooling & Developer Experience (DX)

#### 5.1 Automated Service Worker Manifest & Hash Sync
- **Current State**: `sw.js` maintains a hardcoded `APP_SHELL` array of all CSS files (with `?v={hash}` query strings) and every runtime JS module. `scripts/validate-cache-busting.mjs` checks that all files in `js/` exist in `APP_SHELL` and that `CACHE_NAME` matches a calculated SHA-256 hash.
- **Issues**:
  - Adding, deleting, or splitting a JavaScript module (such as `i18n.js` or `app-store.js`) currently requires manual file edits in `sw.js`, manual hash recalculation, and manual updates to `index.html`.
- **Proposed Solution**:
  - Create `scripts/update-sw-manifest.mjs`:
    1. Discovers all CSS files and JS modules under `css/` and `js/`.
    2. Calculates content fingerprints (`sha256().slice(0, 8)`).
    3. Rewrites `sw.js` (`APP_SHELL` and `CACHE_NAME`).
    4. Rewrites stylesheet `<link>` tags in `index.html`.
  - Add npm script: `"update:sw": "node scripts/update-sw-manifest.mjs"`.
- **Effort**: `2` (Easy) | **Impact**: `5` (Very High) | **Risk**: `Low`.

#### 5.2 Lightweight Headless Browser E2E Suite
- **Current State**: The repository's 456 unit tests run under Node.js (`node --test`) using mock DOM structures.
- **Issues**:
  - Node.js mocks cannot evaluate real CSS hardware-accelerated transforms (`translate3d`), native `<dialog>` light dismiss, real mouse/touch drag event coordinates, or genuine Service Worker caching in a browser environment.
- **Proposed Solution**:
  - Introduce a lightweight Playwright test configuration with zero runtime impact on production code.
  - Implement 4 core end-to-end smoke journeys:
    1. **PWA Boot & Shell Ready**: Validates clean console, asset preloading, and offline readiness.
    2. **Designer Studio Journey**: Switches body models, equips clothing, alters skin tone/hair colors, and saves to Dollbox.
    3. **Play Studio Journey**: Drags doll and prop onto panoramic stage, navigates camera, verifies clamping, and tests Undo/Redo.
    4. **Export Journey**: Triggers PNG export and verifies resulting data URL / canvas integrity.
- **Effort**: `3` (Moderate) | **Impact**: `4` (High) | **Risk**: `Low`.

#### 5.3 Code Quality & Linting Configuration
- **Current State**: No automated linter is currently active.
- **Proposed Solution**:
  - Configure ESLint with standard ES module rules to automatically prevent unused imports, undeclared global mutations (like `window.__*`), and unhandled async rejections.
- **Effort**: `1` (Trivial) | **Impact**: `3` (Medium) | **Risk**: `Low`.

---

## Phased Implementation Roadmap

```
Phase 1: Quick Wins & High-ROI Guardrails
├── 5.1 Automated Service Worker Manifest Sync (update:sw)
├── 1.1 Split Monolithic i18n.js into Locales (tr.js / en.js)
├── 3.1 RAF-Throttled Live Preview in Paint Studio
├── 1.5 Eliminate Leaky Dropdown Global in play-view.js
├── 4.1 Context-Aware Focus Restoration for Dialogs
└── 4.2 Screen Reader Live Announcements for Batch Actions

Phase 2: Core Architectural Extractions
├── 1.2 Domain Slice Reducers for app-store.js
├── 1.4 Generalized Teardown Registry in error-boundary.js
├── 2.1 JSDoc / TypeScript Static Checking (jsconfig.json)
├── 4.4 Keyboard Panoramic Navigation Shortcuts
└── 5.3 Code Quality & Linting Configuration

Phase 3: Sub-Controller Decomposition & Performance Upgrades
├── 1.3 Sub-Controllers for play-view.js, paint-view.js, app.js
├── 3.2 OffscreenCanvas & ImageBitmap in Export Service
├── 3.3 SVG Symbology <use> for Duplicate Props
├── 3.4 Bounding Box Memoization in Scene Rules
└── 4.3 Dynamic Contrast for Dark Custom Colors

Phase 4: Real Browser Verification (E2E)
└── 5.2 Lightweight Headless Browser E2E Suite (Playwright)
```

### Phase 1 — Immediate High-ROI Guardrails (Completed)
*Goal: Eliminate developer friction, fix leaky DOM event patterns, and boost drawing performance.*
1. [x] **Automate Service Worker Sync (`scripts/update-sw-manifest.mjs`)**: Enables effortless module additions and refactoring via `npm run update:sw`.
2. [x] **Split `i18n.js` into Locale Files (`tr.js`, `en.js`)**: Reduced `i18n.js` from 2,460 lines to ~150 lines of pure logic.
3. [x] **RAF Throttling in Paint Studio**: Eliminates synchronous canvas redraw thrashing on every pointer movement.
4. [x] **Fix Global Dropdown State in `play-view.js`**: Removed `window.__playDropdownsBound` and added `teardown()` and `destroy` methods.
5. [x] **Context-Aware Focus Restoration**: Enhanced dialog accessibility with `enableDialogFocusRestoration` and `world-map-view.js` restoration.
6. [x] **Accessible Batch Announcements**: Added `#sr-announcements` live region (`aria-live="polite"`) and mirrored studio action toasts.

### Phase 2 — Core Architectural Modularization (Completed)
*Goal: Decompose monolithic state mutation and establish static type safety.*
1. [x] **Domain Slice Reducers (`js/core/reducers/`)**: Split `app-store.js` into domain-specific reducers (`ui`, `designer`, `preset`, `scene`, `customAsset`, `settings`) with O(1) prefix dispatch; added action payload validation contracts in `action-validator.js`.
2. [x] **Teardown Registry (`createDisposableRegistry`)**: Standardized disposable registration in `error-boundary.js` and wired `appDisposables` in `app.js`.
3. [x] **`jsconfig.json` & Type Verification**: Added `js/types.js` with JSDoc `@typedef`s, configured `jsconfig.json`/`tsconfig.json`, and added `npm run check:types`.
4. [x] **Keyboard Panoramic Navigation**: Implemented `PageUp`/`PageDown` and `Shift+Arrows` stage and camera HUD navigation.
5. [x] **Linter Setup (`eslint.config.js`)**: Configured lightweight ESLint with standard browser globals and added `npm run lint`.

### Phase 1–2 implementation review (2026-09-07)

The review found gaps despite the original 461-test suite passing. Corrections:

- Enabled `checkJs` across runtime JavaScript and connected state/action/asset JSDoc contracts to the store and reducers. Added DOM annotations and negative contract checks in `type-tests/contracts.ts`. Strict mode remains disabled; tests and scripts are linted, while runtime modules and contract fixtures are type checked.
- Wired shared focus restoration into application dialogs. The map owns its separate restoration and now restores its actual opener once, from the native close event.
- Flushed pending paint preview frames on pointer completion/cancellation, including RAF handle zero, and cancelled pending frames at teardown.
- Separated final view destruction from repeatable error recovery, so continuing after an error preserves keyboard and language listeners. Registry object deduplication, unregistration, and nested disposal are covered.
- Restored the existing reducer behavior that makes the most recently selected item primary; protected dispatch and validators against inherited object keys and malformed geometry/selection payloads.
- Kept camera HUD shortcuts scoped to camera operations even with a scene item selected. Navigation uses the shared `CAMERA_CONSTANTS.STEP` (300 units); stage Shift+Arrows retain selected-item movement.
- Made manifest generation discover added CSS, remove deleted CSS/JS entries, preserve the entry script version, and synchronize nested unversioned imports in one idempotent run.
- Removed `--quiet` from lint so existing advisory warnings are visible. Unused-variable warnings remain non-blocking; full promise rejection analysis is not provided by the lightweight ESLint configuration.

Regression coverage includes isolated manifest generation, frame scheduling, focus lifecycle, recovery reuse, action validation, primary selection, and camera HUD isolation. Browser smoke verification covers project/map dialog focus, panoramic PageDown navigation, a paint stroke mirrored into the live preview, and no logged browser errors. `npm run check` passes all 471 tests, runtime/contract type checking, and documentation, asset, and cache validation; ESLint reports existing advisory warnings with zero errors.

### Phase 3 — Sub-Controller Decomposition & Performance (Completed)
*Completed 2026-09-08, including the previously deferred controller, worker, and SVG reuse work.*

1. [x] **Sub-Controller Decomposition**: `app.js` (370 lines), `play-view.js` (273 lines), and `paint-view.js` (442 lines) now coordinate focused controllers, all below 500 lines. Play separates camera, pointer dragging, spawning, inspector, selection HUD, and entity composition. Paint separates canvas/history, selection, keyboard drawing, palette, cutouts, previews, and controls. App separates routing, shortcuts, dialogs, project workflows, scene/shell events, recovery, and store effects. Controller-local state stays with its consumer; explicit live dependency ports preserve shared session replacement and render cancellation.
2. [x] **OffscreenCanvas & ImageBitmap compatibility paths**: PNG export uses a usable OffscreenCanvas 2D context and `convertToBlob`, with DOM canvas fallback when unavailable or encoding fails. SVG decoding tries ImageBitmap and falls back to Image/object URLs. Bitmaps close after rendering, including failure/cancellation; object URLs revoke on image load/error. Existing caller-supplied canvas rendering remains supported.
3. [x] **Worker-based export rendering**: The existing scene renderer records an ordered draw list, transfers bitmap copies to a module worker, and composites/encodes the stage on worker-owned OffscreenCanvas. SVG DOM assembly and compatible image decoding remain on the main thread. Worker startup, transfer, context, encoding, message, and timeout failures fall back using the same immutable snapshot. Cancellation terminates the worker without starting fallback; all bitmap copies and source bitmaps are released. Caller-supplied canvas rendering remains supported. No measured frame-rate improvement is claimed.
4. [x] **SVG Symbology Reuse**: `core/svg-symbols.js` maintains a stage-local defs catalog with one symbol per built-in prop and lightweight `<use>` instances. Concurrent duplicate requests share one load. Internal IDs and fragment references are scoped per registry, unused symbols are pruned, and teardown rejects stale loads. Outer entity transforms remain independent. Dolls, recolorable wearables, custom raster art, and standalone export keep their established render paths.
5. [x] **Bounding Box Memoization**: A bounded 256-entry per-instance cache reuses bounds across position changes. Inputs include scale, bubble width/text length/style, and resolved asset dimensions/anchors. Each caller gets its own result object; edited or replaced custom assets cannot retain stale geometry.
6. [x] **Dynamic Outline Contrast**: Custom hex colors below relative luminance 0.08 use `#b8afa3` for standard wearable linework. Built-in palette colors retain their original strokes. Loader-side stroke variables preserve source SVG assets; thumbnails, live color preview, color patches, stage rendering, and PNG composition use the same outline rule. Painted raster art is unchanged.

Validation: `npm run check` passes 488 tests, runtime/contract type checking, documentation, asset, and cache checks; lint has zero errors and existing advisory warnings. The earlier geometry, contrast, and compatibility coverage remains green. Additional worker/symbol tests cover draw-order replay, transferred image reuse, success/error/timeout/cancellation cleanup, snapshot-preserving fallback, symbol reference scoping, pruning, retries, and teardown races. Source assertions follow the extracted controllers, and recovery is tested through its real controller factory. Chromium smoke checks cover boot, duplicate prop spawning and shared symbols, panoramic PageDown, map focus restoration, Designer save, paint stroke/live preview, undo/redo, and the actual PNG download button with no page errors. A 4800×900 scene with 20 duplicate props exports successfully through the actual worker; worker and direct outputs were visually inspected (minor bitmap rasterization differences mean they are not byte/pixel identical). Service worker fingerprints were regenerated with `npm run update:sw`.

### Phase 4 — E2E Real Browser Confidence (2–3 Days)
*Goal: Continuous release verification across real browser rendering engines.*
1. **Playwright E2E Suite**: Add headless Chromium/WebKit smoke test suite verifying transforms, touch gestures, dialogs, and offline PWA installation.
