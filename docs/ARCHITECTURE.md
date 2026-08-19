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
js/app.js                            bootstrap, routes, cross-tab coordination
js/features/designer/                Designer view and Dollbox
js/features/paint/                   Paint Studio view, session, raster ops, guides
js/features/play/                    stage, tray, selection, actions
js/features/scene-book/              dialogs and derived previews
js/services/project-repository.js    load/save/revision/recovery/conflicts
js/services/custom-art-repository.js IndexedDB artwork, drafts, staging, backups, trash
js/services/project-portability.js   versioned export/import bundling
js/services/export-service.js        immutable-snapshot PNG export
js/services/voice-puppetry.js        microphone/AudioContext lifecycle
js/domain/vocabulary.js              expressions, slots, limits, enums, reference doll IDs
js/domain/outfit-rules.js            equip, fit, and face compatibility rules
js/domain/scene-rules.js             scene geometry, clamping, alignment
js/domain/scene-templates.js         curated storytelling starters
js/core/app-store.js                 commands, subscriptions, history
js/core/state-schema.js              validation and migration
js/core/asset-catalog.js             catalog lookup and discovery filtering
js/core/asset-registry.js            unified built-in and custom descriptors
js/core/preview-viewboxes.js         shared slot preview viewBoxes
js/core/mouth-expression.js          expression mutation shared by render and export
js/core/i18n.js                      Turkish/English strings and DOM translation
js/core/svg-loader.js                validated same-origin SVG loading and caching
js/core/coordinate-space.js          logical/client conversion
js/core/pointer-controller.js        pointer session lifecycle
js/core/palette.js                   palette tokens and normalization
js/core/storage-adapter.js           guarded localStorage access
js/core/error-boundary.js            top-level error and rejection handling
```

### Dependency rules

- Feature views dispatch commands; they do not mutate state or write storage.
- Services accept plain data and injected browser capabilities; they do not query feature DOM.
- Persisted enums have one definition in `domain/vocabulary.js`. Slot lists, reference doll IDs, and tool/shape vocabularies are imported, never re-declared in a feature module.
- Shared rendering helpers live in `core/`. A feature view never imports a helper from `services/`.
- Catalog fit, style, and prop-collection filtering happens in `core/asset-catalog.js` and the unified `core/asset-registry.js`; views pass parameters instead of re-implementing predicates.
- Views raise prompts through the injected dialog service, never `alert`/`confirm`/`prompt` (D-035).
- A view that registers window-level listeners exposes a teardown that removes them.
- The repository is the only owner of serialized envelope revisions and conflict checks.
- Export snapshots state once; later edits cannot affect the in-flight result.
- Voice frames are ephemeral DOM previews. Only explicit static-expression commands persist.

## State ownership

```javascript
{
  schemaVersion: 4,
  revision: 1,
  settings: { reducedMotion: 'system', soundEnabled: false },
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
- Parsed SVG templates are cached; every use receives an independent clone.
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

## Architecture migration order

Steps 1–7 are complete; the list is retained as the record of the order the boundaries were established.

1. Centralize expressions, limits, and other persisted enums. — Done
2. Fix expression round trips and asset-aware clamping. — Done
3. Extract project repository; then migrate revisions. — Done
4. Extract export and voice services. — Done
5. Split Designer, Play, and Scene Book feature modules. — Done
6. Add project portability and story tools. — Done
7. Begin panoramic stages or custom paint only after the prior boundaries are stable. — Done

Subsequent work follows the dependency rules above rather than this sequence. The 2026-08-18 Designer/Paint hardening pass added `core/preview-viewboxes.js` and `core/mouth-expression.js` and moved reference doll IDs into `domain/vocabulary.js` under those rules.
