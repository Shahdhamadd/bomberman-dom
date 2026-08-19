const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer, WebSocket } = require("ws");
const gameLogic = require("./game.js");

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath.endsWith("/")) urlPath += "index.html";

  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found: " + urlPath);
      return;
    }
    const type = MIME[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    res.end(data);
  });
});

const WAIT_SECONDS = 20;
const COUNTDOWN_SECONDS = 10;
const SEATS = 4;

const MODES = {
  versus: { label: "Versus", minHumans: 2, maxHumans: 4, fill: false, teams: false, instant: false },
  teams: { label: "Teams", minHumans: 2, maxHumans: 4, fill: true, teams: true, instant: false },
  coop: { label: "Co-op vs AI", minHumans: 2, maxHumans: 3, fill: true, teams: true, instant: false },
  solo: { label: "Solo vs AI", minHumans: 1, maxHumans: 1, fill: true, teams: true, instant: true },
};

const BOT_NAMES = ["Bombot", "Sparky", "Fuse", "Blastr"];

let nextPlayerId = 1;
const rooms = [];

function createRoom(mode) {
  const room = {
    mode,
    players: [],
    phase: "waiting",
    secondsLeft: null,
    timer: null,
    started: false,
    game: null,
  };
  rooms.push(room);
  return room;
}

function openRoom(mode) {
  if (MODES[mode].instant) return createRoom(mode);
  const room = rooms.find(
    (r) =>
      r.mode === mode &&
      !r.started &&
      r.phase !== "countdown" &&
      r.players.length < MODES[mode].maxHumans
  );
  return room || createRoom(mode);
}

function teamForSeat(room, seat) {
  if (!MODES[room.mode].teams) return null;
  return room.mode === "teams" ? seat % 2 : 0;
}

function buildSeats(room) {
  const cfg = MODES[room.mode];
  const humans = room.players.filter((p) => p.connected);
  const seats = humans.map((p, i) => ({
    id: p.id,
    nickname: p.nickname,
    bot: false,
    team: teamForSeat(room, i),
  }));

  if (!cfg.fill) return seats;

  for (let i = seats.length; i < SEATS; i++) {
    seats.push({
      id: -(i + 1),
      nickname: BOT_NAMES[i % BOT_NAMES.length],
      bot: true,
      team: room.mode === "teams" ? i % 2 : 1,
    });
  }
  return seats;
}

function send(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function broadcast(room, obj) {
  const msg = JSON.stringify(obj);
  for (const p of room.players) {
    if (p.connected && p.ws.readyState === WebSocket.OPEN) p.ws.send(msg);
  }
}

function roster(room) {
  return room.players
    .filter((p) => p.connected)
    .map((p, i) => ({ id: p.id, nickname: p.nickname, team: teamForSeat(room, i) }));
}

function lobbyState(room) {
  const cfg = MODES[room.mode];
  const humans = connectedCount(room);
  return {
    type: "lobby",
    mode: room.mode,
    modeLabel: cfg.label,
    maxHumans: cfg.maxHumans,
    minHumans: cfg.minHumans,
    bots: cfg.fill ? Math.max(0, SEATS - humans) : 0,
    phase: room.phase,
    secondsLeft: room.secondsLeft,
    players: roster(room),
  };
}

function broadcastLobby(room) {
  broadcast(room, lobbyState(room));
}

function clearTimer(room) {
  if (room.timer) {
    clearInterval(room.timer);
    room.timer = null;
  }
}

function connectedCount(room) {
  return room.players.filter((p) => p.connected).length;
}

function evaluate(room) {
  if (room.started) return;
  const cfg = MODES[room.mode];
  const n = connectedCount(room);

  if (cfg.instant) {
    if (n >= cfg.minHumans) startGame(room);
    return;
  }

  if (room.phase === "waiting") {
    if (n >= cfg.minHumans) startFilling(room);
  } else if (room.phase === "filling") {
    if (n >= cfg.maxHumans) startCountdown(room);
    else if (n < cfg.minHumans) backToWaiting(room);
  } else if (room.phase === "countdown") {
    if (n < cfg.minHumans) backToWaiting(room);
  }
}

function startFilling(room) {
  clearTimer(room);
  room.phase = "filling";
  room.secondsLeft = WAIT_SECONDS;
  broadcastLobby(room);
  room.timer = setInterval(() => {
    room.secondsLeft -= 1;
    if (room.secondsLeft <= 0) startCountdown(room);
    else broadcastLobby(room);
  }, 1000);
}

function startCountdown(room) {
  clearTimer(room);
  room.phase = "countdown";
  room.secondsLeft = COUNTDOWN_SECONDS;
  broadcastLobby(room);
  room.timer = setInterval(() => {
    room.secondsLeft -= 1;
    if (room.secondsLeft <= 0) startGame(room);
    else broadcastLobby(room);
  }, 1000);
}

function backToWaiting(room) {
  clearTimer(room);
  room.phase = "waiting";
  room.secondsLeft = null;
  broadcastLobby(room);
}

function startGame(room) {
  clearTimer(room);
  if (room.game) gameLogic.stopGame(room.game);
  for (const p of room.players) p.rematch = false;
  room.started = true;
  room.phase = "playing";
  room.secondsLeft = null;

  const game = gameLogic.createGame(buildSeats(room), room.mode);
  game.emit = (msg) => {
    broadcast(room, msg);
    if (msg.type === "game_over") checkRematch(room);
  };
  room.game = game;
  broadcast(room, gameLogic.startPayload(game));
  gameLogic.startLoop(game);
}

function returnToLobby(room) {
  clearTimer(room);
  if (room.game) gameLogic.stopGame(room.game);
  room.game = null;
  room.started = false;
  room.phase = "waiting";
  room.secondsLeft = null;
  for (const p of room.players) p.rematch = false;
  broadcastLobby(room);
  evaluate(room);
}

function checkRematch(room) {
  if (!room.game || !room.game.over) return;
  const humans = room.players.filter((p) => p.connected);
  if (!humans.length) return;

  const ready = humans.filter((p) => p.rematch).length;
  broadcast(room, { type: "rematch_state", ready, total: humans.length });
  if (ready < humans.length) return;

  if (humans.length >= MODES[room.mode].minHumans) startGame(room);
  else returnToLobby(room);
}

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.player = null;
  ws.room = null;

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === "join") handleJoin(ws, msg);
    else if (msg.type === "chat") handleChat(ws, msg);
    else if (msg.type === "input") handleInput(ws, msg);
    else if (msg.type === "bomb") handleBomb(ws);
    else if (msg.type === "leave") handleQuit(ws);
    else if (msg.type === "rematch") handleRematch(ws);
  });

  ws.on("close", () => handleLeave(ws));
});

