# Custom Paint Studio — Product Requirements and Delivery Plan

Status: Gate 3B complete (Gates 0–3B complete; Gate 4 hosted-device evidence remains)  
Updated: 2026-08-16  
Roadmap item: Gate E.8  
Gates 0–3B implementation is complete. Gate 4 remains the release-evidence and hosted-device gate; affected automated and local browser checks were rerun after Gate 3B.

## 1. Outcome

Custom Paint Studio lets a player make a small piece of original artwork, save it on the device, and use it as clothing or a prop without learning a professional drawing tool.

The minimum complete loop is:

1. Start from Designer, Play, or the Paint section.
2. Choose **Clothing** or **Prop**.
3. Draw with a small, understandable tool set.
4. Preview the result on a doll or in a scene.
5. Name and save it.
6. Use it immediately.
7. Refresh or play offline and see the same art.
8. Export the project, import it on another device, and retain the art and every reference to it.

This feature extends the existing private, offline-first browser game. It does not add accounts, cloud storage, uploads, remote processing, or a general-purpose illustration editor.

## 2. Product principles

- **Make art, then play.** The painter is a short path back to dressing a doll or arranging a story.
- **Useful defaults over setup.** Clothing starts from a fitted cutout; props start with a practical size and bottom-center anchor.
- **Touch first, keyboard reachable.** Primary controls have `44 × 44 CSS px` targets and core operations do not require drag alone.
- **No silent loss.** Saved art, a recoverable active draft, and project backups have explicit states and failure messages.
- **One source of truth per concern.** Small serializable metadata lives in `AppStore`; artwork bytes live in IndexedDB; object URLs and thumbnails are derived.
- **Missing art does not erase stories.** References survive as labeled placeholders until the player explicitly removes the uses.
- **Bounded scope.** The first release optimizes for playful clothing and prop drawings, not precision vector design.

## 3. Decision: raster painter, not an SVG painter

### Recommendation

Build the first Paint Studio with the browser Canvas 2D API. Save a flattened, transparent, lossless PNG as the canonical artwork. Do not build a general SVG painter or raster-to-vector converter in this phase.

The editor may keep an in-memory command history while open, but saved artwork is a flattened bitmap. Reopening an item edits a copy and creates a new asset ID; it does not promise editable vector objects or layers.

### Why raster fits the need

- Brush, eraser, flood fill, eyedropper, selection, and touch drawing are native raster operations.
- Clothing and props have bounded in-game render sizes. Infinite vector scaling is not required.
- Transparent PNG works offline, preserves hard paper-cutout edges, and can be drawn directly into stage and export canvases.
- The existing project already rasterizes SVG into PNG for scene export. A trusted custom bitmap is a natural additional layer.
- The player sees one consistent image on the paint canvas, doll, scene, Scene Book card, reload, and PNG export.
- The implementation remains dependency-free.

### Why not SVG in the MVP

A usable SVG painter would need a persisted object model, path smoothing, hit testing, transforms, z-order, path or mask-based erasing, flood-fill semantics, per-object selection, safe SVG serialization, reference-ID scoping, and a larger import security boundary. Those costs do not help the core need: draw a fun clothing pattern or prop and use it in the game.

Freehand SVG also tends to generate many path points. Erasing usually introduces masks or destructive Boolean geometry, while the current bundled SVG contract intentionally excludes several complex features and still has clone-ID scoping work before definitions and patterns are admitted.

### Quality mitigation for raster art

- Clothing uses a `300 × 450` logical canvas with a `600 × 900` backing bitmap (`2×`).
- Props use a `500 × 500` logical authoring canvas with a `1000 × 1000` backing bitmap (`2×`).
- PNG encoding is lossless and keeps transparency.
- Prop save trims transparent outer pixels for display-bound calculations while retaining the canonical square bitmap and logical mapping.
- The editor shows pixel quality at `100%` and the maximum supported in-game scale before saving.

### Revisit SVG only if needs change

Open a separate vector-editor proposal if at least one of these becomes a real requirement:

- edit individual shapes after reopening;
- print-quality output or zoom above the current `2×` scene scale;
- reusable paths, text-on-path, gradients, or pattern definitions;
- cross-item object copying and layer management;
- exporting custom art as standalone SVG.

A later shape-only vector mode can coexist with raster assets through the same metadata and asset-repository interface. It must not delay this release.

## 4. Players and jobs

### Primary players

- A child drawing a shirt pattern or a story prop on an iPad.
- A parent or facilitator helping create themed clothing and scene objects.
- A casual desktop player using mouse or keyboard.

### Jobs to be done

- “I want this doll to wear something I imagined.”
- “I need a prop that is not in the tray.”
- “I want my art to still be there tomorrow and when the device is offline.”
- “I want to move the whole project to another browser or iPad.”
- “If an artwork is missing, do not silently delete my dolls or scenes.”

## 5. MVP scope

### Included

- A dedicated `#paint` route and Paint navigation section.
- Entry points from the active Designer wardrobe slot and the Play prop tray.
- Custom wearables for `top`, `bottom`, `dress`, `shoes`, and `accessory`.
- Custom props with display size and ground-anchor metadata.
- Starting clothing cutouts derived from approved built-in wearables.
- Brush, eraser, fill, line, rectangle, ellipse, eyedropper, rectangular selection, and mirror drawing.
- Color palette, sanitized hex color, brush size, Undo/Redo, Clear, zoom, and preview.
- Dedicated paint history, separate from global Designer/Play history.
- My Art library: use, rename, edit as copy, remove, restore, and inspect storage.
- IndexedDB artwork, active-draft, import-staging, backup, and trash storage.
- Local metadata references in the versioned project envelope.
- Stage, doll, Scene Book, reload, offline, and PNG-export parity.
- Asset-aware project export/import, Merge/Replace, backups, collision rewriting, and missing-asset reporting.
- Labeled placeholders and explicit, impact-counted cleanup.

