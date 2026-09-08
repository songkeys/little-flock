<div align="center">

# Little Flock · 小羊慢慢

**A cozy multiplayer sheep-farming game, made one-shot with GPT 6 Astra in Codex.**

从一片空地开始，把平凡的日子，养成喜欢的模样。

[Play online](https://sharpherd.song.work) · [The original post](https://x.com/songkeys/status/2097231024375935286) · [The one-shot prompt](#the-one-shot-goal-prompt) · [Getting started](#run-locally) · [Contributing](CONTRIBUTING.md)

</div>

## Demo

<video src="https://raw.githubusercontent.com/songkeys/little-flock/main/docs/demo.mp4" poster="https://raw.githubusercontent.com/songkeys/little-flock/main/docs/demo-poster.jpg" controls width="1280"></video>

[Watch / download the demo](docs/demo.mp4) · [Download the full 1080p trailer](https://github.com/songkeys/little-flock/releases/download/demo/little-flock-gameplay-trailer.mp4)

A 64-second tour of the game: meeting the flock, building a home, caring for lambs, grazing, gardening, exploring the valley, and sharing a farm with friends. Captured in-engine with cinematic cameras and staged gameplay; the multiplayer shots use locally staged characters.

## Made with Codex

**This game was created one-shot by GPT 6 Astra in Codex, using a single `/goal` run.**

The goal was to build a complete, playable sheep-farming simulation: the 3D world, game systems, multiplayer server, artwork, audio, and deployment. The trailer was made afterward with HyperFrames using the game's renderer.

**这款游戏由 GPT 6 Astra 在 Codex 中通过一次 `/goal` 任务 one-shot 完成。**

Read the story behind the project in [the original post on X](https://x.com/songkeys/status/2097231024375935286).

No AI API key or paid service is required to run the game. The interface is currently in Simplified Chinese.

## The one-shot goal prompt

The prompt below is a lightly edited version of the original Chinese `/goal` prompt. It keeps the original requirements, tone, and creative freedom; private deployment addresses, local file paths, account details, and personal scheduling have been removed or generalized. It is a reusable example, not a verbatim transcript or a guarantee of an identical result.

下面是最初提示词的隐私处理版，尽量保留原来的表达和要求，方便大家了解如何把一个完整游戏目标交给 AI。

```text
/goal 创建一个基于 r3f / postprocessing 等全家桶制作的高性能、高质量、高乐趣的游戏：牧羊人模拟器（shepherd-simulator）。

玩家扮演一个牧羊人，每天日常就是养羊、照顾农场。

这是一个成长型 3D 游戏：羊可以繁殖，有不同品种的羊（分稀有等级，种类繁多，随机性极大，并且每一个都很有意思）。羊有不同阶段的成长。养羊系统非常有意思。

农场还可以养花养草，买饲料、种子等。像开心农场那样，但是乐趣也很大。有成熟的作物/农务系统。

有像 Minecraft / Roblox 那种的世界操作效果，以及类似的一天的时间映射。

其他很多你可以发挥创意，可以上网搜索类似游戏的制作、流程设计。潜水员戴夫我觉得就很不错。

游戏整体风格偏休闲治愈、画风可爱美观。审美好。设计高质量。

游戏支持建立房间，数据上服务器（账号密码登录）。支持多人在同个房间游玩。后端可以用 Golang 来写。部署可以走已配置好的 Coolify，在浏览器中打开即可；域名和 DNS 使用部署环境提供的配置。你可以用 browser use 来控制浏览器。我们可能还需要一台数据库，同样创建在 Coolify 上，在同一个 project 里。

你可以用 Blender MCP 来制作 3D 模型，也可以用 Tripo 3D 来制作你觉得需要的复杂建模，按已授权的工具和可用额度使用。

游戏整体完成质量和程度一定要足够高，一直持续打磨直到完成。

这期间我不会参与，有什么需要你得自己解决。完成后我会看成果，一定要足够震撼到我。

btw，你可能需要一个 notes 文件夹，里面放一些 plan.md / task.md / research.md 等文件来时刻记录你的思路 / 进展 / 调研。在开始之前，多去调研游戏如何制作、素材怎么设计最好等、艺术效果参考等。多做设计（imagegen），把游戏计划完整打磨。
```

To try a similar run, open an empty project in Codex, choose your model, and use `/goal` with the prompt. Configure any deployment or asset-generation tools you want the agent to use first, and adapt those lines to your own environment.

## Life in the valley

- **Start small.** A 16-step introduction helps you build a shelter, adopt your first sheep, learn daily care, and plant your first garden.
- **Meet your flock.** Discover 12 sheep breeds, five rarity tiers, and six personalities. Name them, pet them, feed them, collect wool, and welcome newborn lambs.
- **Go grazing.** Gather the flock, walk to the meadow, let the sheep eat and drink, then lead them home.
- **Grow something.** Plant seven crops, water and harvest them, fulfill neighbor orders, and upgrade the farm.
- **Explore.** Follow connected paths through the home farm, flower meadow, mushroom woodland, and stargazing highland.
- **Make yourself at home.** Customize your shepherd's skin, hair, clothes, and hat, with a live 3D preview.
- **Share a world.** Create a farm or join by invitation code. Friends share the same inventory, coins, buildings, sheep, and saved progress, with live presence and chat.
- **Take it slowly.** Enjoy day and night, rain, seasonal colors, warm window lights, fireflies, and a gentle original soundtrack. Sheep do not die and ripe crops do not rot.

## Run locally

Use **Node.js 24+**, **npm**, and **Go 1.26** (the version used by the Docker build).

```sh
git clone https://github.com/songkeys/little-flock.git
cd little-flock
npm ci
npm run dev
```

In another terminal:

```sh
cd little-flock/server
go run .
```

Open [localhost:4318](http://localhost:4318), register an account, and create a farm. Vite forwards `/api` and WebSocket traffic to the Go server on port `8080`.

By default, the server saves locally to `server/data/farm.json`. This includes account and farm data and is ignored by Git. Keep your save files private. Set `DATABASE_URL` to use PostgreSQL instead; the Go process reads environment variables directly and does not load `.env` automatically.

## Run with Docker

```sh
cp .env.example .env
# Generate a password and put it in .env as POSTGRES_PASSWORD:
openssl rand -hex 24
docker compose up -d --build
```

Open [localhost:8081](http://localhost:8081). Compose starts the app and PostgreSQL 16, persists the database in a named volume, and keeps PostgreSQL off the host network. The app port binds to localhost; use a reverse proxy with HTTPS to expose a self-hosted instance.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | Go HTTP / WebSocket port |
| `DATABASE_URL` | Unset | PostgreSQL connection; otherwise use a file save |
| `SAVE_PATH` | `data/farm.json` | File-store path relative to the server's working directory |
| `STATIC_DIR` | `../dist` | Frontend build directory; `/app/dist` inside Docker |
| `APP_PORT` | `8081` | Docker Compose's local host port |

Run **one application replica**: active farm simulation and WebSocket connections live in a single process. PostgreSQL stores persistent state. See [server/README.md](server/README.md) for the API and game rules.

## Controls

| Input | Action |
| --- | --- |
| `WASD` / arrow keys | Move relative to the camera |
| `Shift` / `Space` | Run / jump |
| Click the ground | Walk to a location |
| Right-drag / scroll | Orbit / zoom the camera |
| `1`–`6` | Pet, feed, shear, plant, water, harvest |
| Click a sheep or plot / `E` | Interact with the selected or nearby target |
| `F` | Whistle to gather sheep |
| `B` / `J` / `M` | Shop / breed journal / valley map, as unlocked |
| `Esc` | Close a panel |
| Touch joystick and action buttons | Mobile movement, interaction, and jump |

## Inside the project

```text
src/world/       3D world, sheep, shepherds, crops, lighting and animation
src/ui/          Farm entry, story guide, inventory and game panels
src/game/        Shared types, content catalogs, appearance and audio
server/          Go simulation, authentication, REST, WebSocket and persistence
public/          Runtime artwork and the cottage model
docs/            Demo video and poster
```

The frontend uses **React 19, TypeScript, React Three Fiber, Drei, and postprocessing**. The server owns resource changes and game rules, persists successful actions before broadcasting, and synchronizes shared farm state over WebSockets. Keep the frontend and server copies of `catalog.json` and `regions.json` in sync.

## Development checks

```sh
npm run build
cd server
go test -race ./...
go vet ./...
```

Optional PostgreSQL integration tests use `TEST_DATABASE_URL` and create an isolated test schema. Point this variable at a test database.

## Current scope

This is a small cooperative game and an experiment in building with an AI coding agent. It has one handcrafted valley, progressive construction, and shared farms. Chat is live and is not saved after reload. Care decay and the farm clock pause when nobody is connected; watered crops and lambs can mature while players are away. Seasons affect scenery rather than crop yields. Arbitrary building placement, voice chat, account recovery, and multiple server replicas are not implemented.

Bug reports and focused improvements are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License and credits

Source code and project documentation use the [MIT License](LICENSE). Project artwork, the cottage model, and demo media use [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). See [ASSETS.md](ASSETS.md) for attribution and third-party credits.
