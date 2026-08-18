# Code Review — Issue Status

Reviewed against `docs/ARCHITECTURE.md`, `docs/ASSETS.md`, `docs/DECISIONS.md`, `docs/QUALITY.md`.

- **Date**: 2026-08-19
- **Baseline**: `npm run check` → 315 pass, 0 fail
- **Status**: all tracked Designer, Paint, and Play review findings are fixed; issue details below are retained for traceability

Severity key: **P1** correctness/contract violation · **P2** accessibility, performance, or doc divergence · **P3** consistency and hygiene

## Current disposition

Completed:

- **Designer**: D-1, D-2, D-3, D-4, D-5, D-6, D-7, D-8, D-9, D-10, D-11, D-12, D-13, D-14, D-15
- **Paint**: P-1, P-2, P-3, P-4, P-5, P-6, P-7, P-8, P-9, P-10, P-11, P-12, P-13, P-14, P-15, P-16, P-17, P-18, P-19, P-20, P-21, P-22, P-23, P-24, P-25, P-26
- **Play**: PL-1 to PL-20, and the PLR-1 regression
- **Localization follow-up**: I-07 addressed through localized Play controls, accessible names, bubble defaults, and asset placeholders.
- **UI follow-up**: moved the Scene Tray, Templates, and Outline into the left Play rail; renamed Voice Puppetry to Voice / Seslendir.

Remaining:

- **Designer**: none
- **Paint P2**: none
- **Paint P3**: none
- **Play**: none
- **Localization follow-up**: I-14 is closed; all 87 built-in wearables now have `assets.*` labels in both locales.

Verification pass 2026-08-19 re-checked all twenty findings against source: sixteen held, four did not, and one of those had introduced a new P1 (PLR-1). All four plus PLR-1 were closed the same day and re-verified at runtime. See "Verification — 2026-08-19" and "Remediation — 2026-08-19" at the end of this document.

Batch completed:

- **Play Batch 1**: PL-1, PL-9, PL-11 — panoramic single-entity clamping now uses the active stage width; vertical wheel scrolling passes through; tray clicks spawn relative to `cameraX`. Added regression coverage in `test/panoramic-stages.test.js` and `test/feature-views.test.js`.
- **Play Batch 2**: PL-2, PL-3 — Scene Outline uses per-style bubble labels and the injected effective asset resolver for custom props. Added regression coverage in `test/runtime-and-drag-fixes.test.js`.
- **Play Batch 3**: PL-8, PL-10, PL-12 — context-ring actions restore focus, browser modifier shortcuts are ignored, and pinned keyboard moves show localized feedback. Added regression coverage in `test/runtime-and-drag-fixes.test.js`.
- **Play Batch 4**: PL-4, PL-5, PL-6, PL-14, I-07 — Play reducer messages, tray/entity/outline/bubble accessible names, bubble preset copy/defaults, camera labels, missing-key fallback, and asset placeholders are localized in Turkish and English.
- **Play Batch 5**: PL-7 — entity position/scale/z-order/flip updates patch existing DOM nodes; background and spawn-tray rendering are gated by relevant signatures. Added render contract coverage and verified the full suite.
- **Play Batch 6**: PL-15, PL-16, PL-17, PL-18, PL-19, PL-20 — Play uses injected selectors, named viewport constants, optional DOM guards, a documented single-focus path, and concurrent background panel loading. **PL-13 did not land**: `createPlayView` gained the `getAssetsByKind` parameter but `app.js` never passes it, so Play fell back to the built-in catalog and lost custom props entirely (PLR-1).

Batch completed in this pass:

- **Play**: PL-6, PL-7, PL-15, PL-16, PL-17, PL-18, PL-19, PL-20; `I-07`; PL-4 and PL-5 partially
- **Verification**: `npm run check` → 312 pass, 0 fail. The suite passing does not cover PLR-1, PL-4, PL-5, or PL-14 — see the verification section.

The completed IDs describe the fixes now present in the codebase; the remaining IDs are the active backlog. The original issue sections below may describe pre-fix behavior and are not themselves status markers.

---

## Designer — `js/features/designer/designer-view.js`

| ID | Sev | Issue | Location |
|:--|:--:|:--|:--|
| D-1 | P1 | Custom wearables vanish under the `unsorted` style filter | `designer-view.js:313-317` |
| D-2 | P1 | Incompatible items render as nothing instead of a fit-warning placeholder | `designer-view.js:154-157` |
| D-3 | P1 | Accessory layer bypasses the fit-compatibility check | `designer-view.js:145` |
| D-4 | P1 | Face assets skip compatibility filtering entirely | `designer-view.js:452` |
| D-5 | P2 | Focus is destroyed on nearly every selection (swatches, cards, pills, models, presets) | `designer-view.js:231`, `:301`, `:487`, `:536` |
| D-6 | P2 | Every dispatch rebuilds every Dollbox preview | `designer-view.js:605` |
| D-7 | P3 | Custom-art `<svg><image>` builder duplicated verbatim | `designer-view.js:66-80`, `:165-178` |
| D-8 | P3 | Custom-art URL fallback API is asymmetric between the two render paths | `designer-view.js:163` |
| D-9 | P3 | `previewCustomColor` queries `document` directly, bypassing injected `$` | `designer-view.js:203-209` |
| D-10 | P3 | Wardrobe slot list duplicated three times instead of using `WARDROBE_SLOTS` | `designer-view.js:360`, `app.js:414` |
| D-11 | P3 | Dead `'skin'` branch in the click-to-unequip guard | `designer-view.js:344` |
| D-12 | P3 | `applyMouthExpression` imported from a service into a feature view (layer inversion) | `designer-view.js:12` |
| D-13 | P3 | `renderPalettes` dereferences DOM nodes with no null guard, unlike its siblings | `designer-view.js:498-522` |
| D-14 | P3 | `--hair-color` written on every asset preview, including garments and props | `designer-view.js:87` |
| D-15 | P3 | Misindented `img.alt` assignment | `designer-view.js:63` |

### D-1 — Custom wearables vanish under the `unsorted` style filter (P1)

Built-ins are filtered by `getOfferedWearables` (`asset-catalog.js:206`), which explicitly treats "no `presentationStyles`" as *unsorted*:

```js
return w.presentationStyles?.includes(styleFilter)
  || (styleFilter === 'unsorted' && (!w.presentationStyles || w.presentationStyles.length === 0));
```

The custom-asset branch in `renderWardrobe` re-implements that filter and drops the clause:

```js
(activeStyle === 'all' || asset.presentationStyles?.includes(activeStyle))
```

`customAssetToDescriptor` (`asset-registry.js:27`) *omits* `presentationStyles` entirely when the source array is empty, so every piece of player-painted art with no style tag is invisible in the one filter meant to surface untagged items. The fit check diverges too: the catalog defaults an unknown doll to `'teen'`, the inline copy defaults to "allow everything".

**Fix direction**: extend `getOfferedWearables` to accept custom descriptors, or export a shared `matchesDiscoveryFilters(asset, fitFamily, style)` and call it from both paths.

### D-2 — Incompatible items render as nothing (P1)

D-031 states incompatible references "stay recoverable but render as fit-warning placeholders until the player switches back or removes them." `renderDollInto` instead does `if (incompatible) return null;`, and no fit-warning affordance exists anywhere in `js/`, `css/`, or `index.html`.

**Lived behavior**: dress a Teen doll, switch to Baby → the garment stays in `draft.slots`, `#outfit-count` still counts it, the wardrobe card is filtered out of the tray, and the doll silently loses the layer. The only signal is a transient status message (`app-store.js:546`).

**Fix direction**: render `makeAssetPlaceholder` for incompatible layers (it already exists and is used by the catch path), or amend D-031. Doc and code must not disagree.

### D-3 — Accessory bypasses the compatibility check (P1)

`bottom`/`shoes`/`top`/`dress` go through `addWearableLayer`, which computes `isWearableCompatible`. Accessory is pushed directly with no `incompatible` flag, so an accessory that does not fit the current body renders anyway. The arguments are otherwise identical to what `addWearableLayer('accessory', 80)` would produce.

### D-4 — Face assets skip compatibility filtering (P1)

`facesByGroup(selectedGroup)` ignores fit family even though `isFaceCompatible` exists (`outfit-rules.js:132`) and face assets carry `supportedFitFamilies`. Latent only because all 19 face assets currently declare all five families — the first baby-specific eye asset will be offered for the Elder model.

### D-5 — Focus destroyed on selection (P2)

`docs/ARCHITECTURE.md` requires collections to "restore focus when the focused item remains"; J-08 claims a passing keyboard-only loop. Tabs honor this (`focusedTabId` + rAF restore at `:284` and `:441`). Nothing else does:

- **Swatches** (`:231`) — selecting any skin/hair/garment/iris color dispatches, `renderPalettes` calls `replaceChildren`, focus falls to `<body>`. `renderSwatches` also never calls `bindRovingKeydown`, so each palette is 8+ tab stops rather than one roving composite — inconsistent with the tabs and pills beside it.
- **Style pills** (`:301`) — the arrow-key path restores focus via `bindRovingKeydown`; the click/Enter/Space path does not.
- **Asset cards**, **model picker buttons** (`:487`), **Dollbox mini-actions** (`:536`) — no restoration at all. Equipping a garment by keyboard drops the user back to the top of the document.

