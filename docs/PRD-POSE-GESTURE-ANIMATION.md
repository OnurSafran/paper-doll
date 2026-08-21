# PRD — Character Expressions, Poses, and Looping Scene Animation

Status: In Progress (Phase 0, Phase 1 & Phase 2 Completed)

Updated: 2026-08-20

## 1. Product goal

Let a player create a scene in which one or more paper dolls perform expressive,
looping animation while preserving the existing dress-up, face, scene-editing,
voice, save, offline, Scene Book, and PNG-export workflows.

The target experience is:

1. Dress a doll and choose a face expression.
2. Adjust how strongly the face reads: subtle, normal, or amplified.
3. Choose a body pose or animation such as idle, happy bounce, nod, wave, point,
   jump, or dance.
4. Place the doll in a scene and start a scene loop.
5. Let multiple dolls animate independently, with optional phase offsets.
6. Save and reopen the scene with the same authored animation setup.
7. Export a deterministic still frame through PNG export and Scene Book.

The feature remains a calm, local, dependency-free paper-doll toy. It is not a
timeline editor, video editor, or cloud animation service in this scope.

## 2. Current foundation and constraints

The application already provides:

- Six base dolls across five life stages.
- Modular eyes, eyebrows, nose, mouth, and detail layers.
- Seven persisted expressions: neutral, smile, happy, surprised, o_mouth,
  talking, and wide_open.
- Saved character snapshots in scene entities.
- Runtime voice puppetry that temporarily changes the mouth.
- Play transforms: position, scale, flip, order, pinning, and attachment.
- Scene Book vector previews and immutable PNG export.
- Local persistence, project import/export, offline PWA operation, and bounded
  Undo/Redo.

The renderer composes complete SVG layers in a shared 300 × 450 coordinate system.
Existing body SVGs do not expose independent arm, leg, or head joints. Whole-body
motion is compatible immediately; articulated limb gestures require an asset
contract expansion.

## 3. Terminology

| Term | Meaning |
|:--|:--|
| Expression | Emotional face state, such as happy or surprised. |
| Expression intensity | How strongly the selected expression is drawn. |
| Static pose | Body arrangement shown when animation is paused or exported. |
| Motion clip | Reusable looping animation, such as idle-breathe or happy-bounce. |
| Gesture | Motion clip intended to communicate an action, such as wave or point. |
| Scene loop | Runtime clock that drives all enabled character clips. |
| Rigged asset | SVG asset containing semantic joint groups for articulated posing. |
| Rigid fallback | Non-rigged asset that can still use whole-character motion. |

## 4. Scope

### In scope

- Static character poses.
- Looping character motion clips.
- Per-character animation enable/disable.
- Per-character motion intensity and phase offset.
- Facial expression selection and intensity.
- Expression modulation during a motion clip.
- Play/Pause and loop controls.
- Multiple animated dolls in one scene.
- Reduced-motion behavior.
- Save/reload and project portability for authored animation settings.
- Deterministic still export at a defined frame.
- Voice puppetry coexistence.
- Rigid fallback for current and custom raster artwork.
- A later rigged-asset contract for convincing limb gestures.

### Out of scope for the first release

- GIF, MP4, WebM, or animated PNG export.
- Recording microphone or animation data.
- A freeform timeline editor.
- User-authored keyframes.
- Cloud sync, sharing, multiplayer, or remote rendering.
- Physics simulation or body tracking.
- Full deformation of player-painted PNG artwork.
- Requiring every existing asset to become rigged before motion ships.

## 5. User experience

### 5.1 Character controls

Add an animation panel to the selected-character controls in Play.

Required controls:

- Expression picker: the existing seven expressions.
- Expression intensity: Subtle, Normal, Amplified.
- Static pose picker: Rest, Lean left, Lean right, and supported authored poses.
- Motion clip picker: None, Idle, Happy bounce, Nod, and later gestures.
- Motion intensity: Subtle, Normal, Strong.
- Phase offset: 0%, 25%, 50%, and 75% presets.
- Immediate preview and reversible changes.

