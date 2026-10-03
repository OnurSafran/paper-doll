# System Architecture

## Principles

1. `AppStore` owns serializable domain state; DOM is derived output.
2. Commands express intent and are the only mutation path; subscriptions report completed changes.
3. Domain rules remain browser-independent and testable.
4. Pointer and keyboard actions commit the same logical commands.
5. Persistence, export, and rendering consume validated state.
6. Storage, asset, audio, and export failure is explicit and recoverable.
7. Major features extend stable boundaries instead of enlarging `app.js`.

## Current topology

The extraction described by D-019 is complete: `app.js` is bootstrap and routing, and each feature owns its own view module.

```text
js/app.js                            bootstrap and controller composition
js/app-*.js                          routing, shortcuts, dialogs, events, recovery, effects
js/features/designer/                Designer view and Dollbox
js/features/paint/                   Paint Studio view, session, raster ops, guides
js/features/play/                    stage, tray, selection, actions
js/features/scene-book/              dialogs and derived previews
js/features/world-map/               World Map view, landmarks, and souvenir passport
js/services/project-repository.js    load/save/revision/recovery/conflicts
js/services/custom-art-repository.js IndexedDB artwork, drafts, staging, backups, trash
js/services/project-portability.js   versioned export/import bundling
js/services/export-service.js        immutable-snapshot PNG export and fallback
js/services/export-worker*.js        worker ownership, transfer, cancellation
js/services/export-draw-list.js      shared canvas operation recording/replay
js/services/voice-puppetry.js        microphone/AudioContext lifecycle
js/services/scene-animation-service.js looping animation coordinator
js/domain/vocabulary.js              expressions, slots, limits, enums, reference doll IDs
js/domain/outfit-rules.js            equip, fit, and face compatibility rules
js/domain/scene-rules.js             scene geometry, clamping, alignment
js/domain/scene-templates.js         curated storytelling starters
js/domain/world-map-catalog.js       biomes, landmarks, and souvenir stamp catalog
js/core/app-store.js                 commands, subscriptions, history, prefix routing
js/core/reducers/                    pure domain slice reducers and payload validation
js/core/state-schema.js              validation and version-boundary reset
js/core/asset-catalog.js             catalog lookup and discovery filtering
js/core/asset-registry.js            unified built-in and custom descriptors
js/core/preview-viewboxes.js         shared slot preview viewBoxes
js/core/mouth-expression.js          expression mutation shared by render and export
js/core/doll-svg.js                  character doll SVG compositing
js/core/bubble-svg.js                procedural dialogue bubble SVG generator
js/core/i18n.js                      runtime translation engine and DOM updater
js/core/locales/                     isolated Turkish and English translation dictionaries
js/core/svg-loader.js                validated same-origin SVG loading and caching
js/core/svg-symbols.js               stage-local built-in prop symbol reuse
js/core/coordinate-space.js          logical/client conversion
js/core/pointer-controller.js        pointer session lifecycle
js/core/palette.js                   palette tokens and normalization
js/core/storage-adapter.js           guarded localStorage access
js/core/error-boundary.js            top-level error handling and disposable registry
js/core/dialog-dismiss.js            light-dismiss and context-aware focus restoration
js/types.js                          JSDoc type definitions for AppState, SceneRecord, CustomAsset
```

### Dependency rules

- Feature views dispatch commands; they do not mutate state or write storage.
- Services accept plain data and injected browser capabilities; they do not query feature DOM.
- Persisted enums have one definition in `domain/vocabulary.js`. Slot lists, reference doll IDs, and tool/shape vocabularies are imported, never re-declared in a feature module.
- Shared rendering helpers live in `core/`. A feature view never imports a helper from `services/`.
- Catalog fit, style, and prop-collection filtering happens in `core/asset-catalog.js` and the unified `core/asset-registry.js`; views pass parameters instead of re-implementing predicates.
- Views raise prompts through the injected dialog service, never `alert`/`confirm`/`prompt` (D-035).
- A view that registers window-level or document-level listeners exposes a `teardown` / `destroy` method that removes them.
- The repository is the only owner of serialized envelope revisions and conflict checks.
- Export snapshots state once; later edits cannot affect the in-flight result.
- Voice frames are ephemeral DOM previews. Only explicit static-expression commands persist.

