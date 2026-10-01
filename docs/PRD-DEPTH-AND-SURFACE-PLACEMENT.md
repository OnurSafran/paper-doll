# PRD — Paper Stage Depth & Furniture Surface Placement

> Release amendment (2026-10-01, D-050): schema 8 clears all older/unversioned
> device data; legacy migration and the user Room/Free toggle are withdrawn.
> Background profiles enable constraints automatically. Panorama shrink requires
> an affected-item count and Yes/Cancel before removing complete assemblies.
> The deferred scope listed in the implementation notes overrides the original
> first-release checklist below.


**Status:** First implementation recorded in D-049; moderated user/device validation pending  
**Date:** 2026-10-01  
**Scope:** Play stage, props, avatars, custom drawing and surface authoring, persistence, previews, and export  
**Product:** Paper Doll Studio & Play Sandbox

## 1. Recommendation

Build a **2.5D paper theater**: an illustrated wall and visible floor, with upright paper/cardboard avatars and furniture. Use contact points, placement regions, and automatic depth ordering to make objects feel grounded. Keep the current 2D SVG/DOM renderer and logical coordinates.

Use an array of allowed placement targets, and separately describe the surfaces an object provides:

- A table **can be placed on the floor** and **provides a tabletop**.
- A small lamp **can be placed on the floor or a furniture surface**.
- A picture **can be placed on a wall**.
- An avatar **can stand on the floor**. Sitting and standing on furniture require separate future interaction rules.

Treat a tabletop as a named **support surface**, rather than calling it another floor. Floor and tabletop placement can share geometry and validation helpers, while retaining different ownership, movement, and layering rules. Being small does not automatically make an item surface-compatible, and being furniture does not automatically make it a support.

The first release uses depth ordering, floor artwork, and contact shadows without automatic perspective scaling. This gives the desired sense of depth while preserving readable dolls, predictable size controls, and export fidelity. True 3D, rotating cameras, gravity, and physical simulation are outside this feature.

For player-drawn furniture, use **separate Draw and Placement modes in Paint Studio**. Players draw the table, then drag a predefined surface shape onto its illustrated top and resize it. The shape becomes invisible behavior metadata, not painted pixels. Rectangle, oval, and trapezoid presets plus a test lamp cover the initial use case without requiring a polygon editor.

## 2. Problem and intended outcome

Today, users arrange entities anywhere inside a bounded 2D stage and manually adjust layers. A floor lamp can float on a wall, avatars need manual ordering when passing behind furniture, and a lamp placed visually above a table has no semantic relationship to it.

The feature should let a player furnish a room through ordinary dragging and a complete non-drag alternative. Correct positions and depth should follow naturally from the chosen item and its support. Moving a table should carry its lamp; moving the lamp should allow repositioning on that table or transferring to another compatible target.

Primary users remain children, casual players, parents, and teachers. Technical concepts such as polygons, graph edges, and coordinates belong in content tools and implementation, not the normal play flow.

### Core story

1. Open a room with a visible wall/floor boundary.
2. Add a table; its contact footprint stays on the floor.
3. Add an avatar; moving it toward the back of the floor puts it behind the table, and moving it toward the front puts it in front.
4. Drag a small lamp toward the tabletop; the valid surface highlights and previews the lamp resting on it.
5. Release to place the lamp. Move the table; the lamp follows.
6. Move the lamp to the floor or another table, undo the move, save, refresh, and export the same arrangement.

## 3. Existing project constraints

This proposal builds on the existing implementation:

| Existing capability | Consequence for this feature |
|:--|:--|
| Vanilla HTML/CSS/ES modules, no runtime dependencies | Implement placement math as small pure modules; retain SVG/DOM and canvas export. |
| Stage widths of 1600, 3200, or 4800; height 900 | Placement regions use absolute stage coordinates and work across the full panorama. |
| Persisted entity `x`, `y`, `scale`, `flipped`, and `order` | Keep absolute contact coordinates and scalar size; derive depth and render order. |
| Props define dimensions and `groundAnchor` | Reuse the ground anchor as the placement contact point; author wall items with an appropriate mounting contact. |
| Pinning, `attachedTo`, `attachOffset`, and attachment cycle protection | Integrate surface support with the existing relationship graph; do not create a second independent parent system. |
| AppStore, committed undoable edits, autosave | A placement or support-tree transformation is one atomic command and one undo entry. |
| Schema version 6, import/export, missing-asset recovery | Version new fields, migrate safely, retain unsupported artwork and prior arrangements. |
| Paint Studio draws raster props, crops transparent margins on save, and offers size/anchor presets | Keep behavior overlays outside the bitmap, and transform their coordinates through the final artwork crop. |
| Scene Book, PNG export, animation, local custom art | Share geometry and ordering across all renderers and account for animated attachments. |
| Maximum 40 entities and 30 saved scenes | Retain existing limits; benchmark the full entity limit. |

Authority: [PROJECT.md](PROJECT.md), [ARCHITECTURE.md](ARCHITECTURE.md), [ASSETS.md](ASSETS.md), and [DECISIONS.md](DECISIONS.md). See the current [scene rules](../js/domain/scene-rules.js), [state schema](../js/core/state-schema.js), and [entity contracts](../js/types.js).

This PRD proposes changes to manual scene ordering and support-relative pinning. Implementation must record replacements/amendments to D-021, D-023, and the relevant multi-select decision, and update canonical documents. The proposal does not silently supersede accepted behavior.

## 4. Goals, scope, and success criteria

### First-release requirements

- A visible floor and authored wall regions for supported backgrounds.
- Floor-constrained furniture and avatars; wall-constrained wall props.
- Multiple allowed target types per asset.
- Explicit tabletop support for selected furniture and small props.
- Player-drawn floor furniture with movable/resizable predefined tabletop surfaces, contact-anchor setup, and a test preview.
- Automatic front/back ordering from floor contact depth.
- Support-aware move, scale, flip, pin, delete, duplicate, and undo/redo.
- Complete touch, mouse, keyboard, and Scene Outline flows in English and Turkish.
- Matching stage, Scene Book thumbnail, reload, and full-width PNG output.
- Preserved legacy scenes and free collage play.

