import { h } from "../framework.js";

export function nicknameScreen(state, actions) {
  const submit = () => {
    const input = document.getElementById("nickname-input");
    if (input) actions.join(input.value);
  };

  return h("div", { class: "screen center" }, [
    h("div", { class: "card" }, [
      h("h1", { class: "logo" }, "💣 bomberman-dom"),
      h("p", { class: "subtitle" }, "Enter a nickname to join a game."),

      state.error && h("div", { class: "error" }, state.error),

      h("div", { class: "field" }, [
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