## State ownership

```javascript
{
  schemaVersion: 8,
  revision: 1,
  settings: { reducedMotion: 'system', soundEnabled: false, stamps: [], unlockedBackgrounds: [] },
  customAssets: [],
  designer: { draft: { baseDollId: 'doll_classic_a', skinTone: 'peach', face: { eyes: { assetId: 'eyes_classic', irisColor: 'cocoa' }, eyebrows: { assetId: 'brows_soft' }, nose: { assetId: 'nose_dot' }, mouth: { assetId: 'mouth_gentle_smile' }, detail: null }, slots: {} }, selectedSlot: 'top', editingPresetId: null, dirty: false },
  presets: [],
  scenes: [],
  currentScene: {},
  ui: {
    mode: 'designer',
    selectedEntityId: null,
    selectedEntityIds: [],
    activeSceneLibraryId: null,
    storageStatus: 'saved',
    voicePuppetryActive: false
  }
}
```

Persist `settings`, `customAssets`, `presets`, `scenes`, and `currentScene`. Do not persist UI selection, voice-active state, drag previews, render tokens, object URLs, audio frames, or history stacks.

Custom prop records may persist a validated `collections` array containing the
thematic IDs `home`, `outdoors`, `creative`, and `fun`. My Art is derived from
custom ownership and is not stored as a user-editable collection. The
`customAsset/setCollections` command is the only mutation path for these values;
the registry exposes them through the same descriptor contract as built-in props.

### Layer Stacking Order
- 10: `hairBack` (built-in SVG back hair)
- 20: `skin` (doll body base model; `#baked-face` hidden when modular face exists)
- 22: `face-eyes` (with customizable `--iris-color`)
- 24: `face-eyebrows`
- 25: `face-detail` (blush, freckles)
- 26: `face-nose`
- 28: `face-mouth` (with expression support)
- 30: `bottom`
- 35: `shoes`
- 40: `top`
- 45: `dress`
- 70: `hairFront` (built-in SVG front hair and custom raster hair)
- 80: `accessory`

### Command contract

A handler validates payload and IDs, applies pure rules, returns a new state, and marks whether persisted fields changed. Invalid/no-op commands do not announce success or schedule storage.

History snapshots only domain state. A pointer drag updates transient preview coordinates and commits one move command on successful release.

## Rendering

- Monotonic tokens prevent stale async SVG rendering from replacing newer output.
- Parsed SVG templates are cached. Dolls, wearables, previews, and exports receive independent clones; stage props share scoped symbols through `core/svg-symbols.js`. Each stage owns and prunes its symbol catalog, while entity transforms remain independent.
- Collections render from stable IDs and restore focus when the focused item remains.
- Unknown assets render labeled placeholders and remain selectable/removable.
- Scene Book and export derive from state; thumbnails are never persisted. Background layout uses the asset's declared native width (`1600`, `3200`, or `4800`) and repeats or crops it without non-uniform stretching.

### Outfit composition

All doll-space assets share `0 0 300 450`. The renderer orders semantic layers. A hair choice may provide `hairBack` and `hairFront`, but state stores one hair slot.

### Scene transforms

Scene state stores ground anchor `(x, y)`, scalar `scale`, boolean `flipped`, and normalized integer `order`.

```html
<button class="scene-entity-positioner">
  <span class="scene-entity-visual">…</span>
</button>
```

- Positioner owns translation.
- Visual owns scale/flip.
- Selection UI is outside the flipped visual.
- Temporary drag elevation never mutates persisted order.

Clamping uses entity dimensions, scale, and catalog ground anchor to keep all items within the `1600 × 900` logical stage.

`domain/character-geometry.js` is the single character mapping for Play, Scene Book, and export. A character's `(x, y)` is its neutral foot contact. The full `300 × 450` canvas renders at a uniform `235 / 300` scale around that contact, and root motion pivots on it. The logical envelope keeps the full width and top of the canvas but ends at the contact, so bounds and shadows meet the feet without cropping hair, hats, or motion overflow.

