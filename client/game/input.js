const DIRS = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

export function initInput({ send, isActive, isTyping }) {
  const held = [];
  let lastDir = null;

  function currentDir() {
    for (let i = held.length - 1; i >= 0; i--) {
      const d = DIRS[held[i]];
      if (d) return d;
    }
    return null;
  }

  function syncDir() {
    const d = currentDir();
    if (d !== lastDir) {
      lastDir = d;
      send({ type: "input", dir: d });
    }
  }

  window.addEventListener("keydown", (e) => {
    if (!isActive() || isTyping()) return;

    if (e.code === "Space") {
      e.preventDefault();
      if (!e.repeat) send({ type: "bomb" });
      return;
    }
    if (!DIRS[e.code]) return;
    e.preventDefault();
    if (e.repeat) return;
    if (!held.includes(e.code)) held.push(e.code);
    syncDir();
  });

  window.addEventListener("keyup", (e) => {
    const i = held.indexOf(e.code);
    if (i !== -1) held.splice(i, 1);
    syncDir();
  });

  window.addEventListener("blur", () => {
    held.length = 0;
    if (lastDir !== null) {
      lastDir = null;
      send({ type: "input", dir: null });
    }
  });
}
