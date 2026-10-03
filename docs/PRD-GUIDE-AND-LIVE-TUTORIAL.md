# PRD — Guide button examples and live studio tutorial

Date: 2026-10-03

## Status and accepted design

| Deliverable | Status | Scope |
|:--|:--|:--|
| A: existing four-tab guide with button examples | Implemented | Quick Start keeps all four first-scene cards together and adds translated, static examples of the controls to find. |
| Five-part guide navigation | Not selected | Keep Quick Start, How to Play, Try These Ideas, and Shortcuts. |
| Live, one-step-at-a-time tutorial | Specified, not implemented | An optional Tutorial action will guide the player through the real studio. No tutorial entry button or runtime controller ships with the button-example change. |
| Child and physical iPad validation | Pending | Browser checks cannot establish comprehension or physical-device behavior. |

The user selected design A from the isolated guide demo on 3 October 2026 and
requested a tutorial as an additional feature. A focused tutorial supplements the
persistent guide; it does not replace its tabs or turn the studio into a wizard.
See [guide content review](GUIDE-CONTENT-REVIEW.md) for corrected copy and external
validation, [PROJECT.md](PROJECT.md) for product contracts, and
[ROADMAP.md](ROADMAP.md) for delivery status.

## Implemented: button examples

Each Quick Start card shows a caption explaining that these are examples of
controls to find in the studio, followed by compact button-shaped labels:

1. Designer → Save Doll → Save new.
2. Play → Dolls → your saved doll card.
3. Movement → Bounce.
4. Save Scene → Save New → Scene → Scenes.

Examples reuse the real controls' locale keys wherever possible, including their
icons and save-button color. They are text spans, not actionable or disabled
buttons, and do not enter the keyboard tab order. Sequences wrap on narrow screens.
Instructions still explain naming, selecting the doll, and the optional bubble
path. The guide retains its single vertical scroll area, tip destinations, phone
visibility rule, and 7.5-second tip rotation. No storage or schema change is needed.

## Planned: tutorial in the real page

### Goal and entry

Teach a first successful scene by letting the player perform real actions on real
controls. Provide **Start Tutorial / Öğreticiyi Başlat** in Quick Start and a
**Tutorial / Öğretici** entry in the existing help/menu area. Starting closes the
guide and shows a small, non-modal instruction panel plus a highlight around the
current target. Do not auto-start, request a microphone, or require reading the
whole guide. Keep Back, Exit, progress such as “Step 2 of 8,” and a restart option
available with translated, visible labels.

### First tutorial: dress, save, stage, move, save, reopen

| Step | Instruction and actual target | Evidence required to advance |
|:--|:--|:--|
| 1 | Open Designer and tap a clothing card. | A clothing equip action succeeds for the current doll. |
| 2 | Tap Save Doll. | The doll save dialog opens. |
| 3 | Enter a name and save a new doll. | Persistence reports a successful save; remember that preset's ID. |
| 4 | Open Play, then Dolls. | The saved-doll tray is visible. |
| 5 | Tap the doll just saved. | A character from that preset is added; remember the new entity's ID. |
| 6 | Select that doll, open Movement, and choose Bounce. | That character's movement is committed. Reduced motion may keep it still; acknowledge the selected setting. |
| 7 | Tap Save Scene, enter a title, and save a new page. | Scene saving succeeds; remember the scene's ID. |
| 8 | Open Scene → Scenes and open that page. | The saved scene is loaded successfully. |

Use smaller prompts within a step when a menu or dialog must first be opened.
Highlight only a currently visible, usable target. Do not highlight hidden
controls behind a dialog. Substeps must follow actual UI state, not a timer.
“Next” is available only after the required action succeeds; opening a save dialog
or pressing its submit button is not a successful save. Completion celebrates the
saved scene and offers return to free play. Paint and Voice remain optional.

### Preserve the player's work

- Starting never resets the Designer, clears a scene, replaces a saved creation,
  or seeds practice data. If the active scene already has content, explain that
  this tutorial will add a doll to it. Offer to continue there or cancel; creating
  a fresh scene must use the existing New Scene confirmation and recovery flow.
- Tutorial actions use existing commands, validation, undo, and save dialogs.
  The guide must not auto-equip, auto-name, auto-save, or silently navigate away
  from a dialog with entered work. A successful tutorial save creates a new doll
  or scene rather than overwriting an existing creation.
- Back changes the instructions, not the artwork. Exit and Escape remove the
  tutorial UI and listeners; creations remain. Exit must not consume Escape while
  a normal dialog is using it. Restart resets tutorial progress only.
- If a target is deleted, undone, filtered out, or the mode changes, re-evaluate
  the current step and show the action needed to recover. Save failure keeps the
  step pending and exposes the existing retry message. Do not trap the player or
  create duplicate saves while recovering.

### Architecture and accessibility

Use a small transient tutorial controller with explicit steps, target resolvers,
and completion predicates. Observe existing store/command/save-success signals;
do not infer success from arbitrary DOM clicks or poll on a timer. Reuse normal
navigation and selection APIs. Keep tutorial state outside the persisted project
envelope; no schema migration, progress storage, or automatic reload resume in v1.
Dispose subscriptions, observers, and highlights through established teardown.

The instruction panel must remain readable beside the target at tablet and desktop
sizes and reflow on narrow screens. Scroll a target into view only when entering a
step, respecting reduced motion. Position highlights against actual target bounds
on resize, orientation change, and scroll. The highlight must not intercept taps,
cover its target, obscure save errors, or introduce a second vertical scroll area.

Support touch and keyboard equivalently. Use semantic buttons, visible focus,
a concise accessible description of the target, and polite announcements on step
changes. Do not move focus after every render or loop an attention animation.
Real dialogs keep their existing focus handling. Both English and Turkish must
use the visible control labels and fit without clipped text.

### Later tutorials

After validating the first-scene flow, separately scope draw → save → wear a top,
finding a covered item through Outline/Katmanlar, and placing a small prop on
furniture. These are future extensions, not requirements of the first controller.
Offline installation and microphone permissions remain family guidance and
physical-device checks, not scripted first-success steps.

## Acceptance and verification

For the implemented guide, verify English/Turkish label parity, all four cards,
non-actionable examples, narrow-screen wrapping, all existing tabs and tip links,
and a single vertical scroll area. Run `npm run check` and the isolated guide
browser script. Regenerate the CSS/service-worker fingerprints for hosted updates.

Before releasing the tutorial, verify the real path with isolated browser storage
in both languages, pointer/touch/keyboard input, reduced motion, orientation and
viewport changes, save failure/retry, full libraries, cancel/exit/restart, undo,
missing targets, manual navigation, pre-existing work, and listener cleanup.
A successful scene must reopen after reload using existing persistence. Test that
no step can advance on failed saves and no tutorial action silently clears or
overwrites existing work.

Observe children completing the path without adult prompts and record hesitation,
wrong targets, and requested help; compare with the static guide. Perform a real
iPad Safari session for touch, focus, layout, and save/reopen. Document offline
and microphone checks separately using [OFFLINE-PWA.md](OFFLINE-PWA.md).
Browser success alone does not close these external checks.

## Risk and rollback

Guide examples may look tappable; the caption and static semantics clarify their
purpose. Removing the example blocks and styles restores the prior guide layout.
The planned tutorial risks stale targets, focus disruption, false save completion,
and interference with existing work. Keep it opt-in, transient, and command-driven;
its eventual entry and controller should be independently removable without a
migration or loss of creations.
