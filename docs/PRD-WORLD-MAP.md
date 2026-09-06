# PRD — The Papercraft World Map (*Diyar Haritası*)

**Feature**: Illustrated World Map & Tactile Location Selector (*Diyar Haritası*)  
**Status**: Implemented — wide scrollable canvas (Gate E Expansion)  
**Target Milestone**: Gate E Expansion  
**Date**: 2026-09-03  

---

## 1. Product Goal & Philosophy

Transform background selection in Play mode from a dull HTML `<select>` dropdown into a joyful, tactile **Papercraft World Map (*Diyar Haritası*)**.

Instead of complex multi-level menus or heavy RPG progression, the World Map is treated as a **delightful paper toy**:
1. **The Unfolded Storybook Map**: Clicking `[ 🗺️ Harita ]` unfolds a charming, hand-drawn paper map with subtle fold creases, deckle paper edges, and a gentle paper rustle.
2. **Illustrated Buildings Instead of Pins**: Rather than generic map markers, each location is an illustrated papercraft building or landmark (cottage, bakery, pier, gingerbread castle) that gently lifts up with a paper shadow on hover.
3. **"You Are Here" Mini Doll Marker**: A cute miniature paper cutout of the player's active doll stands at the current location.
4. **Playful Easter Eggs & Souvenir Stamps**: Tapping little details on the map (chimney smoke, a sleeping kitten under a bench, a spinning pinwheel) triggers tactile micro-animations and adds a cute souvenir stamp to the map border.
5. **Seamless Travel**: Choosing a location and tapping **"Git / Go"** smoothly closes the map with a paper page-turn transition into the selected room.

---

## 2. Scope & Design

### 2.1 In Scope (Simple & High Delight)
- **Map Button**: A compact `[ 🗺️ Harita: Sıcak Yatak Odası ▾ ]` pill button in the Play header replacing the native `<select>`.
- **Unfolding Map Modal (`#world-map-dialog`)**:
  - Smooth 0.4s paper unfold opening animation.
  - Vector SVG parchment map divided into 3 cozy biomes:
    - 🏡 **Sevimli Kasaba (Cozy Town)**: Cottage (Bedroom), Bakery (Cafe), Loft (Atelier), Brick Library.
    - 🌲 **Doğanın Kalbi (The Wilds)**: Picnic Pavilion (Park), Pier & Waves (Beach), Ancient Oak (Forest).
    - ✨ **Rüya Diyarları (Dream Realms)**: Gazebo (Meadow), Chalet (Snowy Village), Clocktower (Sunset City), Gingerbread Palace (Candy Land).
  - Clickable illustrated buildings with 3D paper lift pop-up on hover/focus.
  - Active doll paper cutout standing at the active location.
- **Interactive Easter Eggs**:
  - Cottage chimney: puffs animated paper smoke.
  - Bakery bench: hidden kitten peeks out with a purr.
  - Oak tree: curious squirrel peeks out with an acorn.
  - Candy castle: peppermint pinwheel spins.
  - Discovered easter eggs ink a small souvenir stamp onto the vintage paper border of the map.
- **Location Preview & Travel**:
  - Tapping a building shows its name, room preview thumbnail, and a **"🚀 Buraya Git / Travel Here"** button.
  - Tapping "Travel Here" triggers a smooth paper page-turn transition into the new background.
- **Zero Gating (today)**: All 11 shipped backgrounds remain 100% unlocked and freely selectable. The unlock engine exists and is rendered end-to-end so future realms can ship locked without reworking the map.

### 2.2 Out of Scope (Keep It Simple)
- ❌ No multi-tab drawers, complex stamp inventory books, or PDF export engines.
- ❌ No RPG grid walking, stamina, or tile movement.
- ❌ No database migrations or new storage versions.

---

## 3. The 11 Illustrated Landmarks

| Location ID | Name (TR / EN) | Illustrated Landmark | Playful Easter Egg |
|:---|:---|:---|:---|
| `bedroom` | Sıcak Yatak Odası / Cozy Bedroom | Paper cottage with glowing windows | Tap chimney ➔ puffs cozy smoke |
| `cafe` | Pastane & Kafe / Bakery & Cafe | Striped awning boutique | Tap bench ➔ sleeping kitten peeks out |
| `atelier` | Sanat Atölyesi / Art Atelier | Painter's timber loft with skylight | Tap easel ➔ colorful paint splash |
| `library` | Büyük Kütüphane / Grand Library | Stately brick library with dome | Tap roof ➔ owl turns head |
| `park` | Güneşli Park / Sunny Park | Wooden picnic pavilion & flowerbeds | Tap flowers ➔ fluttering butterfly |
| `beach` | Kumsal & Deniz / Sandy Beach | Boardwalk pier & striped umbrella | Tap tide ➔ bobbing bottle with letter |
| `forest` | Büyülü Orman / Enchanted Forest | Hollow ancient oak tree | Tap hollow ➔ squirrel peeks out |
| `moonlit-meadow` | Mehtaplı Çayır / Moonlit Meadow | Hilltop gazebo under willow trees | Tap moon ➔ rocks with glowing fireflies |
| `snowy-village` | Karlı Köy / Snowy Village | Alpine chalet with snowy roof | Tap chimney ➔ flurry of paper snowflakes |
| `city-sunset` | Gün Batımı Şehri / Sunset City | Art-deco clocktower on promenade | Tap clouds ➔ hot air balloon drifts |
| `candy-land` | Şeker Diyarı / Candy Land | Gingerbread castle with frosted spires | Tap pinwheel ➔ spins like a windmill |

