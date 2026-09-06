# PRD — Papercraft Scene Transitions & Simple Slideshow (*Sahne Geçişleri ve Gösteri Modu*)

**Feature**: Tactile Scene/Background Transitions & Scene Book Slideshow  
**Status**: Approved Specification (Simplified & Tactile)  
**Target Milestone**: Gate E Expansion  
**Date**: 2026-09-03  

---

## 1. Product Goal & Philosophy

Bring scene changes to life with **tactile papercraft transitions** instead of abrupt, jarring DOM snaps, and provide a lightweight, zero-friction way to flip through saved scenes like a picture book.

Instead of a complex video timeline editor or heavy multi-chapter playlist engine, we focus on what makes paper doll play magical: **the physical feeling of turning a storybook page or parting a theater curtain**.

---

## 2. Core Features

### 2.1 Tactile Transitions (When Changing Backgrounds or Scenes)
Whenever a player switches backgrounds (via the World Map or selector) or loads a saved scene, the stage transitions using one of two charming papercraft effects:

1. **📖 Sayfa Çevirme (Paper Page Flip - Default)**:
   - A crisp 0.4s 3D page curl from the right edge with soft drop shadows and an authentic paper-turn curve.
   - Mimics turning the page of a classic hardcover storybook.
2. **🎭 Tiyatro Perdesi (Paper Curtain)**:
   - Scalloped red paper puppet-theater curtains that sweep shut with an accordion fold, pause for a beat, and part open to reveal the new setting.
3. **✨ Rüya Geçişi (Dream Dissolve)**:
   - A warm, starry soft fade ideal for night or fantasy scenes.

*Accessibility & Performance*:
- Respects `prefers-reduced-motion`: gracefully switches to an instant 0.15s opacity cross-fade.
- Zero WebAssembly or heavy libraries: 100% CSS transforms (`perspective`, `rotateY`, `transform-origin`).
- Locked 60fps performance on iPad Safari.

---

### 2.2 Simple Slideshow in Scene Book (`[ ▶ Oku / Play ]`)
Instead of building a separate "Story Sequencer" tool, we enhance the existing Scene Book with a 1-click presentation mode:

1. **How to Trigger**:
   - In the existing Scene Book dialog (`#scene-book-dialog`), players see a simple **`[ ▶ Oku / Read Stories ]`** button alongside their saved scenes.
2. **The Theater View**:
   - The stage fills the screen cleanly: editing tools, spawn trays, and outlines smoothly hide.
   - The characters' looping animations (waves, bounces, smiles) and speech bubbles remain active and alive.
3. **Flipping Through Scenes**:
   - Simple, semi-transparent paper arrow tabs appear at the sides: `[ ◀ Önceki ]` and `[ Sonraki ▶ ]`.
   - Keyboard support: `Left Arrow`, `Right Arrow`, or `Spacebar` to turn the page.
   - Pressing `Escape` or tapping `✕ Kapat` instantly returns to normal editing mode.

---

## 3. Scope & Technical Simplicity

### 3.1 What We Kept (The Good Stuff)
- Beautiful, high-delight CSS paper page turns and curtain sweeps.
- Clean distraction-free slideshow reader for existing saved scenes.
- Zero-lag performance on mobile and tablets.

### 3.2 What We Removed (Eliminating Bloat)
- ❌ No new database schemas (no Schema v7 envelope, no custom story playlists).
- ❌ No chapter reordering forms, narration text input boxes, or auto-play delay formulas.
- ❌ No multi-page PDF compilation or printing stylesheets.
- ❌ Uses the existing `scenes` array in state directly.
