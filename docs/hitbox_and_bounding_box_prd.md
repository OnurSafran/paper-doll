# Product Requirements Document (PRD)

## Grounded Bounding Boxes & Alpha-Accurate Hit Testing

**Project:** Paper Doll Dress Up  
**Target:** Play Stage, Paint Studio, Asset Catalog, Doll Rigging, Scene Book, & Export  
**Status:** Revised implementation specification; geometry spike required before rollout  
**Release Target:** v2.0.0 (Unreleased Milestone)  
**Compatibility Model:** Clean-slate reset for obsolete pre-v2 data; version authority is unified under APP_VERSION ('2.0.0')

---

## 1. Goals and Scope

The application currently positions dolls and many props using authoring canvases that include transparent padding. This separates visible feet from contact shadows and lets rectangular entity buttons intercept clicks on empty artwork space.

This release must:

- Align neutral standing dolls and default floor props with their contact plane without clipping shoes, hair, clothing, or arms.
- Preserve comfortable head and side envelopes and existing artwork proportions.
- Select and drag the foremost visible entity at a pointer coordinate, passing through transparent artwork to entities behind it.
- Crop saved Paint Studio props using a consistent alpha threshold while preserving authored placement metadata.
- Keep Play Stage, Scene Book, still exports, and animated exports geometrically consistent.
- Reset obsolete pre-release projects once rather than migrate their scene coordinates.

Contour-shaped selection outlines, automatic removal of opaque stray dots, and a new foot-planting or inverse-kinematics system are outside this release. Bounding boxes, contact geometry, and hit regions serve different purposes and must not be conflated.

## 2. Verified Existing Behavior

These are implementation constraints, not new features:

- Character assets and wearable layers use a `300 × 450` authoring space. Current stage dimensions are `235 × 352.5`, giving a uniform scale of `235 / 300`.
- Stage entity buttons and character canvases currently use a `2 / 3` aspect ratio. Character rig pivot percentages are derived from the full authoring dimensions.
- Feet differ across doll families and footwear. `Y = 410` is an approximate classic-doll reference, not a universal contact measurement. Bézier control points do not establish the visible extrema; strokes also contribute.
- Paint Studio already crops props through `computeNonTransparentBounds()` and remaps authored anchors, contact footprints, and support polygons through `cropPaintPlacement()`.
- Built-in stage props render through an SVG symbol registry and `<use>` instances. The asset loader validates each SVG viewBox against catalog metadata.
- Selection currently occurs both on pointer down and in entity button click handlers.
- `APP_VERSION` is `2.0.0`; version authority is unified under `APP_VERSION` (`SCHEMA_VERSION` is aliased to `APP_VERSION`). Boot already awaits `resetObsoleteProject()` when loading reports a reset is required.

Relevant existing code: [character rendering](../js/features/designer/designer-view.js), [entity view](../js/features/play/scene-entity-view.js), [pointer input](../js/core/pointer-controller.js), [symbol registry](../js/core/svg-symbols.js), [paint crop](../js/features/paint/paint-raster.js), [placement remapping](../js/features/paint/paint-placement-model.js), and [project reset](../js/services/project-repository.js).

## 3. Geometry Contract

### 3.1 Separate Geometry Roles

| Geometry | Purpose | Required behavior |
| :--- | :--- | :--- |
| Authoring canvas | Align body, clothes, face, and rig pivots | Retain existing `300 × 450` doll coordinates |
| Visual bounds | Describe rendered artwork extent | Include visible strokes and relevant clipping/masking |
| Selection envelope | Position the rectangular frame and broad-phase candidates | Relaxed above and beside dolls; no neutral-standing bottom padding |
| Hit region | Decide pointer selection | Follow visible artwork, excluding contact shadows and UI decorations |
| Contact point and footprint | Place entities and validate floor/surface support | Preserve authored placement semantics independently of visual bounds |

Use one shared geometry calculation for rendering, bounds, clamping, shadows, previews, and exports. Extend existing geometry helpers rather than introduce competing calculations in each view. Cache inputs must include any doll, footwear, or artwork changes that affect geometry.

### 3.2 Character Scale and Ground Contact

Preserve the current base artwork scale, `s = 235 / 300`, independently of selection-envelope width. Do not resize a doll merely to narrow its click or selection box.

Let `(contactX, contactY)` be the neutral standing contact reference in authoring coordinates. The unposed mapping into stage coordinates is:

```text
stageX = entity.x + entity.scale × s × (authoringX - contactX)
stageY = entity.y + entity.scale × s × (authoringY - contactY)
```

Horizontal flipping and existing pose/attachment transforms must compose consistently around the chosen reference. A neutral contact point maps to `(entity.x, entity.y)`.

