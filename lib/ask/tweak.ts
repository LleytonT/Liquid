export type AskKind = "tweak" | "content" | "branch"
export type AskSource = "gateway" | "fallback"

export type AskPlan = {
  kind: AskKind
  /** Present only when kind is tweak and the patch passed validation. */
  patch?: Record<string, number>
  line: string
  source: AskSource
  /** Set only when the gateway call failed and the matcher was used. */
  gatewayError?: string
  /** Old value, new value, and when it takes effect. Fallback says the model was unavailable. */
  trace?: string[]
}

export const FALLBACK_NOTE = "the model was unavailable, used a simple match"

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
  enemySpeedScale: { min: 0.45, max: 2.5 },
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

const BASELINE: Record<string, Record<string, number>> = {
  platformer: {
    playerSpeed: 120,
    playerVisualPx: 28,
    enemyVisualRadiusPx: 8,
    coinRadiusPx: 12,
    enemySpeedScale: 1,
  },
  words: {
    guesses: 6,
    timerSeconds: 0,
    hardMode: 0,
    staggerMs: 280,
    roundEndMs: 1500,
  },
}

export function currentValues(gameId: string, current?: Record<string, number>): Record<string, number> {
  const base = { ...(BASELINE[gameId] ?? {}) }
  if (!current) return base
  for (const [key, value] of Object.entries(current)) {
    if (typeof value === "number" && Number.isFinite(value)) base[key] = value
  }
  return base
}

/** A refusal names the kind of change, instead of one line for every miss. */
export function refusalLine(ask: string): string {
  const text = ask.toLowerCase()
  if (/\b(jump|jumping|higher|new move|moves)\b/.test(text)) return "jumping higher isn't a change this game can make."
  if (/\b(multiplayer|two players|2 players|co-op|coop)\b/.test(text)) return "multiplayer isn't live."
  if (/\b(weather|rain|snow|art|palette|colour|color)\b/.test(text)) return "weather and art aren't changes you can ask for."
  if (/\b(easier|easy)\b/.test(text) && /\blevel/.test(text)) return "easier levels aren't live yet."
  if (/\b(level|levels)\b/.test(text)) return "new levels aren't live yet."
  return "that change isn't live yet. try a tweak like speed, guesses, or the timer."
}

function times(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return String(rounded)
}

function enemyPhrase(value: number, requested: number): string {
  const pace = value === 1 ? "at the same speed" : value > 1 ? `${times(value)}x faster` : `${times(value)}x as fast`
  const line = `blue shapes move ${pace}`
  if (requested === value) return line
  return `${line}. ${times(requested)}x is past the limit`
}

function alreadyPhrase(key: string, value: number): string {
  if (key === "enemySpeedScale") {
    if (value === 1) return "blue shapes already move at normal speed"
    return value > 1 ? `blue shapes already move ${times(value)}x faster` : `blue shapes already move ${times(value)}x as fast`
  }
  if (key === "guesses") return `guesses are already ${times(value)}`
  if (key === "playerSpeed") return value === 120 ? "you already move at normal speed" : value < 120 ? "you already move slower" : "you already move faster"
  if (key === "timerSeconds") return value <= 0 ? "there is already no time limit" : `the timer is already ${times(value)} seconds`
  if (key === "hardMode") return value >= 1 ? "hard mode is already on" : "hard mode is already off"
  return `${key} is already ${times(value)}`
}

function limitNote(requested: number, value: number): string {
  if (requested === value) return ""
  return `. ${times(requested)} is past the limit`
}

