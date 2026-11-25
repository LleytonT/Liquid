# liquid

A shelf of two games. `/` is the landing. [Seed](http://127.0.0.1:38471/b/seed) is five original rooms: a red square, blue dots, coins, and green safe ground. Deaths are the score. [Liquid Words](http://127.0.0.1:38471/b/words) is five letters and six guesses. Its word lists are derived from [SCOWL 2020.12.07](https://wordlist.aspell.net/); see `games/words/LICENSE-SCOWL.txt`. Direct play stays on `/b/seed` and `/b/words`.

## Run

```bash
npm install
npm run dev
```

Dev server: [http://127.0.0.1:38471](http://127.0.0.1:38471). Production:

```bash
npm run build
npm start
```

`npm run solve` checks both games: each platformer level has a finishable path, and every Liquid Words answer is on the valid list and winnable under the current tunables. `npm test` covers the games and the factory.

Arrow keys or WASD move. On a touch screen, use the pad at the lower right. The first visit to a game opens how to play (`howto_seen_<game>` in localStorage); the ? button opens it again. An ask shows a plan before anything is applied. A tweak becomes a playable branch. A new level or mechanic is saved as a draft and is not built. A vague ask asks one question and does not create a branch. See [factory/README.md](factory/README.md).

## Game module

The shell is game-agnostic. A game implements `GameModule` in `lib/shell/game-module.ts`:

- **seed** — branch records (`id`, `parentId`, `snapshot`)
- **bible** — `prepare()` rejects a snapshot that breaks that game's locked core
- **renderer** — draws the game and reports HUD metrics
- **input** — hint text, plus listeners the renderer attaches
- **solver** — headless proof used by `npm run solve`

Register the headless module in `games/catalog.ts` and the renderer in `games/renderers.tsx`. The shelf and the landing list that registry. `/b/<rootBranchId>` plays a game directly.

Tile flip (`planTileFlip` in `lib/shell/tile-flip.ts`) and synthesized sound (`lib/shell/audio.ts`) are shell primitives. The platformer calls them; it does not own them.

The ask router tries the Vercel AI Gateway, then the game's word list. `AI_GATEWAY_API_KEY` is for a local gateway call. Durable branches need Upstash Redis from the Vercel Marketplace: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Without them, production logs a file-store fallback.
