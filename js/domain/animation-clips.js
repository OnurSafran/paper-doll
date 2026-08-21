/**
 * Motion Clips and Static Poses Catalog
 * Immutable catalog of motion clips, channel keyframes, and static poses.
 */

import { DEFAULT_MOTION_CLIP_ID, DEFAULT_STATIC_POSE } from './vocabulary.js';

export const STATIC_POSE_TRANSFORMS = Object.freeze({
  rest: Object.freeze({
    root: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    head: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    armLeft: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    armRight: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    legLeft: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    legRight: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1
  }),
  lean_left: Object.freeze({
    root: Object.freeze({ x: -6, y: 0, rotate: -4, scaleX: 1, scaleY: 1 }),
    head: Object.freeze({ x: -2, y: 0, rotate: -2, scaleX: 1, scaleY: 1 }),
    armLeft: Object.freeze({ x: -2, y: 0, rotate: -3, scaleX: 1, scaleY: 1 }),
    armRight: Object.freeze({ x: 2, y: 0, rotate: 3, scaleX: 1, scaleY: 1 }),
    legLeft: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    legRight: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    x: -6, y: 0, rotate: -4, scaleX: 1, scaleY: 1
  }),
  lean_right: Object.freeze({
    root: Object.freeze({ x: 6, y: 0, rotate: 4, scaleX: 1, scaleY: 1 }),
    head: Object.freeze({ x: 2, y: 0, rotate: 2, scaleX: 1, scaleY: 1 }),
    armLeft: Object.freeze({ x: -2, y: 0, rotate: -3, scaleX: 1, scaleY: 1 }),
    armRight: Object.freeze({ x: 2, y: 0, rotate: 3, scaleX: 1, scaleY: 1 }),
    legLeft: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    legRight: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    x: 6, y: 0, rotate: 4, scaleX: 1, scaleY: 1
  }),
  look_left: Object.freeze({
    root: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    head: Object.freeze({ x: -5, y: 0, rotate: -3, scaleX: 0.96, scaleY: 1 }),
    armLeft: Object.freeze({ x: 0, y: 0, rotate: 1, scaleX: 1, scaleY: 1 }),
    armRight: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    legLeft: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    legRight: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1
  }),
  look_right: Object.freeze({
    root: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    head: Object.freeze({ x: 5, y: 0, rotate: 3, scaleX: 0.96, scaleY: 1 }),
    armLeft: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    armRight: Object.freeze({ x: 0, y: 0, rotate: -1, scaleX: 1, scaleY: 1 }),
    legLeft: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    legRight: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1
  }),
  tilt_left: Object.freeze({
    root: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    head: Object.freeze({ x: -3, y: 0, rotate: -10, scaleX: 1, scaleY: 1 }),
    armLeft: Object.freeze({ x: 0, y: 0, rotate: 2, scaleX: 1, scaleY: 1 }),
    armRight: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    legLeft: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    legRight: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1
  }),
  tilt_right: Object.freeze({
    root: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    head: Object.freeze({ x: 3, y: 0, rotate: 10, scaleX: 1, scaleY: 1 }),
    armLeft: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    armRight: Object.freeze({ x: 0, y: 0, rotate: -2, scaleX: 1, scaleY: 1 }),
    legLeft: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    legRight: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1
  }),
  wave: Object.freeze({
    root: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    head: Object.freeze({ x: 2, y: -1, rotate: 5, scaleX: 1, scaleY: 1 }),
    armLeft: Object.freeze({ x: 0, y: 0, rotate: 4, scaleX: 1, scaleY: 1 }),
    armRight: Object.freeze({ x: 2, y: -4, rotate: -120, scaleX: 1, scaleY: 1 }),
    legLeft: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    legRight: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1
  }),
  point: Object.freeze({
    root: Object.freeze({ x: 1, y: 0, rotate: 1, scaleX: 1, scaleY: 1 }),
    head: Object.freeze({ x: 3, y: 0, rotate: 3, scaleX: 0.98, scaleY: 1 }),
    armLeft: Object.freeze({ x: -1, y: 0, rotate: 3, scaleX: 1, scaleY: 1 }),
    armRight: Object.freeze({ x: 3, y: -2, rotate: -55, scaleX: 1, scaleY: 1 }),
    legLeft: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    legRight: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    x: 1, y: 0, rotate: 1, scaleX: 1, scaleY: 1
  }),
  hands_on_hips: Object.freeze({
    root: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    head: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    armLeft: Object.freeze({ x: -3, y: -1, rotate: 28, scaleX: 1, scaleY: 1 }),
    armRight: Object.freeze({ x: 3, y: -1, rotate: -28, scaleX: 1, scaleY: 1 }),
    legLeft: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    legRight: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1
  }),
  arms_up: Object.freeze({
    root: Object.freeze({ x: 0, y: -2, rotate: 0, scaleX: 1, scaleY: 1.01 }),
    head: Object.freeze({ x: 0, y: -2, rotate: 0, scaleX: 1.02, scaleY: 1.02 }),
    armLeft: Object.freeze({ x: -2, y: -4, rotate: 135, scaleX: 1, scaleY: 1 }),
    armRight: Object.freeze({ x: 2, y: -4, rotate: -135, scaleX: 1, scaleY: 1 }),
    legLeft: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    legRight: Object.freeze({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
    x: 0, y: -2, rotate: 0, scaleX: 1, scaleY: 1.01
  })
});

export function getStaticPoseTransform(pose) {
  return STATIC_POSE_TRANSFORMS[pose] || STATIC_POSE_TRANSFORMS[DEFAULT_STATIC_POSE];
}

export const MOTION_CLIPS = Object.freeze({
  none: Object.freeze({
    clipId: 'none',
    durationMs: 1000,
    loop: true,
    channels: Object.freeze({
      root: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      head: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      armLeft: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      armRight: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      legLeft: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      legRight: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ])
    })
  }),

  idle: Object.freeze({
    clipId: 'idle',
    durationMs: 1800,
    loop: true,
    channels: Object.freeze({
      root: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: 0, y: -2, rotate: 0, scaleX: 1.005, scaleY: 1.01 }),
        Object.freeze({ at: 0.5, x: 0, y: -4, rotate: 0, scaleX: 1.01, scaleY: 1.02 }),
        Object.freeze({ at: 0.75, x: 0, y: -2, rotate: 0, scaleX: 1.005, scaleY: 1.01 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      head: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: 0, y: -1, rotate: 0.8, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.5, x: 0, y: -2, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.75, x: 0, y: -1, rotate: -0.8, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      armLeft: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.35, x: 0, y: 0, rotate: 1.2, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.75, x: 0, y: 0, rotate: -0.8, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      armRight: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.35, x: 0, y: 0, rotate: -1.2, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.75, x: 0, y: 0, rotate: 0.8, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      expression: Object.freeze([
        Object.freeze({ at: 0, intensityMultiplier: 1.0 }),
        Object.freeze({ at: 0.5, intensityMultiplier: 1.05 }),
        Object.freeze({ at: 1, intensityMultiplier: 1.0 })
      ])
    })
  }),

  happy_bounce: Object.freeze({
    clipId: 'happy_bounce',
    durationMs: 1200,
    loop: true,
    channels: Object.freeze({
      root: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.15, x: 0, y: 3, rotate: 0, scaleX: 1.03, scaleY: 0.97 }),
        Object.freeze({ at: 0.45, x: 0, y: -16, rotate: 0, scaleX: 0.97, scaleY: 1.04 }),
        Object.freeze({ at: 0.75, x: 0, y: 2, rotate: 0, scaleX: 1.02, scaleY: 0.98 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      head: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.15, x: 0, y: 1, rotate: 1, scaleX: 1.02, scaleY: 0.98 }),
        Object.freeze({ at: 0.45, x: 0, y: -6, rotate: -1, scaleX: 0.98, scaleY: 1.02 }),
        Object.freeze({ at: 0.75, x: 0, y: 1, rotate: 1, scaleX: 1.01, scaleY: 0.99 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      expression: Object.freeze([
        Object.freeze({ at: 0, intensityMultiplier: 1.0 }),
        Object.freeze({ at: 0.45, intensityMultiplier: 1.25 }),
        Object.freeze({ at: 1, intensityMultiplier: 1.0 })
      ])
    })
  }),

  hello: Object.freeze({
    clipId: 'hello',
    durationMs: 1600,
    loop: true,
    channels: Object.freeze({
      root: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: -3, y: -2, rotate: -2.5, scaleX: 1.005, scaleY: 1.01 }),
        Object.freeze({ at: 0.5, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.75, x: 3, y: -2, rotate: 2.5, scaleX: 1.005, scaleY: 1.01 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      head: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: -2, y: -1, rotate: -4, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.5, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.75, x: 2, y: -1, rotate: 4, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      expression: Object.freeze([
        Object.freeze({ at: 0, intensityMultiplier: 1.0 }),
        Object.freeze({ at: 0.25, intensityMultiplier: 1.15 }),
        Object.freeze({ at: 0.5, intensityMultiplier: 1.05 }),
        Object.freeze({ at: 0.75, intensityMultiplier: 1.15 }),
        Object.freeze({ at: 1, intensityMultiplier: 1.0 })
      ])
    })
  }),

  celebrate: Object.freeze({
    clipId: 'celebrate',
    durationMs: 1400,
    loop: true,
    channels: Object.freeze({
      root: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: -4, y: -8, rotate: -2, scaleX: 0.99, scaleY: 1.015 }),
        Object.freeze({ at: 0.5, x: 0, y: 2, rotate: 0, scaleX: 1.015, scaleY: 0.985 }),
        Object.freeze({ at: 0.75, x: 4, y: -8, rotate: 2, scaleX: 0.99, scaleY: 1.015 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      head: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: -1, y: -2, rotate: -3, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.5, x: 0, y: 1, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.75, x: 1, y: -2, rotate: 3, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      expression: Object.freeze([
        Object.freeze({ at: 0, intensityMultiplier: 1.0 }),
        Object.freeze({ at: 0.25, intensityMultiplier: 1.15 }),
        Object.freeze({ at: 0.5, intensityMultiplier: 1.05 }),
        Object.freeze({ at: 0.75, intensityMultiplier: 1.15 }),
        Object.freeze({ at: 1, intensityMultiplier: 1.0 })
      ])
    })
  }),

  nod: Object.freeze({
    clipId: 'nod',
    durationMs: 1400,
    loop: true,
    channels: Object.freeze({
      root: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: 0, y: 1, rotate: 0.5, scaleX: 1, scaleY: 0.995 }),
        Object.freeze({ at: 0.5, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.75, x: 0, y: 1, rotate: 0.5, scaleX: 1, scaleY: 0.995 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      head: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: 0, y: 4, rotate: 8, scaleX: 1, scaleY: 0.98 }),
        Object.freeze({ at: 0.5, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.75, x: 0, y: 4, rotate: 8, scaleX: 1, scaleY: 0.98 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      expression: Object.freeze([
        Object.freeze({ at: 0, intensityMultiplier: 1.0 }),
        Object.freeze({ at: 0.25, intensityMultiplier: 1.1 }),
        Object.freeze({ at: 0.5, intensityMultiplier: 1.0 }),
        Object.freeze({ at: 0.75, intensityMultiplier: 1.1 }),
        Object.freeze({ at: 1, intensityMultiplier: 1.0 })
      ])
    })
  }),

  sway: Object.freeze({
    clipId: 'sway',
    durationMs: 2000,
    loop: true,
    channels: Object.freeze({
      root: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: -7, y: -2, rotate: -3.5, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.5, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.75, x: 7, y: -2, rotate: 3.5, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      head: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: -3, y: -1, rotate: -4, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.5, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.75, x: 3, y: -1, rotate: 4, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ])
    })
  }),

  curious_tilt: Object.freeze({
    clipId: 'curious_tilt',
    durationMs: 2400,
    loop: true,
    channels: Object.freeze({
      root: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.3, x: -2, y: -1, rotate: -1, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.7, x: 2, y: -1, rotate: 1, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      head: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: -2, y: 0, rotate: -9, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.45, x: -2, y: 0, rotate: -9, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.6, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.8, x: 2, y: 0, rotate: 7, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      expression: Object.freeze([
        Object.freeze({ at: 0, intensityMultiplier: 1.0 }),
        Object.freeze({ at: 0.35, intensityMultiplier: 1.2 }),
        Object.freeze({ at: 0.6, intensityMultiplier: 1.0 }),
        Object.freeze({ at: 0.85, intensityMultiplier: 1.15 }),
        Object.freeze({ at: 1, intensityMultiplier: 1.0 })
      ])
    })
  }),

  look_around: Object.freeze({
    clipId: 'look_around',
    durationMs: 3000,
    loop: true,
    channels: Object.freeze({
      root: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.2, x: -1, y: 0, rotate: -0.5, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.5, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.7, x: 1, y: 0, rotate: 0.5, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      head: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.2, x: -5, y: 0, rotate: -4, scaleX: 0.96, scaleY: 1 }),
        Object.freeze({ at: 0.4, x: -5, y: 0, rotate: -4, scaleX: 0.96, scaleY: 1 }),
        Object.freeze({ at: 0.55, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.7, x: 5, y: 0, rotate: 4, scaleX: 0.96, scaleY: 1 }),
        Object.freeze({ at: 0.85, x: 5, y: 0, rotate: 4, scaleX: 0.96, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      expression: Object.freeze([
        Object.freeze({ at: 0, intensityMultiplier: 1.0 }),
        Object.freeze({ at: 0.3, intensityMultiplier: 1.1 }),
        Object.freeze({ at: 0.55, intensityMultiplier: 1.0 }),
        Object.freeze({ at: 0.78, intensityMultiplier: 1.1 }),
        Object.freeze({ at: 1, intensityMultiplier: 1.0 })
      ])
    })
  }),

  wave: Object.freeze({
    clipId: 'wave',
    durationMs: 1400,
    loop: true,
    channels: Object.freeze({
      root: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: 0, y: -2, rotate: 0.5, scaleX: 1, scaleY: 1.01 }),
        Object.freeze({ at: 0.5, x: 0, y: -3, rotate: 0, scaleX: 1.005, scaleY: 1.015 }),
        Object.freeze({ at: 0.75, x: 0, y: -2, rotate: -0.5, scaleX: 1, scaleY: 1.01 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      head: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 2, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: 1, y: -1, rotate: 6, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.5, x: 0, y: -1, rotate: 3, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.75, x: 1, y: -1, rotate: 6, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 2, scaleX: 1, scaleY: 1 })
      ]),
      armRight: Object.freeze([
        Object.freeze({ at: 0, x: 2, y: -4, rotate: -105, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: 2, y: -4, rotate: -135, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.5, x: 2, y: -4, rotate: -105, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.75, x: 2, y: -4, rotate: -135, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 2, y: -4, rotate: -105, scaleX: 1, scaleY: 1 })
      ]),
      armLeft: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 2, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.5, x: 0, y: 0, rotate: 6, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 2, scaleX: 1, scaleY: 1 })
      ]),
      expression: Object.freeze([
        Object.freeze({ at: 0, intensityMultiplier: 1.0 }),
        Object.freeze({ at: 0.25, intensityMultiplier: 1.15 }),
        Object.freeze({ at: 0.5, intensityMultiplier: 1.05 }),
        Object.freeze({ at: 0.75, intensityMultiplier: 1.15 }),
        Object.freeze({ at: 1, intensityMultiplier: 1.0 })
      ])
    })
  }),

  point: Object.freeze({
    clipId: 'point',
    durationMs: 1600,
    loop: true,
    channels: Object.freeze({
      root: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.3, x: 2, y: -1, rotate: 1, scaleX: 1.005, scaleY: 1.005 }),
        Object.freeze({ at: 0.5, x: 3, y: -2, rotate: 1.5, scaleX: 1.01, scaleY: 1.01 }),
        Object.freeze({ at: 0.7, x: 2, y: -1, rotate: 1, scaleX: 1.005, scaleY: 1.005 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      head: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.3, x: 3, y: -1, rotate: 4, scaleX: 0.98, scaleY: 1 }),
        Object.freeze({ at: 0.5, x: 4, y: -1, rotate: 5, scaleX: 0.98, scaleY: 1 }),
        Object.freeze({ at: 0.7, x: 3, y: -1, rotate: 4, scaleX: 0.98, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      armRight: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.3, x: 3, y: -2, rotate: -55, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.5, x: 4, y: -3, rotate: -62, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.7, x: 3, y: -2, rotate: -55, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      armLeft: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.35, x: -1, y: 0, rotate: 6, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.7, x: -1, y: 0, rotate: 6, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      expression: Object.freeze([
        Object.freeze({ at: 0, intensityMultiplier: 1.0 }),
        Object.freeze({ at: 0.35, intensityMultiplier: 1.2 }),
        Object.freeze({ at: 0.7, intensityMultiplier: 1.15 }),
        Object.freeze({ at: 1, intensityMultiplier: 1.0 })
      ])
    })
  }),

  clap: Object.freeze({
    clipId: 'clap',
    durationMs: 800,
    loop: true,
    channels: Object.freeze({
      root: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: 0, y: -4, rotate: 0, scaleX: 0.99, scaleY: 1.02 }),
        Object.freeze({ at: 0.5, x: 0, y: 1, rotate: 0, scaleX: 1.01, scaleY: 0.98 }),
        Object.freeze({ at: 0.75, x: 0, y: -4, rotate: 0, scaleX: 0.99, scaleY: 1.02 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      head: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: 0, y: -1, rotate: 2, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.5, x: 0, y: 1, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.75, x: 0, y: -1, rotate: -2, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      armLeft: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 30, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: 4, y: -2, rotate: 10, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.5, x: 0, y: 0, rotate: 30, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.75, x: 4, y: -2, rotate: 10, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 30, scaleX: 1, scaleY: 1 })
      ]),
      armRight: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: -30, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: -4, y: -2, rotate: -10, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.5, x: 0, y: 0, rotate: -30, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.75, x: -4, y: -2, rotate: -10, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: -30, scaleX: 1, scaleY: 1 })
      ]),
      expression: Object.freeze([
        Object.freeze({ at: 0, intensityMultiplier: 1.05 }),
        Object.freeze({ at: 0.25, intensityMultiplier: 1.25 }),
        Object.freeze({ at: 0.5, intensityMultiplier: 1.05 }),
        Object.freeze({ at: 0.75, intensityMultiplier: 1.25 }),
        Object.freeze({ at: 1, intensityMultiplier: 1.05 })
      ])
    })
  }),

  jump: Object.freeze({
    clipId: 'jump',
    durationMs: 1000,
    loop: true,
    channels: Object.freeze({
      root: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.15, x: 0, y: 8, rotate: 0, scaleX: 1.06, scaleY: 0.92 }),
        Object.freeze({ at: 0.45, x: 0, y: -28, rotate: 0, scaleX: 0.94, scaleY: 1.08 }),
        Object.freeze({ at: 0.75, x: 0, y: 5, rotate: 0, scaleX: 1.04, scaleY: 0.95 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      head: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.15, x: 0, y: 4, rotate: 4, scaleX: 1, scaleY: 0.96 }),
        Object.freeze({ at: 0.45, x: 0, y: -10, rotate: -2, scaleX: 1, scaleY: 1.04 }),
        Object.freeze({ at: 0.75, x: 0, y: 3, rotate: 2, scaleX: 1, scaleY: 0.97 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      armLeft: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.15, x: -2, y: 2, rotate: -20, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.45, x: -3, y: -6, rotate: 125, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.75, x: -1, y: 2, rotate: -10, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      armRight: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.15, x: 2, y: 2, rotate: 20, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.45, x: 3, y: -6, rotate: -125, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.75, x: 1, y: 2, rotate: 10, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      legLeft: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.15, x: 0, y: -2, rotate: 3, scaleX: 1.02, scaleY: 0.88 }),
        Object.freeze({ at: 0.45, x: 0, y: 2, rotate: -2, scaleX: 0.98, scaleY: 1.06 }),
        Object.freeze({ at: 0.75, x: 0, y: -1, rotate: 2, scaleX: 1.01, scaleY: 0.92 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      legRight: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.15, x: 0, y: -2, rotate: -3, scaleX: 1.02, scaleY: 0.88 }),
        Object.freeze({ at: 0.45, x: 0, y: 2, rotate: 2, scaleX: 0.98, scaleY: 1.06 }),
        Object.freeze({ at: 0.75, x: 0, y: -1, rotate: -2, scaleX: 1.01, scaleY: 0.92 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      expression: Object.freeze([
        Object.freeze({ at: 0, intensityMultiplier: 1.0 }),
        Object.freeze({ at: 0.15, intensityMultiplier: 0.9 }),
        Object.freeze({ at: 0.45, intensityMultiplier: 1.35 }),
        Object.freeze({ at: 0.75, intensityMultiplier: 1.1 }),
        Object.freeze({ at: 1, intensityMultiplier: 1.0 })
      ])
    })
  }),

  dance: Object.freeze({
    clipId: 'dance',
    durationMs: 1600,
    loop: true,
    channels: Object.freeze({
      root: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: -8, y: -4, rotate: -4, scaleX: 1.01, scaleY: 1.01 }),
        Object.freeze({ at: 0.5, x: 0, y: 1, rotate: 0, scaleX: 1, scaleY: 0.99 }),
        Object.freeze({ at: 0.75, x: 8, y: -4, rotate: 4, scaleX: 1.01, scaleY: 1.01 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      head: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: -3, y: -2, rotate: -6, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.5, x: 0, y: 1, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.75, x: 3, y: -2, rotate: 6, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      armLeft: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 20, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: -2, y: -3, rotate: 80, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.5, x: 0, y: 0, rotate: 15, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.75, x: 1, y: 0, rotate: -25, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 20, scaleX: 1, scaleY: 1 })
      ]),
      armRight: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: -20, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: -1, y: 0, rotate: 25, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.5, x: 0, y: 0, rotate: -15, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.75, x: 2, y: -3, rotate: -80, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: -20, scaleX: 1, scaleY: 1 })
      ]),
      legLeft: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: -1, y: 0, rotate: -4, scaleX: 1, scaleY: 0.98 }),
        Object.freeze({ at: 0.5, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.75, x: 1, y: -1, rotate: 3, scaleX: 1, scaleY: 1.02 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      legRight: Object.freeze([
        Object.freeze({ at: 0, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.25, x: -1, y: -1, rotate: -3, scaleX: 1, scaleY: 1.02 }),
        Object.freeze({ at: 0.5, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }),
        Object.freeze({ at: 0.75, x: 1, y: 0, rotate: 4, scaleX: 1, scaleY: 0.98 }),
        Object.freeze({ at: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
      ]),
      expression: Object.freeze([
        Object.freeze({ at: 0, intensityMultiplier: 1.0 }),
        Object.freeze({ at: 0.25, intensityMultiplier: 1.2 }),
        Object.freeze({ at: 0.5, intensityMultiplier: 1.05 }),
        Object.freeze({ at: 0.75, intensityMultiplier: 1.25 }),
        Object.freeze({ at: 1, intensityMultiplier: 1.0 })
      ])
    })
  })
});