**Fix direction**: one helper applied before every `replaceChildren` in the module — capture `document.activeElement`'s stable identity (`dataset.assetId` / `dataset.style` / swatch token, all already present), re-focus the matching new node under the existing token guard.

### D-6 — Dollbox rebuilt on every dispatch (P2)

`render()` unconditionally calls `renderDollbox`, which rebuilds all preset rows and fires `renderDollInto` for each. At the documented 50-preset limit that is ~50 × up to 10 layers ≈ 500 async layer builds *per color swatch click*. `loadAssetSvg` caches parsed templates (`svg-loader.js:3`) so nothing refetches, but the clone and DOM churn are real, and it also discards preset-row focus (D-5).

**Fix direction**: gate on a cheap signature (preset ids + names + `revision`) so the Dollbox rebuilds only when presets actually change. Most likely of these findings to be visible on the target iPad.

### D-7 through D-15 — consistency and hygiene (P3)

- **D-7**: the nine-`setAttribute` custom-art `<svg><image>` builder appears twice verbatim. Extract `createCustomArtSvg(url)`.
- **D-8**: `renderDollInto` accepts `customArtRepo` *or* `options.getCustomArtUrl`; `appendAsset` accepts only the former. Two ways to reach custom art, one working in half the module.
- **D-9**: `previewCustomColor` hardcodes `document.querySelectorAll('#doll-stage ...')` while every other DOM access uses the injected `$`/`$$` that keeps the module testable.
- **D-10**: `WARDROBE_SLOTS` is the declared authority, but `:360` hardcodes the same six-slot array and `app.js:414` hardcodes a five-slot variant. Use `WARDROBE_SLOTS.some(([s]) => s === selectedSlot)`.
- **D-11**: `!['skin', 'hair'].includes(asset.slot)` — `'skin'` is not in `OUTFIT_SLOTS` (`vocabulary.js:22`) and no wearable can carry it. `'hair'` is intentional and deserves a comment explaining why hair alone is not click-to-remove.
- **D-12**: `applyMouthExpression` is imported from `services/export-service.js` into a feature view. The dependency rules put services downstream of views; a pure SVG-mutation helper on the render path belongs in `core/` or `domain/`, with export consuming it from there.
- **D-13**: `renderPalettes` dereferences `$('#hair-palette')`, `$('#piece-palette')`, `$('#custom-color')` with no null check while `renderWardrobe`/`renderFace` bail early when their containers are missing. A missing node throws mid-render and aborts the stage update below it.
- **D-14**: `appendAsset` writes `--hair-color` on every preview container, including garments and props, from the garment's own primary color. Harmless today; a token written where it has no meaning.
- **D-15**: `img.alt` is indented two spaces short of its block.

### Suggested order

1. D-1, D-3, D-4 — contained, each needs one new test.
2. D-6 — self-contained perf gate.
3. D-2 — needs a UI affordance and a decision on whether to amend D-031.
4. D-5 — separate pass; touches every render path in the module.
5. D-7 through D-15 — hygiene sweep.

---

## Paint — `js/features/paint/`

Files: `paint-view.js` (2329 lines), `paint-raster.js` (367), `paint-session.js` (306), `paint-guides.js` (97).

Same failure patterns as Designer appear here (duplicated slot/viewBox tables, focus and re-render churn), plus a broken tool path, a silently-reduced undo depth, and a large untranslated-string surface.

| ID | Sev | Issue | Location |
|:--|:--:|:--|:--|
| P-1 | P1 | Select tool pointer drag is dead code — guard returns before every select branch | `paint-view.js:923` |
| P-2 | P1 | Undo depth is ~15 steps (wearable) / ~8 (prop), not the advertised 20 | `paint-session.js:14-15,109` |
| P-3 | P1 | `updateLivePreview` rebuilds a canvas + clones the doll SVG on every pointermove, unguarded and unthrottled | `paint-view.js:1272-1329` |
| P-4 | P1 | Untranslated user-facing strings across status, confirms, ARIA, and canvas guide labels | multiple, see below |
| P-5 | P1 | Button labels derived by string-surgery on unrelated translations; "Use" button reads "Reset" | `paint-view.js:1889` and 5 others |
| P-6 | P1 | 13 native `alert()` / `confirm()` calls instead of the accessible dialog infrastructure | `paint-view.js`, 13 sites |
| P-7 | P1 | `commitSave` has no double-submit guard, contradicting failure-matrix F-06 | `paint-view.js:1404` |
| P-8 | P2 | `imageDataChanged` compares 2.16 MB byte-by-byte on every commit | `paint-view.js:810-818` |
| P-9 | P2 | Reference model picker exposes 5 of 6 dolls; `doll_classic_b` silently masked | `paint-guides.js:4-10`, `paint-view.js:296` |
| P-10 | P2 | Failed permanent delete rolls back via the global `app/undo` stack | `paint-view.js:2170` |
| P-11 | P2 | Space paints at the virtual cursor while a toolbar button has focus | `paint-view.js:1054` |
| P-12 | P2 | Zoom control is labeled `2×` but applies a 1.5 scale | `paint-view.js:253,1149,1560` |
| P-13 | P2 | Custom wearables are locked to exactly one fit family | `paint-view.js:1440` |
| P-14 | P2 | `refreshLanguage` calls `showModal()` on an already-open dialog | `paint-view.js:2318` |
| P-15 | P2 | 19 `innerHTML` assignments, several interpolating values | `paint-view.js`, 19 sites |
| P-16 | P3 | `fitCutoutSvg` declared at column 0 inside another function body | `paint-view.js:372-409` |
| P-17 | P3 | `SLOT_PREVIEW_VIEWBOX` duplicated verbatim from `designer-view.js` | `paint-view.js:37-43` |
| P-18 | P3 | Doll-id and slot lists duplicated a third and fourth time | `paint-session.js:16-17`, `paint-guides.js:4` |
| P-19 | P3 | `mirrorAxisX` is dead API; the `× 2` backing factor is hardcoded ~14 times | `paint-session.js:279`, `paint-view.js` |
| P-20 | P3 | `REFERENCE_MODELS` and `guideIsInBounds` are exported but used only by tests | `paint-guides.js:4,87` |
| P-21 | P3 | `session.setName` bypasses `validateArtworkName` | `paint-session.js:212` |
| P-22 | P3 | English-only inline pluralization inside a localized dialog | `paint-view.js:2046,2064` |
| P-23 | P3 | `setTimeout(…, 50)` used to focus dialog inputs | `paint-view.js:1398,2122` |
| P-24 | P3 | Clear wipes the canvas with no confirmation while Replace confirms | `paint-view.js:1573` |
| P-25 | P3 | `setSlot` marks the session dirty on a pristine canvas | `paint-session.js:129-137` |
| P-26 | P3 | Global `keydown` listener is never removed; no teardown path | `paint-view.js:1518` |

### P-1 — Select tool pointer drag is dead code (P1)

`handlePointerMove` opens with:

```js
if (!isPointerDown || !lastPointerPos) return;
```

`lastPointerPos` is assigned in exactly one place in `handlePointerDown` (`paint-view.js:898`), inside the branch guarded by `if (!['brush', 'eraser', 'shape'].includes(state.tool)) return;`. The `select` branch returns earlier (`:878-895`) and never sets it.

**Consequence**: for `tool === 'select'`, `handlePointerMove` returns on the first line every time, so the `'select-rect'` and `'select-move'` branches below it are unreachable via pointer. A drag creates only the zero-area rect built at pointerdown (`normalizeSelectionRect(coords, coords)`), and `handlePointerUp` then captures a 0×0 selection. Marquee selection and selection dragging do not work with a mouse, pen, or touch.

The keyboard path still works: `Enter` builds a fixed 80×80 logical box at the virtual cursor (`:1059-1068`) and arrows move it. So the tool is reachable but only by keyboard, which is likely why this was not caught.

**Coverage**: `test/paint-ui.test.js` contains no `selectionRect` or pointer-select assertions.

**Fix direction**: set `lastPointerPos = coords` in the select branch, or drop `lastPointerPos` from the guard and check it only inside the brush/eraser branch that actually uses it.

### P-2 — Undo depth is well below the advertised 20 steps (P1)

`paint-session.js` declares `MAX_HISTORY_STEPS = 20` and `MAX_HISTORY_BYTES = 32 * 1024 * 1024`, and `trimHistory` evicts while *either* bound is exceeded, counting `undoStack.length + redoStack.length` against the step cap.

History entries are full-canvas `ImageData`:

| Item type | Backing canvas | Bytes per snapshot | Snapshots within 32 MB |
|:--|:--|--:|--:|
| Wearable | 600 × 900 | 2,160,000 | ~15 |
| Prop | 1000 × 1000 | 4,000,000 | ~8 |

The byte cap always binds before the step cap, so the effective undo depth is ~15 for wearables and ~8 for props — and it shrinks further as redo entries accumulate, since both stacks share the same 20-step and 32 MB budgets. Nothing surfaces this to the player; undo simply stops going back.

**Fix direction**: either document the real depth, or store diffs / dirty-rect patches instead of full-frame snapshots. Note the same snapshots are allocated twice per stroke (once for `pendingHistorySnapshot`, once inside `imageDataChanged`), so this interacts with P-8.

### P-3 — Live preview rebuilt from scratch on every pointer move (P1)

`handlePointerMove` calls `updateLivePreview()` on each brush, shape, and select-move event. Each call:

1. clears `previewStage` via `innerHTML = ''`,
2. `await`s `svgLoader.load(baseDollId)` and **clones the full doll SVG**,
3. allocates a **new 600×900 (or 1000×1000) `<canvas>` element**,
4. `drawImage`s the whole authoring canvas into it.

At pointer-event rates this allocates a multi-megabyte canvas and a fresh SVG clone per frame, against a stated budget of "60 FPS goal (≤ 16.7 ms frame time)" and "no sustained task > 50 ms".

It is also racy. `previewStage.innerHTML = ''` runs *before* the await, but `previewStage.appendChild(dollWrap)` runs *after* it, and there is no render token (unlike `renderGuideLayer`, which has `guideRenderToken`). Several in-flight calls each append their own `dollWrap`, so the preview stacks duplicate layers until the next call clears them.

**Fix direction**: build the preview canvas and doll clone once, then reuse them — a per-move `drawImage` into an existing canvas is the only work that actually needs to happen at pointer rate. Add a render token for the async doll load, and throttle to animation-frame cadence as the stage pointer controller already does.

### P-4 — Untranslated user-facing strings (P1)

The module localizes most strings through `t()`, which makes the gaps easy to miss. Confirmed untranslated, player-visible text:

- **Replace-cutout confirmation** (`:537`) — `confirm('Replace the current artwork with this cutout? You can Undo afterward.')`. QUALITY.md CP-19 tracks this exact prompt as a Gate 4 browser-matrix item.
- **Cutout statuses** (`:534`, `:538`) — `'That cutout is unavailable for the current slot.'`, `'Artwork kept unchanged.'` — surrounded by `t()` calls on every other line of the same function.
- **Canvas ARIA label** (`:274-278`) — the entire screen-reader description of the canvas, including the raw English tool id (`Tool: ${state.tool}`) and `'Use pointer input or Arrow keys and Space to paint.'`
- **Palette ARIA** (`:212`, `:232`) — `Color ${hex}`, `Active color: … Click to open color picker.`
- **Alignment guide labels drawn on the canvas** (`paint-guides.js:21-63`, rendered at `paint-view.js:686`) — `Head contour`, `Crown`, `Hairline`, `Left ear`, `Shoulders`, `Bust`, `Waist`, `Hem range`, `Knee`, `Hip`, `Ground`, `Left ankle`, `Left foot`. These are `<text>` nodes painted over the doll in the Turkish UI.
- **Reference model labels** (`paint-guides.js:5-9`) — `Baby`, `Child`, `Teen`, `Adult`, `Elder`, duplicating the `lifeStages.*` keys the Designer already uses.
- **Default artwork names** (`paint-session.js:90,133`) — `` `My ${slot}` ``, `'My Prop'`.
- **Fallbacks** — `'Custom artwork'`, `'Untitled'`, `'Untitled scene'`, `'Recovered Art'`, `'Wearable'`, `'Prop'`.

### P-5 — Labels derived by string surgery on unrelated translations (P1)

Six sites build a label by stripping the leading emoji off some *other* translated string:

```js
t('projectDialog.restoreBackupBtn').replace(/^[^\s]+\s*/, '')
t('projectDialog.addMergeBtn').replace(/^[^\s]+\s*/, '')
t('play.saveCopyBtn').replace(/^[^\s]+\s*/, '')
t('paintRenameDialog.title').replace(/^[^\s]+\s*/, '')
t('paint.propTypeBtn').replace(/^[^\s]+\s*/, '')
t('paint.defaultCutoutLabel').split(' ')[1] || 'Kalıbı'   // hardcoded Turkish fallback
```

This breaks whenever a translation's wording, word order, or emoji placement changes, and it couples unrelated dialogs to each other's copy.

One case is already wrong. At `:1889` the My Art "use this artwork" button is built as:

```js
useBtn.innerHTML = asset.kind === 'wearable' ? '👗 ' + t('designer.reset') : …
```

`designer.reset` is `'Sıfırla'` / `'Reset'` (`i18n.js:56,720`), so the button that equips a saved wearable is labeled **"👗 Sıfırla" ("👗 Reset")**.

**Fix direction**: give each label its own key.

### P-6 — Native `alert()` and `confirm()` (P1)

10 `alert()` and 3 `confirm()` calls. The app already ships an accessible dialog path (`askConfirm`, used throughout Designer) and QUALITY.md claims `<dialog role="alertdialog">` semantics across the accessibility matrix. Native dialogs are unstyled, untranslatable, block the main thread, and on iPad standalone PWA render as browser chrome outside the app shell. Several fire while a `<dialog>` is already modal (`commitSave` validation, rename validation).

Sites include name-validation failure, save failure, remove/delete/restore/empty-trash failures, `pixelsNotFound`, `editCopyFailed`, the cutout replace confirm, permanent-delete confirm, and empty-trash confirm.

### P-7 — No double-submit guard on save (P1)

`commitSave` generates a fresh `assetId` (`custom_${defaultMakeId()}`) on each invocation and awaits `canvasToBlob` → `computeSha256` → `saveArtwork` → `store.dispatch`. Nothing disables `saveMyArtBtn` / `saveContextBtn` / the form, and no in-flight flag exists. Two quick activations produce two IndexedDB records and two store entries for one drawing.

F-06 in the failure matrix asserts "Debounced handlers prevent duplicate spawns, duplicate saves, or re-entrant export tasks." The paint save path does not implement that.

`flushDraftCheckpoint` has the same shape — no in-flight guard on overlapping `saveDraft` calls.

### P-8 through P-15 — correctness, performance, and contract gaps (P2)

- **P-8**: `imageDataChanged` allocates a full `getImageData` and walks all 2,160,000 bytes one at a time (`i += 1`), on every stroke commit, selection edit, clear, and cutout rasterization. A `Uint32Array` view would cut iterations 4×; comparing only the dirty rect would cut them far more.
- **P-9**: `REFERENCE_MODELS` lists 5 dolls and omits `doll_classic_b`, while `REFERENCE_DOLL_IDS` accepts 6 and `MODEL_TRANSFORMS` defines transforms for 6. `updateUIFromState` then masks the difference: `referenceModel.value = state.baseDollId === 'doll_classic_b' ? 'doll_classic_a' : state.baseDollId`. A session restored with `doll_classic_b` shows "Teen (A)" selected. D-033 and the QUALITY.md Gate 4 row both claim guides "for all 6 base doll models".
- **P-10**: when `deleteArtwork` fails after the metadata dispatch succeeded, `handleDeletePermanently` rolls back with `store.dispatch({ type: 'app/undo' })`. That pops whatever is on top of the global undo stack, which is not guaranteed to be this delete. Compare `handleRemoveFromMyArt`, which correctly compensates with an explicit `restoreFromTrash`.
- **P-11**: `handleKeyDown` skips only `INPUT`/`TEXTAREA`/`SELECT`/`contentEditable`, so `case ' '` paints a dab at the virtual cursor even when a `<button>` has focus — and the browser also activates that button. Every Space press on a tool button both switches tools and paints.
- **P-12**: `zoomBtn.textContent` shows `🔍 2×` while `--paint-zoom` is set to `'1.5'` (three sites). The control magnifies 1.5×, not 2×.
- **P-13**: `commitSave` sets `supportedFitFamilies = [referenceDoll.fitFamily]` — a single family taken from whichever reference body was active while painting. Custom art is then invisible in the Designer for all five other life stages, with no UI hint at paint time that the choice is permanent. Worth an explicit decision, given D-033 presents custom hair as a general wearable.
- **P-14**: `refreshLanguage` re-invokes `openImpactDialog(activeImpactAsset)` while the dialog is open, which calls `showModal()` on an already-modal dialog. Current browsers return silently; older WebKit throws `InvalidStateError`. Re-render the contents without re-opening.
- **P-15**: 19 `innerHTML` assignments, several interpolating values (`thumbWrap.innerHTML = \`…🎨 ${t(…)}\``, `li.innerHTML = \`<span>👗</span> <span>${t(…)}</span>\``). All are app-controlled strings today, so this is not a live injection, but it is the one pattern the strict SVG/asset trust boundary in ASSETS.md exists to avoid, and neighbouring code in the same functions already builds nodes properly with `textContent`.

### P-16 through P-26 — structure and hygiene (P3)