Required scene controls:

- Play/Pause scene animation.
- Loop on/off, defaulting to on.
- Reset animation to the canonical start frame.
- Visible status such as Animation playing or Animation paused.

All controls must remain reachable from keyboard, touch, Scene Outline, and narrow
layouts. Existing movement and expression controls remain available.

### 5.2 Behavior

- Opening Play does not start sound or microphone capture.
- Selecting a non-None animation clip for a character intentionally auto-starts scene
  playback (`scene.animationSettings.enabled: true`) to give immediate visual feedback
  of the chosen motion. Opening Play or resetting the scene preserves authored state
  without forced auto-play.
- Clips loop seamlessly.
- Each character can use a different clip.
- Phase offsets prevent unwanted synchronization.
- Changing a clip never changes saved scene coordinates.
- Animation frames never create Undo/Redo entries or autosaves.
- Pausing restores the selected static pose.
- Deleting, duplicating, detaching, or reloading a character safely disposes or
  recreates runtime animation state.

### 5.3 Expression intensity

Expression intensity is an internal value clamped to 0..1 and exposed initially
as three choices:

- Subtle: approximately 0.35.
- Normal: approximately 0.65.
- Amplified: approximately 1.0.

Intensity must affect the expression itself, not only scale the whole doll. The
renderer should use expression profiles that adjust mouth geometry and, when
supported by the asset, eyes and eyebrows. The result must remain inside the face
area and must not alter scene bounds.

The seven existing expression names remain valid. Intensity extends them; it does
not replace them with an unbounded emotion system.

### 5.4 Voice priority

Visual channels have this priority:

1. Base expression and intensity.
2. Motion-clip expression modulation.
3. Voice puppetry mouth/viseme override while voice mode is active.

When voice mode stops, the character returns to the expression produced by the
base expression plus the current animation frame. Voice frames are never saved,
exported, or added to history.

## 6. Animation model

### 6.1 Persisted scene data

A character entity should evolve toward:

~~~json
{
  "instanceId": "entity-id",
  "kind": "character",
  "sourceId": "preset-id",
  "characterSnapshot": {},
  "x": 800,
  "y": 720,
  "scale": 1,
  "flipped": false,
  "expression": "happy",
  "expressionIntensity": 0.85,
  "pose": "rest",
  "animation": {
    "clipId": "happy-bounce",
    "enabled": true,
    "intensity": 0.7,
    "phaseOffset": 0.25
  },
  "order": 1
}
~~~

The scene should hold authored playback preferences, not runtime time:

~~~json
{
  "animationSettings": {
    "enabled": true,
    "loop": true,
    "playbackRate": 1
  }
}
~~~

Do not persist current frame, RAF IDs, animation promises, DOM nodes, voice
samples, object URLs, or a wall-clock start timestamp. The runtime clock starts
fresh when Play opens or when the player presses Play.

### 6.2 Motion clip contract

Motion clips are immutable catalog definitions:

~~~js
{
  clipId: 'happy-bounce',
  durationMs: 1800,
  loop: true,
  channels: {
    root: [
      { at: 0, y: 0, rotate: 0, scale: 1 },
      { at: 0.5, y: -10, rotate: 0, scale: 1.02 },
      { at: 1, y: 0, rotate: 0, scale: 1 }
    ],
    expression: [
      { at: 0, intensity: 0.7 },
      { at: 0.5, intensity: 1 },
      { at: 1, intensity: 0.7 }
    ]
  }
}
~~~

Values are normalized and bounded. Clip definitions are catalog content, not
duplicated player data.

### 6.3 Channel levels

Implement channels in this order:

1. root: translate, rotate, and small scale changes. Works with every current
   outfit and custom raster asset.
2. head: nod and tilt. Requires a normalized head group for full fidelity.
3. arm-left, arm-right, leg-left, leg-right: wave, point, kick, and dance.
   Requires rigged assets.
