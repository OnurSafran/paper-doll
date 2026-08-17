# Product Requirements Document
## Character Customization Expansion

**Product:** Paper Doll Studio  
**Document status:** Implementation review / shipped contract  
**Release:** Character customization v4  
**Scope owner:** Product, art, and engineering review  
**Related contracts:** [PROJECT.md](PROJECT.md), [ARCHITECTURE.md](ARCHITECTURE.md), [CUSTOM-PAINT-STUDIO.md](CUSTOM-PAINT-STUDIO.md), [ASSETS.md](ASSETS.md), [QUALITY.md](QUALITY.md)

This document records the character-customization contract and the decisions that shaped the current implementation.

## 1. Executive summary

Paper Doll Studio supports a calm dress-up loop with six base dolls, catalog hair and clothing, Dollbox presets, Play-stage storytelling, seven expressions, local voice puppetry, PNG export, and an offline raster Paint Studio for six wearable slots and props. Character identity is composed from model, face, hair, and wardrobe choices.

The expansion makes a character feel authored without turning the product into a character editor. It adds:

1. **More body models and narrative life stages** so a story can include babies, children, teens, adults, and elders.
2. **Presentation-style variety** so feminine, masculine, neutral, and mixed styling are available without treating presentation as a required identity field.
3. **Modular resting facial features** for eyes, iris color, eyebrows, noses, mouths, and small details.
4. **Single-layer custom hair authoring** through the existing Paint Studio contract.

The central design decision is that these are separate axes:

```text
life-stage label     body model / silhouette     presentation style
        +                         +                       +
                    face + hair + wardrobe
                              |
                     saved character preset
```

No single axis should silently determine the others. A player may choose a neutral body model with feminine styling, an elder character with a playful haircut, or any other combination that the art and fit contracts support.

## 2. Problem and opportunity

### Current limitations

- The original three dolls are expressive, but the initial release needed more silhouette and life-stage range.
- Eyes and other facial features are embedded in the base doll artwork, so small identity choices require new complete dolls.
- Catalog hair is reusable, and Paint Studio supports bounded single-layer custom hair rendered in front of the face. Split front/back authoring remains a future extension.
- The draft idea uses age, gender, body shape, and clothing fit as if they were one model. That would create awkward labels, excessive asset combinations, and fragile global transforms.

### Player jobs

- “I want several characters in my story to look related but not identical.”
- “I want a baby, grandparent, or grown-up character without changing the visual language of the app.”
- “I want to choose a face and style that feels like my character.”
- “I want clothing and hair to remain usable when I change the character model.”
- “I want my saved dolls and scenes to survive refresh, offline use, export, and missing custom artwork.”

## 3. Product goals and non-goals

### Goals

- Expand storytelling range while preserving the gentle paper-cutout art direction.
- Make character choices understandable to a child using progressive disclosure rather than a large form.
- Keep body model, life-stage label, presentation style, face, hair, and wardrobe independently understandable.
- Preserve the current Designer, Play, Scene Book, export, voice, persistence, and offline contracts.
- Keep all player-created art and character data on-device.
- Provide complete English and Turkish strings for every visible control, asset name, warning, and accessibility announcement when the feature ships.
- Make every visual result deterministic from serializable state and catalog metadata.

### Non-goals

- A gender identity questionnaire or a required gender field.
- Realistic anatomy, body measurement, medical interpretation, or sexualized styling.
- Freeform skeletal posing, 3D models, automatic face generation, or photorealistic avatars.
- A general-purpose vector editor.
- Cloud accounts, sharing feeds, multiplayer, analytics, or remote image processing.
- Automatically forcing every garment onto every body through a global scale transform.

## 4. Product principles and guardrails

### 4.1 Use neutral product language

The UI may offer **Feminine**, **Masculine**, **Neutral**, and **All styles** as wardrobe or presentation-style filters. It must not label the choices as “Girl doll” and “Boy doll,” and it must not store `gender: female|male` merely because a player selected a visual model.

Presentation style describes the visual language of a model or item. It does not claim anything about the player or the character’s identity.

### 4.2 Treat age as a story label, not a diagnosis

The UI uses child-friendly life-stage labels such as **Baby**, **Child**, **Teen**, **Adult**, and **Elder**. These labels describe the intended story role and art direction. They do not represent exact ages, development, health, or body measurements.

The art review must reject mature or sexualized styling for child-coded models and reject caricatures of elder characters. Age-specific items should communicate story context through everyday objects, clothing, and posture.

### 4.3 One authoritative rendering choice

`baseDollId` remains the authoritative identifier for the exact body artwork that is rendered. Life-stage and presentation metadata belong in the catalog, not in duplicated preset fields that can disagree with the doll.

If the product later needs a player-selected semantic life-stage independent from a body model, that is a separate decision and migration. It is not assumed here.

### 4.4 Preserve intent on change

Changing a model, face, hair, or wardrobe filter must not silently delete saved work. An unavailable or incompatible item remains referenced and receives a labeled placeholder or fit warning until the player replaces or removes it.

### 4.5 Prefer measured fit contracts

Every new body model and wearable must be validated against shared logical coordinates and explicit anchors. A guessed transform table is not a fit strategy. Global scaling may be used only when a measured art fixture proves that it preserves neck, shoulder, waist, hand, foot, and hem alignment.

### 4.6 Keep custom art bounded

The existing Paint Studio is raster-first, local, and quota-bounded. Custom hair uses the same one-PNG contract as other wearable art and renders at the front-hair layer. Split-layer storage is intentionally deferred; it must not quietly turn the painter into an unrestricted image editor.

## 5. Current baseline and constraints

The proposal must fit the current product rather than assume a new application:

| Area | Current contract | Implication for this proposal |
|:--|:--|:--|
| Base dolls | 6 cataloged models across 5 life stages | New models need catalog IDs, provenance, view-box, required-group, and fit metadata. |
| Doll space | Wearables share `300 × 450` logical coordinates | New compatible artwork should use this space; model-specific guides must be data-driven. |
| Outfit slots | `hair`, `top`, `bottom`, `dress`, `shoes`, `accessory` | Hair remains one logical slot; built-in hair may use two SVG groups while custom hair is front-only. |
| Hair rendering | Built-in hair may expose `hairBack` and `hairFront` | Custom hair is one front-layer PNG at Layer 70; split rendering is future scope. |
| Expressions | `neutral`, `smile`, `happy`, `surprised`, `o_mouth`, `talking`, `wide_open` | Facial customization must not rename or break these persisted scene values. |
| Voice | Local microphone analysis drives ephemeral mouth previews | Voice mode must not mutate the saved resting face or store audio. |
| Persistence | Current serialized envelope is schema version 4 | v3 projects receive additive default-face migration on load. |
| Custom art | PNG bytes in IndexedDB; metadata in the project envelope; six wearable slots plus props | Custom hair uses one bounded front-layer PNG and fit metadata. |
| Limits | 30 custom assets, 2 MB per asset, 30 MB total custom bytes, 50 presets, 30 scenes | New custom-hair records must fit an approved quota model. |
| Offline/privacy | No uploads, remote fonts, trackers, or server processing | All catalog and custom character behavior remains local. |

