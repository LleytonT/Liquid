import type { ComponentType } from "react"

/**
 * Contract for a game on the Liquid shell.
 *
 * A game module has five parts. The shell (routes, branch records, HUD chrome,
 * ask bar, shelf, tile-flip, sound) never reads past this contract.
 *
 * - seed: versioned branch records. The root branch has parentId null.
 * - bible: prepare() rejects a snapshot that breaks that game's locked core.
 * - copy: how-to-play steps, the stats line, and plain-words branch diffs.
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

/** Class that scopes this game's shadcn tokens. Landing cards and the play shell both use it. */
export type GameThemeClass = "theme-platformer" | "theme-words"

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
  /** Ghost hint. Null hides it. The shell shows a non-null hint for 5s or until the first input. */
  hint: string | null
  /** Persistent one-line objective. Null or omitted hides it. */
  goal?: string | null
  ask: AskState
}

export type AskHandlers = {
  /** Enter in an empty ask. Return true when the game handled it. */
  onEmptyEnter: () => boolean
  /** Escape, or the ask closing without a submit. */
  onDismiss: () => void
}

export type HowToStep = {
  id: string
  /** Short line under the step visual. Empty when the visual carries the words. */
  copy: string
}

/**
 * Player-facing strings for one game. The shell renders these and never
 * branches on game id. Swap this module when a copy spec arrives.
 */
export type GameCopy = {
  remixBlurb: string
  askPlaceholder: string
  /** Shown with the ask chips while the bar is pulsing. */
  pulseChip: string
  firstRunHint: string | null
  hintFadeMs: number
  howTo: (branch: BranchRecord) => readonly HowToStep[]
  /** One HUD line. Empty string hides it. */
  formatStats: (metrics: readonly HudMetric[]) => string
  /**
   * Plain words for what this branch changed, or the current tunables when
   * there is no parent. Null hides the line. Add a label here for a new knob.
   */
  describeBranchDiff: (branch: BranchRecord, parent: BranchRecord | null) => string | null
  /** Extra overlay line, for rules that are off on the root. Null hides it. */
  overlayNote: (branch: BranchRecord) => string | null
}

export type HowToVisualProps = {
  reducedMotion: boolean
}

export type GameRendererProps = {
  branch: BranchRecord
  onHud: (hud: HudState) => void
  onReady: () => void
  registerAsk: (handlers: AskHandlers) => void
  /** True while a pause or how-to overlay is open. Games must not advance. */
  paused?: boolean
  /** Tunables already applied for this visit. Undefined until the next respawn or round. */
  tweaks?: Record<string, number>
  /** Called when the platformer respawns, or when words starts another round. */
  onLife?: () => void
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
  themeClass: GameThemeClass
  theme: GameTheme
  copy: GameCopy
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
