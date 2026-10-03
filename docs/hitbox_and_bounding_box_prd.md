# Product Requirements Document (PRD)

## Grounded Bounding Boxes & Alpha-Accurate Hit Testing

**Project:** Paper Doll Dress Up  
**Target:** Play Stage, Paint Studio, Asset Catalog, Doll Rigging, Scene Book, & Export  
**Status:** Implemented locally for v2.0.0; see [Implementation record](#12-implementation-record)
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
| Logical envelope | Position entities and broad-phase candidates | Relaxed above and beside dolls; no neutral-standing bottom padding |
| Selection marker | Identify selected artwork | Small arrow above cached painted bounds; never determines hit shape |
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

Inventory all core props through the catalog; do not rely on a hardcoded asset count. Pack props also participate in hit testing. The October 2 implementation review extends normalization to the Family & Home props because their padded canvases still produced oversized selection frames.

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
- Allow about 2–3 CSS pixels of edge tolerance around sampled artwork, independent of stage size, camera position, entity scale, flip, or pose. The tolerance must follow the artwork; it must not fill large hollow regions or rectangular padding.
- Missing artwork uses the visible placeholder as its hit target. Pending decode/mask generation must not silently make a visible entity selectable through arbitrary transparent corners; prepare masks before enabling artwork interaction.

Client-to-artwork conversion must account for responsive stage size, camera offset, entity scale, cropped viewBoxes, flipping, and pose/attachment transforms. Invalidate caches when artwork, crop, outfit, expression, or relevant render settings change; release decoded data and URLs through existing disposal mechanisms.

Native SVG geometry hit testing may replace mask sampling only where browser verification proves equivalent behavior for the supported artwork. SVG painted-area pointer behavior does not by itself guarantee alpha-threshold equivalence; see [SVG pointer events](https://www.w3.org/TR/SVG2/interact.html#PointerEventsProperty).

### 6.3 One Selection Authority

Resolve the subject before selection, drag-session creation, and pointer capture. Make the stage resolver an optional hook in the shared `PointerController`; retain existing behavior for other consumers.

Unify pointer-driven selection so the original front button's later `click` cannot override fallthrough. Shift-selection must toggle exactly once. Keyboard activation through Enter/Space must remain available without requiring pixel coordinates. Preserve multi-selection, focus semantics, drag thresholds, cancellation, pinned behavior, and background deselection.

`elementsFromPoint()` may help discover rendered candidates but must be stage-scoped, deduplicated, and followed by visibility testing. Temporarily disabling one button is not a complete resolver. If pointer-events styles are changed, restore them in `finally` and never synthesize recursive pointer events.

## 7. Selection Indication

The October 2 selection-display follow-up supersedes the rectangular-frame requirement. Use a small downward arrow above the cached painted extent of each selected entity. It must follow visual flips, attachment transforms, and doll root motion without changing artwork geometry or intercepting pointers. Keep keyboard focus visible with the same marker and a distinct focus color.

Actions follow the selected artwork, centered below its neutral painted bounds, in an overlay outside stage clipping. Stage edges do not constrain them. Keep a 12px window margin, flip above when there is insufficient bottom space, and avoid covering the minimap or transport controls. Leave room for the selection arrow when above. Preserve horizontal scrolling, focus restoration, all actions, and live drag/camera following. Hide the toolbar when the selected artwork is outside the visible stage/window or clipped by the main scroller. The logical envelope remains available for placement and broad-phase filtering, independently of the marker and final alpha hit test.

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
| FR-9 | Selection indication | Arrow identifies artwork; following actions may cross stage edges but stay inside the window |
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
9. Selection uses a small arrow above each selected artwork rather than a rectangular frame. Actions follow the artwork and live drag/camera movement, staying centered below it until window margins require shifting or flipping above. The toolbar can overflow the stage without changing scene clipping. Keyboard focus remains visible, narrow action rows scroll, and the minimap stays accessible.
10. In a scene at the existing maximum entity count, pointer-down resolution remains responsive on the tested desktop and touch browser. Record cold-load and warm-cache timing during browser verification; assets are not decoded again during dragging, and caches are released on disposal.

## 12. Implementation Record

### 12.1 Where the contract lives

| Concern | Module |
| :--- | :--- |
| Contact, envelope, artwork transform | [character-geometry.js](../js/domain/character-geometry.js), used by `getEntityBounds()`, the stage, Scene Book, and both export paths |
| Alpha threshold, crop bounds, masks | [alpha-mask.js](../js/core/alpha-mask.js) (`ALPHA_THRESHOLD = 15`) |
| Stage resolver and mask cache | [stage-hit-testing.js](../js/features/play/stage-hit-testing.js), wired through the `resolveSubject` hook of [pointer-controller.js](../js/core/pointer-controller.js) |
| Catalog metadata | `footContact` on dolls, `soleContactY` on core and pack shoes, trimmed prop `viewBox` values in [asset-catalog.js](../js/core/asset-catalog.js) |

Native SVG hit testing is not used. Every candidate is tested against rendered-alpha masks.

### 12.2 Measured contacts

Measured from rendered alpha (threshold 15, 4× supersampling, strokes included), in doll authoring units.

| Fit family | Bare-foot contact | Compatible shoes (sole bottom) |
| :--- | :--- | :--- |
| Teen | Classic A 410, Joy 410 | sneakers 413, sandals 412, ballet 412.25, rain boots 412.25, boots 413, loafers 417.75, oxfords 419, Family & Home sleep slippers 412.5, party shoes 412.5 |
| Child | Chibi 400 | sneakers 404, rain boots 401.75, Family & Home strap 399.5, cloud 399.5 |
| Baby | Baby 368 | booties 370, sandals 370, sneakers 371, Family & Home bunny 367.25, bear 367.25 |
| Adult | Adult 414.5 | boots 413, loafers 417.75, oxfords 419, Family & Home canvas 418.5 |
| Elder | Elder 411 | boots 413, loafers 417.75, oxfords 419, Family & Home moccasin 418.5, felt 418.5 |

The neutral contact is the larger of the doll's value and the shoe's; for example Baby with bunny slippers stays at 368.

All supported hair, hats, and clothing stay within `x 64.75…235.25` and `y ≥ 0.75` in neutral, so the envelope `0, 0, 300, contact` contains them. No garment reaches below `y 395`.

### 12.3 Intentional appearance changes

- Floor props without authored contact previously floated above the floor by their letterbox margin (for example 15 display units for the armchair). They now rest on the floor at unchanged visual size.
- Table, bookshelf, and bench support surfaces had been authored against the 1000-unit artwork but projected onto the non-square display box. They are remapped into the trimmed viewBox, so held props now sit on the visible tabletop, shelf top, and bench seat.
- The wall frame keeps its exact position and shadow (`groundAnchor.y = 406/737`).
- The cardboard-finish stand ends at the contact plane for dolls and the two papercraft props.
- Root motion now pivots on the foot contact instead of the canvas corner (Scene Book) or the canvas bottom (stage).

### 12.4 Verification (desktop Chromium, 1440 × 900; tablet 768 × 1024; mobile 375 × 812 with touch pointers)

- Neutral feet meet the plane exactly at `y = 750` in PNG export and Scene Book for classic/sneakers, baby/booties, adult/oxfords, bare-foot chibi, elder/pack slippers, and a custom full-doll raster (measured contact 430). Stage rendering places the measured contact on the envelope bottom within 0.01 px.
- Trimmed core props render identically through standalone SVG and `<symbol>`/`<use>` (0.000 px bounding-box difference for all 22).
- Mask hits are a superset of browser-painted geometry (zero misses; 97.4–99.97 % agreement, differences being anti-aliased stroke edges at alpha ≥ 15) for trimmed core props and untrimmed pack props.
- Fall-through: through two transparent entities to a third; a hollow custom PNG; transparent bubble corners; flipped dolls; a 40-unit jump with rotation; a raised arm, both where it is drawn and where it rested; a head rising above the envelope. Results were the same with the camera panned on a 3200-unit stage and at all three viewport sizes.
- Input: a drag starting on a front doll's transparent area moves the prop behind it. Shift toggles exactly once per press. Enter activates a focused entity. Double-clicking a bubble opens its editor through the resolver.
- Timing at the 40-entity limit: pointer-down resolution plus selection dispatch takes 0.2–0.4 ms median and 1.7 ms max. Cold masks cost about 3.5 ms per prop, 9 ms per doll (six channels), and 5 ms per bubble. A warm re-prepare of 23 entities takes 0.1 ms.
- Rigid-safe clips in the current UI animate only root and head. Limb channels were verified by driving the same CSS joint variables the animation service writes.

### 12.5 Related fixes

- Raster layers referenced by object URLs are inlined before SVG-to-bitmap decoding, so custom full dolls and custom wearables appear in PNG export.
- Mask decoding uses load events rather than `HTMLImageElement.decode()`, which can stay pending while a page is hidden.

### 12.6 Implementation review — October 2, 2026

- Normalized all 40 Family & Home props using rendered-alpha bounds at 2× authoring resolution, with one authoring unit of clearance. Catalog and SVG viewBoxes agree. Display dimensions retain each prop's previous uniform meet-fit scale; default suggested anchors now meet the cropped bottom.
- Remapped authored anchors, contact footprints, and support polygons from their original 1000 × 1000 space. Crops expand where authored geometry requires it rather than clamping metadata. This also corrects support projection through the former letterboxed display boxes.
- Wired the stage symbol registry to the effective asset catalog so pack props share symbols as core props do.
- Character masks now composite channel alpha before applying threshold 15, retain faint channel pixels, include expression and intensity in cache keys, and sample separate eye masks with the live blink scale.
- Stage controls bypass selection and deselection. Drag conversion uses the same border-adjusted content rectangle as hit testing.
- Custom contact measurement is shared by Play, Scene Book, and export, so opening a saved scene preview or exporting it first does not depend on Play having already decoded its custom doll or footwear.
- Chrome verification compared standalone and nested symbol alpha for all 62 built-in props with no differences. Remaining excess rectangular padding on pack props is below 4%, including required anchor clearance. Real pointer checks cover transparent fallthrough, one Shift toggle, Enter activation, touch taps, pinned behavior, stage-control selection preservation, pointer capture and exact drag movement, focus on overflowing artwork, root motion, and expression cache invalidation.

The browser verification above covers the reviewed fixtures; physical iPad and the full release acceptance matrix remain separate release checks.

### 12.7 Hit-testing correction — October 2, 2026

- Kept the existing cached alpha/channel masks and inverse live CSS transforms. Added a 2.5 CSS-pixel disk tolerance with bounded samples every half pixel. It follows transformed artwork, including overflow, and does not expand selection rectangles. Very small gaps within the tolerance can intentionally select their nearby edges; large holes and padding still fall through.
- Cached visual, motion, and eye-style references when preparing descriptors, avoiding repeated descendant queries while resolving a pointer. Pointer movement still performs no mask decoding, rasterization, or canvas readback. At 40 overlapping layered dolls, Chromium resolved a transparent point in 2 ms median and 5.4 ms maximum in the regression run; mask build counts did not change.
- Preserved original doll layer SVG roots, inherited fill/stroke/opacity, and authoring viewports in the compositor. Raster layers are inlined once before channel rasterization instead of being removed and drawn outside their SVG clipping/opacity context. No doll authoring canvas, clothing coordinates, pivots, or placement metadata was cropped or resized.
- Character mask keys now include custom-art content revisions and whether the face uses baked artwork. Ordinary recolors and pose changes reuse masks. Failed mask preparation now displays the existing unavailable-artwork placeholder explicitly, so it cannot silently leave visible art with a rectangular hit target. Failed cache promises can retry without deleting a newer build.
- Removed repeated clipping inside shared prop symbols; the instance viewport remains the clip. This prevents nested fractional clips from attenuating visible edge strokes. Actual screenshots of all 62 built-in props agree with standalone rendering, with only bounded antialias rounding differences (mean channel difference below 0.15/255, maximum at most 16/255).
- Added unit regressions for CSS-sized tolerance, holes/corners, shared decoding, artwork revisions, baked-face invalidation, explicit failure placeholders, and symbol clipping. Added the isolated real-browser suite `npm run test:hit-testing-browser`, backed by `scripts/verify-hit-testing-browser.mjs` and `test/fixtures/hit-testing-browser.html`. It uses a locally available Playwright installation; `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can point to an existing bundled runtime without changing project dependencies.
- Chromium fixtures passed at 1440 × 1000, 768 × 1024, and 375 × 812: shared SVG stroke/empty-area selection, raster padding and hollow interiors, two transparent foreground candidates, camera offsets, raised and flipped limbs outside the frame, vacated limb positions, full raster and layered dolls, speech-bubble editing, one Shift toggle, multi-selection dragging, Enter/Space, native touch taps/cancellation, capture, drag coordinates, pinned behavior, and stage-control selection preservation. Safari/Firefox and physical-device checks remain release verification work.

### 12.8 Selection display follow-up — October 2, 2026

- Replaced selection and multi-selection rectangles with small downward arrows above cached painted bounds. Alpha preparation collects these extrema once; markers add no decoding, rasterization, readback, or per-frame measurement. Props account for letterboxing; dolls retain the original canvas and place their marker inside the root motion transform. The anchor uses neutral channel extents, so it does not chase individual animated limbs or head motion.
- Docked the context toolbar to the bottom center of the visible stage instead of re-aligning it around entity bounds. Removed above/below and left/right switches and world-space ring coordinates. Kept existing actions, horizontal scrolling, action focus, multi-selection, and drag dismissal. Raised the minimap above the toolbar. Keyboard focus uses a blue arrow and forced-color mode uses the system highlight.
- Added regressions for padded raster and layered-channel marker geometry, toolbar position at all edges with camera offsets, minimap clearance, multi-selection markers, keyboard activation and retained action focus/scroll. Actual Chromium screenshots were inspected at desktop and phone sizes; the pointer/SVG regression suite remains required.

### 12.9 Following toolbar — October 2, 2026

- Replaced the temporary bottom dock with a body-level fixed overlay. It centers beneath cached neutral painted bounds, follows preview positions, size, flip, attachment transforms and camera changes, and can cross clipped stage ancestors. Window margins constrain it; it flips above when needed and avoids the minimap. Multi-selection anchors to the visible selected members. Joint animation does not bounce the toolbar around.
- Cached layout and toolbar dimensions on selection/layout changes. Pointer previews reuse the existing stage rectangle; toolbar updates perform no DOM geometry measurement, mask decoding, rasterization, or readback. During drag the same toolbar stays visible and ignores pointer input. Resize/scroll refresh its layout; invisible selections hide it, and leaving Play removes it and its observers/listeners.
- Preserved action focus/scroll and bound keyboard shortcuts directly to the overlay. Deferred artwork focus cannot steal focus from the toolbar or a newer selection. Added unit coverage for artwork extents, flips/attachment rotation, window margins and minimap avoidance, plus browser regressions for overflow, live dragging, touch actions, window-bottom flipping, resizing, camera panning, scroll hiding/restoration and route cleanup.

### 12.10 Input review — October 3, 2026

- **Exact artwork outranks edge tolerance.** `resolve()` takes the foremost exact hit first and only then retries with the 2.5 CSS-pixel fringe. A front entity's fringe can no longer take a click from visible pixels of an entity behind it; a near miss with nothing exact under the pointer is still forgiven.
- **The stage owns the whole gesture.** `PointerController` takes pointer capture on the stage at press instead of on the resolved subject at the drag threshold. Move, release and cancel therefore always reach it, even when the first move or the release is outside the stage, and touch fall-through (where the browser targets the transparent foreground but the resolved subject is behind it) no longer hands capture from one element to another. Capture loss counts only when the stage itself loses it, and a press by the same pointer after a lost release cancels the stale session instead of being ignored.
- **One authority for artwork revisions.** `js/domain/artwork-revision.js` reads a custom asset's revision from the shape the registry actually exposes (`metadata.sha256`), falling back to a flat `sha256`/`updatedAt`. Mask keys, the scene entity render key and measured ground contacts all use it, so replacing artwork under the same asset ID (import replace, backup restore) rebuilds the element and its mask. Contact measurements remember the revision they measured; a new revision reads as unmeasured until measured again, and in-flight measurements are keyed by revision. `measureCharacterContacts` takes the same `getAsset` the caller later passes to `getCharacterContact`.
- **Input maps through the rendered camera.** The world eases toward `scene.cameraX`, so selection, drag start/preview and palette drops read the offset it is drawn at (`renderedCameraX`, equal to the stored camera at rest) instead of the destination.
- **Drops resolve hosts by artwork.** Palette drops use the same hit tester and content rectangle as pointer selection (`stagePointAt`), so a prop dropped near a table's transparent corner no longer attaches to it.
- **Bubbles occupy the box they draw.** `measureBubble` is the single source for the SVG, the hit mask and entity bounds; the bounds cache is keyed by it, because wrapped height depends on the words rather than the length.
- Regressions: `test/hit-testing-input.test.js` uses real registry descriptors and each case was confirmed to fail against the old behavior. The browser suite adds a native touch fall-through that commits, a release outside the stage followed by a normal click, clicks while the world is frozen mid-ease, and tolerance-versus-exact-artwork ordering. The browser fixture now uses the registry's descriptor shape. Two full-app toolbar checks now allow the few pixels by which asymmetric painted art differs from the body-center marker.
- **Hover cursor follows visible artwork.** Entity buttons no longer set a cursor (it was `grab` over transparent corners where a press falls through). `stage-hover-cursor.js` sets `data-cursor` on the stage from the same hit test a press uses: `grab` over visible, unpinned artwork; the normal cursor over transparent space, pinned art and stage controls; `grabbing` for the whole drag, since the stage owns pointer capture. Cost: pointer moves only record a position; at most one hit test runs per animation frame, only for mouse/pen, never during a drag; the DOM is written only when the result changes; touch does no work. Props also reject points outside their painted bounds (flip, attachment and letterboxing aware, widened by the tolerance) before sampling the mask, which also speeds up presses: a miss over 60 props went from 0.63 ms to 0.11 ms in a Node benchmark. A grid test confirms the early reject never changes a result.
- Not changed: a larger touch tolerance.