## 6. Character model

### 6.1 Composition model

A character consists of these independent concerns:

1. **Base doll:** the exact body and head silhouette.
2. **Skin tone:** an existing palette token or a reviewed extension of that palette.
3. **Face:** modular resting features, with optional semantic colors.
4. **Hair:** one catalog or custom logical slot; built-in SVG hair may use back and front groups, while custom PNG hair is front-only.
5. **Wardrobe:** existing deterministic slots and conflict rules.
6. **Presentation style:** derived from catalog metadata and used for discovery/filtering, not as a required identity property.
7. **Life-stage label:** derived from the selected base doll’s catalog metadata for display, filtering, and authoring context.

### 6.2 Catalog metadata proposal

The existing asset catalog remains the source of built-in artwork. The current catalog uses the following shape:

```javascript
{
  id: 'doll_chibi_a',
  kind: 'doll',
  name: 'Chibi doll',
  lifeStages: ['child'],
  presentationStyles: ['neutral'],
  fitFamily: 'child',
  viewBox: [0, 0, 300, 450],
  requiredGroups: ['body']
}
```

Wearables and hair use compatible metadata rather than hard-coded UI rules:

```javascript
{
  id: 'top_cardigan_classic',
  kind: 'wearable',
  slot: 'top',
  presentationStyles: ['neutral'],
  supportedFitFamilies: ['teen', 'adult', 'elder'],
  tintable: true
}
```

Compatibility, style tags, life-stage metadata, and provenance are centralized and testable. Future models should follow these fields rather than introduce parallel state properties.

## 7. Capability requirements

### 7.1 Body models and life stages

#### Product outcome

Players can choose a body model from a small, friendly model picker. The picker explains the visual result without presenting a dense matrix of age × gender × body controls.

#### Initial life-stage set

| Life-stage label | Art direction | Initial scope |
|:--|:--|:--|
| Baby | Rounded proportions, short limbs, soft posture, simple everyday clothing | One reviewed model and a small starter wardrobe |
| Child | Playful proportions, active posture, everyday school/play clothing | One reviewed model and compatible core wardrobe |
| Teen | Current balanced classic direction | Existing classic models are mapped after art review |
| Adult | Taller or more mature silhouette without realism or sexualization | One reviewed model and a small starter wardrobe |
| Elder | Relaxed posture and gentle mature styling; avoid caricature | One reviewed model and a small starter wardrobe |

These are art-direction briefs, not numeric anthropometric specifications. Do not commit to head-to-body ratios such as `1:2.8` or `1:6.8` until the art team has approved reference sheets and the renderer has passed anchor fixtures.

#### Body-model requirements

- Every model uses the shared `300 × 450` doll coordinate system unless an explicit renderer decision approves another contract.
- Every model has documented anchors for head, ears, neck, shoulders, waist, hands, feet, and ground baseline.
- Base artwork is child-safe, stylized, and consistent with the current paper-cutout language.
- Body model selection never changes the saved character’s face, hair, colors, or wardrobe without an explicit player action.
- The model picker exposes only models with a reviewed compatibility matrix.
- The current three dolls remain valid and do not change appearance as a side effect of adding new models.

#### Presentation style requirements

- A model may support one or more presentation-style tags.
- Style tags affect discovery and suggested catalog items; they do not determine skin tone, face, life stage, or player identity.
- Wardrobe filters include **All**, **Feminine**, **Masculine**, **Neutral**, and, where useful, **Unsorted** for items without a style tag.
- The filter never removes an equipped item from the character. It changes the visible catalog only.

#### Clothing fit requirements

- A built-in wearable is offered for a model only after visual review at default scale, recolor, all supported expressions, and export resolution.
- A wearable declares its supported fit family or supported body-model IDs. “Universal” is a tested status, not a default assumption.
- Changing models retains equipped items that remain compatible. If a future item is not compatible, the player receives a clear warning and the item remains recoverable.
- No silent auto-clear, arbitrary crop, or unbounded scale compensation is allowed.
- Custom wearable art keeps the existing `300 × 450` contract and uses the same placeholder behavior when its bytes are missing.

#### Suggested content, not a launch commitment

- Baby: bib, romper, knit booties, pacifier, rattle.
- Child: overalls, sneakers, school bag, rain hat.
- Teen: the current core wardrobe plus reviewed additions.
- Adult: cardigan, coat, work bag, everyday shoes.
- Elder: cardigan, shawl, spectacles, walking cane.

Every item is reviewed for fit, respectful depiction, accessibility naming, and whether it adds a useful storytelling choice rather than a stereotype.

### 7.2 Modular facial features

#### Product outcome

Players can set a resting face in Designer without replacing the whole base doll. The selected face remains recognizable in Designer, Play, Scene Book thumbnails, reloads, project transfer, and PNG export.

#### Feature groups

- **Eyes:** several expressive styles with optional iris recoloring.
- **Eyebrows:** soft, bold, arched, worried, and other reviewed styles.
- **Nose:** dot, button, line, soft curve, and freckled variants.
- **Resting mouth:** gentle smile, open smile, playful, smirk, and neutral variants.
- **Details:** freckles, cheek marks, beauty marks, or blush accents that are appropriate for the art direction.

The initial catalog should launch with a small, clearly distinct set. Seven eye styles, five nose styles, five mouth styles, and four eyebrow styles are a content ceiling for the first release, not a requirement to create every item before the system is usable.

#### Face rendering contract

The renderer uses semantic layer groups. The exact DOM/SVG implementation is an engineering detail, but the order must preserve these relationships:

```text
hair back
base body and head
eyes
eyebrows
nose and details
resting or expression mouth
bottom
shoes
top or dress
hair front
accessories and eyewear
```

The base doll migration removes only the facial artwork that is replaced by a modular group. Skin, ears, head silhouette, and approved blush remain part of the base model unless art review decides otherwise. The migration must not make the existing dolls look different when their default face is selected.

#### Color contract

- Use semantic tokens such as `irisColor`, not generic `color` fields whose meaning changes by feature.
- Iris palettes must retain adequate contrast against the eye white and remain distinguishable in forced colors.
- Eyebrow and feature tinting is optional per asset. If a raster or vector asset cannot safely recolor, the UI does not show a misleading color control.
- Color names are localized and never rely on hue alone.

#### Expression and voice precedence

1. Designer shows the selected resting face.
2. Play shows the selected scene expression using the existing seven expression values.
3. A static Play expression may replace or overlay only the expression-compatible groups, normally the mouth and, when explicitly authored, the eyes.
4. Voice Puppetry provides an ephemeral mouth preview while active. It does not rewrite the resting mouth, saved preset, scene expression, or artwork bytes.
5. When voice stops, the selected scene expression is restored. When the scene returns to its neutral expression, the resting face is visible.
6. If a face asset has no expression variant, it remains unchanged rather than being stretched or replaced with an unrelated style.

This avoids the draft’s ambiguous promise that every custom eye should automatically morph for every expression.

### 7.3 Custom hair authoring

#### Prerequisite and scope boundary

The current [Custom Paint Studio](CUSTOM-PAINT-STUDIO.md) now supports custom hair as a bounded wearable slot. The shipped contract is one transparent PNG, one logical hair item, front-layer rendering, local persistence, project portability, and recoverable missing-art behavior. Split front/back authoring is a future design spike.

