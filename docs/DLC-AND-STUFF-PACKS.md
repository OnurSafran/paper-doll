# DLC Expansions: Packages, Content, and Roadmap

**Feature Area**: Content Packs, DLC Architecture & Expansion Packs  
**Current Version**: v1.20.0  
**Status**: Family & Home Stories development build implemented; independent release QA pending — 2026-09-12  
**Related Documents**: [ARCHITECTURE.md](ARCHITECTURE.md) · [ASSETS.md](ASSETS.md) · [ROADMAP.md](ROADMAP.md) · [PRD-WORLD-MAP.md](PRD-WORLD-MAP.md) · [DECISIONS.md](DECISIONS.md)

---

## 1. Executive Summary

**Decision:** Lock **Family & Home Stories** (`pack_family_home`) as the first expansion. The remaining four expansions stay in the proposed order: **Neighborhood Life**, **Nature & Animal Adventures**, **School, City & Creative Life**, and **Enchanted Worlds**. Each expansion is planned as a complete wardrobe, prop collection, four settings, and several connected storytelling chapters.

The first expansion scope is approved and its development build is implemented. The [exact ledger and verification status](FAMILY-HOME-IMPLEMENTATION.md) are available; its hosted release date is not assigned. [ROADMAP.md](ROADMAP.md) remains authoritative for implementation status and delivery order. “DLC” means optional content here; purchases, accounts, storefronts, and online community hosting are outside this proposal. Priorities are design judgments based on the local catalog and implementation, not player-research findings.

### Packaging decisions

- **One identity per expansion:** one pack ID, cover, library filter, manifest, and release version. Chapters organize the contents of that package.
- **Complete experiences:** each expansion supports several related stories using only core + that expansion. Another DLC is never required to complete its starter scenes.
- **Substantial content:** target roughly 90 new catalog assets per expansion, with exact IDs and fit variants locked before production. The totals below are proposed production budgets, not completed inventories.
- **Connected chapters:** nursery, sleepover, and celebrations share a family home; bakery, market, and community roles share a neighborhood. Seasonal ideas are included in these larger packages.
- **Build in internal batches:** use a small representative scene to prove fit and performance, then complete the whole expansion before its public release. Internal batches are not separate DLC products.
- **Keep feature scope explicit:** pets, cooking, transport, and magic initially support scene-based pretend play. New animation or simulation systems require their own implementation gates.

### First expansion lock

The locked first expansion is **Family & Home Stories**:

- **Identity:** `pack_family_home`
- **Content budget:** 48 wearables, 40 props, and 4 backgrounds
- **Story content:** 6 starter scenes, 12 bilingual story prompts, and 8 compatible outfit recipes
- **Coverage:** all five life stages, with deliberate priority for baby, child, adult, and elder gaps
- **Settings:** family living room, pastel nursery, shared bedroom, and a house-and-garden panorama
- **Scope boundary:** static scene-based pretend play; no caregiving meters, economy, simulation, or required new animation system
- **Core reuse:** cake, balloons, tea set, armchair, and sleeping cat remain core assets and are not counted again

This locks the product scope and production budget. The exact ledger, fit assignments and authored files are now available in [FAMILY-HOME-IMPLEMENTATION.md](FAMILY-HOME-IMPLEMENTATION.md).


Paper Doll Studio is a zero-dependency, offline-first, client-side paper doll storytelling studio. The shipped core catalog (`v1.20.0`) provides **145 cataloged SVG assets** across 6 base dolls, 19 modular facial features, 87 wearables/hair/accessories, 11 backgrounds, and 22 props.

All catalog assets already carry provenance metadata declaring their content-pack origin:
```javascript
metadata: {
  added_date: '2026-08-16',
  creator: 'Paper Doll Studio',
  concept: 'core',
  dlc: 'core',
  source: 'project-authored SVG primitives and paths'
}
```
As documented in [DECISIONS.md (D-036)](DECISIONS.md) and [ASSETS.md](ASSETS.md), `metadata.dlc` is designed as a content-pack marker (`core` today, stable DLC identifier in future expansions).

This document establishes:
1. **Full Inventory & Content Gap Analysis** of the existing catalog.
2. **Five Consolidated DLC Expansions** with chapter groupings, content budgets, settings, and story briefs.
3. **Technical Architecture** for modular pack manifests, pack toggling, fallback handling, and offline PWA service worker caching.
4. **Step-by-Step Strategic Delivery Roadmap** from engine foundation to player-authored `.dollpack` sharing.

---

## 2. Current Asset Inventory & Gap Analysis

### 2.1 Shipped Core Inventory (`dlc: 'core'`)