4. expression: intensity and optional expression changes.

The first user-visible release may ship root motion plus expression modulation while
the rigged asset contract is being authored. Unsupported limb gestures must be
unavailable rather than pretending a rigid asset is fully poseable.

## 7. Asset and renderer requirements

### 7.1 Current rigid renderer

Add a pose/motion transform layer inside the existing character hierarchy:

~~~text
scene entity positioner      translation and selection
└── scene entity visual      horizontal flip
    └── character motion     root pose animation
        └── character layers body, face, clothes, hair, accessory
~~~

This preserves current responsibilities. Animation must not overwrite the transform
owned by the scene positioner or the flip transform owned by the visual wrapper.

### 7.2 Rigged SVG contract

For true limb gestures, rigged character assets should provide stable semantic
groups and pivots:

- pose-root
- pose-head
- pose-arm-left
- pose-arm-right
- pose-leg-left
- pose-leg-right

Wearables that cover a channel must expose the same channel or declare that they
are rigid. Asset metadata should declare support explicitly:

~~~json
{
  "poseSupport": "rigid"
}
~~~

Supported values should be rigid, basic, or full. Existing assets default to rigid
until individually upgraded and validated.

### 7.3 Custom raster artwork

Custom PNG hair and wearables remain supported as rigid layers. They may follow
root motion and whole-character animation. They do not receive limb deformation
until a future raster deformation contract exists.

## 8. Rendering architecture

Create a dependency-free SceneAnimationService responsible for:

- One scene clock.
- Play, pause, reset, and teardown.
- Reduced-motion resolution.
- Phase offsets and playback rate.
- Evaluating immutable clips.
- Updating DOM-only animation properties.
- Avoiding store dispatch per frame.

Create pure domain helpers for:

- Clip validation.
- Time normalization.
- Keyframe interpolation.
- Intensity clamping.
- Static-frame evaluation for export.

The DOM renderer and export renderer must consume the same evaluated pose frame.
The existing DOM renderer is in js/features/designer/designer-view.js; the static
export path is in js/services/export-service.js.

The Play render key must include persisted pose, expression intensity, and
animation configuration. Runtime time must not be included in the render key;
otherwise Play would rebuild the character on every frame.

## 9. Export and Scene Book

### PNG export

PNG remains a still-image export. Animated GIF/video export is not part of this
PRD.

The export service must accept an explicit static frame:

~~~js
renderSceneToCanvas(sceneSnapshot, { animationTimeMs: 0 })
~~~

Default behavior is the canonical loop-start frame. A later UI may expose Export
current frame by passing the current runtime time without persisting that time.

### Scene Book

Scene Book thumbnails use the canonical frame and show:

- Static pose.
- Expression and expression intensity.
- Deterministic pose-compatible body state.

Thumbnails must never start their own animation loop.

## 10. Reduced motion and accessibility

The application already has system, reduce, and full reduced-motion values in the
schema, plus an OS-level CSS rule. The animation feature must complete the runtime
contract:

- system follows prefers-reduced-motion.
- reduce disables looping movement and shows the canonical static frame.
- full allows authored animation even when the OS preference requests reduction,
  because this is an explicit user choice.
- Changing the OS preference while Play is open updates behavior safely.
- Play/Pause/Reset/Loop and intensity controls have accessible names and visible
  state.
- No animation is required to understand or edit scene content.
- Focus, drag, camera, and keyboard behavior remain independent of animation.
- Forced-colors mode keeps selected and playing states distinguishable.

Animation becomes inert on route change, page hide, visibility loss, and top-level
error recovery. It restarts from a safe state when Play is reopened.

## 11. Persistence, migration, and history

If static pose, expression intensity, or animation preferences are persisted, they
must be:

