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

const PUBLIC = new Set(["index.html", "client", "framework"]);

function servable(filePath) {
  const rel = path.relative(ROOT, filePath);
  if (!rel || rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel)) {
    return false;
  }
  return PUBLIC.has(rel.split(path.sep)[0]);
}

function fail(res, code, message) {
  res.writeHead(code, {
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(message);
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split("?")[0]);
  } catch {
    fail(res, 400, "Bad request");
    return;
  }
  if (urlPath.endsWith("/")) urlPath += "index.html";

  const filePath = path.resolve(ROOT, "." + urlPath);
  if (!servable(filePath)) {
    fail(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === "ENOENT" || err.code === "EISDIR") {
        fail(res, 404, "Not found");
      } else {
        console.error("read failed for", filePath, "-", err.code);
        fail(res, 500, "Internal server error");
      }
      return;
    }
    const type = MIME[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
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

const CHAT_BURST = 5;
const CHAT_REFILL_MS = 700;

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
      connectedCount(r) < MODES[mode].maxHumans
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

  const seatList = buildSeats(room);
  const game = gameLogic.createGame(seatList, room.mode);
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
  room.players = room.players.filter((p) => p.connected);
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

wss.on("error", (err) => console.error("websocket server error:", err.message));

wss.on("connection", (ws) => {
  ws.player = null;
  ws.room = null;

  ws.on("error", (err) => {
    console.error("socket error:", err.message);
    ws.close();
  });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== "string") return;

    try {
      if (msg.type === "join") handleJoin(ws, msg);
      else if (msg.type === "chat") handleChat(ws, msg);
      else if (msg.type === "input") handleInput(ws, msg);
      else if (msg.type === "bomb") handleBomb(ws);
      else if (msg.type === "leave") handleQuit(ws);
      else if (msg.type === "rematch") handleRematch(ws);
    } catch (err) {
      console.error("bad message:", msg.type, "-", err && err.message);
    }
  });

  ws.on("close", () => handleLeave(ws));
});

function handleJoin(ws, msg) {
  if (ws.player) return;
  const nickname =
    typeof msg.nickname === "string" ? msg.nickname.trim().slice(0, 16) : "";
  if (!nickname) {
    send(ws, { type: "error", message: "Please enter a nickname." });
    return;
  }

  const mode =
    typeof msg.mode === "string" && Object.hasOwn(MODES, msg.mode) ? msg.mode : "versus";
  const room = openRoom(mode);
  const player = {
    id: nextPlayerId++,
    nickname,
    ws,
    connected: true,
    rematch: false,
    chatTokens: CHAT_BURST,
    chatStamp: Date.now(),
  };
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
  const text = typeof msg.text === "string" ? msg.text.trim().slice(0, 300) : "";
  if (!text) return;
  if (!allowChat(player)) return;
  broadcast(room, {
    type: "chat",
    from: player.id,
    nickname: player.nickname,
    text,
    ts: Date.now(),
  });
}

function allowChat(player) {
  const now = Date.now();
  const elapsed = now - (player.chatStamp || 0);
  const tokens = Math.min(CHAT_BURST, player.chatTokens + elapsed / CHAT_REFILL_MS);
  player.chatStamp = now;
  if (tokens < 1) {
    player.chatTokens = tokens;
    return false;
  }
  player.chatTokens = tokens - 1;
  return true;
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

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`port ${PORT} is already in use — set PORT to something else`);
  } else {
    console.error("http server error:", err.message);
  }
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("unhandled rejection:", err && err.message);
});

process.on("uncaughtException", (err) => {
  console.error("uncaught exception (server kept alive):", err && err.stack);
});

server.listen(PORT, () => {
  console.log(`bomberman-dom running at http://localhost:${PORT}`);
});
