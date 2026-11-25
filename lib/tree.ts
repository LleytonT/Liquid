import { getStore } from "@liquid/factory/store"
import type { TreeNodeData } from "@/components/tree-node"

export async function listTree(): Promise<TreeNodeData[]> {
  const { store } = getStore()
  const [branches, traces] = await Promise.all([store.listBranches(), store.listTraces()])
  const byTrace = new Map(traces.map((trace) => [trace.id, trace]))
  return branches.map((branch) => ({
    id: branch.id,
    parentId: branch.parentId,
    gameId: branch.gameId,
    plan: branch.plan,
    status: branch.status,
    visibility: branch.visibility,
    kind: branch.kind,
    decision: byTrace.get(branch.traceId)?.decision ?? "pending",
  }))
}