For illustration only, a verified contact at `410` and a top envelope edge at `0` gives `410 × 235 / 300 = 321.1667` logical units of height. This is not a fixed height for every doll. A `210 × 321` viewport is not proportional to `300 × 410` and must not be used to scale the artwork.

Determine contact from the rendered neutral foot/shoe region, including strokes, using authored metadata where available and calibrated measurement otherwise. Shoes must be evaluated with their base doll. Do not use the lowest pixel of unrelated clothing or accessories as a foot contact. Use the lowest visible support edge of the standing feet/shoes for vertical contact and the authored horizontal reference, centered by default.

For full custom raster dolls without foot channels, use the bottommost qualifying artwork pixel and a centered horizontal reference as the documented fallback. An empty custom drawing has no measurable contact and must use the existing unavailable-artwork placeholder behavior.

### 3.3 Envelope and Rendering

- Derive the doll envelope from neutral visual bounds plus head/side clearance validated against supported hair, hats, skirts, and motion ranges. End its neutral bottom at the measured foot contact.
- Do not hardcode the original `2 / 3` ratio on a derived envelope. Set dimensions or their derived ratio consistently.
- Render the full authoring canvas at uniform scale, offset relative to contact, within the envelope. Permit intended motion overflow; do not crop every layer at `Y = 410`.
- Keep layer alignment and rig pivots in the original authoring space. Designer and Paint Studio guides retain their existing coordinates.
- Geometry discovery must not visibly shift entities after selection or drag begins. Resolve initial geometry before making artwork interactive; keep missing-artwork behavior explicit.

