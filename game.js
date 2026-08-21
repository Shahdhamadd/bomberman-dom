const bot = require("./bot.js");

const WIDTH = 15;
const HEIGHT = 13;

const EMPTY = 0;
const WALL = 1;
const BLOCK = 2;

const LIVES = 3;
const MAX_LIVES = 5;
const BASE_SPEED = 4;
const MAX_SPEED = 8;
const GHOST_SPEED = 5;
const START_BOMBS = 1;
const START_RANGE = 1;

const FUSE_MS = 2500;
const FLAME_MS = 500;
const INVULN_MS = 1500;
const KICK_STEP_MS = 90;
const SPIRIT_FUSE_MS = 1400;
const SPIRIT_COOLDOWN_MS = 8000;

const TICK_MS = 60;
const BOT_EVERY = 2;

const BLOCK_DENSITY = 0.62;
const POWERUP_CHANCE = 0.4;

const CORNERS = [
  [1, 1],
  [WIDTH - 2, 1],
  [1, HEIGHT - 2],
  [WIDTH - 2, HEIGHT - 2],
];

const FFA_COLORS = ["#ff5b5b", "#4aa3ff", "#3ddc84", "#ffcf3f"];
const TEAMS = [
  { id: 0, name: "Red Team", color: "#ff5b5b", colors: ["#ff5b5b", "#ff9d4d"] },
  { id: 1, name: "Blue Team", color: "#4aa3ff", colors: ["#4aa3ff", "#56e0d0"] },
];

const POWERUP_TABLE = [
  ["bomb", 26],
  ["flame", 26],
  ["speed", 20],
  ["kick", 16],
  ["life", 12],
];

function randomKind() {
  let total = 0;
  for (const entry of POWERUP_TABLE) total += entry[1];
  let roll = Math.random() * total;
  for (const [kind, weight] of POWERUP_TABLE) {
    roll -= weight;
    if (roll < 0) return kind;
  }
  return "bomb";
}

function isWall(x, y) {
  return (
    x === 0 ||
    y === 0 ||
    x === WIDTH - 1 ||
    y === HEIGHT - 1 ||
    (x % 2 === 0 && y % 2 === 0)
  );
}

function safeCells() {
  const safe = new Set();
  for (const [cx, cy] of CORNERS) {
    const dx = cx === 1 ? 1 : -1;
    const dy = cy === 1 ? 1 : -1;
    const cells = [
      [cx, cy],
      [cx + dx, cy],
      [cx + 2 * dx, cy],
      [cx, cy + dy],
      [cx, cy + 2 * dy],
    ];
    for (const [x, y] of cells) safe.add(x + "," + y);
  }
  return safe;
}

function generateTiles() {
  const safe = safeCells();
  const tiles = [];
  for (let y = 0; y < HEIGHT; y++) {
    const row = [];
    for (let x = 0; x < WIDTH; x++) {
      if (isWall(x, y)) row.push(WALL);
      else if (!safe.has(x + "," + y) && Math.random() < BLOCK_DENSITY) row.push(BLOCK);
      else row.push(EMPTY);
    }
    tiles.push(row);
  }
  return tiles;
}

function createGame(seats, mode) {
  const teamMode = seats.some((s) => s.team === 0 || s.team === 1);
  const taken = [0, 0];

  const players = seats.map((s, i) => {
    const team = teamMode ? s.team : null;
    const palette = teamMode ? TEAMS[team].colors : FFA_COLORS;
    const color = teamMode
      ? palette[taken[team]++ % palette.length]
      : palette[i % palette.length];

    return {
      id: s.id,
      nickname: s.nickname,
      bot: !!s.bot,
      team,
      color,
      cellX: CORNERS[i][0],
      cellY: CORNERS[i][1],
      desiredDir: null,
      moving: false,
      nextX: 0,
      nextY: 0,
      moveTimer: null,
      speed: BASE_SPEED,
      maxBombs: START_BOMBS,
      flameRange: START_RANGE,
      canKick: false,
      activeBombs: 0,
      lives: LIVES,
      alive: true,
      ghost: false,
      gone: false,
      invulnUntil: 0,
      spiritReadyAt: 0,
    };
  });

  return {
    width: WIDTH,
    height: HEIGHT,
    tiles: generateTiles(),
    mode: mode || "versus",
    teamMode,
    players,
    bombs: [],
    powerups: [],
    nextBombId: 1,
    over: false,
    ticks: 0,
    loop: null,
    emit: () => {},
  };
}

function startLoop(game) {
  if (game.loop) return;
  game.loop = setInterval(() => tick(game), TICK_MS);
}

