const WALL = 1;
const BLOCK = 2;

const DIRS = ["up", "down", "left", "right"];

function step(x, y, dir, r) {
  const n = r || 1;
  if (dir === "up") return [x, y - n];
  if (dir === "down") return [x, y + n];
  if (dir === "left") return [x - n, y];
  return [x + n, y];
}

function inside(game, x, y) {
  return x >= 0 && y >= 0 && x < game.width && y < game.height;
}

function free(game, x, y) {
  if (!inside(game, x, y)) return false;
  const t = game.tiles[y][x];
  if (t === WALL || t === BLOCK) return false;
  return !game.bombs.some((b) => b.x === x && b.y === y);
}

function friendly(game, a, b) {
  return game.teamMode && a.team === b.team;
}

function shuffled() {
  const d = DIRS.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = d[i];
    d[i] = d[j];
    d[j] = t;
  }
  return d;
}

function blastMap(game, extra) {
  const bombs = extra ? game.bombs.concat([extra]) : game.bombs;
  const set = new Set();
  for (const b of bombs) {
    set.add(b.x + "," + b.y);
    for (const dir of DIRS) {
      for (let r = 1; r <= b.range; r++) {
        const [x, y] = step(b.x, b.y, dir, r);
        if (!inside(game, x, y)) break;
        const t = game.tiles[y][x];
        if (t === WALL) break;
        set.add(x + "," + y);
        if (t === BLOCK) break;
      }
    }
  }
  return set;
}

function flood(game, sx, sy, passable) {
  const seen = new Map();
  const order = [];
  const queue = [[sx, sy]];
  const dirs = shuffled();
  seen.set(sx + "," + sy, null);

  while (queue.length) {
    const [x, y] = queue.shift();
    const rootDir = seen.get(x + "," + y);
    order.push([x, y]);
    for (const dir of dirs) {
      const [nx, ny] = step(x, y, dir);
      const key = nx + "," + ny;
      if (seen.has(key) || !passable(nx, ny)) continue;
      seen.set(key, rootDir || dir);
      queue.push([nx, ny]);
    }
  }
  return { seen, order };
}

function think(game, bot, act) {
  if (bot.ghost) return haunt(game, bot, act);
  if (!bot.alive || game.over) return;

  const x = bot.moving ? bot.nextX : bot.cellX;
  const y = bot.moving ? bot.nextY : bot.cellY;
  const danger = blastMap(game);
  const safeHere = !danger.has(x + "," + y);

  if (!safeHere) {
    const dir = fleeDir(game, x, y, danger);
    act.move(dir || bot.desiredDir);
    return;
  }

  if (hasSpareBomb(game, bot, x, y) && worthBombing(game, bot, x, y)) {
    if (bot.moving) {
      act.move(null);
      return;
    }
    const escape = escapeDir(game, bot, x, y);
    if (escape) {
      act.bomb();
      act.move(escape);
      return;
    }
  }

  act.move(hunt(game, bot, x, y, danger));
}

function fleeDir(game, x, y, danger) {
  const { seen, order } = flood(game, x, y, (cx, cy) => free(game, cx, cy));
  for (const [cx, cy] of order) {
    if (danger.has(cx + "," + cy)) continue;
    const dir = seen.get(cx + "," + cy);
    if (dir) return dir;
  }
  return null;
}

function hasSpareBomb(game, bot, x, y) {
  if (bot.activeBombs >= bot.maxBombs) return false;
  return !game.bombs.some((b) => b.x === x && b.y === y);
}

function worthBombing(game, bot, x, y) {
  for (const dir of DIRS) {
    for (let r = 1; r <= bot.flameRange; r++) {
      const [cx, cy] = step(x, y, dir, r);
      if (!inside(game, cx, cy)) break;
      const t = game.tiles[cy][cx];
      if (t === WALL) break;
      if (t === BLOCK) return true;
      const target = game.players.find(
        (o) =>
          o.alive &&
          o !== bot &&
          o.cellX === cx &&
          o.cellY === cy &&
          !friendly(game, bot, o)
      );
      if (target) return true;
    }
  }
  return false;
}

function escapeDir(game, bot, x, y) {
  const danger = blastMap(game, { x, y, range: bot.flameRange });
  const { seen, order } = flood(game, x, y, (cx, cy) => free(game, cx, cy));
  for (const [cx, cy] of order) {
    if (danger.has(cx + "," + cy)) continue;
    const dir = seen.get(cx + "," + cy);
    if (dir) return dir;
  }
  return null;
}

function hunt(game, bot, x, y, danger) {
  const { seen, order } = flood(
    game,
    x,
    y,
    (cx, cy) => free(game, cx, cy) && !danger.has(cx + "," + cy)
  );

  let powerupDir = null;
  let enemyDir = null;
  let blockDir = null;

  for (const [cx, cy] of order) {
    const dir = seen.get(cx + "," + cy);
    if (!dir) continue;
    if (!powerupDir && game.powerups.some((pu) => pu.x === cx && pu.y === cy)) {
      powerupDir = dir;
      break;
    }
    if (!enemyDir && nearEnemy(game, bot, cx, cy)) enemyDir = dir;
    if (!blockDir && nextToBlock(game, cx, cy)) blockDir = dir;
  }

  return powerupDir || enemyDir || blockDir || wander(game, x, y);
}

function nearEnemy(game, bot, x, y) {
  return game.players.some(
    (o) =>
      o.alive &&
      o !== bot &&
      !friendly(game, bot, o) &&
      Math.abs(o.cellX - x) + Math.abs(o.cellY - y) <= 2
  );
}

function nextToBlock(game, x, y) {
  for (const dir of DIRS) {
    const [cx, cy] = step(x, y, dir);
    if (inside(game, cx, cy) && game.tiles[cy][cx] === BLOCK) return true;
  }
  return false;
}

function wander(game, x, y) {
  for (const dir of shuffled()) {
    const [cx, cy] = step(x, y, dir);
    if (free(game, cx, cy)) return dir;
  }
  return null;
}

function haunt(game, bot, act) {
  const x = bot.moving ? bot.nextX : bot.cellX;
  const y = bot.moving ? bot.nextY : bot.cellY;

  let target = null;
  let best = Infinity;
  for (const o of game.players) {
    if (!o.alive || friendly(game, bot, o)) continue;
    const d = Math.abs(o.cellX - x) + Math.abs(o.cellY - y);
    if (d < best) {
      best = d;
      target = o;
    }
  }
  if (!target) {
    act.move(null);
    return;
  }

  if (!bot.moving && best <= 1) act.bomb();

  const dx = target.cellX - x;
  const dy = target.cellY - y;
  let dir = null;
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) dir = dx > 0 ? "right" : "left";
  else if (dy !== 0) dir = dy > 0 ? "down" : "up";
  act.move(dir);
}

module.exports = { think };
