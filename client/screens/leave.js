import { h } from "../framework.js";

function tap(fn) {
  return (e) => {
    if (e.currentTarget && e.currentTarget.blur) e.currentTarget.blur();
    fn();
  };
}

export function leaveControl(state, actions, label) {
  if (!state.confirmLeave) {
    return h("div", { class: "leave-wrap", key: "leave" }, [
      h(
        "button",
        { class: "leave-btn", type: "button", onClick: tap(() => actions.armLeave(true)) },
        label || "Leave match"
      ),
    ]);
  }

  return h("div", { class: "leave-wrap", key: "leave" }, [
    h(
      "button",
      {
        class: "leave-btn danger",
        type: "button",
        onClick: tap(() => actions.leaveMatch()),
      },
      "Confirm"
    ),
    h(
      "button",
      { class: "leave-btn", type: "button", onClick: tap(() => actions.armLeave(false)) },
      "Cancel"
    ),
  ]);
}
