import { h } from "../framework.js";
import { TILE } from "./constants.js";
import { chatPanel } from "../screens/chat.js";
import { leaveControl } from "../screens/leave.js";

export function gameScreen(state, actions) {
  const g = state.game;
  const me = g.players.find((p) => state.me && p.id === state.me.id);

  return h("div", { class: "screen game" }, [
    h("div", { class: "game-main" }, [
      h("div", { class: "game-bar", key: "bar" }, [hud(state)]),
      // Sits directly above the board rather than off in the top corner.
      h("div", { class: "bar-right", key: "tools" }, [
        controlsHint(),
        h("div", { class: "fps", id: "fps", key: "fps" }),
        leaveControl(state, actions),
      ]),
      // The slot is the leftover space under the bar; the board is centred in it
      // and scaled to fill it, so the whole map is always on screen.
      h("div", { class: "board-slot", key: "slot" }, [
        h(
          "div",
          {
            class: "board-wrap",
            key: "board",
            style: { width: g.width * TILE + "px", height: g.height * TILE + "px" },
          },
          [
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
    ]),
    h("div", { class: "game-side" }, [
      // Lives in the side panel so becoming (or stopping being) a ghost never
      // pushes the board down and forces it to a new size mid-match.
      me && me.ghost && ghostBar(),
      h("h2", { class: "panel-title" }, "Chat"),
      chatPanel(state, actions),
    ]),
  ]);
}

function controlsHint() {
  return h("div", { class: "controls-hint", key: "hint" }, [
    h("span", { class: "keycap" }, "W A S D"),
    h("span", { class: "keycap" }, "← ↑ ↓ →"),
    h("span", { class: "hint-word" }, "move"),
    h("span", { class: "keycap" }, "Space"),
    h("span", { class: "hint-word" }, "drop a bomb"),
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

  return h("div", { class: cls, title: playerTitle(p, out), key: p.id }, [
    h("span", { class: "hud-dot", style: { background: p.color } }),
    h("span", { class: "hud-name" }, label),
    h("span", { class: "hud-stats" }, playerStats(p, out)),
  ]);
}

function playerTitle(p, out) {
  if (out) return `${p.nickname} is out of the game`;
  if (p.ghost) return `${p.nickname} has no lives left and is haunting`;
  return p.nickname;
}

// Each stat carries its own explanation, so the icons are not a guessing game.
function stat(icon, value, cls, help) {
  // No space before the number: bombs and range are uncapped, so a late-game
  // chip has to hold two-digit values without the row spilling over.
  const text = value === "" ? icon : icon + value;
  return h("span", { class: cls ? "stat " + cls : "stat", title: help }, text);
}

function playerStats(p, out) {
  if (out) return [stat("☠", "OUT", "out", "Eliminated — no lives left")];
  if (p.ghost) {
    return [
      stat(
        "👻",
        "haunting",
        "spirit",
        "Out of lives — drifts through walls and drops spirit bombs"
      ),
    ];
  }

  const lives = Math.max(0, p.lives);
  const stats = [
    stat("❤", lives, lives <= 1 ? "low" : "", "Lives left — at zero you are out"),
    stat("💣", p.maxBombs, "", "Bombs you can have on the board at once"),
    stat("🔥", p.flameRange, "", "Blast reach of each bomb, in tiles"),
    stat("👟", p.speed, "", "Movement speed"),
  ];
  if (p.canKick) {
    stats.push(stat("🦶", "", "", "Can kick bombs by walking into them"));
  }
  return stats;
}
