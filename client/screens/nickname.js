import { h } from "../framework.js";

const MODES = [
  { id: "versus", icon: "⚔️", name: "Versus", blurb: "2–4 players, free-for-all" },
  { id: "teams", icon: "🛡️", name: "Teams", blurb: "2 v 2 — AI fills empty seats" },
  { id: "coop", icon: "🤝", name: "Co-op", blurb: "Team up against the AI" },
  { id: "solo", icon: "🤖", name: "Solo", blurb: "You vs 3 AI — starts now" },
];

export function nicknameScreen(state, actions) {
  const submit = () => {
    const input = document.getElementById("nickname-input");
    if (input) actions.join(input.value);
  };

  return h("div", { class: "screen center" }, [
    h("div", { class: "card wide" }, [
      h("h1", { class: "logo", key: "logo" }, "💣 bomberman-dom"),
      h("p", { class: "subtitle", key: "sub" }, "Pick a mode, enter a nickname, and join."),

      state.error && h("div", { class: "error", key: "err" }, state.error),

      modePicker(state, actions),

      h("div", { class: "field", key: "field" }, [
        h("input", {
          id: "nickname-input",
          class: "text-input",
          placeholder: "Your nickname",
          maxlength: "16",
          autofocus: true,
          onKeydown: (e) => {
            if (e.key === "Enter") submit();
          },
        }),
        h("button", { class: "btn", onClick: submit }, "Join"),
      ]),
    ]),
  ]);
}

function modePicker(state, actions) {
  return h(
    "div",
    { class: "modes", key: "modes" },
    MODES.map((m) =>
      h(
        "button",
        {
          class: "mode-card" + (state.mode === m.id ? " on" : ""),
          key: m.id,
          type: "button",
          onClick: () => actions.pickMode(m.id),
        },
        [
          h("span", { class: "mode-icon" }, m.icon),
          h("span", { class: "mode-name" }, m.name),
          h("span", { class: "mode-blurb" }, m.blurb),
        ]
      )
    )
  );
}