| Category | Count | Shipped Assets & Highlights |
| :--- | :---: | :--- |
| **Base Dolls** | **6** | 5 Life stages: `doll_classic_a` (Teen), `doll_classic_b` (Joy/Teen), `doll_chibi_a` (Child), `doll_baby_a` (Baby), `doll_adult_a` (Adult), `doll_elder_a` (Elder). All support full limb/head articulation. |
| **Face Features** | **19** | 5 Eyes (`classic`, `round`, `sparkle`, `calm`, `curious`), 4 Eyebrows (`soft`, `arched`, `bold`, `expressive`), 3 Noses (`dot`, `button`, `soft_curve`), 5 Mouths (`gentle_smile`, `open_smile`, `neutral`, `playful`, `smirk`), 2 Details (`detail_blush`, `detail_freckles`). |
| **Tops** | **15** | Sailor tee, ruffle blouse, cozy hoodie, knit cardigan, denim jacket, sweater, sailor blouse, raincoat, vest, classic cardigan, tailored coat, playground tee/hoodie, baby cardigan/tee. |
| **Bottoms** | **13** | High-waist jeans, tennis skirt, pleated shorts, dungaree overalls, plaid pleated skirt, garden culottes, pocket cargo, classic trousers, relaxed slacks, playground shorts/jeans, baby bloomers/leggings. |
| **Dresses** | **14** | Sundress, tiered party dress, pinafore apron, princess ballgown, patchwork overall dress, baby romper/sundress/party dress, child play/rain dress, adult wrap/suit dress, elder knit/apron dress. |
| **Shoes** | **12** | Retro sneakers, Mary Jane flats, ankle boots, loafers, ballet flats, rainboots, baby booties, classic oxfords, child sneakers/rainboots, baby sandals/sneakers. |
| **Hairstyles** | **15** | Chic bob, long waves, high ponytail, bouncy twintails, voluminous curls, crown braids, top knot bun, wavy bob, baby curl/puffs/bun, silver waves, short slick, child bob/curls. |
| **Accessories** | **18** | Sun hat, cat-eye glasses, silk bow, artist beret, golden tiara, headphones, cat ears, polka ribbon, star hairclip, daisy flower, baby bib/pacifier/bonnet/rattle, elder shawl/spectacles, child cap/backpack. |
| **Backgrounds** | **11** | **7 Standard (1600×900)**: Bedroom, Park, Atelier, Beach, Cafe, Forest, Library.<br>**3 Panoramics (3200×900)**: Moonlit Meadow, Snowy Village, Rooftop Sunset.<br>**1 Mega Panorama (4800×900)**: Candy Land. |
| **Props** | **22** | **Home (8)**: Armchair, table, monstera, floor lamp, pastel rug, tea set, bookshelf, sleeping cat.<br>**Outdoors (6)**: Parasol, bench, bicycle, flower pot, mailbox, picnic blanket.<br>**Creative (4)**: Easel, guitar, camera, wall art.<br>**Fun (4)**: Picnic basket, balloons, cake, kite. |
| **Animation Clips** | **8** | `idle`, `talk`, `celebrate`, `walk`, `wave`, `bow`, `laugh`, `listen`. |
| **World Map** | **11** | 3 Biomes (`cozyTown`, `theWilds`, `dreamRealms`), 11 landmarks with interactive easter eggs & collectible souvenir stamps. |

---

### 2.2 Content Gaps & Opportunities

1. **Life-Stage Imbalance**:
   - Source-derived compatible wearable entries: **baby 17, child 12, teen 50, adult 13, elder 13**. These include hair and accessories; they are not complete outfits and can overlap across fit families.
   - Child, adult, and elder each have only two compatible choices in tops, bottoms, dresses, hair, and accessories. Prioritize those gaps instead of adding mostly teen garments.
   - Counts were checked against `ASSETS` and `supportedFitFamilies` in `js/core/asset-catalog.js` on 2026-09-10.
2. **Sparse Prop Ecosystem**:
   - 22 props is modest for complex storytelling.
   - Only **one placeable animal prop** exists (`prop_cat`); world-map animal decorations and easter eggs are separate.
   - Food and culinary items are limited to `prop_tea_set` and `prop_cake`.
3. **Underrepresented Aesthetic Themes**:
   - **Magic, Fantasy & Fairy Tale**: Only the tiara and ballgown exist; missing wands, cauldrons, potions, wings, and enchanted fauna.
   - **Kitchen & Gastronomy**: A cafe exists, but no kitchen counters, baking tools, coffee machines, or breads.
   - **School & Academy**: Library exists, but no school desks or lockers; a child backpack already exists (`accessory_backpack_child`).
   - **Modern Streetwear & Athleisure**: Sneakers and hoodies exist, but no contemporary urban/skater fashion.
   - **Nursery & Cozy Domestic Life**: Cribs, high chairs, strollers, and plush toys are absent.

