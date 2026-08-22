import { h, createStore, createApp } from "./framework.js";
import { connect } from "./net.js";
import { nicknameScreen } from "./screens/nickname.js";
import { lobbyScreen } from "./screens/lobby.js";
import { gameScreen } from "./game/board.js";
import { gameoverScreen } from "./screens/gameover.js";
import { initInput } from "./game/input.js";
import * as entities from "./game/entities.js";
import * as tiles from "./game/tiles.js";
import { initFit, scheduleFit } from "./game/fit.js";

const store = createStore({
  screen: "nickname",
  mode: "versus",
  modeLabel: "Versus",
  minHumans: 2,
  maxHumans: 4,
  bots: 0,
  me: null,
  players: [],
  phase: "waiting",
  secondsLeft: null,
  chat: [],
  error: null,
  connected: true,
  game: null,
  winner: null,
  winnerTeam: null,
  rematchReady: 0,
  rematchTotal: 0,
  rematchSent: false,
  confirmLeave: false,
});

const net = connect({
  url: `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`,
  onMessage: handleServer,
  onClose: () => store.setState({ connected: false, confirmLeave: false }),
});

function lobbyPatch(msg) {
  return {
    mode: msg.mode,
    modeLabel: msg.modeLabel,
    minHumans: msg.minHumans,
    maxHumans: msg.maxHumans,
    bots: msg.bots,
    players: msg.players,
    phase: msg.phase,
    secondsLeft: msg.secondsLeft,
  };
}

function handleServer(msg) {
  switch (msg.type) {
    case "joined":
      store.setState(
        Object.assign(lobbyPatch(msg), {
          screen: "lobby",
          me: { id: msg.id },
          error: null,
        })
      );
      break;

    case "lobby":
      store.setState((s) =>
        Object.assign(lobbyPatch(msg), {
          screen: s.screen === "gameover" ? "lobby" : s.screen,
          game: s.screen === "gameover" ? null : s.game,
        })
      );
      break;

    case "chat":
      store.setState((s) => ({ chat: [...s.chat, msg] }));
      scrollChatSoon();
      break;

    case "game_start":
      store.setState({
        screen: "game",
        winner: null,
        winnerTeam: null,
        rematchReady: 0,
        rematchTotal: 0,
        rematchSent: false,
        confirmLeave: false,
        game: {
          width: msg.width,
          height: msg.height,
          mode: msg.mode,
          teamMode: msg.teamMode,
          teams: msg.teams,
          spiritCooldown: msg.spiritCooldown,
          players: msg.players,
        },
      });
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      entities.init(msg, store.getState().me && store.getState().me.id);
      tiles.build(msg);
      break;

    case "player_move":
      entities.onMove(msg);
      break;

    case "bomb_placed":
      entities.onBomb(msg);
      break;

    case "bomb_move":
      entities.onBombMove(msg);
      break;

    case "explosion":
      entities.onExplosion(msg);
      tiles.destroy(msg.destroyed);
      applyExplosion(msg);
      break;

    case "powerup_taken":
      entities.onPowerupTaken(msg);
      patchPlayer(msg.playerId, msg.stats);
      break;

    case "player_dead":
      entities.onDead(msg);
      patchPlayer(msg.id, { alive: false, ghost: !!msg.ghost });
      break;

    case "game_over":
      entities.stop();
      store.setState({
        screen: "gameover",
        winner: msg.winner,
        winnerTeam: msg.team,
        confirmLeave: false,
      });
      break;

    case "rematch_state":
      store.setState({ rematchReady: msg.ready, rematchTotal: msg.total });
      break;

    case "left":
      entities.stop();
      store.setState({
        screen: "nickname",
        me: null,
        players: [],
        phase: "waiting",
        secondsLeft: null,
        bots: 0,
        chat: [],
        game: null,
        winner: null,
        winnerTeam: null,
        rematchReady: 0,
        rematchTotal: 0,
        rematchSent: false,
        confirmLeave: false,
        error: null,
      });
      break;

    case "error":
      store.setState({ error: msg.message });
      break;
  }
}

function applyExplosion(msg) {
  if (!msg.hits.length) return;
  store.setState((s) => {
    if (!s.game) return {};
    const players = s.game.players.map((p) => {
      const hit = msg.hits.find((hh) => hh.id === p.id);
      return hit ? { ...p, lives: hit.lives, alive: hit.alive, ghost: hit.ghost } : p;
    });
    return { game: { ...s.game, players } };
  });
}

function patchPlayer(id, patch) {
  store.setState((s) => {
    if (!s.game) return {};
    const players = s.game.players.map((p) => (p.id === id ? { ...p, ...patch } : p));
    return { game: { ...s.game, players } };
  });
}

function live() {
  return store.getState().connected;
}

const actions = {
  pickMode(mode) {
    store.setState({ mode, error: null });
  },
  join(nickname) {
    if (!live()) return;
    nickname = (nickname || "").trim();
    if (!nickname) {
      store.setState({ error: "Please enter a nickname." });
      return;
    }
    const mode = store.getState().mode;
    store.setState({ error: null });
    net.send({ type: "join", nickname, mode });
  },
  sendChat(text) {
    if (!live()) return;
    text = (text || "").trim();
    if (!text) return;
    net.send({ type: "chat", text });
  },
  armLeave(on) {
    store.setState({ confirmLeave: !!on });
  },
  leaveMatch() {
    if (!live()) return;
    store.setState({ confirmLeave: false });
    net.send({ type: "leave" });
  },
  rematch() {
    if (!live()) return;
    if (store.getState().rematchSent) return;
    store.setState({ rematchSent: true });
    net.send({ type: "rematch" });
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

function screenFor(state) {
  switch (state.screen) {
    case "lobby":
      return lobbyScreen(state, actions);
    case "game":
      return gameScreen(state, actions);
    case "gameover":
      return gameoverScreen(state, actions);
    case "nickname":
    default:
      return nicknameScreen(state, actions);
  }
}

function connectionBanner() {
  return h("div", { class: "conn-banner", key: "conn", role: "alert" }, [
    h("span", { class: "conn-text" }, "Disconnected from the server."),
    h(
      "button",
      { class: "conn-reload", type: "button", onClick: () => location.reload() },
      "Reload"
    ),
  ]);
}

function view(state) {
  const screen = screenFor(state);
  screen.attrs.key = "screen";
  return h("div", { class: "app-shell" + (state.connected ? "" : " offline") }, [
    state.connected ? null : connectionBanner(),
    screen,
  ]);
}

function scrollChatSoon() {
  requestAnimationFrame(() => {
    const log = document.getElementById("chat-log");
    if (log) log.scrollTop = log.scrollHeight;
  });
}

createApp({ root: document.getElementById("app"), view, store });

initFit();
store.subscribe(() => {
  if (store.getState().screen === "game") scheduleFit();
});
