const { describe, test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert");
const game = require("../game.js");

const EMPTY = 0;
const WALL = 1;
const BLOCK = 2;

const FUSE_MS = 2500;

function seats(n, teams) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    nickname: "P" + (i + 1),
    bot: false,
    team: teams ? i % 2 : null,
  }));
}

function newGame(n, mode, teams) {
  const g = game.createGame(seats(n, teams), mode || "versus");
  g.events = [];
  g.emit = (m) => g.events.push(m);
  return g;
}

function clearInterior(g) {
  for (let y = 1; y < g.height - 1; y++) {
    for (let x = 1; x < g.width - 1; x++) {
      if (g.tiles[y][x] === BLOCK) g.tiles[y][x] = EMPTY;
    }
  }
}

function place(p, x, y) {
  p.cellX = x;
  p.cellY = y;
}

function of(g, type) {
  return g.events.filter((m) => m.type === type);
}

function hitOn(g, id) {
  for (const e of of(g, "explosion")) {
    const hit = (e.hits || []).find((h) => h.id === id);
    if (hit) return hit;
  }
  return null;
}

describe("game.js", () => {
  let realRandom;

  beforeEach(() => {
    realRandom = Math.random;
    Math.random = () => 1;
    mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  });

  afterEach(() => {
    Math.random = realRandom;
    mock.timers.reset();
  });

  test("every corner start can escape its own bomb on both axes", () => {
    for (let i = 0; i < 20; i++) {
      Math.random = realRandom;
      const g = game.createGame(seats(4), "versus");
      for (const p of g.players) {
        const dx = p.cellX === 1 ? 1 : -1;
        const dy = p.cellY === 1 ? 1 : -1;
        const routes = [
          [[p.cellX + dx, p.cellY], [p.cellX + 2 * dx, p.cellY]],
          [[p.cellX, p.cellY + dy], [p.cellX, p.cellY + 2 * dy]],
        ];
        for (const [[sx, sy], [ex, ey]] of routes) {
          assert.equal(
            g.tiles[sy][sx],
            EMPTY,
            `player ${p.id} at (${p.cellX},${p.cellY}): step tile (${sx},${sy}) is blocked`
          );
          assert.equal(
            g.tiles[ey][ex],
            EMPTY,
            `player ${p.id} at (${p.cellX},${p.cellY}): escape tile (${ex},${ey}) is blocked`
          );
        }
      }
      game.stopGame(g);
    }
  });

  test("a player loses exactly one life to their own bomb", () => {
    const g = newGame(2);
    clearInterior(g);
    place(g.players[1], 13, 11);

    game.placeBomb(g, 1);
    mock.timers.tick(FUSE_MS + 100);

    const hit = hitOn(g, 1);
    assert.ok(hit, "the bomb owner was not hit by their own blast");
    assert.equal(hit.lives, 2);
    assert.equal(hit.alive, true);
    game.stopGame(g);
  });

  test("a bystander outside the blast is untouched", () => {
    const g = newGame(2);
    clearInterior(g);
    place(g.players[1], 8, 7);

    game.placeBomb(g, 1);
    mock.timers.tick(FUSE_MS + 100);

    assert.equal(hitOn(g, 2), null);
    game.stopGame(g);
  });

  test("a blast destroys a neighbouring block and clears it from the grid", () => {
    const g = newGame(1);
    clearInterior(g);
    g.tiles[1][2] = BLOCK;

    game.placeBomb(g, 1);
    mock.timers.tick(FUSE_MS + 100);

    const boom = of(g, "explosion")[0];
    assert.deepEqual(boom.destroyed, [{ x: 2, y: 1 }]);
    assert.equal(g.tiles[1][2], EMPTY);
    game.stopGame(g);
  });

  test("a chain whose arms converge never stacks two power-ups on one tile", () => {
    Math.random = () => 0;
    const g = newGame(2);
    clearInterior(g);
    g.tiles[5][1] = BLOCK;

    const [a, b] = g.players;
    place(a, 1, 1);
    place(b, 1, 3);
    a.flameRange = 4;
    b.flameRange = 4;

    game.placeBomb(g, 1);
    game.placeBomb(g, 2);
    mock.timers.tick(FUSE_MS + 100);

    const drops = of(g, "explosion").flatMap((m) => m.powerups || []);
    const keys = drops.map((p) => p.x + "," + p.y);
    assert.equal(new Set(keys).size, keys.length, "two power-ups landed on one tile");
    assert.equal(g.powerups.length, new Set(g.powerups.map((p) => p.x + "," + p.y)).size);
    game.stopGame(g);
  });

  test("a player caught mid-step is hit by the tile they are entering", () => {
    const g = newGame(2);
    clearInterior(g);

    const [a, bomber] = g.players;
    place(a, 2, 1);
    a.speed = 1;
    place(bomber, 4, 1);
    bomber.flameRange = 1;

    game.placeBomb(g, 2);
    place(bomber, 10, 11);

    mock.timers.tick(2000);
    game.setInput(g, 1, "right");
    assert.equal(a.moving, true);
    assert.equal(a.cellX, 2, "the step should still be in flight");

    mock.timers.tick(600);

    const hit = hitOn(g, 1);
    assert.ok(hit, "a player rendered inside the flame survived it");
    assert.equal(hit.lives, 2);
    game.stopGame(g);
  });

  test("a player mid-step away from the blast is still hit on the tile they are leaving", () => {
    const g = newGame(2);
    clearInterior(g);

    const [a, bomber] = g.players;
    place(a, 3, 1);
    a.speed = 1;
    place(bomber, 4, 1);
    bomber.flameRange = 1;

    game.placeBomb(g, 2);
    place(bomber, 10, 11);

    mock.timers.tick(2000);
    game.setInput(g, 1, "left");
    mock.timers.tick(600);

    assert.ok(hitOn(g, 1), "leaving a doomed tile should not dodge the blast");
    game.stopGame(g);
  });

  test("three own bombs turn a player into a ghost", () => {
    const g = newGame(2);
    clearInterior(g);
    place(g.players[1], 13, 11);

    for (let i = 0; i < 3; i++) {
      game.placeBomb(g, 1);
      mock.timers.tick(FUSE_MS + 100);
      mock.timers.tick(2000);
    }

    const p = g.players[0];
    assert.equal(p.lives, 0);
    assert.equal(p.alive, false);
    assert.equal(p.ghost, true);
    game.stopGame(g);
  });

  test("a power-up applies its stat when walked over", () => {
    const g = newGame(1);
    clearInterior(g);
    const p = g.players[0];
    const before = p.flameRange;
    g.powerups.push({ x: 2, y: 1, kind: "flame" });

    game.setInput(g, 1, "right");
    mock.timers.tick(1000 / p.speed + 50);

    assert.equal(p.cellX, 2);
    assert.equal(p.flameRange, before + 1);
    assert.equal(g.powerups.length, 0);
    assert.equal(of(g, "powerup_taken").length, 1);
    game.stopGame(g);
  });

  test("teammates do not damage each other", () => {
    const g = newGame(2, "teams", true);
    clearInterior(g);
    const [a, b] = g.players;
    assert.equal(a.team, b.team === 0 ? 1 : 0, "the two seats should be on opposite teams");

    b.team = a.team;
    place(a, 1, 1);
    place(b, 2, 1);

    game.placeBomb(g, 1);
    mock.timers.tick(FUSE_MS + 100);

    assert.equal(hitOn(g, 2), null, "a teammate took friendly fire");
    game.stopGame(g);
  });

  test("the last side standing wins", () => {
    const g = newGame(2);
    clearInterior(g);

    game.killPlayer(g, 2);

    const over = of(g, "game_over");
    assert.equal(over.length, 1);
    assert.equal(over[0].winner.id, 1);
    assert.equal(g.over, true);
    game.stopGame(g);
  });

  test("two players killed by the same blast is a draw, not a hang", () => {
    const g = newGame(2);
    clearInterior(g);

    const [a, b] = g.players;
    place(a, 1, 1);
    place(b, 2, 1);
    a.lives = 1;
    b.lives = 1;

    game.placeBomb(g, 1);
    mock.timers.tick(FUSE_MS + 100);

    assert.equal(a.alive, false);
    assert.equal(b.alive, false);

    const over = of(g, "game_over");
    assert.equal(over.length, 1);
    assert.equal(over[0].winner, null);
    assert.equal(g.over, true);
    game.stopGame(g);
  });

  test("a ghost is excluded from the win condition", () => {
    const g = newGame(3);
    clearInterior(g);
    place(g.players[1], 13, 1);
    place(g.players[2], 1, 11);

    for (let i = 0; i < 3; i++) {
      game.placeBomb(g, 1);
      mock.timers.tick(FUSE_MS + 100);
      mock.timers.tick(2000);
    }

    assert.equal(g.players[0].ghost, true);
    assert.equal(g.over, false, "two living players remain, so the round must continue");

    game.killPlayer(g, 3);
    assert.equal(of(g, "game_over")[0].winner.id, 2);
    game.stopGame(g);
  });
});
