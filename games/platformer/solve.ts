import type { SolveLevelResult } from "@/lib/shell/game-module"
import type { BranchRecord } from "@/lib/shell/game-module"
import { LOCKED } from "@/games/platformer/locked"
import {
  FAIR_CLEARANCE_PX,
  FAIR_TWIN_TICKS,
  proveLattice,
} from "@/games/platformer/lattice"
import { initialSim, step } from "@/games/platformer/physics"
import { cellOf, isSafe, type RuntimeLevel } from "@/games/platformer/runtime"
import { preparePlatformer } from "@/games/platformer/validate"

/**
 * The old A* expanded one node per state and gave up at this many.
 * The lattice search replaces that expansion. Leave the cap here so it is
 * not raised to brute-force the new levels.
 */
export const NODE_LIMIT = 1_000_000

export { FAIR_CLEARANCE_PX, FAIR_TWIN_TICKS }

const DIRS: Record<string, { x: number; y: number }> = {
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  E: { x: 1, y: 0 },
  W: { x: -1, y: 0 },
  "-": { x: 0, y: 0 },
}

function walledOff(level: RuntimeLevel): string | null {
  const start = cellOf(level.spawn.x, level.spawn.y)
  if (!start) return "spawn is off the grid"
  const seen = Array.from({ length: LOCKED.rows }, () => Array(LOCKED.cols).fill(false))
  const queue = [start]
  seen[start.row][start.col] = true
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i]
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const col = cell.col + dc
      const row = cell.row + dr
      if (col < 0 || row < 0 || col >= LOCKED.cols || row >= LOCKED.rows) continue
      if (seen[row][col] || level.wall[row][col]) continue
      seen[row][col] = true
      queue.push({ col, row })
    }
  }
  for (const coin of level.coins) {
    const cell = cellOf(coin.x, coin.y)
    if (!cell || !seen[cell.row][cell.col]) return "a coin is walled off"
  }
  for (let row = 0; row < LOCKED.rows; row++) {
    for (let col = 0; col < LOCKED.cols; col++) {
      if (level.end[row][col] && seen[row][col]) return null
    }
  }
  return "the end is walled off"
}

function replay(
  level: RuntimeLevel,
  speed: number,
  inputs: string[],
): { length: number; frames: number; stretch: number } | string {
  let sim = initialSim(level)
  let length = 0
  let stretch = 0
  let unsafeAt: number | null = null
  const watch = (next: { x: number; y: number; frame: number; alive: boolean }) => {
    if (!next.alive) return
    if (isSafe(level, next.x, next.y)) {
      if (unsafeAt !== null) {
        stretch = Math.max(stretch, next.frame - unsafeAt)
        unsafeAt = null
      }
    } else if (unsafeAt === null) {
      unsafeAt = next.frame
    }
  }
  watch(sim)
  for (const code of inputs) {
    const dir = DIRS[code]
    if (!dir) return `unknown input ${code}`
    const beforeX = sim.x
    const beforeY = sim.y
    const moved = step(sim, dir, level, speed)
    if (moved.events.died) return "replay died"
    sim = moved.sim
    length += Math.hypot(sim.x - beforeX, sim.y - beforeY)
    watch(sim)
    if (sim.cleared) break
  }
  if (unsafeAt !== null) stretch = Math.max(stretch, sim.frame - unsafeAt)
  if (!sim.cleared) return "replay did not clear"
  if (!sim.coins.every(Boolean)) return "replay missed a coin"
  if (stretch >= 20 * 60) return `stretch ${(stretch / 60).toFixed(2)}s is over 20s`
  return { length, frames: sim.frame, stretch }
}

function guardLocked(): void {
  if (LOCKED.playerHitboxPx !== 24 || LOCKED.enemyHitboxPx !== 6 || LOCKED.respawnMs !== 500) {
    throw new Error("locked hitboxes or respawn were changed")
  }
}

function solveLevel(level: RuntimeLevel, speed: number): SolveLevelResult {
  const blocked = walledOff(level)
  if (blocked) return { levelId: level.id, ok: false, pathLength: 0, notes: [blocked] }
  const started = performance.now()
  const proof = proveLattice(level, speed, { trace: true })
  const elapsed = performance.now() - started
  if (!proof.ok) {
    return {
      levelId: level.id,
      ok: false,
      pathLength: 0,
      notes: [proof.reason, `solve ${elapsed.toFixed(0)}ms`],
    }
  }
  const proved = replay(level, speed, proof.inputs)
  if (typeof proved === "string") {
    return { levelId: level.id, ok: false, pathLength: 0, notes: [proved, `solve ${elapsed.toFixed(0)}ms`] }
  }
  return {
    levelId: level.id,
    ok: true,
    pathLength: Math.round(proved.length),
    notes: [
      `path ${Math.round(proved.length)}px`,
      `frames ${proved.frames}`,
      `stretch ${(proved.stretch / 60).toFixed(2)}s`,
      `solve ${elapsed.toFixed(0)}ms`,
    ],
  }
}

export function solvePlatformer(branch: BranchRecord): SolveLevelResult[] {
  guardLocked()
  const snapshot = preparePlatformer(branch)
  return snapshot.levels.map((level) => solveLevel(level, snapshot.playerSpeed))
}

/** Hazard radius +4px and every timing offset in ±3 ticks. A miss fails the floor. */
export function fairnessPlatformer(branch: BranchRecord): SolveLevelResult[] {
  guardLocked()
  const snapshot = preparePlatformer(branch)
  return snapshot.levels.map((level) => {
    const started = performance.now()
    const proof = proveLattice(level, snapshot.playerSpeed, {
      marginPx: FAIR_CLEARANCE_PX,
      twinTicks: FAIR_TWIN_TICKS,
      trace: false,
    })
    const elapsed = performance.now() - started
    if (!proof.ok) {
      return {
        levelId: level.id,
        ok: false,
        pathLength: 0,
        notes: [proof.reason, `fair ${elapsed.toFixed(0)}ms`],
      }
    }
    return {
      levelId: level.id,
      ok: true,
      pathLength: 0,
      notes: [`cleared by tick ${proof.frames}`, `4px ±${FAIR_TWIN_TICKS} ticks`, `fair ${elapsed.toFixed(0)}ms`],
    }
  })
}
