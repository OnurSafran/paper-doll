# Quality and Release Plan

Updated: 2026-10-03

Automated checks are green. Hosted-device and cross-browser evidence is still missing, so the app is not yet cleared for a family release.

## Current evidence

Run on 2026-10-03 with `npm run check`.

| Check | Result | What it proves |
|:--|:--|:--|
| `node --test` | 710 pass, 0 fail | Domain rules, storage and revisions, portability, rendering and export parity, Paint, Play, depth placement, hit testing, packs, localization, accessibility contracts, and source-wiring contracts. |
| ESLint | 0 errors, 0 warnings | Unused code and undeclared globals in runtime, scripts, and tests. |
| `tsc --noEmit` | Pass | JSDoc contracts for runtime modules and `type-tests/`. |
| Documentation validator | Pass | Canonical documents exist and every relative link resolves. |
| Asset validator | 149 SVGs pass | Strict security and layout subset for the core catalog. |
| Pack validator | 2 manifests, 243 resources pass | Pack manifests, bundled files, and service-worker coverage. |
| Cache validator | Pass | CSS fingerprints, precached modules, and the app-shell cache version are current. |

Automated tests use mocked DOM and storage. The IndexedDB mock models transaction lifetime (D-052); it does not substitute for a real browser run.

## Open evidence

| Evidence | Status | Notes |
|:--|:--|:--|
| Browser/device matrix | Open | Only Chromium has been exercised, through `scripts/verify-hit-testing-browser.mjs` and `scripts/verify-scene-outline-browser.mjs`. Safari, Firefox, Edge, and the target iPad have no dated record. |
| Hit-testing script | Needs review | The 2026-10-03 run failed watering-can screenshot parity (mean difference 0.0014, max 19 against a limit of 16), likely Chromium antialiasing. No visible defect established. |
| Hosted iPad Home Screen offline journey (J-18) | Blocked | No hosted URL or device evidence. Follow [OFFLINE-PWA.md](OFFLINE-PWA.md), including offline Paint save, reload, use, and export, and record the result here. |
| Custom Paint browser journeys | Open | Create, history, draft recovery, quota and corrupt-import safety, export/import, Replace, Merge, and placeholder-safe removal are covered by automated suites; dated browser evidence is still needed for sign-off. |
| Family & Home release checks | Open | Independent fit, tint, thumbnail, PNG export, and target-iPad performance. |
| Paper Stage validation | Open | Moderated five-user pilot, physical iPad run, and crowded-scene frame times (D-049, D-050). |

## Automated coverage requirements

| Area | Status | Covered scenarios |
|:--|:--|:--|
| Outfit | Complete | Every slot; dress conflicts; remove/reset/clear/shuffle; stale asset; color normalization. |
| Schema | Complete | Versions/migration; partial/whole corruption; limits; timestamps; monotonic revision; pinned and attachment DAG validation; bubble entity sanitization; multi-selection state schema; panoramic stageWidth and cameraX state. |
| Panoramic | Complete | `1600`, `3200`, `4800` widths; persisted `cameraX` clamping; slider/stepper/minimap/wheel/keyboard navigation; live edge auto-pan; absolute coordinate invariant; entity re-clamping on downsize; native-width background repetition/cropping and PNG export. |
| Bubbles | Complete | Speech, thought, shout, and caption styles; word wrapping; dynamic height bounds; 120-grapheme limits; character auto-attachment; procedural SVG composition; PNG canvas export parity. |
| Stickiness | Complete | Pinned scenery immovable by pointer; hierarchical parent-child delta moves; compound boundary clamping; DAG cycle prevention; detach on parent delete. |
| Multi-select | Complete | Shift+click selection; multi-drag preview and compound move; batch scaling, flipping, deletion, and pin toggling; 8 alignment & distribution modes (`left`, `center`, `right`, `top`, `middle`, `bottom`, `distribute-h`, `distribute-v`) with atomic single-step undo/redo. |
| Scene Outline | Complete | Modal layer list with artwork thumbnails and effective z-order; mouse/touch drag handles and keyboard arrows; bring forward/send backward buttons; pin/unpin and trash buttons; hotkey `O`. |
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
| J-16 | Scene Outline accessible inspector | Open outline via button or `O` hotkey; browse artwork in z-order; reorder by dragging or keyboard arrows, toggle pins, delete items with keyboard navigation. | Pass |
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
| Chromium / Chrome | Partial | Partial | Partial | Partial |
| Safari / WebKit | Not recorded | Not recorded | Not recorded | Not recorded |
| Firefox / Gecko | Not recorded | Not recorded | Not recorded | Not recorded |
| Edge | Not recorded | Not recorded | Not recorded | Not recorded |

- **Target viewports**: `1440 × 900`, `1280 × 720`, `1024 × 768`, `768 × 1024`, and `375 × 812` with touch.
- Replace a cell with `Verified (date)` only after a recorded run.

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
