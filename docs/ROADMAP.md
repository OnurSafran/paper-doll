# Implementation Status and Roadmap

Updated: 2026-08-19

This is the single authority for implementation status, open work, and delivery order. Product behavior belongs in [PROJECT.md](PROJECT.md); release evidence belongs in [QUALITY.md](QUALITY.md).

## Current snapshot

- Working dependency-free Designer and Play vertical slice
- 6 base dolls across 5 life stages (Baby, Child, Teen, Adult, Elder), 19 modular face features, 87 wearable/hair/accessory assets, 7 backgrounds, and 22 props
- Dollbox, Scene Book, current-scene autosave/reload, and local schema migration (v4 modular face)
- Pointer/keyboard scene editing, bounded Undo/Redo, and PNG export
- Seven in-session expressions and strictly local voice puppetry
- Custom Paint Studio Gates 0–3B complete with IndexedDB storage, portability, mixed renderers, bounded history, My Art lifecycle, non-destructive wearable slot switching, trusted cutout actions, and precision body/alignment overlays
- Character Customization System (Gates 0–5) complete:
  - Gate 0: Modular layer order, fit families, presentation styles, and domain contracts
  - Gate 1: 19 modular face SVGs, iris palette, schema v4 migration, resting-face restoration, and full undo/redo
  - Gate 2: 6 base doll models across 5 life stages, fit-family wardrobe filtering, retention on model switch
  - Gate 3: Fit-aware outfit and face randomization, 7 expressive face variants, 5 life-stage hair/garments
  - Gate 4: Single-layer custom hair architecture with Layer 70 rendering, Paint Studio guides for all 6 models, and portability
  - Gate 5: 315 automated tests passing, 141 cataloged SVGs validated, complete release evidence and documentation
- 315 automated tests passing
- 141 cataloged SVG files passing asset validation
- Catalog assets carry `added_date`, `creator`, `concept`, `dlc`, and `source` provenance metadata; current content pack is `core`
- Installable offline PWA shell with Turkish in-app guide
- Documentation validation passing with 8 canonical documents
- Designer and Paint source hardening pass complete (2026-08-18): all 41 reviewed findings closed, plus 5 follow-ups found during verification; remaining non-defect observations are tracked in the improvement backlog below
- Play hardening complete (2026-08-19): all 20 findings (PL-1 to PL-20) closed, plus the PLR-1 regression found during verification. Verification was done against source and at runtime, not against fix descriptions — 16 findings held on first check, 4 did not, and all were closed the same day. R-06 and R-07 are both closed; 315 automated tests pass
- Gates A–D complete; Gate E asset expansion complete; Custom Paint Gates 0–3 complete; Character Customization Gates 0–5 complete; Play hardening (Gate F) complete; hosted iPad smoke test remains before family release

## Status by capability

| Area | Status | Open work |
|:--|:--|:--|
| Domain/store | Implemented | Shared vocabulary, injected time/identity, and validated generated IDs are centralized. |
| Schema/storage | Implemented | Monotonic revision guards, post-write race detection, and recovery/availability reporting are complete. |
| Asset pipeline | Implemented | Add clone-ID scoping before patterns/definitions. Core asset provenance metadata and ordinary SVG expansion are in place. |
| Designer/Dollbox | Implemented | Modular feature architecture extracted cleanly. Hardening pass closed shared catalog filtering, fit-aware layers, focus restoration, the Dollbox render gate, and the in-app rename prompt. Complete real-browser accessibility journey. |
| Play/Scene Book | Implemented | Modular feature architecture extracted cleanly. Full entity thumbnails; panoramic world & camera navigation. Hardening pass closed panoramic move clamping, Scene Outline labelling, custom-prop discovery, render patching, context-ring focus, keyboard and wheel input, full Play localization, and the consistency backlog. Composition-root asset-resolver wiring is now covered by a source contract test. |
| Undo/Redo | Implemented | Verify longer mixed-domain journeys and history semantics. |
| PNG export | Implemented | Extracted export service with immutable snapshots, progress/failure reporting, and parity fixtures. |
| Expressions/voice | Implemented | Extracted voice puppetry service with injected browser APIs, frequency analyzer, and teardown tests. |
| Browser/accessibility gate | Implemented | Evaluated across Chrome, Safari, Firefox, Edge across 4 standard viewports. |
| Performance/release gate | Implemented | Validated drag frame-budget, debounced storage coalescing, and capacity limits. |
| Offline PWA | Implemented | HTTPS install flow, app-shell caching, offline startup, cache-version update procedure, and iPad Home Screen guidance are documented. |
| In-app Turkish guide | Implemented | Header guide menu explains dressing, scenes, saving, backups, and offline play. |
| Custom Paint Studio | Implemented | Hardening pass restored pointer selection, reachable 20-step undo depth, accessible dialogs, full localization, and 6 uniquely labeled reference models. Pointer-selection regression coverage added. See completed improvement backlog I-01 to I-06 for the drawing-loop performance and Paint architecture work. |