---

## 4. Technical Architecture

### 4.1 State & Actions
- Zero custom database tables or schema overhauls.
- Background switching uses the existing, rock-solid Redux action:
  ```javascript
  store.dispatch({ type: 'scene/setBackground', backgroundId });
  ```
- Souvenir stamp IDs (purely for cosmetic delight) are saved in the existing settings object:
  ```javascript
  // Saved in existing paperDollStudio.state.settings
  {
    "soundEnabled": true,
    "stamps": ["kitten", "chimney", "moon"]
  }
  ```

### 4.2 Asset & Rendering
- **Single inline SVG**: the parchment and all landmark artwork live in one `<svg>` inside `index.html`. There is deliberately **no** standalone `assets/ui/world-map.svg` — a second copy drifts from the inline one and wastes a precache entry.
- **Lightweight SVG & CSS**: 60fps on iPad, hardware-accelerated transforms, zero runtime dependencies.
- **Accessibility**: The map root is `role="group"` (never `role="img"`, which is children-presentational and would hide all 22 landmark/easter-egg buttons). Landmark buttons carry localized `aria-label`s and arrow-key focus navigation; keyboard focus pans the camera to the focused realm.

### 4.3 The wide, scrollable canvas

The map is a **2400 × 900** canvas — roughly twice the width of the visible window — panned like the panoramic play stage.

- `MAP_CANVAS` in `js/domain/world-map-catalog.js` defines the canvas and is asserted against the SVG `viewBox` by tests.
- `#world-map-camera` is a native horizontal scroll container: touch drag, trackpad, scrollbar and keyboard all work for free. Pointer drag-to-pan, `◀`/`▶` step buttons, a minimap strip (biome bands + landmark dots + viewport window) and a fit-whole-map toggle sit in the HUD beneath it.
- Opening the map centres the camera on the player's current realm; selecting a realm with the keyboard pans it into view.
- `clampCameraX`, `cameraXForLandmark` and `landmarkMapRatio` are pure functions in the catalog so the camera maths is unit-tested without a DOM.
- Camera glide is a manual `requestAnimationFrame` easing: `scrollTo({ behavior: 'smooth' })` is unreliable for scrollers inside a top-layer `<dialog>`.

### 4.4 The SVG transform contract (important)

CSS `transform` **replaces** an SVG `transform` presentation attribute rather than composing with it. An element positioned by the attribute and lifted/animated by CSS therefore snaps to the map origin.

The map keeps the two concerns on separate elements:

| Element | Owns | Never gets |
|:---|:---|:---|
| `.map-landmark-anchor`, `.sprite-anchor`, `.active-doll-marker-anchor` | the positioning `transform` attribute (set from the catalog by JS) | any CSS `transform`, keyframe, or reduced-motion reset |
| `.map-landmark`, `.marker-flag`, easter-egg sprites | CSS hover lift and keyframe animation | a `transform` attribute |

This includes the `prefers-reduced-motion` block: resetting `transform` on an anchor collapses every realm onto the origin. `test/world-map.test.js` enforces both halves of the contract.

### 4.5 Adding a realm (including locked ones)

1. Add a `WORLD_MAP_LANDMARKS` entry with `coord`, `biome`, i18n keys and a `stampId`. Set `unlockedByDefault: false` plus an `unlockRequirement` (`stamp_count` or `easter_egg`) to ship it locked.
2. Add the artwork as `<g class="map-landmark-anchor" data-landmark-id="…"><g id="landmark-…" class="map-landmark" …>` in `index.html` — **with no `transform` attribute**; `layoutLandmarks()` positions it.
3. Add the `worldMap.landmarks.*` strings in both TR and EN.

Lock state is rendered on the map itself (`.is-locked` desaturation, `aria-disabled`, inert easter egg) and `travelToLandmark` refuses locked realms even if a caller bypasses the preview dock.
