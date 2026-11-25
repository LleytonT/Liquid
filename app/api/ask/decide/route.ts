import { AskError, decideBranch } from "@liquid/factory/ask"
import { getStore } from "@liquid/factory/store"

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "the decision was not json" }, { status: 400 })
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const branchId = record.branchId
  const decision = record.decision
  if (typeof branchId !== "string" || (decision !== "accept" && decision !== "reject")) {
    return Response.json({ error: "say which branch and whether you accept it" }, { status: 400 })
  }
  const selected = getStore()
  try {
    const result = await decideBranch(selected.store, branchId, decision)
    return Response.json({
      branch: result.branch,
      trace: result.trace,
      persistence: { kind: selected.kind, warning: selected.warning, durable: selected.durable },
    })
  } catch (error) {
    if (error instanceof AskError) return Response.json({ error: error.message }, { status: error.status })
    throw error
  }
}