#### Product outcome

Players can create a hairstyle, preview it on a supported model, save it locally, and equip it as one hair choice. A player should not need to understand render layers to make a usable hairstyle.

#### Authoring experience

- Entry from the Designer Hair tab and from the Paint route.
- Shared `300 × 450` logical canvas and transparent PNG output at the existing `600 × 900` backing resolution unless a measured quality spike changes it.
- Non-saving reference overlays for head contour, hairline, crown, ears, neck, shoulders, and center axis.
- Starter references from existing catalog IDs such as `hair_short`, `hair_ponytail`, `hair_bun`, and `hair_curly`; these are references, not invented asset names.
- Simple mode for a front-cap hairstyle.
- Split front/back authoring is explicitly out of scope for this release.
- Explicit preview of the hair behind the body, in front of the face, and with accessories.
- `Save & wear` from Designer; `Save to My Art` from the standalone Paint route.
- Custom raster hair is not automatically recolored unless the asset was created with a supported semantic recolor contract. Otherwise the color control is hidden and editing a copy is the path to a new color.

#### Hair storage requirements

A custom hair item references one PNG artwork record. Artwork bytes remain in IndexedDB; metadata and references remain in the versioned project envelope. It includes:

- logical item ID and display name;
- `kind: 'wearable'` and `slot: 'hair'`;
- logical PNG dimensions, byte length, digest, timestamps, and availability status;
- compatible fit families and presentation styles;
- recoverable placeholder behavior when the artwork is missing.

Do not infer depth or split layers from the raster at render time.

#### Guide correctness

Hair guides must use the existing data-driven guide approach in `paint-guides.js`. The PRD does not hard-code an unverified head ellipse or assume that all models share the same facial coordinates. Every model × hair mode guide set must be in bounds, aligned with the preview, excluded from saved pixels, and covered by deterministic fixtures.

## 8. Designer experience

### 8.1 Progressive disclosure

The Designer keeps one primary stage and three logical control areas:

1. **Model:** base model, life-stage context, presentation-style suggestions, skin tone.
2. **Face:** eyes, iris color, eyebrows, nose, resting mouth, details.
3. **Wardrobe:** hair, tops, bottoms, dresses, shoes, accessories, style filters, and Paint entry points.

The stage updates immediately. Controls use labeled text with optional decorative icons. The current outfit and saved Dollbox flow remain recognizable.

### 8.2 Required actions

- Choose a model and cancel before committing if the change would show incompatible items.
- Choose or reset each face group independently.
- Set iris color separately from eye style.
- Filter wardrobe by style without changing equipped items.
- Paint or edit custom hair only when the hair contract is available.
- Reset face, reset model, reset outfit, and reset entire draft as separate actions.
- Randomize within the currently selected compatibility set; do not produce an invalid outfit.
- Save, update, rename, and delete presets using the current Dollbox limits and recovery rules.

### 8.3 Change and failure behavior

| Situation | Required result |
|:--|:--|
| Model change with compatible outfit | Preview updates; outfit and face remain unchanged. |
| Model change with a potential fit conflict | Show the affected items before commit; cancel preserves the draft; confirm preserves references and uses the documented warning/placeholder path. |
| Missing face asset | Labeled face placeholder; preset and scenes remain intact. |
| Missing one custom-hair layer | Labeled missing layer; the other layer is not silently discarded. |
| Unsupported old preset | Safe default or recoverable migration warning according to the project’s schema policy. |
| Storage quota or IndexedDB failure | Keep the active session, preserve the last known-good save, and show unsaved status. |
| Voice permission denied | Stop voice mode; face editing and Play remain available. |

## 9. Accessibility, localization, and privacy

### Accessibility

- Keyboard, pointer, touch, and screen-reader paths reach every model, face, style, color, and wardrobe choice.
- Primary controls and swatches meet the existing `44 × 44 CSS px` target.
- Use native tabs, radio groups, and buttons where they match the interaction. `aria-selected` is for tabs/listbox options; `aria-pressed` is for toggles.
- Selected options have a visible non-color indicator and a localized accessible name.
- A polite live region announces committed changes, compatibility warnings, save results, missing assets, and voice start/stop.
- Forced colors, browser zoom to `200%`, reduced motion, tablet portrait, and keyboard-only navigation are release criteria.
- Facial previews must include meaningful labels; decorative face thumbnails are not the only source of information.

### Localization

- Add English and Turkish strings in the existing i18n structure; do not embed user-facing English or Turkish in feature modules.
- Translate style and life-stage names, not just button labels.
- Announcements include the combined result where useful, for example “Classic eyes, hazel iris selected.”
- Test long labels and compact tablet layouts. Avoid gendered Turkish/English labels that imply identity when the control is only a style filter.
- Update the in-app guide only after the interaction is stable; do not document controls that do not exist.

### Privacy and child safety

- No character image, face selection, microphone data, or custom hair bytes leave the device.
- Microphone analysis remains ephemeral and local; no audio is recorded or persisted.
- No face upload, photo import, biometric inference, or automatic likeness generation.
- Error messages and diagnostics contain stable codes and asset IDs, not drawing contents or personal data.
- The art review rejects content that makes children look mature or frames bodies in a sexualized way.

## 10. Proposed future persistence shape

The current project envelope is schema version 4. The example below describes the persisted character shape used by the current implementation.

### 10.1 How the current version works

Today, `paperDollStudio.state` contains settings, custom-asset metadata, Dollbox presets, saved scenes, and the current scene. A character preset stores `baseDollId`, `skinTone`, and outfit slots. A scene character stores an embedded `characterSnapshot`; it does not depend on a live reference to the Dollbox preset.

Loading follows this sequence:

```text
LocalStorage read
      ↓
JSON parse
      ↓
      v1/v2/v3 → v4 migration when applicable
      ↓
envelope sanitization
      ↓
runtime state
      ↓
normal save writes the current schema
```

The current migration chain is:

- v1 → v2: custom-color schema;
- v2 → v3: custom-assets schema and `customAssets: []` default;
- v3 → v4: modular face data with default-face injection;
- v4: current format;
- unknown or unsupported versions: safe defaults plus recovery/quarantine handling.

Migration produces a valid in-memory envelope. The migrated envelope is normally written back only when a later save occurs; opening an old project does not silently overwrite it immediately.

### 10.2 Version 4: modular face data

The first persisted character change should be a dedicated schema version for modular face data. The migration must update both locations that can contain a character:

1. every Dollbox preset in `presets[]`;
2. every `characterSnapshot` in `currentScene.entities[]` and saved `scenes[].entities[]`.

For each existing character, migration adds a complete default face whose appearance matches the current baked-in face for that `baseDollId`. It must not invent a new expression, recolor, or visual style during migration.

The migration should be idempotent: running it twice produces the same face data and no duplicate fields. A valid existing face is preserved; a missing or invalid face group falls back only for that group and adds a recovery warning.

The required v4 flow is:

```text
v3 envelope
   ↓
add default face to presets and embedded character snapshots
   ↓
sanitize face asset IDs, iris colors, and optional details
   ↓
preserve valid clothing, hair, colors, scenes, and expressions
   ↓
v4 envelope in memory
```

This migration cannot be implemented by changing `sanitizePreset()` alone. The current draft cloning path copies only `baseDollId`, `skinTone`, and `slots`; a new `face` field would otherwise disappear when presets are cloned, scene snapshots are copied, or state is projected for persistence. The face object must therefore be included in draft cloning, preset cloning, scene-snapshot cloning, sanitization, Designer rendering, Play rendering, Scene Book rendering, and PNG export.

### 10.3 Body models and presentation styles do not need a schema bump initially

New body models can be added as catalog assets without changing the persisted character shape. `baseDollId` already identifies the exact rendered doll, so old characters continue to render the same way. Life-stage and presentation-style labels should be derived from catalog metadata rather than duplicated into every preset.

This keeps the initial model change safe:

- old `baseDollId` values remain valid;
- new model IDs are accepted by the existing doll-asset validation once cataloged;
- style filters remain transient UI state;
- no `gender`, `lifeStage`, or `bodyType` field is added merely for display.

If a future product decision requires a player-selected life-stage or presentation value that is independent from `baseDollId`, it must receive its own schema proposal and migration. It must not be added as redundant metadata by accident.

### 10.4 Future custom-hair extension: compound artwork metadata

The current custom-art contract accepts `slot: 'hair'` as one front-layer PNG. A future split-layer extension should remain separate from modular face migration and add compound artwork metadata only after a new design review.

A future version may add one logical custom-hair item that references either:

- one front artwork record; or
- a front/back artwork pair.

The migration and repository contract must preserve the logical hair item, layer references, byte lengths, digests, availability, and compatibility metadata. It must not flatten the layers and try to infer depth later. If one layer is missing, the character remains intact and renders a labeled missing-layer placeholder.

Existing custom tops, bottoms, dresses, shoes, accessories, and props must pass through this migration unchanged.

### 10.5 Failure and recovery rules

- Malformed JSON: quarantine the raw value when possible and load safe defaults.
- Unsupported schema: do not guess; preserve the old value and load safe defaults with a warning.
- Invalid preset child: drop only the invalid preset and report recovery.
- Invalid face group: use that doll’s approved default group and retain the rest of the character.
- Missing custom artwork: retain the reference and show a placeholder; do not remove the preset or scene.
- Storage or quota failure during the first post-migration save: keep the migrated session in memory, preserve the last known-good stored envelope, and show unsaved status.
- Cross-tab revision conflict: require the existing reload/overwrite decision before replacing newer saved data.

```json
{
  "presetId": "preset-emma-01",
  "name": "Emma",
  "createdAt": "2026-08-17T18:00:00.000Z",
  "updatedAt": "2026-08-17T18:00:00.000Z",
  "baseDollId": "doll_classic_a",
  "skinTone": "peach",
  "face": {
    "eyes": { "assetId": "eyes_classic", "irisColor": "cocoa" },
    "eyebrows": { "assetId": "brows_soft" },
    "nose": { "assetId": "nose_button" },
    "mouth": { "assetId": "mouth_gentle_smile" },
    "detail": null
  },
  "slots": {
    "hair": { "assetId": "hair_ponytail", "color": "brown" },
    "top": { "assetId": "top_tshirt", "color": "coral" },
    "bottom": { "assetId": "bottom_jeans", "color": "denim" },
    "dress": null,
    "shoes": { "assetId": "shoes_sneakers", "color": "cream" },
    "accessory": { "assetId": "accessory_glasses", "color": "cocoa" }
  }
}
```

### Persistence requirements

- Keep `baseDollId` authoritative. Derive life-stage and presentation labels from catalog metadata.
- Keep scene `expression` values under the existing scene/entity contract.
- Do not persist UI filter selection, transient voice state, microphone samples, preview overlays, object URLs, or undo stacks.
- Preserve missing custom references as placeholders, consistent with the current project rules.
- If modular face data is introduced, migration must inject the exact default face that reproduces each existing doll’s current appearance.
- Migrate both Dollbox presets and embedded character snapshots; scenes must not lose face data because they store snapshots rather than preset references.
- Make face migration idempotent and group-level recoverable; never replace a valid face or outfit because another face group is invalid.
- Extend all clone, sanitize, render, export, and persistence paths together so the new face object cannot be silently dropped at runtime.
- Keep body-model and presentation metadata catalog-derived until an explicit requirement makes them persisted player choices.
- Keep any future split-hair migration separate from face migration; the shipped custom-hair contract is already part of the current v4 implementation.
- Migration must be parse → migrate → sanitize → preview/confirm where the project portability flow requires it.
- Schema version, migration policy, and rollback behavior are recorded in the v4 decision and must be extended explicitly for future split hair.

## 11. Delivery strategy and gates

The phases below are product gates, not an implementation task list. No feature phase starts until its art, domain, and persistence risks have an exit decision.

### Gate 0 — Art and domain spike

Define model reference sheets, layer order, face asset naming, guide data, fit families, style tags, missing-asset behavior, and the future preset shape. Prototype one existing doll with a modular default face and one new body model without changing production behavior.

**Exit:** art review approves the visual language; renderer fixtures prove no change to existing dolls; schema and compatibility decisions are written down.

### Gate 1 — Modular face foundation

Add the smallest useful face catalog: two or three eyes, two iris colors, two brows, two noses, three resting mouths, and one detail family. Define the approved v3 → v4 migration, update cloning and sanitization, and keep the existing expression and voice contracts intact.

**Exit:** face choices round-trip through Designer, Dollbox, Play, Scene Book, reload, project transfer, and PNG export with the default-face parity fixture passing; v3 presets and every embedded scene snapshot migrate without losing outfit or expression data.

### Gate 2 — Body models and life-stage content

Add one reviewed model for each approved initial life-stage family, plus a deliberately small compatible wardrobe. Add style tags and filters without making style a required identity field.

**Exit:** all offered model × wearable combinations pass fit, recolor, expression, export, accessibility, and offline checks; changing models never silently loses outfit or face intent.

### Gate 3 — Expanded catalog and polish

Add more face variants, presentation styles, age-context wardrobe, and model-specific hair catalog items based on actual player value. Keep the initial content ceiling small enough to review.

**Exit:** content review confirms that new items are distinct, respectful, localized, and not stereotype-driven; randomize never generates invalid combinations.

### Gate 4 — Custom hair implementation

Ship and verify single-layer custom hair through storage, preview, missing-art recovery, project export/import, deletion/trash, Scene Book, Paint Studio guides, and PNG export. Keep split front/back hair as a later design spike after player feedback.

**Exit:** a hand-authored front-layer hairstyle can be saved, equipped, reloaded offline, transferred, edited as a copy, removed recoverably, and rendered identically in every supported surface; existing v4 face data remains intact.

### Gate 5 — Release evidence

Run the full project check, browser/accessibility matrix, storage-pressure and quota cases, offline reload, cross-browser project transfer, iPad touch drawing, and visual parity fixtures. Update the owning canonical docs and decisions only after evidence exists.

## 12. Acceptance criteria

### Product behavior

