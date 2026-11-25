/**
 * Confirms the seed levels are the five new rooms and that preparePlatformer accepts them.
 * usage: npx tsx games/platformer/validate-new.ts
 */
import seed from "@/games/platformer/seed.json"
import type { BranchRecord } from "@/lib/shell/game-module"
import { preparePlatformer } from "@/games/platformer/validate"
import { solvePlatformer } from "@/games/platformer/solve"

export const NEW_LEVEL_IDS = ["corridor", "lanes", "orbit", "spinner", "gauntlet"] as const

export function validateNewSeed(branch: BranchRecord = seed as BranchRecord): string[] {
  const snapshot = preparePlatformer(branch)
  const ids = snapshot.levels.map((level) => level.id)
  if (ids.length !== NEW_LEVEL_IDS.length || ids.some((id, index) => id !== NEW_LEVEL_IDS[index])) {
    throw new Error(`expected ${NEW_LEVEL_IDS.join(", ")}, got ${ids.join(", ")}`)
  }
  return ids
}

const isMain = process.argv[1]?.endsWith("validate-new.ts")
if (isMain) {
  const ids = validateNewSeed()
  console.log("validator ok", ids.join(" "))
  for (const result of solvePlatformer(seed as BranchRecord)) {
    console.log(result.levelId, result.ok ? "ok" : "FAIL", result.notes.join("  "))
  }
}
