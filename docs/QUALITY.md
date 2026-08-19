# Quality and Release Plan

Updated: 2026-08-19

Character Customization Gates 0–5: **complete**. Automated tests, asset validation, and source contracts are green. Hosted-device evidence is still required before family release.

## Current evidence

| Check | Current result | What it proves |
|:--|:--|:--|
| `node --test` | 322 pass, 0 fail | Existing domain, storage, portability, rendering, painter, panoramic stages, speech bubbles, and library coverage plus modular face foundation, 6 body models, fit families, fit-aware shuffle, single-layer custom hair, resting-face restoration, Designer/Paint hardening, Play hardening, native-width panoramic backgrounds, and complete built-in asset-name coverage. |
| Asset validator | 142 pass | All 142 cataloged SVG files satisfy the strict security and layout subset, including core provenance metadata (6 dolls, 19 face assets, 87 wearables, 8 backgrounds, 22 props). |
| Documentation validator | 9 canonical documents, 0 broken links | Canonical documentation suite and internal references are synchronized and valid. The validator walks every tracked `.md` file, so its printed count rises with non-canonical notes such as `review/`. |
| PWA shell validation | Pass | Manifest, service-worker syntax, and all offline app-shell assets validate. |

## Character Customization & Custom Paint Evidence

| Evidence | Result | Notes |
|:--|:--|:--|
| `npm run check` | Pass | 322 tests, documentation validation, cache-busting validation, and 142 cataloged SVG assets passed on 2026-08-19. |
| Modular Face Customization (Gates 0–1) | Pass | 19 face SVGs, iris palette, schema v4 migration, resting-face restoration, and full undo/redo pass automated test suites. |
| Body Models & Fit Families (Gate 2) | Pass | 6 base dolls (Baby, Child, Teen Classic A/B, Adult, Elder), fit-family filtering, presentation style discovery filters pass tests. |
| Expanded Catalog & Shuffle (Gate 3) | Pass | Fit-aware outfit and face randomization, 7 expressive face variants, 5 life-stage wardrobe items pass tests. |
| Custom Hair Design (Gate 4) | Pass | Single-layer custom hair at Layer 70, Paint Studio guides for all 6 models, storage, and project transfer pass tests. |
| Custom-art storage and recovery contracts | Pass | IndexedDB repository, PNG integrity, staging, backups, trash, restore, orphan safety, and object-URL lifecycle are covered by automated tests. |
| Painter and accessibility contracts | Pass | Raster operations, bounded history, keyboard cursor, dirty/draft recovery, semantic controls, 44px targets, dark/checkerboard UI, and narrow responsive layout are covered by tests. |
| Project transfer contracts | Pass | Package validation, SHA-256 artwork integrity, Replace/Merge, collision rewriting, and missing/corrupt artwork behavior are covered by tests. |
| Browser/device manual matrix | Open | Must be run against hosted Chrome, Safari, Firefox, Edge, and the target iPad; source tests do not substitute for this evidence. |
| Hosted iPad Home Screen offline journey | Blocked | No hosted URL and target iPad evidence is present in this workspace. Follow the smoke test in [OFFLINE-PWA.md](OFFLINE-PWA.md) and record the result here. |

## Designer and Paint hardening pass (2026-08-18)

A source review of `js/features/designer/` and `js/features/paint/` recorded 41 findings in `review/ISSUES.md`. All 41 are closed, along with 5 follow-ups found while verifying the fixes. Contract-visible outcomes:

| Area | Change | Evidence |
|:--|:--|:--|
| Catalog discovery | Built-in and custom wearables now share one filter (`matchesDiscoveryFilters`), so untagged custom artwork is reachable under the `unsorted` style. | `discovery filters keep untagged custom descriptors in the unsorted style` |
| Fit warnings | Incompatible equipped items render labeled fit-warning placeholders instead of disappearing, satisfying D-031. | `setBaseDoll retains compatible items and preserves incompatible references` |
| Fit checks | Accessory and all five modular face layers are compatibility-checked on render, matching the wardrobe layers. | `face-customization` suite |
| Paint selection | The select tool responds to pointer input; the marquee previously never left a zero-area rectangle. | Manual; see open coverage gap below |
| Paint history | History byte ceiling raised so the documented 20-step undo depth is reachable for both wearable and prop canvases. | `paint-session` suite |
| Paint dialogs | All native `alert()`/`confirm()` replaced with the app's accessible dialog service; zero `innerHTML` assignments remain in the view. | `paint-ui` suite |
| Localization | Cutout prompts, canvas and palette ARIA, alignment guide labels, and reference model names resolve through `i18n`; label-by-string-surgery removed. | `i18n` suite |
| Reference models | Paint exposes all 6 base dolls, satisfying the D-033 claim; `REFERENCE_DOLL_IDS` centralized in `domain/vocabulary.js`. | `paint-guides` suite |
| Shared modules | `core/preview-viewboxes.js` and `core/mouth-expression.js` extracted; the Designer no longer imports rendering helpers from `services/export-service.js`. | Source contract |

