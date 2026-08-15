/**
 * Scene Templates Domain Module
 * Single authority for curated storytelling scene templates and template instantiation.
 */

import { DEFAULT_EXPRESSION, defaultMakeId, defaultNow, isValidId, LIMITS } from './vocabulary.js';
import { createStarterDraft } from './outfit-rules.js';

export const SCENE_TEMPLATES = Object.freeze([
  {
    id: 'template_tea_party',
    title: 'Afternoon Tea Party',
    category: 'Celebration',
    description: 'A cozy garden gathering with tea set, chairs, and friendly conversation.',
    backgroundId: 'bg_park',
    entities: [
      {
        refId: 'doll_host',
        kind: 'character',
        sourceId: 'demo_emma',
        x: 640,
        y: 740,
        scale: 1,
        flipped: false,
        expression: 'smile',
        order: 2,
        pinned: false
      },
      {
        refId: 'prop_chair',
        kind: 'prop',
        sourceId: 'prop_chair',
        x: 440,
        y: 750,
        scale: 1.05,
        flipped: false,
        order: 1,
        pinned: true
      },
      {
        refId: 'prop_tea',
        kind: 'prop',
        sourceId: 'prop_tea_set',
        x: 880,
        y: 740,
        scale: 1.0,
        flipped: false,
        order: 3,
        pinned: false
      },
      {
        refId: 'bubble_tea',
        kind: 'bubble',
        sourceId: 'bubble',
        bubbleStyle: 'speech',
        text: 'Tea is served! Would you like a warm cup?',
        width: 270,
        x: 640,
        y: 350,
        scale: 1,
        flipped: false,
        order: 4,
        attachedToRef: 'doll_host',
        attachOffset: { dx: 0, dy: -390 }
      }
    ]
  },
  {
    id: 'template_cozy_bedroom',
    title: 'Cozy Bedroom Evening',
    category: 'Relaxation',
    description: 'A peaceful bedtime scene with soft lighting, rug, and quiet thoughts.',
    backgroundId: 'bg_bedroom',
    entities: [
      {
        refId: 'prop_rug',
        kind: 'prop',
        sourceId: 'prop_rug',
        x: 800,
        y: 840,
        scale: 1.2,
        flipped: false,
        order: 1,
        pinned: true
      },
      {
        refId: 'prop_lamp',
        kind: 'prop',
        sourceId: 'prop_lamp',
        x: 1260,
        y: 760,
        scale: 1.0,
        flipped: false,
        order: 2,
        pinned: true
      },
      {
        refId: 'doll_sleepy',
        kind: 'character',
        sourceId: 'demo_emma',
        x: 750,
        y: 750,
        scale: 1,
        flipped: false,
        expression: 'happy',
        order: 3,
        pinned: false
      },
      {
        refId: 'bubble_thought',
        kind: 'bubble',
        sourceId: 'bubble',
        bubbleStyle: 'thought',
        text: 'A quiet evening with good dreams ahead...',
        width: 270,
        x: 750,
        y: 360,
        scale: 1,
        flipped: false,
        order: 4,
        attachedToRef: 'doll_sleepy',
        attachOffset: { dx: 0, dy: -390 }
      }
    ]
  },
  {
    id: 'template_atelier',
    title: 'Artisan Atelier Studio',
    category: 'Creative',
    description: 'An inspiring creative studio space with indoor plants and story caption.',
    backgroundId: 'bg_atelier',
    entities: [
      {
        refId: 'prop_plant',
        kind: 'prop',
        sourceId: 'prop_plant',
        x: 320,
        y: 760,
        scale: 1.0,
        flipped: false,
        order: 1,
        pinned: true
      },
      {
        refId: 'doll_artist',
        kind: 'character',
        sourceId: 'demo_emma',
        x: 780,
        y: 750,
        scale: 1,
        flipped: false,
        expression: 'talking',
        order: 2,
        pinned: false
      },
      {
        refId: 'prop_table',
        kind: 'prop',
        sourceId: 'prop_table',
        x: 1040,
        y: 740,
        scale: 1.1,
        flipped: false,
        order: 3,
        pinned: false
      },
      {
        refId: 'bubble_caption',
        kind: 'bubble',
        sourceId: 'bubble',
        bubbleStyle: 'caption',
        text: 'Chapter 1: The Design Studio at Morning Light',
        width: 340,
        x: 800,
        y: 150,
        scale: 1,
        flipped: false,
        order: 4,
        pinned: false
      }
    ]
  },
  {
    id: 'template_garden_story',
    title: 'Garden Friendship',
    category: 'Dialogue',
    description: 'Two dolls enjoying sunny blooms with lively conversation bubbles.',
    backgroundId: 'bg_park',
    entities: [
      {
        refId: 'prop_plant',
        kind: 'prop',
        sourceId: 'prop_plant',
        x: 1350,
        y: 760,
        scale: 1.0,
        flipped: false,
        order: 1,
        pinned: true
      },
      {
        refId: 'doll_friend_a',
        kind: 'character',
        sourceId: 'demo_emma',
        x: 560,
        y: 750,
        scale: 1,
        flipped: false,
        expression: 'happy',
        order: 2,
        pinned: false
      },
      {
        refId: 'doll_friend_b',
        kind: 'character',
        sourceId: 'demo_emma',
        x: 1040,
        y: 750,
        scale: 1,
        flipped: true,
        expression: 'smile',
        order: 3,
        pinned: false
      },
      {
        refId: 'bubble_a',
        kind: 'bubble',
        sourceId: 'bubble',
        bubbleStyle: 'speech',
        text: 'The flowers smell so lovely today!',
        width: 240,
        x: 560,
        y: 360,
        scale: 1,
        flipped: false,
        order: 4,
        attachedToRef: 'doll_friend_a',
        attachOffset: { dx: 0, dy: -390 }
      },
      {
        refId: 'bubble_b',
        kind: 'bubble',
        sourceId: 'bubble',
        bubbleStyle: 'speech',
        text: 'Let us make a bouquet together!',
        width: 230,
        x: 1040,
        y: 360,
        scale: 1,
        flipped: false,
        order: 5,
        attachedToRef: 'doll_friend_b',
        attachOffset: { dx: 0, dy: -390 }
      }
    ]
  },
  {
    id: 'template_comic_moment',
    title: 'Comic Drama Shout',
    category: 'Comic',
    description: 'An exciting story scene with surprise expression and dynamic shout balloon.',
    backgroundId: 'bg_bedroom',
    entities: [
      {
        refId: 'prop_lamp',
        kind: 'prop',
        sourceId: 'prop_lamp',
        x: 320,
        y: 760,
        scale: 1.0,
        flipped: false,
        order: 1,
        pinned: true
      },
      {
        refId: 'doll_hero',
        kind: 'character',
        sourceId: 'demo_emma',
        x: 740,
        y: 750,
        scale: 1,
        flipped: false,
        expression: 'surprised',
        order: 2,
        pinned: false
      },
      {
        refId: 'prop_treat',
        kind: 'prop',
        sourceId: 'prop_tea_set',
        x: 1050,
        y: 750,
        scale: 1.0,
        flipped: false,
        order: 3,
        pinned: false
      },
      {
        refId: 'bubble_shout',
        kind: 'bubble',
        sourceId: 'bubble',
        bubbleStyle: 'shout',
        text: 'Watch out! The tea is piping hot!',
        width: 260,
        x: 740,
        y: 350,
        scale: 1,
        flipped: false,
        order: 4,
        attachedToRef: 'doll_hero',
        attachOffset: { dx: 0, dy: -400 }
      }
    ]
  }
]);

