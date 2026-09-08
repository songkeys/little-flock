# Little Flock server

Go owns accounts and avatar appearance, farm ownership/membership, progressive unlocks, the shared economy, sheep/crops, region resources, grazing trips, and the game clock. WebSockets carry player positions, presence, chat, and the same authoritative farm state returned by REST.

## Run

```sh
cd server
go run .
```

The default address is `:8080`. Frontend Vite should proxy `/api` to `http://localhost:8080`, including WebSockets; preserve the original Host (`changeOrigin: false`) so same-origin checks work during development.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | HTTP and WebSocket listener |
| `DATABASE_URL` | unset | PostgreSQL URL; creates three `sheep_` tables automatically |
| `SAVE_PATH` | `data/farm.json` | Durable atomic file store when PostgreSQL is unset |
| `STATIC_DIR` | `../dist` | Vite production output served with SPA fallback |

Deploy **one application replica**. The active room simulation and WebSocket hub live in that process; PostgreSQL durably stores accounts, hashed sessions, and complete room JSONB. Adding replicas would require a shared room coordinator. With a file store, mount the `data` directory as a persistent volume. Set a PostgreSQL database for the production deployment.

`GET /api/health` returns `{ok:true,service:"little-flock",time:<milliseconds>}` and checks PostgreSQL connectivity when configured. On shutdown, the server saves every room and closes live connections. Every successful game action persists before it is broadcast or charged; active simulation snapshots save every 15 seconds.

## API

All timestamps are Unix **milliseconds**. Errors have `{error:"human readable Chinese text"}`. Browser fetches should use `credentials: "include"`; authentication is a random opaque, 30-day `HttpOnly`, `SameSite=Lax` cookie (also `Secure` when accessed over HTTPS). Passwords are bcrypt hashes; only SHA-256 session-token hashes are persisted. Account names are case insensitive and accept letters, numbers, underscores, and dashes; 2–24 characters. Passwords are 6–72 bytes. Authentication attempts, room creation/joining, and actions have basic rate limits. Mutating requests and WebSockets enforce the same origin.

| Method | Path | Body / response |
| --- | --- | --- |
| POST | `/api/auth/register` | `{username,password}` → `{user:{id,username}}` |
| POST | `/api/auth/login` | `{username,password}` → `{user}` |
| POST | `/api/auth/logout` | `{}` → `{ok:true}` |
| GET | `/api/auth/me` | `{user}`; 401 without a session |
| PATCH | `/api/auth/profile` | `{avatar:{skin,hair,outfit,hat}}` → `{user}`; updates the signed-in account |
| GET | `/api/rooms` | `{rooms:[...]}`; only farms the account belongs to |
| POST | `/api/rooms` | `{name}` → `{room,state,serverTime}` |
| POST | `/api/rooms/join` | `{code}` → `{room,state,serverTime}` |
| GET | `/api/rooms/:id` | `{room,state,serverTime}`; membership required |
| DELETE | `/api/rooms/:id` | Owner only → `{deletedRoomId,rooms}` with the owner's refreshed list |
| POST | `/api/rooms/:id/actions` | Action below → `{state,message,serverTime}` |
| GET | `/api/rooms/:id/ws` | Authenticated WebSocket, membership required |

`User` and WebSocket `Player` each include `avatar: {skin,hair,outfit,hat}`. Indices are integers: skin 0–5, hair 0–5, outfit 0–7, and hat 0–3; all default to 0. The avatar belongs to the account, appears in login/session responses, and follows the player between farms. Startup adds the avatar JSONB column when it is missing from the initial account schema, preserving existing accounts and their password hashes. A profile update saves before broadcasting refreshed presence to every connected farm containing that player.

Farm deletion is permanent and only the creator can perform it. The server deletes the durable record before removing the live room, emits `roomDeleted {roomId}` to connected members, then closes their sockets. Clients should leave the deleted farm and use the returned `rooms` list or reload `/api/rooms`; reconnecting, joining by its former code, and actions on that room return 404. A failed durable delete keeps the farm available. Deletion preserves all accounts and their other farms.

The complete TypeScript contract lives in `src/game/types.ts`. The frontend catalog is `src/game/catalog.json`; the byte-identical `server/catalog.json` is embedded in the Go binary. Keep both copies together when changing content or prices.

The objective sequence, seed gifts, spatial rules, and map contract are documented in [PROGRESSION.md](PROGRESSION.md). `src/game/regions.json` and its embedded `server/regions.json` copy define all region/action coordinates; a test checks that they match.

Action bodies:

```json
{"type":"build","facility":"shelter"}
{"type":"build","facility":"garden"}
{"type":"startGraze"}
{"type":"waterFlock"}
{"type":"finishGraze"}
{"type":"forage","nodeId":"forest-mushroom-1"}
{"type":"unlockRegion","regionId":"highland"}
{"type":"stargaze"}
{"type":"rehome","sheepId":"..."}
{"type":"pet","sheepId":"..."}
{"type":"feed","sheepId":"..."}
{"type":"shear","sheepId":"..."}
{"type":"rename","sheepId":"...","name":"棉花糖"}
{"type":"breed","sheepId":"...","partnerId":"..."}
{"type":"adopt"}
{"type":"buy","itemId":"seed_clover","quantity":3}
{"type":"sell","itemId":"wool_cloud","quantity":2}
{"type":"plant","plotId":"plot-2","cropId":"carrot"}
{"type":"water","plotId":"plot-2"}
{"type":"harvest","plotId":"plot-2"}
{"type":"order","orderId":"..."}
{"type":"upgrade","upgradeId":"pasture"}
{"type":"upgrade","upgradeId":"watering"}
```

