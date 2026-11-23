import type { BranchRecord, Knob } from "@/lib/shell/game-module"

function isKnob(value: unknown): value is Knob {
  if (!value || typeof value !== "object") return false
  const knob = value as Knob
  return (
    typeof knob.value === "number" &&
    typeof knob.min === "number" &&
    typeof knob.max === "number" &&
    typeof knob.locked === "boolean" &&
    knob.min <= knob.value &&
    knob.value <= knob.max
  )
}

/** Structural check shared by every game. Game rules live in the module. */
export function assertBranchShape(branch: BranchRecord): void {
  if (!branch.id || typeof branch.id !== "string") {
    throw new Error("branch id is missing")
  }
  if (branch.parentId !== null && typeof branch.parentId !== "string") {
    throw new Error(`${branch.id}: parentId must be a string or null`)
  }
  if (!branch.gameId) throw new Error(`${branch.id}: gameId is missing`)
  const snapshot = branch.snapshot
  if (!snapshot || typeof snapshot.id !== "string") {
    throw new Error(`${branch.id}: snapshot id is missing`)
  }
  const bible = snapshot.bible
  if (!bible || typeof bible.version !== "number") {
    throw new Error(`${branch.id}: bible version is missing`)
  }
  if (!bible.lockedCore || typeof bible.lockedCore !== "object") {
    throw new Error(`${branch.id}: bible.lockedCore is missing`)
  }
  if (!Array.isArray(bible.registeredAdditions)) {
    throw new Error(`${branch.id}: bible.registeredAdditions must be a list`)
  }
  const tunables = snapshot.tunables
  if (!tunables || typeof tunables !== "object") {
    throw new Error(`${branch.id}: tunables are missing`)
  }
  for (const [name, knob] of Object.entries(tunables)) {
    if (!isKnob(knob)) throw new Error(`${branch.id}: tunable ${name} is invalid`)
  }
}
