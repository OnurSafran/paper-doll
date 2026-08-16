# Implementation Status and Roadmap

Updated: 2026-08-16

This is the single authority for implementation status, open work, and delivery order. Product behavior belongs in [PROJECT.md](PROJECT.md); release evidence belongs in [QUALITY.md](QUALITY.md).

## Current snapshot

- Working dependency-free Designer and Play vertical slice
- 3 base dolls, 45 wearable/hair/accessory assets, 7 backgrounds, and 22 props
- Dollbox, Scene Book, current-scene autosave/reload, and local schema migration
- Pointer/keyboard scene editing, bounded Undo/Redo, and PNG export
- Seven in-session expressions and strictly local voice puppetry
- Custom Paint Studio Gates 0–3B complete with IndexedDB storage, portability, mixed renderers, bounded history, My Art lifecycle, non-destructive wearable slot switching, trusted cutout actions, and precision body/alignment overlays
- 237 automated tests passing
- 77 cataloged SVG files passing asset validation
- Catalog assets carry `added_date`, `creator`, `concept`, `dlc`, and `source` provenance metadata; current content pack is `core`
- Installable offline PWA shell with Turkish in-app guide
- Documentation validation passing with 9 canonical documents
- Gates A–D complete; Gate E asset expansion complete; Custom Paint Gates 0–3 complete; Gate 4 evidence is in progress and the hosted iPad smoke test remains before family release

## Status by capability

| Area | Status | Open work |
|:--|:--|:--|
| Domain/store | Implemented | Shared vocabulary, injected time/identity, and validated generated IDs are centralized. |
| Schema/storage | Implemented | Monotonic revision guards, post-write race detection, and recovery/availability reporting are complete. |
| Asset pipeline | Implemented | Add clone-ID scoping before patterns/definitions. Core asset provenance metadata and ordinary SVG expansion are in place. |
| Designer/Dollbox | Implemented | Modular feature architecture extracted cleanly. Complete real-browser accessibility journey. |
| Play/Scene Book | Implemented | Modular feature architecture extracted cleanly. Full entity thumbnails; panoramic world & camera navigation. |
| Undo/Redo | Implemented | Verify longer mixed-domain journeys and history semantics. |
| PNG export | Implemented | Extracted export service with immutable snapshots, progress/failure reporting, and parity fixtures. |
| Expressions/voice | Implemented | Extracted voice puppetry service with injected browser APIs, frequency analyzer, and teardown tests. |
| Browser/accessibility gate | Implemented | Evaluated across Chrome, Safari, Firefox, Edge across 4 standard viewports. |
| Performance/release gate | Implemented | Validated drag frame-budget, debounced storage coalescing, and capacity limits. |
| Offline PWA | Implemented | HTTPS install flow, app-shell caching, offline startup, cache-version update procedure, and iPad Home Screen guidance are documented. |
| In-app Turkish guide | Implemented | Header guide menu explains dressing, scenes, saving, backups, and offline play. |

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
8. [Custom paint studio](CUSTOM-PAINT-STUDIO.md) (Gates 0–3B complete; Gate 4 hosted-device and cross-browser evidence in progress)
9. Pose/gesture animation after export and reduced-motion contracts are defined

## Acceptance summaries for planned features

| Feature | Must prove |
|:--|:--|
| Project portability | Validate-before-mutate, Replace/Merge, collision rewriting, backup/rollback, limits, custom-asset handling. |
| Speech bubbles | Plain text, grapheme limits, attachment behavior, keyboard path, preview/export parity. |
| Object stickiness | Pinned scenery immovable by pointer, hierarchical parent-child delta move, compound boundary clamping, cycle-free attachment, detach-on-parent-delete. |
| Multi-select | One command/history entry, deterministic order, accessible outline alternative. |
| Panoramic stages | Persisted camera, correct coordinate offset, all input modes, edge pan, efficient offscreen behavior. |
| [Custom paint](CUSTOM-PAINT-STUDIO.md) | IndexedDB transactions, byte quotas, safe metadata, placeholders, portability, explicit destructive cleanup, mixed raster/vector render parity, and dated hosted-device evidence. |

## Completed implementation sequence

The original 19-task plan is consolidated here instead of retained as separate plan/status/task documents:

1. Domain model, shell, store/storage, asset contract/catalog, coordinate and pointer primitives
2. Doll renderer, wardrobe, color editing, Dollbox CRUD
3. Stage/backgrounds, spawn tray, selection/editing, controls, autosave/reload
4. Automated domain/integration/static UI tests
5. Offline PWA shell, Turkish guide, and family deployment documentation

Manual core journeys and the formal release matrices remain open even where automated coverage exists. The PWA installation path and Custom Paint offline flow are documented, but a real hosted iPad Safari install/offline smoke test is still required before a family release.

## Change discipline

Every change states outcome, affected contracts, migration/storage impact, acceptance criteria, evidence, risk, and rollback. A persisted-schema, asset-security, coordinate, or architecture change also updates [DECISIONS.md](DECISIONS.md) and its owning canonical document.
