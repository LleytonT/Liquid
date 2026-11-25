import type { BranchRecord, Knob } from "@/lib/shell/game-module"
import seed from "@/games/words/seed.json"

const root = seed as BranchRecord

/**
 * The change an ask would write onto a parent: same record shape, parent link,
 * and only the knobs the ask touched.
 */
export function branchFromAsk(
  parent: BranchRecord,
  id: string,
  title: string,
  changes: Record<string, number>,
): BranchRecord {
  const snapshot = structuredClone(parent.snapshot)
  const tunables: Record<string, Knob> = {}
  for (const [name, knob] of Object.entries(snapshot.tunables)) {
    tunables[name] = { ...knob }
  }
  for (const [name, value] of Object.entries(changes)) {
    const knob = tunables[name]
    if (!knob) throw new Error(`${id}: ${name} is not a tunable`)
    if (knob.locked) throw new Error(`${id}: ${name} is locked`)
    if (value < knob.min || value > knob.max) {
      throw new Error(`${id}: ${name} ${value} is outside ${knob.min}-${knob.max}`)
    }
    tunables[name] = { ...knob, value }
  }
  snapshot.id = `${id}-v1`
  snapshot.tunables = tunables
  return {
    id,
    parentId: parent.id,
    title,
    gameId: parent.gameId,
    snapshot,
  }
}

export const wordsBranches: readonly BranchRecord[] = [
  root,
  branchFromAsk(root, "words-hard", "hard mode", { hardMode: 1 }),
  branchFromAsk(root, "words-eight", "eight guesses", { guesses: 8 }),
  branchFromAsk(root, "words-timed", "one minute", { timerSeconds: 60 }),
]
