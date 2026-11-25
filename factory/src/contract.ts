export const GAME_CONTRACT_VERSION = 1 as const

export type TweakKnob = {
  readonly key: string
  readonly min: number
  readonly max: number
  readonly note?: string
  /** Return null to reject the value. */
  readonly clamp?: (value: number) => number | null
}

/** Word patterns the router uses when the model is down or returns no patch. The game owns the phrases. */
export type FallbackHint = {
  readonly pattern: string
  readonly patch: Readonly<Record<string, number>>
  /** When set, the first capture group replaces this key before clamping. */
  readonly capture?: string
}

export type GameData = {
  readonly id: string
  readonly parentId: string | null
  readonly title: string
  /** Opaque to the factory. Adapters clone it. The factory never stores it on a branch. */
  readonly body: unknown
}

export type GameRead = {
  readonly tunables: Readonly<Record<string, number>>
  readonly summary: string
}

export type IdentityStamp = {
  readonly id: string
  readonly parentId: string | null
  readonly title: string
}

/** Step a clock, or play a short script. */
export type HeadlessRequest =
  | { readonly mode: "ticks"; readonly ticks: number }
  | { readonly mode: "script"; readonly steps: readonly { readonly input: string }[] }

export type HeadlessReport = {
  readonly ticks: number
  readonly done: boolean
  readonly summary: string
}

/** A listed invariant. The factory does not execute it. */
export type InvariantListing = {
  readonly id: string
  readonly summary: string
}

export type SolveReport = {
  readonly ok: boolean
  readonly notes: readonly string[]
}

export type ScreenshotReport =
  | { readonly supported: false; readonly reason: string }
  | { readonly supported: true; readonly note: string }

export type ContentHook = {
  /** Records a content plan. Does not build a level. */
  plan(ask: string): { readonly summary: string }
}

export type HotApplyResult = {
  /** Mid-play. The shell does not call this yet. */
  readonly when: "live"
  readonly data: GameData
}

/**
 * Contract v1. The factory calls these methods and never imports a game.
 * `write` is the respawn / tree path: resolution walks from the seed and applies each patch.
 * `hotApply` is the same patch math for a session that is already running.
 */
export interface GameAdapter {
  readonly contractVersion: typeof GAME_CONTRACT_VERSION
  readonly id: string
  readonly tweaks: readonly TweakKnob[]
  readonly fallbackHints: readonly FallbackHint[]
  readonly exampleTweak: string
  load(branchId: string): GameData | null
  read(data: GameData): GameRead
  write(data: GameData, patch: Readonly<Record<string, number>>): GameData
  hotApply(data: GameData, patch: Readonly<Record<string, number>>): HotApplyResult
  withIdentity(data: GameData, meta: IdentityStamp): GameData
  /** Numbers a fresh game starts from. Used to tell a real change from a no-op. */
  readonly baseline: Readonly<Record<string, number>>
  describePatch(patch: Readonly<Record<string, number>>, requested?: Readonly<Record<string, number>>): string
  already(key: string, value: number): string
  refusal(ask: string): string
  /** Raw numbers for the word matcher. Null when this ask is not a tweak phrase. */
  interpret?(ask: string, current: Readonly<Record<string, number>>): Record<string, number> | null
  runHeadless(data: GameData, request: HeadlessRequest): HeadlessReport
  listInvariants(): readonly InvariantListing[]
  solve?(data: GameData): SolveReport
  screenshot?(data: GameData): ScreenshotReport
  content?: ContentHook
}