### Deferred

- Seat/bed poses, riding, carrying, hands as placement targets, ceiling placement.
- Shelf compartments, containers, drawers, physical weight, collisions, and gravity.
- Arbitrary stacks of objects that themselves provide support surfaces.
- Automatic perspective scaling, parallax, camera rotation, WebGL, or 3D meshes.
- Free-form polygon/vertex editing, arbitrary surface rotation, and automatic detection of surfaces from a drawing. Preset surface authoring is in scope.

Wall-mounted shelves can later provide support using the same contract. Their shelf lips and occlusion need separately authored art and validation; the first release only promises floor-standing tabletop hosts.

### Product validation

In a moderated pilot with at least five intended users, at least four should place a table, place a lamp on it, and move the furnished table without coaching after a short introduction. Also test drawing a simple table, fitting a surface preset, saving it, and placing a lamp on it; at least four should complete that flow after the same introduction. No participant should lose an item after an invalid drop. These are proposed release targets, not measured results. Collect feedback through local sessions; do not add analytics.

## 5. Stage and depth model

### 5.1 Visual treatment

Use a shallow room/diorama view with a wall/floor seam and an illustrated floor extending toward the viewer. Upright cutouts retain their front-facing artwork. Furniture may contain a drawn top plane, but sprites are not automatically skewed or converted into 3D models.

Give grounded objects restrained contact shadows. Wall items have wall shadows; supported items have shadows at their contact surface, not on the room floor. Shadows are cosmetic and must also appear in previews/export. Placement guides are editor-only and must not appear in saved thumbnails or PNGs.

Rugs and mats render below upright floor objects. A rug is a floor decoration, not an elevated support host; avatars can stand over it while remaining supported by the stage floor.

### 5.2 Coordinates and regions

Keep `x` and `y` as absolute logical stage coordinates of an entity's contact anchor. In this first release, depth is the projected floor contact `y`: smaller values are farther back, larger values nearer the viewer. Do not introduce persisted `z` or a second world-coordinate system yet.

Each supported background declares a placement profile with stable region IDs, region kinds (`floor` or `wall`), and convex polygons. Polygons follow the illustrated room geometry; do not infer surfaces from pixels or apply one floor boundary to all backgrounds. The intersection of region validity and full-stage visual bounds determines whether placement fits.

A floor constraint governs the object's **contact footprint**, not its whole silhouette. A tall wardrobe can extend upward over the wall while its base remains on the floor. A wall item must fit its authored mounting region with its visible bounds. All artwork must also remain within the scene's existing visual bounds.

Background profiles must follow the current native-width background tiling/cropping policy. Repeated backgrounds repeat their placement regions with deterministic instance IDs; native panoramas author full-width regions. Camera movement changes the viewport, never region coordinates or stored positions.

### 5.3 Modes and background changes

- **Room mode:** only available when the selected background has validated placement metadata. New scenes using an enabled room background default to this mode.
- **Free collage mode:** retains current unrestricted placement and manual ordering. Legacy scenes default to this mode, even if their background later gains regions.
- Entering Room mode previews a proposed conversion. Show moved-item and unsupported-item counts before committing. Cancel retains the original scene. Items without metadata remain explicitly free exceptions.
- Switching backgrounds in Room mode previews any required relocation. Retain still-valid coordinates where possible; relocate stage-supported items to the nearest valid same-kind region. Move tabletop children with their host. If no valid destination exists, preserve the entity as a labeled free exception until the user chooses a valid placement.
- Returning to Free collage mode preserves positions and support relationships; it relaxes constraints and restores manual ordering. Surface children still follow their hosts.

Mode conversion and background relocation each commit as a single undoable operation. No silent rearrangement occurs when reopening an old scene.

## 6. Placement metadata and state

### 6.1 Separate three questions

| Question | Owner | Proposed field |
|:--|:--|:--|
| Where may this asset be placed? | Asset definition | `placementRules.allowedTargets` |
| Which usable surfaces does this asset provide? | Asset definition | `supportSurfaces` |
| Where is this particular instance currently placed? | Scene entity | `placement` |

`allowedTargets` is an array with OR semantics. `["floor", "surface"]` means either destination is legal, not that both apply at once. One instance has one active support relationship.

Keep functional geometry at the asset contract's top level beside `displayWidth`, `displayHeight`, and `groundAnchor`. The existing `metadata` object records provenance, including `metadata.dlc`; thematic `collections` describe discovery. Neither should control placement compatibility.

### 6.2 Proposed asset examples

The following fields are additions to existing catalog records; IDs and numbers are illustrative:

```json
{
  "id": "example_table",
  "kind": "prop",
  "displayWidth": 300,
  "displayHeight": 220,
  "groundAnchor": { "x": 0.5, "y": 1 },
  "placementRules": {
    "allowedTargets": ["floor"],
    "tags": ["furniture"],
    "contactFootprint": { "width": 0.7, "depth": 0.04 },
    "renderClass": "upright"
  },
  "supportSurfaces": [
    {
      "id": "tabletop",
      "nameKey": "placement.tabletop",
      "polygon": [[0.13, 0.30], [0.87, 0.30], [0.87, 0.37], [0.13, 0.37]],
      "acceptsTags": ["small-prop"]
    }
  ]
}
```

```json
{
  "id": "example_small_lamp",
  "kind": "prop",
  "placementRules": {
    "allowedTargets": ["floor", "surface"],
    "tags": ["small-prop"],
    "contactFootprint": { "width": 0.18, "depth": 0.02 },
    "renderClass": "upright"
  },
  "supportSurfaces": []
}
```

Surface polygon coordinates are normalized to the host's **unscaled artwork display rectangle**: `(0, 0)` is its top-left and `(1, 1)` its bottom-right. They are not stage coordinates or percentages of the SVG source viewBox. `contactFootprint.width` and `.depth` are fractions of the child's unscaled display width and height; its footprint is a rectangle centered on its contact anchor. Scaling changes both footprint and visible dimensions.

