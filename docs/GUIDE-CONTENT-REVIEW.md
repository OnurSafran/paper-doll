# Guide and help content review: English and Turkish

Re-evaluated and updated **3 October 2026** against the current source and isolated local browser sessions. Corrections are implemented in both languages and matching HTML fallbacks.

## Assessment

The original factual findings still applied at the start of this pass. The guide advertised attachment, resizing, and bubble-tail controls that a child could not use. It also overstated automatic saving, offline access, and clothing fit. Those claims have been corrected.

Quick Start now follows one complete first-scene path: **dress and save a doll → put it on stage → add a move or bubble → save the scene**. Paint and Voice are optional next activities. The four existing tabs remain; everyday troubleshooting and family help are included in Tips. Header tips follow the current studio mode and open the relevant persistent help card.

Audience assumption: primary-school-age children who can read short instructions, including touch-screen users. Younger children may still need visual examples or adult help. This is an editorial and implementation review, not a usability study with children.

## Findings and implementation status

### 1. Resolved: unreachable attachment instructions

Removed the attachment card and rotating Attach tip. Their replacement explains reachable furniture placement: add a table and small prop, select the prop, and use **Place on… / Yerleştir…** when available, or drag toward a highlighted area. Only destinations where the item fits are offered.

The Joint tab still serves existing attachments, while the current toolbar offers no action for a new joint attachment. No attachment feature was added; imported attachments retain their behavior.

Evidence: [selection inspector](../js/features/play/selection-inspector-controller.js), [selection toolbar](../js/features/play/selection-hud-controller.js), [placement actions](../js/features/play/placement-controls.js).

### 2. Resolved: absent resize handles and bubble-tail controls

Instructions now teach selecting an item and using **+ / −** to resize it. Bubble help teaches moving the whole bubble near the speaker. It describes the 120-character limit, including spaces and punctuation.

Evidence: [selection toolbar](../js/features/play/selection-hud-controller.js), [bubble SVG generation](../js/core/bubble-svg.js).

### 3. Resolved: overly broad saving promise

Replaced “everything is automatically saved safely” with explicit **Save Doll**, **Save Scene**, and **Save Artwork** instructions. The guide distinguishes library creations from downloaded project backups, explains device-local browser storage, and gives next steps for Not saved states and save errors. Draft recovery is not described as a guaranteed backup. Storage behavior is unchanged.

Evidence: [Paint save service](../js/features/paint/paint-save-service.js), [project repository](../js/services/project-repository.js).

### 4. Resolved: incomplete Paint workflow

Added a complete example: **Paint → Wearable → Top → draw → Save Artwork → name → Save to My Art**. Turkish uses the translated controls. Saved tops are explained under **Tops / Üstler** in Designer and props under **Props / Eşyalar** in Play. Save & Wear is mentioned only when the contextual button appears.

Explained that faint doll and cutout helpers do not become saved pixels. Renamed **Add Cutout Pixels / Kalıp Piksellerini Ekle** to **Add to Drawing / Çizime Ekle** consistently in the UI, guide, and relevant status messages.

Evidence: [Paint saving](../js/features/paint/paint-save-service.js), [Designer wardrobe](../js/features/designer/designer-view.js), [Play tray](../js/features/play/tray-spawner-view.js).

### 5. Resolved in copy: offline setup and limits

Renamed the tip to **Play Without Internet / İnternetsiz Oyna**. It explains that the first download requires internet, asks families to wait and reopen, and recommends checking the game with internet off before a trip. Family help includes the iPad Safari installation path, conditional wording for other browsers’ installation options, and website-data clearing limitations.

Evidence: [offline setup](OFFLINE-PWA.md), [service worker](../sw.js). A physical iPad offline check remains required for device verification.

### 6. Resolved: outdated movement and model names

Replaced retired Say Hello / Selam Ver with Bow / Eğil. The model list names all six models, including Joy / Neşeli. Removed Teen / Genç from Settings help.

Re-evaluation found a narrower requirement than the original review stated: clothing-tab geometry is appended only for **Classic**, so Settings recommends Classic. Cardboard finish is described for dolls and supported props, matching current rendering.

Evidence: [animation clips](../js/domain/animation-clips.js), [Designer rendering](../js/features/designer/designer-view.js), [papercraft styles](../css/features/papercraft.css).

### 7. Resolved: untranslated literals and inconsistent labels

Added translation attributes and dictionary entries for **Arrow keys / Yön tuşları**, **Space / Boşluk**, and tip badges. Removed hardcoded PRO tags and mixed Turkish Header/Dollbox wording in the guide. Backup instructions use **Download Project JSON / Proje JSON Dosyasını İndir**. Eye-color help no longer confuses iris and pupil.