---

## 3. Five Large DLC Packages

### 3.1 Lineup and Content Budgets

All names are working titles. **Wearables** include garments, shoes, hair, and accessories. Each budget counts unique authored catalog IDs, including any separately authored fit variants; recolors and outfit recipes do not increase the count. Props include placeable animals. Templates and story prompts are additional content, outside asset totals.

| DLC | Main promise | Wearables | Props | Backgrounds | Total new assets |
| :--- | :--- | ---: | ---: | ---: | ---: |
| **Family & Home Stories / Aile ve Ev Hikâyeleri** | Grow, gather, celebrate, and spend everyday time together. | 48 | 40 | 4 | **92** |
| **Neighborhood Life / Mahalle Hayatı** | Run a bakery, visit the market, help neighbors, and travel along the waterfront. | 42 | 44 | 4 | **90** |
| **Nature & Animal Adventures / Doğa ve Hayvan Maceraları** | Care for pets, grow a garden, camp beneath the stars, and explore the beach. | 42 | 46 | 4 | **92** |
| **School, City & Creative Life / Okul, Şehir ve Yaratıcılık** | Make friends, develop a style, join clubs, and put on a show. | 50 | 38 | 4 | **92** |
| **Enchanted Worlds / Büyülü Dünyalar** | Become a magic apprentice, visit a royal garden, and explore a miniature woodland. | 48 | 40 | 4 | **92** |
| **Entire proposed lineup** | Five independent expansions | **230** | **208** | **20** | **458** |

These are full-expansion planning targets. The chapter allocations below sum to these totals; detailed item lists are representative selections within each allocation, not additional promises. Confirm costs and adjust the locked scope before production. Each background budget allows three standard stages and one panorama, subject to device performance validation.

### 3.2 DLC 1 — Family & Home Stories — Locked First Expansion

**Turkish title:** *Aile ve Ev Hikâyeleri*  
**Pack ID:** `pack_family_home`  
**Lock status:** Product scope and production budget locked on 2026-09-12; exact asset-ID ledger pending.  
**Player promise:** Create a household and tell stories from a baby's first room to a grandparent's birthday.

**Combines:** Everyday Together + Little Steps Nursery + Grandparent Weekends + Sleepover Club + Birthday at Home + Autumn Reading + Winter Window + New Year Wishes + Bayram Visit.

| Included chapter | Wardrobe and prop direction | Wearables | Props |
| :--- | :--- | ---: | ---: |
| **Everyday Together** | Casual tops, trousers, practical shoes, relaxed dresses, short/textured hairstyles; laundry basket, cushions, and family photo frames. | 12 | 5 |
| **Little Steps** | Baby rompers, bloomers, sleepsuits, toddler overalls, animal booties; crib, high chair, stroller, rocking horse, blocks, play mat, teddy bear. | 12 | 9 |
| **Grandparent Weekends** | Contemporary elder clothing, shared-hobby outfits; knitting basket, dominoes, photo album, reading lamp, book stack. | 10 | 7 |
| **Sleepover Club** | Pajamas, dressing gowns, slippers; sleeping bags, popcorn, board game, blanket fort, cocoa mugs. | 8 | 8 |
| **Family Celebrations** | Party outfits and visiting clothes; gifts, bunting, candy bowl, cologne bottle, serving tray, winter decorations, snow globe, greeting cards. | 6 | 11 |
| **Chapter totals** | Plus four backgrounds | **48** | **40** |

**Four settings:** family living room, pastel nursery, shared bedroom, and a house-and-garden panorama. Furnish the backgrounds lightly so the new furniture can determine the scene.

**Life-stage coverage:** all five. Protect at least 10 wearable IDs primarily authored for baby, 10 for child, 10 for adult, and 12 for elder; the remaining 6 can serve teen or another identified gap. These are allocations within the 48-ID budget, not extra variants. Chapter assignments and fit assignments are separate views of the same inventory.

**Six starter scenes:** welcome home, build a blanket fort, grandparent hobby afternoon, surprise birthday, winter reading evening, and Bayram visit. Each includes two optional story prompts.

**Signature scene:** Three generations prepare a surprise birthday while the youngest family member hides a gift under the table.

**Core reuse:** existing cake, balloons, tea set, armchair, and sleeping cat. Do not repackage these as new assets.