/**
 * Legacy motion clip fallbacks for rigid-safe migration.
 */
export const RIGID_CLIP_FALLBACKS = Object.freeze({
  wave: 'hello',
  point: 'look_around',
  'look-around': 'look_around',
  clap: 'celebrate',
  dance: 'sway',
  jump: 'happy_bounce',
  'happy-bounce': 'happy_bounce'
});

/**
 * Legacy static pose fallbacks for rigid-safe migration.
 */
export const RIGID_POSE_FALLBACKS = Object.freeze({
  wave: 'lean_left',
  point: 'look_right',
  hands_on_hips: 'rest',
  arms_up: 'rest'
});

/**
 * Asset animation profiles configuration.
 */
export const MOTION_PROFILES_CONFIG = Object.freeze({
  'root': Object.freeze({
    motionProfile: 'root',
    safeClips: Object.freeze(['none', 'idle', 'happy_bounce', 'sway', 'hello', 'celebrate']),
    safePoses: Object.freeze(['rest', 'lean_left', 'lean_right'])
  }),
  'root-head': Object.freeze({
    motionProfile: 'root-head',
    safeClips: Object.freeze(['none', 'idle', 'happy_bounce', 'sway', 'hello', 'celebrate', 'nod', 'look_around']),
    safePoses: Object.freeze(['rest', 'lean_left', 'lean_right', 'look_left', 'look_right', 'tilt_left', 'tilt_right'])
  })
});