## Release blockers

### R-01 — Persist all seven expressions (Completed)

Centralized vocabulary in `domain/vocabulary.js` and all seven expressions (`neutral`, `smile`, `happy`, `surprised`, `o_mouth`, `talking`, `wide_open`) round-trip through store projection, serialization, sanitization, reload, history, and export. Tested with regression fixtures.

### R-02 — Make scene boundaries asset-aware (Completed)

Replaced generic fixed margins with character/prop dimensions, scale, and catalog ground anchor in `js/domain/scene-rules.js`. Tested characters, floor lamp, and pastel rug across min/default/max scale at all edges, plus scale-up re-clamping.

### R-03 — Prevent stale cross-tab overwrite (Completed)

Added monotonic project revisions (`revision`) to the state schema envelope and base-revision preconditions in `StorageAdapter`. Stale saves are blocked on cross-tab revision conflict, protecting disk data unless overwrite is explicitly confirmed.

### R-04 — Add top-level error recovery (Completed)

Implemented `classifyError` and `executeSafeTeardown` in `js/core/error-boundary.js` and top-level listeners for `error` and `unhandledrejection` in `js/app.js`. Active pointer dragging is cancelled, audio streams are stopped, pending storage timers are cancelled (preserving disk state), and an accessible alert dialog with privacy-safe codes and Reload options is presented.

### R-05 — Complete release evidence (Completed)

Documented and verified all User Journeys (J-01–J-17), Failure Matrix scenarios (F-01–F-10), accessibility requirements, cross-browser/viewport coverage, storage budgets, and signed the Gate A release report in [QUALITY.md](QUALITY.md).

### R-06 — Restore panoramic move clamping (Completed)

`moveEntity`'s single-entity branch calls `getEntityAllowedRange(root, getAsset)` without a stage width (`js/domain/scene-rules.js:333`), so it clamps against the fixed `1600` viewport instead of the scene's `stageWidth`. The compound branch, the drag preview, `addEntity`, and `scaleEntity` all use the scene width correctly.

On a `3200` or `4800` stage, an unattached entity follows the pointer to the far panel and then snaps back into the first `1600px` on pointer-up. The same snap occurs on every arrow-key nudge, on every alignment command, and when narrowing `4800 → 3200`. Player work placed in the extended world is silently discarded, which violates the product promise and the panoramic acceptance criteria below.

Closed 2026-08-18 by passing `scene?.stageWidth || STAGE_WIDTH` at the single call site. Verified 2026-08-19: moves, narrowing reclamps, and alignment all respect the active stage width, and the two new tests in `test/panoramic-stages.test.js` were confirmed to fail when the argument is removed. Details: PL-1 in [../review/ISSUES.md](../review/ISSUES.md).

### R-07 — Restore custom props in the Play spawn tray (Completed)

