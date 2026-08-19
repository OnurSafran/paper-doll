# PRD — Character Expressions, Poses, and Looping Scene Animation

Status: Proposed

Updated: 2026-08-19

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
- Visual animation may autoplay only after the product decision is explicit; the
  initial recommendation is to start it only when the player presses Play.
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

### Phase 0 — Contracts and visual prototype

Deliver:

- Final vocabulary for expressions, intensity, poses, and clips.
- Reduced-motion runtime contract.
- One prototype rigid clip: idle-breathe or happy-bounce.
- One static-frame evaluator used by DOM and export tests.
- Decision on whether Play auto-starts animation.

Exit criteria:

- One dressed doll loops without scene-coordinate drift.
- Pause and reset are deterministic.
- Reduced motion disables movement.
- Existing test baseline remains green.

### Phase 1 — Rigid motion MVP

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