function tick(game) {
  if (game.over) return;
  game.ticks++;

  for (const p of game.players) {
    if (!p.moving && p.desiredDir && canAct(p)) startMove(game, p);
  }

  if (game.ticks % BOT_EVERY === 0) {
    for (const p of game.players) {
      if (!p.bot || !canAct(p)) continue;
      bot.think(game, p, {
        move: (dir) => setInput(game, p.id, dir),
        bomb: () => placeBomb(game, p.id),
      });
    }
  }
}

function startPayload(game) {
  return {
    type: "game_start",
    width: game.width,
    height: game.height,
    tiles: game.tiles,
    mode: game.mode,
    teamMode: game.teamMode,
    teams: game.teamMode ? TEAMS.map((t) => ({ id: t.id, name: t.name, color: t.color })) : null,
    spiritCooldown: SPIRIT_COOLDOWN_MS,
    players: game.players.map(publicPlayer),
  };
}

function publicPlayer(p) {
  return {
    id: p.id,
    nickname: p.nickname,
    bot: p.bot,
    team: p.team,
    color: p.color,
    cellX: p.cellX,
    cellY: p.cellY,
    lives: p.lives,
    alive: p.alive,
    ghost: p.ghost,
    maxBombs: p.maxBombs,
    flameRange: p.flameRange,
    speed: p.speed,
    canKick: p.canKick,
  };
}

function statsOf(p) {
  return {
    maxBombs: p.maxBombs,
    flameRange: p.flameRange,
    speed: p.speed,
    canKick: p.canKick,
    lives: p.lives,
  };
}

function getPlayer(game, id) {
  return game.players.find((p) => p.id === id);
}

function canAct(p) {
  return !p.gone && (p.alive || p.ghost);
}

function sideOf(game, p) {
  return game.teamMode ? "t" + p.team : "p" + p.id;
}

function friendlyFlame(game, ownerId, p) {
  if (ownerId === p.id) return false;
  if (!game.teamMode) return false;
  const owner = getPlayer(game, ownerId);
  return !!owner && owner.team === p.team;
}

function step(x, y, dir) {
  if (dir === "up") return [x, y - 1];
  if (dir === "down") return [x, y + 1];
  if (dir === "left") return [x - 1, y];
  if (dir === "right") return [x + 1, y];
  return [x, y];
}

function step2(x, y, dir, r) {
  if (dir === "up") return [x, y - r];
  if (dir === "down") return [x, y + r];
  if (dir === "left") return [x - r, y];
  return [x + r, y];
}

function inBounds(game, x, y) {
  return x >= 0 && y >= 0 && x < game.width && y < game.height;
}

function bombAt(game, x, y) {
  return game.bombs.find((b) => b.x === x && b.y === y) || null;
}

function driftable(game, x, y) {
  return x >= 1 && y >= 1 && x <= game.width - 2 && y <= game.height - 2;
}

function setInput(game, id, dir) {
  const p = getPlayer(game, id);
  if (!p || !canAct(p) || game.over) return;
  p.desiredDir =
    dir === "up" || dir === "down" || dir === "left" || dir === "right" ? dir : null;
  if (!p.moving) startMove(game, p);
}

function startMove(game, p) {
  if (p.moving || game.over || !p.desiredDir || !canAct(p)) return;
  const [nx, ny] = step(p.cellX, p.cellY, p.desiredDir);

  if (p.ghost) {
    if (!driftable(game, nx, ny)) return;
  } else {
    if (!inBounds(game, nx, ny)) return;
    const t = game.tiles[ny][nx];
    if (t === WALL || t === BLOCK) return;
    const blocking = bombAt(game, nx, ny);
    if (blocking) {
      if (p.canKick) kickBomb(game, blocking, p.desiredDir);
      return;
    }
  }

  p.moving = true;
  p.nextX = nx;
  p.nextY = ny;
  const duration = Math.round(1000 / p.speed);
  p.moveTimer = setTimeout(() => completeMove(game, p), duration);

  game.emit({
    type: "player_move",
    id: p.id,
    fromX: p.cellX,
    fromY: p.cellY,
    toX: nx,
    toY: ny,
    duration,
  });
}

function completeMove(game, p) {
  p.moveTimer = null;
  p.moving = false;
  p.cellX = p.nextX;
  p.cellY = p.nextY;
  if (game.over || !canAct(p)) return;
  if (p.alive) pickup(game, p);
  startMove(game, p);
}

function pickup(game, p) {
  if (!p.alive || p.ghost || p.gone) return;

  const i = game.powerups.findIndex((pu) => pu.x === p.cellX && pu.y === p.cellY);
  if (i === -1) return;
  const pu = game.powerups[i];
  game.powerups.splice(i, 1);

  if (pu.kind === "bomb") p.maxBombs += 1;
  else if (pu.kind === "flame") p.flameRange += 1;
  else if (pu.kind === "speed") p.speed = Math.min(MAX_SPEED, p.speed + 1);
  else if (pu.kind === "kick") p.canKick = true;
  else if (pu.kind === "life") p.lives = Math.min(MAX_LIVES, p.lives + 1);

  game.emit({
    type: "powerup_taken",
    x: pu.x,
    y: pu.y,
    kind: pu.kind,
    playerId: p.id,
    stats: statsOf(p),
  });
}