## Coordinate and pointer lifecycle

The stage viewport has a fixed 16:9 aspect ratio (`1600 × 900` viewport window), while the inner `#scene-world` supports panoramic widths (`1600`, `3200`, or `4800` logical units). The virtual camera translates `#scene-world` via hardware-accelerated GPU transforms:

```css
.scene-world {
  width: calc(var(--stage-width, 1600) / 1600 * 100%);
  transform: translate3d(calc(-1 * var(--camera-x, 0) / var(--stage-width, 1600) * 100%), 0, 0);
  will-change: transform;
}
```

Coordinate conversions translate between viewport client coordinates and absolute stage logical coordinates:

```text
scale = stageRect.width / 1600
logicalX = (clientX - stageRect.left) * (1600 / stageRect.width) + cameraX
logicalY = (clientY - stageRect.top) * (900 / stageRect.height)
```

Pointer selection has one authority. `PointerController` accepts an optional `resolveSubject(event)` hook, and Play resolves the subject before selection, drag sessions, or capture. `features/play/stage-hit-testing.js` walks positioners front to back (z-index, then DOM order) and maps the point through each candidate's live transforms. It reads the same CSS variables the renderer uses: position, anchor, flip, attachment motion, root motion, and per-channel joint motion. It then samples cached alpha masks at threshold 15 and passes through any number of transparent candidates. Masks are rasterized once per artwork: one per prop viewBox, custom PNG, or bubble, and one per rig channel (body, head, arms, legs) for dolls. They are prepared before an entity element is inserted, released through `retain()`, and never rebuilt during a drag. Missing artwork falls back to its placeholder box. Entity buttons handle only keyboard `click`s (`detail === 0`), so a pointer release on the front button cannot override fall-through and Shift toggles exactly once. Hit testing maps client points through the stage's content box (inside its border), matching the rendered world.

Artwork edges receive a bounded 2.5 CSS-pixel disk tolerance, mapped through those same live transforms; padding and large holes remain transparent. Prepared descriptors retain DOM/style references. Mask keys include custom-art revisions and baked-face state, while recolors and poses reuse their masks. Original doll SVG roots retain their inherited presentation and authoring viewport, and embedded rasters are inlined before channel rasterization to preserve clipping and opacity. A mask failure replaces the visual with the existing explicit placeholder before allowing box selection. Shared prop symbols allow internal viewport overflow so the outer instance clips only once, matching standalone edge strokes. `npm run test:hit-testing-browser` verifies these paths with isolated fixtures and real Chromium pointer events; it requires an available Playwright runtime.

Selection uses a small downward arrow above each selected artwork instead of a rectangular frame. Its neutral anchor comes from the painted extents already collected in the cached alpha masks, including letterbox offsets; it inherits visual flips, attachment transforms, and doll root motion. Keyboard focus uses a blue arrow. The marker has no pointer target. The context toolbar is a fixed overlay under `document.body`, outside the stage's clipping ancestors. It follows cached neutral artwork bounds, including preview positions, flips and attachments, and centers below the visible selection (or visible selected group). Only the window's 12px margin limits horizontal centering; insufficient bottom space flips it above. It avoids the minimap and transport controls, leaves room for the arrow when above, and hides when the artwork leaves the visible stage/window or is clipped by the main scroller. Layout and toolbar dimensions are measured on selection, resize and scroll; drag updates reuse the preview's stage rectangle and read only cached geometry/inline transforms. Camera movement uses the same easing as the world. Narrow toolbars scroll horizontally, retain scroll position and action focus on rebuild, and handle keyboard shortcuts independently of the stage. Observers and listeners are removed when selection or Play ends.

A pointer session records pointer identity, subject, start/latest positions, threshold state, and cancellation. It captures after threshold, previews at animation-frame cadence with edge auto-panning (moving `cameraX` when hovering within 70px of the viewport edge), commits once on pointerup, and cancels on pointercancel, capture loss, route change, resize policy, deletion, visibility loss, or teardown.

## Object stickiness, attachment, and compound transform lifecycle

Scene entities support two stickiness mechanisms: **Scene Fixture Pinning** and **Hierarchical Entity Attachment**.