/**
 * Instantiates a template into a valid scene object with fresh unique IDs.
 */
export function instantiateSceneTemplate(templateId, makeId = defaultMakeId, defaultCharacterSnapshot = null, now = defaultNow) {
  const template = SCENE_TEMPLATES.find((t) => t.id === templateId) || SCENE_TEMPLATES[0];
  const charSnapshot = (defaultCharacterSnapshot && typeof defaultCharacterSnapshot === 'object' && Object.keys(defaultCharacterSnapshot).length > 0)
    ? defaultCharacterSnapshot
    : createStarterDraft();
  const usedIds = new Set();
  const nextId = () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = makeId();
      if (isValidId(candidate) && !usedIds.has(candidate)) {
        usedIds.add(candidate);
        return candidate;
      }
    }
    return null;
  };

  const sceneId = nextId();
  if (!sceneId) return null;
  const idMap = new Map();

  for (const entityDef of template.entities) {
    const instanceId = nextId();
    if (!instanceId) return null;
    idMap.set(entityDef.refId, instanceId);
  }

  const entities = template.entities.map((def) => {
    const instanceId = idMap.get(def.refId);
    const attachedTo = def.attachedToRef ? idMap.get(def.attachedToRef) ?? null : null;

    const base = {
      instanceId,
      kind: def.kind,
      sourceId: def.sourceId,
      x: def.x,
      y: def.y,
      scale: def.scale ?? 1,
      flipped: Boolean(def.flipped),
      order: def.order,
      pinned: Boolean(def.pinned),
      attachedTo,
      attachOffset: def.attachOffset ? { ...def.attachOffset } : null
    };

    if (def.kind === 'character') {
      return {
        ...base,
        expression: def.expression || DEFAULT_EXPRESSION,
        characterSnapshot: JSON.parse(JSON.stringify(charSnapshot))
      };
    }

    if (def.kind === 'bubble') {
      return {
        ...base,
        bubbleStyle: def.bubbleStyle || 'speech',
        text: def.text || 'Hello!',
        width: def.width || LIMITS.DEFAULT_BUBBLE_WIDTH
      };
    }

    return base;
  });

  return {
    sceneId,
    title: template.title,
    backgroundId: template.backgroundId,
    createdAt: now().toISOString(),
    updatedAt: now().toISOString(),
    entities
  };
}
