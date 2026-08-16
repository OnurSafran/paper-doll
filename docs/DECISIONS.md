# Decision Log

Change an accepted decision only by recording a replacement and updating its owning project documents, schema, migration, tests, and roadmap where applicable.

| ID | Decision | Status | Reason |
|:--|:--|:--|:--|
| D-001 | `AppStore` owns domain state; DOM is derived. | Implemented | Prevents divergent UI/storage ownership. |
| D-002 | Persist one versioned small-state envelope. | Implemented | Enables migration and coherent recovery. |
| D-003 | Derive thumbnails; never persist base64 previews. | Implemented | Avoids quota waste and stale duplicates. |
| D-004 | Autosave/restore one current scene. | Implemented | Protects the core creative loop. |
| D-005 | Use fixed `1600 × 900` logical coordinates. | Implemented | Keeps scenes stable across viewports. |
| D-006 | Separate position from visual scale/flip. | Implemented | Transform operations cannot overwrite each other. |
| D-007 | Author doll assets in `0 0 300 450`. | Implemented | Slot composition stays deterministic. |
| D-008 | Use stable single-cardinality outfit slots. | Implemented | Dress and replacement behavior is predictable. |
| D-009 | Provide non-drag alternatives. | Implemented; evidence pending | Core creation/play must remain accessible. |
| D-010 | Accept only safe cataloged same-origin SVG. | Implemented | Inline SVG recolor needs a strict trust boundary. |
| D-011 | Keep runtime dependency-free; allow platform dev tools. | Implemented | HTTP serving and validation do not become runtime dependencies. |
| D-012 | Snapshot character appearance into scene instances. | Implemented | Preset edits/deletion cannot break scenes. |
| D-013 | Commit once per action and use bounded history. | Implemented | Undo/Redo stays predictable. |
| D-014 | Accept palette tokens or normalized `#RRGGBB`. | Implemented | Creativity without arbitrary CSS. |
| D-015 | Combine contextual and persistent scene controls. | Implemented | Efficient pointer use plus accessible fallback. |
| D-016 | Show sample scene only for pristine storage. | Implemented | Avoids blank first run without replacing work. |
| D-017 | Panoramic stages use persisted virtual camera state. | Implemented | Wide stories should not distort entity coordinates. |
| D-018 | Custom items retain placeholders by default; destructive cleanup is explicit. | Implemented | Prevents silent story loss. |
| D-019 | Extract feature modules and browser services before another major feature. | Implemented | Current browser orchestration is too concentrated. |
| D-020 | Add revision-aware repository persistence. | Implemented | Informational cross-tab prompts do not stop stale writes without monotonic revisions. |
| D-021 | Store custom artwork bytes in IndexedDB, not the localStorage envelope. | Implemented | Large assets need transactional object storage and quotas. |
| D-022 | Pre-release development does not maintain backward compatibility or legacy migrations. | Implemented | Early project iterations prioritize clean domain contracts and safe default resets over historical schema migrations. |
| D-023 | Scene fixture pinning and entity attachment preserve absolute coordinates and compound clamping. | Implemented | Ensures export parity, cycle safety, and keeps attached items inside stage bounds. |
| D-024 | Speech bubbles and story captions model as first-class scene entities with SVG rendering parity. | Implemented | Provides comic speech, thought, shout, and captions with full export parity, grapheme limits, and attachment. |
| D-025 | Scene Book composite vector SVG previews for character outfits, props, and bubbles. | Implemented | Delivers full entity visual fidelity in thumbnails without raster latency or memory leaks. |
| D-026 | Multi-selection, compound batch movement, and visual alignment domain rules. | Implemented | Pure geometric alignment and multi-select drag with single undo/redo atomicity and accessible outline. |
| D-027 | Curated storytelling scene templates with fresh ID remapping. | Implemented | Inspires user storytelling with 5 themed starters that instantiate cleanly without ID collisions. |
| D-029 | Gate 4 evidence separates automated contracts from hosted-device proof. | Implemented | Desktop checks cannot substitute for an installed iPad offline run or cross-browser transfer evidence. |

## Decision details

### D-017 — Panoramic camera

Scenes support `1600 × 900`, `3200 × 900`, and `4800 × 900` logical canvas widths. Entity `(x, y)` is stored as an absolute logical coordinate in `[0, stageWidth] × [0, 900]`. `cameraX` is clamped within `[0, stageWidth - 1600]` and persisted with the scene record without creating duplicate undo entries. The camera navigation HUD features stepper buttons, range slider, and interactive minimap lens. Edge auto-panning smoothly translates `cameraX` when dragging entities near viewport boundaries. Downsizing re-clamps entities safely into bounds with a single undoable step. Export and Scene Book thumbnails tile backgrounds across wide stage canvases.

