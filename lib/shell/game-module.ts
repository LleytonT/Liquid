import type { ComponentType } from "react"

/**
 * Contract for a game on the Liquid shell.
 *
 * A game module has five parts. The shell (routes, branch records, HUD chrome,
 * ask bar, shelf, tile-flip, sound) never reads past this contract.
 *
 * - seed: versioned branch records. The root branch has parentId null.
 * - bible: prepare() rejects a snapshot that breaks that game's locked core.
 * - renderer: draws the running game and reports HUD metrics.
 * - input: the hint the shell shows, and listeners the renderer attaches.
 * - solver: headless proof used by `npm run solve`.
 *
 * Register the headless module in games/catalog.ts and the renderer in
 * games/renderers.tsx. Branch ids are unique across games.
 */

export type Knob = {
  value: number
  min: number
  max: number
  locked: boolean
}

export type Bible = {
  version: number
  lockedCore: Record<string, unknown>
  registeredAdditions: { id: string; summary: string }[]
}

/** Snapshot stored on a branch. `content` belongs to the game module. */
export type Snapshot = {
  id: string
  bible: Bible
  tunables: Record<string, Knob>
  content: unknown
}

export type BranchRecord = {
  id: string
  parentId: string | null
  title: string
  gameId: string
  snapshot: Snapshot
}

export type HudMetric = {
  id: string
  label: string
  value: string
}

/** Page backdrop. Each game owns its own; the shelf stays on the liquid backdrop. */
export type GameTheme = {
  background: string
  foreground: string
  vignette: string
}

/** Ask bar, owned by the shell and driven by the game. */
export type AskState = {
  visible: boolean
  focus: boolean
  pulse: boolean
  placeholder: string
  maxLength: number
  chips: readonly string[]
}

export type HudState = {
  metrics: HudMetric[]
  status: string | null
  /** Ghost hint. Null hides it. The shell shows a non-null hint for 5s. */
  hint: string | null
  ask: AskState
}

export type AskHandlers = {
  /** Enter in an empty ask. Words uses this to start the next round. */
  onEmptyEnter: () => void
  /** Escape, or the ask closing without a submit. */
  onDismiss: () => void
}

export type GameRendererProps = {
  branch: BranchRecord
  onHud: (hud: HudState) => void
  onReady: () => void
  registerAsk: (handlers: AskHandlers) => void
}

export type SolveLevelResult = {
  levelId: string
  ok: boolean
  /** Length of a finishable route, in pixels. 0 when none was found. */
  pathLength: number
  notes: string[]
}

export type GameHeadless = {
  id: string
  title: string
  summary: string
  rootBranchId: string
  theme: GameTheme
  /** Ask bar before the renderer reports. The renderer replaces it via onHud. */
  ask: AskState
  seed: {
    branches: readonly BranchRecord[]
  }
  bible: {
    /** Throws when the snapshot breaks this game's bible or locked tunables. */
    prepare: (branch: BranchRecord) => void
  }
  input: {
    /** First-play hint. Null when this game has nothing to say. */
    hint: string | null
  }
  solver: {
    run: () => SolveLevelResult[]
  }
}

export type GameModule = GameHeadless & {
  renderer: ComponentType<GameRendererProps>
}
