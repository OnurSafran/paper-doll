import { createDefaultFace } from '../../domain/outfit-rules.js';

export const FAMILY_OUTFITS = Object.freeze([
  {
    "id": "fh_outfit_welcome_adult",
    "nameKey": "pack_family_home.recipes.welcome_adult",
    "baseDollId": "doll_adult_a",
    "skinTone": "honey",
    "slots": {
      "hair": {
        "assetId": "fh_crop_adult",
        "color": "brown"
      },
      "top": {
        "assetId": "fh_linen_shirt_adult",
        "color": "coral"
      },
      "bottom": {
        "assetId": "fh_drawstring_adult",
        "color": "denim"
      },
      "dress": null,
      "shoes": {
        "assetId": "fh_canvas_adult",
        "color": "cream"
      },
      "accessory": null
    }
  },
  {
    "id": "fh_outfit_play_child",
    "nameKey": "pack_family_home.recipes.play_child",
    "baseDollId": "doll_chibi_a",
    "skinTone": "peach",
    "slots": {
      "hair": {
        "assetId": "fh_short_curls_child",
        "color": "brown"
      },
      "top": {
        "assetId": "fh_patch_tee_child",
        "color": "coral"
      },
      "bottom": {
        "assetId": "fh_cuffed_child",
        "color": "denim"
      },
      "dress": null,
      "shoes": {
        "assetId": "fh_strap_child",
        "color": "cream"
      },
      "accessory": null
    }
  },
  {
    "id": "fh_outfit_little_baby",
    "nameKey": "pack_family_home.recipes.little_baby",
    "baseDollId": "doll_baby_a",
    "skinTone": "peach",
    "slots": {
      "hair": {
        "assetId": "hair_baby_curl",
        "color": "brown"
      },
      "top": null,
      "bottom": null,
      "dress": {
        "assetId": "fh_sleep_suit_baby",
        "color": "sage"
      },
      "shoes": {
        "assetId": "fh_bunny_baby",
        "color": "cream"
      },
      "accessory": {
        "assetId": "fh_duck_bib_baby",
        "color": "sage"
      }
    }
  },
  {
    "id": "fh_outfit_hobby_elder",
    "nameKey": "pack_family_home.recipes.hobby_elder",
    "baseDollId": "doll_elder_a",
    "skinTone": "honey",
    "slots": {
      "hair": {
        "assetId": "fh_silver_crop_elder",
        "color": "white"
      },
      "top": {
        "assetId": "fh_knit_vest_elder",
        "color": "marigold"
      },
      "bottom": {
        "assetId": "fh_corduroy_elder",
        "color": "denim"
      },
      "dress": null,
      "shoes": {
        "assetId": "fh_moccasin_elder",
        "color": "cream"
      },
      "accessory": null
    }
  },
  {
    "id": "fh_outfit_sleep_child",
    "nameKey": "pack_family_home.recipes.sleep_child",
    "baseDollId": "doll_chibi_a",
    "skinTone": "peach",
    "slots": {
      "hair": {
        "assetId": "fh_short_curls_child",
        "color": "brown"
      },
      "top": {
        "assetId": "fh_star_pajama_child",
        "color": "lavender"
      },
      "bottom": {
        "assetId": "fh_star_pants_child",
        "color": "denim"
      },
      "dress": null,
      "shoes": {
        "assetId": "fh_cloud_child",
        "color": "cream"
      },
      "accessory": null
    }
  },
  {
    "id": "fh_outfit_sleep_adult",
    "nameKey": "pack_family_home.recipes.sleep_adult",
    "baseDollId": "doll_adult_a",
    "skinTone": "honey",
    "slots": {
      "hair": {
        "assetId": "fh_crop_adult",
        "color": "brown"
      },
      "top": {
        "assetId": "fh_pajama_adult",
        "color": "lavender"
      },
      "bottom": {
        "assetId": "fh_pajama_pants_adult",
        "color": "denim"
      },
      "dress": null,
      "shoes": {
        "assetId": "fh_canvas_adult",
        "color": "cream"
      },
      "accessory": null
    }
  },
  {
    "id": "fh_outfit_visit_elder",
    "nameKey": "pack_family_home.recipes.visit_elder",
    "baseDollId": "doll_elder_a",
    "skinTone": "peach",
    "slots": {
      "hair": {
        "assetId": "fh_silver_crop_elder",
        "color": "white"
      },
      "top": {
        "assetId": "fh_visit_jacket_elder",
        "color": "sky"
      },
      "bottom": {
        "assetId": "fh_festive_trousers_elder",
        "color": "denim"
      },
      "dress": null,
      "shoes": {
        "assetId": "fh_felt_elder",
        "color": "cream"
      },
      "accessory": null
    }
  },
  {
    "id": "fh_outfit_party_teen",
    "nameKey": "pack_family_home.recipes.party_teen",
    "baseDollId": "doll_classic_a",
    "skinTone": "honey",
    "slots": {
      "hair": {
        "assetId": "hair_short",
        "color": "brown"
      },
      "top": null,
      "bottom": null,
      "dress": {
        "assetId": "fh_bow_party_teen",
        "color": "sky"
      },
      "shoes": {
        "assetId": "fh_party_teen",
        "color": "cream"
      },
      "accessory": null
    }
  }
].map((recipe) => Object.freeze({ ...recipe, face: createDefaultFace(recipe.baseDollId) })));
