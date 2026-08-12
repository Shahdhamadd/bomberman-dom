const WIDTH = 15;
const HEIGHT = 13;

const EMPTY = 0;
const WALL = 1;
const BLOCK = 2;

const LIVES = 3;
const BASE_SPEED = 4;
const MAX_SPEED = 8;
const START_BOMBS = 1;
const START_RANGE = 1;

const FUSE_MS = 2500;
const FLAME_MS = 500;
const INVULN_MS = 1500;

const BLOCK_DENSITY = 0.62;
const POWERUP_CHANCE = 0.4;

const CORNERS = [
  [1, 1],
  [WIDTH - 2, 1],
  [1, HEIGHT - 2],
  [WIDTH - 2, HEIGHT - 2],
];
const COLORS = ["#ff5b5b", "#4aa3ff", "#3ddc84", "#ffcf3f"];
const KINDS = ["bomb", "flame", "speed"];

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

function createGame(members) {
  const players = members.map((m, i) => ({
    id: m.id,
    nickname: m.nickname,
    color: COLORS[i % COLORS.length],
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
    activeBombs: 0,
    lives: LIVES,
    alive: true,
    invulnUntil: 0,
  }));

  return {
    width: WIDTH,
    height: HEIGHT,
    tiles: generateTiles(),
    players,
    bombs: [],
    powerups: [],
    nextBombId: 1,
    over: false,
    emit: () => {},
  };
}

function startPayload(game) {
  return {
    type: "game_start",
    width: game.width,
    height: game.height,
    tiles: game.tiles,
    players: game.players.map(publicPlayer),
  };
}

function publicPlayer(p) {
  return {
    id: p.id,
    nickname: p.nickname,
    color: p.color,
    cellX: p.cellX,
    cellY: p.cellY,
    lives: p.lives,
    alive: p.alive,
    maxBombs: p.maxBombs,
    flameRange: p.flameRange,
    speed: p.speed,
  };
}

function statsOf(p) {
  return { maxBombs: p.maxBombs, flameRange: p.flameRange, speed: p.speed };
}

function getPlayer(game, id) {
  return game.players.find((p) => p.id === id);
}

function step(x, y, dir) {
  if (dir === "up") return [x, y - 1];
  if (dir === "down") return [x, y + 1];
  if (dir === "left") return [x - 1, y];
  if (dir === "right") return [x + 1, y];
  return [x, y];
}

function walkable(game, x, y) {
  if (x < 0 || y < 0 || x >= game.width || y >= game.height) return false;
  const t = game.tiles[y][x];
  if (t === WALL || t === BLOCK) return false;
  if (game.bombs.some((b) => b.x === x && b.y === y)) return false;
  return true;
}

function setInput(game, id, dir) {
  const p = getPlayer(game, id);
  if (!p || !p.alive || game.over) return;
  p.desiredDir =
    dir === "up" || dir === "down" || dir === "left" || dir === "right" ? dir : null;
  if (!p.moving) startMove(game, p);
}

function startMove(game, p) {
  if (p.moving || !p.alive || game.over || !p.desiredDir) return;
  const [nx, ny] = step(p.cellX, p.cellY, p.desiredDir);
  if (!walkable(game, nx, ny)) return;

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
  if (game.over || !p.alive) return;
  pickup(game, p);
  startMove(game, p);
}

function pickup(game, p) {
  const i = game.powerups.findIndex((pu) => pu.x === p.cellX && pu.y === p.cellY);
  if (i === -1) return;
  const pu = game.powerups[i];
  game.powerups.splice(i, 1);
  if (pu.kind === "bomb") p.maxBombs += 1;
  else if (pu.kind === "flame") p.flameRange += 1;
  else if (pu.kind === "speed") p.speed = Math.min(MAX_SPEED, p.speed + 1);
  game.emit({ type: "powerup_taken", x: pu.x, y: pu.y, playerId: p.id, stats: statsOf(p) });
}