**Scope boundary:** cribs, high chairs, and strollers need verified doll placement and layering. An illustrated stroller does not imply riding, automatic attachments, or caregiving meters.

### 3.3 DLC 2 — Neighborhood Life

**Turkish title:** *Mahalle Hayatı*  
**Proposed ID:** `pack_neighborhood_life`  
**Player promise:** Build a neighborhood where every shop, street corner, and ferry trip starts a story.

**Combines:** Petite Patisserie & Cozy Kitchen + Neighborhood Market + Community Helpers + Rainy Day Town + Ferry & Coastal Town.

| Included chapter | Wardrobe and prop direction | Wearables | Props |
| :--- | :--- | ---: | ---: |
| **Bakery & Kitchen** | Chef tunics, aprons, baker shirts, kitchen clogs, bandana hairstyles; stand mixer, pastry case, espresso machine, pastry board, tart, island, macaron tray, bread crate, bistro stool. | 12 | 12 |
| **Market Day** | Seller outfits and shopper clothing; fruit stalls, crates, scales, trolley, baskets, awnings. | 8 | 10 |
| **Community Helpers** | Librarian cardigan, postal vest, mechanic overalls; mailbag, parcel stack, tool chest, repair bench, lending cart. | 8 | 8 |
| **Rainy Day Streets** | Rainwear for child, adult, and elder; umbrellas, puddles, bus shelter, newspaper stand, window-seat furnishings. | 8 | 7 |
| **Ferry & Waterfront** | Breezy travel outfits and accessories; life rings, luggage, seagull, simit tray, ticket stand, dock details. | 6 | 7 |
| **Chapter totals** | Plus four backgrounds | **42** | **44** |

**Four settings:** sunlit bakery kitchen, neighborhood square, ferry deck, and a waterfront shopping-street panorama with a sheltered stop. Rain is represented by optional static scenery pieces so the street also works on sunny days.

**Life-stage coverage:** emphasize adult and elder shopkeepers/helpers, with child and teen visitors. At least half of the wearable budget should be primarily authored for adult or elder. Baby visitors reuse core/family-compatible clothing; this expansion must still work with core alone.

**Six starter scenes:** open the bakery, prepare a surprise order, set up market day, deliver a mysterious parcel, repair a neighbor's bicycle, and catch the ferry before the picnic. Each includes two optional story prompts.

**Signature scene:** A baker sends a celebration order through the market and onto a ferry, with a detour to help a neighbor.

**Core reuse:** Cafe, Library, bicycle, mailbox, camera, tea set. Waterfront props complement the beach expansion, but its holiday content is optional.

**Scope boundary:** no shop economy, cooking minigame, vehicle movement system, or live weather. Food preparation and journeys are player-authored scenes.

### 3.4 DLC 3 — Nature & Animal Adventures

**Turkish title:** *Doğa ve Hayvan Maceraları*  
**Proposed ID:** `pack_nature_animals`  
**Player promise:** Spend an entire outdoor weekend with animals, gardens, camping, and seaside discoveries.

**Combines:** Furry Friends & Animal Companions + Garden & Greenhouse + Camping & Stargazing + Seaside Holiday + Spring Picnic.

| Included chapter | Wardrobe and prop direction | Wearables | Props |
| :--- | :--- | ---: | ---: |
| **Animal Companions** | Vet scrubs, dog-walking vest, paw sweater, grooming apron, walking shoes; dog, calico cat, rabbit, hamster habitat, carrier, pet bed, cat tree, bowls, vet table, toys. | 12 | 16 |
| **Garden & Greenhouse** | Gardening overalls, aprons, boots, sun hats; watering can, raised bed, seed packets, harvest basket, potting table, planters. | 10 | 11 |
| **Camping & Stargazing** | Fleeces, hiking clothes, boots; tent, lantern, telescope, sleeping rolls, star chart, camp table. | 10 | 9 |
| **Seaside & Spring Picnic** | Beach outfits, sandals, beach bags; sandcastle, shells, lifebuoy, changing hut, daisy garland, lemonade, sandwiches, butterfly, gingham cushion. | 10 | 10 |
| **Chapter totals** | Plus four backgrounds | **42** | **46** |

**Four settings:** pet-care room, greenhouse garden, campsite clearing, and a coast-and-dog-park panorama. Existing Forest, Moonlit Meadow, Park, and Beach provide additional scene variety.

**Life-stage coverage:** child, teen, adult, and elder outdoor clothing, plus a small baby seaside/picnic selection within the 42-ID budget. Include active elder looks and practical sun-safe outfits.