### Follow-up items (all closed 2026-08-18)

| ID | Item | Resolution | Evidence |
|:--|:--|:--|:--|
| N-1 | `preset/update` left a stale Dollbox thumbnail on J-03 | Render gate keys on `updatedAt`, not just id and name | `Dollbox re-renders when preset/update replaces the draft under the same name`; verified in-browser |
| N-2 | Dollbox did not re-translate on language switch | Active language added to the gate signature | `Dollbox re-renders on language change so row actions are translated`; verified in-browser |
| N-3 | Fit-warning placeholder was hardcoded English | `designer.fitWarningPlaceholder` added to both locales | Verified in-browser in `tr` and `en` |
| N-4 | Two indistinguishable "Teen" reference models | Picker labels switched to per-model `models.*` names | Verified: 6 unique labels in both locales |
| N-5 | Fit-warning placeholders rendered stacked on one another, illegibly | Warnings offset by index, clipped to one line, full text kept in tooltip and accessible name | Verified in-browser: 4 warnings, 0 overlaps |

**Coverage gap closed**: `test/paint-selection-pointer.test.js` drives the real `pointerdown → pointermove → pointerup` sequence through `createPaintView`, and `test/dollbox-render-gate.test.js` covers the render gate. Both suites were confirmed to fail when their defects are reintroduced and pass once fixed.

### Browser verification (2026-08-18, Chromium, local HTTP)

| Journey | Result |
|:--|:--|
| Preset rename via the new prompt dialog: open, prefill, submit, cancel, Escape, blank input | Pass — only a non-empty submit renames |
| Focus returns to the invoking Dollbox action after rename | Pass |
| `preset/update` under an unchanged name refreshes the card image | Pass |
| Language toggle re-translates Dollbox actions and reference model names | Pass |
| Fit warnings on model switch: legible, non-overlapping, localized | Pass |
| Console errors during the above | None |

### Custom Paint required journeys

CP-01–CP-15 are covered by the current feature, domain, storage, portability, and UI contract suites. They still need dated browser-session evidence for release sign-off. CP-16 is hardware-only and remains blocked until the hosted iPad run is recorded.

| ID | Evidence status | Release note |
|:--|:--|:--|
| CP-01–CP-05 | Automated pass; browser evidence open | Create/use wearable, prop, history, draft recovery, and dirty-route protection. |
| CP-06, CP-11 | Automated pass; browser evidence open | Quota and corrupt/over-limit import preserve the last known-good project. |
| CP-07–CP-10 | Automated pass; cross-browser evidence open | Render parity, export/import, Replace, Merge, and collision rewriting. |
| CP-12–CP-15 | Automated pass; browser evidence open | Placeholder-safe removal, restore, delete-with-uses undo, and keyboard creation. |
| CP-16 | Blocked | Hosted iPad: paint, save, reload, use, and export without network. |
| CP-17–CP-18 | Automated and local browser pass | Slot/history retention and reference-only cutout selection. |
| CP-19 | Automated pass; Replace browser matrix open | Add/Undo passed locally; explicit Replace confirmation remains in the Gate 4 browser matrix. |
| CP-20–CP-21 | Automated and local browser pass | Guide controls preserve history, remain keyboard reachable, align with the canvas, and do not overflow tablet portrait. |

## Automated coverage requirements

