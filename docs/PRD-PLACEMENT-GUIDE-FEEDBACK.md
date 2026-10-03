# PRD — Placement Guide Feedback (Drag Highlights)

**Status:** Phases 0–2 implemented (2026-10-03); user test passed (good visuals and UX); Phase 3 tray drag preview (§12.2.1) implemented, §12.2.2–12.2.3 not built; other pilot-gated items intentionally not built. See §11–§12.  
**Date:** 2026-10-03  
**Scope:** Play stage drag feedback for floor, wall, and furniture-surface placement  
**Related:** [PRD-DEPTH-AND-SURFACE-PLACEMENT.md](PRD-DEPTH-AND-SURFACE-PLACEMENT.md) · [QUALITY.md](QUALITY.md) (performance and accessibility budgets) · [DECISIONS.md](DECISIONS.md) (record as D-054 on implementation)

## 0. Relationship to the parent PRD

Placement rules, snapping (16/24 px hysteresis), ranking, commit behavior, and persistence are **unchanged**. Only presentation changes. Specific parent clauses:

| Parent clause | Status here |
|:--|:--|
| §8.1 step 3: highlight compatible regions, contact marker, legal-position ghost, short label, invalid destinations show a symbol and reason | **Amended.** Highlights, marker, and label are implemented as specified below. The **ghost is replaced** by the live item itself (it already moves to the snapped point). The **invalid-destination symbol is replaced** by the "no destination" rule in §4.1, because an invalid drop is almost unreachable. |
| §8.1 closing: "Recompute candidate geometry as the camera pans" | **Clarified, not removed.** *Candidate resolution* (pointer → logical point → target) still runs on every pan frame, as today. *Guide polygons* are in logical stage coordinates and the camera only moves the viewport, so they are not recomputed. |
| §8.2 polite status without announcing every frame | **Kept.** Announce on target change only. |
| §5.1 "Placement guides are editor-only and must not appear in saved thumbnails or PNGs" | **Kept**, extended to the marker and chip. |

## 1. Problem

While a prop or avatar is dragged, the stage shows where it can legally rest. The mechanism is correct but the presentation is hard to read, especially for the intended young audience.

Observed in `showGuide` (`js/features/play/stage-pointer-controller.js`) and `css/features/play.css` (`.placement-drop-guide`):

| # | Issue | Effect |
|:--|:--|:--|
| P1 | Every legal target is drawn at once with equal weight (floor regions, every tabletop, plus an echo outline per tabletop). | No answer to "where will it go?" |
| P2 | Dashed teal / thick brown outlines. A floor region matching the stage edge becomes a rectangle around the scene. | Reads as a debug overlay, not part of the toy. |
| P3 | The snapped target differs from the others only by dash vs. solid and 4 px vs. 5 px stroke. | The key signal is nearly invisible mid-drag. |
| P4 | The tabletop "echo" bobs with a transform animation. | Reads as jitter, not lift. |
| P5 | No label and no contact marker (parent §8.1 asks for both). Scene shadows default to off, so there is no contact cue at all. | Meaning rests on color alone; pre-readers get no cue. |
| P6 | Efficiency: `showGuide` runs on every `pointermove`, recomputing `getPlacementTargets` and `legalContactPolygon` for every target, then rewriting every polygon's `points`. `placeEntity` in the same handler computes the same targets again. | Needless work on the hottest path; geometry does not change during a drag. |

## 2. Goals and non-goals

**Goals**

1. Whenever the item is snapped to a destination, that destination is obviously "the one" and the rest are visibly secondary. When it is not snapped (§4.1), nothing falsely claims to be.
2. Each kind of support (floor, wall, furniture surface) is recognizable by shape language, glyph, and text, not color alone.
3. The player can see the contact point where the item will rest, independent of the shadows setting.
4. The preview is a promise: the highlighted target and contact point are exactly what the drop commits.
5. Per-move cost of the guide layer is near zero; no new risk to the 60 FPS drag budget on the target iPad.
6. Equal information with animations off.

**Non-goals**

- Changing what is legal, snap/release distances, ranking, or commit behavior.
- Perspective/3D rendering of guides, physics, or seating/nesting support.
- Guides in Scene Book, templates, thumbnails, or PNG export.
- Any new persisted state or schema change.

## 3. Re-evaluation of existing and previously proposed pieces