### Deferred

- Custom hair. Hair requires coordinated back/front layers and a different template model.
- Custom base dolls or backgrounds.
- Multiple paint layers after save.
- Vector object editing or SVG export.
- Raster-to-vector tracing.
- Text, imported photos, arbitrary file uploads, camera capture, stickers, gradients, filters, blur, and blend modes.
- Animation, sound, collaboration, cloud sync, or sharing links.
- Automatic physical deletion of artwork that is still referenced.

## 6. Experience design

### Entry points

1. **Designer:** A `Paint an item` action appears after the built-in cards for the selected supported slot. It opens Paint with that slot and a sensible cutout selected.
2. **Play:** A `Paint a prop` action appears in the Props tray. It opens a blank prop canvas.
3. **Header:** `Designer | Paint | Play` supports starting from the My Art library without a prior context.

Hair shows no paint action in the MVP and explains “Custom hair is planned later” if the user looks for it in Paint.

### New-art flow

#### Clothing

1. Choose a slot: Top, Bottom, Dress, Shoes, or Accessory.
2. Choose a starting cutout from approved assets in that slot.
3. Paint on the editable cutout while a non-editable doll guide remains visible underneath.
4. Toggle Mirror to repeat left/right brush and shape input around the `x = 150` doll axis.
5. Preview on Classic, Joy, or Chibi. The saved coordinates remain the shared `300 × 450` contract.
6. Enter a name and choose `Save & wear` when opened from Designer, or `Save to My Art` when opened directly.

The starting cutout becomes editable raster pixels only after the player chooses the pixel action described below. The doll guide, reference cutout, and alignment marks are never saved into the artwork.

#### Starting cutouts and reference overlays

Starting cutouts and reference overlays are separate concepts:

- A **reference cutout** is a non-saving guide rendered in the overlay layer. Selecting one does not change artwork pixels, dirty state, or paint history.
- **Add cutout pixels** rasterizes the selected trusted catalog wearable into the artwork using source-over composition and creates one paint-history entry.
- On an empty canvas, `Start with cutout` may add the pixels immediately after the asset is ready. On a non-empty canvas, the safe default is `Keep painting`; the player must explicitly choose `Add cutout pixels` or `Replace artwork with cutout`.
- `Replace artwork with cutout` is destructive only to the current draft, requires confirmation when pixels exist, and remains one undoable paint-history entry.
- Cutout actions accept only a built-in, cataloged wearable whose slot matches the current wearable slot. Custom assets, props, missing assets, stale async results, and mismatched-slot assets are rejected without changing the canvas.
- Cutout loading exposes loading, ready, empty, and recoverable-error states. Rapid card or slot changes use a request token so an older load cannot stamp into the current document. Every temporary object URL is revoked on success, failure, cancellation, route teardown, and visibility loss.

Changing among `top`, `bottom`, `dress`, `shoes`, and `accessory` changes document metadata, cutout choices, reference geometry, and preview context without clearing or resizing the wearable canvas. The existing bitmap and paint Undo/Redo stacks remain byte-for-byte intact. A slot change:

- first cancels an active pointer preview and transient selection transform using the same route-change policy;
- marks document metadata dirty and schedules a draft checkpoint, but does not create a raster-history entry;
- keeps a player-entered name, while an untouched generated name such as `My top` follows the new slot;
- updates the save target so the existing pixels are saved only to the newly selected slot;
- announces the change and retained-art status through the polite live region.

Switching between wearable and prop remains a document-type change because the logical and backing dimensions differ. It must use the existing dirty-document confirmation and must not silently reinterpret or crop pixels.

The wearable authoring overlay provides:

- `Body reference` visibility, default on;
- reference opacity from `20%` to `80%`, default `50%`, with keyboard-operable range control and visible value;
- reference model choices `doll_classic_a` (Classic), `doll_classic_b` (Joy), and `doll_chibi_a` (Chibi);
- `Alignment guides` visibility, default on;
- a selected cutout reference that can be shown without adding pixels.

Slot guides use the shared `300 × 450` coordinate system:

| Slot | Required non-saving guides |
|:--|:--|
| Top | shoulder seam, neckline anchor, bust line, and waistline |
| Dress | shoulder seam, neckline anchor, bust line, waistline, and lower-hem range |
| Bottom | waistline, hip line, knee line, and lower-hem range |
| Shoes | left/right foot contours, ankle anchors, and ground baseline |
| Accessory | head contour, center crown line, ear markers, neckline anchor, and center axis |

Hair guides are included for the shipped single-layer custom-hair slot. Model-specific guide coordinates are declared data, not inferred from rendered DOM bounds. The selected reference model may update the live mannequin preview and records the custom asset's fit family, but it never changes the saved `300 × 450` coordinate contract.

All guide content lives under `#paint-guide-layer`, has `pointer-events: none`, and is absent from the artwork canvas, save thumbnail source, draft Blob, canonical PNG, Scene Book render, scene render, project package, and PNG export. Guide controls and preferences may be included in recoverable draft metadata so a crash restores the authoring view, but they do not enter saved custom-asset metadata. Guide toggles must not change artwork digest, dirty state, or paint history.