- Validated at the state boundary.
- Defaulted safely for older records.
- Included in project export/import and merge collision handling.
- Cloned for duplicate characters and duplicate scenes.
- Included in immutable export snapshots.
- Restored by Undo/Redo as one logical user command.

The recommended implementation is a schema revision for the new persisted fields,
with old entities defaulting to expressionIntensity 0.65, pose rest, and no
animation clip.

Animation frames never schedule persistence or consume history capacity.

## 12. Performance requirements

- No store dispatch per animation frame.
- No SVG asset fetch per animation frame.
- No character layer rebuild per animation frame.
- Target 60 FPS with 20 mixed scene entities and at least 10 animated dolls.
- Use transform/custom-property writes where possible.
- Pause or reduce work for offscreen characters on panoramic stages.
- Do not create a new object graph for every frame.
- Animation must not interfere with the existing drag frame budget.

## 13. Delivery phases

### Phase 0 — Contracts and visual prototype (Completed)

Deliver:

- Final vocabulary for expressions, intensity, poses, and clips.
- Reduced-motion runtime contract.
- One prototype rigid clip: idle-breathe or happy-bounce.
- One static-frame evaluator used by DOM and export tests.
- Decision on whether Play auto-starts animation: Approved policy is that selecting a non-None clip auto-starts playback for immediate feedback, while opening Play preserves authored settings.

Exit criteria:

- One dressed doll loops without scene-coordinate drift.
- Pause and reset are deterministic.
- Reduced motion disables movement.
- Existing test baseline remains green.

### Phase 1 — Rigid motion MVP (Completed)

Deliver:

- Scene animation service.
- Play/Pause/Reset/Loop controls.
- Root-motion clips: idle, bounce, lean, and a nod-like whole-body motion.
- Expression intensity and animation expression modulation.
- Multiple characters with phase offsets.
- Persistence, import/export, Undo/Redo, Scene Book, and PNG canonical-frame
  parity.
- Voice priority and teardown integration.

Exit criteria:

- All current built-in and custom raster artwork participates safely as rigid
  animation.
- No animation frame changes saved coordinates or history.
- Export and Scene Book match the canonical frame.

### Phase 2 — Basic pose assets

Deliver:

- Pose-root/head asset contract.
- Upgraded base dolls with validation.
- Nod, tilt, and look-direction poses.
- Expression feature transforms with amplitude limits.

Exit criteria:

- Rigged and rigid assets coexist without layout regressions.
- Missing pose support falls back safely to rigid motion.

### Phase 3 — Articulated gestures

Deliver:

- Arm and leg channel contract.
- Wave, point, clap, jump, and dance clips.
- Rigged clothing/accessory variants as needed.
- Asset validation for joint IDs, pivots, and clone safety.
- Clear rigid fallback for custom artwork.

Exit criteria:

- Every advertised gesture has visual parity in Play, Scene Book, and canonical
  still export.
- All supported life stages have a validated path for the advertised gestures.

### Phase 4 — Authoring and expansion

Possible future work:

- Player-authored animation presets.
- Scene timeline or beat markers.
- Animated export.
- Interactive props responding to character motion.
- Secondary motion for eyes, hair, and clothing.

These are not prerequisites for the first animation release.

## 14. Acceptance criteria

### Character and scene behavior

- A dressed character can select expression, expression intensity, static pose, and
  looping clip.
- Two or more characters animate independently in one scene.
- Phase offsets prevent unwanted synchronization.
- Animation never changes saved x, y, scale, flipped, order, or attachment data.
- Attached speech bubbles and props remain attached while the character moves.
- Pause returns to a deterministic static pose.
- Reload restores authored settings and starts from a safe clock state.

### Expression behavior

- All seven existing expressions remain valid.
- All three intensity levels are bounded and visually distinguishable.
- Animation can modulate intensity without changing the saved base expression.
- Voice puppetry overrides only the mouth and restores the animated face state.

### Asset behavior

- All six built-in dolls render with rigid motion.
- Current wearables, hair, accessories, and custom raster artwork remain visually
  attached during rigid motion.
