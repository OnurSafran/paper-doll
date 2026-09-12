/**
 * @file Type definitions and JSDoc contracts for Paper Doll Studio.
 * Compliant with Decision D-011: Pure JSDoc comments; no build-step required.
 */

/**
 * @typedef {Object} OutfitSlotItem
 * @property {string} assetId
 * @property {string} [color]
 */

/**
 * @typedef {Object} FaceEyes
 * @property {string} assetId
 * @property {string} irisColor
 */

/**
 * @typedef {Object} FaceFeature
 * @property {string} assetId
 */

/**
 * @typedef {Object} DollFace
 * @property {FaceEyes} eyes
 * @property {FaceFeature} eyebrows
 * @property {FaceFeature} nose
 * @property {FaceFeature} mouth
 * @property {FaceFeature|null} detail
 */

/**
 * @typedef {Object} CharacterSnapshot
 * @property {string} baseDollId
 * @property {string} skinTone
 * @property {DollFace} face
 * @property {Record<string, OutfitSlotItem|null>} slots
 */

/**
 * @typedef {Object} SceneEntity
 * @property {string} instanceId
 * @property {'character'|'prop'|'bubble'} kind
 * @property {string} sourceId
 * @property {number} x
 * @property {number} y
 * @property {number} [scale]
 * @property {boolean} [flipped]
 * @property {boolean} [pinned]
 * @property {number} [order]
 * @property {string|null} [attachedTo]
 * @property {{ dx: number, dy: number }|null} [attachOffset]
 * @property {string} [attachJoint]
 * @property {CharacterSnapshot} [characterSnapshot]
 * @property {string} [expression]
 * @property {number} [expressionIntensity]
 * @property {string} [pose]
 * @property {{ clipId: string, enabled: boolean, intensity: number, phaseOffset: number }} [animation]
 * @property {string} [text]
 * @property {string} [bubbleStyle]
 * @property {number} [width]
 */

/**
 * @typedef {Object} SceneRecord
 * @property {string} sceneId
 * @property {string} title
 * @property {string} backgroundId
 * @property {number} stageWidth
 * @property {number} cameraX
 * @property {SceneEntity[]} entities
 * @property {{ enabled: boolean, loop: boolean, playbackRate: number }} [animationSettings]
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
 */

/**
 * Persisted custom artwork metadata; image bytes live in the artwork repository.
 * @typedef {Object} CustomAsset
 * @property {string} assetId
 * @property {string} name
 * @property {'wearable'|'prop'} kind
 * @property {string} [slot]
 * @property {string} format
 * @property {number} logicalWidth
 * @property {number} logicalHeight
 * @property {number} pixelWidth
 * @property {number} pixelHeight
 * @property {number} [byteLength]
 * @property {string} sha256
 * @property {string[]} collections
 * @property {string} [packId]
 * @property {string} [packVersion]
 * @property {'available'|'trashed'|'missing'} status
 * @property {boolean} libraryVisible
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string[]} [supportedFitFamilies]
 * @property {string[]} [presentationStyles]
 * @property {number} [displayWidth]
 * @property {number} [displayHeight]
 * @property {{x: number, y: number}} [groundAnchor]
 */

/**
 * @typedef {Object} StoreAction
 * @property {string} type
 * @property {string} [outfitId]
 * @property {string} [packId]
 * @property {*} [payload]
 * @property {string} [bubbleStyle]
 * @property {string} [baseDollId]
 * @property {string} [text]
 * @property {number} [width]
 * @property {string} [targetEntityId]
 * @property {{ instanceId: string, x: number, y: number }[]} [moves]
 * @property {string} [setting]
 * @property {boolean} [enabled]
 * @property {string} [mode]
 * @property {string} [instanceId]
 * @property {string[]} [instanceIds]
 * @property {string} [slot]
 * @property {string} [assetId]
 * @property {string} [color]
 * @property {string} [tab]
 * @property {string} [group]
 * @property {string} [style]
 * @property {string} [name]
 * @property {string} [presetId]
 * @property {string} [sceneId]
 * @property {string} [backgroundId]
 * @property {number} [stageWidth]
 * @property {number} [cameraX]
 * @property {number} [deltaX]
 * @property {number} [x]
 * @property {number} [y]
 * @property {number} [scale]
 * @property {number} [direction]
 * @property {string} [alignment]
 * @property {number} [delta]
 * @property {boolean} [pinned]
 * @property {string} [childInstanceId]
 * @property {string} [parentInstanceId]
 * @property {string} [templateId]
 * @property {string} [expression]
 * @property {number} [expressionIntensity]
 * @property {string} [pose]
 * @property {*} [animation]
 * @property {*} [animationSettings]
 * @property {number} [playbackRate]
 * @property {string} [attachJoint]
 * @property {CustomAsset} [asset]
 * @property {readonly string[]} [collections]
 * @property {string[]} [assetIds]
 * @property {*} [envelope]
 * @property {string} [stampId]
 * @property {string} [status]
 * @property {string} [message]
 * @property {string} [messageKey]
 * @property {*} [messageParams]
 * @property {boolean} [active]
 */

/**
 * @typedef {Object} AppState
 * @property {number} [schemaVersion]
 * @property {number} [revision]
 * @property {{ reducedMotion: string, soundEnabled: boolean, clothingTabs?: boolean, cardboardFinish?: boolean, stamps: string[], unlockedBackgrounds: string[], hiddenPacks?: string[] }} settings
 * @property {{ id: string, version?: string }[]} packRequirements
 * @property {CustomAsset[]} customAssets
 * @property {{ draft: CharacterSnapshot, selectedSlot: string, editingPresetId: string|null, dirty: boolean, activeTab?: string, selectedFaceGroup?: string, selectedStyleFilter?: string }} designer
 * @property {Object[]} presets
 * @property {SceneRecord[]} scenes
 * @property {SceneRecord} currentScene
 * @property {{ mode: string, selectedEntityId: string|null, selectedEntityIds: string[], activeSceneLibraryId: string|null, storageStatus: string, message?: string, messageKey?: string|null, messageParams?: Object|null, packFilter?: string, voicePuppetryActive?: boolean }} ui
 */

/**
 * Runtime catalog descriptor shared by built-in and custom asset lookups.
 * @typedef {Object} AssetDescriptor
 * @property {string} id
 * @property {string} kind
 * @property {string} name
 * @property {string} [path]
 * @property {number[]} viewBox
 * @property {readonly string[]} [requiredGroups]
 * @property {string} [slot]
 * @property {string} [faceGroup]
 * @property {string} [fitFamily]
 * @property {string[]} [lifeStages]
 * @property {string[]} [presentationStyles]
 * @property {string[]} [supportedFitFamilies]
 * @property {readonly string[]} [collections]
 * @property {string} [poseSupport]
 * @property {string} [poseChannel]
 * @property {{x: number, y: number}} [headPivot]
 * @property {{x: number, y: number}} [shoulderLeftPivot]
 * @property {{x: number, y: number}} [shoulderRightPivot]
 * @property {{x: number, y: number}} [hipLeftPivot]
 * @property {{x: number, y: number}} [hipRightPivot]
 * @property {{x: number, y: number}} [groundAnchor]
 * @property {number} [displayWidth]
 * @property {number} [displayHeight]
 * @property {Record<string, string>} [defaultColors]
 * @property {number} [backgroundWidth]
 * @property {number} [defaultScale]
 * @property {string} [defaultColor]
 * @property {string} [renderMode]
 * @property {boolean} [custom]
 * @property {Object} [metadata]
 * @property {string} [packId]
 * @property {string} [packVersion]
 */

export {};
