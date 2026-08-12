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
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
});

const WAIT_SECONDS = 20;
const COUNTDOWN_SECONDS = 10;
const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;

let nextPlayerId = 1;
let nextRoomId = 1;
const rooms = [];

function createRoom() {
  const room = {
    id: nextRoomId++,
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

function openRoom() {
  const room = rooms.find(
    (r) => !r.started && r.phase !== "countdown" && r.players.length < MAX_PLAYERS
  );
  return room || createRoom();
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

function lobbyState(room) {
  return {
    type: "lobby",
    phase: room.phase,
    secondsLeft: room.secondsLeft,
    players: room.players
      .filter((p) => p.connected)
      .map((p) => ({ id: p.id, nickname: p.nickname })),
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
  const n = connectedCount(room);

  if (room.phase === "waiting") {
    if (n >= MIN_PLAYERS) startFilling(room);
  } else if (room.phase === "filling") {
    if (n >= MAX_PLAYERS) startCountdown(room);
    else if (n < MIN_PLAYERS) backToWaiting(room);
  } else if (room.phase === "countdown") {
    if (n < MIN_PLAYERS) backToWaiting(room);
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
  room.started = true;
  room.phase = "playing";
  room.secondsLeft = null;

  const game = gameLogic.createGame(room.players.filter((p) => p.connected));
  game.emit = (msg) => broadcast(room, msg);
  room.game = game;
  broadcast(room, gameLogic.startPayload(game));
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

  const room = openRoom();
  const player = { id: nextPlayerId++, nickname, ws, connected: true };
  room.players.push(player);
  ws.player = player;
  ws.room = room;

  send(ws, {
    type: "joined",
    id: player.id,
    phase: room.phase,
    secondsLeft: room.secondsLeft,
    players: room.players
      .filter((p) => p.connected)
      .map((p) => ({ id: p.id, nickname: p.nickname })),
  });
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

  if (!room.players.some((p) => p.connected)) {
    clearTimer(room);
    if (room.game) gameLogic.stopGame(room.game);
    const i = rooms.indexOf(room);
    if (i !== -1) rooms.splice(i, 1);
  } else if (!room.game) {
    broadcastLobby(room);
    evaluate(room);
  }
}

server.listen(PORT, () => {
  console.log(`bomberman-dom running at http://localhost:${PORT}`);
});