Regression introduced while closing PL-13. `createPlayView` gained a `getAssetsByKind` parameter defaulting to the built-in catalog (`js/features/play/play-view.js:61`), and the hand-rolled custom-prop merge it replaced was deleted. `js/app.js` passes `getAssetsByKind: getEffectiveAssetsByKind` to `createDesignerView` (`:192`) but not to `createPlayView` (`:204-213`), so Play silently uses built-ins only — 22 props instead of 23.

A child paints a prop, saves it to My Art, opens Play, and their artwork is not in the tray. Existing scene entities still render, so only discovery is broken. Every `source.custom` branch in the tray is now unreachable, and the tray's render signature still tracks `customProps` — both confirm the merge was meant to survive.

Closed 2026-08-19 by passing `getAssetsByKind: getEffectiveAssetsByKind` to `createPlayView`. Two tests guard it, because the view and the wiring fail independently: a tray render test asserting a custom prop produces a labelled card, and a source contract in `test/ui-contract.test.js` asserting that every view factory declaring `getAsset` or `getAssetsByKind` is handed the registry-backed resolver in `app.js`. The second was confirmed to fail when the argument is removed. Details: PLR-1 in [../review/ISSUES.md](../review/ISSUES.md).

## Delivery plan

### Gate A — Correctness and truthful status (Completed)

1. [x] Fix R-01 and add all-expression regression tests.
2. [x] Fix R-02 and add asset-boundary fixtures.
3. [x] Separate storage availability from recovery outcome.
4. [x] Add R-04 error boundary and browser failure tests.
5. [x] Complete the browser/accessibility/performance matrices and ship decision.

### Gate B — Architecture hardening (Completed)

1. [x] Centralize shared domain vocabulary.
2. [x] Extract project repository without changing behavior; migrate revisions afterward.
3. [x] Extract export service with immutable snapshots.
4. [x] Extract voice service with injected browser APIs and teardown tests.
5. [x] Split Designer, Play, and Scene Book modules.

Every extraction is independently reviewable and behavior-preserving. Do not combine file movement with new product behavior.

### Gate C — Player-work and storytelling features (Completed)

1. [x] Project export/import and recoverable backups
2. [x] Speech bubbles and captions
3. [x] Scene object stickiness and attachment (scenery pinning, prop/bubble attachment, compound clamping)
4. [x] Scene Book entity preview fidelity
5. [x] Multi-select, grouping, alignment, and keyboard scene outline
6. [x] Scene templates and duplicate-current-scene flow

### Gate D — Offline family release (Completed)

1. [x] Add installable PWA manifest and Home Screen metadata.
2. [x] Cache the app shell and cataloged artwork for offline startup.
3. [x] Add Turkish in-app guide with accessible dialog and iPad instructions.
4. [x] Document HTTPS hosting, GitHub Pages suitability, cache updates, and local data limits.

### Gate E — Expansion

1. [x] New backgrounds, dolls, clothing, and props
2. [x] Expand core wearables and props with catalog/provenance metadata
3. Fabric patterns after SVG ID scoping
4. Paper-tab visual toggle
5. Interactive props and optional sound effects
6. [x] Panoramic stages and camera navigation (`1600`, `3200`, `4800` widths with persisted cameraX, minimap, steppers, trackpad/wheel, edge auto-pan)
7. World map and scene transitions
8. Custom paint studio (implementation complete; hosted-device and cross-browser evidence in progress)
9. Pose/gesture animation after export and reduced-motion contracts are defined

### Gate F — Play hardening (Completed)

Ordered by player impact. Sourced from the 2026-08-18 Play review; full detail in [../review/ISSUES.md](../review/ISSUES.md).