At `1×`, `2×`, fit zoom, browser `200%` zoom, reduced motion, and forced colors, body contours and guide lines remain distinguishable from artwork and the transparency grid. The overlay scales from the same logical origin as the canvas and cannot drift during responsive layout changes.

#### Prop

1. Start on a transparent square canvas with a faint, non-saving ground line.
2. Draw the prop.
3. Choose `Small`, `Medium`, or `Large`; the UI stores explicit logical display dimensions.
4. Choose `Sits on a surface` (bottom-center anchor) or `Hangs/floats` (center anchor). Surface is the default.
5. Preview at `0.5×`, `1×`, and `2×` on a sample stage.
6. Enter a name and choose `Save & add` when opened from Play, or `Save to My Art` when opened directly.

The three player-facing size choices map to a maximum displayed side of `140`, `240`, or `360` logical scene units. The stored width and height preserve the non-transparent pixel aspect ratio.

### Paint workspace

Desktop uses a two-column layout: canvas and live preview on the left, compact tools and properties on the right. Tablet portrait uses one column: canvas first, a sticky compact tool row, then expanded properties. The page must not require horizontal scrolling at `768 × 1024`.

Always-visible actions:

- Back
- New
- My Art
- Undo
- Redo
- Preview
- Save

Primary tool row:

- Brush
- Eraser
- Fill
- Shapes
- Select
- Eyedropper

Secondary properties change with the selected tool. Advanced choices stay collapsed by default.

### Tool behavior

| Tool | MVP behavior |
|:--|:--|
| Brush | Round brush; sizes `4`, `10`, `20`, `40` logical px; continuous pointer stroke. |
| Eraser | Same sizes; clears alpha instead of painting a background color. |
| Fill | Flood-fills one contiguous region using a small, bounded per-channel RGBA tolerance. |
| Shapes | Line, rectangle, or ellipse; outline or filled; current color and brush size. |
| Eyedropper | Samples an artwork pixel. Transparent pixels do not replace the active color. |
| Select | Rectangular select, move, duplicate, flip horizontally, or delete. No rotation or free transform. |
| Mirror | Repeats Brush, Eraser, Line, Rectangle, and Ellipse input across the vertical center. |

Selection is transient editor state. Saving commits the visible composite only.

### History and dirty state

- Paint Undo/Redo is independent from global Studio Undo/Redo.
- One completed stroke, fill, shape, selection move, clear, or paste is one paint-history entry.
- History is bounded by both `20` entries and an approximate `32 MB` memory budget; the older bound wins.
- A pointer preview is not a history entry until pointer release.
- Leaving with unsaved changes opens a safe-default dialog: `Keep painting`, `Save`, or `Discard draft`.
- A debounced active-draft checkpoint is written to IndexedDB after committed paint operations. On reload or crash recovery, the app offers `Continue draft` or `Discard`.
- Draft history is not persisted; recovery restores the latest pixels and metadata only.

### Keyboard and assistive path

- All tool, property, preview, save, library, and dialog controls are semantic native controls.
- The paint canvas is focusable and named with current tool, item type, zoom, and dirty state.
- Arrow keys move a virtual canvas cursor by `10` logical px; Shift + arrow moves by `1`.
- Space applies Brush, Eraser, Fill, or Eyedropper at the virtual cursor.
- For Shapes, Enter places a centered default shape; arrow keys move it and Shift + arrow resizes it before commit.
- For Select, Enter creates a centered selection; arrow keys move it; Delete clears it; Escape cancels it.
- `B`, `E`, `G`, `I`, `S`, `M`, and `Z` select Brush, Eraser, Fill, Eyedropper, Select, Mirror, and zoom only when focus is within the Paint workspace and not in a text field.
- Every visual status also reaches the polite live region. Errors use the existing recoverable alert pattern.
- The mannequin guide, transparency grid, cursor, and selection outline remain discernible in forced colors and at `200%` zoom.

## 7. Data contracts

### Small project metadata

Add bounded `customAssets` metadata to the small versioned project envelope. It contains no Blob, base64, data URL, object URL, canvas, or thumbnail.

```json
{
  "assetId": "custom_01abc...",
  "name": "Starry shirt",
  "kind": "wearable",
  "slot": "top",
  "format": "image/png",
  "logicalWidth": 300,
  "logicalHeight": 450,
  "pixelWidth": 600,
  "pixelHeight": 900,
  "byteLength": 184220,
  "sha256": "base64url-digest",
  "createdAt": "2026-08-16T12:00:00.000Z",
  "updatedAt": "2026-08-16T12:00:00.000Z",
  "libraryVisible": true,
  "status": "available"
}
```

Prop metadata additionally contains:

```json
{
  "displayWidth": 240,
  "displayHeight": 190,
  "groundAnchor": { "x": 0.5, "y": 1 }
}
```

Rules:

- IDs use the reserved `custom_` prefix plus an accepted project ID.
- Names use at most `30` Unicode grapheme clusters.
- `kind` is `wearable` or `prop`; wearable slots are limited to the five MVP slots.
- PNG dimensions and bytes must match metadata after decode.
- `sha256` is an integrity check, not an authentication claim.
- `status` is `available`, `missing`, or `trashed`.
- Existing outfit records keep `{ assetId, color }`; `color` is ignored for flattened custom artwork but retained for schema consistency.
- Existing scene prop entities keep the custom `assetId` in `sourceId`.
- Character scene snapshots keep custom wearable IDs inside their slot records.

### IndexedDB records

Database: `paperDollStudio`  
Initial database version: `1`

