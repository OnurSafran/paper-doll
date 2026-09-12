# Family & Home Stories implementation

Bundled development build: `pack_family_home`, content version `1.0.0`, app compatibility `1.20.0`. Implemented 2026-09-12. Independent visual/device release verification remains pending; this is not a hosted release announcement.

## Contents and access

- 48 wearables: baby 10, child 10, teen 6, adult 10, elder 12. Each descriptor declares one fit family.
- 40 props, four backgrounds (three 1600×900 interiors and one 3200×900 house-and-garden panorama).
- Five chapters, six starter scenes, 12 bilingual prompts and eight outfit recipes.
- Designer: use **Content pack** to browse the collection and **Family outfits** to load a complete character. Outfit loading participates in Undo/Redo and autosave.
- Play: the pack picker filters props/backgrounds and the template library. A currently selected background remains listed when it is outside the filter. Open **Templates** to choose the six stories; both optional prompts appear in each description.
- Core cake, balloons and tea set are reused by starter scenes without being counted as DLC assets. Core dolls and face features remain the foundation.

Manifest: [manifest.js](../js/packs/family-home/manifest.js). Art review: [family-home.html](../review/family-home.html), served from the repository root. Independent testing prompt: [FAMILY-HOME-QA-PROMPT.md](FAMILY-HOME-QA-PROMPT.md).

## Infrastructure corrections

Raw manifests are validated before normalization, preventing invalid assets, chapters, resource lists, dependencies and provenance from being silently repaired. View boxes require positive dimensions. Unavailable asset lookup honors `includeUnavailable: false`. Pack-specific prop discovery excludes custom artwork. Pack locale dictionaries are loaded by the i18n engine, including core pack labels. Templates register from bundled manifests, preserve authored character snapshots, and validate recipe compatibility, duplicate IDs and missing references. Designer discovery now uses current visibility preferences, and shuffle excludes hidden packs.

## Evidence and release limits

The resource inventory has 93 SVG files including the cover: **86,310 bytes** on disk, **35,477 bytes** when each file is independently gzip-compressed. These are generated resource measurements, not network transfer or Cache Storage overhead measurements. Manifest/module JavaScript is additional app-shell content.

Automated coverage includes exact counts and chapter/fit allocations, recipe compatibility, outfit Undo/Redo, scene sanitization/save round trips, missing-pack panorama preservation, pack-reference tracking, malformed manifests, template references and custom-art filter isolation. The main Designer outfit/filter flow, eight-outfit contact sheet, six scene thumbnails and prop sheets received desktop browser inspection; footwear and fringe geometry were corrected from that inspection.

Still required before public release: independent review of all individual fit/pose combinations, actual PNG/animation export parity, physical iPad performance and a hosted offline restart. See the testing prompt above. No optional download manager, account, purchase flow, new map landmarks or simulation has been added. The crib, high chair and pram are static placeable illustrations; automatic seating/attachment is not implemented.

## Exact asset ledger

Every row is a separately authored SVG descriptor. Artwork lives under `assets/packs/pack_family_home/`; existing core files have not moved.

