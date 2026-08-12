import { h, createStore, createApp } from "./framework.js";
import { connect } from "./net.js";
import { nicknameScreen } from "./screens/nickname.js";
import { lobbyScreen } from "./screens/lobby.js";
import { gameScreen } from "./game/board.js";
import { gameoverScreen } from "./screens/gameover.js";
import { initInput } from "./game/input.js";
import * as entities from "./game/entities.js";

const store = createStore({
  screen: "nickname",
  nickname: "",
  me: null,
  players: [],
  phase: "waiting",
  secondsLeft: null,
  chat: [],
  error: null,
  game: null,
  winner: null,
});

const net = connect({
  url: `ws://${location.host}`,
  onMessage: handleServer,
  onClose: () => store.setState({ error: "Disconnected from the server." }),
});

function handleServer(msg) {
  switch (msg.type) {
    case "joined":
      store.setState({
        screen: "lobby",
        me: { id: msg.id },
        players: msg.players,
        phase: msg.phase,
        secondsLeft: msg.secondsLeft,
        error: null,
      });
      break;

    case "lobby":
      store.setState({
        players: msg.players,
        phase: msg.phase,
        secondsLeft: msg.secondsLeft,
      });
      break;

    case "chat":
      store.setState((s) => ({ chat: [...s.chat, msg] }));
      scrollChatSoon();
      break;

    case "game_start":
      store.setState({
        screen: "game",
        winner: null,
        game: {
          width: msg.width,
          height: msg.height,
          tiles: msg.tiles,
          players: msg.players,
        },
      });
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      entities.init(msg);
      break;

    case "player_move":
      entities.onMove(msg);
      break;

    case "bomb_placed":
      entities.onBomb(msg);
      break;

    case "explosion":
      entities.onExplosion(msg);
      applyExplosion(msg);
      break;

    case "powerup_taken":
      entities.onPowerupTaken(msg);
      patchPlayer(msg.playerId, msg.stats);
      break;

    case "player_dead":
      entities.onDead(msg);
      patchPlayer(msg.id, { alive: false });
      break;

    case "game_over":
      entities.stop();
      store.setState({ screen: "gameover", winner: msg.winner });
      break;

    case "error":
      store.setState({ error: msg.message });
      break;
  }
}

function applyExplosion(msg) {
  store.setState((s) => {
    if (!s.game) return {};
    const tiles = s.game.tiles.map((row) => row.slice());
    for (const { x, y } of msg.destroyed) tiles[y][x] = 0;
    let players = s.game.players;
    if (msg.hits.length) {
      players = players.map((p) => {
        const hit = msg.hits.find((hh) => hh.id === p.id);
        return hit ? { ...p, lives: hit.lives, alive: hit.alive } : p;
      });
    }
    return { game: { ...s.game, tiles, players } };
  });
}

function patchPlayer(id, patch) {
  store.setState((s) => {
    if (!s.game) return {};
    const players = s.game.players.map((p) => (p.id === id ? { ...p, ...patch } : p));
    return { game: { ...s.game, players } };
  });
}

const actions = {
  join(nickname) {
    nickname = (nickname || "").trim();
    if (!nickname) {
      store.setState({ error: "Please enter a nickname." });
      return;
    }
    store.setState({ nickname, error: null });
    net.send({ type: "join", nickname });
  },
  sendChat(text) {
    text = (text || "").trim();
    if (!text) return;
    net.send({ type: "chat", text });
  },
};

initInput({
  send: (m) => net.send(m),
  isActive: () => store.getState().screen === "game",
  isTyping: () => {
    const a = document.activeElement;
    return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA");
  },
});

function view(state) {
  switch (state.screen) {
    case "lobby":
      return lobbyScreen(state, actions);
    case "game":
      return gameScreen(state, actions);
    case "gameover":
      return gameoverScreen(state);
    case "nickname":
    default:
      return nicknameScreen(state, actions);
  }
}

function scrollChatSoon() {
  requestAnimationFrame(() => {
    const log = document.getElementById("chat-log");
    if (log) log.scrollTop = log.scrollHeight;
  });
}

createApp({ root: document.getElementById("app"), view, store });