function kickBomb(game, bomb, dir) {
  if (bomb.slideDir || bomb.exploded) return;
  const [tx, ty] = step(bomb.x, bomb.y, dir);
  if (!slideOpen(game, tx, ty)) return;
  bomb.slideDir = dir;
  slideStep(game, bomb);
}

function slideOpen(game, x, y) {
  if (!inBounds(game, x, y)) return false;
  if (game.tiles[y][x] !== EMPTY) return false;
  if (bombAt(game, x, y)) return false;
  return !game.players.some(
    (p) =>
      p.alive &&
      ((p.cellX === x && p.cellY === y) || (p.moving && p.nextX === x && p.nextY === y))
  );
}

function slideStep(game, bomb) {
  bomb.slideTimer = null;
  if (bomb.exploded || game.over) return;

  const [nx, ny] = step(bomb.x, bomb.y, bomb.slideDir);
  if (!slideOpen(game, nx, ny)) {
    bomb.slideDir = null;
    return;
  }

  const fromX = bomb.x;
  const fromY = bomb.y;
  bomb.x = nx;
  bomb.y = ny;
  game.emit({
    type: "bomb_move",
    id: bomb.id,
    fromX,
    fromY,
    toX: nx,
    toY: ny,
    duration: KICK_STEP_MS,
  });
  bomb.slideTimer = setTimeout(() => slideStep(game, bomb), KICK_STEP_MS);
}

function placeBomb(game, id) {
  const p = getPlayer(game, id);
  if (!p || game.over) return;
  if (p.ghost) return placeSpiritBomb(game, p);
  if (!p.alive) return;
  if (p.activeBombs >= p.maxBombs) return;

  const x = p.cellX;
  const y = p.cellY;
  if (bombAt(game, x, y)) return;

  const bomb = makeBomb(game, x, y, p.id, p.flameRange, false);
  p.activeBombs += 1;
  bomb.timer = setTimeout(() => explode(game, bomb), FUSE_MS);
  game.emit({
    type: "bomb_placed",
    id: bomb.id,
    x,
    y,
    ownerId: p.id,
    fuse: FUSE_MS,
    spirit: false,
  });
}

function placeSpiritBomb(game, p) {
  const now = Date.now();
  if (now < p.spiritReadyAt) return;

  const x = p.cellX;
  const y = p.cellY;
  if (!inBounds(game, x, y) || game.tiles[y][x] !== EMPTY) return;
  if (bombAt(game, x, y)) return;

  p.spiritReadyAt = now + SPIRIT_COOLDOWN_MS;
  const bomb = makeBomb(game, x, y, p.id, 1, true);
  bomb.timer = setTimeout(() => explode(game, bomb), SPIRIT_FUSE_MS);
  game.emit({
    type: "bomb_placed",
    id: bomb.id,
    x,
    y,
    ownerId: p.id,
    fuse: SPIRIT_FUSE_MS,
    spirit: true,
    cooldown: SPIRIT_COOLDOWN_MS,
  });
}

function makeBomb(game, x, y, ownerId, range, spirit) {
  const bomb = {
    id: game.nextBombId++,
    x,
    y,
    ownerId,
    range,
    spirit,
    exploded: false,
    timer: null,
    slideDir: null,
    slideTimer: null,
  };
  game.bombs.push(bomb);
  return bomb;
}