Two additional label issues were found:

- English’s visible layer-list button says **Outline**. The English guide and tip now use that label; Turkish retains **Katmanlar**.
- The Scene Book menu action reused the tray’s translation key, producing **Scene Tray** in English. It now has its own **Scenes / Sahneler** key. Instructions include **Scene → Scenes / Sahne → Sahneler**.

Evidence: [HTML controls and fallbacks](../index.html), [English locale](../js/core/locales/en.js), [Turkish locale](../js/core/locales/tr.js).

### 8. Resolved: compatibility presented as guaranteed visual fit

Removed “perfect fit” and revised the save-dialog note: **“You can try this drawing on every doll. Check the preview to see how it looks.”** Paint help explains that changing the guide doll does not change the drawing. Compatibility and saved pixels are unchanged.

Evidence: [Paint saving](../js/features/paint/paint-save-service.js), [guide and fit-note copy](../js/core/locales/en.js).

### 9. Resolved in guide: missing everyday task instructions

Added or expanded instructions for:

- Tapping clothing and tray cards, selecting items, and tapping empty space to deselect.
- Unpinning before moving, flipping, or resizing; selecting covered items through Outline / Katmanlar.
- Saving, reopening, updating, and saving a new Scene Book page.
- Choosing a Map place, traveling, reading unlock clues, and collecting hidden-object stamps.
- Placing small props on furniture and observing highlighted legal areas.
- Selecting two unpinned items for alignment, three for spacing, and respecting placement-area restrictions.
- Selecting a doll for Voice, allowing microphone access, stopping Voice, and distinguishing still PNG pictures from voice or video.
- Loading a backup, checking its preview, and choosing between adding creations and replacing the studio.

Evidence: [selection controls](../js/features/play/selection-hud-controller.js), [Map view](../js/features/world-map/world-map-view.js), [scene controls](../js/app-scene-controls.js), [shell backup actions](../js/app-shell-events.js).

### 10. Resolved in text: demanding first-success path

Rewrote Quick Start around a saved first scene. Removed required Paint and microphone steps, shortened instructions, and changed Pro Tips / Usta İpuçları to **Try These Ideas / Bunları Dene**. Paint and Voice remain optional activities.

Design A was selected on 3 October 2026: the existing four tabs and four visible Quick Start cards are retained, with translated button examples added to each card. A five-part navigation replacement was not selected. An optional live tutorial is specified separately in [the guide and tutorial PRD](PRD-GUIDE-AND-LIVE-TUTORIAL.md); it is not implemented.

### 11. Resolved within the agreed scope: touch support and matching help

Header tips lead with visible tap actions. Designer, Paint, and Play receive relevant tips plus the shared Undo tip. Mode changes cancel pending fades and restart the appropriate list. Clicking a tip opens its matching tab and scrolls to its help card. Language updates, hover/focus holds, reduced-motion behavior, and dialog holds remain covered by tests.

Every rotating tip has persistent guide content. Below 600px, the header chip remains hidden; the Guide button exposes all topics. The user explicitly confirmed that phones do not need tips and that the current rotation speed is acceptable. Both choices are settled: retain the existing visibility rule and 7.5-second rotation interval.

Evidence: [tip mapping and rotation](../js/features/quick-tips.js), [guide navigation](../js/app-shell-events.js), [regression tests](../test/quick-tips.test.js), [header responsiveness](../css/features/header.css).

### 12. Resolved in copy: child-facing help and error language

Simplified the reviewed Clothing Slot and non-saving reference wording, save failure text, storage-full message, and artwork-removal explanation. The metadata-failure path retains the drawing, so that specific error keeps the reassurance that it is still here. General save errors ask the child to keep the window open and retry, with technical details afterward. Storage-full copy leads with a next action and keeps the numeric limit as supporting detail.

Completed the remaining copy sweep across Designer, Play, Paint, artwork libraries, recovery, backups, saving, and import errors: **99 English and 156 Turkish strings** were revised, plus remaining bundled family prompts and map clues. Turkish instructions now consistently use informal singular address. Matching HTML text and accessible-description fallbacks were updated.

Drawing controls now use **Drawing Helpers / Çizim Yardımcıları**, **Guide Doll / Rehber Bebek**, and helper visibility instead of reference-layer vocabulary. Status messages explain whether the drawing changed. Removal and Trash messages explain the named box shown in dolls and scenes instead of calling it a placeholder. Save, load, copy, and microphone errors lead with what happened and the next action; import/storage technical details remain supporting information. Translation keys, placeholders, destructive-action warnings, and storage behavior were preserved.

This completes the remaining editorial implementation from this review. Understanding still needs to be checked with children; changing words alone cannot establish usability.