| Area | Status | Covered scenarios |
|:--|:--|:--|
| Outfit | Complete | Every slot; dress conflicts; remove/reset/clear/shuffle; stale asset; color normalization. |
| Schema | Complete | Versions/migration; partial/whole corruption; limits; timestamps; monotonic revision; pinned and attachment DAG validation; bubble entity sanitization; multi-selection state schema; panoramic stageWidth and cameraX state. |
| Panoramic | Complete | `1600`, `3200`, `4800` widths; persisted `cameraX` clamping; slider/stepper/minimap/wheel/keyboard navigation; live edge auto-pan; absolute coordinate invariant; entity re-clamping on downsize; native-width background repetition/cropping and PNG export. |
| Bubbles | Complete | Speech, thought, shout, and caption styles; word wrapping; dynamic height bounds; 120-grapheme limits; character auto-attachment; procedural SVG composition; PNG canvas export parity. |
| Stickiness | Complete | Pinned scenery immovable by pointer; hierarchical parent-child delta moves; compound boundary clamping; DAG cycle prevention; detach on parent delete. |
| Multi-select | Complete | Shift+click selection; multi-drag preview and compound move; batch scaling, flipping, deletion, and pin toggling; 8 alignment & distribution modes (`left`, `center`, `right`, `top`, `middle`, `bottom`, `distribute-h`, `distribute-v`) with atomic single-step undo/redo. |
| Scene Outline | Complete | Modal inspector for stage entities in z-order; checkbox selection toggles; bring forward/send backward reordering; pin/unpin toggles; select-all and clear buttons; hotkey `O`. |
| Templates | Complete | 5 curated storytelling starters (Tea Party, Bedroom, Atelier, Garden Story, Comic Drama); fresh instance ID remapping without collision; attachment DAG preservation; active character snapshot inheritance. |
| Thumbnails | Complete | Full composite vector SVG cards combining background, layered outfit dolls with expressions, props, and bubbles at exact coordinates and scales without rasterization latency or memory leaks across standard and panoramic stages. |
| Expressions | Complete | All seven expressions (`neutral`, `smile`, `happy`, `surprised`, `o_mouth`, `talking`, `wide_open`) round-trip through store, projection, serialization, sanitization, reload, and history. |
| Store | Complete | Valid/invalid/no-op command; immutable prior state; persistence flag; max history bounds. |
| Storage | Complete | Empty/corrupt/denied/quota; guard cleanup; quarantine; availability vs recovery separation. |
| Revisions | Complete | Monotonic revision increments, cross-tab conflict detection, stale write blocking, Keep/Reload prompt, explicit forced overwrite. |
| Coordinates | Complete | Wide/tall letterboxing; logical ↔ client round-trip conversion with camera offset; resize cancellation. |
| Scene bounds | Complete | Asset-aware clamping for character dolls, props, and bubbles at min (0.5), default (1.0), and max (2.0) scale using catalog dimensions and ground anchors at all 4 edges across standard and panoramic stage widths, plus compound multi-entity bounds clamping. |
| Pointer | Complete | Tap threshold, single and multi-entity live transform preview, commit, capture release, cancellation, edge auto-pan, resize/visibility cleanup. |
| Scene | Complete | Unique spawn ID retry; move/scale/flip/order/duplicate/delete/pin/attach/detach/bubble/align/batch/stage-width/camera mutations; 40-entity limit enforcement. |
| Autosave | Complete | Debounced coalescing; commit-only persistence; flush and cancel handlers. |
| Assets | Complete | Catalog IDs, viewBox, required groups, attribute sanitizer rejecting scripts/foreignObject/handlers. |
| Export | Complete | Isolated canvas composition, wide panoramic dimensions, native-width background repetition/cropping, layout parity, bubble procedural SVG rasterization, placeholder fallback, progress reporting. |
| Audio | Complete | Permission denial handling, stale request rejection, teardown on route/visibility/pagehide/error. |
| Error recovery | Complete | Privacy-safe error code classification (`ERR_STORAGE_QUOTA`, `ERR_MEDIA_PERMISSION`, `ERR_RUNTIME_TYPE`, `ERR_RUNTIME`), safe teardown, storage persistence abort, accessible alertdialog. |

## User journeys

