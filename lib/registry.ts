import type { GameAdapter, GameData } from "@liquid/factory/types"
import { platformerAdapter, platformerRecord } from "@liquid/platformer/adapter"
import { wordsAdapter, wordsRecord } from "@liquid/words/adapter"
import type { BranchRecord } from "@/lib/shell/game-module"

/** Games the factory can route. A new fixture is registered here and does not edit /factory. */
export const adapters: readonly GameAdapter[] = [platformerAdapter, wordsAdapter]

export function adapterFor(gameId: string): GameAdapter | null {
  return adapters.find((adapter) => adapter.id === gameId) ?? null
}

export function viewRecord(gameId: string, data: GameData): BranchRecord {
  if (gameId === "platformer") return platformerRecord(data)
  if (gameId === "words") return wordsRecord(data)
  throw new Error(`no view for ${gameId}`)
}