- Unsupported articulated gestures fall back safely and are not advertised as
  fully supported for that asset.
- Missing assets retain the existing selectable placeholder behavior.

### Export behavior

- PNG export is deterministic and produces one still frame.
- Scene Book uses the same static pose evaluator as PNG export.
- Export does not start or capture microphone/audio data.
- Export cannot be changed by a concurrent animation tick after snapshot capture.

### Accessibility and release

- Animation controls meet the existing 44px target and keyboard requirements.
- system, reduce, and full behavior is testable.
- Animation stops safely on route change, page hide, and error recovery.
- Automated tests cover state, rendering, export, portability, accessibility, and
  lifecycle behavior.
- Hosted Safari/iPad evidence is added before family release.

## 15. Risks and mitigations

| Risk | Mitigation |
|:--|:--|
| Rigid motion is mistaken for a real wave or dance. | Label Phase 1 as motion presets and hide unsupported gestures. |
| SVG layers do not share joint geometry. | Introduce validated rig metadata and upgrade assets incrementally. |
| Custom PNG artwork cannot deform. | Keep rigid fallback and document the limitation. |
| Animation rebuilds Play every frame. | Use a runtime service and cached transforms or custom properties. |
| Voice and animation overwrite each other. | Define channel priority and keep voice ephemeral. |
| Reduced-motion setting is only stored, not applied. | Implement one effective-motion resolver before animation ships. |
| Export captures a nondeterministic frame. | Pass explicit animation time into the immutable export snapshot. |
| New persisted fields break old scenes. | Sanitize defaults and add schema/project portability fixtures. |
| Limb poses change character bounds. | Keep early poses inside the existing box; add pose-aware bounds first. |

## 16. Recommended decision

Approve this as a multi-phase initiative:

1. Ship rigid looping motion plus expression intensity as the first user-visible
   release.
2. Build and validate the rigged SVG contract in parallel with asset authoring.
3. Ship true limb gestures only after base dolls and required clothing layers have
   validated joint support.
4. Keep PNG and Scene Book as deterministic still exports until a separate
   animated-export PRD is approved.

This reaches the desired looping-doll experience without blocking on a complete
asset rewrite, while preserving a credible path to expressive body animation.

## 17. Scope amendment — rigid-safe animation only

Updated: 2026-08-21

This amendment supersedes the earlier references to future rigged assets,
articulated limb gestures, rigged clothing variants, and a pose-aware asset
expansion. The product will support two asset types for animation:

1. Custom/full-body painted art.
2. Current rigid clothing layered on the built-in modular dolls.

The product will not add, require, or plan for future pose-aware clothing,
pose-aware custom artwork, arm/leg deformation, physics-based cloth, or true
limb gestures. Existing pose groups and limb channels may remain in the code for
backward compatibility and safe fallback handling, but they are not user-facing
capabilities and must not be required for release.

### 17.1 Asset animation profiles

Animation capability is derived from the rendered asset composition. It is not
determined only by the selected clip.

#### Custom/full-body painted art

Custom art that represents a whole character or a full-body raster layer is a
single rigid visual. It supports:

- Root translation, rotation, and small scale changes.
- Whole-character bounce, sway, lean, and greeting motion.
- Expression modulation only when a separate modular face layer exists.
- Deterministic still rendering through PNG export and Scene Book.

It does not support:

- Independent head, arm, hand, leg, foot, or clothing deformation.
- Raster mesh deformation, redrawing, masking, or per-frame image processing.
- Animation that requires the painted image to remain attached to an unseen
  joint.

Full-body custom art should use a `root` motion profile. A custom hair or
head-only asset may continue to use its existing head-bound layer behavior, but
custom artwork must never be treated as limb-capable.

