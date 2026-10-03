# Foundation Improvements

**Project**: Paper Doll Studio  
**Version**: v2.0.0  
**Status**: Phases 1–3 complete; Phase 4 (real-browser E2E) open  
**Related Documents**: [ARCHITECTURE.md](ARCHITECTURE.md) · [DECISIONS.md](DECISIONS.md) · [ROADMAP.md](ROADMAP.md) · [QUALITY.md](QUALITY.md)

Architecture, performance, accessibility, and tooling work that is not a player-facing feature. The reasoning for each completed item lives in [DECISIONS.md](DECISIONS.md) (D-038 to D-044); this page keeps the one-line outcome and the open work.

## Completed

| Area | Outcome | Decision |
|:--|:--|:--|
| Locale dictionaries | `js/core/locales/tr.js` and `en.js` separated from the `i18n.js` engine; key parity tested. | D-039 |
| Service-worker manifest | `npm run update:sw` regenerates `APP_SHELL`, `CACHE_NAME`, and stylesheet fingerprints; `validate-cache-busting.mjs` fails on drift. | D-038 |
| View teardown | Views with document or window listeners expose `teardown`/`destroy`; the global dropdown state is gone. | D-040 |
| Store architecture | `app-store.js` dispatches to pure slice reducers under `js/core/reducers/` with payload validators. | D-041 |
| Disposable registry | `createDisposableRegistry` in `error-boundary.js` owns app-level teardown and error recovery. | D-042 |
| Static checks | `checkJs` over runtime modules with `js/types.js` typedefs and `type-tests/`; ESLint flat config in `npm run check`. | D-043 |
| Panoramic keyboard navigation | `PageUp`/`PageDown`/`Home`/`End` and `Shift+Arrow` across stage, camera HUD, and slider. | D-044 |
| Paint live preview | Previews are throttled to animation frames, flushed on pointer end, and cancelled at teardown. | — |
| Dialog focus | Focus returns to the actual opener; the map restores it once from the native close event. | — |
| Screen reader | `#sr-announcements` live region mirrors toast messages for batch operations. | — |
| Sub-controllers | `app.js`, `play-view.js`, and `paint-view.js` coordinate focused controllers, each under 500 lines. | — |
| Export | Worker and OffscreenCanvas composition with DOM canvas fallback; cancellation releases bitmaps and workers. | — |
| SVG reuse | `core/svg-symbols.js` shares one symbol per built-in prop; dolls, custom art, and export keep their own paths. | — |
| Geometry cost | Bounded per-instance bounding-box cache keyed on scale, bubble text, and asset dimensions. | — |
| Outline contrast | Custom colors below relative luminance 0.08 use an alternate wearable stroke in previews, stage, and PNG. | — |

## Known gaps

- Strict TypeScript mode is off. Runtime modules and contract fixtures are checked; tests and scripts are linted only.
- Worker and direct PNG exports are not pixel-identical because of bitmap rasterization differences. No frame-rate gain is claimed.

## Phase 4 — Real-browser E2E (open)

Unit tests run in Node with mock DOM and storage, so they cannot see native `<dialog>` behavior, real transforms, pointer geometry, Service Worker caching, or IndexedDB transaction lifetime. Three defects found on 2026-10-03 lived in exactly that gap: D-051, D-052, and the mobile playback toolbar covering Layers and stage width (D-053).

Existing scripts, run by hand and not part of `npm run check`: `scripts/verify-hit-testing-browser.mjs` and `scripts/verify-scene-outline-browser.mjs`. The outline script now hit-tests every stage control at 375 px and taps instead of using keyboard focus.

Proposed suite, with no runtime impact on production code:

1. **Boot and offline readiness:** clean console, app shell cached, reload without network.
2. **Designer journey:** switch body model, equip pack and core clothing, recolor, save to the Dollbox.
3. **Play journey:** place a doll and prop on a panoramic stage, navigate the camera, verify clamping, Undo/Redo.
4. **Export journey:** PNG export produces a valid image at the expected size.
5. **Transfer journey:** export a project that uses pack content and custom art, then Replace, Merge, and backup restore against real IndexedDB.
6. **Narrow-width pointer checks:** activate each Play control by pointer at 375 px so overlapped controls fail.

Close when the suite runs in Chromium and WebKit, and is wired into `npm run check` or a documented release command.
