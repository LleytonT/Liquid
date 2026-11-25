export type AskKind = "tweak" | "content" | "branch"
export type AskSource = "gateway" | "fallback"

export type AskPlan = {
  kind: AskKind
  /** Present only when kind is tweak and the patch passed validation. */
  patch?: Record<string, number>
  line: string
  source: AskSource
}

type KnobRule = {
  min: number
  max: number
  /** Optional extra check. Return a clamped value or null to reject the key. */
  clamp?: (value: number) => number | null
}

const PLATFORMER: Record<string, KnobRule> = {
  playerSpeed: { min: 100, max: 140 },
  playerVisualPx: { min: 24, max: 32 },
  enemyVisualRadiusPx: { min: 6, max: 16 },
  coinRadiusPx: { min: 8, max: 16 },
  enemySpeedScale: { min: 0.45, max: 1.5 },
}

const WORDS: Record<string, KnobRule> = {
  guesses: { min: 3, max: 10 },
  timerSeconds: {
    min: 0,
    max: 300,
    clamp: (value) => {
      if (value <= 0) return 0
      if (value < 30) return 30
      return Math.min(300, value)
    },
  },
  hardMode: {
    min: 0,
    max: 1,
    clamp: (value) => (value >= 0.5 ? 1 : 0),
  },
  staggerMs: { min: 200, max: 400 },
  roundEndMs: { min: 1000, max: 3000 },
}

export function rulesFor(gameId: string): Record<string, KnobRule> | null {
  if (gameId === "platformer") return PLATFORMER
  if (gameId === "words") return WORDS
  return null
}

function clampKnob(rule: KnobRule, value: number): number | null {
  if (!Number.isFinite(value)) return null
  if (rule.clamp) return rule.clamp(value)
  return Math.min(rule.max, Math.max(rule.min, value))
}

/** Drop unknown keys. Clamp the rest. Empty means the tweak cannot run. */
export function sanitizePatch(gameId: string, patch: Record<string, unknown>): Record<string, number> | null {
  const rules = rulesFor(gameId)
  if (!rules) return null
  const next: Record<string, number> = {}
  for (const [key, value] of Object.entries(patch)) {
    const rule = rules[key]
    if (!rule || typeof value !== "number") continue
    const clamped = clampKnob(rule, value)
    if (clamped === null) continue
    next[key] = clamped
  }
  return Object.keys(next).length > 0 ? next : null
}

export function notLiveLine(gameId: string): string {
  const sample = gameId === "words" ? "give me 8 guesses" : "make the blue shapes slower"
  return `new levels and branches aren't live yet. try a tweak like ${sample}.`
}

export function describePatch(gameId: string, patch: Record<string, number>): string {
  const parts: string[] = []
  if (gameId === "platformer") {
    if (patch.enemySpeedScale !== undefined) {
      parts.push(patch.enemySpeedScale < 1 ? "blue shapes move slower" : "blue shapes move faster")
    }
    if (patch.playerSpeed !== undefined) {
      parts.push(patch.playerSpeed < 120 ? "you move slower" : patch.playerSpeed > 120 ? "you move faster" : "you move at normal speed")
    }
    if (patch.coinRadiusPx !== undefined) parts.push(patch.coinRadiusPx >= 12 ? "bigger coins" : "smaller coins")
    if (patch.enemyVisualRadiusPx !== undefined) {
      parts.push(patch.enemyVisualRadiusPx >= 8 ? "bigger dots" : "smaller dots")
    }
    if (patch.playerVisualPx !== undefined) parts.push(patch.playerVisualPx >= 28 ? "a bigger square" : "a smaller square")
  }
  if (gameId === "words") {
    if (patch.guesses !== undefined) parts.push(`${patch.guesses} guesses`)
    if (patch.timerSeconds !== undefined) {
      parts.push(patch.timerSeconds <= 0 ? "no time limit" : `a ${patch.timerSeconds} second timer`)
    }
    if (patch.hardMode !== undefined) parts.push(patch.hardMode >= 1 ? "hard mode is on" : "hard mode is off")
  }
  return parts.join(", ")
}

function tweak(gameId: string, patch: Record<string, number>, source: AskSource): AskPlan {
  const clean = sanitizePatch(gameId, patch)
  if (!clean) return { kind: "content", line: notLiveLine(gameId), source }
  return { kind: "tweak", patch: clean, line: describePatch(gameId, clean), source }
}

/** Small deterministic reading of common asks. Used when the model is unavailable. */
export function fallbackPlan(gameId: string, ask: string): AskPlan {
  const text = ask.toLowerCase()
  const content = /\b(level|levels|branch|branches|jump|gap|safe zone|word list|new word)\b/.test(text)
  const branch = /\bbranch/.test(text)
  if (!content && gameId === "platformer") {
    const aboutBlue = /(blue|dot|dots|enemy|enemies|shape|shapes)/.test(text)
    const aboutYou = /(player|square|\bme\b|\bi\b|myself)/.test(text)
    if (aboutBlue && /(slow|slower)/.test(text)) return tweak(gameId, { enemySpeedScale: 0.55 }, "fallback")
    if (aboutBlue && /(fast|faster)/.test(text)) return tweak(gameId, { enemySpeedScale: 1.4 }, "fallback")
    if (aboutYou && /(slow|slower)/.test(text)) return tweak(gameId, { playerSpeed: 100 }, "fallback")
    if (aboutYou && /(fast|faster)/.test(text)) return tweak(gameId, { playerSpeed: 140 }, "fallback")
  }
  if (gameId === "words") {
    const numbered = text.match(/\b(\d+)\s+guess/)
    if (numbered) return tweak(gameId, { guesses: Number(numbered[1]) }, "fallback")
    if (/(more guesses|extra guesses|eight guesses|8 guesses)/.test(text)) return tweak(gameId, { guesses: 8 }, "fallback")
    if (/(fewer guesses|less guesses)/.test(text)) return tweak(gameId, { guesses: 5 }, "fallback")
    if (/(no timer|timer off|without a timer)/.test(text)) return tweak(gameId, { timerSeconds: 0 }, "fallback")
    if (/hard mode/.test(text)) return tweak(gameId, { hardMode: /off|disable/.test(text) ? 0 : 1 }, "fallback")
    const seconds = text.match(/(\d+)\s*(?:second|sec)/)
    if (seconds && /timer|time/.test(text)) return tweak(gameId, { timerSeconds: Number(seconds[1]) }, "fallback")
  }
  return {
    kind: branch ? "branch" : "content",
    line: notLiveLine(gameId),
    source: "fallback",
  }
}

export function acceptModelPlan(
  gameId: string,
  model: { kind?: string; patch?: Record<string, unknown> },
): AskPlan {
  if (model.kind === "tweak" && model.patch && typeof model.patch === "object") {
    const clean = sanitizePatch(gameId, model.patch)
    if (clean) return { kind: "tweak", patch: clean, line: describePatch(gameId, clean), source: "gateway" }
  }
  return {
    kind: model.kind === "branch" ? "branch" : "content",
    line: notLiveLine(gameId),
    source: "gateway",
  }
}