- A first-time player can create a recognizable character with a model, face, hair, and outfit without reading documentation.
- A player can distinguish model selection from style filtering and is never required to choose a gender identity.
- A player can make a multi-generational scene using the approved life-stage models.
- Face, model, and wardrobe changes are independently reversible within the existing history and reset patterns.
- Randomize and catalog filtering produce only reviewed, compatible combinations.

### State and recovery

- Current schema v4 behavior remains intact; v3 projects migrate additively by injecting default face data.
- Every new persisted field has validation, limits, default behavior, and a recovery path.
- Missing catalog or custom assets remain visible as labeled placeholders and do not corrupt presets or scenes.
- Storage failures preserve the last known-good project and expose unsaved status.

### Visual parity

- A deterministic fixture for each new face and model renders the same intended composition in Designer, Play, Scene Book, reload, and PNG export.
- The selected resting face is restored after voice puppetry stops.
- Static scene expressions do not permanently overwrite the selected resting face.
- Existing dolls and existing outfits have no unintended visual changes.

### Accessibility and localization

- All controls pass keyboard, touch, screen-reader, forced-color, reduced-motion, `200%` zoom, and tablet portrait checks.
- English and Turkish have no missing keys or clipped required labels.
- Live announcements identify the changed feature and resulting color/style where relevant.

### Performance and limits

- Character preview remains responsive during normal selection and drag interactions under the project’s existing performance budgets.
- Custom hair obeys the existing per-item and total custom-art quotas unless a measured, reviewed quota change is approved.
- No unreleased object URLs, stale async renders, or unbounded face/hair history remain after route changes.

## 13. Verification matrix

| Area | Evidence required |
|:--|:--|
| Face composition | Unit fixtures for layer order, defaults, missing assets, expression fallback, and iris recoloring. |
| Model fit | Model × wearable matrix with anchor screenshots and export fixtures. |
| Persistence | Sanitization, migration, limits, duplicate IDs, missing references, quota failure, reload, and project transfer tests. |
| Expressions/voice | All seven expressions, voice start/stop, permission denial, reduced motion, and resting-face restoration. |
| Custom hair | Front-only save/load, stale-load cancellation, missing-art placeholder, trash/restore, edit-as-copy, export/import, and PNG parity. |
| Accessibility | Keyboard-only, screen reader names/status, focus restoration, 44px actions, forced colors, reduced motion, 200% zoom, and touch. |
| Offline/privacy | Offline reload, service-worker update, no network requests for player data, and no persisted microphone samples. |
| Release | `npm run check`, dated browser evidence, and updates to [QUALITY.md](QUALITY.md) and [ROADMAP.md](ROADMAP.md) when implementation begins. |

## 14. Open decisions before implementation

1. Which new base models are worth the art cost, and which existing models map to the Teen life-stage label?
2. Should the first release ship one model per life-stage family or a small cross-product of life stage × presentation style?
3. Which face assets have authored expression variants, and which remain static during Play?
4. If split hair is later requested, should front/back layers be two artwork records under one logical asset or one compound IndexedDB record?
5. If recoloring is later requested, should custom hair use semantic recoloring or remain edit-as-copy?
6. What exact catalog metadata names and compatibility rules fit the current asset registry without duplicating state?
7. What schema migration policy applies when modular face data reaches a release with user-created saved presets?
8. Which visual fixtures and hosted-device evidence are required before this expansion can be called release-ready?

Until these decisions have owners and exit criteria, the feature remains a product/design proposal and no implementation should start.

## 15. Suggestions and options for open decisions

This section provides concrete options for each open decision in §14. Each subsection is self-contained so a decision can be resolved independently. Options are ordered with a recommended default first where the analysis supports one.

---

### 15.1 Which new base models are worth the art cost, and which existing models map to Teen?

**Context:** The catalog currently has three dolls (`doll_classic_a`, `doll_classic_b`, `doll_chibi_a`). All share the `300 × 450` coordinate space, use the same `body` required group, and have baked-in facial features. The existing head ellipse is at `cx=150, cy=62, rx=30, ry=36` on the classics; Chibi uses different proportions with a `0.9 / 0.84` model transform.

#### Existing doll → Teen mapping

| Option | Mapping | Trade-off |
|:--|:--|:--|
| **A (Recommended)** | Map `doll_classic_a` and `doll_classic_b` as `lifeStages: ['teen']`. Leave `doll_chibi_a` as `lifeStages: ['child']`. | Natural fit; current proportions read as preteen/teen. Chibi's head ratio reads younger. No art work needed for Teen slot. |
| **B** | Map all three existing dolls as `lifeStages: ['teen']` and create a separate shorter-limbed Child model. | Chibi becomes a style choice rather than a life-stage; requires one more new model. |
| **C** | Map all three as `lifeStages: ['child', 'teen']` (dual-tagged). | Most permissive but weakens the life-stage filter signal. |

#### New model priority order

| Priority | Model | Art effort estimate | Storytelling value |
|:--|:--|:--|:--|
| 1 | **Baby** — rounded 1:2 head-body ratio, simplified limbs, seated or standing posture | Medium (new silhouette, minimal wardrobe needed) | Highest novelty; no current model can approximate it. Unlocks family/sibling stories. |
| 2 | **Adult** — taller torso and longer legs within the same 300 × 450 space, ~1:5.5 proportions | Medium (new paths, but reuses arm/hand conventions) | Enables parent/teacher characters that look distinct from Teen. |
| 3 | **Elder** — Adult silhouette with slightly stooped posture, softer shoulder line | Low-Medium (variant of Adult with posture adjustment) | Completes the family story arc. Can share most Adult wardrobe with a `fitFamily` overlap. |
| 4 | **Child (if Chibi is kept as Teen)** | Medium | Only needed under Option B above. |

**Recommendation:** Option A + Baby → Adult → Elder priority. This gives 4 distinct life-stages at launch (Baby, Child/Chibi, Teen/Classic, Adult) with Elder as a polish-phase addition. Total new art: 2–3 body SVGs + anchor reference sheets.

---

### 15.2 One model per life-stage or a cross-product of life stage × presentation style?

**Context:** A cross-product (e.g. Baby-Feminine, Baby-Neutral, Adult-Masculine, Adult-Feminine…) multiplies art cost and fit testing. The PRD already states presentation style should be a discovery filter, not a required structural axis.

| Option | Scope | Art cost | Fit testing cost |
|:--|:--|:--|:--|
| **A (Recommended)** — One neutral body per life-stage. Style is expressed through wardrobe, hair, and accessories only. | 3–4 new body models total | Low | Low (one fit family per life-stage) |
| **B** — One model per life-stage + one alternate silhouette for Adult and Teen (e.g. broader-shouldered variant). | 5–6 new body models | Medium | Medium (two fit families for Adult and Teen) |
| **C** — Full cross-product: 2–3 presentation silhouettes per life-stage. | 10–15 new body models | Very High | Very High |

**Recommendation:** Option A for the first release. Body silhouettes are neutral; style differences come from the wardrobe and hair catalog which are already tintable and have lower per-item art cost. If player feedback clearly requests a broader/narrower Adult variant, it can be added as a single new model with its own `fitFamily` tag without changing the architecture.