1. **Scene Fixture Pinning (`pinned: boolean`)**:
   - Pinned entities (e.g. wall frames, rugs, ceiling lights) are anchored to the background stage.
   - Pointer drag passes through or selects without movement; transforms are locked until unpinned via HUD or keyboard.

2. **Entity Attachment (`attachedTo: string | null`, `attachOffset: { dx: number, dy: number } | null`)**:
   - An entity (accessory, held prop, speech bubble) may declare a parent host `attachedTo: parentInstanceId`.
   - `attachOffset` stores relative logical coordinates `(child.x - parent.x, child.y - parent.y)`.
   - Moving a parent entity propagates the coordinate delta `(dx, dy)` synchronously to all attached descendants.
   - **Compound Bounding Clamping**: Parent movement is bounded by the union bounding box of the parent and all its attached children, guaranteeing no attached child clips past stage edges.
   - **DAG Invariant**: Circular attachments (`A -> B -> A`) and self-attachments are rejected by sanitization.
   - **Deletion Policy**: Deleting a parent automatically detaches all children in place (retaining their current absolute `(x, y)`), preventing dangling references.
   - **Export Parity**: Because absolute `(x, y)` is stored for every entity, PNG export renders attached entities identically without requiring hierarchy traversal during rasterization.

## Offline PWA and browser storage

The application is served as an installable PWA. `manifest.webmanifest` defines the standalone Home Screen experience, while `sw.js` caches the HTML shell, JavaScript modules, styles, icon, and cataloged SVG assets. The service worker is cache-first for app resources and uses the cached `index.html` as the navigation fallback when offline. Future hosted releases must pass `npm run validate:cache`, which fingerprints the app shell and ensures installed iPads activate a new cache when shell content changes.

Current project state uses guarded `localStorage` persistence. A future Custom Paint Studio may use IndexedDB for larger origin-local artwork records, but it must remain separate from the small validated project envelope. Project portability must explicitly export/import custom artwork before that feature is considered complete.

## Persistence and recovery

Current keys:

| Key | Role |
|:--|:--|
| `paperDollStudio.state` | authoritative last-known-good envelope |
| `paperDollStudio.state.tmp` | current write guard; not a recovery candidate |
| `paperDollStudio.quarantine.<timestamp>` | best-effort invalid raw data retention |

Each `localStorage.setItem` is synchronous and atomic at the single-key level; the two-key sequence is a guarded sequential write, not an ACID multi-key transaction. Cross-tab revision protection operates sequentially on a best-effort basis: the repository compares the disk revision to the in-memory base revision on every save attempt, rejecting stale writes with `REVISION_CONFLICT` unless explicitly forced.

### Read

1. Read the main key.
2. Clear stale temporary data.
3. Parse, migrate, validate, and bound the envelope.
4. Preserve valid children and drop invalid children with warnings.
5. Quarantine corrupt or unsupported raw data to `paperDollStudio.quarantine.<timestamp>`.
6. Report data recovery separately from storage availability (`recovered: boolean`).

### Write

1. Build a persisted projection from committed state.
2. Serialize/validate before touching main storage;
3. Check storage revision against base revision for cross-tab conflicts;
4. Write the temporary key;
5. Write the main key;
6. Clear the temporary key;
7. Increment base revision and report success only after the main write.

### Target revision model

The repository maintains monotonic sequential revisions (`revision: integer >= 1`). The repository tracks the base revision loaded by the tab. If disk storage advances beyond base revision, cross-tab conflict handling blocks auto-save and prompts Reload vs Keep. Future saves require explicit confirmation to overwrite newer disk changes.

Custom artwork bytes use IndexedDB transactions behind a separate repository; the small localStorage envelope stores references and metadata.

## SVG security

Only cataloged `assets/` paths are fetched. The loader rejects malformed XML, prohibited elements, event attributes, unexpected namespaces, embedded raster/data URLs, and external references; verifies root ID/viewBox/groups; imports a clone; and falls back to a labeled placeholder. See [ASSETS.md](ASSETS.md).

## Export service contract