Evidence: [Paint failure paths](../js/features/paint/paint-save-service.js), [artwork library](../js/features/paint/paint-library-view.js), [both locales](../js/core/locales/tr.js).

### 13. Resolved: competing vertical scroll areas

The reported guide issue was reproduced at 375px: both `guide-dialog` and `guide-dialog-body` were vertically scrollable. The constraint was on the body wrapper, rather than on `guide-panel-features` itself. Removed the body's independent height/overflow rules so the dialog owns vertical scrolling for every tab. Switching tabs and reopening the guide start at the top; a header tip still scrolls to its matching help card.

Project & Backups and Layers had the same outer-dialog/inner-body pattern. Removed those duplicate inner scrollers too, and changed Layers' drag-edge autoscroll to use its dialog. Horizontal scrolling for the guide's tabs and shortcut table remains available.

Evidence: [dialog styles](../css/components/dialogs.css), [guide navigation](../js/app-shell-events.js), [Layers dragging](../js/features/play/scene-outline-view.js), [browser regression checks](../scripts/verify-guide-browser.mjs).

## Remaining decisions and external validation

- Design decision completed: retain the four tabs and add button examples (design A). Confirm their comprehension with children.
- Build and validate the optional real-page tutorial described in [PRD-GUIDE-AND-LIVE-TUTORIAL.md](PRD-GUIDE-AND-LIVE-TUTORIAL.md); specification is complete, implementation is pending.
- Test with children, including younger readers and touch users. Have them follow the first-scene path, save/reopen the scene, draw/save/wear a top, and find a covered item through Layers. Record where they hesitate or need help. Browser checks cannot establish reading suitability.
- Perform the documented offline journey on a real iPad. Desktop checks do not verify Safari installation, offline cache readiness, or microphone permission behavior on that device.

No further implementation from this review is waiting on a routine code or wording fix. Phone tips and rotation speed are settled. The selected static guide design is implemented. The newly requested live tutorial remains a specified future feature, and child/iPad validation remains external.

## Verification

### Design A implementation — 3 October 2026

- Added static button examples to all four Quick Start cards, keeping the four tabs. Examples reuse actual control locale keys and have no actions or keyboard stops.
- `npm run test:guide-browser` passed English/Turkish at 375px, 768px, and 1440px, including actual-label matching, example wrapping, static semantics, existing guide panels/tip destinations, and single-scroll behavior. Representative tablet Turkish output was visually inspected.
- ESLint, documentation, assets, packs, and cache-busting validation passed; `node --test` passed **750 tests**. CSS and service-worker fingerprints were regenerated.
- The aggregate `npm run check` remains blocked by an unrelated existing type error: `placementTarget` is missing from `StoreAction` in `js/core/reducers/scene-reducer.js:165`. No guide runtime or storage changes were introduced.
- The [live tutorial PRD](PRD-GUIDE-AND-LIVE-TUTORIAL.md) records the requested optional real-page teaching flow. Tutorial implementation and external child/iPad checks remain pending.


- The initial correction pass ran `npm run check`: lint, types, documentation, assets, packs, cache validation, and **727 tests passed**. The tip test covers mode changes during a fade, matching destinations, and subscription/timer cleanup.
- The completion pass adds `npm run test:guide-browser`, using the same optional `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE` setup as the other browser scripts. It reproduces the old nested-scroller failure and verifies the corrected behavior. Screenshots and results are saved under `scratch/guide-browser/`.
- Final completion check: `npm run check` passed lint, types, all validators, and **736 tests** against the current workspace. Translation key and placeholder parity remain intact. Existing copy assertions were updated for the revised Turkish wording.
- Isolated Chromium checks: English and Turkish at **375px, 768px, and 1440px**, covering all four guide panels (**24 panel combinations**), translated shortcuts, stale instruction removal, help/family sections, and horizontal overflow.
- On layouts showing the header chip, checked links to Play, Outline/Layers, Paint, and Designer help, including destination-card visibility. No browser JavaScript errors occurred.
- Verified a single vertical scroll area in Guide, Project & Backups, and a long Layers list, plus wheel scrolling, touch swipes on phone/tablet layouts, bottom-content reachability, guide reopening, and Layers drag-edge autoscroll. Checked both languages at all three viewport widths.
- Visually inspected representative rendered Quick Start, feature, and Tips panels. Browser contexts used isolated current-version storage; the user’s saved projects and language were unchanged.
- Updated the service-worker cache fingerprint so hosted clients can receive the revised HTML and modules on their next successful online update.

Limits: no child usability study, physical iPad offline test, or live microphone permission test. Automated checks verify behavior and translation wiring; they do not prove every instruction understandable to every child.
