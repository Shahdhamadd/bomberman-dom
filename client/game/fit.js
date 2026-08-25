import { TILE } from "./constants.js";

const BOARD_W = 15 * TILE;
const BOARD_H = 13 * TILE;
const MIN_SCALE = 0.35;
const MAX_SCALE = 4;
const GROW_EPS = 0.01;
const SIDE_MIN = 300;
const SIDE_MAX = 560;

const root = document.documentElement.style;
let raf = 0;
let current = 1;
let side = 0;
let observer = null;
let observed = null;

// Watch whichever slot is currently mounted, so a rebuilt board re-binds.
function observeSlot(slot) {
  if (!observer || slot === observed) return;
  if (observed) observer.unobserve(observed);
  observed = slot;
  if (slot) observer.observe(slot);
}

function fitBoard() {
  const wrap = document.querySelector(".board-wrap");
  const slot = wrap && wrap.parentElement;
  const game = slot && slot.closest(".game");
  const panel = game && game.querySelector(".game-side");
  if (!panel) return;
  observeSlot(slot);

  // The board is absolutely positioned inside the slot, so its own size never
  // affects the slot's size — the measurement can't chase itself the way it did
  // when the board still took up layout space.
  const availH = slot.clientHeight;
  if (availH <= 40) return;

  // Width taken by anything in the main column that is not the board — the stat
  // rail on wide screens, zero when the bar sits above the board instead.
  const cs = getComputedStyle(game);
  const gap = parseFloat(cs.columnGap) || 0;
  const contentW =
    game.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const beside = cs.gridTemplateColumns.trim().split(/\s+/).length > 1;
  const rail = beside
    ? Math.max(0, contentW - slot.clientWidth - panel.offsetWidth - gap)
    : 0;

  // With the rail up, the bar is a fixed-width column whose height cannot change
  // with the layout's width, so it is safe to take width off the chat panel and
  // give it to the board. Without it the bar sits above the board and rewraps as
  // the width changes, which would make the two decisions chase each other — so
  // there the board just takes the slot it is given.
  const availW = rail ? contentW - gap - SIDE_MIN - rail : slot.clientWidth;
  if (availW <= 40) return;

  let scale = Math.min(availH / BOARD_H, availW / BOARD_W);
  scale = Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE);

  // Shrink the moment the map stops fitting, but only grow when there is a real
  // amount of room to gain, so the board holds one size instead of twitching.
  if (scale !== current && !(scale > current && scale - current < GROW_EPS)) {
    current = scale;
    root.setProperty("--board-scale", scale.toFixed(4));
  }

  // Hand the width the board could not use to the chat panel rather than
  // leaving it as a gap.
  if (!rail) return;
  const slack = Math.max(0, availW - BOARD_W * current);
  const want = Math.round(Math.min(SIDE_MIN + slack, SIDE_MAX));
  if (want !== side) {
    side = want;
    root.setProperty("--side-col", want + "px");
  }
}

export function scheduleFit() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    fitBoard();
  });
}

export function initFit() {
  if (typeof ResizeObserver === "function") {
    observer = new ResizeObserver(scheduleFit);
  }
  window.addEventListener("resize", scheduleFit);
  window.addEventListener("orientationchange", scheduleFit);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleFit();
  });
}