Inventory IDs: `feed`, `seed_<cropId>`, `<cropId>` for harvested produce, `wool_<breedId>` for fleece, and `mushroom`/`herb` for forest finds. Quantities must be integers 1–99. Prices and ownership never come from the client. Invalid, premature, duplicate, unaffordable, or nonmember actions cannot spend coins or grant resources.

Client WebSocket messages:

```json
{"type":"move","position":{"x":1,"z":7},"facing":0}
{"type":"move","position":{"x":1,"z":7},"facing":0,"jump":true}
{"type":"whistle"}
{"type":"chat","text":"早上好！"}
```

Server messages: `state {state,serverTime}`, `presence {players}`, `chat {userId,username,text,at}`, and `event {text,at}`. Initial presence/state arrive on connection. Every presence player includes the account avatar. Movement is bounded to the playable area, rate capped, and limited to plausible speed. A new jump is sent as `jump:true`; the server assigns that player's `jumpAt` timestamp and enforces a 650 ms cooldown. Chat is 1–180 characters and limited to one message per second. The client should reconnect after a lost socket and refetch the farm state; REST is the authority for success/error feedback.

Whistling broadcasts `whistle {position,at}` to everyone in the room, using the player's server-known position and server time. It has a three-second cooldown and is an ephemeral event. Clients use the shared anchor for the sheep's gathering animation.

## Playable rules

- Shared farm begins with 180 coins, no sheep or plots, and 2 feed. The first objectives build a shelter, adopt an adult cloud sheep, introduce pet/feed/shear, then create six plots with three clover seeds. Orders, grazing, breeding, forest resources, and the highland open in sequence.
- One game day is 720 real seconds, beginning at 08:00. Care decay and the clock pause without connected players. Planted and watered crops and growing lambs retain their real-time ready dates, so they can finish while you are away. Nothing dies or rots.
- Sheep become adult after 300 seconds; adults grow wool in about 200 seconds. Hunger declines gently and never below 10; happiness never below 30. Low hunger slows wool. Cloud wool grows 10% faster and moon sheep wool grows 20% faster at night.
- Feed consumes feed first, then clover, then carrot; restores 35 hunger and 8 happiness. Pet restores 15 happiness and 3 XP with a 15-second cooldown. Shear a mature sheep at 100 wool to receive 2 fleece (3 at happiness ≥90).
- Breeding needs opposite-sex adults, hunger ≥55 and happiness ≥65 for both, 45 coins, and free capacity. The lamb arrives immediately, and parents rest for 360 seconds. There is a 35% mutation branch; otherwise the lamb inherits either parent. Mutation/adoption rarity weights are common 40%, uncommon 32%, rare 20%, epic 7%, legendary 1%; rare sheep require the forest, epic sheep require the highland, and legendary sheep additionally require level 5. Rolls for unavailable tiers fall into an available lower tier. Each new breed discovery adds 35 XP. Six personalities add identity without hidden economic penalties.
- Adoption costs 110 coins and gives a new adult. The first sheep is a cloud female; whenever only one sheep remains, the next adoption has the opposite sex. A second sheep is introduced after the first grazing trip. Rehoming is available from step 12, retains at least one sheep, and preserves discoveries. Sheep capacity starts at 8; pasture upgrades cost 260/680 coins and increase it to 14/24.
- Plant → water once → grow 45–240 seconds → harvest 2–3 produce. Rain waters dry plots. Watering upgrades cost 180/420 coins and reduce growth time by 10%/20%; tier 2 waters every planted plot with one interaction.
- A grazing trip requires 20 active seconds with the connected leader inside the meadow target, drinking at the spring, and returning to the home gathering point. The first return grants 180 coins, later returns grant 25; every return restores flock hunger/happiness and grants 50 XP.
- Forest nodes grant one mushroom or herb, then regrow after 180 seconds. Highland restoration costs 120 coins, three mushrooms, and three carrots at level 3. Highland stargazing requires the viewpoint at night, once per farm day, and grants one moonflower seed, 15 coins, and 15 XP.
- Shop seeds and direct-sale prices come from the catalog. Orders exchange fixed quantities for coins and XP, then immediately reveal a new request using only unlocked crops or discovered fleece. Level thresholds are 0, 80, 220, 460, 800, 1250, 1850, 2650 XP.

## Verification

```sh
go test -race ./...
go vet ./...
```

Set `TEST_DATABASE_URL` to a **test database** to also exercise real PostgreSQL schema creation, account uniqueness, session revocation, and JSONB persistence through a newly opened connection pool. That test creates and removes an isolated schema. The PostgreSQL path has been verified locally against PostgreSQL 16.

Tests cover account avatar validation/live presence/persistence, owner-only farm deletion with member ejection and failed-save rollback, the complete resource-balanced progression, locked regions and crops, real grazing location/time, offline pause, daily stargazing, farming, premature/duplicate actions, breeding cooldown and maturity, pause behavior, password/session authentication, membership checks, two-player atomic shearing, save-failure rollback, restart persistence, live two-client WebSocket chat/state, cross-origin rejection, and static SPA serving. The production deployment must additionally be verified against its running database and public `/api/health` endpoint.