Each item is rated **Keep**, **Change**, **Cut**, **Add**, or **Optional** (built only if the pilot or measurement justifies it).

| Piece | Verdict | Reasoning |
|:--|:--|:--|
| Guide polygons in one SVG inside `#scene-world`, excluded from export | **Keep** | Already pans with the camera in logical coordinates and costs nothing in export. |
| Draw all fitting targets | **Change** | Keep, but as two states: *idle* (quiet) and *active* (the snap target). Hiding the others would hide the transfer options the player needs. |
| Dashed outline for all floor/surface polygons | **Cut** | Source of the debug look. Floor and wall idle have no stroke; surface idle has a thin solid edge; only the active target gets a strong edge. |
| `tabletop-guide-echo` polygons (bob animation) | **Cut** | Doubles node count for surfaces, animates continuously, and is the least readable part of the current design. |
| Ghost copy of the dragged item | **Cut** | `updateDragPreview` already moves the real item to the snapped point. The item is its own preview. |
| Contact marker | **Add (Must)** | Replaces the missing contact cue when scene shadows are off. A fixed-pixel HTML element (§4.4), not scaled SVG. |
| Label chip | **Add (Must)** | Required by parent §8.1 and by accessibility. One reused HTML element (§4.3). |
| Chip and marker in a **separate HUD layer above the dragged item** | **Add (Must)** | The guide SVG is `z-index: 80`; the dragged item is `999`, so cues inside the SVG would be hidden behind it. Fills stay in the SVG at 80 (subtle, below the item); the marker and chip live above 999. |
| "No destination" feedback | **Add (Must)** | See §4.1. Replaces the cut invalid red/shake styling with a defined, minimal behavior. |
| Invalid-state red tint and shake | **Cut** | A drag always resolves to the nearest legal contact point (Room) or free placement (Free), so styling for it would almost never appear. |
| Stage scrim | **Optional** | Helps contrast on busy art but adds a full-stage layer. Try without; add only if the contrast check (§6) fails. |
| Pickup ripple | **Cut** | Decoration with per-frame cost. |
| Looping "breathing" | **Cut** | Continuous repaint for no gain. |
| Pulse on the active **polygon** | **Cut** | Reviewed: it conflicted with the transform/opacity-only rule, and pulsing a region's own geometry misrepresents it. Replaced by a marker pop (§4.5). |
| Marker pop when the active target changes | **Should** | Transform-only, cheap, and the clearest "target changed" signal. |
| Drop settle on the item | **Should** | Most delight per cost; transform-only. Risk: commit re-renders the DOM, so the class is applied after render by `instanceId`. Cut it if brittle. |
| Reduced-motion parity | **Must** | Not decorative: the setting and OS preference must yield identical information. |
| Floor texture pattern | **Optional** | Pilot-gated. |
| Highlight a target while hovering a "Place on…" option | **Optional** | Separate change. |
| Keyboard-move target label | **Optional** | Revisit after the pilot. |
| `data-motion` on the guide | **Keep** | The user-selectable reduced-motion setting is stronger than the OS media query alone. |
| `stage.dataset.placementPreview` | **Keep, repurpose** | Currently set but unused by CSS. Use as the stage-level hook (`floor`, `wall`, `surface`, `available`, `none`). Confirm no test or consumer depends on the existing strings first. |

## 4. Design

### 4.1 States and when nothing is active

| State | Applies to | Look |
|:--|:--|:--|
| **idle** | Every legal target that is not the snap target. | Soft kind-colored fill at low opacity. Floor and wall: no stroke. Surface: 2 px solid edge. |
| **active** | The target the item currently snaps to. | Stronger fill; furniture surfaces also get a 3 px edge. Floor and wall have **no edge even when active**: a stroke on a floor region only boxes in the room. The marker and chip carry the emphasis. |

Explicit rules:

1. **Pickup keeps the current support active.** An item already resting on a valid target starts with that target active, marker and chip shown, exactly as `sameTarget` resolves today.
2. **Free placement has no active target.** In Free mode, or after the item leaves a support's snap range, available surfaces show as idle; the marker and chip are hidden. Entering a surface's snap range makes it active (existing 16 px acquire / 24 px release), and the chip appears.
3. **No fitting destination.** If the item uses placement drag but no target fits (too large, missing support), no guide layer is drawn and the item does not move. Show the existing `placement.invalid` message **once per drag**, when the drag begins, through the live region and toast; never per move. The existing placement is preserved on release.
4. **Release, Escape, pointer cancel, route change, capture loss:** the whole layer is removed (polygons, marker, chip) and the stage attribute cleared.