| Object store | Key | Role |
|:--|:--|:--|
| `artwork` | `assetId` | Canonical saved PNG Blob, byte length, and digest. |
| `drafts` | fixed `active` key | One recoverable active draft Blob and draft metadata. |
| `staging` | `operationId/assetId` | Validated import bytes written before envelope commit. |
| `backups` | `backupId` | Latest recoverable Replace snapshot, including referenced artwork bytes. |
| `trash` | `assetId` | Removed bytes with removal time and recovery metadata. |

Do not persist derived thumbnails. Cache decoded images and object URLs only in memory, deduplicate concurrent loads, and revoke every URL on eviction, rerender, route teardown, error, and page hide.

### Provisional limits

| Value | Limit |
|:--|--:|
| Saved custom assets | 30 |
| One encoded PNG | 2 MB |
| Total saved custom-art bytes | 30 MB |
| Active draft PNG | 2 MB |
| Portable project package | 45 MB encoded JSON |
| Paint history | 20 entries and about 32 MB |
| Import staging lifetime | Current operation only; stale records pruned at next startup |
| Trash retention | 7 days or explicit Empty Trash |
| Replace backups | Latest one only |

These are acceptance targets, not guesses to bury in code. Before implementation locks them, run the browser storage spike in Gate 0 on target iPad Safari and current Chrome, Safari, Firefox, and Edge. Lower limits if measured decode, import, or memory behavior misses the budgets in section 13.

## 8. Storage and consistency model

### Repository boundary

Add a `custom-art-repository` service as the only owner of IndexedDB database creation, upgrades, transactions, Blob validation, staging, trash, draft checkpoints, and object-URL lifecycle.

Domain code receives synchronous custom metadata through an asset registry built from static catalog entries plus `state.customAssets`. Rendering receives an asynchronous byte loader. Pure outfit and scene rules must never query IndexedDB.

### Save ordering

Creating a custom asset spans IndexedDB and localStorage, which cannot share one atomic transaction. Use this safe order:

1. Validate name, metadata, pixel dimensions, Blob type, byte size, decoded image, and digest.
2. Write the canonical Blob to IndexedDB.
3. Revision-check and commit metadata to the small project envelope.
4. If the envelope commit fails, keep the prior envelope authoritative and mark the new Blob as an orphan candidate.
5. Prune only unreferenced orphan candidates after a later successful scan; never guess during the failing operation.

This order can leave harmless unreferenced bytes but cannot commit a new reference before its bytes exist.

### Cross-tab behavior

- Asset metadata changes use the existing project revision guard.
- A stale tab cannot publish new metadata or overwrite a newer envelope without the existing explicit Keep/Reload decision.
- Saved artwork bytes are immutable by asset ID. Editing creates a new asset, so two tabs never overwrite the same Blob.
- Orphan scanning compares IndexedDB keys against current metadata, backup, trash, staging, and draft records before pruning.

### Storage failure

- Quota, denial, transaction abort, decode, or write failure leaves the existing project and artwork unchanged.
- The player remains in Paint with the draft intact in memory and sees an explicit `Not saved` state plus Retry and Project export guidance.
- Do not fall back to placing base64 artwork in localStorage.
- `navigator.storage.persist()` may be offered only after a user action and only as a best-effort durability hint. The UI must not promise that a browser or operating system will never evict origin data.

## 9. Project portability prerequisite

The current project JSON carries only the small envelope. Custom Paint cannot ship until portability handles metadata and bytes together.

### Portable package

Keep one dependency-free JSON download. Introduce an outer package format separate from the state schema:

```json
{
  "format": "paper-doll-project",
  "formatVersion": 1,
  "exportedAt": "2026-08-16T12:00:00.000Z",
  "state": { "schemaVersion": 4 },
  "customArtwork": [
    {
      "metadata": { "assetId": "custom_01abc...", "format": "image/png" },
      "encoding": "base64",
      "data": "iVBORw0KGgo..."
    }
  ]
}
```

This is the first outer package format, so its `formatVersion` starts at `1`; the nested state schema version remains independent. Export switches to the package format once custom-art support exists, including when a project has zero custom assets. This PRD does not override D-022: importing the current bare-envelope JSON is out of scope unless an accepted decision replaces the no-pre-release-backward-compatibility policy before implementation.

### Export rules

- Snapshot one validated state revision and resolve the exact referenced custom assets plus visible unused My Art items.
- Recompute byte length and SHA-256 while packaging.
- If any expected asset is missing or corrupt, stop before download and show exact item names. Offer `Cancel` or `Export with placeholders`; never silently omit bytes.
- Package creation reports progress and supports cancellation.
- Revoke the download URL in every outcome.
- The package contains player-created art, so the Project dialog explicitly says the file may contain their drawings.

### Import pipeline

Import remains validate-before-mutate:

1. Read with an encoded-size bound.
2. Parse the outer package.
3. Validate package and state versions.
4. Decode every asset with cumulative byte limits.
5. Validate metadata, PNG signature, decoded dimensions, alpha-safe canvas decode, byte length, and SHA-256.
6. Sanitize the small envelope and enumerate all custom references.
7. Report missing, unreferenced, duplicate, or corrupt art.
8. Build the full collision-rewrite plan.
9. Show a preview with doll, scene, custom-art, byte, warning, and replacement-impact counts.
10. Confirm Merge or Replace.
11. Stage bytes in IndexedDB.
12. Commit the envelope only after staging succeeds and the base revision still matches.
13. Finalize staged records; clean staging on success and preserve recoverable diagnostics on failure.

### Merge rewriting

If any incoming custom asset ID collides, always allocate a fresh custom ID unless both digest and sanitized metadata are identical. Rewrite all of these locations as one plan:

- incoming custom-asset metadata;
- incoming preset slots;
- Designer draft if it becomes part of a future portable schema;
- character snapshots in saved scenes and the current scene;
- custom prop `sourceId` in saved scenes and the current scene;
- attachment relationships remain instance-ID based and do not change.

Deduplicating identical bytes is allowed only when the metadata contract is compatible. It is an optimization, not an MVP requirement.

### Replace and backup

- Before Replace, store the prior small envelope and all custom artwork needed by that envelope in the IndexedDB `backups` store.
- A backup is complete only after its bytes and manifest validate.
- If backup creation fails, Replace does not begin.
- Write incoming artwork first, commit the new envelope second, and retain old bytes through backup finalization.
- Restore validates the backup before changing current data and itself creates a recoverable backup of the replaced project when space permits.
- Keep only the latest complete backup; never keep a partial record as available.

## 10. Rendering integration

### Unified asset registry

Introduce a registry interface that resolves either:

- immutable bundled catalog metadata plus safe same-origin SVG; or
- validated custom metadata plus a trusted IndexedDB PNG Blob.

Pure domain callers use metadata only. Browser renderers request the appropriate visual source asynchronously.

### Designer and Dollbox

- Custom wearable cards appear in a `My Art` subsection for their slot.
- A custom wearable uses its flattened pixels; palette recoloring is disabled and explained.
- Doll rendering preserves the current semantic layer order.
- Missing custom bytes render a labeled layer placeholder without removing the slot record.
- Dollbox save/open/update/rename/delete behavior remains unchanged because it stores stable asset IDs.

### Play and scene bounds

- Custom props appear in the Props tray under `My Art`.
- The metadata `displayWidth`, `displayHeight`, and `groundAnchor` feed existing bounds, clamping, scale, flip, alignment, attachment, pinning, duplication, and multi-select rules.
- Missing bytes retain a selectable, movable, reorderable, and deletable placeholder with the same bounds.

### Scene Book

The current Scene Book renderer is vector-first. Extend it to support mixed sources without persisting thumbnails:

- bundled assets and bubbles remain vector;
- custom PNGs render as transient object-URL-backed `<image>` nodes or through an equivalent mixed canvas path;
- object URLs are scoped to the thumbnail render token and revoked after replacement/teardown;
- a missing PNG renders the existing labeled placeholder geometry;
- no base64 thumbnail or serialized composite is stored.

Before choosing `<image>` inside the composite SVG, prove Safari, Firefox, Chromium, and export behavior with one custom wearable and one custom prop fixture. If object-URL SVG images are unreliable, use a canvas thumbnail path for scenes containing custom artwork while retaining the vector path for all-built-in scenes.

### PNG export

Refactor character export into an ordered mixed-layer compositor:

- bundled doll and wearable SVG layers continue through the existing SVG rasterization path;
- custom wearable PNGs draw at their `300 × 450` logical mapping in semantic order;
- custom prop PNGs draw from stored display bounds and ground anchor;
- flip, scale, position, expression, panoramic width, attachment, and order remain identical to stage rendering;
- missing art follows one explicit placeholder policy selected before export;
- an in-flight export snapshots metadata and retains decoded image handles so later library changes cannot alter the result.

## 11. My Art, deletion, and recovery

### Library card actions

- Use / Wear
- Rename
- Edit a copy
- Remove from My Art
- View uses

Saved artwork bytes are immutable. `Edit a copy` loads the source pixels into a new draft; saving creates a new asset ID and leaves every old use unchanged.

### Usage counting

Impact counts include:

- current Designer draft;
- every Dollbox preset;
- every character snapshot in the current scene and Scene Book;
- every custom prop entity in the current scene and Scene Book.

Count affected records and individual uses separately so the dialog can say, for example, “Used 5 times across 2 dolls and 3 scenes.”

### Remove policy

`Remove from My Art` is the normal action:

1. Hide the library card.
2. Move bytes to recoverable trash.
3. Keep metadata references and replace every rendered use with a labeled placeholder.
4. Make Restore available for 7 days.

The player can instead choose `Delete artwork and all uses` only from the impact dialog. It removes affected slots/entities in one domain command and moves bytes to trash. Undo in the current session restores the references; Restore from Trash covers reloads while retained.

`Empty Trash` permanently deletes exact listed items and requires a separate confirmation. It is not part of ordinary cleanup and is not automatic when references still exist.

Unexpected missing IndexedDB records follow the same placeholder path but are labeled `Missing` rather than `Removed`.

## 12. Security and privacy

- Paint never sends pixels off-device.
- The MVP accepts only pixels generated by its own canvas or decoded from a validated project package.
- No arbitrary image or SVG upload is exposed.
- Imported artwork is treated as untrusted bytes until signature, MIME, dimensions, size, digest, and successful browser decode all pass.
- Imported SVG custom art is rejected in this phase even if its metadata claims to be safe.
- Canvas export must remain origin-clean; no remote URL enters a paint or render canvas.
- Object URLs are never persisted or logged and are always revoked.
- Error codes and logs contain asset IDs, sizes, and stable categories, not pixel bytes, names, or drawing content.
- Project-file warnings explain that exported files contain local player-created drawings.
- The service worker caches application code and bundled artwork only. It does not duplicate IndexedDB art in Cache Storage.

## 13. Performance and reliability budgets

