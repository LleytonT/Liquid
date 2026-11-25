import type { GameAdapter, TweakKnob } from "./contract"
import { modelOutputSchema, parseModelOutput, parseModelText } from "./model-output"

export const ASK_MODEL = "openai/gpt-5-mini"
export const CLARIFY_BELOW = 0.6
export const CLARIFY_QUESTION = "Do you want a number change, new content, or a new mechanic?"

export type AskRoute = "tweak" | "content" | "branch" | "clarify"
export type AskSource = "gateway" | "fallback"

export type AskPlan = {
  readonly summary: string
  readonly patch?: Readonly<Record<string, number>>
  readonly question?: string
  readonly source: AskSource
  /** True when the numbers would not change. The ask does not become a branch. */
  readonly noop?: boolean
  /** Set only when the gateway call failed and the matcher was used. */
  readonly gatewayError?: string
}

export type RouteResult = {
  readonly route: AskRoute
  readonly confidence: number
  readonly plan: AskPlan
}

export type ModelPlan = {
  kind?: string
  patch?: Record<string, unknown>
  /** Player-facing reason from the model, when it has one. */
  reason?: string
}

export type ModelComplete = (input: { gameId: string; ask: string; system: string }) => Promise<ModelPlan>

const MECHANIC = /\b(mechanic|mechanics|double jump|dash|ability|new move|power-?up)\b/
const BRANCH_WORD = /\bbranches?\b/
const CONTENT = /\b(levels?|gaps?|safe zone|word list|new word|jump|rooms?|multiplayer|weather|rain|snow|art)\b/

const CONFIDENCE = {
  hint: 0.93,
  modelTweak: 0.88,
  content: 0.86,
  branch: 0.84,
  clarify: 0.34,
} as const

function clampKnob(knob: TweakKnob, value: number): number | null {
  if (!Number.isFinite(value)) return null
  if (knob.clamp) return knob.clamp(value)
  return Math.min(knob.max, Math.max(knob.min, value))
}

/** Drop unknown keys. Clamp the rest. Empty means the tweak cannot run. */
export function sanitizePatch(
  adapter: GameAdapter,
  patch: Record<string, unknown>,
): Record<string, number> | null {
  const next: Record<string, number> = {}
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value !== "number") continue
    const knob = adapter.tweaks.find((item) => item.key === key)
    if (!knob) continue
    const clamped = clampKnob(knob, value)
    if (clamped === null || !Number.isFinite(clamped) || clamped < knob.min || clamped > knob.max) continue
    next[key] = clamped
  }
  return Object.keys(next).length > 0 ? next : null
}

export function currentValues(adapter: GameAdapter, current?: Record<string, number>): Record<string, number> {
  const base = { ...adapter.baseline }
  if (!current) return base
  for (const [key, value] of Object.entries(current)) {
    if (typeof value === "number" && Number.isFinite(value)) base[key] = value
  }
  return base
}

function summaryFor(
  adapter: GameAdapter,
  patch: Record<string, number>,
  requested?: Record<string, number>,
): string {
  const described = adapter.describePatch(patch, requested).trim()
  if (described) return described
  return Object.entries(patch)
    .map(([key, value]) => `${key} ${value}`)
    .join(", ")
}

function systemPrompt(adapter: GameAdapter, current: Record<string, number>): string {
  const keys = adapter.tweaks
    .map((knob) => `${knob.key} ${knob.min}-${knob.max}${knob.note ? ` (${knob.note})` : ""}`)
    .join(", ")
  const now = Object.entries(current)
    .map(([key, value]) => `${key} ${value}`)
    .join(", ")
  return [
    "You plan a one-line change to a small game.",
    `Current numbers: ${now}.`,
    "kind tweak only when the ask changes one of these numbers:",
    keys,
    "Use the magnitude the player asked for. Do not substitute a default.",
    "If the number is outside the range, still return the number they asked for.",
    "kind content for new moves, jumps, levels, multiplayer, weather, or art.",
    "kind branch for a new mechanic or a new version other people would play.",
    "Do not invent keys. Leave patch empty unless kind is tweak.",
    "patch values are numbers.",
  ].join(" ")
}