### 4.2 Shape language and names

| Kind | Hue token | Glyph | Text |
|:--|:--|:--|:--|
| Floor | `--guide-floor` (cool teal) | ground/footprint icon | `placement.onFloor` |
| Wall | `--guide-wall` (blue-violet) | frame/hook icon | `placement.onWall` |
| Furniture surface | `--guide-surface` (warm amber) | **one generic surface glyph** for all furniture surfaces | "On {name}" |

- **Surface name resolution** reuses what the Place on… chooser already does (`js/features/play/placement-controls.js`): custom `surface.name` → translated `surface.nameKey` → generic `placement.tabletop` wording. Extract that into one shared helper so chooser, chip, and announcements cannot diverge. `nameKey` identifies text only; the glyph is separate and generic.
- **Phrases are templates, not concatenation.** Add `placement.guide.onSurface` with a `{name}` placeholder in `en.js` and `tr.js` (Turkish word order and suffixes differ), and translate floor/wall via the existing keys. Key parity is covered by the existing test.
- **Announcements are longer than the chip.** The chip is short ("On Tabletop"); the live-region message uses the chooser label with the host name ("Dining table — Tabletop") so two tables are distinguishable. Long Turkish text truncates with an ellipsis on the chip but is announced in full.
- Tokens go in `css/tokens.css`. In high-contrast mode edges use the high-contrast outline token; glyph and text keep carrying the kind.

### 4.3 Label chip (HUD layer)

- One HTML element in a non-scaling **HUD overlay** appended to `#scene-world` (whose width already equals the stage width, so percentage positions map to logical coordinates). Created once per drag and reused; text and glyph change when the active target changes.
- Fixed CSS-px font, ≥ 14 px; opaque background for contrast. `pointer-events: none`; excluded from export.
- **Placement:** below the marker by default. Keep a safe margin (≥ 8 CSS px) from **all four edges of the visible viewport**, flipping above/below and shifting horizontally as needed. The visible range is the camera window (`cameraX` to `cameraX + 1600` in logical units), so clamping stays correct during panorama edge-pan. The marker is never shifted: it stays at the exact contact point.
- Measure the chip width only when its text changes, not per move; positioning per move reuses the already-computed `stageRect` and `cameraX` and does no extra layout reads.

### 4.4 Contact marker (HUD layer)

- One HTML element (an outlined ellipse ring, no fill) at the snapped contact point, in the same HUD overlay, sized in CSS px (≥ 28 CSS px wide) so it does not shrink with the stage scale on phones. Positioned by a transform update only.
- Dual-edge (light and dark) so it reads on any background. Visible when an active target exists, hidden otherwise. Independent of the Scene shadows setting.

### 4.5 Stacking

| Layer | z-order | Content |
|:--|:--|:--|
| Guide SVG | 80 (existing) | Target fills and edges: subtle, below the dragged item |
| Dragged item | 999 (existing) | Real artwork at the snapped position |
| HUD overlay | above 999 | Marker ring and chip |

A tall prop or broad base can hide much of its active surface; the marker ring and chip stay readable above it, and the item's position at the snapped point is itself the primary cue. Visual checks (§8) include tall wardrobes and broad bases.

### 4.6 Motion

One rule: **animate only `opacity` and `transform`; apply fill/stroke state changes instantly.**

| Moment | Effect | Duration | Property |
|:--|:--|:--|:--|
| Drag start | Guide layer fades in | 120 ms | opacity (whole layer) |
| Active target changes | Marker pop (scale 1 → 1.25 → 1); chip swaps text | 200 ms | transform |
| Drop (Should) | Item settles with a small scale dip and return | 180 ms | transform on `.scene-entity-visual` |
| Drag end / cancel | Layer removed immediately | 0 | n/a |

All motion is off when the reduced-motion setting is on or the OS asks for it; states then switch instantly with the same information. This parity is **Must**; the decorative motion itself is Should.

## 5. Efficiency requirements

These are release requirements, not optimizations to defer.

