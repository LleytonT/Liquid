import type { BranchRecord, GameCopy, HudMetric } from "@/lib/shell/game-module"

const GUESS_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]

function guessPhrase(value: number): string {
  const name = GUESS_WORDS[value] ?? String(value)
  return `${name} guesses`
}

/** Player-facing knob labels. Add a phrase here when a tunable should show up in the diff. */
const TUNABLE_LABELS: Record<string, (value: number) => string | null> = {
  guesses: guessPhrase,
  timerSeconds: (value) => (value > 0 ? `a ${value} second timer` : "no time limit"),
  hardMode: (value) => (value > 0 ? "hard mode is on" : "hard mode is off"),
  length: (value) => `${value} letters`,
  staggerMs: (value) => `tiles reveal ${value > 280 ? "more slowly" : "more quickly"}`,
  roundEndMs: (value) => (value === 1500 ? "a normal pause between rounds" : "a different pause between rounds"),
}

const ROOT_LINE = ["guesses", "timerSeconds"]

function metric(metrics: readonly HudMetric[], id: string): string {
  return metrics.find((item) => item.id === id)?.value ?? ""
}

export const WORDS_TWEAK_CHIPS = ["give me 8 guesses", "fewer guesses", "a 60 second timer"] as const

export const wordsCopy: GameCopy = {
  remixBlurb:
    "tweaks like speed, guesses or timer apply on your next try and stay in this browser. new levels aren't live yet.",
  askPlaceholder: "ask for a twist, e.g. give me 8 guesses",
  pulseChip: "give me 8 guesses",
  firstRunHint: "type a word, press enter",
  hintFadeMs: 5000,
  howTo: (branch) => {
    const guesses = branch.snapshot.tunables.guesses?.value ?? 6
    return [
      { id: "guess", copy: `guess the word in ${guesses} tries` },
      { id: "states", copy: "" },
      { id: "remix", copy: "ask for a tweak. it applies on your next try and stays in this browser." },
    ]
  },
  formatStats: (metrics) => {
    if (metrics.length === 0) return ""
    const time = metric(metrics, "time")
    const clock = time ? ` · ${time}` : ""
    return `round ${metric(metrics, "round")} · streak ${metric(metrics, "streak")} · ${metric(metrics, "score")} pts${clock}`
  },
  describeBranchDiff: (branch, parent) => describeWordsDiff(branch, parent),
  overlayNote: (branch) =>
    branch.snapshot.tunables.hardMode?.value ? "hard mode: use every revealed hint" : null,
}

export function describeWordsDiff(branch: BranchRecord, parent: BranchRecord | null): string | null {
  const next = branch.snapshot.tunables
  if (!parent) {
    const parts = ROOT_LINE.map((id) => {
      const knob = next[id]
      const label = TUNABLE_LABELS[id]
      return knob && label ? label(knob.value) : null
    }).filter((part): part is string => Boolean(part))
    return parts.length > 0 ? parts.join(", ") : null
  }
  const parts: string[] = []
  for (const [id, label] of Object.entries(TUNABLE_LABELS)) {
    const knob = next[id]
    const previous = parent.snapshot.tunables[id]
    if (!knob || knob.locked) continue
    if (!previous || previous.value !== knob.value) {
      const phrase = label(knob.value)
      if (phrase) parts.push(phrase)
    }
  }
  return parts.length > 0 ? parts.join(", ") : null
}
