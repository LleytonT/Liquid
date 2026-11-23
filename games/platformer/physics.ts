import { DT, RESPAWN_FRAMES } from "@/games/platformer/locked"
import {
  cellOf,
  createSim,
  hitsCircle,
  hitsEnemy,
  isBlocked,
  positionsAt,
  type Dir,
  type RuntimeLevel,
  type Sim,
} from "@/games/platformer/runtime"

export type StepEvents = {
  died: boolean
  collected: number[]
  cleared: boolean
}

function slide(level: RuntimeLevel, x: number, y: number, dx: number, dy: number): { x: number; y: number } {
  const steps = Math.max(1, Math.ceil(Math.abs(dx) + Math.abs(dy)))
  let cx = x
  let cy = y
  const sx = dx / steps
  const sy = dy / steps
  for (let i = 0; i < steps; i++) {
    const nx = cx + sx
    if (!isBlocked(level, nx, cy)) cx = nx
    const ny = cy + sy
    if (!isBlocked(level, cx, ny)) cy = ny
  }
  return { x: cx, y: cy }
}

/**
 * One simulation frame. Hitbox size and respawn length are not parameters;
 * they come from the locked constants.
 */
export function step(
  prev: Sim,
  dir: Dir,
  level: RuntimeLevel,
  playerSpeed: number,
): { sim: Sim; events: StepEvents } {
  const sim: Sim = {
    ...prev,
    coins: prev.coins.slice(),
    committed: prev.committed.slice(),
    checkpoint: { x: prev.checkpoint.x, y: prev.checkpoint.y },
  }
  const events: StepEvents = { died: false, collected: [], cleared: false }
  sim.frame += 1

  if (!prev.alive) {
    sim.respawnFrames -= 1
    if (sim.respawnFrames <= 0) {
      sim.alive = true
      sim.respawnFrames = 0
      sim.x = sim.checkpoint.x
      sim.y = sim.checkpoint.y
      sim.coins = sim.committed.slice()
    }
    return { sim, events }
  }

  if (sim.cleared) return { sim, events }

  const length = Math.hypot(dir.x, dir.y)
  if (length > 0) {
    const dist = playerSpeed * DT
    const moved = slide(level, sim.x, sim.y, (dir.x / length) * dist, (dir.y / length) * dist)
    sim.x = moved.x
    sim.y = moved.y
  }

  for (const enemy of positionsAt(level, sim.frame)) {
    if (hitsEnemy(sim.x, sim.y, enemy.x, enemy.y)) {
      sim.alive = false
      sim.respawnFrames = RESPAWN_FRAMES
      events.died = true
      return { sim, events }
    }
  }

  for (let i = 0; i < level.coins.length; i++) {
    if (sim.coins[i]) continue
    const coin = level.coins[i]
    if (hitsCircle(sim.x, sim.y, coin.x, coin.y, level.coinRadius)) {
      sim.coins[i] = true
      events.collected.push(i)
    }
  }

  const cell = cellOf(sim.x, sim.y)
  if (cell && level.checkpoint[cell.row][cell.col]) {
    const anchor = level.anchors.get(`${cell.col},${cell.row}`)
    if (anchor) sim.checkpoint = { x: anchor.x, y: anchor.y }
    sim.committed = sim.coins.slice()
  }

  if (cell && level.end[cell.row][cell.col] && sim.coins.every(Boolean)) {
    sim.cleared = true
    sim.committed = sim.coins.slice()
    events.cleared = true
  }

  return { sim, events }
}

export function initialSim(level: RuntimeLevel): Sim {
  return createSim(level)
}
