import type { AppState, CharacterSnapshot, CustomAsset, SceneRecord, StoreAction } from '../js/types.js';
import type { createAppStore } from '../js/core/app-store.js';

// These intentional errors must remain visible to tsc. An unused directive
// fails the check if a contract becomes `any` or loses the relevant field type.
export function checkContracts(state: AppState, scene: SceneRecord, draft: CharacterSnapshot, asset: CustomAsset, store: ReturnType<typeof createAppStore>) {
  // @ts-expect-error The UI mode lives under state.ui.
  state.activeTab;
  // @ts-expect-error Entity identity uses instanceId.
  scene.entities[0].id;
  // @ts-expect-error Slot colors are strings.
  draft.slots.top.color = 42;
  // @ts-expect-error Custom artwork metadata uses wearable or prop kinds.
  asset.kind = 'hairFront';
  // @ts-expect-error Camera coordinates must be numbers.
  store.dispatch({ type: 'scene/setCameraX', cameraX: '400' });
  // @ts-expect-error The store exposes the checked application state.
  store.getState().ui.primarySelectedId;
  const action: StoreAction = { type: 'scene/setCameraX', cameraX: 400 };
  store.dispatch(action);
}
