import { ancestorChain, resolveLineage } from "@liquid/factory/resolve"
import { getStore } from "@liquid/factory/store"
import type { Branch } from "@liquid/factory/types"
import type { BranchRecord } from "@/lib/shell/game-module"
import { adapterFor, viewRecord } from "@/lib/registry"

/** Build a playable view by walking from the game's seed. Nothing here is written back to the store. */
export async function materialize(branch: Branch): Promise<{ record: BranchRecord; parent: BranchRecord | null }> {
  const adapter = adapterFor(branch.gameId)
  if (!adapter) throw new Error(`no adapter for ${branch.gameId}`)
  const ancestors = await ancestorChain(getStore().store, branch)
  const record = viewRecord(branch.gameId, resolveLineage(adapter, branch, ancestors))
  if (ancestors.length === 0) {
    const root = adapter.load(branch.parentId)
    return { record, parent: root ? viewRecord(branch.gameId, root) : null }
  }
  const immediate = ancestors[ancestors.length - 1]
  if (!immediate) return { record, parent: null }
  const parent = viewRecord(branch.gameId, resolveLineage(adapter, immediate, ancestors.slice(0, -1)))
  return { record, parent }
}