/**
 * Resolves the derived motion profile for a character entity.
 * Full-body custom painted artwork receives 'root'.
 * Modular base dolls with rigid clothing receive 'root-head'.
 */
export function resolveMotionProfile(characterEntity) {
  if (!characterEntity) return 'root-head';
  const snapshot = characterEntity.characterSnapshot;
  const sourceId = characterEntity.sourceId || snapshot?.baseDollId || '';
  const isCustomFullBody = Boolean(
    characterEntity.isCustomArt ||
    snapshot?.customArtId ||
    snapshot?.kind === 'custom_full' ||
    (typeof sourceId === 'string' && sourceId.startsWith('custom_') && !sourceId.includes('doll_'))
  );
  if (isCustomFullBody) {
    return 'root';
  }
  return 'root-head';
}

/**
 * Normalizes and resolves a clip ID against rigid-safe fallbacks and profile constraints.
 */
export function resolveSafeClipId(clipId, profile = 'root-head') {
  if (!clipId) return DEFAULT_MOTION_CLIP_ID;
  const normalizedKey = clipId === 'happy-bounce' ? 'happy_bounce' : clipId === 'look-around' ? 'look_around' : clipId;
  const mapped = RIGID_CLIP_FALLBACKS[normalizedKey] || normalizedKey;
  const config = MOTION_PROFILES_CONFIG[profile] || MOTION_PROFILES_CONFIG['root-head'];
  if (config.safeClips.includes(mapped)) {
    return mapped;
  }
  if (profile === 'root' && (mapped === 'nod' || mapped === 'look_around')) {
    return 'idle';
  }
  return config.safeClips.includes(normalizedKey) ? normalizedKey : DEFAULT_MOTION_CLIP_ID;
}

/**
 * Normalizes and resolves a static pose against rigid-safe fallbacks and profile constraints.
 */
export function resolveSafePoseId(poseId, profile = 'root-head') {
  if (!poseId) return DEFAULT_STATIC_POSE;
  const mapped = RIGID_POSE_FALLBACKS[poseId] || poseId;
  const config = MOTION_PROFILES_CONFIG[profile] || MOTION_PROFILES_CONFIG['root-head'];
  if (config.safePoses.includes(mapped)) {
    return mapped;
  }
  return DEFAULT_STATIC_POSE;
}

export function getMotionClip(clipId) {
  const normalizedId = clipId === 'happy-bounce' ? 'happy_bounce' : clipId === 'look-around' ? 'look_around' : clipId;
  return MOTION_CLIPS[normalizedId] || MOTION_CLIPS[DEFAULT_MOTION_CLIP_ID];
}