First-release compatibility requires target kind membership, at least one matching item/surface tag for furniture support, footprint containment, available visual bounds, and a valid relationship graph. Tags alone never permit an avatar or large wardrobe to rest on a tabletop. Size comes from geometry rather than asset-name heuristics or broad furniture categories.

### 6.3 Proposed instance examples

```json
{
  "instanceId": "table-1",
  "kind": "prop",
  "sourceId": "example_table",
  "x": 1000,
  "y": 780,
  "scale": 1,
  "flipped": false,
  "order": 1,
  "placement": { "kind": "floor", "regionId": "room-floor" }
}
```

```json
{
  "instanceId": "lamp-1",
  "kind": "prop",
  "sourceId": "example_small_lamp",
  "x": 1000,
  "y": 633.7,
  "scale": 1,
  "flipped": false,
  "order": 2,
  "attachedTo": "table-1",
  "attachOffset": { "dx": 0, "dy": -146.3 },
  "placement": {
    "kind": "surface",
    "surfaceId": "tabletop",
    "localPoint": { "x": 0.5, "y": 0.335 }
  }
}
```

For a surface child, `attachedTo` is the host instance ID; do not add a competing `parentId`. `localPoint` is in the same normalized host-artwork space as the polygon. Absolute `x/y` and legacy `attachOffset` are compatibility outputs written atomically with placement changes. They must never drift independently.

Project a local point into stage coordinates using the host's dimensions, contact anchor, scale, and horizontal flip. Conceptually: unflipped local offset is `((localX - anchorX) × width, (localY - anchorY) × height)`; multiply by host scale, mirror the horizontal offset if flipped, then add host `x/y`. Use the exact renderer transform, including its flip pivot, for both projection and inverse projection. A release must prove projection/inverse round trips and asymmetric-anchor parity.

For surface relationships, `localPoint` is authoritative; regenerate absolute outputs on load and commands. For existing generic attachments, absolute coordinates and current offset semantics remain authoritative. On entering support placement, replace the previous generic attachment atomically. Never use both attachment interpretations for one child.

Use `placement.kind: "free"` with a bounded reason enum (`legacy`, `unclassified`, `support-missing`, or `no-valid-target`) for preserved exceptions. It is a visible recovery/compatibility state, not an additional catalog placement target.

### 6.4 Content policy

| Item | Allowed targets | Provides support? |
|:--|:--|:--|
| Avatar | Floor | No |
| Table | Floor | Authored tabletop |
| Floor lamp | Floor | No |
| Small lamp, vase, toy, cup | Floor and surface, when individually authored | Normally no |
| Rug or play mat | Floor; `renderClass: "ground"` | No |
| Picture or calendar | Wall | No |
| Wall shelf | Wall | Future authored shelf surface |
| Caption or speech bubble | Existing overlay/attachment behavior | No |
| Unclassified catalog/custom prop | Explicit free exception | No inferred support |

New custom props may choose Floor, Wall, or Floor & Surface in a simple placement setting, with a default contact footprint and preview. Existing custom props preserve free placement. Players can additionally author tabletop support on their own floor-standing furniture through the Placement mode described below. A surface-host drawing uses Floor placement in this release; enabling nested support or wall-mounted hosts remains deferred.

Author the first release's tables, lamps, and sample backgrounds individually. A table illustration without a convincing top plane must be revised before exposing a tabletop surface.

## 7. Drawing and surface authoring in Paint Studio

### 7.1 Recommended experience: draw first, describe behavior second

Keep the existing prop painter, including its 500 × 500 logical canvas and size presets. Add two clearly labeled modes: **Draw** and **Placement**. Wearable drawing retains its existing workflow; this feature applies only to props.

Draw mode owns brush, eraser, fill, shapes, selection, and mirror. Placement mode owns the prop's allowed destinations, contact marker, base footprint, and surfaces. Entering Placement freezes painting input and dims the drawing toolbar so touching a handle cannot paint a stroke. The raster is still visible, and returning to Draw preserves all placement work.

Neither permission settings nor surface creation is required to save an ordinary drawing. New prop drafts start with a visible Floor setting and bottom-center contact suggestion; choosing Small prop offers Floor & Surface plus a small size preset, and choosing Wall decor offers Wall plus a center mounting suggestion. These are explicit user-selected starter settings, not classifications inferred from pixels. Existing art stays free until the player chooses to configure it.

The existing painter's `propPlacement: "surface" | "hang"` currently chooses a bottom-center or center anchor; it does **not** create a tabletop or enforce destination rules. Replace those ambiguous labels with the new destination and contact controls during implementation. Migrating old artwork must not interpret the old `surface` value as “this object provides a support surface.”

### 7.2 Make a table: complete user journey

1. Choose **Draw a prop → Furniture**. This selects Floor and a large display-size suggestion; size remains editable.
2. Draw a table with legs and a visible top, or choose an optional faint table guide. Reference guides stay out of the saved PNG.
3. Open **Placement**. A contact marker appears near the bottom-center of the drawing; position it at the center of the table's ground contact. Adjust its small base-footprint guide if needed.
4. Tap **Add a surface**, then drag **Rectangle**, **Oval**, or **Trapezoid** from the preset tray onto the drawn tabletop. Alternatively, tap a preset and tap where to place its center.
5. Resize the translucent area with handles so it covers the usable part of the tabletop. Give it a name such as “Tabletop.” Its default behavior is **Holds small props**.
6. Open **Try it**. Drag the sample lamp onto the table; move the table to see the lamp follow. Toggle guides to inspect the contact area, then return to adjust it.
7. Save to My Art, or **Save and add to scene**. The prop's image and validated placement metadata are saved together. In Room mode it behaves like an authored catalog table.