1. **Compute guide geometry once per drag, not per move.** At drag start, build the target list, polygon point strings, keys, and nodes. Targets do not depend on the dragged item's position (clipping is relative to the item and its attached group), and no other entity moves during a drag.
2. **Per move, do bounded constant work:** compare the new active key with the last; if it changed, toggle `data-active` on at most two polygons, update the chip, and pop the marker; always update the marker/chip positions. **No geometry computation, no node creation, and no `points` rewrites on move.**
3. **Invalidation is keyed on guide inputs, not on scene object identity.** Neither `scene/setCameraX` (dispatched every frame during edge auto-pan, creating a new scene each time) nor the preview scene returned by `placeEntity` (a new object every move) may trigger a rebuild. Rebuild only when something that determines targets changes:
   - background or stage width;
   - any **non-dragged** entity's identity-relevant fields (added, removed, moved, scaled, flipped, re-sourced, re-attached) or the dragged item's size/footprint/attachments;
   - Suggested mechanism, either of which is acceptable: compare the non-dragged entities' array element references and `backgroundId`/`stageWidth` against the committed scene (the reducer and `applyPlacement` keep unrelated entity references stable), or a store subscription that marks the guide dirty on any action other than camera actions. Pick whichever the implementation can prove correct.
4. **Avoid the duplicate computation.** The cached targets feed the guide layer. Passing them into `resolvePlacement` is **Optional**, only if profiling shows it still dominates, since it touches the domain API.
5. **Rendering rules:** no SVG filters, blur, or `backdrop-filter`; no `:has()` selectors driven by guide state (measured, §11); no animated `stroke-dasharray` or `points`; only `opacity`/`transform` animate (§4.6); no infinite animations; no `will-change` on the full-stage SVG.
6. **Node budget:** one polygon per target (down from two per surface), plus a constant-size HUD (one marker, one chip). Glyph and text children of the chip are part of that constant and are excluded from the count. The requirement is that **target count drives node count linearly, and moves never create nodes**; it is not an exact-node assertion.
7. **Budgets to meet** (40-entity scene, 4800 px panorama, 1440×900 and 375×812, and the target iPad):
   - Guide setup at drag start ≤ 4 ms.
   - Guide work per `pointermove` (excluding `placeEntity`) ≤ 0.3 ms, with no geometry or node creation.
   - No frame over 16.7 ms and no long task over 50 ms attributable to the guide layer.

## 6. Accessibility and device requirements

- Kind is conveyed by glyph and text, not hue alone. The **active** edge has ≥ 3:1 contrast against the underlying art on every placement-enabled background and on at least three Free-mode backgrounds.
- Chip text ≥ 4.5:1 on its own opaque background and ≥ 14 px; marker ring ≥ 3:1 via dual edge.
- Reduced motion (setting or OS): no animation; identical information.
- Touch: all guide, marker, and chip layers are `pointer-events: none`. The player's finger covers the contact point, so the chip sits beside/below it with the safe-margin rules, and the marker is ≥ 28 CSS px.
- English and Turkish strings for all new text, using templates (§4.2).
- Screen reader: polite announcement on target change only, using the full chooser label.

## 7. Scope and delivery

| Phase | Contents | Priority |
|:--|:--|:--|
| 0. Baseline | Record current drag frame times (40 entities, panorama) and a screenshot matrix of the current guides on every placement-enabled background. | Must |
| 1. Core | Cached geometry with input-keyed invalidation (§5.1–5.3); idle/active styles with tokens; remove dashes and echo; HUD layer with marker and chip (clamping, stacking, shared name helper, templates, announcements); state rules in §4.1 including the once-per-drag no-destination message; reduced-motion parity; stage-level `data-placement-preview`. | Must |
| 2. Polish | Marker pop; drop settle. | Should |
| 3. Pilot-gated | Scrim; floor texture; "Place on…" hover preview; keyboard label. Build only what the pilot or contrast check shows is needed. | Optional |

## 8. Acceptance

**Behavior**

- Room-mode scene with a table; item allowing floor and surface:
  - Picking up an item already on the floor shows the floor **active** (with marker and chip) and the tabletop idle.
  - Moving into the tabletop snap range makes only the tabletop active, with chip "On Tabletop"; moving back (past the 24 px release) makes the floor active again.
  - The item snaps exactly as before.