function placeBomb(game, id) {
  const p = getPlayer(game, id);
  if (!p || !p.alive || game.over) return;
  if (p.activeBombs >= p.maxBombs) return;

  const x = p.cellX;
  const y = p.cellY;
  if (game.bombs.some((b) => b.x === x && b.y === y)) return;

  const bomb = {
    id: game.nextBombId++,
    x,
    y,
    ownerId: p.id,
    range: p.flameRange,
    exploded: false,
    timer: null,
  };
  game.bombs.push(bomb);
  p.activeBombs += 1;
  bomb.timer = setTimeout(() => explode(game, bomb), FUSE_MS);
  game.emit({ type: "bomb_placed", id: bomb.id, x, y, ownerId: p.id, fuse: FUSE_MS });
}

function explode(game, bomb) {
  if (bomb.exploded || game.over) return;

  const explodedIds = [];
  const flame = new Map();
  const destroyed = [];
  const queue = [bomb];
  const seen = new Set([bomb.id]);
  const addFlame = (x, y) => flame.set(x + "," + y, { x, y });

  while (queue.length) {
    const b = queue.shift();
    if (b.exploded) continue;
    b.exploded = true;
    explodedIds.push(b.id);
    if (b.timer) clearTimeout(b.timer);
    game.bombs = game.bombs.filter((x) => x !== b);
    const owner = getPlayer(game, b.ownerId);
    if (owner) owner.activeBombs = Math.max(0, owner.activeBombs - 1);

    addFlame(b.x, b.y);

    for (const dir of ["up", "down", "left", "right"]) {
      for (let r = 1; r <= b.range; r++) {
        const [x, y] = step2(b.x, b.y, dir, r);
        if (x < 0 || y < 0 || x >= game.width || y >= game.height) break;
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
          addFlame(x, y);
          destroyed.push({ x, y });
          break;
        }
        addFlame(x, y);
      }
    }
  }

  const powerups = [];
  for (const { x, y } of destroyed) {
    game.tiles[y][x] = EMPTY;
    if (Math.random() < POWERUP_CHANCE) {
      const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
      game.powerups.push({ x, y, kind });
      powerups.push({ x, y, kind });
    }
  }

  const now = Date.now();
  const hits = [];
  for (const p of game.players) {
    if (!p.alive) continue;
    if (!flame.has(p.cellX + "," + p.cellY)) continue;
    if (now < p.invulnUntil) continue;
    p.lives -= 1;
    if (p.lives <= 0) {
      p.alive = false;
      if (p.moveTimer) {
        clearTimeout(p.moveTimer);
        p.moveTimer = null;
      }
    } else {
      p.invulnUntil = now + INVULN_MS;
    }
    hits.push({ id: p.id, lives: p.lives, alive: p.alive, invulnMs: p.alive ? INVULN_MS : 0 });
  }

  game.emit({
    type: "explosion",
    bombs: explodedIds,
    cells: Array.from(flame.values()),
    destroyed,
    powerups,
    hits,
    duration: FLAME_MS,
  });

  checkGameOver(game);
}

function step2(x, y, dir, r) {
  if (dir === "up") return [x, y - r];
  if (dir === "down") return [x, y + r];
  if (dir === "left") return [x - r, y];
  return [x + r, y];
}

function killPlayer(game, id) {
  const p = getPlayer(game, id);
  if (!p || !p.alive) return;
  p.alive = false;
  if (p.moveTimer) {
    clearTimeout(p.moveTimer);
    p.moveTimer = null;
  }
  game.emit({ type: "player_dead", id: p.id });
  checkGameOver(game);
}

function checkGameOver(game) {
  if (game.over) return;
  const alive = game.players.filter((p) => p.alive);
  if (alive.length > 1) return;

  game.over = true;
  for (const p of game.players) if (p.moveTimer) clearTimeout(p.moveTimer);
  for (const b of game.bombs) if (b.timer) clearTimeout(b.timer);
  game.bombs = [];
  const winner = alive[0] ? { id: alive[0].id, nickname: alive[0].nickname } : null;
  game.emit({ type: "game_over", winner });
}

function stopGame(game) {
  for (const p of game.players) if (p.moveTimer) clearTimeout(p.moveTimer);
  for (const b of game.bombs) if (b.timer) clearTimeout(b.timer);
  game.bombs = [];
  game.over = true;
}

module.exports = { createGame, startPayload, setInput, placeBomb, killPlayer, stopGame };