**Implementation detail:** Add `presentationStyles: ['neutral']` to each new model's catalog metadata. The wardrobe filter populates its options from the union of `presentationStyles` across all cataloged wearables for the current `fitFamily`, not from the body model itself.

---

### 15.3 Which face assets have authored expression variants, and which remain static?

**Context:** The current expression system uses 7 values (`neutral`, `smile`, `happy`, `surprised`, `o_mouth`, `talking`, `wide_open`). The existing SVG dolls bake eyes, eyebrows, nose, and mouth into the `body` group (see `doll-classic-a.svg` lines 40–56). Expressions are applied as SVG group visibility toggles by the renderer. Play mode and Scene Book show the scene's `expression` field; Voice Puppetry drives ephemeral mouth changes.

| Option | What morphs per expression | Static groups | Trade-off |
|:--|:--|:--|:--|
| **A (Recommended)** — **Mouth-only expression variants.** Each resting-mouth asset ships with 7 expression poses (e.g. `mouth_gentle_smile_happy`, `mouth_gentle_smile_surprised`). Eyes, eyebrows, nose, and details remain static. | Mouth | Eyes, eyebrows, nose, detail | Lowest art cost per face catalog item. 5 mouths × 7 expressions = 35 mouth SVG fragments total. Eye emotion is already handled well by the existing brow+pupil combination. |
| **B** — **Mouth + eye expression variants.** Each eye asset also ships expression variants for `surprised` and `wide_open` (pupils enlarge/shrink). Other expressions keep the resting eye. | Mouth (all 7) + Eyes (2 specific expressions) | Eyebrows, nose, detail | Medium art cost. Adds visual punch to surprise/shock without requiring full eye variant matrix. 7 eye styles × 2 extra poses = 14 additional eye fragments. |
| **C** — **Full eye+mouth expression variants.** Each eye and mouth asset has a variant for every expression. | Mouth (all 7) + Eyes (all 7) | Eyebrows, nose, detail | High art cost. 7 eyes × 7 expressions + 5 mouths × 7 expressions = 84 fragments. Most expressive, but may delay Gate 1. |

**Recommendation:** Start with Option A. The mouth is the highest-signal expression feature and the simplest to author since each pose is a small SVG path. The fallback rule ("if a face asset has no expression variant, it remains unchanged," §7.2) already handles eyes gracefully. Ship Option B as a Gate 3 polish item if player feedback requests it.

**Implementation detail for Option A:**

```javascript
// Face expression resolution in the renderer
function resolveExpressionMouth(face, expression) {
  // Look up expression-specific mouth first
  const expressionMouthId = `${face.mouth.assetId}_${expression}`;
  const expressionMouth = getAsset(expressionMouthId);
  if (expressionMouth) return expressionMouth;
  // Fall back to resting mouth for unrecognized expressions
  return getAsset(face.mouth.assetId);
}
```

Face catalog naming convention:
- `mouth_gentle_smile` — resting asset
- `mouth_gentle_smile_happy` — expression variant
- `eyes_round` — static, no expression suffix needed under Option A

---

### 15.4 Future split-hair spike: two records or one compound record?

**Future-scope context:** Built-in hair already uses `requiredGroups: ['hairBack', 'hairFront']` in a single SVG file. Shipped custom hair is one raster PNG stored in IndexedDB. This section only describes a possible later split-hair extension.

| Option | Storage shape | Pro | Con |
|:--|:--|:--|:--|
| **A (Recommended)** — **One logical record with two artwork keys.** A single `customAssets[]` entry with `renderMode: 'front' | 'split'`, `frontArtworkId`, and optional `backArtworkId`. Both PNGs live as separate IndexedDB `artwork` store entries keyed by their artwork IDs. | Metadata is one item; binary is two blobs. | Matches the one-slot/two-render-groups contract from built-in hair. Deletion, quota tracking, and export handle one logical item. Missing-layer detection is explicit (`backArtworkId` present but blob missing → show placeholder for back layer only). | Requires extending `sanitizeCustomAsset` to accept `slot: 'hair'` and validate compound references. Slightly more complex export bundling. |
| **B** — **Two independent custom asset records** linked by a `pairId` field. Front is `custom_hair_abc_front`, back is `custom_hair_abc_back`. | Two separate `customAssets[]` entries sharing a `pairId`. | Minimal schema change; existing sanitizer can accept each record independently after adding `slot: 'hair'`. | Fragile pairing — one record can be deleted/corrupted without the other, creating orphans. Quota counts two items against the 30-item limit for what the player perceives as one hairstyle. Export/import must reconstruct pairs. |
| **C** — **One compound IndexedDB record** with front and back PNGs concatenated into a single blob with a header. | One `customAssets[]` entry, one IndexedDB blob. | Simplest to track (one blob = one item). | Requires a custom binary container format. Editing one layer forces rewriting the entire blob. Cannot stream/preview one layer without parsing the container. Over-engineered for the raster-first paint model. |

**Future recommendation:** If split hair is approved, Option A best preserves the "one logical hair item" mental model and keeps IndexedDB blobs as plain PNGs.

**Proposed metadata shape for Option A:**

```javascript
{
  assetId: 'custom_hair_sunset_waves',
  name: 'Sunset waves',
  kind: 'wearable',
  slot: 'hair',
  format: 'image/png',
  renderMode: 'split',             // or 'front'
  frontArtworkId: 'custom_hair_sunset_waves_front',
  backArtworkId: 'custom_hair_sunset_waves_back',  // null when renderMode is 'front'
  logicalWidth: 300,
  logicalHeight: 450,
  pixelWidth: 600,
  pixelHeight: 900,
  byteLength: 245000,              // combined front + back
  sha256: 'ab12cd34...',           // digest of front; back has its own in artwork store
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  libraryVisible: true,
  status: 'available',
  supportedFitFamilies: ['teen']
}
```

**Quota impact:** Each hair item counts as 1 toward the 30-item `MAX_CUSTOM_ASSETS` limit, but both blobs count toward `MAX_TOTAL_CUSTOM_BYTES` (30 MB).

---

### 15.5 Custom hair semantic recoloring or edit-as-copy?

**Context:** Built-in hair is SVG with `tintable: true` and uses CSS variable recoloring (the palette already has `HAIR_COLORS: ['blonde', 'auburn', 'brown', 'black', 'lavender']`). Custom hair is raster PNG, so CSS variable recoloring doesn't apply directly. Semantic recoloring of raster art would require either pre-authored tint masks or pixel-level hue shifting — both complex for a v1.

| Option | Mechanic | Art/eng effort | Player experience |
|:--|:--|:--|:--|
| **A (Recommended)** — **Edit-as-copy for v1.** No color control shown for custom hair. Player opens the existing Paint Studio, edits the hair, and saves a new copy. | "Edit a copy" button in Designer when custom hair is selected. | Near-zero extra engineering (reuse existing paint copy flow). | Player understands they are making a new hairstyle. No false promise of lossless recolor on raster art. |
| **B** — **Hue-shift recoloring.** Apply a CSS `hue-rotate()` + `saturate()` filter on the rendered PNG. Map palette hair tokens to filter angles. | Filter-based. No mask needed. | Low engineering. | Fast preview but imprecise — shifts all hues, not just hair. Background or multi-color hair details lose fidelity. Exported PNG must bake the filter. |
| **C** — **Tint-mask recoloring.** Player paints a "tintable region" mask during hair creation. At render time, only masked pixels are recolored using multiply-blend with the selected hair palette color. | Two-layer paint + runtime compositing. | High engineering + extra paint UX. | Most accurate result. Significant feature scope for a first release. |

