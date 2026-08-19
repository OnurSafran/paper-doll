# Product and Functional Specification

## Product definition

Paper Doll Studio is a calm browser toy for creating paper dolls and arranging small stories. It is designed for children, casual players, parents, teachers, and facilitators who expect privacy, quick setup, and forgiving interactions.

### Core journey

1. Open Designer with a usable starter doll.
2. Equip garments or hair by drag, click, tap, Enter, or Space.
3. Recolor/remove pieces, name the doll, and save it.
4. Open Play, choose a background, and add saved dolls or props.
5. Move, flip, scale, reorder, duplicate, express, or remove entities.
6. Save named scenes, export PNG, refresh, and continue.

## Current product scope

| Area | Capability | Required behavior |
|:--|:--|:--|
| Foundation | Navigation | Designer and Play use semantic controls and `#designer` / `#play` routes. |
| Foundation | State | One serializable store owns domain state; UI state stays transient. |
| Foundation | Persistence | Settings, Dollbox, Scene Book, and current scene use one versioned local envelope. |
| Designer | Composition | Base doll plus deterministic slots and semantic layer order. |
| Designer | Wardrobe | Filter, equip, replace, remove, clear outfit, reset, and compatible shuffle. |
| Designer | Color | Curated tokens plus normalized `#RRGGBB` for tintable equipped pieces. |
| Designer | Dollbox | Save, open, update, rename, and delete up to 50 presets. |
| Play | Stage | Responsive view of a `1600 × 900`, `3200 × 900`, or `4800 × 900` logical scene with camera navigation HUD and minimap. |
| Play | Spawning | Add saved-character snapshots, collection-filtered catalog props, speech bubbles, or templates by activation or drag. |
| Play | Editing | Select, move, flip, scale, reorder, duplicate, pin, attach, align, and delete. |
| Play | Expressions | Seven static character expressions with stage/export/reload parity. |
| Play | Scene Book | Save, open, update, rename, duplicate, and delete up to 30 scenes with vector composite thumbnails. |
| Play | Recovery | Debounced current-scene autosave after committed mutations; explicit New Scene. |
| Play | Export | Render one immutable scene snapshot as full-width (`1600/3200/4800 × 900`) PNG with native-width background tiles or panoramas, never non-uniformly stretched. |
| Play | Voice | Optional local microphone analysis drives ephemeral mouth previews; audio is never recorded or uploaded. |
| Studio | History | Bounded Undo/Redo across Designer and Play commands. |

## Domain rules

### Outfit slots

| Slot | Cardinality | Compatibility | Layer |
|:--|:--|:--|--:|
| `hair` | 0–1 | One logical choice may expose back/front groups. | 10 / 70 |
| `body` | exactly 1 | Base doll is not removable. | 20 |
| `bottom` | 0–1 | Equipping clears `dress`. | 30 |
| `shoes` | 0–1 | Independent. | 35 |
| `top` | 0–1 | Equipping clears `dress`. | 40 |
| `dress` | 0–1 | Equipping clears `top` and `bottom`. | 45 |
| `accessory` | 0–1 | Replaces the previous accessory. | 80 |

### Scene interaction

- Click/tap selects without moving.
- Drag begins after `4 CSS px` for mouse/stylus or `8 CSS px` for touch.
- Position, scale, and flip compose independently.
- Arrow keys move by `10` logical units; Shift + arrow moves by `1`.
- `[` / `]` reorder, `-` / `+` scale, `D` duplicates, `P` toggles pinning, `O` opens scene outline, and Delete/Backspace requests deletion.
- `PageUp` / `PageDown` or `Shift+Arrow` pan camera; `Home` / `End` jump to camera edges.
- Camera slider, stepper buttons, and interactive minimap lens seek viewport smoothly.
- Edge auto-panning smoothly translates `cameraX` when dragging entities near stage edges.
- Floating controls supplement, but never replace, labeled persistent controls.
- Entity boundaries use rendered dimensions, scale, and catalog ground anchor to keep items completely within the `[0, stageWidth] × [0, 900]` logical stage.
- Props are discoverable through the short collections `Home`, `Outdoors`, `Creative`, `Fun`, and the derived `My Art` collection. A prop may appear in multiple thematic collections.
- Player-created props are always in My Art and can be assigned or reassigned to thematic collections from the My Art library.

### Destructive actions

- Confirm destructive actions only when they discard meaningful work.
- Deleting a Dollbox preset does not break existing character snapshots.
- Deleting a saved scene does not modify the active stage.
- Cancel is the safe default in destructive dialogs.
- Custom asset deletion must retain recoverable placeholders by default; deleting all uses is a separate, impact-counted, undoable choice.

## Persistence contract

All small project records live under `paperDollStudio.state`.

```json
{
  "schemaVersion": 3,
  "savedAt": "2026-08-16T00:00:00.000Z",
  "settings": {
    "reducedMotion": "system",
    "soundEnabled": false
  },
  "presets": [],
  "scenes": [],
  "customAssets": [],
  "currentScene": null
}
```

### Character preset

```json
{
  "presetId": "preset-id",
  "name": "Emma",
  "createdAt": "2026-08-14T00:00:00.000Z",
  "updatedAt": "2026-08-14T00:00:00.000Z",
  "baseDollId": "doll_classic_a",
  "skinTone": "peach",
  "slots": {
    "hair": { "assetId": "hair_ponytail", "color": "brown" },
    "top": { "assetId": "top_tshirt", "color": "coral" },
    "bottom": { "assetId": "bottom_jeans", "color": "denim" },
    "dress": null,
    "shoes": { "assetId": "shoes_sneakers", "color": "cream" },
    "accessory": null
  }
}
```

### Scene entity