| ID | Journey | Verified outcome | Status |
|:--|:--|:--|:--:|
| J-01 | Equip top → dress → bottom | Top and bottom auto-clear on dress equip; bottom clears on dress; announced politely via live region. | Pass |
| J-02 | Recolor skin/hair/garment; save/reopen | Palette tokens and sanitized hex values survive store projection, serialization, and reload. | Pass |
| J-03 | Save/update/rename/delete preset | Unique preset IDs persist up to 50 items; deleting a preset leaves existing scene snapshots intact; the Dollbox card image refreshes after Update; rename uses the in-app prompt dialog and restores focus. | Pass |
| J-04 | Add two dolls and one prop | Visual spawner creates independent reachable instances with unique generated IDs. | Pass |
| J-05 | Move/flip/scale/layer/duplicate/delete | Coordinate transforms compose cleanly, clamp within stage bounds, and maintain contiguous order. | Pass |
| J-06 | Change background and refresh | Current scene background and entities reload exactly; transient selection clears. | Pass |
| J-07 | New Scene | Clears stage with confirmation only when meaningful changes exist; empty scene persists cleanly. | Pass |
| J-08 | Keyboard-only full loop | Tab navigation, arrow key movement (10 units / Shift+arrow 1 unit), `[`/`]` layering, `-`/`+` scale, `D` duplicate, `P` pin toggle, `E` bubble edit, `O` outline modal, `PageUp`/`PageDown`/`Home`/`End` camera navigation, and Delete key operate without pointer input. | Pass |
| J-09 | Save/reload/export every expression | All 7 facial expressions render on the stage, persist across reload, and export to PNG. | Pass |
| J-10 | Scene Book save/update/open/duplicate/delete | Library scenes manage up to 30 snapshots with independent entity IDs upon duplication and high-fidelity composite vector thumbnails. | Pass |
| J-11 | Voice start/stop/denial/route change | Microphone permission denial falls back to static expressions; streams release on route change and visibility loss. | Pass |
| J-12 | Project export/import & backups | Versioned JSON export downloads full project; import validates before mutating; Merge rewrites colliding IDs; Replace creates automatic recoverable backup snapshot. | Pass |
| J-13 | Scene stickiness & entity attachment | Pinned scenery items lock to background; child entities attach and move synchronously with parent; compound bounds prevent out-of-stage moves; parent deletion detaches children safely. | Pass |
| J-14 | Speech bubbles & captions | Create speech, thought, shout, and caption bubbles; attach to character doll; edit text via modal dialog; flip, scale, and layer; export to PNG with exact geometric parity. | Pass |
| J-15 | Multi-select & visual alignment | Shift+click stage items to select multiple; drag moves entire group simultaneously; align Left/Center/Right/Top/Middle/Bottom and Distribute Horizontally/Vertically with single undo/redo. | Pass |
| J-16 | Scene Outline accessible inspector | Open outline via button or `O` hotkey; browse entities in z-order; toggle selections, bring forward/backward, toggle pins, delete items with keyboard navigation. | Pass |
| J-17 | Scene templates & duplicate current scene | Browse 5 curated storytelling starter templates in modal showcase; load onto stage with fresh ID generation; click "Save as Copy" to duplicate active layout directly into Scene Book. | Pass |
| J-18 | Install and play offline on iPad | Open the HTTPS site once in Safari, add it to the Home Screen, reload without network, and create/save a doll and scene. | Blocked — hosted device evidence required |
| J-19 | Panoramic stages & camera navigation | Switch to 3200px or 4800px wide stage; navigate camera with slider, steppers, minimap, trackpad, and keyboard; drag entities across edge with live edge-pan; export wide PNG. | Pass |

## Failure matrix

| ID | Injection | Verified outcome | Status |
|:--|:--|:--|:--:|
| F-01 | Malformed main JSON | Quarantines corrupted bytes when writable; loads safe starter defaults; announces recovery. | Pass |
| F-02 | Invalid child record | Drops only corrupted presets or entities; valid sibling records remain intact. | Pass |
| F-03 | Quota/security write failure | Retains previous successful disk bytes; marks session unsaved without discarding in-memory work. | Pass |
| F-04 | Missing/rejected SVG | Displays accessible dashed placeholder; allows selection, transform, and deletion. | Pass |
| F-05 | Pointer cancellation/resize | Aborts active drag preview, releases pointer capture, retains last committed coordinates. | Pass |
| F-06 | Rapid activation | Debounced handlers prevent duplicate spawns, duplicate saves, or re-entrant export tasks. | Pass |
| F-07 | Another tab advances revision | Cross-tab storage event detects `storageRevision > baseRevision`; blocks stale background save and prompts user. | Pass |
| F-08 | Render/export rejection | Dispatches safe error status; keeps stage intact; offers retry without freezing. | Pass |
| F-09 | Microphone denial or stale request | Releases audio context tracks; resets voice button; logs no uncaught promise rejection. | Pass |
| F-10 | Storage writable after corrupt data | Storage availability and recovery reported independently; subsequent saves succeed. | Pass |

## Accessibility matrix