export function describePatch(gameId: string, patch: Record<string, number>, requested: Record<string, number> = patch): string {
  const parts: string[] = []
  if (gameId === "platformer") {
    if (patch.enemySpeedScale !== undefined) {
      parts.push(enemyPhrase(patch.enemySpeedScale, requested.enemySpeedScale ?? patch.enemySpeedScale))
    }
    if (patch.playerSpeed !== undefined) {
      const value = patch.playerSpeed
      const asked = requested.playerSpeed ?? value
      const pace = value < 120 ? "you move slower" : value > 120 ? "you move faster" : "you move at normal speed"
      parts.push(`${pace}${limitNote(asked, value)}`)
    }
    if (patch.coinRadiusPx !== undefined) {
      const value = patch.coinRadiusPx
      parts.push(`${value >= 12 ? "bigger coins" : "smaller coins"}${limitNote(requested.coinRadiusPx ?? value, value)}`)
    }
    if (patch.enemyVisualRadiusPx !== undefined) {
      const value = patch.enemyVisualRadiusPx
      parts.push(`${value >= 8 ? "bigger dots" : "smaller dots"}${limitNote(requested.enemyVisualRadiusPx ?? value, value)}`)
    }
    if (patch.playerVisualPx !== undefined) {
      const value = patch.playerVisualPx
      parts.push(`${value >= 28 ? "a bigger square" : "a smaller square"}${limitNote(requested.playerVisualPx ?? value, value)}`)
    }
  }
  if (gameId === "words") {
    if (patch.guesses !== undefined) {
      const value = patch.guesses
      parts.push(`${times(value)} guesses${limitNote(requested.guesses ?? value, value)}`)
    }
    if (patch.timerSeconds !== undefined) {
      const value = patch.timerSeconds
      const asked = requested.timerSeconds ?? value
      const phrase = value <= 0 ? "no time limit" : `a ${times(value)} second timer`
      parts.push(`${phrase}${asked === value ? "" : `. ${times(asked)} seconds is past the limit`}`)
    }
    if (patch.hardMode !== undefined) parts.push(patch.hardMode >= 1 ? "hard mode is on" : "hard mode is off")
  }
  return parts.join(", ")
}

function numberFrom(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value)
  return null
}

export function rawPatch(input: Record<string, unknown> | undefined): Record<string, number> {
  const raw: Record<string, number> = {}
  if (!input) return raw
  for (const [key, value] of Object.entries(input)) {
    const number = numberFrom(value)
    if (number !== null) raw[key] = number
  }
  return raw
}

/** Keep a real change. An equal result says what is already set, and does not pretend it changed. */
export function planFromRaw(
  gameId: string,
  ask: string,
  raw: Record<string, number>,
  source: AskSource,
  current?: Record<string, number>,
): AskPlan {
  const now = currentValues(gameId, current)
  const clean = sanitizePatch(gameId, raw)
  if (!clean) return { kind: "content", line: refusalLine(ask), source }
  const changed: Record<string, number> = {}
  const requested: Record<string, number> = {}
  const same: string[] = []
  for (const [key, value] of Object.entries(clean)) {
    requested[key] = raw[key] ?? value
    if (now[key] === value) same.push(key)
    else changed[key] = value
  }
  if (Object.keys(changed).length === 0) {
    const detail = same.map((key) => alreadyPhrase(key, now[key] ?? clean[key]!)).join(". ")
    const line = `nothing changed. ${detail.endsWith(".") ? detail : `${detail}.`}`
    return { kind: "content", line, source }
  }
  const changedRequested: Record<string, number> = {}
  for (const key of Object.keys(changed)) changedRequested[key] = requested[key] ?? changed[key]!
  return { kind: "tweak", patch: changed, line: describePatch(gameId, changed, changedRequested), source }
}

function askedScale(text: string): number | null {
  const slower = /\b(slow|slower)\b/.test(text) && !/\b(fast|faster)\b/.test(text)
  if (/\bhalf\b/.test(text)) return 0.5
  if (/\b(twice|double|two times|2x)\b/.test(text)) return slower ? 0.5 : 2
  if (/\b(triple|three times|3x)\b/.test(text)) return slower ? 1 / 3 : 3
  const match = text.match(/(\d+(?:\.\d+)?)\s*x\b/)
  if (!match) return null
  const amount = Number(match[1])
  return slower ? 1 / amount : amount
}

