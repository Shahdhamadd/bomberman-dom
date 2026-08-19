import { h } from "../framework.js";

export function gameoverScreen(state, actions) {
  const winner = state.winner;
  const team = state.winnerTeam;
  const myId = state.me && state.me.id;

  let title = "Draw — everyone's out!";
  let youWon = false;

  if (team) {
    title = `${team.name} wins! 🏆`;
    youWon = team.members.some((m) => m.id === myId);
  } else if (winner) {
    title = `${winner.nickname} wins! 🏆`;
    youWon = winner.id === myId;
  }

  return h("div", { class: "screen center" }, [
    h("div", { class: "card" }, [
      h("h1", { class: "logo", key: "title" }, title),
      team &&
        h(
          "p",
          { class: "subtitle", key: "roster", style: { color: team.color } },
          team.members.map((m) => m.nickname + (m.bot ? " 🤖" : "")).join("  ·  ")
        ),
      youWon && h("p", { class: "subtitle", key: "won" }, "🎉 Victory!"),
      h("div", { class: "over-actions", key: "actions" }, [
        h(
          "button",
          {
            class: "btn" + (state.rematchSent ? " waiting" : ""),
            key: "rematch",
            type: "button",
            onClick: () => actions.rematch(),
          },
          rematchLabel(state)
        ),
        h(
          "button",
          {
            class: "leave-btn",
            key: "leave",
            type: "button",
            onClick: () => actions.leaveMatch(),
          },
          "Leave"
        ),
      ]),
      state.rematchSent &&
        state.rematchTotal > 1 &&
        h(
          "p",
          { class: "over-note", key: "note" },
          "Waiting for the others to accept…"
        ),
    ]),
  ]);
}

function rematchLabel(state) {
  const ready = state.rematchReady;
  const total = state.rematchTotal;
  if (total > 1) return state.rematchSent ? `Ready ${ready}/${total}` : `Rematch ${ready}/${total}`;
  return state.rematchSent ? "Starting…" : "Rematch";
}