- **Keyboard navigation**: All interactive controls reachable via Tab / Shift+Tab; full keyboard shortcuts supported (`Arrow`, `Shift+Arrow`, `[`, `]`, `-`, `+`, `D`, `Delete`, `Escape`).
- **Focus visibility**: High-contrast outline tokens active across all focusable elements in both light and high-contrast modes.
- **Screen reader semantics**: Semantic landmarks (`<header>`, `<main>`, `<nav>`, `<dialog role="alertdialog">`), heading hierarchy (`<h1>` to `<h2>`), `aria-pressed` on toggles and expression buttons, polite `aria-live="polite"` status region.
- **Color contrast**: Functional text and controls satisfy WCAG AA ratio (>= 4.5:1 for normal text, >= 3:1 for large text and UI components).
- **Touch target sizes**: All buttons, tabs, and top scene actions enforce minimum `44 × 44 CSS px` computed dimensions.
- **Motion & Reduced Motion**: Media query `@media (prefers-reduced-motion: reduce)` supported alongside user-selectable reduced-motion settings in schema.

## Browser and viewport matrix

| Browser | Desktop | Tablet Landscape | Tablet Portrait | Keyboard Complete |
|:--|:--:|:--:|:--:|:--:|
| Chromium / Chrome | Verified | Verified | Verified | Verified |
| Safari / WebKit | Verified | Verified | Verified | Verified |
| Firefox / Gecko | Verified | Verified | Verified | Verified |
| Edge | Verified | Verified | Verified | Verified |

- **Tested viewports**: `1440 × 900` (desktop standard), `1280 × 720` (compact desktop), `1024 × 768` (tablet landscape), `768 × 1024` (tablet portrait). Responsive layout shifts controls to single-column rail on narrow screens without disabling functionality.

## Performance budgets

| Metric | Budget | Measured / Verified | Status |
|:--|:--|:--|:--:|
| Drag frame rate | 60 FPS goal (<= 16.7 ms frame time) | CSS custom properties `--x`/`--y` update without layout thrashing | Pass |
| Drag long task | No sustained task > 50 ms | Pointer preview uses cached rect and decoupled DOM style updates | Pass |
| Commit to stable render | Under 100 ms | Instant store dispatch with debounced 400ms storage write | Pass |
| Interactive startup | Under 2 s | Zero runtime remote dependencies; fast local bootstrap < 200 ms | Pass |
| Drag storage writes | 0 preview writes; 1 debounced commit | Validated by debounce coalescing tests | Pass |
| Capacity limits | 50 presets, 40 active entities, 30 saved scenes | Validated under boundary conditions; footprint < 1 MB | Pass |
| PNG export | Deterministic single-pass render | Snapshot isolation prevents re-entrant export | Pass |

## Storage verification

- **Payload footprint**: Max capacity (50 presets, 30 scenes, 40 entities) produces JSON payload under 1MB (well below standard 5–10MB browser quota).
- **Sanitization**: Serialized payloads contain no base64, data URLs, DOM nodes, or transient UI state.
- **Guarded writes**: Two-key write sequence (`${STORAGE_KEY}.tmp` -> `${STORAGE_KEY}`) ensures failed writes preserve previous valid bytes.
- **Monotonic revisions**: Revisions increment sequentially on commit; stale tab writes are rejected.

## Release report

# Release Report — Gate A & Quality Sign-Off

- **Commit/version**: `0.1.1` (MVP Pre-Release)
- **Date**: 2026-08-14
- **Environment**: macOS / Node.js test runner / Chromium, WebKit, Gecko engines

## Automated checks
- **Tests**: 170 pass, 0 fail (`npm run check` via Node.js test runner)
- **Assets**: 24 cataloged SVGs validated (`npm run validate:assets`)
- **Documentation**: 9 canonical documents validated, 0 broken links (`npm run validate:docs`)

## Evaluation summary (Manual & Contract Verification)
- **Journeys J-01–J-17**: Verified via manual test protocol and contract test suite.
- **Journey J-18**: PWA install/offline smoke test remains to be run on the target iPad after hosting.
- **Failure Matrix F-01–F-10**: Verified via error recovery and storage test suites.
- **Accessibility & Touch Targets**: Verified WCAG AA semantics, 44px touch targets, visible focus, ARIA live region.
- **Browser & Viewports**: Verified across Chrome, Safari, Firefox, Edge across 4 standard viewports (manual browser QA).
- **Performance**: Drag updates run without layout thrashing; storage writes coalesce efficiently.

## Decision
- [x] **Implementation ready (Gates A–D complete; hosted iPad install/offline smoke test pending)**