**Six starter scenes:** welcome a pet, visit the vet, prepare the community garden, harvest for a picnic, set up camp, and discover something on the beach. Each includes two optional story prompts.

**Signature scene:** A family gathers vegetables, packs a picnic, walks the dog to the coast, and finishes the day beneath the stars.

**Core reuse:** parasol, picnic basket, blanket, flower pot, bench, and kite. New picnic pieces extend those items.

**Scope boundary:** animals are static placeable props at launch. Tail animation, leashes that follow characters, plant growth, and survival mechanics are separate features. A veterinary scene uses pretend-play props without procedural medical instructions.

### 3.5 DLC 4 — School, City & Creative Life

**Turkish title:** *Okul, Şehir ve Yaratıcılık*  
**Proposed ID:** `pack_school_creative`  
**Player promise:** Dress for the day, find a club, create something with friends, and perform it at the school festival.

**Combines:** Sakura Academy & Campus Life + Urban Streetwear & Athleisure + Creative Workshop + Stage & Costume Box + Space Club.

| Included chapter | Wardrobe and prop direction | Wearables | Props |
| :--- | :--- | ---: | ---: |
| **Academy & Campus** | Age-appropriate uniforms, PE clothes, hairstyles, school accessories; desks, chalkboard, lockers, bento, sports bag. | 12 | 9 |
| **Streetwear & After School** | Bomber jackets, joggers, biker shorts, cropped hoodies, graphic tees, bucket hats, beanies, chunky sneakers, totes; skateboard, turntable, garment rack, boombox. | 12 | 6 |
| **Creative Workshop** | Smocks and practical studio outfits; sewing machine, fabric rolls, pottery wheel, clay pieces, craft table, thread rack. | 8 | 8 |
| **Stage & Festival** | Stage costumes, yukata, appropriate festival footwear and accessories; curtain, scenery flats, microphone stand, ticket booth, lanterns, dango cart. | 10 | 9 |
| **Space Club** | Astronaut costumes, helmets, mission-team outfits; telescope/model rocket, moon rocks, mission desk, freestanding moon-base scenery. | 8 | 6 |
| **Chapter totals** | Plus four backgrounds | **50** | **38** |

**Four settings:** classroom, flexible art-and-performance studio, imaginary moon-base stage, and sakura campus-to-skatepark panorama. The Space Club chapter stages a science-fiction school production and can also be used for independent astronaut stories.

**Life-stage coverage:** primarily child and teen, with adult/elder teacher, craft mentor, and performer outfits. Fit targets for festival garments are explicit. Review cultural names and age/context coherence; festival dress is not described as an everyday school uniform.

**Six starter scenes:** first day at school, start a club, after-school skate meetup, prepare the exhibition, rehearse the moon mission, and open the campus festival. Each includes two optional story prompts.

**Signature scene:** Friends design costumes, build a moon set, and stage a space adventure for their neighborhood festival.

**Core reuse:** Atelier, Library, guitar, easel, camera, and child backpack. The stage works with existing voice puppetry and gestures.

**Scope boundary:** helmets and elaborate costumes need layer/pose review. Sewing, pottery, skating, and space travel are storytelling themes; new crafting editors, sport physics, and flight controls are outside the content release.

### 3.6 DLC 5 — Enchanted Worlds

**Turkish title:** *Büyülü Dünyalar*  
**Proposed ID:** `pack_enchanted_worlds`  
**Player promise:** Travel from a cozy magic school to a royal garden and a tiny woodland kingdom.

**Combines:** Witchy Magic & The Enchanted Realm + Royal Garden Stories + Miniature Worlds.

| Included chapter | Wardrobe and prop direction | Wearables | Props |
| :--- | :--- | ---: | ---: |
| **Magic Academy & Observatory** | Witch robes, apprentice tunics, poet blouses, celestial skirts/trousers, pointed hats, crystal pendants, buckled boots, starry braids; cauldron, crystal ball, spellbook, owl, broomstick, potion shelf, wand, glow mushrooms. | 20 | 16 |
| **Royal Garden Stories** | Page tunics, royal coats, ceremonial dresses, garden-party clothing, crowns; arch, throne, pennants, tea cart, topiary, fountain, invitation stand. | 14 | 12 |
| **Miniature Woodland** | Leaf tunics, petal dresses, acorn hats, woodland shoes, fairy-inspired accessories; leaf umbrellas, acorn stools, mushroom houses, button tables, garden insects, tiny bridges. | 14 | 12 |
| **Chapter totals** | Plus four backgrounds | **48** | **40** |

**Four settings:** crystal observatory, royal garden, mushroom village, and enchanted-forest panorama linking visual motifs from all three chapters.