| Operation | Budget / required result |
|:--|:--|
| Brush preview | 60 FPS goal; no sustained main-thread task over `50 ms`. |
| Pointer sampling | At most one visible canvas update per animation frame; use coalesced events when available. |
| Open saved art | Visible preview under `500 ms` for a typical item after warm startup. |
| Save typical art | PNG encode, digest, Blob write, and metadata commit under `1 s`. |
| Save maximum art | Under `3 s` with progress state and no UI freeze. |
| Draft checkpoint | Debounced; never during active pointer movement. |
| My Art tray | 30 items without persistent thumbnail bytes or unreleased URLs. |
| Scene drag | Existing `60 FPS` goal with mixed built-in/custom entities. |
| Scene export | Deterministic result; cancellation and failure leave scene and files unchanged. |
| Import maximum package | Bounded memory, visible progress, cancellable before commit. |
| Offline reload | All saved art and the latest draft resolve without network access. |

Use dirty-rectangle history patches where practical. A full-canvas operation such as Fill may keep a full before/after patch but must still respect the combined history memory cap.

## 14. Analytics-free success checks

No telemetry is added. Success is evaluated through scripted and manual release evidence:

- A first-time tablet player can create and use a shirt with no documentation.
- A player can create and place a prop in under three minutes.
- Saved art survives refresh, route changes, offline restart, and app-shell update.
- A project exported on desktop imports on iPad with identical custom art and references.
- Removing art never silently removes a doll or scene use.
- Missing/corrupt/quota cases preserve the last known-good project.
- Stage, Scene Book, and PNG export are visually equivalent for custom clothing and props.

## 15. Delivery gates

Each gate is a coherent batch followed by its verification suite. Do not start the painter UI before Gate 0 is complete.

### Gate 0 — Prerequisites and risk spikes

Batch:

- Prove IndexedDB Blob create/read/delete, transaction abort, version upgrade, quota error, private-mode/denied behavior, and stale staging cleanup.
- Prove `600 × 900` and `1000 × 1000` PNG encode/decode quality and timings.
- Prove mixed custom raster rendering on doll, prop, Scene Book thumbnail, and PNG export in target browsers.
- Finalize limits from real iPad and desktop measurements.
- Extend project portability package validation, collision planning, staging, Replace backup, and rollback before any Paint entry point is enabled.

Verify together:

- repository unit tests with an injected IndexedDB double;
- real-browser IndexedDB smoke suite;
- package round-trip and tamper fixtures;
- Merge collision tests covering presets, all character snapshots, and prop entities;
- Replace failure injection at each ordering step;
- Chrome, Safari, Firefox, Edge, and target iPad evidence.

Exit criteria:

- A hand-authored custom wearable and prop fixture can round-trip through storage, export/import, all game renderers, missing-asset fallback, and recovery with no Paint UI.

### Gate 1 — Custom asset domain and game integration

Batch:

- Add bounded custom metadata schema and migration.
- Add unified asset registry and immutable Blob loading.
- Integrate Designer, Dollbox, Play tray, scene bounds, Scene Book, and PNG export.
- Add My Art use/rename and placeholder behavior.

Verify together:

- schema sanitization and limits;
- outfit conflicts and saved-character snapshots;
- prop clamp/flip/scale/order/attach/pin/multi-select;
- async render cancellation and URL revocation;
- stage/thumbnail/export pixel-parity fixtures.

Exit criteria:

- Fixture custom assets behave like first-class game items before players can create them.

### Gate 2 — Painter core

Batch:

- Add the Paint route, responsive shell, item-type start flow, canvas coordinate model, palette, Brush, Eraser, Fill, Shapes, Eyedropper, Select, Mirror, zoom, preview, and bounded history.
- Add save/name validation, active-draft checkpoint, crash recovery, and origin-aware `Save & wear` / `Save & add` behavior.

Verify together:

- pure raster-operation tests on small deterministic pixel fixtures;
- pointer threshold/capture/cancellation and coordinate tests;
- history atomicity and memory-bound tests;
- keyboard canvas-cursor tests;
- touch target, focus, live-region, forced-color, reduced-motion, and `200%` zoom checks;
- desktop and `768 × 1024` no-horizontal-scroll browser journeys.

Exit criteria:

- A player can create, recover, save, and use clothing and props through pointer, touch, and the documented keyboard path.

### Gate 3 — Library lifecycle and destructive actions

Batch:

- Add Edit a copy, impact counting, Remove, placeholders, trash restore, Delete all uses, and Empty Trash.
- Add orphan scanning that accounts for active state, staging, backups, drafts, and trash.

Verify together:

- exact usage counts across every reference location;
- one-command removal/undo behavior;
- reload-time trash restore;
- missing-record behavior;
- purge safety and quota-recovery fixtures.

Exit criteria:

- No normal library action can silently destroy a referenced story or make Undo promise bytes that no longer exist.

### Gate 3B — Precision references, non-destructive slot switching, and starting cutouts

Gate 3B is a required corrective gate between the implemented library lifecycle and release QA. It does not add split hair layers, arbitrary imports, free transform, or a second editable document. Single-layer custom hair is covered by Gate 4.

Implementation evidence: complete for the library lifecycle and single-layer custom hair. The automated suite covers slot/history retention, trusted cutout discovery and Add/Undo, six reference models, non-saving guide controls, exact canvas/overlay alignment, stale-load cancellation, draft recovery, and guide-data bounds. Hosted iPad and cross-browser evidence remain release QA work.

#### Batch A — Document metadata without pixel loss

