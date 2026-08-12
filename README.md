# bomberman-dom

A multiplayer Bomberman game built with **[MiniFramework](../mini-framework)** (our own
from-scratch JS framework — no React/Vue/canvas/WebGL) and **WebSockets** for the multiplayer.

## Status

**Milestone 1 — lobby + chat ✅**
Nickname entry → waiting room with a live player counter and the 20s/10s timer rules →
real-time chat over WebSockets, all synced across players.

**Milestone 2 — the game ✅**
Server-authoritative game: random map generation (fixed walls + destructible blocks),
4-corner spawns with guaranteed escape space, grid-locked movement, bombs → flames with
chain reactions, the 3 power-ups (bombs / flames / speed), 3 lives, and last-man-standing.
Players, bombs, flames and power-ups are SVG sprites moved with `translate3d` inside one
`requestAnimationFrame` loop (with a live on-screen FPS meter), so the map/HUD only
re-render on real events and movement stays at a smooth 60fps.


## Run it

```bash
npm install   # installs `ws` (the only dependency)
npm start     # serves http://localhost:3000 + the WebSocket server
```

Open **http://localhost:3000** in a browser. To test multiplayer, open it in **several tabs
or windows** (each tab is a player). Two players start a 20-second wait; four start the
game immediately after a 10-second countdown.

## How to play

**Goal:** be the **last player standing**. Everyone spawns in a corner of a walled arena.
Drop bombs to blast the destructible blocks — and your opponents — while dodging every
explosion, including your own.

### 1. Join a match

