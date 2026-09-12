import { FAMILY_OUTFITS } from './recipes.js';

export const FAMILY_TEMPLATES = Object.freeze([
  {
    "id": "template_fh_welcome",
    "packId": "pack_family_home",
    "title": "Welcome home",
    "titleKey": "pack_family_home.stories.welcome.title",
    "category": "Family & Home Stories",
    "categoryKey": "pack_family_home.name",
    "description": "Who has a surprise for the newest family member? Find a cozy spot for a first family photo.",
    "descriptionKey": "pack_family_home.stories.welcome.description",
    "promptKeys": [
      "pack_family_home.stories.welcome.prompt1",
      "pack_family_home.stories.welcome.prompt2"
    ],
    "backgroundId": "fh_living_room",
    "stageWidth": 1600,
    "entities": [
      {
        "refId": "prop_0",
        "kind": "prop",
        "sourceId": "fh_sofa",
        "x": 430,
        "y": 780,
        "scale": 1.0,
        "order": 0,
        "pinned": false
      },
      {
        "refId": "prop_1",
        "kind": "prop",
        "sourceId": "fh_laundry",
        "x": 1220,
        "y": 790,
        "scale": 0.8,
        "order": 1,
        "pinned": false
      },
      {
        "refId": "prop_2",
        "kind": "prop",
        "sourceId": "fh_teddy",
        "x": 920,
        "y": 820,
        "scale": 0.8,
        "order": 2,
        "pinned": false
      },
      {
        "refId": "person_0",
        "kind": "character",
        "sourceId": "demo_emma",
        "recipeId": "fh_outfit_welcome_adult",
        "x": 530,
        "y": 785,
        "scale": 1,
        "order": 10,
        "expression": "happy"
      },
      {
        "refId": "person_1",
        "kind": "character",
        "sourceId": "demo_emma",
        "recipeId": "fh_outfit_play_child",
        "x": 770,
        "y": 785,
        "scale": 1,
        "order": 11,
        "expression": "happy"
      },
      {
        "refId": "person_2",
        "kind": "character",
        "sourceId": "demo_emma",
        "recipeId": "fh_outfit_little_baby",
        "x": 1010,
        "y": 785,
        "scale": 0.8,
        "order": 12,
        "expression": "happy"
      }
    ]
  },
  {
    "id": "template_fh_fort",
    "packId": "pack_family_home",
    "title": "Build a blanket fort",
    "titleKey": "pack_family_home.stories.fort.title",
    "category": "Family & Home Stories",
    "categoryKey": "pack_family_home.name",
    "description": "What is the password to enter the fort? Tell a story about the shadows on the wall.",
    "descriptionKey": "pack_family_home.stories.fort.description",
    "promptKeys": [
      "pack_family_home.stories.fort.prompt1",
      "pack_family_home.stories.fort.prompt2"
    ],
    "backgroundId": "fh_shared_bedroom",
    "stageWidth": 1600,
    "entities": [
      {
        "refId": "prop_0",
        "kind": "prop",
        "sourceId": "fh_blanket_fort",
        "x": 550,
        "y": 800,
        "scale": 1,
        "order": 0,
        "pinned": false
      },
      {
        "refId": "prop_1",
        "kind": "prop",
        "sourceId": "fh_sleeping_bag",
        "x": 1060,
        "y": 840,
        "scale": 0.8,
        "order": 1,
        "pinned": false
      },
      {
        "refId": "prop_2",
        "kind": "prop",
        "sourceId": "fh_popcorn",
        "x": 1210,
        "y": 850,
        "scale": 0.8,
        "order": 2,
        "pinned": false
      },
      {
        "refId": "prop_3",
        "kind": "prop",
        "sourceId": "fh_lantern",
        "x": 290,
        "y": 820,
        "scale": 0.8,
        "order": 3,
        "pinned": false
      },
      {
        "refId": "person_0",
        "kind": "character",
        "sourceId": "demo_emma",
        "recipeId": "fh_outfit_sleep_child",
        "x": 530,
        "y": 785,
        "scale": 1,
        "order": 10,
        "expression": "happy"
      },
      {
        "refId": "person_1",
        "kind": "character",
        "sourceId": "demo_emma",
        "recipeId": "fh_outfit_party_teen",
        "x": 770,
        "y": 785,
        "scale": 1,
        "order": 11,
        "expression": "happy"
      }
    ]
  },
  {
    "id": "template_fh_hobby",
    "packId": "pack_family_home",
    "title": "Grandparent hobby afternoon",
    "titleKey": "pack_family_home.stories.hobby.title",
    "category": "Family & Home Stories",
    "categoryKey": "pack_family_home.name",
    "description": "Teach each other a favorite hobby. Which photo starts a story from long ago?",
    "descriptionKey": "pack_family_home.stories.hobby.description",
    "promptKeys": [
      "pack_family_home.stories.hobby.prompt1",
      "pack_family_home.stories.hobby.prompt2"
    ],
    "backgroundId": "fh_living_room",
    "stageWidth": 1600,
    "entities": [
      {
        "refId": "prop_0",
        "kind": "prop",
        "sourceId": "fh_knitting",
        "x": 340,
        "y": 820,
        "scale": 1,
        "order": 0,
        "pinned": false
      },
      {
        "refId": "prop_1",
        "kind": "prop",
        "sourceId": "fh_dominoes",
        "x": 970,
        "y": 835,
        "scale": 1,
        "order": 1,
        "pinned": false
      },
      {
        "refId": "prop_2",
        "kind": "prop",
        "sourceId": "fh_album",
        "x": 1220,
        "y": 820,
        "scale": 1,
        "order": 2,
        "pinned": false
      },
      {
        "refId": "prop_3",
        "kind": "prop",
        "sourceId": "fh_books",
        "x": 1400,
        "y": 830,
        "scale": 1,
        "order": 3,
        "pinned": false
      },
      {
        "refId": "person_0",
        "kind": "character",
        "sourceId": "demo_emma",
        "recipeId": "fh_outfit_hobby_elder",
        "x": 530,
        "y": 785,
        "scale": 1,
        "order": 10,
        "expression": "happy"
      },
      {
        "refId": "person_1",
        "kind": "character",
        "sourceId": "demo_emma",
        "recipeId": "fh_outfit_play_child",
        "x": 770,
        "y": 785,
        "scale": 1,
        "order": 11,
        "expression": "happy"
      }
    ]
  },
  {
    "id": "template_fh_birthday",
    "packId": "pack_family_home",
    "title": "Surprise birthday",
    "titleKey": "pack_family_home.stories.birthday.title",
    "category": "Family & Home Stories",
    "categoryKey": "pack_family_home.name",
    "description": "Hide a gift before the guest arrives. How can three generations prepare the surprise together?",
    "descriptionKey": "pack_family_home.stories.birthday.description",
    "promptKeys": [
      "pack_family_home.stories.birthday.prompt1",
      "pack_family_home.stories.birthday.prompt2"
    ],
    "backgroundId": "fh_house_garden",
    "stageWidth": 3200,
    "entities": [
      {
        "refId": "prop_0",
        "kind": "prop",
        "sourceId": "fh_gifts",
        "x": 1120,
        "y": 830,
        "scale": 1,
        "order": 0,
        "pinned": false
      },
      {
        "refId": "prop_1",
        "kind": "prop",
        "sourceId": "fh_bunting",
        "x": 850,
        "y": 250,
        "scale": 1,
        "order": 1,
        "pinned": false
      },
      {
        "refId": "prop_2",
        "kind": "prop",
        "sourceId": "prop_cake",
        "x": 1420,
        "y": 810,
        "scale": 0.8,
        "order": 2,
        "pinned": false
      },
      {
        "refId": "prop_3",
        "kind": "prop",
        "sourceId": "prop_balloons",
        "x": 340,
        "y": 600,
        "scale": 1,
        "order": 3,
        "pinned": false
      },
      {
        "refId": "prop_4",
        "kind": "prop",
        "sourceId": "fh_tray",
        "x": 720,
        "y": 830,
        "scale": 1,
        "order": 4,
        "pinned": false
      },
      {
        "refId": "person_0",
        "kind": "character",
        "sourceId": "demo_emma",
        "recipeId": "fh_outfit_welcome_adult",
        "x": 530,
        "y": 785,
        "scale": 1,
        "order": 10,
        "expression": "happy"
      },
      {
        "refId": "person_1",
        "kind": "character",
        "sourceId": "demo_emma",
        "recipeId": "fh_outfit_play_child",
        "x": 770,
        "y": 785,
        "scale": 1,
        "order": 11,
        "expression": "happy"
      },
      {
        "refId": "person_2",
        "kind": "character",
        "sourceId": "demo_emma",
        "recipeId": "fh_outfit_hobby_elder",
        "x": 1010,
        "y": 785,
        "scale": 1,
        "order": 12,
        "expression": "happy"
      },
      {
        "refId": "person_3",
        "kind": "character",
        "sourceId": "demo_emma",
        "recipeId": "fh_outfit_party_teen",
        "x": 1250,
        "y": 785,
        "scale": 1,
        "order": 13,
        "expression": "happy"
      }
    ]
  },
  {
    "id": "template_fh_winter",
    "packId": "pack_family_home",
    "title": "Winter reading evening",
    "titleKey": "pack_family_home.stories.winter.title",
    "category": "Family & Home Stories",
    "categoryKey": "pack_family_home.name",
    "description": "Choose a book for a snowy imaginary journey. What wish will you whisper to the snow globe?",
    "descriptionKey": "pack_family_home.stories.winter.description",
    "promptKeys": [
      "pack_family_home.stories.winter.prompt1",
      "pack_family_home.stories.winter.prompt2"
    ],
    "backgroundId": "fh_shared_bedroom",
    "stageWidth": 1600,
    "entities": [
      {
        "refId": "prop_0",
        "kind": "prop",
        "sourceId": "fh_books",
        "x": 350,
        "y": 830,
        "scale": 1,
        "order": 0,
        "pinned": false
      },
      {
        "refId": "prop_1",
        "kind": "prop",
        "sourceId": "fh_reading_lamp",
        "x": 1320,
        "y": 790,
        "scale": 1,
        "order": 1,
        "pinned": false
      },
      {
        "refId": "prop_2",
        "kind": "prop",
        "sourceId": "fh_snow_globe",
        "x": 1120,
        "y": 820,
        "scale": 1,
        "order": 2,
        "pinned": false
      },
      {
        "refId": "prop_3",
        "kind": "prop",
        "sourceId": "fh_cocoa",
        "x": 960,
        "y": 845,
        "scale": 1,
        "order": 3,
        "pinned": false
      },
      {
        "refId": "prop_4",
        "kind": "prop",
        "sourceId": "fh_winter_wreath",
        "x": 500,
        "y": 240,
        "scale": 1,
        "order": 4,
        "pinned": false
      },
      {
        "refId": "person_0",
        "kind": "character",
        "sourceId": "demo_emma",
        "recipeId": "fh_outfit_sleep_adult",
        "x": 530,
        "y": 785,
        "scale": 1,
        "order": 10,
        "expression": "happy"
      },
      {
        "refId": "person_1",
        "kind": "character",
        "sourceId": "demo_emma",
        "recipeId": "fh_outfit_sleep_child",
        "x": 770,
        "y": 785,
        "scale": 1,
        "order": 11,
        "expression": "happy"
      },
      {
        "refId": "person_2",
        "kind": "character",
        "sourceId": "demo_emma",
        "recipeId": "fh_outfit_little_baby",
        "x": 1010,
        "y": 785,
        "scale": 0.8,
        "order": 12,
        "expression": "happy"
      }
    ]
  },
  {
    "id": "template_fh_bayram",
    "packId": "pack_family_home",
    "title": "Bayram visit",
    "titleKey": "pack_family_home.stories.bayram.title",
    "category": "Family & Home Stories",
    "categoryKey": "pack_family_home.name",
    "description": "Welcome your guests and offer a favorite treat. Make a greeting card for someone you miss.",
    "descriptionKey": "pack_family_home.stories.bayram.description",
    "promptKeys": [
      "pack_family_home.stories.bayram.prompt1",
      "pack_family_home.stories.bayram.prompt2"
    ],
    "backgroundId": "fh_living_room",
    "stageWidth": 1600,
    "entities": [
      {
        "refId": "prop_0",
        "kind": "prop",
        "sourceId": "fh_candy",
        "x": 1050,
        "y": 820,
        "scale": 1,
        "order": 0,
        "pinned": false
      },
      {
        "refId": "prop_1",
        "kind": "prop",
        "sourceId": "fh_cologne",
        "x": 1270,
        "y": 820,
        "scale": 1,
        "order": 1,
        "pinned": false
      },
      {
        "refId": "prop_2",
        "kind": "prop",
        "sourceId": "fh_cards",
        "x": 350,
        "y": 825,
        "scale": 1,
        "order": 2,
        "pinned": false
      },
      {
        "refId": "prop_3",
        "kind": "prop",
        "sourceId": "fh_cookies",
        "x": 820,
        "y": 840,
        "scale": 1,
        "order": 3,
        "pinned": false
      },
      {
        "refId": "prop_4",
        "kind": "prop",
        "sourceId": "prop_tea_set",
        "x": 550,
        "y": 835,
        "scale": 1,
        "order": 4,
        "pinned": false
      },
      {
        "refId": "person_0",
        "kind": "character",
        "sourceId": "demo_emma",
        "recipeId": "fh_outfit_visit_elder",
        "x": 530,
        "y": 785,
        "scale": 1,
        "order": 10,
        "expression": "happy"
      },
      {
        "refId": "person_1",
        "kind": "character",
        "sourceId": "demo_emma",
        "recipeId": "fh_outfit_welcome_adult",
        "x": 770,
        "y": 785,
        "scale": 1,
        "order": 11,
        "expression": "happy"
      },
      {
        "refId": "person_2",
        "kind": "character",
        "sourceId": "demo_emma",
        "recipeId": "fh_outfit_play_child",
        "x": 1010,
        "y": 785,
        "scale": 1,
        "order": 12,
        "expression": "happy"
      }
    ]
  }
].map((template) => Object.freeze({ ...template, entities: template.entities.map((entity) => ({ ...entity, ...(entity.recipeId ? { characterSnapshot: FAMILY_OUTFITS.find((recipe) => recipe.id === entity.recipeId) } : {}) })) })));