**Recommendation:** Option A for first release (Gate 4). It is honest about the raster limitation and leverages the existing paint copy workflow. Evaluate Option B as a Gate 3 experiment if player feedback requests it — the CSS filter approach can be prototyped non-destructively. Option C is a future consideration only if custom hair becomes a high-engagement feature.

**Implementation detail for Option A:**
- When a custom hair item is selected in Designer, the color swatch row is hidden (same as when `tintable: false`).
- A "Customize in Paint Studio" button appears, which clones the custom hair's front (and back, if split) artwork into a new paint session pre-loaded with the existing pixels.
- Saving from that session creates a new `custom_hair_*` record without modifying the original.

---

### 15.6 Catalog metadata names and compatibility rules

**Context:** The current catalog uses `lifeStages`, `presentationStyles`, `fitFamily`, and `supportedFitFamilies` metadata. Face assets declare their supported fit families, and custom wearable metadata defaults to all fit families when importing older records.

| Option | New doll fields | New wearable fields | Compatibility rule |
|:--|:--|:--|:--|
| **A (Recommended)** — **Fit-family string matching.** | `lifeStages: string[]`, `presentationStyles: string[]`, `fitFamily: string` | `supportedFitFamilies: string[]`, `presentationStyles: string[]` | A wearable is offered for a doll iff `wearable.supportedFitFamilies` includes `doll.fitFamily`. Style tags are used only for filter UI, not for equip eligibility. |
| **B** — **Direct model-ID allowlists.** | `lifeStages: string[]`, `presentationStyles: string[]` | `supportedDollIds: string[]`, `presentationStyles: string[]` | A wearable is offered for a doll iff `wearable.supportedDollIds` includes the current `baseDollId`. |
| **C** — **Tag-intersection matching.** | `bodyTags: string[]` (e.g. `['teen', 'neutral', 'medium']`) | `requiredBodyTags: string[]` | A wearable is offered for a doll iff every tag in `wearable.requiredBodyTags` is present in `doll.bodyTags`. |

**Recommendation:** Option A. Fit families are explicit, human-readable, and decouple wearable authoring from specific model IDs. When a new model joins an existing family (e.g. a second Adult variant), all compatible wearables are automatically available. Option B is simpler but becomes brittle as models grow. Option C is flexible but over-abstracted for the current catalog size.

**Proposed fit-family vocabulary:**

| Fit family | Models | Description |
|:--|:--|:--|
| `baby` | `doll_baby_a` | Short, rounded limbs. Very limited wardrobe. |
| `child` | `doll_chibi_a` (remapped) | Playful proportions with current Chibi anchor points. |
| `teen` | `doll_classic_a`, `doll_classic_b` | Current classic proportions. Existing wardrobe maps here. |
| `adult` | `doll_adult_a` | Taller silhouette, same coordinate space. |
| `elder` | `doll_elder_a` | Adult variant with posture adjustment. |

**Migration for legacy assets:** Original teen wardrobe assets retain `supportedFitFamilies: ['teen']`; reviewed new assets declare their supported families explicitly. The original dolls remain `teen` (classics) or `child` (chibi). This is catalog metadata, not a persisted schema field.

**Wearable filter resolution:**

```javascript
function getOfferedWearables(slot, currentDoll, styleFilter = 'all') {
  const dollMeta = getAsset(currentDoll);
  const fitFamily = dollMeta?.fitFamily;
  return wearablesBySlot(slot).filter(w => {
    if (!w.supportedFitFamilies?.includes(fitFamily)) return false;
    if (styleFilter === 'all') return true;
    return w.presentationStyles?.includes(styleFilter);
  });
}
```

---

### 15.7 Schema migration policy for modular face data

**Context:** Current schema is v4 (`SCHEMA_VERSION = 4` in `state-schema.js`). The migration chain is v1 → v2 (custom colors) → v3 (custom assets) → v4 (modular face data). Presets and scene character snapshots now store the `face` object. Migration warnings are informational and do not quarantine a valid project.

| Option | v3 → v4 trigger | Rollback behavior | Risk |
|:--|:--|:--|:--|
| **A (Recommended)** — **Additive migration with default-face injection.** On load, if `schemaVersion === 3`, inject a `face` object into every preset and every `characterSnapshot` in scenes. The face values match the exact baked-in features of each doll. Bump to `schemaVersion: 4`. Old v3 data without `face` is always safely upgradeable. | Automatic on first load | A v4 save cannot be downgraded to v3 (face data would be lost). Under D-022, this is acceptable pre-release. | Low if default faces exactly reproduce current appearance (visual parity fixture). |
| **B** — **Lazy face resolution.** No schema bump. If `face` is absent from a preset or snapshot, the renderer injects the doll's default face at render time. Face data is persisted only when the player explicitly edits a face feature. | Never (stays v3) | Full backward compatibility — old saves work without migration. | `cloneDraft()`, `sanitizeDraft()`, and `clonePreset()` must all handle the optional `face` field. Every code path that reads face must check for absence. Higher ongoing complexity. |
| **C** — **Schema v4 with explicit opt-in.** The migration runs only when the player opens the new Face panel for the first time. Until then, v3 data is untouched. | Player action | Pre-migration saves remain v3. Post-migration saves are v4. | Two valid save formats coexist, increasing test matrix. Scene snapshots may not have face data even though the preset does. |

**Recommendation:** Option A. A single, clean migration point is easiest to test and reason about. The default-face mapping table is small (one entry per existing doll ID).

**Default face mapping table:**

| `baseDollId` | Default `face` |
|:--|:--|
| `doll_classic_a` | `{ eyes: { assetId: 'eyes_classic', irisColor: 'cocoa' }, eyebrows: { assetId: 'brows_soft' }, nose: { assetId: 'nose_dot' }, mouth: { assetId: 'mouth_gentle_smile' }, detail: null }` |
| `doll_classic_b` | `{ eyes: { assetId: 'eyes_sparkle', irisColor: 'cocoa' }, eyebrows: { assetId: 'brows_soft' }, nose: { assetId: 'nose_dot' }, mouth: { assetId: 'mouth_gentle_smile' }, detail: { assetId: 'detail_blush' } }` |
| `doll_chibi_a` | `{ eyes: { assetId: 'eyes_round', irisColor: 'cocoa' }, eyebrows: { assetId: 'brows_soft' }, nose: { assetId: 'nose_button' }, mouth: { assetId: 'mouth_gentle_smile' }, detail: null }` |

**Changes required in existing code paths:**