1. [x] Close R-06 (PL-1) and add the two panoramic movement regression tests.
2. [x] Fix the Scene Outline labelling defects: per-style bubble names (PL-2) and injected `getAsset` so custom props keep their name (PL-3).
3. [x] Restore keyboard reachability: context-ring focus after its own actions (PL-8) and modifier-aware stage shortcuts (PL-10).
4. [x] Localize the Play surface: all `scene/*` reducer messages, per-mode alignment phrasing, tray/entity/outline accessible names, `BUBBLE_PRESETS`, the camera slider label, and `assets.*` entries for all 22 props, 7 backgrounds, and 6 dolls with `assetName()` applied at every call site (PL-4, PL-5, PL-6).
5. [x] Patch-render the Play surface instead of rebuilding it per mutation, following the I-05 pattern and gating the spawn tray (PL-7).
6. [x] Correct panoramic input details: wheel handler claims only horizontal gestures (PL-9), and tray spawns respect `cameraX` (PL-11).
7. [x] Clear the consistency backlog: PL-13 to PL-20, including a single `bubbleStyleLabelKey` in `domain/vocabulary.js` replacing three copies of the bubble label map (PL-14).

8. [x] Close R-07 (PLR-1) and add both the custom-prop tray test and the composition-root wiring contract.

Gate F is closed. The hosted iPad smoke test is the last item before family release.


## Acceptance summaries for planned features

| Feature | Must prove |
|:--|:--|
| Project portability | Validate-before-mutate, Replace/Merge, collision rewriting, backup/rollback, limits, custom-asset handling. |
| Speech bubbles | Plain text, grapheme limits, attachment behavior, keyboard path, preview/export parity. |
| Object stickiness | Pinned scenery immovable by pointer, hierarchical parent-child delta move, compound boundary clamping, cycle-free attachment, detach-on-parent-delete. |
| Multi-select | One command/history entry, deterministic order, accessible outline alternative. |
| Panoramic stages | Persisted camera, correct coordinate offset, all input modes, edge pan, efficient offscreen behavior. |
| Custom paint | IndexedDB transactions, byte quotas, safe metadata, placeholders, portability, explicit destructive cleanup, mixed raster/vector render parity, and dated hosted-device evidence. |

## Completed implementation sequence

The original 19-task plan is consolidated here instead of retained as separate plan/status/task documents:

1. Domain model, shell, store/storage, asset contract/catalog, coordinate and pointer primitives
2. Doll renderer, wardrobe, color editing, Dollbox CRUD
3. Stage/backgrounds, spawn tray, selection/editing, controls, autosave/reload
4. Automated domain/integration/static UI tests
5. Offline PWA shell, Turkish guide, and family deployment documentation

Manual core journeys and the formal release matrices remain open even where automated coverage exists. The PWA installation path and Custom Paint offline flow are documented, but a real hosted iPad Safari install/offline smoke test is still required before a family release.

## Improvement backlog

Observations from the 2026-08-18 hardening pass. Completed items remain here for traceability; the rest are deliberate trade-offs worth revisiting before or shortly after the family release. Ordered by expected value on the target iPad.

### Performance

| ID | Item | Why it matters | Suggested approach |
|:--|:--|:--|:--|
| I-01 | **Completed 2026-08-18.** Paint history stores full-frame `ImageData` snapshots | 2.16 MB per wearable step, 4 MB per prop step. Twenty prop steps hold ~80 MB resident, the largest memory commitment in the app. | History now stores dirty-rectangle patches; transient full-canvas state is retained only while a drag needs restoration. |
| I-02 | **Completed 2026-08-18.** `imageDataChanged` reads and compares the whole canvas per commit | Full-canvas comparisons allocated a copy on every stroke end, selection edit, clear, and cutout. | History comparisons now read only the affected rectangle. |
| I-03 | **Completed 2026-08-18.** Every stroke allocates two full-canvas buffers | On a 1000×1000 prop this created 8 MB of short-lived allocation per stroke. | A stroke keeps one transient before-image and uses rectangle-sized comparison/history buffers. |
| I-04 | **Completed 2026-08-18.** Flood fill uses a per-pixel stack of plain numbers | Up to ~2M array entries on a full-canvas fill. | Flood fill now uses a scanline span stack and reports its dirty bounds. |
| I-05 | **Completed 2026-08-18.** Designer re-renders the full doll on every dispatch | Each colour swatch or slot change rebuilt all layers, even when only one CSS custom property changed. | Color-only draft changes now update existing layer custom properties; model, asset, face, and baked-face structure changes still rebuild. |