- Free-mode scene: surfaces show idle with marker and chip **hidden** until the item enters a surface's snap range; leaving it hides them again.
- Floor-only items show only floor targets; wall items only wall targets.
- No fitting destination: no guides, item stays put, `placement.invalid` is shown once per drag, and release leaves the existing placement unchanged.
- Two nearby tables: the active guide follows the table the item would actually join (the same ranking as commit); the announcement names the host.
- Release, Escape, pointer cancel, route change, and capture loss remove the entire layer, marker, and chip and clear the stage attribute.
- Panorama: guides stay aligned during edge auto-pan; the chip stays inside the visible viewport with the safe margin at all four edges (including long Turkish text); a seam-spanning floor is one target.
- Scene Book thumbnails and PNG export contain no guide, marker, or chip.

**Preview equals drop**

- Property test: for sequences of pointer moves (including overlapping surfaces, points near the 16/24 px hysteresis boundaries, and edge auto-pan), the active guide's target key and the marker's contact point equal the placement committed on release (`placement`, `attachedTo`, `x`, `y`).

**Efficiency**

- Unit test: a simulated drag of N moves builds guide geometry exactly once and creates no nodes after setup.
- Auto-pan test: a drag with many `scene/setCameraX` dispatches still builds geometry exactly once; a mid-drag change to a host entity or the background rebuilds exactly once.
- Measured budgets in §5.7 pass on the target viewports; the iPad result is recorded as release evidence, not inferred from desktop numbers.

**Tests to update**

- `test/placement-final-fixes.test.js` currently asserts the `tabletop-guide-echo` node; replace it with assertions on one polygon per target, the HUD marker and chip, and the active-state attribute.
- Existing guide-set tests (`getPlacementGuides` kinds, full-width floor boundary, size filtering) pass unchanged, since the domain logic is not modified.
- i18n key parity for the new strings; a test for the shared surface-name helper (custom name, `nameKey`, fallback).

**Visual**

- Screenshot matrix (before/after) across placement-enabled backgrounds at 1440×900 and 375×812, in light, dark/high-contrast, and with reduced motion on. Include tall props and broad-base props (marker and chip must stay readable above the dragged artwork), and chips near all four viewport edges.

**Pilot (extends the existing five-user pilot)**

- At least four of five participants can say or show where a held lamp will land without prompting, and none confuses the floor with the table.
- Add a Free-mode scene and a room with **two nearby tables**: at least four of five identify which table the item will join before releasing.
- Proposed targets, not measured results.

## 9. Risks

| Risk | Mitigation |
|:--|:--|
| Idle floor tint is invisible on some artwork. | Contrast matrix (§6); use the optional scrim before adding stroke weight. |
| Chip clipped at viewport edges or overlapping artwork. | All-edge clamp against the camera window; visual checks at 375 px. |
| Drop settle lost because the commit re-renders the item. | Apply by `instanceId` after render; cut the effect if brittle. |
| Invalidation rule misses a real change (stale guides) or fires on pans (churn). | Input-keyed rule (§5.3) with both a rebuild-once and a no-rebuild-on-pan test. |
| HUD above 999 interferes with other overlays (context ring, selection UI). | Verify stacking against `.context-ring` and the selection toolbar; the HUD is `pointer-events: none`. |
| The repurposed `placementPreview` values break a consumer. | Search tests and CSS before changing the strings; none found in CSS at the time of writing. |

## 10. Decision to record on implementation (D-054)

Placement guides use an idle/active hierarchy with a fixed-pixel contact marker and a single label chip in a HUD layer above the dragged item, instead of uniformly outlined polygons. Geometry is built once per drag and rebuilt only when its inputs change (never for camera or position-only previews). A drag ghost, invalid-state styling, ripple, looping animations, and polygon pulsing were evaluated and rejected as redundant with the live item preview, nearly unreachable, or costly without information.

## 11. Implementation notes — 2026-10-03 (Phases 0–1)

### Baseline and result

Measured in the in-app browser (Chromium, ~120 Hz display) with a 40-entity bedroom scene in Room mode, dragging a tea set across floor and tabletops with synthetic pointer events. The scripts are local and git-ignored (`scratch/guide-bench.js`, `scratch/guide-hold.js`, `scratch/seed-*.json`). Frame times need the pane visible; hidden-pane runs were discarded. These are desktop numbers: the target-iPad measurement is still release work.

