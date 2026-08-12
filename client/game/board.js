import { h } from "../framework.js";
import { TILE } from "./constants.js";
import { chatPanel } from "../screens/chat.js";

const WALL = 1;
const BLOCK = 2;

export function gameScreen(state, actions) {
  const g = state.game;
  return h("div", { class: "screen game" }, [
    h("div", { class: "game-main" }, [
      h("div", { class: "game-bar" }, [hud(state), h("div", { class: "fps", id: "fps" })]),
      h(
        "div",
        {
          class: "board-wrap",
          style: { width: g.width * TILE + "px", height: g.height * TILE + "px" },
        },
        [
          h(
            "div",
            {
              class: "board",
              id: "board",
              style: {
                gridTemplateColumns: `repeat(${g.width}, ${TILE}px)`,
                gridTemplateRows: `repeat(${g.height}, ${TILE}px)`,
              },
            },
            tileNodes(g)
          ),
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

function tileNodes(g) {
  const nodes = [];
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const t = g.tiles[y][x];
      if (t !== WALL && t !== BLOCK) continue;
      nodes.push(
        h("div", {
          class: "tile " + (t === WALL ? "wall" : "block"),
          key: x + "," + y,
          style: { gridColumnStart: String(x + 1), gridRowStart: String(y + 1) },
        })
      );
    }
  }
  return nodes;
}

function hud(state) {
  const myId = state.me && state.me.id;
  return h(
    "div",
    { class: "hud" },
    state.game.players.map((p) =>
      h(
        "div",
        {
          class:
            "hud-player" + (p.alive ? "" : " dead") + (p.id === myId ? " me" : ""),
          key: p.id,
        },
        [
          h("span", { class: "hud-dot", style: { background: p.color } }),
          h("span", { class: "hud-name" }, p.nickname + (p.id === myId ? " (you)" : "")),
          h(
            "span",
            { class: "hud-stats" },
            `❤ ${Math.max(0, p.lives)}   💣 ${p.maxBombs}   🔥 ${p.flameRange}   👟 ${p.speed}`
          ),
        ]
      )
    )
  );
}
