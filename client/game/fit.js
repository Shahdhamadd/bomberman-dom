// fit.js — keep the whole map visible for every player.
//
// The board renders at a fixed 40px/cell (tiles + sprite translate3d math), so
// instead of resizing cells we scale the whole `.board-wrap` (grid AND the
// #entities sprite layer scale together, staying aligned). We never scale UP
// past 1:1 — the board stays pixel-perfect when it fits, and shrinks only as
// much as needed to fit the window (or a taller team HUD). Applied through CSS
// custom properties on :root, which the framework's re-renders don't touch.

import { TILE } from "./constants.js";

const BOARD_W = 15 * TILE; // 600
const BOARD_H = 13 * TILE; // 520
const PAD = 16; // breathing room below the board

const root = document.documentElement.style;
let raf = 0;

function setVars(scale) {
  if (scale >= 0.999) {
    root.setProperty("--board-scale", "1");
    root.setProperty("--board-mr", "0px");
    root.setProperty("--board-mb", "0px");
  } else {
    root.setProperty("--board-scale", scale.toFixed(4));
    root.setProperty("--board-mr", "-" + Math.round(BOARD_W * (1 - scale)) + "px");
    root.setProperty("--board-mb", "-" + Math.round(BOARD_H * (1 - scale)) + "px");
  }
}

export function fitBoard() {
  const wrap = document.querySelector(".board-wrap");
  if (!wrap || !wrap.parentElement) return;

  // Measure against the UNSCALED layout. Neutralizing then reading then setting
  // all happens synchronously, so the browser only ever paints the final state.
  setVars(1);
  const availW = wrap.parentElement.clientWidth; // board column width (unscaled)
  const rectTop = wrap.getBoundingClientRect().top; // sits below the HUD
  const availH = window.innerHeight - rectTop - PAD;

  if (availW <= 40 || availH <= 40) return; // unmeasurable / absurd window

  let scale = Math.min(availW / BOARD_W, availH / BOARD_H, 1);
  scale = Math.max(scale, 0.35); // never shrink into oblivion
  setVars(scale);
}

export function scheduleFit() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    fitBoard();
  });
}

export function initFit() {
  window.addEventListener("resize", scheduleFit);
  window.addEventListener("orientationchange", scheduleFit);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleFit();
  });
}
