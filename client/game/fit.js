import { TILE } from "./constants.js";

const BOARD_W = 15 * TILE;
const BOARD_H = 13 * TILE;
const PAD = 16;

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

  setVars(1);
  const availW = wrap.parentElement.clientWidth;
  const rectTop = wrap.getBoundingClientRect().top;
  const availH = window.innerHeight - rectTop - PAD;

  if (availW <= 40 || availH <= 40) return;

  let scale = Math.min(availW / BOARD_W, availH / BOARD_H, 1);
  scale = Math.max(scale, 0.35);
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
