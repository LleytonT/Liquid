import { createBranch, type Branch } from "./branch"
import type { GameAdapter } from "./contract"
import { newBranchId, newTraceId } from "./ids"
import type { OwnerIdentity } from "./owner"
import { routeAsk, type ModelComplete, type RouteResult } from "./router"
import type { BranchStore } from "./store"
import type { Trace } from "./trace"

export class AskError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export type OpenAskResult = {
  readonly route: RouteResult
  readonly branch: Branch | null
  readonly trace: Trace
}

const MAX_ASK = 140

/**
 * Turn an ask into a trace and, unless it needs a clearer question, a personal branch.
 * Personal branches are not reviewed. `requestVisibility` is the share and propose hook.
 */
export async function openAsk(input: {
  adapter: GameAdapter
  store: BranchStore
  owner: OwnerIdentity
  parentId: string
  ask: string
  now?: Date
  ids?: { branchId: string; traceId: string }
  complete?: ModelComplete
  current?: Record<string, number>
}): Promise<OpenAskResult> {
  const ask = input.ask.trim().slice(0, MAX_ASK)
  if (!ask) throw new AskError("say what should change", 400)
  const authored = input.adapter.load(input.parentId)
  const stored = authored ? null : await input.store.getBranch(input.parentId)
  if (!authored && (!stored || stored.status !== "playable" || stored.gameId !== input.adapter.id)) {
    throw new AskError("that branch is not playable", 400)
  }
  const route = await routeAsk(input.adapter, ask, input.complete, input.current)
  const createdAt = (input.now ?? new Date()).toISOString()
  const traceId = input.ids?.traceId ?? newTraceId()
  if (route.route === "clarify") {
    const trace: Trace = {
      id: traceId,
      branchId: null,
      gameId: input.adapter.id,
      ask,
      route: route.route,
      confidence: route.confidence,
      plan: route.plan,
      diff: null,
      checks: [],
      evidence: null,
      verdict: null,
      decision: "pending",
      createdAt,
    }
    await input.store.save(null, trace)
    return { route, branch: null, trace }
  }
  const patch = route.route === "tweak" && route.plan.patch ? { ...route.plan.patch } : null
  const branch = createBranch({
    id: input.ids?.branchId ?? newBranchId(),
    parentId: input.parentId,
    gameId: input.adapter.id,
    ask,
    kind: route.route,
    patch,
    plan: route.plan.summary,
    owner: input.owner,
    createdAt,
    status: "draft",
    traceId,
  })
  const trace: Trace = {
    id: traceId,
    branchId: branch.id,
    gameId: input.adapter.id,
    ask,
    route: route.route,
    confidence: route.confidence,
    plan: route.plan,
    diff: patch,
    checks: [],
    evidence: null,
    verdict: null,
    decision: "pending",
    createdAt,
  }
  await input.store.save(branch, trace)
  return { route, branch, trace }
}

/** Accept applies a tweak immediately. Content and new mechanics stay drafts. Reject leaves the game alone. */
export async function decideBranch(
  store: BranchStore,
  branchId: string,
  decision: "accept" | "reject",
): Promise<{ branch: Branch; trace: Trace }> {
  const branch = await store.getBranch(branchId)
  if (!branch) throw new AskError("that branch is not on the tree", 404)
  const trace = await store.getTrace(branch.traceId)
  if (!trace) throw new AskError("that ask has no trace", 404)
  if (trace.decision !== "pending") throw new AskError("that plan was already answered", 409)
  const accepted = decision === "accept"
  const playable = accepted && branch.kind === "tweak" && branch.patch !== null
  const nextBranch: Branch = {
    ...branch,
    status: accepted ? (playable ? "playable" : "draft") : "rejected",
  }
  const nextTrace: Trace = {
    ...trace,
    decision,
    verdict: accepted ? (playable ? "playable" : "not built") : "rejected",
    checks: trace.checks,
    evidence: trace.evidence,
  }
  await store.save(nextBranch, nextTrace)
  return { branch: nextBranch, trace: nextTrace }
}