| ID | Name | Kind / fit | Chapter |
| --- | --- | --- | --- |
| `fh_linen_shirt_adult` | Linen pocket shirt | wearable / adult | everyday |
| `fh_house_tunic_adult` | House tunic | wearable / adult | everyday |
| `fh_drawstring_adult` | Drawstring trousers | wearable / adult | everyday |
| `fh_canvas_adult` | Canvas house shoes | wearable / adult | everyday |
| `fh_button_day_adult` | Button-front day dress | wearable / adult | everyday |
| `fh_crop_adult` | Textured crop | wearable / adult | everyday |
| `fh_patch_tee_child` | Pocket patch tee | wearable / child | everyday |
| `fh_cuffed_child` | Cuffed play trousers | wearable / child | everyday |
| `fh_strap_child` | Strap canvas shoes | wearable / child | everyday |
| `fh_short_curls_child` | Short cloud curls | wearable / child | everyday |
| `fh_henley_teen` | Weekend henley | wearable / teen | everyday |
| `fh_chinos_teen` | Weekend chinos | wearable / teen | everyday |
| `fh_sleep_suit_baby` | Moon sleepsuit | wearable / baby | little |
| `fh_dungarees_baby` | Tiny dungarees | wearable / baby | little |
| `fh_wrap_romper_baby` | Wrap romper | wearable / baby | little |
| `fh_snap_jacket_baby` | Snap jacket | wearable / baby | little |
| `fh_sailboat_baby` | Sailboat shirt | wearable / baby | little |
| `fh_ruffle_bloomers_baby` | Ruffle bloomers | wearable / baby | little |
| `fh_knee_patch_baby` | Knee-patch leggings | wearable / baby | little |
| `fh_bunny_baby` | Bunny booties | wearable / baby | little |
| `fh_bear_baby` | Bear booties | wearable / baby | little |
| `fh_duck_bib_baby` | Duck bib | wearable / baby | little |
| `fh_toddler_overalls_child` | Playtime overalls | wearable / child | little |
| `fh_helper_child` | Little helper smock | wearable / child | little |
| `fh_knit_vest_elder` | Cable knit vest | wearable / elder | weekends |
| `fh_hobby_shirt_elder` | Hobby overshirt | wearable / elder | weekends |
| `fh_shawl_collar_elder` | Shawl collar jacket | wearable / elder | weekends |
| `fh_corduroy_elder` | Corduroy trousers | wearable / elder | weekends |
| `fh_wide_linen_elder` | Wide linen trousers | wearable / elder | weekends |
| `fh_hobby_apron_elder` | Workshop apron dress | wearable / elder | weekends |
| `fh_tea_dress_elder` | Sunday tea dress | wearable / elder | weekends |
| `fh_moccasin_elder` | Soft moccasins | wearable / elder | weekends |
| `fh_felt_elder` | Felt slippers | wearable / elder | weekends |
| `fh_silver_crop_elder` | Silver textured crop | wearable / elder | weekends |
| `fh_star_pajama_child` | Star pajama top | wearable / child | sleepover |
| `fh_star_pants_child` | Star pajama trousers | wearable / child | sleepover |
| `fh_robe_child` | Quilted dressing gown | wearable / child | sleepover |
| `fh_cloud_child` | Cloud slippers | wearable / child | sleepover |
| `fh_pajama_adult` | Piped pajama shirt | wearable / adult | sleepover |
| `fh_pajama_pants_adult` | Piped pajama trousers | wearable / adult | sleepover |
| `fh_nightshirt_teen` | Moon nightshirt | wearable / teen | sleepover |
| `fh_sleep_slippers_teen` | Sleepover slippers | wearable / teen | sleepover |
| `fh_visit_jacket_elder` | Visiting jacket | wearable / elder | celebrations |
| `fh_festive_trousers_elder` | Festive trousers | wearable / elder | celebrations |
| `fh_gathering_adult` | Gathering dress | wearable / adult | celebrations |
| `fh_festive_shirt_adult` | Embroidered visiting shirt | wearable / adult | celebrations |
| `fh_bow_party_teen` | Bow party dress | wearable / teen | celebrations |
| `fh_party_teen` | Party buckle shoes | wearable / teen | celebrations |
| `fh_laundry` | Laundry basket | prop | everyday |
| `fh_cushions` | Patchwork cushions | prop | everyday |
| `fh_family_frame` | Family portrait frame | prop | everyday |
| `fh_sofa` | Two-seat sofa | prop | everyday |
| `fh_storage` | Toy storage cubbies | prop | everyday |
| `fh_crib` | Open-front crib backdrop | prop | little |
| `fh_high_chair` | High chair | prop | little |
| `fh_stroller` | Pram | prop | little |
| `fh_rocking_horse` | Rocking horse | prop | little |
| `fh_blocks` | Wooden building blocks | prop | little |
| `fh_play_mat` | Leaf play mat | prop | little |
| `fh_teddy` | Patchwork teddy | prop | little |
| `fh_bottle` | Milk bottle | prop | little |
| `fh_mobile` | Moon and stars mobile | prop | little |
| `fh_knitting` | Knitting basket | prop | weekends |
| `fh_dominoes` | Domino tiles | prop | weekends |
| `fh_album` | Family photo album | prop | weekends |
| `fh_reading_lamp` | Reading lamp | prop | weekends |
| `fh_books` | Book stack | prop | weekends |
| `fh_chess` | Chess board | prop | weekends |
| `fh_sewing` | Sewing box | prop | weekends |
| `fh_sleeping_bag` | Star sleeping bag | prop | sleepover |
| `fh_popcorn` | Popcorn tub | prop | sleepover |
| `fh_board_game` | Family board game | prop | sleepover |
| `fh_blanket_fort` | Blanket fort | prop | sleepover |
| `fh_cocoa` | Cocoa mugs | prop | sleepover |
| `fh_pillow` | Moon pillow | prop | sleepover |
| `fh_lantern` | Paper lantern | prop | sleepover |
| `fh_slumber_banner` | Sleepover pennants | prop | sleepover |
| `fh_gifts` | Wrapped gifts | prop | celebrations |
| `fh_bunting` | Celebration bunting | prop | celebrations |
| `fh_candy` | Candy bowl | prop | celebrations |
| `fh_cologne` | Cologne bottle | prop | celebrations |
| `fh_tray` | Serving tray | prop | celebrations |
| `fh_winter_wreath` | Winter wreath | prop | celebrations |
| `fh_snow_globe` | Snow globe | prop | celebrations |
| `fh_cards` | Greeting cards | prop | celebrations |
| `fh_paper_flowers` | Paper flower bouquet | prop | celebrations |
| `fh_calendar` | Family celebration calendar | prop | celebrations |
| `fh_cookies` | Celebration cookies | prop | celebrations |
| `fh_living_room` | Family living room | background | settings |
| `fh_nursery` | Pastel nursery | background | settings |
| `fh_shared_bedroom` | Shared bedroom | background | settings |
| `fh_house_garden` | House and garden | background | settings |
