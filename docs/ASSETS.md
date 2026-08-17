# Asset Strategy

## Art direction

Flat paper-craft cutouts with warm outlines, soft solid colors, slight physical irregularity, and restrained CSS shadow. Assets remain recognizable in grayscale and tray previews.

- No gradients, filters, animation, embedded raster images, remote references, or font-dependent text in bundled SVG.
- Tintable areas use semantic classes; outlines and fixed details retain authored colors.
- Body/garment shapes avoid sexualized proportions and unreviewed cultural defaults.
- Generated art is a draft and requires manual cleanup, alignment review, provenance, and validation.

## Coordinate contracts

### Custom Paint Studio raster assets

- Wearables use a `300 × 450` logical canvas and a `600 × 900` transparent PNG bitmap.
- Props use a `500 × 500` logical canvas and a `1000 × 1000` transparent PNG bitmap.
- PNG bytes are player-created, same-origin, and stored in IndexedDB; they never enter the SVG catalog or service-worker cache.
- Custom metadata keeps logical dimensions, pixel dimensions, digest, display bounds, and anchor. Derived thumbnails and object URLs are runtime-only.
- Project import validates PNG signature, dimensions, byte limit, digest, and browser decode before metadata is committed.

### Doll, face, hair, and wearables

- `viewBox="0 0 300 450"`
- Root `data-asset-id` matches catalog ID.
- Base models (6 models across 5 life stages: `doll_classic_a`, `doll_classic_b`, `doll_chibi_a`, `doll_baby_a`, `doll_adult_a`, `doll_elder_a`) require `#body` and `<g id="baked-face">`.
- Modular face assets (`eyes`, `eyebrows`, `nose`, `mouth`, `detail`) require `#face-feature`.
- Ordinary wearables require `#garment` and declare `supportedFitFamilies` and `presentationStyles`.
- Built-in hair requires `#hairBack` and `#hairFront`. Single-layer custom hair renders as transparent PNG at Layer 70.
- Geometry is authored in doll coordinates; equip selects a slot and never guesses anchors.

### Backgrounds

- `viewBox="0 0 800 500"`
- Full bleed; runtime uses crop-to-fill for the `1600 × 900` stage.
- Important content avoids the outer 50 source units.

### Props

- Default `viewBox="0 0 1000 1000"`
- Catalog defines `displayWidth`, `displayHeight`, `groundAnchor`, and `defaultScale`.
- Transparent padding is trimmed.
- Scene clamping uses this metadata to keep props bounded within the stage.

## Recolor contract

| Class | Source |
|:--|:--|
| `.skin-fill` | `--skin-color` |
| `.hair-fill` | `--hair-color` |
| `.tint-primary` | `--asset-color-primary` |
| `.tint-secondary` | `--asset-color-secondary` |
| `.outline` | shared outline token |
| `.fixed-detail` | authored literal color |

State stores only catalog palette tokens or normalized six-digit hex colors. Arbitrary CSS, alpha, gradient, `url(...)`, and other style text are rejected.

## SVG safety

Both build validator and runtime loader reject:

- `script`, `style`, `foreignObject`, frames, objects, embeds, audio/video/image
- gradients, filters, and SVG animation in the current supported subset
- event-handler attributes
- external `href`, `xlink:href`, CSS URL/imports, and `data:` URLs
- DOCTYPE/entities and unexpected namespaces
- duplicate IDs within a file
- wrong root, catalog ID, viewBox, or required groups
- files/shapes over budget

Internal referenced IDs require per-clone scoping before pattern/definition features are admitted.

| Type | Max bytes | Max shapes |
|:--|--:|--:|
| Doll/wearable | 150 KB | 250 |
| Prop | 200 KB | 350 |
| Background | 400 KB | 800 |

## Catalog examples

```javascript
{
  id: 'top_tshirt',
  kind: 'wearable',
  slot: 'top',
  name: 'Sailor stripe tee',
  path: 'assets/clothing/tops/tshirt.svg',
  viewBox: [0, 0, 300, 450],
  tintable: true,
  defaultColors: { primary: 'coral' },
  requiredGroups: ['garment']
}
```

```javascript
{
  id: 'prop_chair',
  kind: 'prop',
  path: 'assets/props/chair.svg',
  viewBox: [0, 0, 1000, 1000],
  displayWidth: 240,
  displayHeight: 270,
  groundAnchor: { x: 0.5, y: 1.0 },
  defaultScale: 1
}
```

Every catalog asset also carries immutable provenance metadata:

```javascript
metadata: {
  added_date: '2026-08-16',
  creator: 'Paper Doll Studio',
  concept: 'core',
  dlc: 'core',
  source: 'project-authored SVG primitives and paths'
}
```

`dlc: 'core'` identifies content shipped in the current product rather than a
future optional pack. New themed batches may use a more specific `concept`
while remaining part of the core DLC until the product adds pack selection.

Catalog IDs are persisted identifiers. Labels/files may change without changing IDs. Removing an ID requires migration or an explicit placeholder policy.

## Current inventory

- 3 base dolls: classic, joy, and chibi
- 9 tops, 7 bottoms, 5 dresses, 6 shoe pairs, 8 hairstyles, 10 accessories
- 7 backgrounds: bedroom, park, atelier, beach, cafe, forest, library
- 22 props: chair, table, plant, lamp, rug, tea set, easel, bookshelf, cat, picnic basket, umbrella, balloons, cake, guitar, painting, bench, bicycle, kite, camera, flower pot, mailbox, picnic blanket

Total: 77 cataloged SVG files, including 45 wearable/hair/accessory assets, 3 base dolls, 7 backgrounds, and 22 props.

## Production and acceptance

1. Freeze coordinate, group, palette, and safety contracts.
2. Build one representative asset per type and prove the full render path.
3. Validate, check recolor/alignment/preview/scene sizing, then expand the set.
4. Remove editor metadata and unused definitions.
5. Register catalog metadata and provenance.
6. Test long hair + hat + dress, hoodie + skirt, and largest prop at `2×`.

Each asset must pass validator, alternate-tint, `200%` zoom, preview, bounds, flip/scale, placeholder-label, and distribution-provenance checks.

Adding ordinary assets should require only SVG plus catalog entry. New slots, interactive state, uploads, patterns, or coordinate changes require schema, security, migration, test, and roadmap updates.