- Add a validated `session.setSlot(slot)` mutation for the five supported wearable slots.
- Route slot changes through the existing session instead of `resetCanvas`; retain canvas dimensions, pixel bytes, paint history, tool settings, color, mirror state, zoom, and virtual cursor.
- Cancel active pointer previews and transient selection transforms before applying the slot change.
- Treat slot changes as dirty document metadata: checkpoint the new slot with existing pixels, preserve custom names, update only untouched generated names, and announce retained artwork.
- Keep wearable ↔ prop switching behind the dirty-document confirmation because their canvas contracts differ.

Verify Batch A together:

- session unit tests for valid/invalid slot mutation, metadata dirty state, generated-name behavior, and unchanged Undo/Redo stacks;
- deterministic canvas fixture proving identical pre/post-switch pixels and digest;
- draft checkpoint/recovery test proving the new slot restores with the old pixels;
- active stroke, active selection, rapid slot changes, keyboard focus, and live-region browser tests;
- save-after-switch tests proving metadata and Designer conflict rules use the final slot exactly once.

#### Batch B — Trusted cutout discovery and explicit pixel actions

- Resolve cutouts through the unified asset registry and include only available built-in wearables matching the active slot.
- Render accessible thumbnail cards with loading, ready, empty, selected, disabled, and recoverable-error states.
- Separate non-saving reference selection from `Add cutout pixels` and `Replace artwork with cutout`.
- Make each successful pixel action one atomic history entry and enforce the existing 20-step / 32 MB history limits.
- Add request-token cancellation, slot revalidation after async load, object-URL cleanup, and a single-action lock against rapid activation.
- Preserve current artwork and history on load, decode, catalog, cancellation, or draw failure.

Verify Batch B together:

- asset-registry tests for every supported slot, ordering, limits, missing assets, and mismatched kinds/slots;
- deterministic SVG-to-canvas fixtures for transparent edges, exact `600 × 900` alignment, source-over add, replace, Undo, and Redo;
- DOM tests for semantic cards, status states, explicit confirmation on non-empty artwork, and keyboard activation;
- race tests for rapid card selection, slot change during load, route/visibility teardown, stale completion, and URL revocation;
- digest tests proving reference-only selection never changes pixels, history, or dirty state.

#### Batch C — Precision body and slot-guide overlay

- Add body visibility, `20%`–`80%` opacity with `50%` default, reference-model selection, alignment-guide visibility, and reference-cutout visibility controls.
- Define model- and slot-specific anchor data in the shared logical coordinate system; do not infer it from layout boxes.
- Render the doll, selected cutout reference, anchors, labels, and lines only inside `#paint-guide-layer` with pointer input disabled.
- Keep guide preferences in transient session state and optional recoverable draft metadata, never custom-asset metadata or artwork bytes.
- Keep canvas, overlay, cursor, selection, and preview aligned through zoom, resize, responsive layout, and model changes.

Verify Batch C together:

- data-contract tests covering every supported slot × reference model combination and in-bounds coordinates;
- DOM isolation tests proving guide nodes are descendants only of `#paint-guide-layer` and cannot intercept input;
- before/after PNG byte and SHA-256 fixtures for every guide toggle, opacity, model, and reference-cutout change;
- accessibility checks for names, values, focus order, 44px actions, range-key behavior, live announcements, forced colors, reduced motion, and `200%` browser zoom;
- desktop and `768 × 1024` browser screenshots proving no overlay drift or horizontal scrolling.

#### Gate 3B exit criteria

- Switching wearable slots never clears, resizes, recolors, or mutates artwork pixels and never resets raster Undo/Redo.
- A stale or failed cutout request cannot modify the current canvas; successful add/replace actions are explicit and undoable.
- Reference body, selected cutout, and alignment guides are useful across all six supported wearable slots and six base models.
- Toggling or changing any guide produces an identical canonical PNG digest and leaves dirty/history state unchanged.
- Draft recovery restores artwork pixels, final slot, and authoring-reference preferences without adding reference pixels.
- Pointer, touch, and keyboard paths pass at desktop and tablet portrait sizes.

### Gate 4 — Release evidence and offline device QA

Gate 4 starts only after Gate 3B exits. Existing Gate 4 browser, accessibility, performance, offline, and transfer evidence affected by Paint UI or draft metadata must be rerun rather than carried forward by assumption.

Batch:

- Complete browser, accessibility, performance, storage-pressure, project-transfer, service-worker-update, and hosted iPad offline journeys.
- Update Turkish guide, Project dialog, Offline PWA guide, asset strategy, quality matrix, decisions, and roadmap status.

Verify together:

- full `npm run check`;
- manual user journeys and failure matrix below;
- actual iPad Home Screen offline run after one online load;
- export on one browser and import on another.

Exit criteria:

- All required journeys pass with dated evidence in [QUALITY.md](QUALITY.md), and no prerequisite remains described only as future work.

## 16. Required test journeys