**Life-stage coverage:** child apprentices, teen adventurers, adult/elder scholars and royals, with a small baby storybook-costume allocation. Avoid making all elaborate clothing teen-exclusive.

**Six starter scenes:** first magic lesson, find the lost spellbook, prepare the royal garden party, invite the woodland neighbors, cross the miniature village, and watch the observatory sky. Each includes two optional story prompts.

**Signature scene:** An apprentice follows a royal invitation into a mushroom village, then brings its tiny residents to a garden celebration.

**Core reuse:** Forest, Library, Moonlit Meadow, existing ballgown and tiara. Ordinary core dolls and garments must remain usable in these settings.

**Scope boundary:** “glowing,” “flying,” and “steaming” initially describe static artwork. Hats, ears, and wings must respect supported slots; simultaneous combinations need approved layering. A spell-casting clip, particles, moving creatures, and a Stargazer Tower map landmark are optional later features with separate save/export and accessibility checks.

### 3.7 Shared Package Contents and Organization

Every full DLC targets:

- **Four settings**, with at most one panorama until performance evidence supports more.
- **Six editable starter scenes**, using only core + that DLC, and **12 bilingual story prompts**. Prompts are optional ideas, not quests requiring a progression system.
- **Eight outfit recipes** with explicit fit families. Choose combinations that work with the shipped accessory slots.
- **One coherent art brief:** paper treatment, outline weight, palette, scale, and ground anchors. Backgrounds leave useful space for movable furnishings.
- **One package page:** preview, total asset count, count compatible with the selected doll, included chapters, and visible credit for core assets shown in previews.
- **Chapter browsing within the package:** editorial groupings, not separately installed products or new prop collection IDs. Existing fit/style/collection filters still compose with the pack filter.

Each new asset has one owning DLC. Cross-package reuse references that asset only in optional combination examples; base starter scenes cannot depend on it. Similar props should either be meaningfully different or reuse core content. Do not count the same lantern, gift, or telescope twice under different chapters.

Spring Picnic belongs to Nature & Animal Adventures. Autumn Reading, Winter Window, New Year Wishes, and Bayram Visit belong to Family & Home Stories. They remain available year-round as included chapters/decorations. Put greetings in existing speech bubbles or supported plain-text controls; otherwise keep artwork text-free.

### 3.8 Core Inclusion Improvements

Broader hair textures, varied everyday silhouettes, head coverings, glasses, hearing aids, canes, and expressive face details remain ongoing core improvements available to everyone. DLC outfits can complement these options, but should not make basic representation exclusive to an expansion.

Wheelchairs require tested seated poses, doll/chair alignment, movement, and export before being presented as usable equipment. Additional accessory combinations, body models, and new seated poses are engine work. These core improvements are outside the five DLC asset budgets.

---

## 4. Technical Architecture: Current State and Proposed Changes

Paper Doll Studio uses zero runtime dependencies, store-owned state, validated assets, and offline PWA caching. The baseline pack infrastructure now provides trusted core manifests, pack-aware asset resolution and discovery, saved pack references, and bundled-resource validation. Family & Home now includes its full asset batch, pack browsing controls, outfit recipes and localized template registration. Optional downloads remain future work.

### 4.1 What Exists Today

| Concern | Current implementation | Required pack work |
| :--- | :--- | :--- |
| Provenance | Core descriptors resolve through the `core` manifest; `metadata.dlc` remains the source marker. | Keep thematic `concept` and prop collections separate from origin. |
| Resolution | `createAssetRegistry` merges trusted pack SVG descriptors with custom PNG descriptors and preserves missing-pack geometry. | Register full expansion manifests and audit future direct catalog consumers. |
| Discovery | Pack filters compose with fit, style, and prop collection filters in the catalog and unified registry. | Add pack picker UI and arbitrary manifest collection support only when needed. |
| Persistence | Envelopes track required pack IDs/versions and hidden-pack preferences; sanitization and merge retain them. | Add installation/cache state only when optional delivery exists. |
| Offline shell | `validate:packs` checks manifest resources; the service-worker updater discovers SVGs under `assets/`. | Add release-specific resource budgets and optional-download recovery later. |
| Scenes and map | Existing template catalog, landmarks, stamps, and motion clips | Each needs explicit registration and missing-reference behavior if packs extend it. |

### 4.2 Implementation for Larger Packages

Build each expansion from project-authored SVGs using the existing descriptor contract and its single stable `metadata.dlc` value. Internal chapter batches use that same identity from the start. The registry already supports pack-aware resolution and discovery for the first full expansion; chapter browsing remains optional UI organization.

