import { generateText, Output } from "ai"
import { z } from "zod"
import { acceptModelPlan, fallbackPlan, rulesFor, type AskPlan } from "@/lib/ask/tweak"

/** A small structured-output model. Confirmed on the live gateway model list. */
export const ASK_MODEL = "openai/gpt-5-mini"

const modelSchema = z.object({
  kind: z.enum(["tweak", "content", "branch"]),
  patch: z.record(z.string(), z.number()).optional(),
})

function systemPrompt(gameId: string): string {
  const rules = rulesFor(gameId)
  const keys = rules
    ? Object.entries(rules)
        .map(([key, rule]) => `${key} ${rule.min}-${rule.max}`)
        .join(", ")
    : ""
  return [
    "You plan a one-line change to a small game.",
    "kind tweak only when the ask changes one of these numbers:",
    keys,
    "enemySpeedScale below 1 makes the blue shapes slower. above 1 makes them faster.",
    "kind content for new levels, shapes, jumps, or rules that are not in that list.",
    "kind branch for a new version other people would play.",
    "Do not invent keys. Leave patch empty unless kind is tweak.",
  ].join(" ")
}

async function askModel(gameId: string, ask: string): Promise<AskPlan> {
  const { output } = await generateText({
    model: ASK_MODEL,
    output: Output.object({ schema: modelSchema }),
    system: systemPrompt(gameId),
    prompt: ask,
    abortSignal: AbortSignal.timeout(8000),
  })
  if (!output) throw new Error("the model returned nothing")
  return acceptModelPlan(gameId, output)
}

/** Try the gateway. If it fails, read the words locally and say so. */
export async function planAsk(gameId: string, ask: string, complete: typeof askModel = askModel): Promise<AskPlan> {
  try {
    return await complete(gameId, ask)
  } catch {
    return fallbackPlan(gameId, ask)
  }
}
