# Implementation Status and Roadmap

Updated: 2026-10-03

This is the single authority for implementation status, open work, and delivery order. Product behavior belongs in [PROJECT.md](PROJECT.md); release evidence belongs in [QUALITY.md](QUALITY.md); accepted decisions belong in [DECISIONS.md](DECISIONS.md); foundation work belongs in [IMPROVEMENTS.md](IMPROVEMENTS.md).

## Current snapshot

Version 2.0.0, schema 8 (the first supported Paper Stage save; older data is cleared, see D-050). Dependency-free Designer, Play, and Paint Studio, installable offline as a PWA.

- **Core catalog:** 6 base dolls across 5 life stages, 19 modular face features, 87 wearables/hair/accessories, 11 backgrounds, and 26 props (149 validated SVGs).
- **Family & Home Stories** (`pack_family_home`): 92 assets, 8 outfit recipes, 6 starter scenes, and 12 bilingual prompts, with trusted pack manifests, pack-aware registry filtering, and missing-pack placeholders (D-048).
- **Designer:** Dollbox, modular faces, fit-aware wardrobe and shuffle, custom hair, seven expressions, poses, and local voice puppetry.
- **Play:** Scene Book, templates, speech bubbles, pinning and attachment, multi-select and alignment, Scene Outline, panoramic stages (`1600`/`3200`/`4800`) with camera navigation, looping animation, PNG and animation-frame export, and the World Map with souvenir stamps.
- **Paper Stage:** background-driven floor/wall constraints, automatic depth, furniture surfaces, drawn support areas, alpha-accurate hit testing, and grounded bounding boxes (D-049, D-050, [hitbox PRD](hitbox_and_bounding_box_prd.md)).
- **Paint Studio:** IndexedDB artwork, mixed raster/vector rendering, My Art, cutouts, and placement authoring.
- **Portability:** versioned project package with SHA-256 artwork integrity, Replace/Merge, collision rewriting, and recoverable backups (D-051, D-052).
- **Quality:** 710 automated tests, ESLint with 0 errors and 0 warnings, `tsc --noEmit`, and asset, pack, cache-busting, and documentation validators. All run through `npm run check`.
- **Foundations:** slice reducers, disposable teardown registry, JSDoc type checking, isolated locale dictionaries, generated service-worker manifest, worker/OffscreenCanvas export, and SVG symbol reuse (D-038 to D-044).

## Open work

Ordered by what blocks a family release first.

| Item | State | Needed to close |
|:--|:--|:--|
| Hosted iPad install and offline journey (J-18) | Blocked | Hosted HTTPS URL and a dated run on the target iPad, including offline Paint save, reload, use, and export; see [OFFLINE-PWA.md](OFFLINE-PWA.md). |
| Browser/device matrix | Open | Dated evidence for Safari, Firefox, Edge, and the target iPad. Only Chromium has been exercised. |
| Family & Home release checks | Open | Independent fit, tint, thumbnail, and PNG export review, plus target-iPad performance. |
| Paper Stage validation | Open | Moderated five-user pilot, physical iPad run, and crowded-scene frame-time measurements (D-049, D-050). |
| Phase 4: browser E2E suite | Open | Automated multi-browser journeys for create, persist, transfer, and offline. Today only `scripts/verify-hit-testing-browser.mjs` and `scripts/verify-scene-outline-browser.mjs` exist, both outside `npm run check`. |
| Scene transitions and Scene Book slideshow | Specified, not built | [PRD](PRD-STORYBOOK-SCENE-TRANSITIONS.md). Only a page-flip on background change exists; there is no curtain, dissolve, scene-load transition, or reader mode. |
| Fabric patterns | Deferred | Per-clone SVG ID scoping before patterns or definitions are admitted ([ASSETS.md](ASSETS.md)). |
| Papercraft finish coverage | Deferred | Broader cardboard finish only; clothing tabs stay off (D-045, D-047). |
| Interactive props and prop sound effects | Deferred | Needs its own design; map interactions already use procedural sound. |
| Paper Stage follow-ups | Deferred | Selected-piece artwork replacement, vase sample, occlusion-aware targeting, richer invalid-placement reasons, seating, nested supports, and perspective scaling (D-050). |

## Delivery order

1. Run the hosted iPad journey and the cross-browser matrix, and record the result in [QUALITY.md](QUALITY.md).
2. Build the Phase 4 E2E suite and add it to `npm run check`.
3. Complete the Family & Home and Paper Stage release checks.
4. Scene transitions and the Scene Book slideshow.
5. Next content expansion, in the order given in [DLC-AND-STUFF-PACKS.md](DLC-AND-STUFF-PACKS.md).

## Change discipline

Every change states outcome, affected contracts, migration/storage impact, acceptance criteria, evidence, risk, and rollback. A persisted-schema, asset-security, coordinate, or architecture change also updates [DECISIONS.md](DECISIONS.md) and its owning canonical document. Do not combine file movement with new product behavior.