| Metric | Before | After |
|:--|:--|:--|
| Guide DOM nodes during drag (14 targets) | 29 (two per surface, including echoes) | 15 (one per target) |
| Move-handler time, average | 0.22 ms | 0.20–0.22 ms |
| Move-handler time, p95 | 0.6–0.7 ms | 0.6 ms |
| Frame time, average | 11.6 ms | 10.1–10.4 ms |
| Domain cost per move (Node, 40 entities) | `placeEntity` 0.06 ms + `getPlacementGuides` 0.04 ms | `placeEntity` only; guide geometry built once per drag |

**Reading the numbers honestly:** on desktop the per-move saving is within noise, because guide recomputation was only ~0.04 ms of a ~0.2 ms handler dominated by the existing stage-rect read and the 40 style writes. The gain is structural: half the nodes, no per-move geometry or `points` writes, and headroom on slower devices. Do not describe it as a measured speedup until the iPad run.

### A measured regression that was fixed

The first version hid the selection toolbar with `body:has(#play-stage[data-placement-preview]) .context-ring`. Handler time rose to ~0.27 ms average (p95 0.9, max ~7 ms): the move handler's own layout read paid for `:has()` re-matching after every style write. Replacing it with a plain `body[data-placement-drag]` attribute restored baseline. Rule: guide-driven state must not use `:has()`.

### What shipped

- `js/features/play/placement-guide.js`: guide session (geometry once per drag, input-keyed invalidation, HUD marker and chip, clamping, announcements, marker pop).
- `js/features/play/placement-labels.js`: shared names for the chooser, chip, and announcements (custom name, then `nameKey`, then generic).
- Phase 2: the marker pop on target change (already in the guide) and a **drop settle**: a 180 ms squash on `.scene-entity-visual`, anchored at the contact point by the existing `transform-origin`. It plays only when a placement drag actually moved the piece (not on a tap) and never under reduced motion. Elements are patched rather than replaced on commit, so no after-render hook was needed.
- `stage-pointer-controller.js` delegates to the guide; the old per-move `showGuide` and the echo polygons are gone.
- New key `placement.guideOnSurface` ("On {name}" / "Yer: {name}").
- Tokens `--guide-*` in `css/tokens.css`; styles in `css/features/play.css`.
- `test/placement-guide.test.js` (9 tests): active/idle hand-off, pickup, geometry built once, no rebuild on auto-pan with exactly one rebuild when an entity changes, no-destination message, preview-equals-commit across seven drag offsets, chip clamping, announcement and reduced-motion behavior, name fallback. The old echo-node test was removed; the fake DOM in `test/placement-interactions.test.js` gained `createElement`.

### Deviations from the design above

1. **Selection toolbar hidden during placement drags.** The toolbar follows the item below its base, exactly where the chip goes, and sits at `z-index: 1100` above the HUD. It is hidden only while a guide is active (`pointer-events` were already off during drag). This is a small behavior change to the selection toolbar; revert it if the toolbar must stay visible, and move the chip above the artwork instead.
2. **Marker ring is dual-edged** (dark ring plus light outline), but polygon edges are single-color. Whether polygons need a light edge depends on the contrast matrix, which is not yet run.
3. **Floor and wall active edges removed** (see §4.1).
4. **Window resize mid-drag** is not handled: HUD pixel positions are computed from the rect passed on each move, so they self-correct on the next move; the geometry itself is logical and unaffected.

### Still open

- Phase 0 remainder: before/after screenshot matrix across all placement-enabled backgrounds and the iPad frame-time run.
- Contrast check (§6) on every background, including night scenes.
- Everything pilot-gated (scrim, floor texture, "Place on…" hover preview, keyboard label) is deliberately unbuilt until the user pilot shows a need.
- Confirm the chip's Turkish template wording ("Yer: …") with a Turkish reader.

## 12. Phase 3 — Tray props in the scene (final implementation)

> **Status (2026-10-03):** §12.2.1 is implemented; see §12.6. §12.2.2 (just-added cue) and §12.2.3 (pick-and-place) are not built.

