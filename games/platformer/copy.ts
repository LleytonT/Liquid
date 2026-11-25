import type { BranchRecord, GameCopy, HudMetric } from "@/lib/shell/game-module"

const NORMAL_SPEED = 120

function speedPhrase(value: number, previous?: number): string {
  if (previous === undefined) {
    if (value === NORMAL_SPEED) return "you move at normal speed"
    if (value > NORMAL_SPEED) return "you move faster than normal"
    return "you move slower than normal"
  }
  if (value > previous) return "you move faster"
  if (value < previous) return "you move slower"
  return "you move at the same speed"
}

function sizePhrase(value: number, previous: number | undefined, bigger: string, smaller: string, same: string): string {
  const baseline = previous ?? value
  if (value > baseline) return bigger
  if (value < baseline) return smaller
  return same
}

function metric(metrics: readonly HudMetric[], id: string): string {
  return metrics.find((item) => item.id === id)?.value ?? ""
}

export const PLATFORMER_TWEAK_CHIPS = [
  "make the blue shapes slower",
  "make the blue dots faster",
  "make the square slower",
] as const

export const platformerCopy: GameCopy = {
  remixBlurb:
    "tweaks like speed, guesses or timer apply on your next try and stay in this browser. new levels aren't live yet.",
  askPlaceholder: "ask for a twist, e.g. make the blue shapes slower",
  pulseChip: "make the blue shapes slower",
  firstRunHint: "reach green with every coin",
  hintFadeMs: 5000,
  howTo: () => [
    { id: "move", copy: "move with arrows or wasd" },
    { id: "dodge", copy: "dodge the blue dots" },
    { id: "deaths", copy: "deaths count each time you are hit. you respawn at the start." },
    { id: "goal", copy: "grab every coin, then reach green" },
    { id: "remix", copy: "ask for a tweak. it applies on your next try and stays in this browser." },
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
  const previous = parent?.snapshot.tunables
  const parts: string[] = []
  const speed = next.playerSpeed
  if (speed && (!previous || !previous.playerSpeed || previous.playerSpeed.value !== speed.value || !parent)) {
    parts.push(speedPhrase(speed.value, previous?.playerSpeed?.value))
  }
  const coin = next.coinRadiusPx
  if (coin && previous?.coinRadiusPx && coin.value !== previous.coinRadiusPx.value) {
    parts.push(sizePhrase(coin.value, previous.coinRadiusPx.value, "bigger coins", "smaller coins", "the same coins"))
  }
  const dots = next.enemyVisualRadiusPx
  if (dots && previous?.enemyVisualRadiusPx && dots.value !== previous.enemyVisualRadiusPx.value) {
    parts.push(sizePhrase(dots.value, previous.enemyVisualRadiusPx.value, "bigger dots", "smaller dots", "the same dots"))
  }
  const square = next.playerVisualPx
  if (square && previous?.playerVisualPx && square.value !== previous.playerVisualPx.value) {
    parts.push(sizePhrase(square.value, previous.playerVisualPx.value, "a bigger square", "a smaller square", "the same square"))
  }
  if (!parent && parts.length === 0 && speed) parts.push(speedPhrase(speed.value))
  return parts.length > 0 ? parts.join(", ") : null
}