function matchHint(
  ask: string,
  adapter: GameAdapter,
): { patch: Record<string, number> } | null {
  const text = ask.toLowerCase()
  for (const hint of adapter.fallbackHints) {
    let match: RegExpExecArray | null
    try {
      match = new RegExp(hint.pattern, "i").exec(text)
    } catch {
      continue
    }
    if (!match) continue
    const patch: Record<string, number> = { ...hint.patch }
    if (hint.capture && match[1] !== undefined) {
      const captured = Number(match[1])
      if (!Number.isFinite(captured)) continue
      patch[hint.capture] = captured
    }
    return { patch }
  }
  return null
}

function tweakResult(
  adapter: GameAdapter,
  patch: Record<string, number>,
  source: AskSource,
  confidence: number,
  requested?: Record<string, number>,
): RouteResult {
  return {
    route: "tweak",
    confidence,
    plan: { summary: summaryFor(adapter, patch, requested), patch, source },
  }
}

function contentResult(adapter: GameAdapter, ask: string, source: AskSource): RouteResult {
  const summary =
    adapter.refusal(ask) ||
    adapter.content?.plan(ask).summary ||
    `this isn't built yet. new levels and branches aren't live yet. try a tweak like ${adapter.exampleTweak}.`
  return { route: "content", confidence: CONFIDENCE.content, plan: { summary, source } }
}

/** Keep a real change. An equal result says what is already set, and does not pretend it changed. */
export function planFromNumbers(
  adapter: GameAdapter,
  ask: string,
  raw: Record<string, number>,
  source: AskSource,
  current?: Record<string, number>,
): RouteResult {
  const now = currentValues(adapter, current)
  const clean = sanitizePatch(adapter, raw)
  if (!clean) return contentResult(adapter, ask, source)
  const changed: Record<string, number> = {}
  const requested: Record<string, number> = {}
  const same: string[] = []
  for (const [key, value] of Object.entries(clean)) {
    requested[key] = raw[key] ?? value
    if (now[key] === value) same.push(key)
    else changed[key] = value
  }
  if (Object.keys(changed).length === 0) {
    const line = same.map((key) => adapter.already(key, now[key] ?? clean[key]!)).join(". ")
    const summary = line.endsWith(".") ? line : `${line}.`
    return {
      route: "clarify",
      confidence: CONFIDENCE.clarify,
      plan: { summary, question: summary, source, noop: true },
    }
  }
  const changedRequested: Record<string, number> = {}
  for (const key of Object.keys(changed)) changedRequested[key] = requested[key] ?? changed[key]!
  const confidence = source === "gateway" ? CONFIDENCE.modelTweak : CONFIDENCE.hint
  return tweakResult(adapter, changed, source, confidence, changedRequested)
}

function branchResult(source: AskSource): RouteResult {
  return {
    route: "branch",
    confidence: CONFIDENCE.branch,
    plan: { summary: "this isn't built yet. a new mechanic isn't live yet.", source },
  }
}

function clarify(source: AskSource): RouteResult {
  return {
    route: "clarify",
    confidence: CONFIDENCE.clarify,
    plan: { summary: CLARIFY_QUESTION, question: CLARIFY_QUESTION, source },
  }
}

const ASK_TIMEOUT_MS = 15_000

/** Word list. Used only after the gateway throws. A successful model reply never reaches this. */
export function fallbackRoute(
  adapter: GameAdapter,
  ask: string,
  current?: Record<string, number>,
): RouteResult {
  const now = currentValues(adapter, current)
  const interpreted = adapter.interpret?.(ask, now) ?? null
  const hinted = interpreted ? { patch: interpreted } : matchHint(ask, adapter)
  if (hinted) {
    const planned = planFromNumbers(adapter, ask, hinted.patch, "fallback", current)
    if (planned.route === "tweak" || planned.plan.noop) return planned
  }
  const text = ask.toLowerCase()
  if (MECHANIC.test(text) || BRANCH_WORD.test(text)) return branchResult("fallback")
  if (CONTENT.test(text)) return contentResult(adapter, ask, "fallback")
  return clarify("fallback")
}

