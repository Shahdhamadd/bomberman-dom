import { h } from "../framework.js";
import { TILE } from "./constants.js";
import { chatPanel } from "../screens/chat.js";
import { leaveControl } from "../screens/leave.js";

export function gameScreen(state, actions) {
  const g = state.game;
  const me = g.players.find((p) => state.me && p.id === state.me.id);

  return h("div", { class: "screen game" }, [
    h("div", { class: "game-main" }, [
      h("div", { class: "game-bar", key: "bar" }, [
        hud(state),
        h("div", { class: "bar-right" }, [
          h("div", { class: "fps", id: "fps", key: "fps" }),
          leaveControl(state, actions),
        ]),
      ]),
      me && me.ghost && ghostBar(),
      h(
        "div",
        {
          class: "board-wrap",
          key: "board",
          style: { width: g.width * TILE + "px", height: g.height * TILE + "px" },
        },
        [
          // #board is filled imperatively by tiles.js — walls/blocks live outside
          // the framework diff, so destroying a block never re-diffs the grid.
          h("div", {
            class: "board",
            id: "board",
            style: {
              gridTemplateColumns: `repeat(${g.width}, ${TILE}px)`,
              gridTemplateRows: `repeat(${g.height}, ${TILE}px)`,
            },
          }),
          h("div", { class: "entities", id: "entities" }),
        ]
      ),
    ]),
    h("div", { class: "game-side" }, [
      h("h2", { class: "panel-title" }, "Chat"),
      chatPanel(state, actions),
    ]),
  ]);
}

function ghostBar() {
  return h("div", { class: "ghost-bar", key: "ghost" }, [
    h("span", { class: "ghost-tag" }, "👻 GHOST"),
    h("span", { class: "ghost-hint", id: "ghost-hint" }, "…"),
    h("span", { class: "ghost-tip" }, "Drift through walls · Space drops a spirit bomb"),
  ]);
}

function hud(state) {
  const g = state.game;
  if (!g.teamMode) {
    return h("div", { class: "hud" }, g.players.map((p) => hudPlayer(p, state)));
  }

  return h(
    "div",
    { class: "hud teams" },
    g.teams.map((t) =>
      h("div", { class: "hud-team", key: t.id, style: { borderColor: t.color } }, [
        h("span", { class: "hud-team-name", style: { color: t.color } }, t.name),
        h(
          "div",
          { class: "hud-team-row" },
          g.players.filter((p) => p.team === t.id).map((p) => hudPlayer(p, state))
        ),
      ])
    )
  );
}

function hudPlayer(p, state) {
  const myId = state.me && state.me.id;
  const out = !p.alive && !p.ghost;
  const cls =
    "hud-player" +
    (out ? " dead" : "") +
    (p.ghost ? " ghost" : "") +
    (p.id === myId ? " me" : "");

  let label = p.nickname;
  if (p.id === myId) label += " (you)";
  else if (p.bot) label += " 🤖";

  return h("div", { class: cls, key: p.id }, [
    h("span", { class: "hud-dot", style: { background: p.color } }),
    h("span", { class: "hud-name" }, label),
    h(
      "span",
      { class: "hud-stats" },
      p.ghost
        ? "👻 haunting"
        : `❤ ${Math.max(0, p.lives)}  💣 ${p.maxBombs}  🔥 ${p.flameRange}  👟 ${p.speed}${
            p.canKick ? "  🦶" : ""
          }`
    ),
  ]);
}
