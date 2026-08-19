import { TILE } from "./constants.js";
import { playerSvg, bombSvg, powerupSvg } from "./sprites.js";

let layer = null;
let fpsEl = null;
let raf = 0;

const players = new Map();
let bombs = new Map();
let powerups = new Map();
let flames = [];

let selfId = null;
let selfGhost = false;
let ghostHintEl = null;
let ghostHintText = "";
let spiritReadyAt = 0;
let spiritCooldown = 8000;

let frames = 0;
let fpsSince = 0;

function makeEl(cls, x, y) {
  const el = document.createElement("div");
  el.className = "sprite " + cls;
  el.style.transform = `translate3d(${x * TILE}px, ${y * TILE}px, 0)`;
  layer.appendChild(el);
  return el;
}

function tween(x, y) {
  return {
    x,
    y,
    moving: false,
    fromX: x,
    fromY: y,
    toX: x,
    toY: y,
    start: 0,
    duration: 0,
  };
}

function startTween(t, fromX, fromY, toX, toY, duration) {
  t.x = fromX;
  t.y = fromY;
  t.fromX = fromX;
  t.fromY = fromY;
  t.toX = toX;
  t.toY = toY;
  t.start = performance.now();
  t.duration = duration;
  t.moving = true;
}

function advance(t, now) {
  if (!t.moving) return [t.x, t.y];
  let k = (now - t.start) / t.duration;
  if (k >= 1) {
    k = 1;
    t.moving = false;
    t.x = t.toX;
    t.y = t.toY;
  }
  return [t.fromX + (t.toX - t.fromX) * k, t.fromY + (t.toY - t.fromY) * k];
}

export function init(msg, myId) {
  stop();
  layer = document.getElementById("entities");
  fpsEl = document.getElementById("fps");
  if (!layer) return;

  selfId = myId == null ? null : myId;
  spiritReadyAt = 0;
  spiritCooldown = msg.spiritCooldown || 8000;

  for (const p of msg.players) {
    const el = makeEl("player", p.cellX, p.cellY);
    el.innerHTML = playerSvg(p.color);
    const tag = document.createElement("span");
    tag.className = "name-tag";
    tag.textContent = p.nickname + (p.bot ? " 🤖" : "");
    el.appendChild(tag);

    const entity = tween(p.cellX, p.cellY);
    entity.id = p.id;
    entity.el = el;
    entity.alive = true;
    entity.ghost = false;
    entity.invulnUntil = 0;
    players.set(p.id, entity);
  }

  frames = 0;
  fpsSince = performance.now();
  if (fpsEl) fpsEl.textContent = "— FPS";
  raf = requestAnimationFrame(frame);
}

export function onMove(msg) {
  const p = players.get(msg.id);
  if (!p) return;
  startTween(p, msg.fromX, msg.fromY, msg.toX, msg.toY, msg.duration);
}

export function onBomb(msg) {
  const el = makeEl("bomb" + (msg.spirit ? " spirit" : ""), msg.x, msg.y);
  el.innerHTML = bombSvg(msg.spirit);
  const entity = tween(msg.x, msg.y);
  entity.el = el;
  bombs.set(msg.id, entity);

  if (msg.spirit && msg.ownerId === selfId) {
    spiritReadyAt = performance.now() + (msg.cooldown || spiritCooldown);
  }
}

export function onBombMove(msg) {
  const b = bombs.get(msg.id);
  if (!b) return;
  startTween(b, msg.fromX, msg.fromY, msg.toX, msg.toY, msg.duration);
}

export function onExplosion(msg) {
  for (const id of msg.bombs) {
    const b = bombs.get(id);
    if (b) {
      b.el.remove();
      bombs.delete(id);
    }
  }
  const expiresAt = performance.now() + msg.duration;
  for (const c of msg.cells) spawnFlame(c.x, c.y, expiresAt);
  for (const pu of msg.powerups) addPowerup(pu);
  for (const hit of msg.hits) {
    const p = players.get(hit.id);
    if (!p) continue;
    p.invulnUntil = hit.invulnMs ? performance.now() + hit.invulnMs : 0;
    if (hit.ghost) markGhost(p, hit.spiritCooldown);
    else if (!hit.alive) markGone(p);
  }
}

function addPowerup(pu) {
  const key = pu.x + "," + pu.y;
  if (powerups.has(key)) return;
  const el = makeEl("powerup powerup-" + pu.kind, pu.x, pu.y);
  el.innerHTML = `<div class="powerup-tile">${powerupSvg(pu.kind)}</div>`;
  powerups.set(key, el);
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
  if (!p) return;
  if (msg.ghost) markGhost(p, msg.spiritCooldown);
  else markGone(p);
}

function markGhost(p, cooldown) {
  p.alive = false;
  p.ghost = true;
  p.el.classList.add("ghost");
  p.el.classList.remove("invuln");
  if (p.id === selfId) {
    selfGhost = true;
    spiritReadyAt = performance.now() + (cooldown || spiritCooldown);
  }
}

function markGone(p) {
  p.alive = false;
  p.ghost = false;
  p.moving = false;
  p.el.classList.add("dead");
  p.el.classList.remove("invuln", "ghost");
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
  selfId = null;
  selfGhost = false;
  ghostHintEl = null;
  ghostHintText = "";
  spiritReadyAt = 0;
}

function spawnFlame(x, y, expiresAt) {
  const el = makeEl("flame", x, y);
  const core = document.createElement("div");
  core.className = "flame-core";
  el.appendChild(core);
  flames.push({ el, expiresAt });
}

function updateGhostHint(now) {
  if (!ghostHintEl || !ghostHintEl.isConnected) {
    ghostHintEl = document.getElementById("ghost-hint");
    if (!ghostHintEl) return;
    ghostHintText = "";
  }

  const left = spiritReadyAt - now;
  const text =
    left > 0
      ? `Spirit bomb recharging… ${(left / 1000).toFixed(1)}s`
      : "Spirit bomb READY — press Space";
  if (text === ghostHintText) return;

  ghostHintText = text;
  ghostHintEl.textContent = text;
  ghostHintEl.classList.toggle("ready", left <= 0);
}

function frame(now) {
  for (const p of players.values()) {
    if (p.moving) {
      const [px, py] = advance(p, now);
      p.el.style.transform = `translate3d(${px * TILE}px, ${py * TILE}px, 0)`;
    }
    if (p.alive) p.el.classList.toggle("invuln", now < p.invulnUntil);
  }

  for (const b of bombs.values()) {
    if (!b.moving) continue;
    const [bx, by] = advance(b, now);
    b.el.style.transform = `translate3d(${bx * TILE}px, ${by * TILE}px, 0)`;
  }

  for (let i = flames.length - 1; i >= 0; i--) {
    if (now < flames[i].expiresAt) continue;
    flames[i].el.remove();
    flames.splice(i, 1);
  }

  if (selfGhost) updateGhostHint(now);

  frames++;
  if (now - fpsSince >= 500) {
    const fps = Math.round((frames * 1000) / (now - fpsSince));
    if (fpsEl) fpsEl.textContent = fps + " FPS";
    frames = 0;
    fpsSince = now;
  }

  raf = requestAnimationFrame(frame);
}
