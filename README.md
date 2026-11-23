# liquid

A shelf of two games. `/` opens `seed`, five original rooms: a red square, blue dots, coins, and green safe ground. Deaths are the score. [Liquid Words](http://127.0.0.1:38471/b/words) is five letters and six guesses. Its word lists are derived from [SCOWL 2020.12.07](https://wordlist.aspell.net/); see `games/words/LICENSE-SCOWL.txt`.

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

`npm run solve` checks both games: each platformer level has a finishable path, and every Liquid Words answer is on the valid list and winnable under the current tunables.

Arrow keys or WASD move. On a touch screen, use the pad at the lower right. The ask bar only keeps a plan card; nothing is built from it yet.

## Game module

The shell is game-agnostic. A game implements `GameModule` in `lib/shell/game-module.ts`:

- **seed** — branch records (`id`, `parentId`, `snapshot`)
- **bible** — `prepare()` rejects a snapshot that breaks that game's locked core
- **renderer** — draws the game and reports HUD metrics
- **input** — hint text, plus listeners the renderer attaches
- **solver** — headless proof used by `npm run solve`

Register the headless module in `games/catalog.ts` and the renderer in `games/renderers.tsx`. The shelf lists that registry. `/` plays the first game's root branch.

Tile flip (`planTileFlip` in `lib/shell/tile-flip.ts`) and synthesized sound (`lib/shell/audio.ts`) are shell primitives. The platformer calls them; it does not own them.

`AI_GATEWAY_API_KEY` is listed in `.env.example` for later. This step does not call a model. Set the key in Vercel, team Internal Playground.