*Raised in the first user test (2026-10-03).* Choosing a prop in the tray does not put it "in the scene": until it is dropped there is no real artwork on the stage and no guide showing where it can go. Pieces already in the scene get the full guide treatment; pieces still in the tray get none.

### 12.1 What happens today

| Path | Current behavior | Gap |
|:--|:--|:--|
| Drag a tray card | Native HTML5 drag and drop. The drag image is the tray card. The stage only gets an `is-spawn-target` highlight. Drop calls `scene/spawnProp` with `transfer: true`, and a drop on a doll attaches the prop as a held item. | No real artwork, no guides, no marker or chip before the drop. |
| Click or tap a tray card | `scene/spawnProp` immediately at a fixed point (`nextSpawnPoint`: camera + 650, 690+). The new piece is **not selected**. | The player is never shown where the piece can go, and the landing spot is not chosen by them. |
| Keyboard | Enter or Space on the card behaves like a click. | Must keep an immediate, fully accessible path. |

### 12.2 Design

The guide layer already accepts any entity: `getPlacementGuides` and `resolvePlacement` take the entity as an argument and do not require it to be in the scene. A tray prop is therefore previewed as a **virtual entity** (`instanceId: '__held__'`, the asset's default scale, `attachedTo: null`) against the committed scene. No scene mutation, no store dispatch, and no undo entry occur until the drop.

**12.2.1 Tray drag preview (Must).**

1. On `dragstart` the tray records the held asset in a module-level variable and sets a transparent 1×1 drag image. (`dataTransfer.getData` is unreadable during `dragover`, so the asset cannot be read from the event.) The existing `text/plain` payload stays, so the drop handler and its doll-attach behavior are unchanged.
2. While the pointer is over the stage, `dragover` converts the client point with the existing `stagePointAt`, calls `resolvePlacement(scene, held, point, getAsset, { transfer: true, currentTarget })`, and builds the preview entity `{ ...held, x, y, placement, attachedTo }` from the candidate.
3. The preview entity feeds the same `createPlacementGuide` session (`start` once, `update` per event), so the idle/active areas, contact marker, label chip, announcements, and invalidation rules of §4–§5 apply with no second implementation.
4. A **ghost** shows the real artwork at the snapped position: one element built with the existing scene entity view (same size, anchor, flip, and cardboard styling) with a `is-held-ghost` class that sets `pointer-events: none` and reduced opacity. It is created at drag start and moved with `--x`/`--y`.
5. Release commits through `scene/spawnProp` at the **snapped** point with the active target (extend the action with an optional `target`, as `scene/placeEntity` already has). `dragend` without a drop, Escape, leaving the stage, and route changes remove the ghost and guide layer and leave the scene untouched.
6. Drops on a **doll** keep the held-prop behavior: while the pointer is over a character, show no placement guides, snap the ghost to the existing attach offset, and show the chip "Held by {name}" (new key with a `{name}` template).

**12.2.2 Just-added cue for click or tap (Should).** After a click, tap, or keyboard add the piece is a real entity, so it already supports everything in §4. Select the new piece and show its guides and chip for about 3 seconds or until the next pointer or key event (whichever is first), with the same announcement as a drag target change. This tells the player what the piece is and where it can go with almost no new code, and it does not add a step for players who just want to add things.

**12.2.3 Pick-and-place for touch (Optional, pilot-gated).** Tapping a card arms a held piece (card `aria-pressed`) whose ghost follows the pointer over the stage; tapping the stage places it; Escape or tapping the card again cancels. It is only worth building if the pilot shows that touch players cannot drag from the tray. Until then, keep click as an immediate add, because changing it to a two-step flow would slow the most common action.

**Not in this phase:** previews for dolls and speech bubbles from the tray (dolls need a heavy canvas render for a ghost; bubbles carry no placement rules), and multi-piece trays.

### 12.3 Efficiency

1. **No work before the pointer enters the stage.** Drag start only records the asset and creates nothing heavy; the ghost and guide session are created on the first `dragover` over the stage and reused until the drag ends.
2. **Same constant per-event cost as a stage drag:** one `resolvePlacement` (about 0.06 ms in the Node measurement) plus the cached guide update. No geometry is recomputed per event (§5.1–5.3 apply unchanged); invalidation uses the same committed-scene input check.
3. **One ghost element, no store traffic, no persistence, no history.** Nothing is written until the drop. Ghost movement is a `--x`/`--y` custom-property write, as for scene pieces.
4. **Throttling is unnecessary:** `dragover` fires at most every few tens of milliseconds; if profiling disagrees, coalesce to one update per animation frame.
5. **Asset art is already cached:** the ghost reuses the shared SVG symbols and preview rendering the tray itself uses, so it does not trigger new loads.
6. The same budgets as §5.7 apply, measured while dragging from the tray over a 40-entity scene on the target iPad.

### 12.4 Acceptance

- Dragging a tray prop over the stage shows the real artwork at its snapped position, the idle/active guides, the marker, and the chip, with the toolbar hidden as in a stage drag. Nothing is added to the scene until release.
- **Preview equals drop:** for sequences of `dragover` points (including overlapping surfaces, hysteresis boundaries, and edge auto-pan) the ghost position and active target equal the entity the drop creates.
- Cancel paths (Escape, `dragend` without drop, leaving the stage, route change, scene already at the 40-entity limit) leave the entity list and undo history unchanged and remove the ghost, guide layer, and marker.
- A drop creates exactly one undo entry; undo removes the piece.
- Dropping on a doll still creates a held prop; the preview shows the chip "Held by {name}" and no placement guides.
- Free-mode backgrounds show only available surfaces, with no active target until the pointer is within snap range.
- Click, tap, and keyboard add still work without a pointer; the just-added cue announces the piece and its target once.
- Reduced motion: the ghost appears and moves identically but with no fade or marker pop.
- English and Turkish strings; the key-parity test passes.
- Unit tests for the held-asset session, preview-equals-drop, cancel paths, and the doll-hold exception; a browser check of a real tray drag.

### 12.5 Risks and open questions

| Risk or question | Plan |
|:--|:--|
| Native drag and drop is unreliable on some touch browsers. | Pilot on the target iPad. If it fails, build §12.2.3 and share the held-piece session with the stage. |
| Some browsers withhold `dragover` coordinates during a drag. | Verify on the supported browser list; fall back to a pointer-based drag from the card if needed. |
| A ghost built with the entity view needs async artwork for characters. | Props only in this phase; the ghost is created at the first `dragover`, and the shared symbols are normally already loaded. |
| Hiding the native drag image removes the only feedback if the ghost fails to render. | Keep the card's `is-dragging` state, and show the guide layer even if the ghost is late. |
| Should a plain click also arm instead of adding? | Decided against for now (§12.2.3); revisit with pilot data. |

### 12.6 Implementation notes — tray drag preview

- `js/features/play/tray-drag-preview.js` holds the session. `begin` runs on a prop card's `dragstart` and swaps the browser drag image for a transparent pixel; `over` runs on stage `dragover`; `leave` on `dragleave`; `finish` and `end` on `drop`; `end` again on `dragend` (the card can be re-rendered by the spawn, so `dragend` alone is not reliable).
- The held piece is built once with `addEntity` (same normalization as the real spawn) on a copy of the committed scene, rebuilt only when the committed entities change. Per event it runs the same `placeEntity` resolution as a stage drag, including the 16/24 px acquire/release distances.
- The guide session gained a `virtual` start option (rebuilds use the held piece, which is not in the scene) and a text-only `showNote`, used for the "Held by {name}" chip over a doll. Over a doll no targets are drawn and the drop keeps the existing held-prop path.
- The ghost is the real scene entity view (`createSceneEntity`) appended to `#scene-world`, not `#scene-entities`, so it is never hit-tested; it is `pointer-events: none`, `aria-hidden`, not focusable, and carries no instance id.
- `scene/spawnProp` accepts an optional `placementTarget`, passed to `placeEntity`, so the drop lands on exactly the previewed target even near a hysteresis boundary.
- Nothing is dispatched during the drag: no store traffic, no persistence, no history. A drop is one dispatch and one undo entry.
- Characters, bubbles and a full scene (40 pieces) keep the browser's own drag image and the previous drop behavior.
- Verified in the real browser with synthetic drag events: the real artwork follows the snapped position with guides, marker and chip; a drop onto a tabletop created a piece attached to that table's `tabletop` surface at the previewed position; a cancelled drag left no ghost, guide, marker or `body` attribute.
- Not yet measured: per-`dragover` cost on the target iPad, and native drag and drop on touch (the §12.5 risks stand).
