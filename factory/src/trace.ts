import type { AskPlan, AskRoute } from "./router"

export type TraceDecision = "pending" | "accept" | "reject"

export type TraceCheck = {
  readonly id: string
  readonly ok: boolean
  readonly detail: string
}

/**
 * One ask. `checks` stays empty until a verifier exists.
 * `evidence` is free-form space for those future checks.
 * `diff` is the patch against the parent, not a full snapshot.
 */
export type Trace = {
  readonly id: string
  readonly branchId: string | null
  readonly gameId: string
  readonly ask: string
  readonly route: AskRoute
  readonly confidence: number
  readonly plan: AskPlan
  readonly diff: Readonly<Record<string, number>> | null
  readonly checks: readonly TraceCheck[]
  readonly evidence: unknown
  readonly verdict: string | null
  readonly decision: TraceDecision
  readonly createdAt: string
}