The user defines what their drawing means. The app does not generate furniture depth, reconstruct geometry, or judge whether the drawing is realistic. It shows how the selected area behaves so the player can correct it.

### 7.3 Preset surfaces and resizing

| Preset | Intended use | Controls |
|:--|:--|:--|
| Rectangle | Front-facing table or flat counter | Drag body to move; corner/edge handles change width and depth independently. |
| Oval | Round/oval tabletop drawn as an ellipse | Drag body to move; handles change horizontal and vertical extent. |
| Trapezoid | Tabletop drawn with a narrower rear edge | Drag body to move; handles change width/depth; a labeled Rear width control changes the perspective taper. |

“Depth” in these controls means the **visible support area's vertical thickness in the drawing**, not physical height above the floor. A shallow area normally fits a tabletop better than a large box covering the table's front and legs. Show a contact-dot example and the hint “Cover the part where small objects should rest.” The entire child's picture need not fit inside this area; only its contact footprint must fit.

Presets represent equivalent support behavior. They do not assign materials, weight capacity, or furniture categories. All provide the same default small-prop acceptance rule.

Use eight large resize hit targets around the selected preset, with a minimum 44 CSS px touch hit area independent of canvas zoom. If handles overlap on a thin tabletop, show a magnified selected-area view and accessible width/depth controls; do not enlarge the actual surface to make it easier to touch. Preserve the initial grab offset and keep movement in drawing coordinates through zoom/scroll conversion.

Resize is independent in each axis by default. Provide a Keep proportions checkbox; first-release surfaces are aligned with the drawing canvas, with no arbitrary rotation or vertex tool. Trapezoid taper stays convex and has nonzero rear width. Move/resize commits on release; Escape, pointer cancellation, or a mode change restores the previous overlay.

Surfaces appear as translucent, labeled, dashed overlays only during authoring or when placement guides are enabled. Selecting a surface selects its outline, never the painted image beneath it. A surface list provides Rename, Duplicate, Remove, and selection of overlapping areas. Up to four surfaces may be authored on one prop; duplicate creates a new stable surface ID. Overlaps are permitted and placement uses the existing deterministic candidate rules.

### 7.4 Contact points, footprints, and two distinct uses of surfaces

Placement mode presents two separate groups:

- **Where this piece goes:** Floor, Wall, or Floor & Surface; its draggable contact marker and base-footprint guide.
- **What this piece can hold:** optional named support areas placed over the drawing.

A drawn lamp needs the first group, with its contact at the lamp base and permission to use furniture tops. A drawn table needs Floor placement plus a tabletop in the second group. Creating a support area must never change the table's own floor anchor or make its entire image a surface.

Floor footprints start as a conservative small rectangle at the contact; users can resize it using a labeled Base width/Base depth control. Wall drawings use a mounting marker and existing visible-bounds rules. A surface-enabled small prop receives the internal `small-prop` tag through the explicit permission choice; the user does not edit tag strings. Floor-standing support hosts receive the furniture behavior and do not receive a small-prop compatibility tag automatically.

Switching a host drawing away from Floor is blocked while usable surfaces remain, with actions to retain Floor or remove the surfaces. Choosing Floor & Surface for a host would introduce nested support, so it is deferred alongside wall-host support. Remove all support areas to convert the drawing into an ordinary placeable prop.

### 7.5 Try-it preview and authoring feedback

The preview is an isolated miniature room using the same projection, containment, ordering, and transform rules as Play. Its temporary table/lamp positions never alter the current scene, library, or drafts beyond the author's metadata edits.

Provide a sample lamp and vase, a Place on surface action, and a movable host. Use the preview at the selected Small/Medium/Large display size; changing size can make a previously usable surface too small for the test prop. Preview failure says why and suggests enlarging the area or adjusting the size, rather than silently shrinking the lamp.

Block saving malformed/nonfinite/out-of-bounds/degenerate surface geometry and a surface attached to an empty drawing. A very thin but valid surface may be saved with “The sample lamp does not fit here” feedback: the surface could intentionally support smaller items. Do not require every surface pixel to be opaque; line drawings and hollow tabletops can still define a usable semantic area.

Warnings for artwork changes must be actionable. Erasing a tabletop does not automatically delete its support area. Show the overlay on returning to Placement and require review if the final crop makes its geometry invalid. Surface previews do not claim that a sketch has valid 3D geometry.

### 7.6 Coordinate conversion, cropping, and saved data

During authoring, geometry lives in the **uncropped logical drawing canvas**. On save, first compute the final transparent-margin crop as the painter does today, then convert anchors and every surface point into normalized coordinates of the saved artwork. With logical crop rectangle `(cropX, cropY, cropWidth, cropHeight)`:

```text
savedX = (drawingX - cropX) / cropWidth
savedY = (drawingY - cropY) / cropHeight
```

Convert raster crop bounds into logical units using the actual pixel/logical scale before applying these formulas; never assume a fixed 2× scale. Convert footprint dimensions by the corresponding crop width/height as well. Default normalized footprints chosen after crop are already in saved-artwork space and must not be transformed twice.

Points outside the final crop require correction before save; do not clamp them silently. Surface guides never contribute to the alpha bounds, artwork digest, PNG bytes, or export image. Once normalized, geometry scales with the saved prop's `displayWidth/displayHeight` using the same contract as catalog surfaces.

Rectangle and trapezoid presets serialize as convex polygons. Oval presets serialize as a conservative, inscribed 16-vertex convex polygon, so runtime placement needs no new ellipse-specific collision API; communicate any meaningful edge-fit difference in the preview. Expand the polygon cap to 16 vertices. The saved polygon is the authoritative geometry; optional `authoringPreset` is a bounded editor hint, not a second geometry definition. The preset editor must reconstruct and round-trip its shapes without changing their dimensions on reopen.

Save these additions on the existing custom prop metadata record, alongside its image references and dimensions, and project them through the custom-asset registry into the normal asset contract. Example additions to a complete custom table record:

```json
{
  "assetId": "custom_table_example",
  "kind": "prop",
  "groundAnchor": { "x": 0.5, "y": 0.98 },
  "placementRules": {
    "allowedTargets": ["floor"],
    "tags": ["furniture"],
    "contactFootprint": { "width": 0.65, "depth": 0.03 },
    "renderClass": "upright"
  },
  "supportSurfaces": [
    {
      "id": "surface_1",
      "name": "Tabletop",
      "authoringPreset": "trapezoid",
      "polygon": [[0.18, 0.20], [0.82, 0.20], [0.93, 0.32], [0.07, 0.32]],
      "acceptsTags": ["small-prop"]
    }
  ]
}
```

Catalog surfaces may use `nameKey`; custom surfaces use plain-text names bounded to 30 grapheme clusters and rendered as text. Surface IDs are unique within an asset, never derived from a name, and survive move/resize/rename. A preset label such as Oval does not need to become the surface's player-facing name.

### 7.7 History, recovery, and editing an existing drawing

Authoring has one chronological Paint Undo/Redo sequence across strokes and metadata edits. Moving/resizing a surface contributes one metadata command on release; changing the contact point, adding/removing a surface, and changing placement permissions are also undoable. Extend the existing raster history with lightweight metadata entries rather than allocating a full image snapshot for every handle movement. Paint history stays separate from scene history.

Checkpoint surfaces, contact/footprint, permissions, selected display size, and raster bytes in the draft recovery flow. The currently selected tool/surface may be restored as editor state but never becomes asset behavior. Changing item type to Wearable follows the existing unsaved-work flow and cannot leak prop support metadata into clothing.

**Editing saved furniture defaults to Save a copy.** The current painter already creates a new asset on save. Preserve that behavior so moving a tabletop does not unexpectedly move lamps in every saved scene that references the original asset. Copies preserve surface IDs within their new asset scope, while newly duplicated surfaces receive new IDs.

Offer an explicit **Use copy for selected scene piece** action when editing from Play. Preview the new drawing, recompute existing child contacts against matching surface IDs, and report any children that would lose support. Commit the source-asset change and valid child projections in one scene command; cancel changes no scene. Unsupported children follow the existing recoverable free-exception policy. Other instances and saved scenes keep the old asset. In-place global artwork/geometry replacement is deferred; do not add per-scene surface overrides in this release.

The original custom asset is retained until the user explicitly removes it. A copy consumes the existing custom-asset quota; if it cannot be saved, preserve the draft and keep the scene unchanged. Geometry metadata and artwork persistence must use the existing recoverable save flow; do not mark an asset saved or spawn it if either part fails.

### 7.8 Accessible authoring alternative

Every preset can be added by clicking/tapping a preset and then its center, without dragging. Selected surfaces have labeled position, width, depth, and trapezoid rear-width controls, plus Move/Resize steppers. Offer percentages of the artwork bounds in advanced fields, while the default flow uses handles and buttons. A surface list supports keyboard selection and named actions; arrow keys move, and labeled buttons resize. The ground marker and base footprint have equivalent controls.