| ID | Journey | Required outcome |
|:--|:--|:--|
| CP-01 | Designer → Paint top → Save & wear | New art is equipped, saveable in Dollbox, and still present after reload. |
| CP-02 | Paint dress while top/bottom equipped | Existing dress conflict rules clear top and bottom once. |
| CP-03 | Play → Paint prop → Save & add | Prop spawns with correct bounds, anchor, and order. |
| CP-04 | Brush/erase/fill/shape/select/mirror → Undo/Redo | Each committed operation is one reversible paint-history step. |
| CP-05 | Leave dirty Paint route | Safe-default dialog and draft recovery prevent silent loss. |
| CP-06 | Save at quota boundary | Existing project remains saved; draft stays usable; error is explicit. |
| CP-07 | Use custom art in Dollbox/current scene/Scene Book | Every reference survives refresh and offline restart. |
| CP-08 | Scene transform and panoramic export | Custom prop and clothing match stage at all scales, flips, and stage widths. |
| CP-09 | Export project → import Replace on another browser | Metadata, bytes, references, and rendered pixels match. |
| CP-10 | Merge a package with colliding custom IDs | All custom references rewrite to the correct incoming art. |
| CP-11 | Import corrupt or over-limit art | Import changes neither small state nor IndexedDB canonical records. |
| CP-12 | Remove referenced artwork | Uses become labeled placeholders; no preset or scene is silently removed. |
| CP-13 | Restore removed artwork | All placeholder uses render the original pixels again. |
| CP-14 | Delete artwork and all uses → Undo | References and bytes return together. |
| CP-15 | Keyboard-only create simple shape art | Player can choose type, place/nudge a shape, name, save, and use it. |
| CP-16 | Target iPad offline | Paint, save, reload, use, and export a project without network access. |
| CP-17 | Draw → switch wearable slot → Undo/Redo → save | Pixels and raster history survive the slot change; save uses the final slot and its conflict rules. |
| CP-18 | Select cutout reference without adding pixels | Guide appears, but artwork digest, dirty state, and history do not change. |
| CP-19 | Add then replace a cutout on non-empty artwork | Both actions require an explicit choice, commit once, and Undo restores the exact prior pixels. |
| CP-20 | Change body model, guide visibility, and opacity | Overlay stays aligned at all supported zooms and no guide pixel enters draft, saved PNG, scene, or export. |
| CP-21 | Keyboard-only reference and cutout flow | Player can select model/cutout, adjust opacity, toggle guides, confirm a pixel action, undo it, and continue painting. |

## 17. Failure matrix additions

| ID | Injection | Required outcome |
|:--|:--|:--|
| CPF-01 | IndexedDB unavailable at startup | Existing built-in game remains usable; Paint explains local-art storage is unavailable. |
| CPF-02 | Blob write aborts | No metadata reference commits; current draft remains in memory. |
| CPF-03 | Metadata save hits revision conflict | New Blob is not published; conflict UI appears; later orphan scan is safe. |
| CPF-04 | IndexedDB record missing for valid metadata | Labeled placeholder retains name, type, bounds, and removability. |
| CPF-05 | PNG decode or digest fails | Asset is quarantined/missing; no broken image or uncaught rejection. |
| CPF-06 | Import staging fails halfway | Current project and canonical assets remain unchanged; staging is recoverable/prunable. |
| CPF-07 | Replace backup fails | Replace is blocked before current data changes. |
| CPF-08 | Envelope commit fails after Blob staging | Prior project remains authoritative; staged bytes do not appear in trays. |
| CPF-09 | Route/visibility change during stroke | Preview cancels or commits by documented policy; pointer capture releases. |
| CPF-10 | Route change during encode/export | Task cancels, URLs revoke, scene and draft remain intact. |
| CPF-11 | Browser evicts origin data | App reports missing art and offers project import; it never erases references silently. |
| CPF-12 | Object URL becomes stale during async render | Render token discards stale output and revokes the URL. |
| CPF-13 | Slot changes while pointer stroke or selection move is active | Transient work follows the documented cancellation policy; capture releases and committed pixels remain unchanged. |
| CPF-14 | Slot changes while a cutout SVG is loading | Stale completion is ignored, temporary URL revokes, and no wrong-slot pixels are drawn. |
| CPF-15 | Cutout asset is missing, wrong kind/slot, or fails decode | Canvas, dirty state, history, and selected valid reference remain unchanged; error is recoverable and announced. |
| CPF-16 | Rapid cutout activation or confirmation | At most one pixel action commits and one history entry is created. |
| CPF-17 | Resize, zoom, route, or visibility change with guides shown | Overlay remains aligned or tears down cleanly; it never blocks canvas input or enters a Blob. |

## 18. Implementation map

Names are proposed boundaries, not permission to implement them in this planning change.

```text
js/features/paint/
  paint-view.js                 route, dialogs, responsive controls
  paint-session.js              transient document, tools, history, dirty state
  paint-raster.js               pure pixel/stroke/fill/selection operations

js/services/
  custom-art-repository.js      IndexedDB, staging, drafts, backups, trash
  project-portability.js        outer package bytes and collision plan
  export-service.js             mixed SVG/PNG scene composition

js/core/
  asset-registry.js             static + custom metadata resolution
  state-schema.js               bounded custom metadata
  app-store.js                  metadata/library/reference commands

js/features/designer/           My Art wearables and mixed doll layers
js/features/play/               My Art props and mixed scene layers
js/features/scene-book/         mixed-source transient thumbnails
```

Likely persisted-schema, asset-security, and architecture changes require accepted decisions replacing or extending D-003, D-018, and D-021 before Gate 1. The accepted decisions must name the raster-canonical choice, immutable asset IDs, package format, and recoverable-trash policy.

## 19. Definition of done

Custom Paint Studio is complete only when:

- Gates 0, 1, 2, 3, 3B, and 4 pass;
- IndexedDB and project portability are implemented prerequisites, not follow-up tasks;
- one custom wearable and one custom prop achieve stage/reload/Scene Book/PNG/project-transfer parity;
- all required journeys and failure injections have dated evidence;
- the feature is usable at desktop and tablet viewports with pointer, touch, and its keyboard path;
- offline iPad use is verified on the hosted PWA;
- no Blob/base64/object URL enters localStorage or persisted thumbnails;
- no missing, removed, corrupt, or quota-failed artwork silently deletes a project reference;
- the SVG-painter scope remains deferred unless a later accepted decision replaces this PRD.