- **P-16**: `fitCutoutSvg` is a complete function declaration written at **column 0 in the middle of `loadCutoutsForSlot`'s body** (`:372-409`), with the outer function resuming at `:411`. It parses because declarations hoist, but it reads as a broken merge. It also carries a fourth slot-viewBox table (`tightViewBoxes`) whose values differ from both copies of `SLOT_PREVIEW_VIEWBOX`.
- **P-17**: `SLOT_PREVIEW_VIEWBOX` in `paint-view.js:37-43` is byte-identical to the one in `designer-view.js:29-36`. Two copies, one concept.
- **P-18**: doll ids are now listed in three places (`asset-catalog`, `REFERENCE_DOLL_IDS`, `REFERENCE_MODELS`) and wearable slots in four (`OUTFIT_SLOTS`, `WARDROBE_SLOTS`, `WEARABLE_PAINT_SLOTS`, plus the inline array at `designer-view.js:360`). ARCHITECTURE.md requires persisted enums to have one definition in `domain/vocabulary.js`. The same applies to the tool, shape, prop-size, prop-placement, and zoom lists, each duplicated between `createPaintSession`'s initializer and its own setter.
- **P-19**: `createPaintSession` exposes `mirrorAxisX` (`logicalWidth / 2`) and nothing consumes it; the view instead writes `axisX: (session.logicalWidth / 2) * 2` at eight call sites and `state.brushSize * 2` at six, each with a `// scale factor 2` comment. `createAuthoringCanvas` already parameterizes `scaleFactor`. Derive one `backingScale = canvas.width / session.logicalWidth`.
- **P-20**: `REFERENCE_MODELS` and `guideIsInBounds` are exported from `paint-guides.js` but referenced only from `test/`. `guideIsInBounds` in particular encodes a real invariant that production never enforces.
- **P-21**: `session.setName` accepts any value, including non-strings and over-length names; `validateArtworkName` is applied only at the dialog boundary. Validate at the model edge.
- **P-22**: `` `(${p.count} use${p.count === 1 ? '' : 's'})` `` and the matching `item${…}` build English plurals inline in the otherwise-localized Impact dialog.
- **P-23**: `setTimeout(() => nameInput?.focus(), 50)` after `showModal()`, in two dialogs. Focus synchronously after `showModal()`, or use the dialog's own autofocus.
- **P-24**: the Clear button wipes the canvas immediately, while Replace-with-cutout confirms first. For the stated audience the asymmetry is backwards.
- **P-25**: `setSlot` sets `dirty: true` unconditionally, so opening Paint and changing the slot dropdown on a blank canvas triggers the unsaved-changes dialog on exit.
- **P-26**: `createPaintView` registers `window.addEventListener('keydown', handleKeyDown)` and returns no teardown. Currently harmless (constructed once at bootstrap, and the handler checks `screen.contains(...)`), but the module otherwise models cancellation carefully (`cancelAsyncOperations`, render tokens), so this is the one dangling lifetime.

---

## Cross-cutting

Issues appearing in both sections, worth fixing once rather than twice:

| Theme | Designer | Paint |
|:--|:--|:--|
| Duplicated slot / doll / viewBox tables | D-10 | P-16, P-17, P-18 |
| Focus lost after `replaceChildren` re-render | D-5 | P-3 (preview), My Art grid |
| Full-collection rebuild on every change | D-6 | P-3 |
| Native dialogs vs. `askConfirm` | `window.prompt` in `renderDollbox` | P-6 |
| Untranslated user-facing strings | — | P-4, P-5, P-22 |
| Custom-asset filtering / fit-family handling | D-1 | P-13 |
| Doc claims not met by code | D-2 (D-031), D-5 (J-08) | P-2, P-7 (F-06), P-9 (D-033) |

## Suggested next order

1. **P-4, P-5, P-6** — localization, labels, and accessible dialog infrastructure.
2. **P-2, P-10, P-13** — history, delete rollback, and custom-art fit-family contracts.
3. **P-15, P-16, P-17, P-18, P-19** — Paint safety and duplicated-domain-data cleanup.
4. **P-20, P-22, P-23, P-24, P-26** — remaining Paint invariants, localization polish, confirmation, and teardown.
5. **D-12** — move the shared mouth-expression helper out of the export service dependency path.

---

# Verification Pass — 2026-08-18

Re-checked all 41 findings against the current working tree.

- `npm test` → **292 pass, 0 fail** (was 287; +5 tests)
- `node --check` clean on all four touched modules
- **39 of 41 fully resolved.** 2 partial. 4 new issues introduced by the fixes.

## Confirmed fixed

**Paint — all 26.** Spot-checked evidence:

| ID | Evidence |
|:--|:--|
| P-1 | `lastPointerPos = coords` now set in the select branch (`paint-view.js:894`) |
| P-2 | `MAX_HISTORY_BYTES` 32 MB → 96 MB; the 20-step cap now binds first for both wearables (44 fit) and props (24 fit) |
| P-3 | Canvas and doll clone are cached across calls; SVG reloads only when `baseDollId` changes; `livePreviewToken` guards the async append |
| P-4 | All named strings localized; guide labels resolved through `GUIDE_LABEL_KEYS` → `paint.guideLabels.*` in both locales |
| P-5 | Zero `replace(/^[^\s]+\s*/, '')` / `split(' ')[1]` sites; the "Reset"-labeled equip button is gone |
| P-6 | `alert(` → 0, `confirm(` → 0 |
| P-7 | `saveInFlight` flag with `finally` release |
| P-8 | `Uint32Array` word comparison with a byte-tail loop |
| P-9 | `REFERENCE_MODELS` deleted; `REFERENCE_DOLL_IDS` moved to `domain/vocabulary.js`; all 6 options in the markup; `doll_classic_b` masking removed |
| P-10 | `app/undo` rollback removed |
| P-11 | `if (e.key === ' ' && e.target?.closest?.('button, [role="button"]')) return;` |
| P-12 | `--paint-zoom` now `'2'` at all three sites |
| P-13 | `supportedFitFamilies = [...FIT_FAMILIES]` |
| P-14 | `if (!impactDialog.open) impactDialog.showModal()` |
| P-15 | `innerHTML` → 0 |
| P-16 | `fitCutoutSvg` hoisted to module scope (`:45`) |
| P-17 | Extracted to `js/core/preview-viewboxes.js`, imported by both views |
| P-18 | `WEARABLE_PAINT_SLOTS = OUTFIT_SLOTS`; doll ids centralized |
| P-19 | `backingScale()` helper; zero `// scale factor 2` comments remain |
| P-20 | `guideIsInBounds` now filters in production (`:669`) |
| P-21 | `setName` runs `validateArtworkName` and returns a boolean |
| P-22–P-26 | Pluralization localized; focus `setTimeout` hacks gone; Clear confirms via `askConfirm`; `setSlot` dirty derived from actual history; `destroy()` removes the keydown listener |

**Designer — 13 of 15 fully, 2 partial.** `matchesDiscoveryFilters` shared with the catalog (D-1); accessory and all five face layers compatibility-checked (D-3, D-4); `createCustomArtSvg` extracted (D-7); `getCustomArtUrl` symmetric (D-8); `previewCustomColor` takes an injected query (D-9); dead `'skin'` branch gone (D-11); `applyMouthExpression` moved to `core/mouth-expression.js` (D-12); `renderPalettes` null-guarded (D-13); stray `--hair-color` removed from previews (D-14); indentation fixed (D-15).

## Partial

**D-5 — focus restoration.** Seven collections now capture and restore focus (swatches, wardrobe tabs, style pills, wardrobe cards, face tabs, face cards, model picker). The Dollbox mini-actions are still not covered: renaming or deleting a preset rebuilds the list and drops focus to `<body>`. Mostly masked by D-6's gate, but rename and delete are exactly the cases that invalidate it.

**D-10 — slot list duplication.** The Designer's inline copy is gone. `app.js:443` still hardcodes `['top', 'bottom', 'dress', 'shoes', 'accessory']` for the "is dressed" check. That list intentionally excludes `hair`, so it may be deliberate — worth a comment either way.

## New issues introduced by the fixes

| ID | Sev | Issue | Location |
|:--|:--:|:--|:--|
| N-1 | P1 | Dollbox thumbnail goes stale after "Update preset" | `designer-view.js:556-560` |
| N-2 | P2 | Dollbox text does not re-translate on language switch | `designer-view.js:556-560` |
| N-3 | P2 | New untranslated English string in the fit-warning placeholder | `designer-view.js:157` |
| N-4 | P3 | Two indistinguishable "Teen" options in the reference model picker | `index.html:403-404` |

### N-1 — Dollbox thumbnail goes stale after "Update preset" (P1)

The D-6 render gate keys on:

```js
const signature = JSON.stringify({
  revision: state.presetsRevision ?? state.revision ?? null,
  presets: state.presets.map(({ presetId, name }) => [presetId, name])
});
if (signature === dollboxSignature) return;
```

Neither `state.presetsRevision` nor `state.revision` exists in the store (`grep` finds no such field in `app-store.js` or `state-schema.js`), so that term is always `null`. The signature is effectively **id + name only**.

`preset/update` (`app-store.js:599-616`) keeps the same `presetId` and reuses the existing name when the input is unchanged, while replacing the whole draft via `...cloneDraft(state.designer.draft)` — new `baseDollId`, `skinTone`, `face`, and `slots`. The signature does not move, `renderDollbox` returns at line 560, and **the card keeps rendering the old outfit** until some unrelated preset change invalidates the gate.

`#update-preset` (`app.js:439`) is the J-03 journey control, so this is on a primary path.

**Fix**: add `updatedAt` to the signature — `preset/update` already stamps it (`app-store.js:608`).

### N-2 — Dollbox does not re-translate (P2)

Same gate. On `languagechange`, `app.js:329` calls `renderApp()` → `designerView.render()` → `renderDollbox()`, but the signature is unchanged, so the early return keeps the previous language in the mini-button `title` attributes (`designer.openInDesigner`, `designer.renameTitle`, `designer.deleteConfirmTitle`) and in the `designer.emptyDollbox` note.

**Fix**: include the active language in the signature.

### N-3 — New untranslated string (P2)

The D-2 fit-warning placeholder hardcodes English:

```js
const placeholder = makeAssetPlaceholder(`${assetName(getAsset(id), 'Asset')} — incompatible with this model`);
```

`grep` finds no matching key in `i18n.js`. This is the only untranslated player-facing string left in either feature — the same class of defect the paint pass (P-4) removed everywhere else. It renders on the doll in the Turkish UI.

### N-4 — Duplicate "Teen" options (P3)