Keyboard-only editing is necessary but does not replace the click/tap alternative for touchscreen users. This follows [W3C's dragging-movement guidance](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html). Keep handle targets usable at different zoom levels, using the 44 CSS px touch design target above and checking [target sizing and spacing](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Localize control labels, preview feedback, and default surface names in English and Turkish.

## 8. Placement interaction

### 8.1 Add and drag

1. Activation from the tray chooses the nearest valid floor/wall position to the viewport center, following the asset's allowed targets. If only surface placement is allowed, open the support chooser; do not spawn a floating object.
2. Preserve the pointer-to-contact offset during dragging. The item must not jump so its base suddenly replaces the grab point.
3. Highlight compatible destination regions. Show a contact marker, legal-position ghost, and short label such as “On table” or “On floor.” Invalid destinations also show a symbol/text reason; color alone is insufficient.
4. An item already on a tabletop remains within that surface while nudged. Dragging away may transfer it only to a compatible highlighted target. Floor-only props never leave the floor during a move.
5. A surface candidate is considered when the contact anchor is within **16 CSS px** of its legal placement area. Keep the candidate until it is more than **24 CSS px** away to prevent flicker. Convert thresholds through viewport scale; they must feel the same at every zoom/viewport size. These are tuning defaults to validate in the pilot.
6. Rank candidates deterministically: explicitly selected destination, valid current support, then closest valid contact position; ties use frontmost visible support, then stable IDs. Only the explicit chooser permits targeting a wholly occluded surface.
7. Clamp to the nearest feasible contact position, satisfying both footprint and stage bounds. If an object is too large to fit, mark the candidate invalid instead of reducing its size silently.
8. Pointer release commits one position/support update. An invalid transfer restores the last committed placement and announces why. Escape, pointer cancellation, route change, or capture loss discards the preview.

Use the existing camera conversion and edge auto-pan before candidate resolution. Recompute candidate geometry as the camera pans; a pointer location is never mistaken for a stage location.

### 8.2 Non-drag equivalent

The inspector and Scene Outline provide **Place on…** with compatible destinations, named by entity and surface, such as “Dining table — tabletop.” The chooser also offers the floor or wall when legal. Choosing a destination previews a fitting position and commits through the same rules as dragging.

Arrow-key movement and existing move controls operate within the active region/surface. Reaching an edge stops movement and announces the boundary; arrows do not silently reparent an item. Use Place on… to switch support. Show “On table,” “On floor,” “On wall,” or “Free placement” in the inspector and accessible description.

Keep existing step sizes and shortcut precedence. Touch controls meet the project's target sizing/contrast requirements; focus remains on the selected item after placement. Placement feedback uses polite live status without announcing every drag frame. Localize all labels and failure messages in English and Turkish.

## 9. Support ownership and editing behavior

The first release permits a floor-standing host with direct supported props. A surface-supported prop cannot itself provide a usable surface. The combined surface/generic attachment graph must remain acyclic; validate all edges together. Generic character attachments and speech bubbles retain their existing behavior.

| Operation | Required behavior |
|:--|:--|
| Move table | Move every supported child and its generic descendants atomically; clamp the entire assembly to valid stage bounds. |
| Move supported lamp | Recompute its host-local contact point; stay inside the usable tabletop unless a valid transfer commits. |
| Scale table | Reproject child positions; preserve each child's own size. Reject the scale if any footprint no longer fits or assembly bounds fail. |
| Flip table | Mirror the authored surface and child contact locations; keep child artwork orientation. Reject if the resulting assembly cannot fit. |
| Scale/flip lamp | Apply its own transform and revalidate containment; reject invalid changes rather than detach unexpectedly. |
| Pin table | Lock the table's direct transforms; its surface still accepts and releases children. |
| Pin supported lamp | Lock direct edits relative to the support; it still follows table movement. Preserve its support relationship. |
| Delete table | Delete only the requested host. Resolve its children to the nearest valid allowed destination, preferring the floor; otherwise keep their last absolute position as a visible free exception. Undo restores the original assembly. |
| Duplicate lamp | Retain host if another offset position fits. Otherwise request a legal destination; do not commit an invalid duplicate. |
| Duplicate table | Default duplicates the host only. An explicit “Duplicate with contents” rewrites all included instance IDs and relationships in one command. |
| Multi-select move | Normalize selected roots so a selected parent/child is moved once. Commit only if the same delta is valid for all roots and descendants. |
| Align/distribute | Allow entities sharing the same region or surface when the resulting arrangement fits. Disable mixed-support alignment with an explanation. |
| Resize stage | Validate/reposition support assemblies as units; never clamp a lamp independently away from its table. |
| Undo/redo | Restore support, local coordinates, absolute outputs, order, and pinning together. |

Support-relative pinning differs from today's behavior, which clears attachment on pin. Update reducers, sanitization, controls, and documentation together; generic attachment pinning need not change in this feature.

Decorative animation is applied after placement. Bounces, gestures, and voice previews do not change support or automatic depth. Surfaces follow their host's evaluated visual transform for preview/export; this release exposes surfaces only on static furniture. Existing character-held props and speech bubbles continue through the current animation attachment path.

## 10. Rendering and occlusion

Automatic ordering uses the **support root's floor contact**, not the item's image top or its own elevated contact. A lamp at screen `y = 634` on a table grounded at `y = 780` belongs to the table's depth group. Sorting the lamp by its own screen position would incorrectly hide it behind the table or another distant object.

Use deterministic draw bands: background, wall fixtures, floor decorations, upright floor assemblies, narrative overlays. Within upright assemblies, sort by root contact `y`, then existing `order`, then stable instance ID. Draw a host first, then its supported children; siblings sort by local contact `y`, `order`, and ID. Generic attachments retain their current relative front/back composition within their root group. Speech/caption overlays retain their documented overlay behavior.

In Room mode, layer buttons adjust equal-depth peers or siblings, and say when a requested change is constrained by depth/support. Free collage mode retains full manual ordering. Temporary drag elevation is preview-only and resets on commit/cancel.

This approach groups a table and lamp together: an avatar standing behind the table goes behind the whole assembly; an avatar standing in front goes in front. It does not provide partial body occlusion within a table or sofa. Choose starter artwork where this looks convincing. Shelf lips, crib rails, seated dolls, and tall interleaving furniture need authored front/back artwork parts in a later feature; a generic `zIndex` cannot solve them.

Use one pure scene presentation calculation for stage, thumbnails, export, and hit-test ordering. Hit testing must respect the visible draw order while the outline remains able to select occluded items. Do not rely on CSS `z-index` as the only source of ordering truth.

## 11. Persistence, compatibility, and recovery

- Introduce a new schema version at implementation time; use version 7 only if it is still the next unallocated version. Version all scene, custom-art, and portable-project additions together.
- Migrate version 6 and older scenes to Free collage mode with unchanged transforms, order, pinning, and generic attachments. Do not invent tabletop support from pixel overlap.
- Validate target enums, unique IDs, finite geometry, convex non-degenerate polygons, normalized points, compatibility tags, bounds, graph references, and optional preset hints. Initial authoring caps: eight regions per background tile/profile, four surfaces per host, and 16 vertices per polygon to accommodate oval presets; repeated region instances are derived.
- A malformed placement record must not delete an otherwise valid entity. Preserve recoverable absolute coordinates, clear the invalid support edge, and report a free-placement exception. Apply the existing safe-envelope recovery policy when the envelope itself is corrupt.
- Missing host, missing surface ID, or removed pack: retain the child and last known absolute position; show support unavailable. Do not silently relink when the asset reappears.
- On import/merge, rewrite `attachedTo` with instance-ID mappings. Surface IDs remain scoped to their source asset. Derive repeated region IDs from stable background/tile identifiers.
- Stable surface/region IDs must survive ordinary art updates. If geometry changes invalidate a placement, preserve the arrangement as a recoverable exception and announce it; no silent jump on refresh.
- Reload regenerates surface-child outputs from validated local points, in graph order, and verifies feasibility. Use a small numeric tolerance; avoid rounding every intermediate projection. Final exports and scene rendering share the same values.
- Save placement mode and validated support state in current scene and Scene Book. Do not persist highlight candidates, ghosts, drag sessions, shadows as entities, derived depth, or draw lists.
- Free exceptions remain visible/selectable/exportable and include a clear recovery action. They may be repositioned through Place on…; do not treat a recovery warning as successful constrained placement.

## 12. Implementation boundaries

Proposed responsibilities, to refine during implementation:

| Area | Responsibility |
|:--|:--|
| Asset catalog and pack validation | Placement permissions, footprints, stable surface IDs, and background profiles. |
| Paint session/overlay controllers | Separate Draw/Placement input, preset geometry, handles, contact markers, metadata history, draft recovery, and authoring preview. |
| Paint save service/custom-asset registry | Crop-space conversion, normalized geometry, plain-text surface names, and propagation of custom behavior to the asset contract. |
| Domain placement module | Coordinate projection/inverse, compatibility, polygon containment, feasible positions, candidate ranking, and graph checks. |
| Existing scene rules/reducer | Atomic edits, compound validation, relationship changes, duplication, deletion, and history. |
| Pointer controller | Transient drag preview, target feedback, cancellation, and existing camera conversion. |
| Inspector/outline | Destination chooser, accessible movement, exception recovery, and support descriptions. |
| Shared presentation module | Depth groups, transforms, contact shadows, draw order, and renderer/hit-test parity. |
| Schema/portability/repository | Version migration, sanitation, reference remapping, and recovery. |

Cache static metadata and invalidate host geometry when its transform changes. At the existing 40-entity limit, a linear scan of validated candidate surfaces is sufficient unless measurements show otherwise. Start without a spatial index, scene engine, physics library, or recursive DOM ownership rewrite.

Preserve the current separation between position translation and artwork scale/flip. Sharing parent transforms conceptually does not require nesting supported children under a flipped DOM node.

## 13. Acceptance and verification

| ID | Scenario | Required result |
|:--|:--|:--|
| A1 | Drag floor-only furniture onto the illustrated wall | Contact footprint stays within floor constraints; valid preview and committed position agree. |
| A2 | Move an avatar behind and in front of a table | Ordering follows floor contact depth; moving hands/head or changing pose does not reorder the avatar. |
| A3 | Place a lamp on a table | Footprint fits the authored surface, host relationship commits, and lamp renders above the host. |
| A4 | Move, scale, or flip a furnished table | Child positions follow the defined transform policy; invalid assembly transforms leave prior state intact. |
| A5 | Transfer a lamp between two tables or to the floor | One valid support remains, world position does not jump before preview, and undo restores the original relationship. |
| A6 | Try to place a wardrobe/avatar on the tabletop | Destination is rejected with a localized reason through drag and chooser paths. |
| A7 | Delete a host or load a missing host/surface | No child is lost; valid fallback or visible recovery state is retained. |
| A8 | Select a parent and child, then move/duplicate with contents | No double movement; duplicate IDs and internal references are unique and correct. |
| A9 | Use pinned hosts/children and generic attachments | Surface pinning remains support-relative; cycles and conflicting parent interpretations are rejected. |
| A10 | Save, reload, reopen Scene Book, and export | Contact positions, shadows, size, flips, depth, overlays, and support geometry agree. |
| A11 | Open a version 6 collage | All original transforms/order remain intact; no unsolicited room conversion occurs. |
| A12 | Pan or edge-drag across 3200/4800-wide scenes | Targets align with artwork and camera coordinates; full-width export uses the same geometry. |
| A13 | Cancel a drag, conversion, or invalid oversized placement | Previous committed state is retained; no autosave/history entry for the canceled edit. |
| A14 | Switch background or shrink stage with furnished tables | Assemblies remain together; required relocation is previewed and is undoable. |
| A15 | Complete table/lamp placement using only keyboard or touch controls | Same rules/results as pointer drag, stable focus, named targets, and bilingual feedback. |
| A16 | Import malformed placement data or merge duplicate scene IDs | Safe recovery preserves valid items; merged host references point to the remapped instances. |
| A17 | Place a rug under an avatar | Rug stays beneath upright objects; avatar remains supported by the room floor. |
| A18 | Flip an asymmetric-anchor host and invert its local projection | Geometry matches the renderer and returns the original local point within tolerance. |
| A19 | Draw a table, add a preset surface, resize it, save, and place a lamp | The saved custom prop accepts the lamp and moves it with the host using normal Play rules. |
| A20 | Add/move/resize a surface in Placement mode | No pixels are painted; guides never appear in PNG bytes, thumbnails, or scene exports. |
| A21 | Save artwork with transparent margins at different raster scales | Cropped geometry, anchor, and footprint remain aligned with the saved drawing within tolerance. |
| A22 | Create rectangle, oval, and trapezoid surfaces; reopen a saved copy | Preset shape and bounds round-trip; each runtime polygon is convex and within limits. |
| A23 | Undo interleaved strokes and surface edits, or cancel a handle drag | History restores the correct image and metadata in order; canceled gestures add no history entry. |
| A24 | Recover a draft with surfaces and placement settings | Image, contact point, display size, permissions, and support areas all recover together. |
| A25 | Configure a custom lamp and a custom table | Lamp eligibility and table-provided surfaces stay distinct; no nested support is enabled. |
| A26 | Resize a surface too small for the sample lamp, or erase the table | Preview explains fit failure; malformed/out-of-crop geometry and empty host artwork cannot save. |
| A27 | Edit a table used in multiple saved scenes | Save a copy retains the original and all its scene uses; only an explicit selected-piece replacement changes the current instance. |
| A28 | Replace a selected host with a copy that removed a surface | Impact is previewed; children retain valid matching support or enter recoverable free placement; undo restores the old host. |
| A29 | Author surfaces using keyboard only or click/tap only, at multiple zooms | Presets, contact points, movement, resizing, naming, and preview work without mandatory dragging. |
| A30 | Duplicate/rename a surface or exceed four surfaces/custom-art quota | IDs remain valid and stable; invalid additions do not commit, and the draft is retained. |
| A31 | Draw a line-only tabletop or switch a prop draft to Wearable | Semantic support does not require filled pixels; wearable assets never receive prop surface metadata. |

Automated checks should cover meaningful geometry invariants, graph safety, committed state/history, migration/merge recovery, and renderer parity. Include actual crop-coordinate round trips, preset reconstruction, mixed paint/metadata history, draft recovery, and custom-asset propagation. Extend existing Paint, attachment, scene-rules, coordinate-space, persistence, preview, and export suites rather than creating source-text-only checks.

Browser release evidence must include desktop browsers and physical iPad Safari, portrait/landscape, keyboard-only and click/tap-only authoring/placement, English/Turkish, reduced motion, overlapping surfaces, thin surfaces at different drawing zooms, narrow tablets, and offline operation. Compare actual authoring overlays and stage screenshots with cropped art, thumbnails, and PNGs; metadata tests do not establish visual realism.

Retain the current 60 FPS goal with 20 mixed entities and no sustained drag task over 50 ms. Also measure a 40-entity scene with furnished hosts and repeated backgrounds. Record device, scene, frame timing, and worst interaction task; do not claim 60 FPS from unit tests.

## 14. Delivery sequence

1. **Visual/geometry spike:** one room, one table, one lamp, and one avatar. Verify contact geometry, grab-offset preservation, front/back ordering, and transform/export parity. Review the paper-stage appearance before generalizing the data model.
2. **Placement foundation:** asset/background metadata, validation, floor/wall constraints, Room/Free mode, shared depth ordering, migration. Verify old scenes remain unchanged and panoramas align with background tiles.
3. **Tabletop interaction:** support chooser, drag transfers, support-tree editing, relative pinning, deletion/duplication, and undo. Verify atomic state changes and all failure paths.
4. **Custom drawing and surfaces:** Draw/Placement modes, preset resizing, anchors/footprints, test preview, crop conversion, mixed history, draft recovery, and Save a copy/selected-piece replacement. Verify a player-drawn table behaves like a catalog host without changing its original scene uses.
5. **Content and release hardening:** selected core/Family & Home assets, localization, accessibility, Scene Book/export, offline resources, and physical-device performance evidence. Run the full existing project check and browser release matrix.

Floor depth, tabletop placement, and preset surface authoring for custom drawings form the complete first release. If delivery must split, ship floor/wall/depth as a named partial milestone and keep tabletop support and custom authoring explicitly pending.

## 15. Alternatives and remaining design validation

| Alternative | Tradeoff | Decision |
|:--|:--|:--|
| `placement: "floor"` as one asset string | Cannot express objects usable in several places; easily confused with instance state. | Use an allowed-target array under asset rules. |
| Call every flat furniture top a floor | Hides ownership and makes avatars/furniture accidentally valid on tables. | Use named support surfaces with explicit compatibility. |
| Generic attachment plus a fixed offset | Already moves children, but does not define usable area, compatibility, or scale/flip projection. | Extend the existing graph with surface semantics. |
| Draw surface areas into the furniture PNG | Bakes guides into artwork and cannot carry semantic behavior separately. | Store invisible placement metadata in the custom prop record. |
| Freehand polygons or automatic surface detection | Adds precision demands or uncertain inferred behavior. | Start with draggable/resizable rectangle, oval, and trapezoid presets plus a test preview. |
| Full 3D or persisted world `x/y/z` | Stronger perspective and complex geometry, with substantially more art/render/export work. | Defer until a validated product need requires it. |
| Pure free collage with manual layers | Lowest effort and maximum creative freedom; no automatic placement correctness. | Retain as a supported mode and legacy default. |

The key architecture recommendation is settled by this proposal. The visual spike should determine floor seam depth, contact-shadow styling, practical footprint sizes, and snapping thresholds. The authoring pilot should validate handle usability, trapezoid taper controls, oval edge-fit precision, and whether users understand that a surface covers contact space. A later product decision can consider automatic depth scaling or seating after the floor/tabletop and custom drawing behavior has been validated.

## 16. Engineering references

These references support established rendering/transform patterns; the product-specific permissions, recovery policy, and release scope above are design recommendations for this repository.

- Godot documents ordering 2D objects by Y and keeping a child group at its parent's sort position. This supports using a floor contact as the assembly's depth reference: [CanvasItem Y sorting](https://docs.godotengine.org/en/stable/classes/class_canvasitem.html#class-canvasitem-property-y-sort-enabled).
- Parent-local coordinates and explicit local/global conversion are established tools for keeping an object on a moving support: [Node2D transforms and conversion](https://docs.godotengine.org/en/stable/classes/class_node2d.html).
- Preserving global transforms during reparenting demonstrates the continuity principle used when changing support without an unintended visual jump: [Node reparenting](https://docs.godotengine.org/en/stable/classes/class_node.html#class-node-method-reparent).

These are reference patterns, not a recommendation to adopt Godot or add a runtime dependency.


## Implementation notes — 2026-10-01

Bedroom, atelier, and cafe profiles enable constraints automatically; other
backgrounds allow free placement. There is no user Room/Free toggle. Schema 8
clears all older/unversioned device saves, artwork, drafts, backups, and preferences
before startup. Imports and backups must use the current version. This replaces
sections 11 and 14's migration requirements.

The Place on chooser, pointer constraints and acquired-support hysteresis,
support-aware host transforms and pinning, shared ordering/shadows, and Paint
preset authoring are connected. Generic descendants follow surface contents.
Group moves reject invalid offsets atomically. Missing artwork cannot provide
support. Child duplicates keep their surface; ordinary host copies omit contents,
with a separate furnished-copy action. Deleted hosts attempt floor recovery.

Panorama shrink previews complete cut-off assemblies, confirms the exact removal
count with Yes/Cancel, and commits once with undo. Retained contacts keep their
absolute position and resolve valid tile references. Pinning cannot retain items
outside the new stage. Bedroom floor geometry begins below its baseboard at 646.

Custom art retains Edit Copy. Presets can be tapped or dragged into the drawing;
numeric controls, movement/size steppers, trapezoid rear-width adjustment, retained
keyboard focus, and magnification help edit thin surfaces. The isolated lamp
preview supports host dragging and keyboard movement.

Deferred: selected-piece artwork replacement, a vase preview, occlusion-aware
pointer targeting, expanded invalid-ghost explanations, seating, nested supports,
partial furniture occlusion, and perspective scaling. The five-user pilot,
physical iPad validation, and crowded-scene frame-time measurements remain release
work. Automated checks do not substitute for those results.

Wall/floor regions already separate contact semantics while preserving one flat
background image. Separate visual layers are a later option for foreground masks
or independently styled flooring, not a prerequisite for current placement.