```json
{
  "instanceId": "entity-id",
  "kind": "character",
  "sourceId": "preset-id",
  "characterSnapshot": {},
  "x": 800,
  "y": 720,
  "scale": 1,
  "flipped": false,
  "expression": "smile",
  "order": 1
}
```

Valid expressions are `neutral`, `smile`, `happy`, `surprised`, `o_mouth`, `talking`, and `wide_open` (centralized in `domain/vocabulary.js`), and round-trip consistently across store, schema sanitization, UI, reload, history, and PNG export. Pre-release development does not maintain backward compatibility or legacy migrations for outdated/broken save data (Decision [D-022](DECISIONS.md#d-022--no-pre-release-backward-compatibility)).

### Limits

| Value | Limit |
|:--|--:|
| Dollbox presets | 50 |
| Current-scene entities | 40 |
| Scene Book scenes | 30 |
| Preset name | 30 Unicode grapheme clusters |
| Scene title | 40 Unicode grapheme clusters |
| Entity scale | `0.5`–`2.0` |
| Stored color | catalog token or normalized `#RRGGBB` |

Derived thumbnails, DOM, SVG source, object URLs, pointer events, UI selection, microphone samples, and Undo/Redo history are not persisted.

## Edge-case outcomes

| Scenario | Required outcome |
|:--|:--|
| Missing asset | Labeled, selectable/removable placeholder; state retained. |
| Corrupt child record | Drop only the invalid child and report recovery. |
| Malformed envelope | Quarantine when possible; load safe defaults; report storage availability separately. |
| Quota/security failure | Preserve prior main value; continue in memory with explicit unsaved status. |
| Pointer/resize cancellation | Discard preview, release capture, retain last committed position. |
| Another tab saves | Never merge silently; revision-check before overwrite. |
| Empty scene | Valid, autosaved, and never replaced by the first-run sample. |
| Missing microphone permission | Voice mode stops; editing remains available. |
| Export asset failure | Follow one documented placeholder/fail policy and keep the stage unchanged. |

## Non-functional requirements

- Current and previous major Chrome, Safari, Firefox, and Edge.
- Desktop `1440 × 900`, tablet landscape `1024 × 768`, tablet portrait `768 × 1024`, and compact desktop `1280 × 720` smoke test.
- Keyboard-complete flow, visible focus, named controls, polite status, reduced motion, forced colors, and WCAG AA functional contrast.
- 60 FPS drag goal with 20 mixed entities; no sustained drag task over `50 ms`; warm local interactivity under `2 s`.
- No remote fonts, analytics, accounts, cookies, uploads, or server-side image processing.
- One-language MVP. Message catalogs, long-string/RTL layouts, and locale-aware formatting are future work.

## Planned feature contracts

### Project export, import, and backup

- Export versioned JSON for settings, presets, Scene Book, and current scene.
- Import follows parse → migrate → sanitize → preview → confirm.
- Replace retains a recoverable prior envelope; Merge rewrites colliding IDs and references.
- Unsupported future schemas and over-limit files change nothing.
- Custom assets must be bundled or explicitly reported missing.

### Speech bubbles and captions

- Plain-text scene entities only; no stored HTML.
- Stable ID, anchor, width, style token, order, and optional character attachment.
- Grapheme limits, keyboard editing/movement, readable contrast, scene-outline access, Scene Book preview, and PNG parity.
- Deleting an attached character follows one explicit detach-or-delete rule.

### Scene object stickiness and attachment

- Pinned scenery: Props designated as scene fixtures (e.g. wall frames, rugs, ceiling lights) stick firmly to the background. Pointer drag passes through or selects without displacing them until explicitly unpinned.
- Entity attachment: Handheld props, accessories, and speech bubbles can be attached to a host character or parent prop.
- Relative offset: Moving a parent entity propagates the coordinate delta `(dx, dy)` synchronously to all attached child entities.
- Compound bounds clamping: Movement is clamped so neither the parent nor any attached child breaches the `1600 × 900` logical boundary.
- Orphan and cycle safety: Attachment DAG is cycle-free. Deleting a parent entity safely detaches children (preserving their absolute coordinates) unless explicitly deleted as a group.
- Export and preview parity: All entities retain absolute logical `(x, y)` in state, guaranteeing identical PNG export and Scene Book thumbnails.

### Multi-select, grouping, and scene outline

- Marquee and additive selection are transient UI state.
- Group transforms are one command and one undo entry.
- Align/distribute and z-order are deterministic.
- A keyboard scene-outline list provides selection, naming, reorder, visibility, and deletion alternatives.

### Panoramic stages

- Support `3200 × 900` and `4800 × 900` logical widths with persisted `cameraX`.
- Accessible slider/buttons, minimap, trackpad/touch pan, keyboard pan, and edge auto-pan.
- Client-to-logical conversion adds camera offset; entity coordinates remain absolute.
- Begin only after the module/repository extraction in [ARCHITECTURE.md](ARCHITECTURE.md).

### Custom paint studio

- Wearable canvas uses `300 × 450`; prop artwork has explicit dimensions and ground anchor.
- Brush, eraser, fill, shapes, eyedropper, selection, mirror, and dedicated drawing history.
- Artwork bytes live in IndexedDB with byte/item quotas; localStorage stores metadata/references only.
- Project portability and safe placeholder deletion are prerequisites.
- The implementation uses a raster-first Canvas 2D painter with IndexedDB artwork storage, bounded history, project portability, and recoverable missing-art references.

## Non-goals

- Accounts, cloud sync, multiplayer, sharing links, or backend services
- Remote server-side image processing
- Complex raster-to-vector auto-tracing
- Persisted microphone/audio data
- Automatic destructive cleanup of missing custom assets
