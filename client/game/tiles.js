const WALL = 1;
const BLOCK = 2;

const blockEls = new Map();

export function build(msg) {
  const board = document.getElementById("board");
  if (!board) return;
  board.innerHTML = "";
  blockEls.clear();

  const frag = document.createDocumentFragment();
  for (let y = 0; y < msg.height; y++) {
    for (let x = 0; x < msg.width; x++) {
      const t = msg.tiles[y][x];
      if (t !== WALL && t !== BLOCK) continue;
      const el = document.createElement("div");
      el.className = "tile " + (t === WALL ? "wall" : "block");
      el.style.gridColumnStart = String(x + 1);
      el.style.gridRowStart = String(y + 1);
      frag.appendChild(el);
      if (t === BLOCK) blockEls.set(x + "," + y, el);
    }
  }
  board.appendChild(frag);
}

export function destroy(cells) {
  if (!cells) return;
  for (const { x, y } of cells) {
    const key = x + "," + y;
    const el = blockEls.get(key);
    if (el) {
      el.remove();
      blockEls.delete(key);
    }
  }
}