| File | Change |
|:--|:--|
| `state-schema.js` `migrateEnvelope()` | Add v3 → v4 branch that iterates presets and scene entity snapshots. |
| `state-schema.js` `sanitizeDraft()` | Validate `face` object: each group must have a valid `assetId`; `irisColor` must pass `isPaletteToken()`. |
| `state-schema.js` `clonePreset()` / `cloneScene()` | Deep-clone the `face` object via `cloneDraft()`. |
| `outfit-rules.js` `cloneDraft()` | Include `face` in the cloned output. |
| `outfit-rules.js` `createStarterDraft()` | Include a default `face`. |
| `vocabulary.js` | Add `FACE_GROUPS`, `isFaceGroup()`, iris color vocabulary. |

---

### 15.8 Visual fixtures and hosted-device evidence for release readiness

**Context:** Decision D-029 already separates automated contracts from hosted-device proof. The current quality matrix in `QUALITY.md` defines browser/device evidence requirements. This decision needs specific fixture definitions for the character customization expansion.

#### Automated fixture requirements

| Fixture category | What it proves | Suggested approach |
|:--|:--|:--|
| **Default-face parity** | Existing dolls look identical after face modularization. | For each doll, render with default face and compare against a reference screenshot at `600 × 900` resolution. Pixel diff must be zero (or within a 1-pixel anti-aliasing tolerance). |
| **Face layer ordering** | Eyes above body, hair-back behind body, accessories above hair-front. | Render a character with all face groups + hair + accessory and assert SVG group DOM order matches §7.2 spec. |
| **Expression + face round-trip** | All 7 expressions × all face catalog items render and persist correctly. | For each expression, render → serialize → deserialize → render and compare. |
| **Migration idempotency** | Running v3 → v4 migration twice produces identical output. | Feed the same v3 envelope through migration twice, deep-compare results. |
| **Fit-family gating** | Incompatible wearables are not offered; compatible ones are. | For each new model, assert that `getOfferedWearables()` returns only items whose `supportedFitFamilies` includes the model's `fitFamily`. |
| **Custom hair recovery** | Missing custom artwork shows a labeled placeholder without losing the logical hair reference. | Delete the single PNG blob from IndexedDB, reload, assert the hair reference remains and the placeholder is visible. |

#### Hosted-device evidence matrix

| Evidence | Device/browser | What to verify |
|:--|:--|:--|
| **Face editing on iPad** | Safari / iPadOS | Touch interaction with face group selectors, iris color picker, live preview. 44px touch targets met. |
| **Model switching on iPad** | Safari / iPadOS | Model picker renders all life-stage options. Switching preserves outfit with compatibility warnings. |
| **Offline face persistence** | Chrome / desktop | Edit face → kill network → reload → face is restored from localStorage. |
| **Cross-browser project transfer** | Safari → Chrome (or reverse) | Export project with custom face and hair → import in different browser → visual parity check. |
| **Scene Book face rendering** | Chrome / desktop | Face features visible in Scene Book thumbnails at card scale. |
| **Forced colors / high contrast** | Edge / Windows | Face group selectors and iris color swatches remain distinguishable. Selected state has a non-color indicator. |
| **Screen reader face editing** | VoiceOver / Safari | All face groups, iris colors, and state changes are announced via the live region. Tab order is logical. |
| **Custom hair creation on iPad** | Safari / iPadOS | Full single-layer paint flow. Guide overlays are visible and non-saving. Preview shows hair on doll. |

**Recommendation:** Automate the first 6 fixture categories as unit/integration tests that run in `npm run check`. The hosted-device evidence is manual and requires dated screenshots/recordings filed in the quality matrix, consistent with D-029.

---

### 15.9 Additional suggestions (beyond the 8 open decisions)

These are supplementary ideas that emerged from the codebase analysis. They are not blocking decisions but may inform implementation.

#### 15.9.1 Iris color palette extension

The current `HAIR_COLORS` palette (`blonde`, `auburn`, `brown`, `black`, `lavender`) is too limited for iris colors. Consider adding a dedicated `IRIS_COLORS` palette:

```javascript
export const IRIS_COLORS = Object.freeze([
  'cocoa',     // warm brown (already in PALETTE)
  'honey',     // amber/hazel (already in PALETTE as skin, but works as iris)
  'sage',      // green (already in PALETTE)
  'sky',       // blue (already in PALETTE)
  'charcoal',  // dark gray/near-black (already in PALETTE)
  'lavender'   // purple/violet (already in PALETTE)
]);
```

This reuses existing palette tokens — no new hex values needed. Each token already has a localized color name through the i18n system.

#### 15.9.2 Face feature SVG structure convention

Each face feature asset should be a small SVG fragment that:
- Uses the same `300 × 450` viewBox as the doll.
- Positions elements at the exact same coordinates as the baked-in face features (e.g., eyes at `cx=136/164, cy=60` for classic dolls).
- Uses `var(--iris-color, #2d261e)` for iris fills so the runtime can inject the selected iris palette value via CSS custom property.
- Contains no `<g id="body">` group (to avoid colliding with the doll's required group).

This means face features are "coordinate-absolute" — they are designed for a specific doll family's face coordinates and overlaid at 0,0 alignment. The `fitFamily` field on the face asset controls which dolls it's compatible with.

#### 15.9.3 Randomize strategy for face features

The existing randomize function should be extended to include face features. Suggested approach:
- Randomize independently within each face group (random eyes + random brows + random nose + random mouth).
- Constrain iris color to the `IRIS_COLORS` palette.
- Never randomize to a face asset that is incompatible with the current `fitFamily`.
- Face randomization is part of the "randomize all" action and also available per-group via individual face controls.

#### 15.9.4 Designer tab structure suggestion

The current Designer has a single-panel catalog browser. For character customization, consider a tab bar within the left control area:

```
[ 👤 Model ]  [ 😊 Face ]  [ 👗 Wardrobe ]
```

- **Model tab**: Body model picker (visual cards), skin tone palette, presentation-style display (read-only derived from model metadata).
- **Face tab**: Accordion or sub-tabs for eyes (+ iris color), eyebrows, nose, mouth, details. Each shows a small scrollable gallery of SVG previews.
- **Wardrobe tab**: The existing outfit slot catalog, hair, style filter, and Paint entry point.

This uses progressive disclosure (PRD §8.1) without overwhelming the initial view. The Model and Face tabs are new; the Wardrobe tab is the current experience.

#### 15.9.5 Face data in the starter draft

The `createStarterDraft()` function in `outfit-rules.js` currently returns `{ baseDollId, skinTone, slots }`. After face support, it should include a complete default face:

```javascript
export function createStarterDraft() {
  return {
    baseDollId: DEFAULT_BASE_DOLL_ID,
    skinTone: DEFAULT_SKIN_TONE,
    face: {
      eyes: { assetId: 'eyes_classic', irisColor: 'cocoa' },
      eyebrows: { assetId: 'brows_soft' },
      nose: { assetId: 'nose_dot' },
      mouth: { assetId: 'mouth_gentle_smile' },
      detail: null
    },
    slots: {
      ...emptySlots(),
      hair: { assetId: 'hair_ponytail', color: 'brown' },
      top: { assetId: 'top_tshirt', color: 'coral' },
      bottom: { assetId: 'bottom_jeans', color: 'denim' },
      shoes: { assetId: 'shoes_sneakers', color: 'cream' }
    }
  };
}
```
