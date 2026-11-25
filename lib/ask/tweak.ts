import { applyModelPlan, fallbackRoute, sanitizePatch as sanitize, type RouteResult } from "@liquid/factory"
import { adapterFor } from "@/lib/registry"

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
}

function adapter(gameId: string) {
  const found = adapterFor(gameId)
  if (!found) throw new Error(`no adapter for ${gameId}`)
  return found
}

export function toAskPlan(result: RouteResult): AskPlan {
  return {
    kind: result.route === "tweak" ? "tweak" : result.route === "branch" ? "branch" : "content",
    patch: result.route === "tweak" && result.plan.patch ? { ...result.plan.patch } : undefined,
    line: result.plan.summary,
    source: result.plan.source,
    gatewayError: result.plan.gatewayError,
  }
}

export function sanitizePatch(gameId: string, patch: Record<string, unknown>): Record<string, number> | null {
  return sanitize(adapter(gameId), patch)
}

export function fallbackPlan(gameId: string, ask: string, current?: Record<string, number>): AskPlan {
  return toAskPlan(fallbackRoute(adapter(gameId), ask, current))
}

export function acceptModelPlan(
  gameId: string,
  ask: string,
  model: { kind?: string; patch?: Record<string, unknown> },
  current?: Record<string, number>,
): AskPlan {
  return toAskPlan(applyModelPlan(adapter(gameId), ask, model, current))
}