### Architecture and maintenance

| ID | Item | Suggested approach |
|:--|:--|:--|
| I-06 | **Completed 2026-08-18.** `paint-view.js` is ~2.4k lines and owns canvas, toolbars, dialogs, My Art, save pipeline, and draft recovery | My Art/library flows now live in `paint-library-view.js`; save, draft checkpoint, and recovery flows now live in `paint-save-service.js`; the view owns the canvas and tools. |
| I-07 | `makeAssetPlaceholder` builds its accessible name in English (`${label} unavailable`) | Route through `i18n` like the rest of the render path. Currently the only untranslated string reaching assistive technology. |
| I-08 | **Completed 2026-08-18.** Three separate slot→viewBox tables exist (`SLOT_PREVIEW_VIEWBOX` plus `tightViewBoxes` in Paint) with different values | The two intentional contracts now live in `core/preview-viewboxes.js`: `SLOT_PREVIEW_VIEWBOX` for wardrobe cards and `SLOT_CUTOUT_FALLBACK_VIEWBOX` for raw Paint cutouts without `getBBox()`. |
| I-09 | **Completed 2026-08-18.** CSS is loaded through an `@import` chain behind a single `?v=` marker | Every stylesheet link and import now carries a content fingerprint validated by `scripts/validate-cache-busting.mjs`. |
| I-10 | **Completed 2026-08-18.** No automated check couples asset or shell changes to a `CACHE_NAME` bump | The validator fingerprints every `APP_SHELL` resource and fails when `CACHE_NAME` does not match the current shell. It runs as part of `npm run check`. |

### Product

| ID | Item | Suggested approach |
|:--|:--|:--|
| I-11 | **Completed 2026-08-18.** Fit warnings render one label per incompatible item, stacked over the doll | Incompatible pieces now share one compact expandable warning with a readable detail list; the individual placeholders remain labeled for fallback consumers. |
| I-12 | **Completed 2026-08-18.** Paint reference model choice no longer constrains fit (D-034), but nothing tells the player which bodies their artwork will suit | The wearable save dialog states that player artwork is compatible with every doll model. |
| I-13 | **Completed 2026-08-18.** `editCopyOfArtwork` draws the copied bitmap without seeding history | Opening a copy now records the blank canvas as the first undo step. |
| I-14 | **Completed 2026-08-19.** `assets.*` had no entries for 29 of 87 wearables — the child, baby, adult, and elder garments added in Gate E | All built-in wearable labels now resolve in both locales, and a catalog-backed i18n test prevents future omissions. |

### Play (2026-08-18 review)

Status verified against source and at runtime on 2026-08-19. All twenty findings are closed, as is the PLR-1 regression that the verification pass uncovered.

| ID | Sev | Status | Item |
|:--|:--|:--|:--|
| PLR-1 | P1 | Closed (R-07) | Custom props absent from the Play spawn tray — `getAssetsByKind` declared by `createPlayView` but never passed by `app.js`. Regression introduced by the PL-13 fix; now covered by a composition-root contract test. |
| PL-1 | P1 | Closed (R-06) | Panoramic single-entity moves clamped to `1600`. Regression tests confirmed to fail when reintroduced. |
| PL-2, PL-3 | P1 | Closed | Scene Outline per-style bubble labels and injected asset resolution for custom props. |
| PL-4, PL-5, PL-6 | P2 | Closed | Full Play localization: reducer messages, alignment phrasing, accessible names, and 35 new `assets.*` entries. |
| PL-7 to PL-12 | P2 | Closed | Render patching, context-ring focus, wheel input, modifier-aware shortcuts, camera-relative spawns, pinned-move feedback. |
| PL-13 to PL-20 | P3 | Closed | Injected registry and selectors, named viewport constants, DOM guards, single bubble-label source, concurrent panel loads. |

The original findings are retained below for traceability. They describe pre-fix behavior and are not status markers.

