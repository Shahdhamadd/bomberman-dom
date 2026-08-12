import { h } from "../framework.js";

export function gameoverScreen(state) {
  const w = state.winner;
  const title = w ? `${w.nickname} wins! 🏆` : "Draw — everyone's out!";
  const youWon = w && state.me && w.id === state.me.id;

  return h("div", { class: "screen center" }, [
    h("div", { class: "card" }, [
      h("h1", { class: "logo" }, title),
      youWon && h("p", { class: "subtitle" }, "🎉 Last one standing!"),
      h("button", { class: "btn", onClick: () => location.reload() }, "Play again"),
    ]),
  ]);
}