- Capture one immutable validated state snapshot.
- Render background and ordered entities with stage-equivalent position, scale, flip, color, layer, and expression.
- Define missing-asset behavior explicitly.
- Disable duplicate starts, expose progress/failure, and support teardown cancellation.
- Revoke object URLs in all outcomes and normalize the filename.

## Voice service contract

- Request microphone only after explicit activation.
- Stop stream tracks, animation frames, and AudioContext on stop, route change, visibility loss, pagehide, denial, or stale request completion.
- Analyze locally; never record, serialize, or upload audio.
- Restore each character’s static expression when voice mode stops.
- Inject browser APIs for lifecycle tests.

## Error boundary and observability

Add top-level `error` and `unhandledrejection` handling that records stable privacy-safe codes without player content, stops unsafe follow-on work, keeps prior persisted state, and offers retry/reload. Local asset/export fallbacks do not replace this boundary.

## Accessibility and view lifecycle contracts

- **Live announcements**: `#sr-announcements` (`role="status"`, `aria-live="polite"`) delivers screen reader feedback for batch studio actions (e.g. multi-select alignments, bulk removals, and store messages) without polluting the visual canvas.
- **Context-aware dialog focus restoration**: `enableDialogFocusRestoration(dialog, fallbackSelector)` tracks the opening trigger element and restores focus to that exact element upon dialog dismissal (satisfying WCAG 2.1 SC 2.4.3 Focus Order).
- **View teardown lifecycle**: Feature views with document or window listeners expose standard `teardown()` and `destroy()` methods. Error boundaries, route navigations, and test suites invoke these hooks to prevent event listener leakage (D-040).
- **Disposable registry**: `createDisposableRegistry()` in `js/core/error-boundary.js` tracks arbitrary disposable resources (cleanup callbacks, `{ teardown }`, `{ destroy }`), aggregating errors safely without stopping execution during teardowns (D-042).

## Tooling and cache synchronization

- `scripts/update-sw-manifest.mjs` (`npm run update:sw`): Discovers runtime ES modules in `js/`, fingerprints styles in `index.html`, and regenerates `APP_SHELL` and `CACHE_NAME` in `sw.js` (D-038).
- `scripts/validate-cache-busting.mjs` (`npm run validate:cache`): Verifies that all CSS `@import` links and `CACHE_NAME` match real file SHA-256 digests.
- `eslint.config.js` (`npm run lint`): Flat config enforcing code quality and browser/node global separation.
- `tsconfig.json` / `jsconfig.json` (`npm run check:types`): TypeScript compiler configuration running `tsc --noEmit` with `checkJs: true` across runtime JavaScript and `type-tests/contracts.ts`; state, reducer action, asset, and DOM contracts use JSDoc (`js/types.js`). Strict mode is not enabled.

## Architecture migration order

Steps 1–7 are complete; the list is retained as the record of the order the boundaries were established.

1. Centralize expressions, limits, and other persisted enums. — Done
2. Fix expression round trips and asset-aware clamping. — Done
3. Extract project repository; then migrate revisions. — Done
4. Extract export and voice services. — Done
5. Split Designer, Play, and Scene Book feature modules. — Done
6. Add project portability and story tools. — Done
7. Begin panoramic stages or custom paint only after the prior boundaries are stable. — Done

Subsequent work follows the dependency rules above rather than this sequence. The 2026-08-18 Designer/Paint hardening pass added `core/preview-viewboxes.js` and `core/mouth-expression.js` and moved reference doll IDs into `domain/vocabulary.js`. Phase 1 Foundation Improvements added automated service worker manifest sync (`update-sw-manifest.mjs`), modular locale dictionaries (`locales/tr.js`, `en.js`), requestAnimationFrame live preview throttling, and standardized view teardown lifecycles. Phase 2 Foundation Improvements decomposed `app-store.js` into domain slice reducers (`js/core/reducers/`), added runtime action payload validation, a generalized disposable registry in `error-boundary.js`, JSDoc type definitions (`js/types.js`), keyboard panoramic navigation in `play-view.js`, and ESLint/TypeScript static checks.

## Phase 3 controller and export boundaries