/** Small deterministic reading of common asks. Used only when the gateway errors or times out. */
export function fallbackPlan(gameId: string, ask: string, current?: Record<string, number>): AskPlan {
  const text = ask.toLowerCase()
  const content = /\b(level|levels|branch|branches|jump|gap|safe zone|word list|new word|multiplayer|weather|rain|snow|art)\b/.test(text)
  const branch = /\bbranch/.test(text)
  if (!content && gameId === "platformer") {
    const aboutBlue = /(blue|dot|dots|enemy|enemies|shape|shapes)/.test(text)
    const aboutYou = /(player|square|\bme\b|\bi\b|myself)/.test(text)
    const aboutPace = /(fast|slow|speed|quick)/.test(text)
    const scale = askedScale(text)
    if (aboutYou && /(slow|slower)/.test(text)) return planFromRaw(gameId, ask, { playerSpeed: 100 }, "fallback", current)
    if (aboutYou && /(fast|faster)/.test(text)) return planFromRaw(gameId, ask, { playerSpeed: 140 }, "fallback", current)
    if (!aboutYou && scale !== null) return planFromRaw(gameId, ask, { enemySpeedScale: scale }, "fallback", current)
    if (!aboutYou && /(fast|faster)/.test(text)) return planFromRaw(gameId, ask, { enemySpeedScale: 1.4 }, "fallback", current)
    if ((aboutBlue || aboutPace) && /(slow|slower)/.test(text)) {
      return planFromRaw(gameId, ask, { enemySpeedScale: 0.55 }, "fallback", current)
    }
  }
  if (!content && gameId === "words") {
    const now = currentValues(gameId, current)
    const numbered = text.match(/\b(\d+)\s+guess/)
    if (numbered) return planFromRaw(gameId, ask, { guesses: Number(numbered[1]) }, "fallback", current)
    if (/(more guesses|extra guesses|eight guesses|8 guesses)/.test(text)) {
      const guesses = /eight|8/.test(text) ? 8 : Math.min(10, (now.guesses ?? 6) + 2)
      return planFromRaw(gameId, ask, { guesses }, "fallback", current)
    }
    if (/(fewer guesses|less guesses)/.test(text)) {
      return planFromRaw(gameId, ask, { guesses: Math.max(3, (now.guesses ?? 6) - 1) }, "fallback", current)
    }
    if (/(no timer|timer off|without a timer)/.test(text)) return planFromRaw(gameId, ask, { timerSeconds: 0 }, "fallback", current)
    if (/hard mode/.test(text)) {
      return planFromRaw(gameId, ask, { hardMode: /off|disable/.test(text) ? 0 : 1 }, "fallback", current)
    }
    const seconds = text.match(/(\d+)\s*(?:second|sec)/)
    if (seconds && /timer|time/.test(text)) {
      return planFromRaw(gameId, ask, { timerSeconds: Number(seconds[1]) }, "fallback", current)
    }
  }
  return {
    kind: branch ? "branch" : "content",
    line: refusalLine(ask),
    source: "fallback",
  }
}

export function withTrace(gameId: string, plan: AskPlan, current?: Record<string, number>): AskPlan {
  const now = currentValues(gameId, current)
  const when = gameId === "words" ? "the next round" : "respawn"
  const trace: string[] = []
  if (plan.source === "fallback") trace.push(FALLBACK_NOTE)
  if (plan.patch) {
    for (const [key, value] of Object.entries(plan.patch)) {
      trace.push(`${key} ${now[key] ?? "unset"} -> ${value}`)
    }
    trace.push(`takes effect on ${when}`)
  } else {
    trace.push(plan.line)
  }
  return { ...plan, trace }
}

export function acceptModelPlan(
  gameId: string,
  ask: string,
  model: { kind?: string; patch?: Record<string, unknown> },
  current?: Record<string, number>,
): AskPlan {
  if (model.kind === "tweak" && model.patch && typeof model.patch === "object") {
    const raw = rawPatch(model.patch)
    if (Object.keys(raw).length > 0) return planFromRaw(gameId, ask, raw, "gateway", current)
  }
  return {
    kind: model.kind === "branch" ? "branch" : "content",
    line: refusalLine(ask),
    source: "gateway",
  }
}
