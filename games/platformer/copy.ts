import type { BranchRecord, GameCopy, HudMetric } from "@/lib/shell/game-module"

const TUNABLE_LABELS: Record<string, (value: number) => string> = {
  playerSpeed: (value) => `player ${value} px/s`,
  coinRadiusPx: (value) => `coins ${value} px`,
  enemyVisualRadiusPx: (value) => `dots ${value} px`,
  playerVisualPx: (value) => `square ${value} px`,
}

function metric(metrics: readonly HudMetric[], id: string): string {
  return metrics.find((item) => item.id === id)?.value ?? ""
}

export const platformerCopy: GameCopy = {
  remixBlurb:
    "anyone can ask for a twist. it becomes your own branch. a merge waits for the owner and a play-test.",
  askPlaceholder: "ask for a twist. makes your branch",
  pulseChip: "you can change this game",
  firstRunHint: "reach green with every coin",
  hintFadeMs: 5000,
  howTo: () => [
    { id: "move", copy: "move with arrows or wasd" },
    { id: "dodge", copy: "dodge the blue dots" },
    { id: "goal", copy: "grab every coin, then reach green" },
    { id: "remix", copy: "anyone can ask for a twist. it becomes your own branch." },
  ],
  formatStats: (metrics) => {
    if (metrics.length === 0) return ""
    return `level ${metric(metrics, "level")}/${metric(metrics, "levels")} · coins ${metric(metrics, "coins")} · deaths ${metric(metrics, "deaths")}`
  },
  describeBranchDiff: (branch, parent) => describePlatformerDiff(branch, parent),
  overlayNote: () => null,
}

/** Persistent HUD line. Ink on the theme background, not a red/green cue. */
export const PLATFORMER_GOAL = "grab every coin, reach the green zone, dodge the blue"

/** Labels for knobs a player can feel. Locked hitboxes stay out of the line. */
export function describePlatformerDiff(branch: BranchRecord, parent: BranchRecord | null): string | null {
  const next = branch.snapshot.tunables
  if (!parent) {
    const speed = next.playerSpeed
    return speed ? TUNABLE_LABELS.playerSpeed(speed.value) : null
  }
  const parts: string[] = []
  for (const [id, label] of Object.entries(TUNABLE_LABELS)) {
    const knob = next[id]
    const previous = parent.snapshot.tunables[id]
    if (!knob || knob.locked) continue
    if (!previous || previous.value !== knob.value) parts.push(label(knob.value))
  }
  return parts.length > 0 ? parts.join(", ") : null
}