1. Start the server (see [Run it](#run-it)) and open **http://localhost:3000**.
2. Enter a **nickname** and hit **Join** — you land in the waiting room.
3. It's multiplayer, so you need **2–4 players**. Open the page in **more tabs/windows**, or
   have friends open it on the same network — **each tab is one player**. The counter shows
   how many have joined.
4. With **2+** players a **20-second** "waiting for more players" timer runs; a **4th** player
   skips it. Then a **10-second** "Get ready!" countdown plays and the match begins.
5. You can **chat** with everyone the whole time — in the lobby and during the match.

### 2. Controls

| Key                    | Action                     |
| ---------------------- | -------------------------- |
| Arrow keys **or** WASD | Move (up / down / left / right) |
| Space                  | Drop a bomb                |

Movement is grid-based — you step one tile at a time. (Keys are ignored while you're typing
in the chat box.)

### 3. Read the arena

- **Metal pillars** — indestructible; they never break or move.
- **Brick blocks** — destructible; bomb them to open paths and reveal power-ups.
- **Grass** — open floor you can walk on.
- The **HUD** at the top shows each player's colour and stats: lives ❤, bombs 💣, blast
  range 🔥, and speed 👟.

### 4. Bombs & flames

- You start with **3 lives**, **1 bomb**, and blast range **1**.
- Press **Space** to drop a bomb on your tile. It explodes after a **~2.5 s fuse** into a
  **＋-shaped blast** of flame.
- Flame **destroys brick blocks** and **hurts any player it touches — including you**. Metal
  pillars stop the blast.
- **Chain reaction:** a bomb caught in another blast detonates immediately.
- Getting caught in flame costs **1 life**; you then get a brief flash of **invulnerability**
  so you can escape.
- ⚠️ **Don't hug your own bomb** — step away before the fuse runs out!

### 5. Power-ups

Blow up brick blocks to reveal pickups — walk over one to grab it:

| Icon | Power-up | Effect                            |
| ---- | -------- | --------------------------------- |
| 💣   | Bomb     | Carry **one more** bomb at a time |
| 🔥   | Flame    | **+1** blast range                |
| 👟   | Speed    | **Move faster**                   |

### 6. Win the round

- Lose all **3 lives** and you're **out** — you can still watch and chat, but not play.
- The **last player standing wins** 🏆. If everyone is wiped out in the same blast, it's a **draw**.
- Hit **Play again** to return to the nickname screen for another match.

**Tips:** open escape routes *before* you attack, corner opponents in dead-ends, and grab
power-ups early — more bombs and range mean more control of the map.

## Lobby rules (from the subject)

- A waiting room fills up to **4** players; each join increments the counter.
- With **≥ 2** players present, a **20-second** "waiting for more players" window runs.
- If the room reaches **4** players, that wait is skipped.
- When the wait ends (or 4 players are reached), a **10-second** "get ready" countdown runs.
- When the countdown ends, the game starts.

> The subject says "more than 2 players". Taken literally, a 2-player match could never
> start (which contradicts the stated 2–4 range), so the code treats the threshold as
> "**at least 2**". It's a one-line change (`MIN_PLAYERS` in `server.js`) if your audit
> expects strictly 3.

## Project structure

```
bomberman-dom/
├── index.html            # loads the framework (globals) + client (ES modules)
├── server.js             # static file server + WebSocket lobby server
├── game.js               # authoritative game logic (map, movement, bombs, win)
├── package.json          # `ws` dependency, `npm start`
├── framework/            # vendored copy of MiniFramework (events, vdom, state, router, index)
└── client/
    ├── framework.js      # bridges window.MiniFramework -> clean ES imports
    ├── net.js            # WebSocket client (buffers sends until connected)
    ├── main.js           # store, networking, actions, screen switcher
    ├── styles.css
    ├── screens/
    │   ├── nickname.js   # pick a nickname
    │   ├── lobby.js      # counter + countdown + roster
    │   ├── chat.js       # reusable chat panel (lobby + in-game)
    │   └── gameover.js   # winner screen + play again
    └── game/
        ├── constants.js  # TILE size (shared by board + render engine)
        ├── board.js      # framework view: HUD, static map, FPS badge, chat
        ├── entities.js   # rAF render engine: sprite transforms (the 60fps layer)
        ├── sprites.js    # inline SVG art for players / bombs / power-ups
        └── input.js      # keyboard controls
```

## WebSocket protocol (JSON messages)

**Client → server**

| type    | fields     | meaning                              |
| ------- | ---------- | ------------------------------------ |
| `join`  | `nickname` | join the next open room              |
| `chat`  | `text`     | send a chat message                  |
| `input` | `dir`      | movement intent (`up`/`down`/…/null) |
| `bomb`  | —          | drop a bomb                          |

**Server → client**

| type            | fields                                        | meaning                            |
| --------------- | --------------------------------------------- | ---------------------------------- |
| `joined`        | `id`, `phase`, `secondsLeft`, `players`       | you joined; here's your id + room  |
| `lobby`         | `phase`, `secondsLeft`, `players`             | room state changed (broadcast)     |
| `chat`          | `from`, `nickname`, `text`, `ts`              | a chat message to display          |
| `game_start`    | `width`, `height`, `tiles`, `players`         | the map + spawns; switch to board  |
| `player_move`   | `id`, `fromX/Y`, `toX/Y`, `duration`          | a player steps one cell (tween it) |
| `bomb_placed`   | `id`, `x`, `y`, `ownerId`, `fuse`             | a bomb was dropped                 |
| `explosion`     | `bombs`, `cells`, `destroyed`, `powerups`, `hits` | a blast (flames + its results) |
| `powerup_taken` | `x`, `y`, `playerId`, `stats`                 | a power-up was collected           |
| `player_dead`   | `id`                                          | a player ran out of lives          |
| `game_over`     | `winner`                                      | last one standing (or draw)        |
| `error`         | `message`                                     | e.g. empty nickname                |

## How the framework is used (and the 60fps design)

The framework drives everything **discrete**: the screens, the lobby, the chat, the static
grid (walls/blocks) and the HUD. These re-render only on real events (a block breaks, a life
is lost, a message arrives) — never every frame.

For the **60fps** requirement, the moving sprites (players, bombs, explosions) live in a
dedicated `#entities` layer moved with `transform: translate3d(...)` inside a single
`requestAnimationFrame` loop (`client/game/entities.js`) — GPU-composited, no per-frame DOM
diffing, no reflow. The framework's diff never touches that layer (its vnode has no
children), and an on-screen FPS meter makes performance measurable, as the subject asks.
Because the render loop is `requestAnimationFrame`, it correctly pauses when the tab is
hidden and resumes (snapping sprites to their latest server positions) when it's visible.