> [!NOTE]
> **Paint Studio authoring vs standalone artwork**:
> The user-facing Paint Studio workflow currently authors modular custom wearables (dresses, tops, bottoms, hair, hats, accessories) and custom scene props. When equipped on a modular doll, custom wearables follow the rigid clothing kinematic model (`root-head` profile) where the clothing layer rigidly moves with the doll root.
> The engine's `root` motion profile is fully implemented and enforced in `resolveMotionProfile` and `evaluateCharacterPose` to protect any standalone full-body raster character artwork (`custom_full` or `isCustomArt`) against head, arm, and leg deformations.

#### Current rigid clothing

Current tops, bottoms, dresses, shoes, accessories, and custom raster wearables
remain independent rigid layers under the character motion wrapper. They support:

- Root motion applied to the complete dressed doll.
- Small whole-character bounce, sway, lean, and greeting motion.
- Existing head motion for the modular base head and explicitly head-bound hair
  or accessories where that behavior is already safe.
- Existing expression and voice priority rules.

They do not support:

- Arm-left, arm-right, leg-left, or leg-right channels.
- Static poses that require independently positioned hands or legs.
- A clip label that implies waving, pointing, clapping, kicking, or a true
  articulated dance.

All current clothing remains `rigid` for animation purposes. No new clothing
metadata, joint IDs, pivots, or pose-aware SVG groups are required.

### 17.2 Rigid-safe motion catalog

The supported catalog must use motion that remains coherent when every clothing
layer follows the root. The UI labels should describe the visible result rather
than imply a limb action.

| User-facing label | Internal intent | Channels | Notes |
|:--|:--|:--|:--|
| Idle / Breathe | `idle` | root, optional head, expression | Very small periodic motion. |
| Happy bounce | `happy-bounce` | root, optional head, expression | Vertical bounce with bounded squash/stretch. |
| Gentle sway | `sway` | root, optional head | Side-to-side movement. |
| Hello | `hello` | root, optional head, expression | Fake wave made from lean, head tilt, and smile. |
| Bouncy celebration | `celebrate` | root, optional head, expression | Safe replacement for clap or jump. |
| Nod | `nod` | optional head, expression | Available only for modular head-capable compositions. |
| Look around | `look-around` | optional head | Available only for modular head-capable compositions. |
| None | `none` | none | Canonical static frame. |

`Rhythmic sway` may be offered as an alternative to `dance` if the product wants
a stronger performance label. It must remain clear that the motion is whole-body
sway and bounce, not a limb dance.

The following actions are not advertised or selectable for these asset types:

- Wave, point, clap, kick, and hands-on-hips.
- Arms-up and other hand-specific static poses.
- Any animation whose primary visual claim depends on an independent limb.

### 17.3 Fake greeting and dance limits

The rigid-safe clips must stay inside conservative bounds so that outlines,
shoes, hair, custom art, and attached scene items do not appear to detach or
leak outside the authored character area.

Recommended maximum values at normal intensity:

- Root x: ±6 px.
- Root y: ±10 px for a bounce; ±3 px for sway or greeting.
- Root rotation: ±4°.
- Root scale: 0.98–1.02.
- Head x/y: ±3 px when head motion is supported.
- Head rotation: ±6° when head motion is supported.
- Expression intensity multiplier: 1.0–1.15.

The `hello` clip should use a short alternating root lean, a small head tilt when
available, and a temporary smile or expression-intensity increase. It must not
move an arm channel that is subsequently zeroed by rigid fallback. The
`celebrate` clip should use a bounce and sway combination rather than clap or
hand movement.

### 17.4 Clip compatibility and legacy migration

Every persisted or imported clip must resolve to a rigid-safe clip before it is
rendered. New scenes may persist only the rigid-safe catalog IDs.

Legacy IDs remain accepted at the state boundary so older projects do not fail to
load. They are normalized as follows:

~~~js
const RIGID_CLIP_FALLBACKS = {
  wave: 'hello',
  point: 'look-around',
  clap: 'celebrate',
  dance: 'sway',
  jump: 'happy-bounce'
};