The initial implementation can bundle the first expansion without an install manager, remote downloads, custom locale loader, or import format. Do not automatically precache the entire proposed 458-asset lineup: measure the first expansion, then decide whether subsequent releases need optional downloads. A chapter directory is an authoring convenience, not a runtime dependency or separate entitlement.

For later modular authoring, keep trusted module metadata in `js/packs/<pack-id>/manifest.js` and artwork in `assets/packs/<pack-id>/`. This keeps artwork within the existing asset directory. Do not move existing core IDs or paths merely to reorganize them.

Proposed manifest fields:

| Field | Contract |
| :--- | :--- |
| `id`, `version`, `schemaVersion`, `minAppVersion` | Stable namespaced identity; content version, manifest format, and app compatibility are distinct. |
| `nameKey`, `descriptionKey`, `coverPath` | Turkish/English key parity, same-origin cover, readable text name independent of emoji. |
| `assets` | Complete existing descriptors with globally unique IDs, pack provenance, fit families, pose support, dimensions, and safe paths. |
| `locales` | Optional namespaced dictionaries; reject collisions with core or another pack. Bundled locale entries are sufficient initially. |
| `dependencies` | Empty for initial releases. Later dependencies require compatible versions, cycle checks, and an offline-complete install. |
| `chapters` | Optional ordered metadata and asset-ID membership within this pack; validate membership, with no separate install state. |
| `templates` | Six validated starter-scene references for a full expansion; implement registration before that release. |
| `files`, `totalBytes` | Build-generated resource inventory and byte total; verify actual contents rather than trusting imported declarations. |

The catalog's wearable/prop/background helpers are currently internal. A future manifest must use validated descriptors or deliberately extracted authoring helpers; the original abbreviated example was not runnable integration code.

### 4.3 Separate Availability, Visibility, and References

- **Bundled/installed** describes local availability; **shown in library** describes discovery. Hiding a pack removes it from pickers and randomization while existing scenes continue resolving installed artwork.
- **Unavailable** means required artwork cannot be loaded. Use a localized, kind-aware placeholder and preserve the original ID, dimensions/anchors when known, transforms, colors, order, and fit metadata.
- **Remove downloaded files** is a later, separate action. Show affected saved dolls/scenes and preserve references so reinstallation restores them. Core stays available.
- Keep local installation/cache state outside portable creative content. Projects should record required pack IDs/versions and enough reference metadata to diagnose missing content; imports cannot assume another device has the same packs.
- Apply creative scene changes through existing undo/autosave rules. Specify whether library preferences are undoable separately; failed installation must never leave partial project state.

Do not replace every unknown ID with a generic wearable: props, backgrounds, dolls, and wearables need different geometry. Missing backgrounds must retain saved stage width/camera semantics. Validate round trips through sanitization, project merge, reload, and export; renderer tolerance alone does not prevent data loss.

### 4.4 Offline Delivery and Updates

**Initial scope:** the first full expansion bundled in the app shell if it passes the measured device budget, with explicit asset entries and cache validation. Hiding a pack saves picker space, not download bytes.

**Later optional downloads:** stage every resource, check completeness, then mark the pack available. On interruption or quota failure retain the previous usable version. Keep prior content available until an upgrade is verified, and show a recoverable state if local resources disappear. Never promise indefinite offline retention: local browser data can be cleared or evicted.

Measure compressed transfer size, stored bytes, SVG complexity, and startup/render costs on the target iPad before setting budgets. Record those budgets in the pilot brief and gate later packs against them. A large panorama is a deliberate cost, not a default pack requirement.

### 4.5 Community `.dollpack` Sharing — Deferred

Build on existing custom PNG storage and project portability instead of introducing a second binary-storage system. Prototype one local export/import round trip after official packs prove stable.

- Data-only JSON with a versioned schema, names, supported custom asset metadata, and Base64 PNG payloads. JSON cannot directly embed JavaScript `Blob` objects.
- No imported JavaScript manifests, executable hooks, arbitrary SVG, remote URLs, or unvalidated locale overrides.
- Validate file size, item count, decoded dimensions/bytes, IDs, hashes, and schema before mutation; reuse existing quotas and staged repository transactions.
- Rewrite colliding imported IDs and references consistently. Reject attempts to override core/official identities. Repeat import has an explicit skip/duplicate/update policy.
- Preview the contents, commit atomically, and recover from quota errors without losing current art. Include creator/source metadata and preserve it on export.
- Local file sharing only. A hosted gallery, moderation, accounts, payments, and entitlement checks are separate product proposals.

---

## 5. Expansion Release Order and Delivery Gates