Fixing P-9 added all six dolls to `#paint-reference-model`, but `doll_classic_a` and `doll_classic_b` both use `data-i18n="lifeStages.teen"`, so the dropdown shows "Genç" / "Teen" twice with no way to tell them apart.

## Coverage gap

**P-1 has no regression test.** `grep -rln "selectionRect\|select-rect" test/` returns nothing — no test exercises the select tool's pointer path, which is what let the original bug ship. The +5 new tests cover catalog filtering, face customization, fit families, paint guides, and paint session. A test that drives `pointerdown → pointermove → pointerup` with `tool: 'select'` and asserts a non-zero `selectionRect` would lock in the fix.

## Note on P-2

Raising `MAX_HISTORY_BYTES` to 96 MB does deliver the documented 20 steps, but it also raises the worst-case resident history to 20 × 4 MB = 80 MB for props. That is a real footprint on the target iPad. It satisfies the contract; consider whether the contract or the snapshot strategy is the thing to revisit.


---

# Resolution — 2026-08-18 (final)

All 41 original findings and all follow-ups are closed. `npm run check`: **297 pass, 0 fail**, 8 canonical docs, 141 assets.

## Follow-ups closed

| ID | Fix |
|:--|:--|
| N-1 | Dollbox render gate keys on `updatedAt`, so `preset/update` refreshes the card image. |
| N-2 | Active language added to the gate signature, so row actions re-translate. |
| N-3 | `designer.fitWarningPlaceholder` added to `tr` and `en`. |
| N-4 | Reference model picker uses per-model `models.*` labels — 6 unique names in both locales. |
| N-5 | *Found while verifying N-3.* Fit-warning placeholders rendered on top of each other, illegibly — no `.asset-placeholder` CSS existed at all. Now offset by index, clipped to one line, full text kept in `title` and the accessible name. |
| D-5 (partial) | Dollbox actions carry `data-preset-action` / `data-preset-id` and focus is restored after rebuild. |
| D-10 (partial) | `CLEARABLE_OUTFIT_SLOTS` in `domain/vocabulary.js` replaces the duplicated arrays in `app.js` and `outfit-rules.js`. |

## Also changed

- `window.prompt` eliminated from the Dollbox **and** Scene Book renames via a new queued `askPrompt` + `#prompt-dialog` (D-035 now holds everywhere).
- `sw.js` `CACHE_NAME` bumped `v19 → v21` and `css/app.css?v=5 → v=6`, since the shell HTML, JS, and CSS all changed.

## New regression coverage

| Test | Guards |
|:--|:--|
| `test/paint-selection-pointer.test.js` | Drives real `pointerdown → pointermove → pointerup` through `createPaintView`; asserts a non-zero, growing marquee. |
| `test/dollbox-render-gate.test.js` | `preset/update` rebuilds the row; language change rebuilds the row; unrelated state changes do not. |

Both suites were verified to **fail when their defect is reintroduced** and pass once restored.

## Browser verification

Driven against a local server in Chromium: rename dialog (open/prefill/submit/cancel/Escape/blank), focus restoration, `preset/update` thumbnail refresh, language toggle, and fit-warning legibility in both locales. No console errors.

Two notes on method:
- An intermediate report that Enter did not submit the prompt form was **wrong** — a plain control form in the same page also failed to submit, proving the tool's synthetic Enter does not trigger implicit submission. The dialog was still changed to listen for the form's `submit` event, matching the codebase idiom and removing any dependency on implicit-submission behavior.
- The service worker served a stale shell during testing, which masked edits until caches were cleared. This is why the `CACHE_NAME` bump matters, and why improvement item I-10 proposes automating it.

## Remaining observations

None are defects. Thirteen non-blocking improvements — history-snapshot memory, per-stroke allocation, flood-fill strategy, `paint-view.js` size, CSS `@import` cache-busting, and others — are recorded as the improvement backlog in [../docs/ROADMAP.md](../docs/ROADMAP.md).


---

# Play Review — 2026-08-18

Scope: `js/features/play/play-view.js`, `js/features/play/scene-outline-view.js`, the `scene/*` reducers in `js/core/app-store.js`, `js/domain/scene-rules.js`, and the Play wiring in `js/app.js` and `index.html`.

- **Baseline**: `npm run check` → 312 pass, 0 fail, 9 canonical docs, 141 assets
- **Status**: all Play findings PL-1–PL-20 are fixed; the issue sections below retain the original pre-fix analysis for traceability

Severity key matches the Designer/Paint passes: **P1** correctness/contract violation · **P2** accessibility, performance, or doc divergence · **P3** consistency and hygiene

## Summary

| ID | Sev | Issue | Location |
|:--|:--:|:--|:--|
| PL-1 | P1 | Entities snap back to the first 1600px on any commit on a panoramic stage | `scene-rules.js:333` |
| PL-2 | P1 | Scene Outline labels every bubble "Speech bubble" regardless of style | `scene-outline-view.js:71` |
| PL-3 | P1 | Scene Outline resolves assets through the built-in catalog, so custom props lose their name | `scene-outline-view.js:7`, `:74` |
| PL-4 | P2 | Every `scene/*` status message is hardcoded English | `app-store.js:661-1190` |
| PL-5 | P2 | Spawn tray and scene entity accessible names are hardcoded English | `play-view.js:277-280`, `:333`, `:387`, `:601-627` |
| PL-6 | P2 | `#camera-slider` accessible name is hardcoded English | `index.html:236` |
| PL-7 | P2 | Every scene mutation rebuilds the whole stage and the whole spawn tray | `play-view.js:963-1010` |
| PL-8 | P2 | Context-ring actions destroy their own focus | `play-view.js:523-565`, `:1005` |
| PL-9 | P2 | Wheel handler swallows vertical page scroll over a panoramic stage | `play-view.js:876-889` |
| PL-10 | P2 | Bare letter shortcuts fire while Ctrl/Cmd is held | `play-view.js:695-745` |
| PL-11 | P2 | `nextSpawnPoint` ignores `cameraX`, so tray taps spawn off-screen when panned | `play-view.js:20-22` |
| PL-12 | P2 | Arrow-key move on a pinned entity fails silently | `play-view.js:749-762` |
| PL-13 | P3 | Play re-implements the registry's custom-prop merge | `play-view.js:378-381` |
| PL-14 | P3 | `t(...) \|\| 'Balon'` is unreachable, and a missing key renders a raw key path | `play-view.js:470-472` |
| PL-15 | P3 | `const placeBelow = true` drives a ternary with one reachable branch | `play-view.js:519-525` |
| PL-16 | P3 | `findSceneSkinSvg` queries `document` directly, bypassing injected `$$` | `play-view.js:24-31` |
| PL-17 | P3 | `1600`, `900`, and `800` are inlined where named constants exist | `play-view.js:76`, `:812`, `:930`, and others |
| PL-18 | P3 | Play render dereferences DOM nodes with no null guard, unlike its siblings | `play-view.js:271`, `:301`, `:319`, `:983` |
| PL-19 | P3 | Bubble dialog focuses twice behind an undocumented 50 ms timer | `play-view.js:286-297` |
| PL-20 | P3 | Background panels are awaited one at a time | `play-view.js:983-990` |

---

## PL-1 — Panoramic stages lose every move on commit (P1)

`moveEntity` takes a `stageWidth` through the scene everywhere except its own single-entity branch:

```js
// scene-rules.js:333 — single entity move
const range = getEntityAllowedRange(root, getAsset);
```

`getEntityAllowedRange(entity, getAsset, stageWidth = STAGE_WIDTH)` therefore falls back to the fixed `1600`. The compound branch three lines above it is correct — it uses `getCompoundEntityRange`, which reads `scene.stageWidth`.

Reproduced against the real module:

```
after addEntity x = 3000   (expected 3000)  ← spawn is correct
after moveEntity to 4000 -> x = 1500        ← commit is wrong
drag preview clamp says x = 4000            ← preview is correct
```

**Lived behavior on a `3200` or `4800` stage**: the player drags a prop into the second panel, the preview follows the pointer the whole way, and on pointer-up it teleports back to the left panel. The same snap happens on every arrow-key nudge, on every alignment command (`alignEntities` routes each move through `moveEntity`), and when narrowing `4800 → 3200` (`reclampSceneEntities` clamps to `1600`, not to the new width). An entity that has an attached child is unaffected, so two items on the same stage behave differently.

This contradicts the panoramic acceptance criterion in [../docs/ROADMAP.md](../docs/ROADMAP.md) — "correct coordinate offset, all input modes" — and the D-033 stickiness contract's compound clamping, which the pointer preview already honors.

**Fix direction**: pass the scene width, matching every sibling call site.

```js
const range = getEntityAllowedRange(root, getAsset, scene?.stageWidth || STAGE_WIDTH);
```

**Coverage gap**: `test/panoramic-stages.test.js` imports `moveEntity` and never calls it. Its reclamp tests only narrow *to* `1600`, where the wrong default and the right value coincide, so both pass with the defect present. A test that moves an unattached entity to `x = 4000` on a `4800` stage and asserts it stays there fails today and locks in the fix. A second test narrowing `4800 → 3200` guards `reclampSceneEntities`.

## PL-2 — Every bubble reads "Speech bubble" in the outline (P1)

`scene-outline-view.js:71` picks the icon per style but hardcodes the label key:

```js
icon.textContent = entity.bubbleStyle === 'thought' ? '💭' : (… '💥' … '📜' … '💬');
labelText = `${t('play.bubbleSpeech')}: "…"`;
```

`play.bubbleThought`, `play.bubbleShout`, and `play.bubbleCaption` already exist in both `tr` and `en` (`i18n.js:240-243`, `:949-952`). The Scene Outline is the documented accessible alternative to pointer editing, so a screen-reader user has no way to tell a caption from a shout — the icon is `aria-hidden`.

**Fix direction**: derive the key from `entity.bubbleStyle`, the same way `renderSelectedActions` intends to.

## PL-3 — Custom props lose their name in the outline (P1)

`scene-outline-view.js` imports the catalog directly:

```js
import { getAsset } from '../../core/asset-catalog.js';
```

Every other Play-adjacent view is constructed with `getAsset: getEffectiveAsset` (`app.js:190`, `:210`, `:220`) — the registry that resolves `custom_*` IDs. The outline is the one view that is not. `getAsset(entity.sourceId)?.name` returns `undefined` for player-painted props, so line 74 falls through to the generic `t('play.sceneProp')`. A stage holding three painted props shows three identical rows.

This is also the layer inversion D-9 removed from Designer: a feature view reaching past its injected dependencies into a core module.

**Fix direction**: add `getAsset` to `createSceneOutlineView`'s parameters and pass `getEffectiveAsset` from `app.js`, matching `createPlayView` and `createSceneBookView`.

## PL-4 — Play status messages never translate (P2)

The Designer reducers route through `i18n` (`app-store.js:472`, `:501`, `:515`, `:529`). The `scene/*` reducers do not — roughly 30 messages are English literals:

```js
message('Scene is full.')
message(`${preset.name} added to the scene.`)
message(`Stage width set to ${action.stageWidth}px.`)
message(`Aligned items (${action.alignment}).`)
message(`${targetIds.length} item${targetIds.length === 1 ? '' : 's'} removed from scene.`)
```

These land in `#play-status` and in the toast (`app.js:307`), so the primary feedback channel for spawning, deleting, pinning, aligning, resizing the stage, and every Scene Book operation is English inside a Turkish UI. `Aligned items (distribute-h)` additionally leaks an internal enum, and the plural is built with an English `s` suffix that no other string in the codebase uses.

**Fix direction**: mirror the Designer path — `message(t('play.…', { name, count }))` — and use i18n's existing parameter interpolation for the plural rather than string concatenation.

## PL-5 — Spawn tray and entity accessible names are English (P2)

`renderSpawnTray` and `createSceneEntity` build accessible names by concatenation:

```js
card.setAttribute('aria-label', `Spawn ${source.name} in scene (or drag to place)${source.custom ? ' (Custom Art)' : ''}`);
card.setAttribute('aria-label', `Add ${preset.name} to scene`);
button.setAttribute('aria-label', `${entity.pinned ? 'Pinned ' : ''}${preset?.name ?? 'Paper doll scene item'}`);
button.setAttribute('aria-label', `${entity.pinned ? 'Pinned ' : ''}${entity.bubbleStyle || 'speech'} bubble: ${entity.text}`);
```

`BUBBLE_PRESETS` (`play-view.js:277-282`) is worse: `name`, `desc`, and `defaultText` are all English literals rendered as *visible* text, even though `play.bubbleSpeech` / `Thought` / `Shout` / `Caption` are already translated. `defaultText` is then persisted into scene data, so a Turkish player's saved scene contains `"Once upon a time..."`. The outline's `Select ${labelText} in outline` (`scene-outline-view.js:77`) belongs to the same set, as does `'Emma sample doll'`, `'Scene prop'`, and the registry's `'Missing Artwork'` placeholder name.

This is the same defect class as I-07 and the closed N-3, and it is larger than either: the entire Play tray is untranslated to assistive technology.

## PL-6 — Camera slider is the one unlocalized HUD control (P2)

```html
<input id="camera-slider" … aria-label="Camera position">
```

Every sibling in the HUD carries `data-i18n-aria-label` (`index.html:219`, `:239`, `:250`). The slider does not, so it stays English after a language switch and is missed by the i18n sweep.

## PL-7 — Every scene mutation rebuilds the entire Play surface (P2)

`render()` is the only render path, and `app.js:441` calls it for every action that is not camera movement or selection. One arrow-key nudge therefore:

- rebuilds `#background-select` and the full spawn tray, re-rendering **every Dollbox doll thumbnail** through `renderDollInto` (an `await` per preset),
- rebuilds every background panel (1, 2, or 3 `appendAsset` calls),
- rebuilds **every scene entity from scratch**, awaiting a full layer-tree clone per character,
- rebuilds the context ring.

SVG templates are cached (`svg-loader.js:17`), so this is DOM churn rather than network, but holding an arrow key or tapping `+` repeatedly re-clones every doll on the stage *and* every doll in the Dollbox on each repeat. This is the Play twin of the closed I-05 (Designer full re-render) and I-06's motivation, and it is the largest remaining frame-budget risk on the target iPad.

**Fix direction**: the same shape as I-05 — patch `--x`/`--y`/`--scale`/`z-index` on existing positioners for move/scale/flip/reorder, and gate the spawn tray on a signature of `presets`, `customAssets`, `spawnTab`, and the active language (the pattern `dollbox-render-gate.test.js` already guards for Designer).

## PL-8 — Context-ring actions destroy their own focus (P2)

`renderContextRing` opens with `$('#scene-entities .context-ring')?.remove()` and rebuilds every button. Pressing "+" dispatches `scene/scaleEntity`, which reaches `renderApp` → `render()` → `renderContextRing`, so the focused button is removed from the document mid-interaction. The focus restoration at `play-view.js:1013` only looks for `.scene-entity-positioner`, so focus falls to `<body>`.

**Lived behavior**: a keyboard user can scale, reorder, or flip exactly once per ring visit, then has to tab back in. Pointer users are unaffected because they re-target by position. This is D-5 in Play, and D-5's own fix (`data-preset-action` plus post-rebuild focus restore) is the template.

## PL-9 — Panoramic stages swallow page scrolling (P2)

```js
const delta = event.shiftKey || Math.abs(event.deltaY) >= Math.abs(event.deltaX)
  ? event.deltaY : event.deltaX;
if (!delta) return;
event.preventDefault();
```

Whenever `stageWidth > 1600`, a pure vertical wheel or two-finger scroll over the stage is consumed and converted into horizontal camera pan. The listener is registered `{ passive: false }` on the whole stage, so the player cannot scroll the page past the stage using the gesture they would naturally use on an iPad or trackpad.

**Fix direction**: only claim the event when the gesture is horizontal (`Math.abs(deltaX) > Math.abs(deltaY)`) or `shiftKey` is held, and let vertical scrolls through.

## PL-10 — Letter shortcuts fire under Ctrl/Cmd (P2)

`handleStageKeydown` guards the target (`input, select, textarea`) but never the modifiers:

```js
if (event.key.toLowerCase() === 'o') { event.preventDefault(); openSceneOutlineDialog?.(); return; }
…
} else if (event.key.toLowerCase() === 'd') { … duplicateEntity … }
} else if (event.key.toLowerCase() === 'p') { … togglePin … }
```

With the stage focused, `Cmd+O` / `Ctrl+O` opens the Scene Outline instead of the browser's Open dialog, `Ctrl+D` duplicates the selection instead of bookmarking, and `Ctrl+P` toggles pinning instead of printing. The `o` branch also sits above the `selectedIds.length === 0` guard, so it is always live. Separately, the target guard misses `[contenteditable]`.

**Fix direction**: return early when `event.ctrlKey || event.metaKey || event.altKey`, and extend the target guard to `[contenteditable]`.

## PL-11 — Tray spawns land off-screen while panned (P2)

```js
export function nextSpawnPoint(index) {
  return { x: 650 + (index % 5) * 80, y: 690 + (index % 3) * 45 };
}
```

`x` is always between `650` and `970` — inside the first panel. Drag-and-drop is correct (`app.js:684` converts through `clientToLogical` with `cameraX`), but *tapping* a tray card on a `4800` stage panned to `cameraX = 3200` places the item roughly 2500px to the left of what the player is looking at. The only feedback is a toast saying it was added.

The `% 5` / `% 3` cycle is a second, smaller problem: the sixteenth spawn lands exactly on the first.

**Fix direction**: offset the spawn point by the current `cameraX` so items appear in view, and derive the cycle from the entity count rather than two coprime moduli.

## PL-12 — Pinned entities move-fail silently on the keyboard (P2)

The multi-select keyboard path filters pinned entities explicitly (`play-view.js:756`), and the pointer path refuses to start a drag on them (`:126`). The single-entity path does not:

```js
} else if (entity) {
  store.dispatch({ type: 'scene/moveEntity', instanceId: id, x: entity.x + dx, y: entity.y + dy });
}
```

`moveEntity` correctly refuses (`scene-rules.js:299`), so this is not a data defect — but the reducer returns the scene unchanged, no message is set, and the player pressing an arrow key gets no indication that pinning is why nothing moved. D-033 says pinned scenery is "immovable by pointer"; the keyboard equivalent should say so out loud.

## PL-13 — Play re-implements the registry's custom-prop merge (P3)

```js
const builtins = assetsByKind('prop');
const customs = (state.customAssets || [])
  .filter((a) => a.kind === 'prop' && a.status === 'available' && a.libraryVisible !== false)
  .map(customAssetToDescriptor);
```