`viewBox` is an SVG attribute, not a CSS declaration. Viewport fitting and percentage coordinates must follow the [SVG coordinate specification](https://www.w3.org/TR/SVG2/coords.html). Changing a stage envelope must not silently change authoring-layer coordinate systems.

### 3.4 Motion and Shadows

The neutral contact reference is stable during playback. Walking, jumping, root rotation, and leg motion may deliberately move visible feet away from that reference; do not recalculate contact every frame and cancel that motion.

Contact shadows remain anchored to the placement plane using the existing shadow model. Neutral standing feet must meet that plane. This release does not require dynamic jump-shadow effects or foot planting. Animated artwork and its hit region must still agree at the sampled time.

## 4. Catalog Prop Normalization

Inventory all core props through the catalog; do not rely on a hardcoded asset count. Verify pack props also participate in hit testing, although bulk pack recropping is outside this release.

For each core prop:

1. Measure the painted visual extent, including strokes. Default `getBBox()` alone is insufficient for stroke bounds. Use a verified stroke-aware measurement or rendered-alpha scan; inspect effects separately so decorative shadows do not define physical contact.
2. Trim the SVG viewBox without removing visible artwork. Update the catalog `viewBox` simultaneously so loader validation and symbol rendering remain valid.
3. Derive display dimensions with uniform scaling. Preserve current visible artwork size where the existing mapping is uniform. If an existing asset is distorted, calibrate it individually and record the intentional appearance change.
4. Remap authored anchors, support polygons, and authored contact footprints into cropped coordinates. Preserve wall anchors and asymmetric contact references. Use bottom-center only for props with no authored contact reference.
5. Verify standalone SVG rendering and the nested SVG/`<symbol>`/`<use>` path have identical bounds and appearance.

For an original viewBox `(vx, vy, vw, vh)` and crop `(cx, cy, cw, ch)`, convert an original normalized point `(u, v)` as:

```text
uNew = (vx + u × vw - cx) / cw
vNew = (vy + v × vh - cy) / ch
```

Authored normalized footprint width/depth scale by `vw / cw` and `vh / ch`. Leave default suggested footprints to the existing placement policy. Do not silently clamp authored placement metadata that falls outside the crop; expand the crop to preserve valid authored geometry or flag the asset for calibration before shipping.

SVG distinguishes object and stroke bounding boxes; see the [bounding-box specification](https://www.w3.org/TR/SVG2/coords.html#BoundingBoxes).

## 5. Paint Studio Alpha-Threshold Cropping

Extend the existing crop path rather than replace it.

- Use a shared `ALPHA_THRESHOLD = 15` on the `0…255` alpha scale for crop measurements and raster hit testing.
- Compute extrema from pixels with `alpha >= ALPHA_THRESHOLD`; width and height include the last qualifying pixel (`max - min + 1`).
- Copy the original pixels inside the crop unchanged. Thresholding measures geometry; it must not erase low-alpha pixels inside the saved image.
- Reject a prop save with a clear localized empty-artwork message if no pixel qualifies. Keep the canvas and draft available for editing.
- Retain `cropPaintPlacement()` remapping and preserve authored anchors, footprints, and support surfaces. Bottom-center and wall-center are defaults for untouched suggested anchors.
- Use the same threshold in placement previews and final save so geometry does not change between them.
- Keep wearable/full-doll save formats and authoring dimensions unchanged.

An opaque stray dot still expands the crop. Connected-component cleanup is outside scope because it could remove intentional dots, sparkles, or detached parts. Document that artwork entirely below the threshold is treated as empty for this feature.

## 6. Stage Hit Testing and Input

### 6.1 Resolution Rules

Resolve selection within the stage, in the same front-to-back order used by rendered entities, including attachment/depth ordering:

```text
pointer coordinate
  → ignore stage UI controls
  → collect eligible entity candidates in rendered order
  → map coordinate through each candidate's inverse visual transforms
  → test artwork visibility
  → choose first visible hit, or invoke existing background deselection
```

Continue through any number of transparent candidates. Do not query through context menus, picker controls, or other interactive overlays. Pinned entities remain selectable according to current behavior and remain non-draggable. Speech bubbles participate using their rendered artwork.

Broad-phase candidate bounds must include artwork that overflows its relaxed envelope during motion. Do not reject a visible animated hand solely because it is outside the positioner's rectangle.

### 6.2 Visibility and Sampling

A hit corresponds to composited artwork alpha at or above the threshold. Include fills, strokes, raster layers, visibility, clipping, masks, and supported opacity effects. Exclude selection frames, badges, contact shadows, guides, and context controls from artwork masks.

- Static PNG props: decode once and cache alpha data; map the coordinate into source pixels. A one-pixel canvas sample is acceptable only after correct source-coordinate mapping and asset decoding.
- Static SVG props: support both ordinary SVG and `<use>` instances. Cached rendered alpha is the preferred common path; event-target tag names do not establish pixel visibility.
- Dolls: include base artwork, clothing, face, and custom raster layers. Match the current root, head, limb, flip, and attachment transforms. A cached neutral whole-doll mask alone is insufficient during animation.
- Reuse existing render/motion inputs. Establish animated mask correctness in a bounded prototype before choosing a per-layer or composed-mask implementation. Do not read back or rasterize every entity on every pointer move.
- Missing artwork uses the visible placeholder as its hit target. Pending decode/mask generation must not silently make a visible entity selectable through arbitrary transparent corners; prepare masks before enabling artwork interaction.

Client-to-artwork conversion must account for responsive stage size, camera offset, entity scale, cropped viewBoxes, flipping, and pose/attachment transforms. Invalidate caches when artwork, crop, outfit, expression, or relevant render settings change; release decoded data and URLs through existing disposal mechanisms.

Native SVG geometry hit testing may replace mask sampling only where browser verification proves equivalent behavior for the supported artwork. SVG painted-area pointer behavior does not by itself guarantee alpha-threshold equivalence; see [SVG pointer events](https://www.w3.org/TR/SVG2/interact.html#PointerEventsProperty).

### 6.3 One Selection Authority

Resolve the subject before selection, drag-session creation, and pointer capture. Make the stage resolver an optional hook in the shared `PointerController`; retain existing behavior for other consumers.

Unify pointer-driven selection so the original front button's later `click` cannot override fallthrough. Shift-selection must toggle exactly once. Keyboard activation through Enter/Space must remain available without requiring pixel coordinates. Preserve multi-selection, focus semantics, drag thresholds, cancellation, pinned behavior, and background deselection.

`elementsFromPoint()` may help discover rendered candidates but must be stage-scoped, deduplicated, and followed by visibility testing. Temporarily disabling one button is not a complete resolver. If pointer-events styles are changed, restore them in `finally` and never synthesize recursive pointer events.

## 7. Selection Frame

Use a rectangular frame around the selection envelope; a contour outline is not required. Keep comfortable top/side clearance for dolls. Its neutral bottom edge must align with the contact plane, without the current uniform negative inset extending it below the feet. Focus indication must remain clear and accessible.

Prop frames follow their cropped rectangular bounds. Hollow interiors and diagonal corners remain transparent for pointer selection even though they are inside the frame.

## 8. Storage Reset Boundary

Use `APP_VERSION = '2.0.0'` as the sole version authority (`SCHEMA_VERSION` is unified with `APP_VERSION`). Application SemVer is the authoritative compatibility boundary.

- Retain the clean-start reset policy for missing, unversioned, legacy integer schemas (<= 8), or pre-v2 saves (`< 2.0.0`), guaranteeing all user data is cleared on v2.0.0 release.
- Accept valid `APP_VERSION = '2.0.0'` envelopes without wiping them on later boots.
- Preserve existing handling of unsupported future versions; do not classify them as obsolete and destructively reset them.
- Await custom-art reset, application-owned localStorage cleanup, and fresh-envelope persistence before opening views or restoring drafts. Preserve the existing application storage-key scope.
- On reset failure, expose the existing blocking error/reload path. Do not continue with a mixture of old geometry and new defaults. Retry must be safe after a partial reset.
- Honor existing storage-unavailable behavior; inability to read storage is not evidence that a saved project is obsolete.

No coordinate migration is required for this unreleased boundary. Do not change unrelated portability validation or settings policies as part of this task.

## 9. Functional Requirements

| ID | Requirement | Success condition |
| :--- | :--- | :--- |
| FR-1 | v2.0.0 clean start | Obsolete pre-v2 data resets once; valid v2.0.0 projects survive reload |
| FR-2 | Neutral foot grounding | Measured feet/shoe support edge meets placement plane without clipping |
| FR-3 | Shared geometry | Stage, Scene Book, and export use equivalent scale/contact mapping |
| FR-4 | Relaxed envelopes | Supported hair, hats, clothing, and motion remain visible |
| FR-5 | Paint threshold crop | Threshold-15 extrema and existing authored metadata remapping agree |
| FR-6 | Catalog normalization | SVG/catalog viewBoxes, dimensions, and placement geometry agree |
| FR-7 | Visible-artwork selection | Transparent regions fall through all overlapping candidates |
| FR-8 | Input preservation | Keyboard, touch, shift-selection, capture, and cancellation still work |
| FR-9 | Grounded frame | Neutral selection-frame bottom meets contact plane |
| FR-10 | Bounded sampling | Masks are reused and invalidated correctly; drag does not repeatedly decode artwork |

## 10. Implementation and Verification Plan

1. **Geometry and hit-test prototype:** verify one classic doll, one baby doll, sneakers, a hollow `<use>` prop, and custom raster art, including one animated limb and a flipped entity. Establish a shared contact mapping and mask strategy before destructive schema rollout.
2. **Character rendering and shared geometry:** update bounds, stage sizing, shadows, pivots, Scene Book, and exports together. Verify proportions, family contacts, outfit changes, and neutral/animated rendering agreement.
3. **Catalog normalization:** update asset files and catalog/placement metadata together. Run asset validation and visually verify table support placement and wall props.
4. **Paint crop:** update threshold, empty handling, and preview/save consistency. Verify authored anchors, footprints, and support polygons survive cropping or produce an explicit existing validation error.
5. **Stage input integration:** centralize pointer selection and implement candidate visibility testing. Verify fallthrough, keyboard activation, multi-selection, touch, capture, and cancellation in a browser.
6. **Schema boundary and release integration:** bump schema only after geometry is ready. Verify reset/reload/failure cases and update existing service-worker/cache manifests for changed production files using repository tooling.

Run focused unit tests for geometry, crop, remapping, candidate selection, and reset. Browser verification is required for real SVG rendering, `<use>`, event ordering, transforms, and pointer capture; Node tests alone cannot prove these behaviors. Complete `npm run check` and a visual regression pass before release.

## 11. Acceptance Criteria

1. In a neutral standing pose at logical `entity.y = 750`, every supported base-doll/compatible-footwear fixture meets the placement plane within one CSS pixel at the tested viewport; no shoes or strokes are clipped. Verify bare feet and custom full-doll fallback too.
2. Artwork retains uniform scale and correct layer alignment. Large hair/hats, wide skirts, arm swings, and jumping remain visible; intended motion is not canceled by frame-by-frame contact correction.
3. Play Stage, Scene Book, and still/animated exports agree on contact mapping and proportions at matched pose samples. Contact shadows meet neutral support edges on floor and surface placements.
4. Transparent outer corners and internal holes fall through at least three overlapping entities. Test custom PNGs, symbol props, layered dolls, bubbles, flips, camera movement, responsive sizes, and animated overflow. Fully transparent artwork areas never select an entity solely because its frame contains the point.
5. A fallthrough pointer selects/drags the resolved entity and is not overridden on release/click. Shift toggles once; touch thresholds, drag cancellation, keyboard activation, and pinned behavior remain correct.
6. Paint fixtures with alpha values 0, 14, 15, and 255 produce inclusive threshold-15 bounds. Empty/subthreshold props remain editable after save rejection. Authored anchors, footprints, and support surfaces retain placement meaning after cropping.
7. Core SVG assets load through normal and symbol paths with matching catalog viewBoxes. Cropping preserves strokes, aspect ratio, calibrated visual size, wall anchors, and valid table support placement.
8. Pre-v2 projects (including schema <= 8 and unversioned data) reset storage and custom artwork before views open. A valid v2.0.0 project survives repeated boots. Exercise reset failures, partial-reset retry, unavailable storage, and future-version handling without an unintended wipe.
9. Selection remains rectangular and clear; the neutral doll frame bottom aligns with the contact plane while top/side margins remain comfortable.
10. In a scene at the existing maximum entity count, pointer-down resolution remains responsive on the tested desktop and touch browser. Record cold-load and warm-cache timing during browser verification; assets are not decoded again during dragging, and caches are released on disposal.
