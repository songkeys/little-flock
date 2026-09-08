# Contributing

Thanks for helping Little Flock grow.

Open an issue for a bug or a focused feature proposal. For a bug, include the steps to reproduce it, expected and actual behavior, browser/device details, and a screenshot or short recording when useful. Use disposable test accounts and remove personal information from screenshots and logs. Do not attach save files, passwords, session cookies, or database connection strings.

For a pull request:

1. Fork the repository and create a branch for one change.
2. Follow the local setup in the README.
3. Keep the implementation small and use the existing game rules and components.
4. Keep `src/game/catalog.json` and `server/catalog.json` identical; do the same for `regions.json`.
5. Run `npm run build`, then `go test -race ./...` and `go vet ./...` inside `server/`.
6. Explain the player-visible change and how you checked it. Include a short recording for visual or interaction changes.

Add tests where they protect meaningful behavior, especially resource changes, permissions, persistence, and multiplayer synchronization. Keep gameplay and touch controls understandable.

Report security issues privately through the repository's Security tab when private vulnerability reporting is available. Do not post credentials, exploit payloads against the live demo, or player data in public issues.
