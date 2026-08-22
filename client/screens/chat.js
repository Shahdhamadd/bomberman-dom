import { h } from "../framework.js";

export function chatPanel(state, actions) {
  const myId = state.me && state.me.id;

  return h("div", { class: "chat" }, [
    h(
      "div",
      { class: "chat-log", id: "chat-log" },
      state.chat.length === 0
        ? [h("div", { class: "chat-empty" }, "No messages yet. Say hi! 👋")]
        : state.chat.map((m) =>
            h("div", { class: "chat-msg" + (m.from === myId ? " mine" : "") }, [
              h("span", { class: "chat-name" }, m.nickname + ": "),
              h("span", { class: "chat-text" }, m.text),
            ])
          )
    ),

    h(
      "form",
      {
        class: "chat-form",
        onSubmit: (e) => {
          e.preventDefault();
          const input = document.getElementById("chat-input");
          if (!input) return;
          actions.sendChat(input.value);
          input.value = "";
        },
      },
      [
        h("input", {
          id: "chat-input",
          class: "chat-input",
          placeholder: state.connected ? "Type a message…" : "Disconnected",
          autocomplete: "off",
          maxlength: "300",
          disabled: !state.connected,
        }),
        h(
          "button",
          { class: "chat-send", type: "submit", disabled: !state.connected },
          "Send"
        ),
      ]
    ),
  ]);
}
