Review and test the Family & Home Stories DLC in `/Users/onursafran/ai-projects/paper-doll-dress-up`. Use the current working tree: it includes pre-existing, uncommitted pack infrastructure plus the new DLC. Preserve unrelated changes. Do not deploy or commit.

Read `docs/FAMILY-HOME-IMPLEMENTATION.md` and `docs/DLC-AND-STUFF-PACKS.md`. Run `npm run check`. Start a local server and use `review/family-home.html` for contact sheets and the main application for behavior tests. Avoid stale SVGs from an older service worker when comparing artwork.

Test and fix concrete problems you find:

1. Audit the 48 wearables, 40 props, four backgrounds, six scenes, 12 English/Turkish prompts and eight outfits against the ledger. Inspect every wearable on its declared life stage; prioritize shoes covering feet, neckline/underwear coverage, hair leaving eyes visible, clipping, and distinct silhouettes. Check supported poses, head/limb motion, flips, tinting and thumbnails. Verify the crib, high chair and pram placement/layering as static props; no automatic doll attachment is promised.
2. In Designer and Play, compose pack filtering with life stage, style and prop collection. Confirm core/custom items do not leak into a DLC-only filter. Import hidden-pack preferences and confirm discovery and shuffle update, while saved artwork still resolves. Verify Turkish and English names, prompts, recipe controls, keyboard focus and mobile layout.
3. Load all eight outfit recipes and six starter scenes. Confirm independent character snapshots, backgrounds and panorama width. Exercise Undo/Redo, save/reopen, project export/import/merge and missing/re-enabled pack references without losing outfit items or geometry.
4. Compare Designer, Play, scene thumbnails, scene PNG and animation export. Confirm essential content and tint channels survive export. Test the full four-generation birthday scene.
5. Verify service-worker resources and a real offline reload. If a target iPad is available, measure startup/render/export behavior, install/restart offline and record storage/transfer observations. Desktop emulation does not count as a physical iPad pass. Report unavailable device checks explicitly.

Add focused regression tests for logic bugs, run `npm run update:sw` after changing app files/assets, then run `npm run check`. Report findings by severity with file/line references, what you fixed, exact checks performed, and what remains unverified. Do not mark a visual/device check passed merely because the manifest validator passes.