const RIGID_POSE_FALLBACKS = {
  wave: 'lean_left',
  point: 'look_right',
  hands_on_hips: 'rest',
  arms_up: 'rest'
};
~~~

The exact fallback may be changed during localization or usability review, but
the result must never claim that the original limb action occurred. A legacy
clip may either be migrated to its safe replacement or produce a visible
whole-body fallback status; it must not silently render a broken partial pose.

The resolver should use a small derived profile rather than inspecting every
frame:

~~~js
{
  motionProfile: 'root',       // full-body custom artwork
  safeClips: ['none', 'idle', 'happy-bounce', 'sway', 'hello', 'celebrate']
}

{
  motionProfile: 'root-head',  // modular doll with rigid clothing
  safeClips: ['none', 'idle', 'happy-bounce', 'sway', 'hello', 'celebrate', 'nod', 'look-around']
}
~~~

The profile is derived runtime data and must not be persisted as a second source
of truth. Persist the authored safe `clipId`; persist no current frame or
per-frame fallback state.

### 17.5 Renderer and clothing recommendations

- Keep all current clothing layers below one character motion wrapper so root
  transforms move the complete outfit together.
- Keep head-bound selectors limited to the existing modular head, hair, and
  head-accessory cases. Do not infer head capability from arbitrary custom PNG
  content.
- Keep arm and leg CSS variables available as defensive no-op channels, but do
  not include them in rigid-safe clips.
- Keep the rigid clothing fallback in the evaluator as a safety net for legacy
  clips and imported projects.
- Do not apply an arm or leg transform to an entire shirt, dress, shoe pair, or
  full-body custom image. That causes torso rotation, clothing separation, or
  visible leaks.
- Use transform and custom-property updates during playback. Do not rebuild
  SVG layers, reload assets, or redraw raster images per frame.
- Keep root amplitudes inside the existing character box. If a clip needs a
  larger movement, add a new authored static bound before increasing it.
- Preserve the existing scene positioner, flip wrapper, attachment kinematics,
  voice priority, reduced-motion behavior, and deterministic export path.

### 17.6 UI recommendations

- Show only the safe clip list for the selected composition.
- Remove limb-specific controls instead of showing controls that produce no
  visible result.
- Use labels such as `Hello`, `Gentle sway`, and `Bouncy celebration`; do not
  label root-only motion `Wave`, `Clap`, or `Dance` without a clarifying whole-
  body description.
- If a legacy project is downgraded, show a short non-blocking message such as
  “This animation uses a whole-body version for this artwork.”
- Keep static pose controls limited to rest, lean, look, and tilt poses that are
  visually valid for the composition.
- Do not make animation required for understanding, editing, selecting, or
  exporting custom artwork.

### 17.7 Verification and acceptance criteria

- Custom/full-body painted art remains visually coherent for every safe clip at
  subtle, normal, and strong intensity.
- Current rigid clothing, including tops, bottoms, dresses, shoes, hair,
  accessories, and custom raster wearables, moves together with the root.
- No supported safe clip produces non-zero arm or leg transforms.
- Legacy wave, point, clap, dance, jump, and limb poses load through a
  deterministic rigid-safe fallback.
- Play, pause, reset, reduced motion, Scene Book, and PNG export use the same
  evaluated static frame.
- Safe clips do not change saved scene coordinates, history, attachments, or
  project portability data.
- A full-body custom image never receives a head, arm, or leg transform.
- Automated tests cover clip filtering, legacy migration, rigid clothing, custom
  raster artwork, export parity, reduced motion, and maximum transform bounds.

### 17.8 Final recommendation

Ship a deliberately bounded whole-body animation product. Keep the runtime
channels and rigid fallback defensive, but remove limb-specific promises from the
catalog and UI. The strongest safe experience is a small set of polished clips—
idle, bounce, sway, hello, celebration, nod, and look-around—whose names match
what users can see on both built-in outfits and custom painted artwork.