### D-018 — Custom item deletion

Removing custom artwork from creation trays keeps existing references as labeled placeholders. “Delete artwork and all uses” presents exact preset/scene/entity impact and commits once so it can be undone. Unexpected orphan IDs follow the same placeholder path.

### D-019 — Module extraction

Keep the store, domain rules, and catalog renderer. Reduce `app.js` to bootstrap/routes; move Designer, Play, Scene Book, project repository, export, and voice lifecycle to narrow modules/services. Centralize persisted vocabularies.

### D-020 — Revision-aware repository

The repository owns serialization, recovery, monotonic revision, base-revision comparison, and cross-tab outcomes. A stale tab cannot overwrite a newer revision without a current explicit decision.

### D-021 — Custom asset storage

IndexedDB stores vector/raster bytes and derived thumbnails behind byte/item limits. The project envelope stores stable metadata references. Project export/import defines bundling and missing-asset behavior before paint implementation begins.

### D-022 — No pre-release backward compatibility

Pre-release and MVP development does not maintain legacy schema migrations or backward compatibility for outdated or broken save data. Corrupt, obsolete, or non-conforming storage envelopes are safely quarantined or reset to clean defaults.

### D-023 — Entity attachment and scene pinning

Scene fixture pinning locks background elements against accidental pointer displacement. Entity attachment maintains a directed acyclic graph (DAG) where moving a parent entity propagates coordinate deltas to attached children. Absolute logical coordinates are persisted for every entity to guarantee zero-overhead PNG export and Scene Book thumbnail parity without tree-traversal rendering overhead. Parent movement is clamped to compound bounding boxes so children cannot be pushed out of bounds. Deleting a parent automatically detaches children in place.

### D-024 — Speech bubbles and story captions

Speech bubbles, thought clouds, shout bursts, and narrative captions are represented as first-class scene entities (`kind: 'bubble'`). They integrate directly with the entity attachment engine (`attachedTo` parent doll, `attachOffset: { dx, dy }`), adhere to strict 120-grapheme text limits and sanitization, and use dedicated procedural SVG generators (`createBubbleSvg`) to guarantee exact visual and geometric parity across DOM rendering, pointer interaction, and canvas PNG export.

### D-025 — High-fidelity Scene Book thumbnails

Scene Book cards render full composite vector SVGs (`viewBox="0 0 1600 900"`) comprising background scenery, multi-layered dolls (including custom colors, hair, accessories, skin tones, and facial expressions), positioned props, and styled speech bubbles. This vector-based approach eliminates rasterization latency, avoids Blob/data URL garbage-collection pressure, and ensures instant visual parity between stage and saved library cards.

### D-026 — Multi-selection and visual alignment math

Multi-selection state (`selectedEntityIds: []`) is managed in runtime UI state with single-command atomic mutations (`scene/moveEntities`, `scene/scaleEntities`, `scene/flipEntities`, `scene/alignEntities`, `scene/deleteEntities`, `scene/togglePinEntities`). Bounding box algebra (`getEntityVisualBox`) accounts for individual entity dimensions and anchor points to support 8 alignment/distribution modes (`left`, `center`, `right`, `top`, `middle`, `bottom`, `distribute-h`, `distribute-v`). Accessible fallback is provided via an interactive Scene Outline dialog and keyboard shortcut (`O`).

### D-027 — Scene templates and fresh ID instantiation

Curated storytelling templates are defined as immutable domain schemas (`SCENE_TEMPLATES`). When loaded onto the active stage via `instantiateSceneTemplate`, entity reference IDs are mapped to fresh, independent instance IDs while preserving internal DAG attachment relationships (`attachedTo` and `attachOffset`), applying the player's active character snapshot, and maintaining full single-step undo/redo capability.

### D-028 — Custom Art IndexedDB binary layer and unified registry

Binary custom PNG artwork is stored strictly in client-side IndexedDB (`paperDollStudio` database with 5 distinct stores: `artwork`, `drafts`, `staging`, `backups`, `trash`) while lightweight metadata descriptors live in the project envelope (`state.customAssets`). Unified asset resolution is managed via `createAssetRegistry`, allowing built-in SVG catalog items and custom PNG artwork descriptors to share identical layout contracts. Stage entities and designer overlays render custom PNG items via tracked Blob URLs with explicit lifecycle and revocation management (`customArtRepository.getTrackedObjectUrl`). Project exports bundle custom artwork using SHA-256 verified Base64 encoding with merge-collision rewriting.

### D-029 — Release evidence boundary

Automated tests and source validators prove deterministic contracts, but browser and device journeys remain separate evidence. Gate 4 can close only after the dated quality matrix records the hosted iPad Home Screen offline run, service-worker update check, and export/import across two browsers. A missing target host or device is an explicit release blocker, not a pass by inference.
