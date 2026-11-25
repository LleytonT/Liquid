import { connection } from "next/server"
import { getStore } from "@liquid/factory/store"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await context.params
  const selected = getStore()
  const branch = await selected.store.getBranch(id)
  if (!branch) return Response.json({ error: "that branch is not on the tree" }, { status: 404 })
  const trace = await selected.store.getTrace(branch.traceId)
  return Response.json({
    branch,
    trace,
    persistence: { kind: selected.kind, warning: selected.warning, durable: selected.durable },
  })
}
