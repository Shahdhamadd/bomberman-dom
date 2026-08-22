const MF = window.MiniFramework;
if (!MF) {
  throw new Error(
    "MiniFramework failed to load — check the <script> tags in index.html."
  );
}

export const h = MF.h;
export const createStore = MF.createStore;
export const createApp = MF.createApp;
