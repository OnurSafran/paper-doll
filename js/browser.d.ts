interface Window {
  hardRefresh: () => Promise<void>;
  webkitAudioContext?: typeof AudioContext;
}

declare module '*pointer-controller.js?v=2' {
  export const PointerController: typeof import('./core/pointer-controller.js').PointerController;
}