function statedReason(model: ModelPlan): string | null {
  const reason = model.reason?.trim()
  return reason ? reason : null
}

function notBuilt(reason: string | null, fallback: string): string {
  if (!reason) return fallback
  if (/isn't built yet|aren't live yet|not live/i.test(reason)) return reason
  return `${reason} this isn't built yet.`
}

function refuse(reason: string): RouteResult {
  return {
    route: "clarify",
    confidence: CONFIDENCE.clarify,
    plan: { summary: reason, question: reason, source: "gateway", noop: true },
  }
}

/** Apply a model object. Synchronous so a shell test can check a recorded payload without a gateway call. */
export function applyModelPlan(
  adapter: GameAdapter,
  ask: string,
  model: ModelPlan,
  current?: Record<string, number>,
): RouteResult {
  const parsed = parseModelOutput(model)
  const reason = statedReason(model)
  const kind = parsed.kind ?? (Object.keys(parsed.patch).length > 0 ? "tweak" : "content")
  if (kind === "tweak") {
    if (Object.keys(parsed.patch).length > 0) {
      const planned = planFromNumbers(adapter, ask, parsed.patch, "gateway", current)
      if (planned.route === "tweak" || planned.plan.noop) return planned
      return refuse(reason ?? "none of those numbers are on this game.")
    }
    return refuse(reason ?? adapter.refusal(ask))
  }
  if (kind === "branch") {
    return {
      route: "branch",
      confidence: CONFIDENCE.branch,
      plan: {
        summary: notBuilt(reason, "this isn't built yet. a new mechanic isn't live yet."),
        source: "gateway",
      },
    }
  }
  return {
    route: "content",
    confidence: CONFIDENCE.content,
    plan: { summary: notBuilt(reason, adapter.refusal(ask)), source: "gateway" },
  }
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
}

async function askOnce(input: { gameId: string; ask: string; system: string }): Promise<ModelPlan> {
  const { generateText, NoObjectGeneratedError, Output } = await import("ai")
  try {
    const { output } = await generateText({
      model: ASK_MODEL,
      output: Output.object({ schema: modelOutputSchema }),
      system: input.system,
      prompt: input.ask,
      timeout: ASK_TIMEOUT_MS,
      abortSignal: AbortSignal.timeout(ASK_TIMEOUT_MS),
      providerOptions: {
        openai: { reasoningEffort: "low" },
      },
    })
    if (!output) throw new Error("the model returned nothing")
    return parseModelOutput(output)
  } catch (error) {
    const text = error instanceof NoObjectGeneratedError ? error.text : undefined
    if (text) {
      try {
        return parseModelText(text)
      } catch {
        // The text was not a plan. Let the caller retry a timeout or fall back.
      }
    }
    throw error
  }
}

async function gatewayComplete(input: { gameId: string; ask: string; system: string }): Promise<ModelPlan> {
  try {
    return await askOnce(input)
  } catch (error) {
    if (!isTimeout(error)) throw error
    return await askOnce(input)
  }
}

/**
 * The model answers first. The word matcher runs only when that call throws.
 * A tweak that does not change a number is a no-op, not a guessed patch.
 * Below `CLARIFY_BELOW`, the route is clarify and `plan.question` is the one question.
 */
export async function routeAsk(
  adapter: GameAdapter,
  ask: string,
  complete: ModelComplete = gatewayComplete,
  current?: Record<string, number>,
): Promise<RouteResult> {
  const text = ask.trim()
  const now = currentValues(adapter, current)
  try {
    const model = await complete({ gameId: adapter.id, ask: text, system: systemPrompt(adapter, now) })
    return applyModelPlan(adapter, text, model, current)
  } catch (error) {
    const name = error instanceof Error ? error.name : "error"
    const message = error instanceof Error ? error.message : ""
    console.error("ask gateway failed", { source: "fallback", error: name, message })
    const planned = fallbackRoute(adapter, text, current)
    return { ...planned, plan: { ...planned.plan, gatewayError: name } }
  }
}
