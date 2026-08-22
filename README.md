# bomberman-dom

A multiplayer Bomberman game built with **MiniFramework** (our own
from-scratch JS framework — no React/Vue/canvas/WebGL) and **WebSockets**. All five bonus
features from the subject are implemented — see [Bonus features](#bonus-features).

## Run it

```bash
npm install   # installs `ws` (the only dependency)
npm start     # serves http://localhost:3000 + the WebSocket server
npm test      # unit tests for the game rules (node --test, no extra deps)
```

Requires **Node 20 or newer**.

Open **http://localhost:3000**. Each tab is one player — open several to test multiplayer.

## How to play

**Goal:** be the last player (or team) standing. Enter a nickname, pick a mode, and hit
**Join** to land in the waiting room. With 2+ players a **20 s** wait timer runs (a 4th
player skips it), then a **10 s** countdown starts the match. Chat works in the lobby and
in-game.

### Controls

| Key                    | Action                                        |
| ---------------------- | --------------------------------------------- |
| Arrow keys **or** WASD | Move one tile (grid-based)                    |
| Space                  | Drop a bomb — or a **spirit bomb** as a ghost |

Keys are ignored while you're typing in the chat box.

### Rules

- The arena has **metal pillars** (indestructible), **brick blocks** (destructible, may hide
  power-ups) and **grass** (walkable).
- You start with **3 lives**, **1 bomb**, blast range **1**. The HUD shows each player's
  lives ❤, bombs 💣, range 🔥 and speed 👟.
- Bombs explode after a **~2.5 s** fuse into a **＋-shaped blast** that breaks bricks and
  hurts **anyone it touches, including you**. Pillars stop the blast, and a bomb caught in
  another blast chain-detonates.
- A hit costs **1 life** and grants a brief flash of invulnerability.
- Losing your last life turns you into a **ghost** (see
  [Ghost mode](#5-post-death-interaction--ghost-mode)). If everyone dies in the same blast,
  it's a draw.

### Power-ups

Walk over a pickup revealed by a destroyed brick:

| Icon | Power-up   | Effect                                       |
| ---- | ---------- | -------------------------------------------- |
| 💣   | Bomb       | Carry one more bomb at a time                |
| 🔥   | Flame      | +1 blast range                               |
| 👟   | Speed      | Move faster (up to 8)                        |
| ❤   | Extra life | +1 life, capped at 5                         |
| 🦶   | Bomb kick  | Walk into a bomb to kick it across the floor |

The last two are bonus power-ups and are deliberately rarer.

### Leaving and rematching

- **Leave match / Leave room** takes two clicks (the second confirms) and returns you to the
  nickname screen without reloading — the WebSocket stays open. Leaving mid-match is
  permanent: no ghost, no power-up drop.
- **Rematch** on the winner screen reuses the same room and skips the lobby timers. With more
  than one human it shows a tally (`Rematch 1/2`) and starts once everyone accepts; if too
  few players remain, the room falls back to the normal waiting room.

## Bonus features

Pick a mode on the nickname screen; each mode has its own waiting room.

| Mode          | Players                   | Teams         | Start              |
| ------------- | ------------------------- | ------------- | ------------------ |
| ⚔️ **Versus** | 2–4 humans                | free-for-all  | normal 20 s + 10 s |
| 🛡️ **Teams**  | 2–4 humans, AI fills to 4 | 2 v 2         | normal 20 s + 10 s |
| 🤝 **Co-op**  | 2–3 humans, AI fills to 4 | humans vs AI  | normal 20 s + 10 s |
| 🤖 **Solo**   | 1 human + 3 AI            | you vs the AI | starts immediately |

### 1. Solo and Co-op vs AI

Bots (`bot.js`) run on the server and play by the same rules — same stats, same power-ups,
and they can be blown up. Each bot re-plans every 120 ms:

1. **Flee** — builds a blast map of every cell a live bomb will burn; if it's standing in
   one, it breadth-first searches for the nearest safe tile and runs there.
2. **Attack** — if a block or enemy is in range, it re-runs the blast map *with* the
   hypothetical bomb and only drops it if an escape route remains.
3. **Hunt** — otherwise it walks toward the nearest power-up, then enemy, then destructible
   block, always routing around danger.

### 2. Extra power-ups

**❤ extra life** and **🦶 bomb kick**. A kicked bomb slides one tile every 90 ms until it
hits a wall, block, bomb or player — so you can punt a live bomb into someone's escape route.

### 3. Random power-up on death

Losing your last life drops a random power-up on the tile you died on (skipped if a bomb or
pickup is already there), so a kill rewards the survivors.

### 4. Team mode

Teams, Co-op and Solo split players into **Red** and **Blue**, shown in the lobby, HUD and
winner screen. The round ends when one team has no living members. **No friendly fire** — but
your own bombs still hurt you.

### 5. Post-death interaction — ghost mode

- Ghosts drift through walls and blocks and can't be hurt.
- Every **8 s** you can press Space for a **spirit bomb** — short-fused (1.4 s), range 1,
  still breaks blocks and still hurts the living. A bar above the board tracks the cooldown.
- Ghosts don't count toward the win condition, so your team can still win without you.
- Dead bots haunt too. Disconnecting players do *not* become ghosts.

## Project structure

```
bomberman-dom/
├── index.html            # loads the framework (globals) + client (ES modules)
├── server.js             # static file server + WebSocket lobby (modes, rooms, bot seats)
├── game.js               # authoritative game logic (map, movement, bombs, teams, ghosts, win)
├── bot.js                # AI: blast maps, escape search, target picking
├── tile-types.js         # EMPTY/WALL/BLOCK, shared by game.js and bot.js
├── test/                 # game-rule unit tests (node --test)
├── framework/            # vendored copy of MiniFramework (events, vdom, state, router, index)
└── client/
    ├── framework.js      # bridges window.MiniFramework -> clean ES imports
    ├── net.js            # WebSocket client (buffers sends until connected)
    ├── main.js           # store, networking, actions, screen switcher
    ├── styles.css
    ├── screens/          # nickname, lobby, chat, two-step leave button, gameover
    └── game/             # constants, board (HUD/chat), tiles, fit, entities (rAF layer),
                          # sprites (inline SVG), input
```

## Design notes

**No reconnect.** A dropped connection removes you from the match for good — the server kills
your character so the round can resolve, and the client shows a "Disconnected from the server"
banner with a Reload button and disables everything that needs a live socket. This is a
deliberate choice, not an oversight: rejoining mid-match would need seat reservation and state
replay, which is out of scope here. Reload to start over.

**Routing is intentionally unused.** MiniFramework ships a hash router, but screens are
switched through a `screen` field in the store instead. A game has no meaningful URLs to
deep-link to, so the Back button does nothing and a refresh returns to the nickname screen.
The router stays vendored because it is part of the framework, not because the game needs it.

**`tile-types.js` exists to break a require cycle.** `game.js` requires `bot.js`, and `bot.js`
needs `WALL` and `BLOCK` to read the grid — importing them back from `game.js` would be
circular. A five-line leaf module with no dependencies of its own is the way out, and that is
all `tile-types.js` is.

`client/game/constants.js` then repeats the same two numbers for the browser. That is
duplication, and it is deliberate: with no build step, one file cannot be both a CommonJS
module for the server and an ES module for the client. Two definitions is the floor without
adding a bundler — the leaf module solves the cycle, not the duplication.

## WebSocket protocol (JSON messages)

**Client → server:** `join` (`nickname`, `mode`), `chat` (`text`), `input` (`dir`), `bomb`,
`leave`, `rematch`.

**Server → client**

| type            | fields                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------- |
| `joined`        | `id` + everything in `lobby`                                                              |
| `lobby`         | `mode`, `modeLabel`, `minHumans`, `maxHumans`, `bots`, `phase`, `secondsLeft`, `players`  |
| `chat`          | `from`, `nickname`, `text`, `ts`                                                          |
| `game_start`    | `width`, `height`, `tiles`, `mode`, `teamMode`, `teams`, `spiritCooldown`, `players`      |
| `player_move`   | `id`, `fromX/Y`, `toX/Y`, `duration`                                                      |
| `bomb_placed`   | `id`, `x`, `y`, `ownerId`, `fuse`, `spirit`, `cooldown`                                   |
| `bomb_move`     | `id`, `fromX/Y`, `toX/Y`, `duration`                                                      |
| `explosion`     | `bombs`, `cells`, `destroyed`, `powerups`, `hits`                                         |
| `powerup_taken` | `x`, `y`, `kind`, `playerId`, `stats`                                                     |
| `player_dead`   | `id`, `ghost`                                                                             |
| `game_over`     | `mode`, `winner`, `team`                                                                  |
| `rematch_state` | `ready`, `total`                                                                          |
| `left`          | — (you're out of the room; reset the UI)                                                  |
| `error`         | `message`                                                                                 |

Each entry in `explosion.hits` is `{ id, lives, alive, ghost, invulnMs, spiritCooldown }`, and
`explosion.powerups` carries both block drops and the power-up a dying player leaves behind.
Players in `game_start` include `team`, `bot`, `ghost` and `canKick`.

## The 60fps design

The framework drives everything **discrete** — screens, lobby, chat, the static grid and the
HUD — re-rendering only on real events, never every frame.

The moving sprites (players, bombs, explosions) live in a dedicated `#entities` layer moved
with `transform: translate3d(...)` inside a single `requestAnimationFrame` loop
(`client/game/entities.js`): GPU-composited, no per-frame DOM diffing, no reflow. The
framework's diff never touches that layer (its vnode has no children), and an on-screen FPS
meter makes performance measurable. The loop pauses when the tab is hidden and snaps sprites
to their latest server positions when it returns.

Motion is **time-based, not frame-counted** — `advance()` interpolates with
`(now - start) / duration`, so the game plays identically at 60 Hz and 120 Hz. Movement and
bots run on one 60 ms `setInterval` per game (`startLoop` in `game.js`), which also retries a
blocked step so you keep walking when the wall ahead is blown open.

**Measured:** a live 4-player match (1 human + 3 AI, continuous bombing) in Chrome on a
**120 Hz** display — median frame time **8.3 ms**, average **117 fps**, FPS meter never below
**60** over a 60-second run. The refresh rate matters: on a 60 Hz display the same run is
capped at ~60 fps / ~16.7 ms per frame. The figure to compare across machines is the share of
frames that miss the display's own budget, not the raw fps number.