Recommended order: **Family & Home Stories → Neighborhood Life → Nature & Animal Adventures → School, City & Creative Life → Enchanted Worlds**. Family closes the widest fit gaps; Neighborhood builds on everyday storytelling; Nature introduces the larger animal/prop set; School emphasizes costume variety; Enchanted Worlds gets the most demanding fantasy layering.

Dates and app versions remain unassigned. Reconcile these recommendations with [ROADMAP.md](ROADMAP.md) before implementation. The five DLCs are independent releases; the arrow expresses production priority, not dependencies.

| Gate | Deliverable | Evidence required to proceed |
| :--- | :--- | :--- |
| **0 — Product scope lock** | **Complete:** approve Family & Home Stories as the first expansion, including its identity, 92-asset budget, chapters, four settings, life-stage coverage, core reuse, and scope boundaries. | Scope is fixed in this document and [ROADMAP.md](ROADMAP.md). Exact IDs are deliberately a separate production artifact. |
| **1 — Asset-ID ledger and representative scene** | Create the exact 92-ID ledger and produce one family living-room scene with child/adult/elder clothing, representative props, and one background. | Every asset has an owner, kind, fit target, and chapter; fit, articulation, tint, thumbnails, export, authoring cost, and target-device measurements pass. This is a development batch, not a separate capsule release. |
| **2 — Complete package systems** | Pack filtering, metadata, scene-template registration, reference handling, and cache coverage. | Filter composition, migration fixtures, hidden/missing resources, saved-scene recovery, and localization checks. |
| **3 — Complete all chapters** | Finish the full 48 wearables + 40 props + 4 backgrounds, six starter scenes, 12 prompts, and eight outfit recipes. | Contact-sheet review, declared fit coverage, no missing promised chapters, and independent core + DLC scene creation. |
| **4 — Release the full expansion** | Deliver Family & Home Stories as one complete package. | `npm run check`, save/import/export parity, measured storage/render budgets, and hosted iPad offline restart. If budgets fail, optimize or implement tested optional delivery before release. |
| **5 — Produce the next expansion** | Repeat the same gates for Neighborhood, Nature, School, then Enchanted Worlds. | Use observed play sessions and measured production effort to refine scope before locking each full package. No analytics service required. |

Optional downloads, animated pets, cooking interactions, new accessory slots, map extensions, and `.dollpack` sharing each need their own feature brief. Static-art DLC releases can proceed with their declared scope while those features remain deferred. If a feature is essential to a promised scene, implement it before locking that scene into the release.

---

## 6. Acceptance Criteria & Quality Gates

Apply the relevant gates to each release; future installation/import checks apply when those capabilities ship.

1. **Honest inventory:** count unique catalog IDs by kind and fit family; list core items shown in promotional scenes separately. Distinguish concepts, fit variants, recipes, and recolors.
2. **Fit and motion:** every declared family passes visual inspection in neutral and supported poses, including head/limb motion, flips, overlaps, and existing slot combinations. Do not declare universal fit without evidence.
3. **Render parity:** test Designer, thumbnails, Play, scene PNG, and animation-frame export where applicable. Static fallback for effects is explicit; no invisible essential scene content.
4. **Asset safety and style:** same-origin validated SVG for official assets, no runtime dependencies, correct dimensions/anchors, reliable declared tint channels, and readable silhouettes at actual display size.
5. **Bilingual completeness:** names, descriptions, prompts, filters, status messages, and missing-pack labels work in Turkish and English; key parity and collision validation pass.
6. **Save integrity:** old core projects still load. Missing/hide/remove/re-enable scenarios preserve asset references and scene geometry through save, reopen, merge, Undo/Redo, and export where relevant.
7. **Discovery accessibility:** fit + style + pack + collection filters compose correctly; useful empty states; keyboard/touch access and focus restoration for any new controls.
8. **Offline coverage:** verify newly added artwork is actually in the cache inventory before `npm run update:sw`. Run `npm run check` and a real offline restart on the target device; manifest hashing alone cannot prove offline availability.
9. **Update and storage recovery:** interrupted downloads, stale versions, quota failures, missing files, duplicate IDs, incompatible manifests, and removed template references fail without damaging saved work.
10. **Scope and performance:** record actual bytes and target-device rendering against the representative scene's agreed budgets. Every expansion's base scenes work with core + that DLC alone.
11. **Package completeness:** validate chapter totals against the locked asset ledger, four settings, six starter scenes, 12 bilingual prompts, eight compatible outfit recipes, and life-stage coverage before releasing the whole expansion.

For documentation-only revisions, run `npm run validate:docs`; implementation and artwork releases require the broader checks above.