function handleJoin(ws, msg) {
  if (ws.player) return;
  const nickname = String(msg.nickname || "").trim().slice(0, 16);
  if (!nickname) {
    send(ws, { type: "error", message: "Please enter a nickname." });
    return;
  }

  const mode = MODES[msg.mode] ? msg.mode : "versus";
  const room = openRoom(mode);
  const player = { id: nextPlayerId++, nickname, ws, connected: true, rematch: false };
  room.players.push(player);
  ws.player = player;
  ws.room = room;

  send(ws, Object.assign(lobbyState(room), { type: "joined", id: player.id }));
  broadcastLobby(room);
  evaluate(room);
}

function handleChat(ws, msg) {
  const player = ws.player;
  const room = ws.room;
  if (!player || !room) return;
  const text = String(msg.text || "").trim().slice(0, 300);
  if (!text) return;
  broadcast(room, {
    type: "chat",
    from: player.id,
    nickname: player.nickname,
    text,
    ts: Date.now(),
  });
}

function handleInput(ws, msg) {
  const room = ws.room;
  if (!room || !room.game || !ws.player) return;
  gameLogic.setInput(room.game, ws.player.id, msg.dir);
}

function handleBomb(ws) {
  const room = ws.room;
  if (!room || !room.game || !ws.player) return;
  gameLogic.placeBomb(room.game, ws.player.id);
}

function handleRematch(ws) {
  const room = ws.room;
  const player = ws.player;
  if (!room || !player) return;
  if (!room.game || !room.game.over) return;
  if (player.rematch) return;
  player.rematch = true;
  checkRematch(room);
}

function handleQuit(ws) {
  const room = ws.room;
  const player = ws.player;
  if (!room || !player) return;

  if (room.game && !room.game.over) gameLogic.killPlayer(room.game, player.id);
  room.players = room.players.filter((p) => p !== player);
  player.connected = false;
  ws.player = null;
  ws.room = null;

  send(ws, { type: "left" });
  releaseRoom(room);
}

function releaseRoom(room) {
  if (!room.players.some((p) => p.connected)) {
    clearTimer(room);
    if (room.game) gameLogic.stopGame(room.game);
    const i = rooms.indexOf(room);
    if (i !== -1) rooms.splice(i, 1);
    return;
  }

  if (room.game && room.game.over) {
    checkRematch(room);
  } else if (!room.game) {
    broadcastLobby(room);
    evaluate(room);
  }
}

function handleLeave(ws) {
  const room = ws.room;
  if (!room) return;
  const player = ws.player;
  if (player) player.connected = false;

  if (room.game && !room.game.over && player) {
    gameLogic.killPlayer(room.game, player.id);
  }

  if (!room.game) {
    room.players = room.players.filter((p) => p !== player);
  }

  ws.player = null;
  ws.room = null;

  releaseRoom(room);
}

server.listen(PORT, () => {
  console.log(`bomberman-dom running at http://localhost:${PORT}`);
});
