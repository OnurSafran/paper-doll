# Paper Doll Studio & Play Sandbox

A dependency-free browser game with two connected experiences:

1. **Designer** — assemble, recolor, name, and save a paper doll.
2. **Play Sandbox** — place saved dolls and props into scenes, then move, flip, scale, reorder, duplicate, and remove them.

The working vertical slice includes local persistence, Scene Book, Undo/Redo, PNG export, static expressions, and local microphone-driven voice puppetry. Gate A correctness and Gate B architecture hardening are complete, with formal release evidence recorded in [QUALITY.md](docs/QUALITY.md).

## Product promise

A player can create a doll, save it, use it in a scene, refresh, and continue without silent data loss. Pointer, touch, and keyboard users have equivalent non-drag paths for core actions.

## Project rules

- Vanilla HTML, CSS, and ES modules; no runtime packages or CDN resources.
- `AppStore` is the source of truth; DOM is derived output.
- Play uses a fixed `1600 × 900` logical stage.
- Persisted data is versioned, validated, bounded, and recoverable.
- Current-scene mutations are undoable and autosave only after commit.
- SVG assets are cataloged, same-origin, and validated against a safe subset.
- Scene, export, and persisted state must agree on transforms, colors, ordering, and expressions.
- No accounts, analytics, uploads, or audio recording in the current product.
- The app is an installable PWA: its app shell and cataloged artwork are cached for offline play.

## Documentation

These are the canonical project documents:

| Document | Authority |
|:--|:--|
| [PROJECT.md](docs/PROJECT.md) | Product scope, behavior, data contracts, limits, and future feature specifications |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | State ownership, module boundaries, rendering, persistence, input, export, and security |
| [ASSETS.md](docs/ASSETS.md) | Art, SVG, coordinate, catalog, provenance, and validation rules |
| [ROADMAP.md](docs/ROADMAP.md) | Current implementation status, blockers, architecture work, and prioritized delivery plan |
| [QUALITY.md](docs/QUALITY.md) | Automated checks, browser/accessibility/performance matrices, and release gate |
| [DECISIONS.md](docs/DECISIONS.md) | Accepted decisions and pending architecture commitments |
| [OFFLINE-PWA.md](docs/OFFLINE-PWA.md) | iPad installation, offline behavior, hosting, and update procedure |
| [CUSTOM-PAINT-STUDIO.md](docs/CUSTOM-PAINT-STUDIO.md) | Custom Paint Studio PRD, raster/SVG decision, prerequisites, storage contracts, and gated delivery plan |

Dated audits are non-canonical history under [`review/`](review/). If a review conflicts with a canonical document, the canonical document wins.

## Run and validate

Serve through HTTP rather than opening `index.html` directly:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

```bash
npm run check
```

The equivalent commands are:

```bash
node scripts/validate-docs.mjs
node scripts/validate-assets.mjs
node --test
```

## Definition of done

Release requires the correctness blockers in [ROADMAP.md](docs/ROADMAP.md) to be closed and the dated evidence in [QUALITY.md](docs/QUALITY.md) to pass. Automated source-contract checks alone do not close browser, accessibility, or performance gates.