`play-view.js` imports `assetsByKind` from `core/asset-catalog.js` (built-ins only) and then hand-rolls the custom merge — while already holding an injected registry `getAsset` whose sibling `assetsByKind` (`asset-registry.js:94-101`) performs exactly this filter, including the `includeHidden` option. This is the duplication that produced D-1 in Designer: two copies of one discovery filter that drift.

**Fix direction**: inject the registry rather than only its `getAsset`, and call `registry.assetsByKind('prop')`. The same applies to `renderBackgroundSelect`.

## PL-14 — Unreachable fallback hides a raw key path (P3)

```js
label = `${t('play.bubble' + Cap(style)) || 'Balon'}`;
```

`t()` returns `keyPath` when a key is missing (`i18n.js:1492`), which is never falsy — so `'Balon'` is dead code, and a typo or a new bubble style renders the literal string `play.bubbleShout` to the player. The hardcoded Turkish fallback inside a JS module is also the wrong home for a translation.

## PL-15 — Dead constant (P3)

```js
const placeBelow = true;
const ring = document.createElement('div');
ring.className = `context-ring${placeBelow ? ' is-below' : ''}…`;
```

`placeBelow` is never assigned anything else. Either the ring should flip above the entity when the entity sits near the stage floor — the case the flag was presumably written for, and one the current fixed `selected.y + 35` does not handle — or the flag should go.

## PL-16 — `findSceneSkinSvg` bypasses the injected selector (P3)

```js
const entity = [...document.querySelectorAll('.scene-entity-positioner')]
```

The rest of the module receives `$` / `$$` by injection, which is what makes the view testable. This is the one exported function that does not. Same class as the closed D-9.

## PL-17 — Inlined magic numbers (P3)

`DEFAULT_STAGE_WIDTH`, `LIMITS.STAGE_HEIGHT`, and `CAMERA_CONSTANTS` all exist and are imported, yet the viewport width and stage height are written literally throughout:

- `Math.max(0, stageWidth - 1600)` — `play-view.js:76`, and again at `:812`
- `cameraX: stageWidth - 1600` — `:686`
- `const targetX = ratio * stageWidth - 800` — `:930` (half the viewport)
- `dot.style.top = \`${(e.y / 900) * 100}%\`` — `:961`
- `if (stageWidth <= 1600) return` — `:878`

A viewport constant (`CAMERA_CONSTANTS.VIEWPORT_WIDTH`) would remove all of them and make the panoramic contract greppable.

## PL-18 — Unguarded DOM dereferences (P3)

`renderBackgroundSelect` (`:271`), `renderSpawnTray` (`:301`, `:319`), and `render` (`:983`, `:996`) call `.replaceChildren` and `.hidden` directly on `$(...)` results, while `renderSelectedActions`, `renderCameraHud`, and `syncCamera` in the same file guard every lookup. The inconsistency is D-13 in Play.

## PL-19 — Undocumented double focus in the bubble dialog (P3)

```js
dialog.showModal();
input.focus();
input.select();
setTimeout(() => { input?.focus(); input?.select?.(); }, 50);
```

The retry is presumably an iPad Safari keyboard workaround — `app.js:641` carries a comment for the same class of problem. Here there is no comment, so the timer reads as accidental.

## PL-20 — Sequential background panel loads (P3)

```js
for (let i = 0; i < numPanels; i++) {
  const panel = document.createElement('div');
  await appendAsset(panel, state.currentScene.backgroundId, {});
  panels.push(panel);
}
```

Three identical awaits in series on a `4800` stage, once per render (see PL-7). `Promise.all` over the panels is the same code with one fewer round trip each.

## Coverage gaps

| Gap | Why it matters |
|:--|:--|
| No test moves an entity on a stage wider than `1600` | Exactly the hole PL-1 shipped through. `panoramic-stages.test.js` imports `moveEntity` and never calls it. |
| No test narrows a stage from `4800` to `3200` | Both existing reclamp tests narrow to `1600`, where the wrong default and the correct value are identical. |
| No test asserts a Play status message is translated | The Designer equivalent is covered; PL-4 has no guard. |
| No test drives `handleStageKeydown` with a modifier held | PL-10 would be caught by a single assertion that `Ctrl+D` does not duplicate. |

## Note on ordering

PL-1 is the only finding that loses player work, and it is fully contained in one argument on one line. PL-2, PL-3, PL-8, and PL-10 are each small and independently testable. PL-4, PL-5, and PL-7 are the large ones: the localization sweep touches ~30 reducer messages plus the tray, and the render-patching work is the same shape as I-05 and should follow it rather than be improvised.


---

# Verification — 2026-08-19

Every PL finding re-checked against current source, not against the fix descriptions. `npm run check` → **312 pass, 0 fail** (up from 305; 7 new tests).

## Closed and verified (16)

| ID | Evidence |
|:--|:--|
| PL-1 | `scene-rules.js:333` now passes `scene?.stageWidth \|\| STAGE_WIDTH`. Re-ran the original reproduction: move to `x = 4000` on a `4800` stage lands at `4000`; narrowing `4800 → 3200` reclamps to `3100`, not `1500`; right-alignment on a wide stage keeps both entities past `1600`. Reverting the one argument makes `test/panoramic-stages.test.js` fail (`actual: 1480, expected: 3080`) — the new tests genuinely guard the defect. |
| PL-2 | `scene-outline-view.js:71-79` maps `entity.bubbleStyle` to the four existing keys. |
| PL-3 | `getAsset` injected and `app.js:201` passes `getEffectiveAsset`. |
| PL-6 | `index.html:236` carries `data-i18n-aria-label="play.cameraSliderAria"`; key present in `tr` and `en`. |
| PL-7 | Entities reuse DOM nodes via `sceneEntityRenderKey` and `patchSceneEntity`; `entityRoot.replaceChildren` runs only when order or membership changes; background gated on `renderKey`; spawn tray gated on a signature covering language, tab, presets, and custom props. |
| PL-8 | `getContextRingFocusAction` captures the focused action before the ring is removed and restores it by `data-action` on the next frame. |
| PL-9 | `getWheelPanDelta` claims horizontal gestures and shift-wheel only; vertical scroll passes through. Unit-tested. |
| PL-10 | `handleStageKeydown` returns early on `ctrlKey \|\| metaKey \|\| altKey`, and the target guard now includes `[contenteditable]`. |
| PL-11 | `nextSpawnPoint(index, cameraX)`; all three call sites pass `state.currentScene.cameraX`. |
| PL-12 | Both the single and batch keyboard paths dispatch `play.pinnedMoveBlocked` when every target is pinned. |
| PL-15 | Dead `placeBelow` gone; `is-below` inlined. |
| PL-16 | `findSceneSkinSvg(instanceId, queryAll)` takes an injected selector. |
| PL-17 | `VIEWPORT_WIDTH` / `VIEWPORT_HEIGHT` imported from vocabulary; no `1600`, `900`, or `800` literals remain in `play-view.js`. |
| PL-18 | Every `$()` result in the render path is guarded. |
| PL-19 | The 50 ms re-focus timer is gone; a single `focus()`/`select()` remains. |
| PL-20 | Background panels build under `Promise.all`. |

PL-1's fix is the strongest of the set: it is correct at the domain layer, so the reclamp and alignment paths that depend on it were fixed for free, and the regression tests were confirmed to fail when the defect is reintroduced.

## PLR-1 — Custom props have disappeared from the Play tray (P1, regression)

**This is new damage, introduced by the PL-13 fix.** Player-painted props were spawnable in Play before this pass and are not spawnable now.

PL-13 asked Play to stop hand-rolling the custom-prop merge and use the registry instead. Half of that landed. `createPlayView` gained the parameter:

```js
getAssetsByKind = (kind) => assetsByKind(kind)   // play-view.js:61 — built-in catalog
```

and the old manual merge was deleted in favour of it:

```js
const sources = spawnTab === 'characters' ? state.presets : getAssetsByKind('prop');  // :407
```

But `app.js` passes `getAssetsByKind: getEffectiveAssetsByKind` to **`createDesignerView` only** (`app.js:192`). `createPlayView` (`app.js:204-213`) never receives it, so Play silently falls back to the built-in default.

Measured directly:

```
builtin  assetsByKind('prop'): 22
registry assetsByKind('prop'): 23   ← the player's painted prop
```

**Lived behavior**: a child paints a prop in Paint Studio, saves it to My Art, opens Play, taps the Props tab — and their artwork is not there. The Paint Studio "🎨" card still sits at the end of the tray inviting them to paint another one. Nothing errors, and the toast on save still says it was added.

Two independent signals confirm the merge was meant to survive:

- The tray render signature still tracks `customProps` (`play-view.js:327`), so the tray correctly re-renders whenever custom art changes — and still shows nothing new.
- Every `source.custom` branch is now unreachable: the `is-custom-spawn-item` class (`:412`), the `play.customArtSuffix` accessible-name suffix (`:414`, `:429`), and the `play.customPropBadge` kind label (`:422`) can never fire, because built-in descriptors never carry `custom`.

Scene entities already placed are unaffected — `getAsset` *is* injected correctly, so existing custom props still render on the stage and in the outline. Only discovery is broken.

**Fix direction**: pass `getAssetsByKind: getEffectiveAssetsByKind` in the `createPlayView` call, exactly as the Designer call does.

