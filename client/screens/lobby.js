import { h } from "../framework.js";
import { chatPanel } from "./chat.js";
import { leaveControl } from "./leave.js";

const TEAM_NAMES = ["Red Team", "Blue Team"];

export function lobbyScreen(state, actions) {
  return h("div", { class: "screen lobby" }, [
    h("div", { class: "lobby-main" }, [
      h("h1", { class: "logo small", key: "logo" }, "💣 bomberman-dom"),
      h("div", { class: "mode-badge", key: "mode" }, state.modeLabel || "Versus"),
      counter(state),
      statusLine(state),
      botLine(state),
      h("h2", { class: "panel-title", key: "title" }, "Players"),
      playerList(state),
      leaveControl(state, actions, "Leave room"),
    ]),
    h("div", { class: "lobby-side" }, [
      h("h2", { class: "panel-title" }, "Chat"),
      chatPanel(state, actions),
    ]),
  ]);
}

function counter(state) {
  return h("div", { class: "counter", key: "counter" }, [
    h("span", { class: "counter-num" }, String(state.players.length)),
    h("span", { class: "counter-max" }, ` / ${state.maxHumans} players`),
  ]);
}

function statusLine(state) {
  let text;
  if (state.phase === "waiting") {
    text = `Waiting for players… (need at least ${state.minHumans})`;
  } else if (state.phase === "filling") {
    text = `Waiting for more players… starting in ${state.secondsLeft}s`;
  } else if (state.phase === "countdown") {
    text = `Get ready! Game starts in ${state.secondsLeft}s`;
  } else {
    text = "Starting…";
  }
  const urgent = state.phase === "countdown";
  return h("div", { class: "status" + (urgent ? " urgent" : ""), key: "status" }, text);
}

function botLine(state) {
  const total = state.bots;
  if (!total) return null;
  const allies = state.botAllies || 0;
  const enemies = state.botEnemies == null ? total : state.botEnemies;
  const parts = [];
  if (allies) parts.push(`${allies} AI ${allies === 1 ? "ally" : "allies"} on your team`);
  if (enemies) parts.push(`${enemies} AI ${enemies === 1 ? "enemy" : "enemies"}`);
  return h(
    "div",
    { class: "bot-line", key: "bots" },
    `🤖 ${parts.join(" and ")} will fill the empty ${total === 1 ? "seat" : "seats"}.`
  );
}

function playerList(state) {
  const myId = state.me && state.me.id;
  const teamed = state.players.some((p) => p.team === 0 || p.team === 1);

  const chip = (p) =>
    h(
      "li",
      {
        class: "player-chip" + (p.id === myId ? " me" : "") + teamClass(p.team),
        key: p.id,
      },
      p.nickname + (p.id === myId ? " (you)" : "")
    );

  if (!teamed) {
    return h("ul", { class: "players", key: "roster" }, state.players.map(chip));
  }

  const groups = [0, 1].filter((t) => state.players.some((p) => p.team === t));
  return h(
    "div",
    { class: "team-groups", key: "roster" },
    groups.map((t) =>
      h("div", { class: "team-group" + teamClass(t), key: t }, [
        h("div", { class: "team-label" }, TEAM_NAMES[t]),
        h("ul", { class: "players" }, state.players.filter((p) => p.team === t).map(chip)),
      ])
    )
  );
}

function teamClass(team) {
  if (team === 0) return " team-red";
  if (team === 1) return " team-blue";
  return "";
}
