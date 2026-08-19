# bomberman-dom

A multiplayer Bomberman game built with **[MiniFramework](../mini-framework)** (our own
from-scratch JS framework — no React/Vue/canvas/WebGL) and **WebSockets** for the multiplayer.
All five bonus features from the subject are implemented — see [Bonus features](#bonus-features).

## Run it

```bash
npm install   # installs `ws` (the only dependency)
npm start     # serves http://localhost:3000 + the WebSocket server
```

Open **http://localhost:3000** in a browser. To test multiplayer, open it in **several tabs
or windows** — each tab is one player.

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

| Key                    | Action                                          |
| ---------------------- | ----------------------------------------------- |
| Arrow keys **or** WASD | Move (up / down / left / right)                 |
| Space                  | Drop a bomb — or a **spirit bomb** as a ghost   |

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

| Icon | Power-up  | Effect                                             |
| ---- | --------- | -------------------------------------------------- |
| 💣   | Bomb      | Carry **one more** bomb at a time                  |
| 🔥   | Flame     | **+1** blast range                                 |
| 👟   | Speed     | **Move faster** (up to 8)                          |
| ❤   | Extra life | **+1 life**, capped at **5**                      |
| 🦶   | Bomb kick | Walk into a bomb to **kick it** across the floor   |

The last two are bonus power-ups and are deliberately rarer than the base three.

### 6. Win the round

- Lose all **3 lives** and you become a **ghost** — still in the match, just not alive
  (see [Ghost mode](#5-post-death-interaction--ghost-mode)).
- The **last player standing wins** 🏆 — or the **last team standing** in Teams/Co-op/Solo.
  If everyone is wiped out in the same blast, it's a **draw**.

### 7. Leaving and rematching

- **Leave match / Leave room** — a button in the lobby and above the board. It takes two
  clicks (the second one confirms) so you can't drop out of a match by mis-clicking. You go
  straight back to the nickname screen **without reloading the page** — the WebSocket stays
  open, so you can pick a different mode and join again immediately. Leaving mid-match takes
  you out for good: no ghost, no power-up drop.
- **Rematch** — on the winner screen. It reuses the same room and **skips the 20s + 10s
  lobby entirely**: fresh map, lives and stats reset, same players, same mode. Chat history
  is kept.
  - With more than one human the button shows a tally (`Rematch 1/2`) and the new match
    starts once **everyone still in the room has accepted**.
  - If too few players are left to run the mode again, the room drops back to the normal
    waiting room instead so it can fill up.

## Bonus features

You pick a mode on the nickname screen before joining; each mode has its own waiting room.

| Mode         | Players                        | Teams?           | Start                    |
| ------------ | ------------------------------ | ---------------- | ------------------------ |
| ⚔️ **Versus** | 2–4 humans                     | free-for-all     | normal 20s + 10s lobby   |
| 🛡️ **Teams**  | 2–4 humans, AI fills to 4      | 2 v 2            | normal 20s + 10s lobby   |
| 🤝 **Co-op**  | 2–3 humans + AI fills to 4     | humans vs AI     | normal 20s + 10s lobby   |
| 🤖 **Solo**   | 1 human + 3 AI                 | you vs the AI    | **starts immediately**   |

### 1. Solo and Co-op vs AI

The bots (`bot.js`) run on the server and play by the same rules as everyone else — they
have the same stats, pick up the same power-ups and can be blown up. Each bot re-plans
every 120 ms:

1. **Flee** — it builds a blast map of every cell any live bomb will burn, and if it is
   standing in one it breadth-first searches for the nearest safe tile and runs there.
2. **Attack** — if a brick block or an enemy is within its own blast range, it checks that
   dropping a bomb would still leave an escape route (by re-running the blast map *with*
   the hypothetical bomb) and only then drops it.
3. **Hunt** — otherwise it walks toward the nearest power-up, then the nearest enemy, then
   the nearest destructible block, always routing around danger.

### 2. Extra power-ups

**❤ extra life** and **🦶 bomb kick**, on top of the required three. With kick, walking into a bomb sends it sliding one tile every 90 ms
until it hits a wall, a block, another bomb or a player — so you can punt a live bomb into
someone's escape route.

### 3. Random power-up on death

When a player loses their last life, a **random power-up is dropped on the tile they died
on** (skipped if that tile is already occupied by a bomb or another pickup), so a kill
hands the survivors a reward worth fighting over.

### 4. Team mode

In Teams, Co-op and Solo the players are split into **Red Team** and **Blue Team**, shown
in the lobby, the in-game HUD and the winner screen. The round ends when only one team has
living members. **There is no friendly fire** — a teammate's flames pass straight through
you — but **your own bombs still hurt you**, so you stay responsible for your own blasts.

### 5. Post-death interaction — ghost mode

Losing your last life doesn't take you out of the match, it turns you into a **👻 ghost**:

- You keep playing. You **drift through walls and brick blocks** and can't be hurt.
- Every **8 seconds** you can press **Space** to drop a **spirit bomb** — a short-fused
  (1.4 s), range-1 bomb that still breaks blocks and still hurts the living.
- A bar above the board tracks your cooldown, counting down every frame.
- Ghosts don't count toward the win condition, so your team can still win without you —
  and you can still be the reason it does.

Dead **bots** haunt too. A disconnecting player is *not* turned into a ghost — they leave
for good.

## Project structure

```
bomberman-dom/
├── index.html            # loads the framework (globals) + client (ES modules)
├── server.js             # static file server + WebSocket lobby server (modes, rooms, bot seats)
├── game.js               # authoritative game logic (map, movement, bombs, teams, ghosts, win)
├── bot.js                # AI: blast maps, escape search, target picking
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
    │   ├── leave.js      # two-step leave button (lobby + in-game)
    │   └── gameover.js   # winner screen + rematch vote
    └── game/
        ├── constants.js  # TILE size (shared by board + render engine)
        ├── board.js      # framework view: HUD, ghost bar, FPS badge, chat
        ├── tiles.js      # walls/blocks drawn outside the framework diff
        ├── fit.js        # scales the board to fit the window
        ├── entities.js   # rAF render engine: sprite transforms (the 60fps layer)
        ├── sprites.js    # inline SVG art for players / bombs / power-ups
        └── input.js      # keyboard controls
```

## WebSocket protocol (JSON messages)

**Client → server**

| type      | fields             | meaning                                        |
| --------- | ------------------ | ---------------------------------------------- |
| `join`    | `nickname`, `mode` | join the next open room for that mode          |
| `chat`    | `text`             | send a chat message                            |
| `input`   | `dir`              | movement intent (`up`/`down`/…/null)           |
| `bomb`    | —                  | drop a bomb (a spirit bomb if you're a ghost)  |
| `leave`   | —                  | leave the room; the socket stays open          |
| `rematch` | —                  | vote to replay in the same room                |

**Server → client**

| type            | fields                                                     | meaning                              |
| --------------- | ---------------------------------------------------------- | ------------------------------------ |
| `joined`        | `id` + everything in `lobby`                                | you joined; here's your id + room    |
| `lobby`         | `mode`, `modeLabel`, `minHumans`, `maxHumans`, `bots`, `phase`, `secondsLeft`, `players` | room state changed (broadcast) |
| `chat`          | `from`, `nickname`, `text`, `ts`                            | a chat message to display            |
| `game_start`    | `width`, `height`, `tiles`, `mode`, `teamMode`, `teams`, `spiritCooldown`, `players` | the map + spawns; switch to board |
| `player_move`   | `id`, `fromX/Y`, `toX/Y`, `duration`                        | a player steps one cell (tween it)   |
| `bomb_placed`   | `id`, `x`, `y`, `ownerId`, `fuse`, `spirit`, `cooldown`     | a bomb was dropped                   |
| `bomb_move`     | `id`, `fromX/Y`, `toX/Y`, `duration`                        | a kicked bomb slid one cell          |
| `explosion`     | `bombs`, `cells`, `destroyed`, `powerups`, `hits`           | a blast (flames + its results)       |
| `powerup_taken` | `x`, `y`, `kind`, `playerId`, `stats`                       | a power-up was collected             |
| `player_dead`   | `id`, `ghost`                                               | out of lives (`ghost`) or left       |
| `game_over`     | `mode`, `winner`, `team`                                    | last player/team standing (or draw)  |
| `rematch_state` | `ready`, `total`                                            | how many players have accepted       |
| `left`          | —                                                           | you're out of the room; reset the UI |
| `error`         | `message`                                                   | e.g. empty nickname                  |

Each entry in `explosion.hits` is `{ id, lives, alive, ghost, invulnMs, spiritCooldown }`,
and `explosion.powerups` carries both block drops and the power-up a dying player leaves
behind. Players in `game_start` include `team`, `bot`, `ghost` and `canKick`.

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

Movement and the bots are driven by one 60 ms `setInterval` per game (`startLoop` in
`game.js`). It also retries a blocked step, so you keep walking when the wall in front of
you is blown open or the bomb you just kicked slides out of the way.

### Measured performance

Sampled with `requestAnimationFrame` frame deltas in Chrome during a live 4-player match
(1 human + 3 AI, continuous bombing): median frame time **8.3 ms**, average **117 fps**, and
the on-screen FPS meter never read below **60** across a 60-second run.

Motion is **time-based, not frame-counted** — `advance()` interpolates with
`(now - start) / duration` using the timestamp `requestAnimationFrame` hands it, so the game
plays identically at 60 Hz and 120 Hz. One `rAF` loop drives every sprite and is cancelled
via `cancelAnimationFrame` in `stop()`.