**Coverage gap that let this through**: `test/runtime-and-drag-fixes.test.js` constructs `createPlayView` twice and never passes `getAssetsByKind`, so it exercises the same default the app now accidentally uses. No test asserts that a custom prop reaches the tray. A test that builds a store holding one available custom prop, renders the tray, and asserts a card exists for it would fail today.

Note also `play-view.js:412-414` sets `className`, `label.textContent`, and `aria-label`, and `:427-429` immediately overwrites the latter two — dead duplicate assignments left over from this edit.

## PL-4 — Partially fixed (P2)

Most `scene/*` messages now route through `t()`. Seven do not, and three of those are success paths on everyday flows:

| Line | Message | Reached by |
|:--|:--|:--|
| 1034 | `'A new scene is ready.'` | **every New Scene** |
| 1021 | `` `Loaded template "${templateScene.title}".` `` | **every template load** |
| 1008 | `` `"${title}" saved as copy in Scene Book.` `` | **every Save a Copy** |
| 974 | `'Scene library is full.'` | library limit |
| 959, 977, 986 | ID-assignment failures | error paths |

Separately, the enum leak called out in the original finding is still present:

```js
statusItemsAligned: 'Öğeler hizalandı ({alignment}).'
```

`action.alignment` is the internal mode string, so a Turkish player aligning left reads "Öğeler hizalandı (left)." and distributing reads "Öğeler hizalandı (distribute-h)." The translated button labels (`play.alignLeft: '⇤ Sol'`) already exist and are not used here.

## PL-5 — Mechanism fixed, data missing (P2)

The `assetName(asset, fallback)` helper is well built — it correctly handles `t()`'s return-the-key-path-on-miss semantics, which is the trap PL-14 described. It is wired into the spawn tray (`play-view.js:427`) and the Scene Outline (`scene-outline-view.js:81`).

But the `assets.*` translation table has no entries for the asset kinds Play actually uses:

| Kind | Translated |
|:--|:--|
| face | 19 / 19 |
| wearable | 58 / 87 |
| **prop** | **0 / 22** |
| **background** | **0 / 7** |
| **doll** | **0 / 6** |

Verified at runtime under `tr`: `assetName(prop_tea_set)` returns `"Tea set"`, `assetName(bg_bedroom)` returns `"Cozy bedroom"`. The entire Props tab and the background picker are still English in the Turkish UI — the helper resolves nothing.

`assetName()` is also not applied at five remaining sites, so even once the table is filled these stay English and disagree with the tray beside them:

| Line | Surface |
|:--|:--|
| `play-view.js:295` | background `<select>` options |
| `play-view.js:501` | the visible selected-item label |
| `play-view.js:659` | custom prop `img.alt` |
| `play-view.js:668` | stage entity accessible name |
| `play-view.js:1029` | `#scene-name-chip` |

The sharpest version: select a tea set and the tray card reads one thing while the selected-item label directly above it reads another, on the same screen.

## PL-14 — Not fixed (P3)

`renderSelectedActions` still carries the exact construct the finding described:

```js
// play-view.js:500
? `${t('play.bubble' + (selected.bubbleStyle || 'speech').charAt(0).toUpperCase() + (selected.bubbleStyle || 'speech').slice(1)) || 'Balon'}`
```

`t()` never returns a falsy value for a non-empty key, so `'Balon'` remains dead code and an unrecognized style renders the literal `play.bubbleX` to the player. The same pattern *was* correctly replaced with an explicit key map at `play-view.js:644` and in the outline — this one site was missed.

## Documentation drift

The two canonical records disagree with each other and with the code:

- `review/ISSUES.md` claimed all twenty PL findings complete (corrected in this pass).
- `docs/ROADMAP.md` Gate F still shows items 4, 5, and 7 unchecked, and its snapshot bullet credits only batches 1–3 — so it understates batches 4–6 while ISSUES.md overstated them. Neither matched the source.

## Suggested order

1. **PLR-1** — one line in `app.js`, plus the tray test that should have existed. Player-visible data loss; do this first.
2. **PL-4** — seven `t()` calls and per-alignment message keys.
3. **PL-14** — replace the concatenated key with the map already used twice elsewhere in the same file.
4. **PL-5** — add `assets.*` entries for 22 props and 7 backgrounds, then apply `assetName()` at the five remaining sites. Largest, and purely additive.


---

# Remediation — 2026-08-19

The four findings that failed verification, plus the PLR-1 regression, are closed. `npm run check` → **314 pass, 0 fail** (up from 312; 2 new tests).

## PLR-1 / R-07 — Custom props restored to the Play tray

`js/app.js` now passes `getAssetsByKind: getEffectiveAssetsByKind` to `createPlayView`, matching the `createDesignerView` call. Registry-backed lookup returns 23 props against the built-in 22, and the custom descriptor carries `custom: true`, so the `is-custom-spawn-item` class, the `play.customArtSuffix` accessible-name suffix, and the `play.customPropBadge` kind label all become reachable again.

Two tests were added, because the two halves of this defect fail independently:

| Test | Guards |
|:--|:--|
| `runtime-and-drag-fixes.test.js` — *Play spawn tray lists custom props through the injected asset resolver* | The **view** honours `getAssetsByKind` and renders a labelled card for a custom prop. |
| `ui-contract.test.js` — *every view built in app.js receives the registry-backed asset resolvers it declares* | The **composition root** wires it. For each view factory, if the module declares `getAsset` or `getAssetsByKind`, `app.js` must pass the effective resolver. |

The second test is the one that matters here: the original defect was in the wiring, not the view, so a test that injects the dependency directly would have passed throughout. Removing the argument from `app.js` now fails with `createPlayView declares getAssetsByKind but app.js does not pass getEffectiveAssetsByKind` — verified. It generalizes to any future view added to the composition root.

## PL-4 — All `scene/*` messages localized

The seven remaining literals now route through `t()`:

| Reducer | Key |
|:--|:--|
| `scene/new` | `play.statusNewScene` |
| `scene/loadTemplate` | `play.statusTemplateLoaded` |
| `scene/duplicateCurrentToLibrary` | `play.statusSceneSavedCopy`, `play.statusSceneLibraryFullShort`, `play.statusSceneId`, `play.statusSceneCopyId` |
| `scene/duplicateEntity` | `play.statusDuplicateId` |

The enum leak is fixed by a `play.alignmentModes` table keyed on the internal mode, so the message interpolates a translated phrase rather than the raw value:

```
before   Öğeler hizalandı (distribute-h).
after    Öğeler hizalandı (yatay dağıtıldı).
```

`grep "message('[A-Z]\|message(\`"` across the `scene/*` range now returns nothing. Verified by dispatching `scene/new` under both locales.

## PL-5 — Asset names translated and applied

Two halves, both closed.

**Data.** `assets.*` gained 35 entries in each locale — 22 props, 7 backgrounds, 6 dolls. Coverage for the kinds Play uses:

| Kind | Before | After |
|:--|:--|:--|
| prop | 0 / 22 | **22 / 22** |
| background | 0 / 7 | **7 / 7** |
| doll | 0 / 6 | **6 / 6** |

**Call sites.** `assetName()` now wraps the five sites that still read `asset.name` directly: the background `<select>` options, the selected-item label, the custom prop `img.alt`, the stage entity accessible name, and `#scene-name-chip`. The tray and the selected-item label above it can no longer disagree.

Also removed here: the duplicate `label.textContent` / `aria-label` assignments at `play-view.js:412-429`, which the earlier PL-5 edit had left overwriting each other. Card construction now computes `sourceName` once, before the elements that use it.

## PL-14 — Single source for bubble label keys

The concatenated key and its unreachable `|| 'Balon'` are gone. `bubbleStyleLabelKey(style)` now lives in `js/domain/vocabulary.js` beside `BUBBLE_STYLES` and `isBubbleStyle`, and validates through `isBubbleStyle` so an unknown style falls back to the default style rather than emitting a raw key path:

```
bubbleStyleLabelKey('caption') → play.bubbleCaption
bubbleStyleLabelKey('bogus')   → play.bubbleSpeech
bubbleStyleLabelKey(undefined) → play.bubbleSpeech
```

All three former copies — `renderSelectedActions`, `createSceneEntity`, and the Scene Outline — call it. The outline's hardcoded `'Hello'` text fallback was replaced with `play.bubblePresetSpeechText`.

## Service worker

`scripts/validate-cache-busting.mjs` failed the run after these edits and named the expected value, so `CACHE_NAME` was bumped `vbe43f575 → va1e3b475`. This is I-10 doing exactly the job it was built for — the stale-shell problem recorded in the 2026-08-18 resolution notes would otherwise have masked every change here during browser testing.

## Follow-up closed

I-14 is now closed. The 29 child, baby, adult, and elder wearable labels are present in both locales, and `test/i18n.test.js` checks every built-in catalog asset for a resolved `assets.*` key. Final verification after this follow-up: `npm run check` → **315 pass, 0 fail**.

## Verification method

Each fix was checked at runtime, not by reading the diff:

- Registry vs built-in prop counts compared directly (23 vs 22).
- `scene/new` dispatched under `tr` and `en`; both messages translated.
- All ten new keys resolved in both locales with no key-path fallthrough.
- `assetName()` confirmed returning `Çay takımı` and `Sıcak yatak odası` under `tr`.
- `bubbleStyleLabelKey` exercised with valid, invalid, and `undefined` input.
- The `app.js` wiring test confirmed to fail when the argument is removed.