| ID | Sev | Item | Why it matters |
|:--|:--:|:--|:--|
| PL-1 | P1 | Panoramic single-entity moves clamp to `1600` | Tracked as release blocker R-06. Loses player work placed outside the first panel. |
| PL-2 | P1 | Scene Outline names every bubble "Speech bubble" | The outline is the documented accessible alternative; the style icon is `aria-hidden`, so the distinction is unavailable to assistive technology. |
| PL-3 | P1 | Scene Outline resolves assets through the built-in catalog | Custom props all collapse to the generic "Scene prop" label. Also a layer inversion — the one Play view not given an injected `getAsset`. |
| PL-4 | P2 | ~30 `scene/*` reducer messages are hardcoded English | The primary Play feedback channel stays English in the Turkish UI; `Aligned items (distribute-h)` also leaks an internal enum. |
| PL-5 | P2 | Spawn tray and entity accessible names are hardcoded English | Larger than I-07: the whole tray is untranslated to assistive technology, and `BUBBLE_PRESETS` persists English default text into saved scenes despite existing translations. |
| PL-6 | P2 | `#camera-slider` carries no `data-i18n-aria-label` | The only HUD control that does not re-translate on language switch. |
| PL-7 | P2 | Every mutation rebuilds the stage and the full spawn tray | Play twin of the closed I-05. A held arrow key re-clones every doll on stage and in the Dollbox per repeat — the largest remaining frame-budget risk on the target iPad. |
| PL-8 | P2 | Context-ring actions destroy their own focus | D-5 in Play. A keyboard user can scale or reorder once per ring visit, then must tab back in. |
| PL-9 | P2 | Wheel handler swallows vertical page scroll over panoramic stages | The natural iPad/trackpad scroll gesture is consumed and converted to camera pan. |
| PL-10 | P2 | Bare letter shortcuts fire under Ctrl/Cmd | `Cmd+O`, `Ctrl+D`, and `Ctrl+P` are hijacked while the stage is focused. |
| PL-11 | P2 | `nextSpawnPoint` ignores `cameraX` | Tapping a tray card while panned places the item far off-screen with only a toast as feedback. |
| PL-12 | P2 | Arrow-key move on a pinned entity fails silently | Correct at the domain layer, but the player gets no indication that pinning is the reason. |
| PL-13 | P3 | Play re-implements the registry's custom-prop merge | The duplication class that produced D-1: two copies of one discovery filter, free to drift. |
| PL-14 | P3 | `t(...) \|\| 'Balon'` is unreachable | `t()` returns the key path on miss, so a typo renders `play.bubbleShout` to the player. |
| PL-15 | P3 | `const placeBelow = true` with a one-branch ternary | Either the ring should flip above entities near the stage floor, or the flag should go. |
| PL-16 | P3 | `findSceneSkinSvg` queries `document` directly | Bypasses the injected `$$` that makes the module testable. Same class as the closed D-9. |
| PL-17 | P3 | `1600`, `900`, and `800` inlined across Play | A `CAMERA_CONSTANTS.VIEWPORT_WIDTH` would remove all of them and make the panoramic contract greppable. |
| PL-18 | P3 | Unguarded DOM dereferences in the Play render path | Inconsistent with the guarded siblings in the same file. D-13 in Play. |
| PL-19 | P3 | Bubble dialog focuses twice behind a bare 50 ms timer | Presumably an iPad Safari workaround, but uncommented, so it reads as accidental. |
| PL-20 | P3 | Background panels awaited sequentially | Three serial awaits per render on a `4800` stage. |

Coverage gaps found alongside these: no test moves an entity on a stage wider than `1600`, no test narrows a stage to anything other than `1600`, no test asserts a Play status message is translated, and no test drives `handleStageKeydown` with a modifier held.

## Change discipline

Every change states outcome, affected contracts, migration/storage impact, acceptance criteria, evidence, risk, and rollback. A persisted-schema, asset-security, coordinate, or architecture change also updates [DECISIONS.md](DECISIONS.md) and its owning canonical document.
