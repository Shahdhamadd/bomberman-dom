import { h } from "../framework.js";
import { chatPanel } from "./chat.js";

export function lobbyScreen(state, actions) {
  return h("div", { class: "screen lobby" }, [
    h("div", { class: "lobby-main" }, [
      h("h1", { class: "logo small" }, "💣 bomberman-dom"),
      counter(state),
      statusLine(state),
      h("h2", { class: "panel-title" }, "Players"),
      playerList(state),
    ]),
    h("div", { class: "lobby-side" }, [
      h("h2", { class: "panel-title" }, "Chat"),
      chatPanel(state, actions),
    ]),
  ]);
}

function counter(state) {
  return h("div", { class: "counter" }, [
    h("span", { class: "counter-num" }, String(state.players.length)),
    h("span", { class: "counter-max" }, " / 4 players"),
  ]);
}

function statusLine(state) {
  let text;
  if (state.phase === "waiting") {
    text = "Waiting for players… (need at least 2)";
  } else if (state.phase === "filling") {
    text = `Waiting for more players… starting in ${state.secondsLeft}s`;
  } else if (state.phase === "countdown") {
    text = `Get ready! Game starts in ${state.secondsLeft}s`;
  } else {
    text = "Starting…";
  }
  const urgent = state.phase === "countdown";
  return h("div", { class: "status" + (urgent ? " urgent" : "") }, text);
}

function playerList(state) {
  const myId = state.me && state.me.id;
  return h(
    "ul",
    { class: "players" },
    state.players.map((p) =>
      h(
        "li",
        {
          class: "player-chip" + (p.id === myId ? " me" : ""),
          key: p.id,
        },
        p.nickname + (p.id === myId ? " (you)" : "")
      )
    )
  );
}
