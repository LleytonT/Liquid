import { generateText, NoObjectGeneratedError, Output } from "ai"
import { z } from "zod"
import { acceptModelPlan, currentValues, fallbackPlan, rulesFor, type AskPlan } from "@/lib/ask/tweak"

/** A small structured-output model. Confirmed on the live gateway model list. */
export const ASK_MODEL = "openai/gpt-5-mini"

const ASK_TIMEOUT_MS = 15_000

/** The prod schema. z.record(z.number()) rejects string numbers and patch: null. */
export const strictModelSchema = z.object({
  kind: z.enum(["tweak", "content", "branch"]),
  patch: z.record(z.string(), z.number()).optional(),
})

const looseNumber = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return undefined
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value)
  return value
}, z.number().optional())

/**
 * Optional fields, null patch, and numeric strings. Clamp happens after this parse.
 * Unknown patch keys are dropped so a note string cannot fail the whole object.
 */
export const modelOutputSchema = z.object({
  kind: z.enum(["tweak", "content", "branch"]).optional(),
  patch: z.preprocess(
    (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : undefined),
    z
      .object({
        playerSpeed: looseNumber,
        playerVisualPx: looseNumber,
        enemyVisualRadiusPx: looseNumber,
        coinRadiusPx: looseNumber,
        enemySpeedScale: looseNumber,
        guesses: looseNumber,
        timerSeconds: looseNumber,
        hardMode: looseNumber,
        staggerMs: looseNumber,
        roundEndMs: looseNumber,
      })
      .partial()
      .optional(),
  ),
})

export function parseModelOutput(input: unknown): { kind?: "tweak" | "content" | "branch"; patch: Record<string, number> } {
  const parsed = modelOutputSchema.parse(input)
  const patch: Record<string, number> = {}
  for (const [key, value] of Object.entries(parsed.patch ?? {})) {
    if (typeof value === "number") patch[key] = value
  }
  return { kind: parsed.kind, patch }
}

export function parseModelText(text: string): { kind?: "tweak" | "content" | "branch"; patch: Record<string, number> } {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  return parseModelOutput(JSON.parse(trimmed))
}

function systemPrompt(gameId: string, current: Record<string, number>): string {
  const rules = rulesFor(gameId)
  const keys = rules
    ? Object.entries(rules)
        .map(([key, rule]) => `${key} ${rule.min}-${rule.max}`)
        .join(", ")
    : ""
  const now = Object.entries(current)
    .map(([key, value]) => `${key} ${value}`)
    .join(", ")
  return [
    "You plan a one-line change to a small game.",
    `Current numbers: ${now}.`,
    "kind tweak only when the ask changes one of these numbers:",
    keys,
    "enemySpeedScale is a multiplier. 1 is unchanged, 2 is twice as fast, 0.5 is half as fast.",
    "Use the magnitude the player asked for. Do not substitute 0.55 or 1.4.",
    "more guesses must be higher than the current guesses. fewer must be lower.",
    "If the number is outside the range, still return the number they asked for.",
    "kind content for new moves, jumps, levels, multiplayer, weather, or art.",
    "kind branch for a new version other people would play.",
    "Do not invent keys. Leave patch empty unless kind is tweak.",
    "patch values are numbers.",
  ].join(" ")
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
}

function fromParsed(
  gameId: string,
  ask: string,
  parsed: { kind?: "tweak" | "content" | "branch"; patch: Record<string, number> },
  current?: Record<string, number>,
): AskPlan {
  const kind = parsed.kind ?? (Object.keys(parsed.patch).length > 0 ? "tweak" : "content")
  return acceptModelPlan(gameId, ask, { kind, patch: parsed.patch }, current)
}

async function askOnce(gameId: string, ask: string, current?: Record<string, number>): Promise<AskPlan> {
  const now = currentValues(gameId, current)
  try {
    const { output } = await generateText({
      model: ASK_MODEL,
      output: Output.object({ schema: modelOutputSchema }),
      system: systemPrompt(gameId, now),
      prompt: ask,
      timeout: ASK_TIMEOUT_MS,
      abortSignal: AbortSignal.timeout(ASK_TIMEOUT_MS),
      providerOptions: {
        openai: { reasoningEffort: "low" },
      },
    })
    if (!output) throw new Error("the model returned nothing")
    return fromParsed(gameId, ask, parseModelOutput(output), current)
  } catch (error) {
    const text = error instanceof NoObjectGeneratedError ? error.text : undefined
    if (text) {
      try {
        return fromParsed(gameId, ask, parseModelText(text), current)
      } catch {
        // The text was not a plan. Let the caller retry a timeout or fall back.
      }
    }
    throw error
  }
}

async function askModel(gameId: string, ask: string, current?: Record<string, number>): Promise<AskPlan> {
  try {
    return await askOnce(gameId, ask, current)
  } catch (error) {
    if (!isTimeout(error)) throw error
    return await askOnce(gameId, ask, current)
  }
}

/**
 * The model runs for every ask. fallbackPlan runs only when that call errors or times out.
 * A schema miss is recovered from the model's own JSON before the matcher is allowed to run.
 */
export async function planAsk(
  gameId: string,
  ask: string,
  current?: Record<string, number>,
  complete: typeof askModel = askModel,
): Promise<AskPlan> {
  try {
    return await complete(gameId, ask, current)
  } catch (error) {
    const name = error instanceof Error ? error.name : "error"
    const message = error instanceof Error ? error.message : ""
    console.error("ask gateway failed", { source: "fallback", error: name, message })
    return { ...fallbackPlan(gameId, ask, current), gatewayError: name }
  }
}
