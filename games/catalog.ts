import type { BranchRecord, GameHeadless } from "@/lib/shell/game-module"
import { platformer } from "@/games/platformer/headless"
import { words } from "@/games/words/headless"

/** Games on the shell, in shelf order. The first root branch is what `/` plays. */
export const catalog: readonly GameHeadless[] = [platformer, words]

export function gameById(id: string): GameHeadless | undefined {
  return catalog.find((game) => game.id === id)
}

export function branchById(id: string): { game: GameHeadless; branch: BranchRecord } | undefined {
  for (const game of catalog) {
    const branch = game.seed.branches.find((item) => item.id === id)
    if (branch) return { game, branch }
  }
  return undefined
}

export function defaultPlay(): { game: GameHeadless; branch: BranchRecord } {
  const game = catalog[0]
  const branch = game?.seed.branches.find((item) => item.id === game.rootBranchId)
  if (!game || !branch) throw new Error("the shelf has no root branch")
  return { game, branch }
}