function explode(game, bomb) {
  if (bomb.exploded || game.over) return;

  const explodedIds = [];
  const flame = new Map();
  const destroyed = [];
  const queue = [bomb];
  const seen = new Set([bomb.id]);

  const addFlame = (x, y, ownerId) => {
    const key = x + "," + y;
    let cell = flame.get(key);
    if (!cell) {
      cell = { x, y, owners: new Set() };
      flame.set(key, cell);
    }
    cell.owners.add(ownerId);
  };

  while (queue.length) {
    const b = queue.shift();
    if (b.exploded) continue;
    b.exploded = true;
    explodedIds.push(b.id);
    if (b.timer) clearTimeout(b.timer);
    if (b.slideTimer) clearTimeout(b.slideTimer);
    b.slideDir = null;
    b.slideTimer = null;
    game.bombs = game.bombs.filter((x) => x !== b);
    if (!b.spirit) {
      const owner = getPlayer(game, b.ownerId);
      if (owner) owner.activeBombs = Math.max(0, owner.activeBombs - 1);
    }

    addFlame(b.x, b.y, b.ownerId);

    for (const dir of ["up", "down", "left", "right"]) {
      for (let r = 1; r <= b.range; r++) {
        const [x, y] = step2(b.x, b.y, dir, r);
        if (!inBounds(game, x, y)) break;
        const t = game.tiles[y][x];
        if (t === WALL) break;

        const other = game.bombs.find(
          (bb) => bb.x === x && bb.y === y && !seen.has(bb.id)
        );
        if (other) {
          seen.add(other.id);
          queue.push(other);
        }

        if (t === BLOCK) {
          addFlame(x, y, b.ownerId);
          destroyed.push({ x, y });
          break;
        }
        addFlame(x, y, b.ownerId);
      }
    }
  }

  const powerups = [];
  for (const { x, y } of destroyed) {
    game.tiles[y][x] = EMPTY;
    if (Math.random() < POWERUP_CHANCE) {
      const kind = randomKind();
      game.powerups.push({ x, y, kind });
      powerups.push({ x, y, kind });
    }
  }

  const now = Date.now();
  const hits = [];
  for (const p of game.players) {
    if (!p.alive || p.ghost || p.gone) continue;
    const cell = flame.get(p.cellX + "," + p.cellY);
    if (!cell) continue;
    if (now < p.invulnUntil) continue;

    let hostile = false;
    for (const ownerId of cell.owners) {
      if (!friendlyFlame(game, ownerId, p)) {
        hostile = true;
        break;
      }
    }
    if (!hostile) continue;

    p.lives -= 1;
    const hit = { id: p.id, lives: Math.max(0, p.lives), alive: true, ghost: false, invulnMs: 0 };

    if (p.lives <= 0) {
      const drop = becomeGhost(game, p);
      if (drop) powerups.push(drop);
      hit.alive = false;
      hit.ghost = true;
      hit.spiritCooldown = SPIRIT_COOLDOWN_MS;
    } else {
      p.invulnUntil = now + INVULN_MS;
      hit.invulnMs = INVULN_MS;
    }
    hits.push(hit);
  }

  game.emit({
    type: "explosion",
    bombs: explodedIds,
    cells: Array.from(flame.values()).map((c) => ({ x: c.x, y: c.y })),
    destroyed,
    powerups,
    hits,
    duration: FLAME_MS,
  });

  checkGameOver(game);
}

function becomeGhost(game, p) {
  p.alive = false;
  p.ghost = true;
  p.lives = 0;
  p.speed = GHOST_SPEED;
  p.desiredDir = null;
  p.spiritReadyAt = Date.now() + SPIRIT_COOLDOWN_MS;
  return dropOnDeath(game, p);
}

function dropOnDeath(game, p) {
  const x = p.cellX;
  const y = p.cellY;
  if (!inBounds(game, x, y) || game.tiles[y][x] !== EMPTY) return null;
  if (bombAt(game, x, y)) return null;
  if (game.powerups.some((pu) => pu.x === x && pu.y === y)) return null;

  const kind = randomKind();
  game.powerups.push({ x, y, kind });
  return { x, y, kind };
}

function killPlayer(game, id) {
  const p = getPlayer(game, id);
  if (!p || p.gone) return;
  p.alive = false;
  p.ghost = false;
  p.gone = true;
  p.desiredDir = null;
  if (p.moveTimer) {
    clearTimeout(p.moveTimer);
    p.moveTimer = null;
  }
  p.moving = false;
  game.emit({ type: "player_dead", id: p.id, ghost: false });
  checkGameOver(game);
}

function checkGameOver(game) {
  if (game.over) return;
  const alive = game.players.filter((p) => p.alive);
  const sides = new Set(alive.map((p) => sideOf(game, p)));
  if (sides.size > 1) return;

  game.over = true;
  stopTimers(game);

  const winner = alive.length === 1 ? { id: alive[0].id, nickname: alive[0].nickname } : null;
  let team = null;
  if (game.teamMode && alive.length) {
    const t = TEAMS[alive[0].team];
    team = {
      id: t.id,
      name: t.name,
      color: t.color,
      members: game.players
        .filter((p) => p.team === t.id)
        .map((p) => ({ id: p.id, nickname: p.nickname, bot: p.bot })),
    };
  }

  game.emit({ type: "game_over", mode: game.mode, winner, team });
}

function stopTimers(game) {
  for (const p of game.players) {
    if (p.moveTimer) {
      clearTimeout(p.moveTimer);
      p.moveTimer = null;
    }
  }
  for (const b of game.bombs) {
    if (b.timer) clearTimeout(b.timer);
    if (b.slideTimer) clearTimeout(b.slideTimer);
  }
  game.bombs = [];
  if (game.loop) {
    clearInterval(game.loop);
    game.loop = null;
  }
}

function stopGame(game) {
  game.over = true;
  stopTimers(game);
}

module.exports = {
  createGame,
  startLoop,
  startPayload,
  setInput,
  placeBomb,
  killPlayer,
  stopGame,
  TEAMS,
};
