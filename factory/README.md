# Factory

The factory turns a player ask into a branch on that game's tree. Each game's seed is a root. There is no trunk.

`/factory` does not import `/games`. A game implements the contract. `lib/registry.ts` wires it. A third game adds a package and a registry line, and this folder stays as it is.

## Live

| Piece | Path | Status |
| --- | --- | --- |
| Ask router | `src/router.ts` | live. The model answers first. The word list runs only when that call throws. |
| Game contract v1 | `src/contract.ts` | live |
| Branch, trace, owner | `src/branch.ts`, `src/trace.ts`, `src/owner.ts` | live |
| Resolve a branch from its parent patch | `src/resolve.ts` | live |
| Open an ask, accept or reject the plan | `src/ask.ts` | live |
| File store for dev and tests | `src/store.ts` `createFileStore` | live |
| Upstash Redis store | `src/store.ts` `createUpstashStore` | live when the env vars below are set |
| Anonymous owner | `src/owner.ts` `anonOwnerSource` | live. Sign-in replaces this object only. |
| Visibility hook | `src/visibility.ts` | personal is instant and skips the hook. Share and propose are not live. |
| Hot apply | `GameAdapter.hotApply` | live on the contract. No mid-play UI in this step. |

## Studio roles

Stubs are types in `src/stubs.ts`. Nothing calls them. There is no role pipeline and no role folders.

| Role | Path | Status | Later step |
| --- | --- | --- | --- |
| planner / producer | `src/stubs.ts` `PlannerProducer` | planned | 3, eve studio agents |
| level designer | `src/stubs.ts` `LevelDesigner` | planned | 3, eve studio agents |
| builder | `src/stubs.ts` `Builder` | planned | 6, `@cursor/sdk` runs for new mechanics |
| balance tuner | `src/stubs.ts` `BalanceTuner` | planned | 3, eve studio agents |
| qa play-tester | `src/stubs.ts` `QaPlayTester` | planned | 5, propose-merge, owner accept, and a qa gate |
| continuity keeper | `src/stubs.ts` `ContinuityKeeper` | planned | owns the bible. `listInvariants` lists rules and does not run them. |
| cd fit judge | `src/stubs.ts` `CdFitJudge` | planned | 3, on a different model from the router (`openai/gpt-5-mini`) |
| light art / audio | `src/stubs.ts` `LightArtAudio` | planned | 3, eve studio agents |
| per-branch deploys | `src/stubs.ts` `BranchDeploys` | planned | 4 |
| propose-merge | `src/stubs.ts` `ProposeMerge` | planned | 5 |

Also later, and not built here: an executable bible, an independent verifier (invariants, solver, and the judge), an eval set of about 50 asks per fixture, traces beyond the record in `src/trace.ts`, speed tiers, and telemetry that turns into asks. The verifier hook is `VisibilityHook`. It runs only for `shared` or `proposed`. Personal branches do not call it.

`Trace.checks` stays an empty list. `Trace.evidence` is free-form space for those future checks. `Branch.traceId` points at the ask's trace.

## Contract v1

`contractVersion` is `1`.

| Method | What it does |
| --- | --- |
| `load` | Read an authored seed or an authored child of that seed. |
| `read` | Tunables and a one-line summary. |
| `write` | Apply a patch for the tree walk and the next respawn. |
| `hotApply` | Apply the same patch for a session that is already running. Returns `{ when: "live" }`. |
| `withIdentity` | Stamp id, parent, and title on a view. |
| `describePatch` | Player-facing words for a patch. |
| `runHeadless` | Step ticks, or play a scripted input. |
| `listInvariants` | List bible lines. Does not enforce them. |
| `solve` | Optional completability call. |
| `screenshot` | Optional. Both fixtures return a stub. |
| `content` | Optional plan for a content ask. Does not build a level. |

`fallbackHints` and `tweaks` live on the adapter. The router classifies tweak, content, branch, or clarify. Under confidence `0.6` the route is clarify and the plan has one question.

## Branches

A branch stores `parentId`, the ask, a kind, its own `patch` or a plan, the owner id, time, status, visibility, and `traceId`. It does not store a snapshot of the game. Playing `/b/<id>` walks from that game's seed and applies each patch in order, root first. A later change to a parent patch is visible to descendants on the next read.

Visibility is `personal`, `shared`, or `proposed`. New branches are `personal`. Status is `draft`, `playable`, `proposed`, `merged`, or `rejected`. A tweak stays a draft until the player accepts the plan, then it is playable. A content ask or a new mechanic stays a draft and says it is not built. A vague ask stores a trace and does not create a branch.

Authored roots use the owner id `lleyton`. A player's branch uses the anonymous id from the browser.

## Store

Provision **Upstash Redis** from the Vercel Marketplace. The integration sets:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

When both are set, branches and traces go to Redis. When `UPSTASH_REDIS_REST_URL` is missing, the factory uses the file store. On Vercel that choice is logged and returned on the ask response, because the serverless disk does not last. Locally the file is `data/branches.json`, or `LIQUID_BRANCH_FILE` when that is set.

`AI_GATEWAY_API_KEY` is only for a local gateway call. If the call fails, the router uses the adapter's word list.
