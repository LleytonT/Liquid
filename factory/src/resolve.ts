import type { Branch } from "./branch"
import type { GameAdapter, GameData } from "./contract"
import type { BranchStore } from "./store"

/**
 * Factory branches from the seed's child down to the parent of `branch`, root first.
 * The seed itself is not a factory branch. `load` on the adapter returns it.
 */
export async function ancestorChain(store: BranchStore, branch: Branch): Promise<Branch[]> {
  const all = await store.listBranches(branch.gameId)
  const byId = new Map(all.map((item) => [item.id, item]))
  const towardRoot: Branch[] = []
  const seen = new Set<string>([branch.id])
  let parentId: string | null = branch.parentId
  while (parentId) {
    if (seen.has(parentId)) throw new Error("branch chain loops")
    seen.add(parentId)
    const parent = byId.get(parentId)
    if (!parent) break
    towardRoot.push(parent)
    if (towardRoot.length > 32) throw new Error("branch chain is too deep")
    parentId = parent.parentId
  }
  return towardRoot.reverse()
}

/**
 * Walk from the game's seed, applying each ancestor's own patch, then this branch's patch.
 * A later edit to a parent patch shows up here because nothing is copied onto the child.
 */
export function resolveLineage(
  adapter: GameAdapter,
  branch: Branch,
  ancestorsRootFirst: readonly Branch[],
): GameData {
  const seedId = ancestorsRootFirst[0]?.parentId ?? branch.parentId
  let data = adapter.load(seedId)
  if (!data) throw new Error(`no root for ${seedId}`)
  for (const node of ancestorsRootFirst) {
    if (node.kind === "tweak" && node.patch) data = adapter.write(data, node.patch)
    data = adapter.withIdentity(data, { id: node.id, parentId: node.parentId, title: node.plan })
  }
  if (branch.kind === "tweak" && branch.patch) data = adapter.write(data, branch.patch)
  return adapter.withIdentity(data, { id: branch.id, parentId: branch.parentId, title: branch.plan })
}