Play, Paint, and application entry modules compose focused controllers below 500 lines each. State used by one controller stays local; explicitly injected callbacks and live getter/setter ports preserve shared render tokens and replaceable Paint sessions. Existing public view APIs remain stable.

PNG export uses one scene renderer for both paths: normal canvas operations or a recorded draw list. When Worker, OffscreenCanvas, and ImageBitmap are available, the worker owns stage composition and PNG encoding. SVG DOM construction and image compatibility decoding still run on the main thread. Export keeps one immutable snapshot and one in-flight lock; worker failure falls back to the established canvas path, while cancellation terminates the worker and skips fallback. Bitmap copies close on every exit. Worker and direct SVG drawing can differ slightly at rasterized edges.

## Room placement and custom support authoring

Schema 8 is the Paper Stage clean-start boundary (D-050). Saves below version 8,
unversioned saves, and unreadable JSON reset the full project, preferences, and
all IndexedDB stores before views or draft recovery open. No legacy migrations
remain. The new version is written only after reset succeeds; failures show a
reload dialog and retry next startup. Incompatible imports/backups are rejected.
`SceneRecord.placementMode` is internal state: background profiles enable room
constraints automatically, with free placement on unprofiled backgrounds. There
is no user mode toggle. Assets store `placementRules`/`supportSurfaces`; entities
store `placement`. New scenes use the supported bedroom background. Bedroom,
atelier, cafe, and the three Family & Home indoor settings describe their visible
wall/floor seams. Full-width rectangular planes form one logical support across
the stage; narrower authored regions repeat/mirror with their artwork. Current
saved tile IDs remain recognized as aliases and normalize on recovery.

`domain/placement-geometry.js` validates convex geometry, insets support polygons
by contact footprints, intersects full-stage visual bounds, and resolves the
nearest legal contact point. `domain/scene-placement.js` owns target selection,
projection/inverse projection, support-relative updates, recovery, and derived
render ordering. Surface children use the existing `attachedTo` relationship;
`placement.localPoint` is authoritative and absolute coordinates/offsets are
compatibility outputs. Invalid support is detached into a visible free exception
at the last position, never silently reattached on asset restoration.

Play pointer previews, tray drops, and secondary Place on destination buttons
share these rules. There is no persistent placement dropdown. Small props may
acquire and leave furniture support on free backgrounds; character-held drops
retain generic attachments. Pointer grab offsets use the original press position.
Nudges remain on the current logical support and can cross panorama seams;
pointer drags may transfer. Hosts carry children
when moved, scaled, and flipped. Ordinary Duplicate copies a host alone;
Duplicate with contents remaps the entire assembly. Supported-child duplicates
stay on their original surface. Invalid transforms reject the whole
operation. Surface-child pinning is relative to its host. Room ordering groups
furniture and supported props by the host's floor contact, puts rugs below upright
items, and keeps speech/caption overlays above the scene. Front/back commands
capture the current visible order and switch `layerOrderMode` to `manual`, while
retaining room placement constraints and support attachments. Subsequent ordering
uses entity `order`; the override survives saves and undo/redo. Play, Scene Book, direct
PNG export, and worker export share ordering and contact-shadow geometry.

Paint's `paint-placement-controller.js` owns an SVG metadata overlay outside the
raster. Rectangle, oval (16 vertices), and trapezoid presets use full-drawing
normalized coordinates while editing. The save service transforms anchors,
footprints, and surface vertices through the actual crop (pixels with alpha `>= 15`, shared with the placement preview);
invalid geometry prevents saving. Lightweight metadata entries interleave with
raster snapshots in the same Paint undo sequence. Drafts preserve geometry;
Edit Copy preserves saved support metadata. Existing unconfigured artwork stays
free. Host drawings can provide up to four surfaces and must allow Floor only.

`domain/stage-sizing.js` previews panorama shrink as removal of complete cut-off
assemblies. The UI confirms the exact item count with Yes/Cancel; the reducer
rejects unconfirmed removals. Confirmed size/removal/camera/selection changes are
one undo step. Safe retained contacts are reassigned to the new background tile
regions without moving them; stale dialog approvals cannot change a newer scene.
