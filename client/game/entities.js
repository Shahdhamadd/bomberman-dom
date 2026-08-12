import { TILE } from "./constants.js";
import { playerSvg, bombSvg, powerupSvg } from "./sprites.js";

let layer = null;
let fpsEl = null;
let raf = 0;

const players = new Map();
let bombs = new Map();
let powerups = new Map();
let flames = [];

let frames = 0;
let fpsSince = 0;

function makeEl(cls, x, y) {
  const el = document.createElement("div");
  el.className = "sprite " + cls;
  el.style.transform = `translate3d(${x * TILE}px, ${y * TILE}px, 0)`;
  layer.appendChild(el);
  return el;
}

export function init(msg) {
  stop();
  layer = document.getElementById("entities");
  fpsEl = document.getElementById("fps");
  if (!layer) return;

  for (const p of msg.players) {
    const el = makeEl("player", p.cellX, p.cellY);
    el.innerHTML = playerSvg(p.color);
    const tag = document.createElement("span");
    tag.className = "name-tag";
    tag.textContent = p.nickname;
    el.appendChild(tag);

    players.set(p.id, {
      id: p.id,
      el,
      x: p.cellX,
      y: p.cellY,
      moving: false,
      fromX: p.cellX,
      fromY: p.cellY,
      toX: p.cellX,
      toY: p.cellY,
      start: 0,
      duration: 0,
      alive: true,
      invulnUntil: 0,
    });
  }

  frames = 0;
  fpsSince = performance.now();
  if (fpsEl) fpsEl.textContent = "— FPS";
  raf = requestAnimationFrame(frame);
}

export function onMove(msg) {
  const p = players.get(msg.id);
  if (!p) return;
  p.x = msg.fromX;
  p.y = msg.fromY;
  p.fromX = msg.fromX;
  p.fromY = msg.fromY;
  p.toX = msg.toX;
  p.toY = msg.toY;
  p.start = performance.now();
  p.duration = msg.duration;
  p.moving = true;
}

export function onBomb(msg) {
  const el = makeEl("bomb", msg.x, msg.y);
  el.innerHTML = bombSvg();
  bombs.set(msg.id, el);
}

export function onExplosion(msg) {
  for (const id of msg.bombs) {
    const el = bombs.get(id);
    if (el) {
      el.remove();
      bombs.delete(id);
    }
  }
  const expiresAt = performance.now() + msg.duration;
  for (const c of msg.cells) {
    const el = makeEl("flame", c.x, c.y);
    el.appendChild(coreDiv("flame-core"));
    flames.push({ el, expiresAt });
  }
  for (const pu of msg.powerups) {
    const el = makeEl("powerup powerup-" + pu.kind, pu.x, pu.y);
    el.innerHTML = `<div class="powerup-tile">${powerupSvg(pu.kind)}</div>`;
    powerups.set(pu.x + "," + pu.y, el);
  }
  for (const hit of msg.hits) {
    const p = players.get(hit.id);
    if (!p) continue;
    p.invulnUntil = hit.invulnMs ? performance.now() + hit.invulnMs : 0;
    if (!hit.alive) markDead(p);
  }
}

export function onPowerupTaken(msg) {
  const key = msg.x + "," + msg.y;
  const el = powerups.get(key);
  if (el) {
    el.remove();
    powerups.delete(key);
  }
}

export function onDead(msg) {
  const p = players.get(msg.id);
  if (p) markDead(p);
}

function markDead(p) {
  p.alive = false;
  p.moving = false;
  p.el.classList.add("dead");
  p.el.classList.remove("invuln");
}

export function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (layer) layer.innerHTML = "";
  players.clear();
  bombs = new Map();
  powerups = new Map();
  flames = [];
  layer = null;
}

function coreDiv(cls) {
  const d = document.createElement("div");
  d.className = cls;
  return d;
}

function frame(now) {
  for (const p of players.values()) {
    let px = p.x;
    let py = p.y;
    if (p.moving) {
      let t = (now - p.start) / p.duration;
      if (t >= 1) {
        t = 1;
        p.moving = false;
        p.x = p.toX;
        p.y = p.toY;
      }
      px = p.fromX + (p.toX - p.fromX) * t;
      py = p.fromY + (p.toY - p.fromY) * t;
    }
    p.el.style.transform = `translate3d(${px * TILE}px, ${py * TILE}px, 0)`;
    if (p.alive) p.el.classList.toggle("invuln", now < p.invulnUntil);
  }

  if (flames.length) {
    const keep = [];
    for (const f of flames) {
      if (now >= f.expiresAt) f.el.remove();
      else keep.push(f);
    }
    flames = keep;
  }

  frames++;
  if (now - fpsSince >= 500) {
    const fps = Math.round((frames * 1000) / (now - fpsSince));
    if (fpsEl) fpsEl.textContent = fps + " FPS";
    frames = 0;
    fpsSince = now;
  }

  raf = requestAnimationFrame(frame);
}
