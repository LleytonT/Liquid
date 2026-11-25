import { generateText, NoObjectGeneratedError, Output } from "ai"
import { z } from "zod"
import {
  acceptModelPlan,
  currentValues,
  fallbackPlan,
  rawPatch,
  rulesFor,
  type AskPlan,
} from "@/lib/ask/tweak"

/** A small structured-output model. Confirmed on the live gateway model list. */
export const ASK_MODEL = "openai/gpt-5-mini"

const modelSchema = z.object({
  kind: z.enum(["tweak", "content", "branch"]),
  patch: z.record(z.string(), z.number()).optional(),
})

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

function salvage(gameId: string, ask: string, text: string | undefined, current?: Record<string, number>): AskPlan | null {
  if (!text) return null
  try {
    const parsed = JSON.parse(text) as { kind?: string; patch?: Record<string, unknown> }
    if (!parsed || typeof parsed !== "object") return null
    const patch = parsed.patch && typeof parsed.patch === "object" ? rawPatch(parsed.patch) : rawPatch(parsed as Record<string, unknown>)
    if (parsed.kind === "tweak" || Object.keys(patch).length > 0) {
      return acceptModelPlan(gameId, ask, { kind: parsed.kind ?? "tweak", patch }, current)
    }
    if (parsed.kind === "content" || parsed.kind === "branch") {
      return acceptModelPlan(gameId, ask, { kind: parsed.kind }, current)
    }
  } catch {
    return null
  }
  return null
}

async function askModel(gameId: string, ask: string, current?: Record<string, number>): Promise<AskPlan> {
  const now = currentValues(gameId, current)
  try {
    const { output } = await generateText({
      model: ASK_MODEL,
      output: Output.object({ schema: modelSchema }),
      system: systemPrompt(gameId, now),
      prompt: ask,
      timeout: 20_000,
      abortSignal: AbortSignal.timeout(20_000),
      providerOptions: {
        openai: { reasoningEffort: "low" },
      },
    })
    if (!output) throw new Error("the model returned nothing")
    return acceptModelPlan(gameId, ask, output, current)
  } catch (error) {
    const text = error instanceof NoObjectGeneratedError ? error.text : undefined
    const recovered = salvage(gameId, ask, text, current)
    if (recovered) return recovered
    throw error
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
    console.error("ask gateway failed", name, message)
    return { ...fallbackPlan(gameId, ask, current), gatewayError: name }
  }
}
