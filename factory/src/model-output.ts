import { z } from "zod"

/** The prod schema. z.record(z.number()) rejects string numbers and patch: null. */
export const strictModelSchema = z.object({
  kind: z.enum(["tweak", "content", "branch"]),
  patch: z.record(z.string(), z.number()).optional(),
})

function coerceNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value)
  return null
}

/**
 * Optional kind, null patch, and numeric strings. Non-numeric patch values are dropped.
 * Clamp happens after this parse.
 */
export const modelOutputSchema = z.object({
  kind: z.enum(["tweak", "content", "branch"]).optional(),
  patch: z.preprocess((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
    const next: Record<string, number> = {}
    for (const [key, item] of Object.entries(value)) {
      const number = coerceNumber(item)
      if (number !== null) next[key] = number
    }
    return next
  }, z.record(z.string(), z.number()).optional()),
})

export type ParsedModel = {
  kind?: "tweak" | "content" | "branch"
  patch: Record<string, number>
}

export function parseModelOutput(input: unknown): ParsedModel {
  const parsed = modelOutputSchema.parse(input)
  return { kind: parsed.kind, patch: parsed.patch ?? {} }
}

export function parseModelText(text: string): ParsedModel {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  return parseModelOutput(JSON.parse(trimmed))
}
