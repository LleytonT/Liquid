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

export type HudState = {
  metrics: HudMetric[]
  status: string | null
}

export type GameRendererProps = {
  branch: BranchRecord
  onHud: (hud: HudState) => void
  onReady: () => void
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
  /** Static ask chips. The shell renders them and does not interpret them. */
  contextChips: readonly string[]
  seed: {
    branches: readonly BranchRecord[]
  }
  bible: {
    /** Throws when the snapshot breaks this game's bible or locked tunables. */
    prepare: (branch: BranchRecord) => void
  }
  input: {
    /** Shown by the shell for the first seconds of play. */
    hint: string
  }
  solver: {
    run: () => SolveLevelResult[]
  }
}

export type GameModule = GameHeadless & {
  renderer: ComponentType<GameRendererProps>
}
