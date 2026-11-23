import type { SolveLevelResult } from "@/lib/shell/game-module"
import type { BranchRecord } from "@/lib/shell/game-module"
import { LOCKED } from "@/games/platformer/locked"
import { initialSim, step } from "@/games/platformer/physics"
import {
  cellOf,
  isFar,
  isSafe,
  type RuntimeLevel,
  type Sim,
} from "@/games/platformer/runtime"
import { preparePlatformer } from "@/games/platformer/validate"

const DIRS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
] as const

const NODE_LIMIT = 1_000_000
const FRAME_CAP = 45 * 60

type Action = { dx: number; dy: number; wait: number }
type Node = {
  x: number
  y: number
  g: number
  mask: number
  parent: number
  action: Action
}

class Heap {
  private data: { f: number; id: number }[] = []
  get size(): number {
    return this.data.length
  }
  push(f: number, id: number): void {
    const heap = this.data
    heap.push({ f, id })
    let i = heap.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (heap[parent].f <= heap[i].f) break
      ;[heap[parent], heap[i]] = [heap[i], heap[parent]]
      i = parent
    }
  }
  pop(): { f: number; id: number } | undefined {
    const heap = this.data
    const top = heap[0]
    const last = heap.pop()
    if (!top) return undefined
    if (heap.length > 0 && last) {
      heap[0] = last
      let i = 0
      for (;;) {
        const left = i * 2 + 1
        const right = left + 1
        let smallest = i
        if (left < heap.length && heap[left].f < heap[smallest].f) smallest = left
        if (right < heap.length && heap[right].f < heap[smallest].f) smallest = right
        if (smallest === i) break
        ;[heap[smallest], heap[i]] = [heap[i], heap[smallest]]
        i = smallest
      }
    }
    return top
  }
}

function maskOf(sim: Sim): number {
  let mask = 0
  for (let i = 0; i < sim.coins.length; i++) if (sim.coins[i]) mask |= 1 << i
  return mask
}

function stateKey(x: number, y: number, mask: number, frame: number, far: boolean, period: number): number {
  const qx = Math.round(x)
  const qy = Math.round(y)
  const t = far ? 0 : ((frame % period) + period) % period
  return ((mask * (period + 1) + t) * 1000 + qy) * 1000 + qx
}

function simAt(level: RuntimeLevel, x: number, y: number, frame: number, mask: number): Sim {
  const coins = level.coins.map((_, index) => (mask & (1 << index)) !== 0)
  return {
    frame,
    x,
    y,
    coins,
    committed: coins.slice(),
    alive: true,
    respawnFrames: 0,
    checkpoint: { x: level.spawn.x, y: level.spawn.y },
    cleared: false,
  }
}

function heuristic(level: RuntimeLevel, x: number, y: number, mask: number, speed: number): number {
  let best = Infinity
  let found = false
  for (let i = 0; i < level.coins.length; i++) {
    if (mask & (1 << i)) continue
    found = true
    const coin = level.coins[i]
    best = Math.min(best, Math.abs(coin.x - x) + Math.abs(coin.y - y))
  }
  if (!found) {
    for (let row = 0; row < LOCKED.rows; row++) {
      for (let col = 0; col < LOCKED.cols; col++) {
        if (!level.end[row][col]) continue
        const cx = (col + 0.5) * LOCKED.tilePx
        const cy = (row + 0.5) * LOCKED.tilePx
        best = Math.min(best, Math.abs(cx - x) + Math.abs(cy - y))
      }
    }
  }
  return best / (speed * (1 / 60))
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
  actions: Action[],
): { length: number; frames: number; stretch: number } | string {
  let sim = initialSim(level)
  let length = 0
  let stretch = 0
  let unsafeAt: number | null = null
  const watch = (next: Sim) => {
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
  for (const action of actions) {
    for (let i = 0; i < action.wait; i++) {
      const waited = step(sim, { x: 0, y: 0 }, level, speed)
      if (waited.events.died) return "replay died while waiting"
      const beforeX = sim.x
      const beforeY = sim.y
      sim = waited.sim
      length += Math.hypot(sim.x - beforeX, sim.y - beforeY)
      watch(sim)
    }
    const beforeX = sim.x
    const beforeY = sim.y
    const moved = step(sim, { x: action.dx, y: action.dy }, level, speed)
    if (moved.events.died) return "replay died"
    sim = moved.sim
    length += Math.hypot(sim.x - beforeX, sim.y - beforeY)
    watch(sim)
  }
  if (unsafeAt !== null) stretch = Math.max(stretch, sim.frame - unsafeAt)
  if (!sim.cleared) return "replay did not clear"
  if (stretch >= 20 * 60) return `stretch ${(stretch / 60).toFixed(2)}s is over 20s`
  return { length, frames: sim.frame, stretch }
}

function solveLevel(level: RuntimeLevel, speed: number): SolveLevelResult {
  const blocked = walledOff(level)
  if (blocked) return { levelId: level.id, ok: false, pathLength: 0, notes: [blocked] }

  const full = (1 << level.coins.length) - 1
  const nodes: Node[] = []
  const best = new Map<number, number>()
  const heap = new Heap()
  const startFar = isFar(level, level.spawn.x, level.spawn.y)
  const startKey = stateKey(level.spawn.x, level.spawn.y, 0, 0, startFar, level.period)
  nodes.push({
    x: level.spawn.x,
    y: level.spawn.y,
    g: 0,
    mask: 0,
    parent: -1,
    action: { dx: 0, dy: 0, wait: 0 },
  })
  best.set(startKey, 0)
  heap.push(heuristic(level, level.spawn.x, level.spawn.y, 0, speed), 0)

  let expanded = 0
  let goal = -1

  const push = (parent: number, sim: Sim, action: Action, g: number) => {
    if (g > FRAME_CAP) return
    const mask = maskOf(sim)
    const far = isFar(level, sim.x, sim.y)
    const key = stateKey(sim.x, sim.y, mask, sim.frame, far, level.period)
    const known = best.get(key)
    if (known !== undefined && known <= g) return
    best.set(key, g)
    const id = nodes.length
    nodes.push({ x: sim.x, y: sim.y, g, mask, parent, action })
    heap.push(g + heuristic(level, sim.x, sim.y, mask, speed), id)
  }

  while (heap.size > 0) {
    const next = heap.pop()
    if (!next) break
    const node = nodes[next.id]
    const far = isFar(level, node.x, node.y)
    const key = stateKey(node.x, node.y, node.mask, node.g, far, level.period)
    if (best.get(key) !== node.g) continue
    if (node.mask === full) {
      const cell = cellOf(node.x, node.y)
      if (cell && level.end[cell.row][cell.col]) {
        goal = next.id
        break
      }
    }
    expanded += 1
    if (expanded > NODE_LIMIT) {
      return {
        levelId: level.id,
        ok: false,
        pathLength: 0,
        notes: [`search stopped after ${NODE_LIMIT} states`],
      }
    }

    const dirs = far ? DIRS : [...DIRS, { x: 0, y: 0 }]
    for (const dir of dirs) {
      if (far && (dir.x !== 0 || dir.y !== 0)) {
        const probe = step(simAt(level, node.x, node.y, node.g, node.mask), dir, level, speed)
        const landingFar = isFar(level, probe.sim.x, probe.sim.y)
        if (landingFar) {
          if (!probe.events.died) push(next.id, probe.sim, { dx: dir.x, dy: dir.y, wait: 0 }, node.g + 1)
          continue
        }
        for (let phase = 0; phase < level.period; phase++) {
          const arrival = node.g + 1
          const wait = (phase - (arrival % level.period) + level.period) % level.period
          const moved = step(
            simAt(level, node.x, node.y, node.g + wait, node.mask),
            dir,
            level,
            speed,
          )
          if (moved.events.died) continue
          push(next.id, moved.sim, { dx: dir.x, dy: dir.y, wait }, node.g + wait + 1)
        }
        continue
      }

      const moved = step(simAt(level, node.x, node.y, node.g, node.mask), dir, level, speed)
      if (moved.events.died) continue
      push(next.id, moved.sim, { dx: dir.x, dy: dir.y, wait: 0 }, node.g + 1)
    }
  }

  if (goal < 0) {
    return {
      levelId: level.id,
      ok: false,
      pathLength: 0,
      notes: [`no finishable path (${expanded} states)`],
    }
  }

  const actions: Action[] = []
  for (let id = goal; nodes[id].parent >= 0; id = nodes[id].parent) {
    actions.push(nodes[id].action)
  }
  actions.reverse()
  const proved = replay(level, speed, actions)
  if (typeof proved === "string") {
    return { levelId: level.id, ok: false, pathLength: 0, notes: [proved] }
  }
  return {
    levelId: level.id,
    ok: true,
    pathLength: Math.round(proved.length),
    notes: [
      `frames ${proved.frames}`,
      `stretch ${(proved.stretch / 60).toFixed(2)}s`,
      `states ${expanded}`,
    ],
  }
}

export function solvePlatformer(branch: BranchRecord): SolveLevelResult[] {
  if (LOCKED.playerHitboxPx !== 24 || LOCKED.enemyHitboxPx !== 6 || LOCKED.respawnMs !== 500) {
    throw new Error("locked hitboxes or respawn were changed")
  }
  const snapshot = preparePlatformer(branch)
  return snapshot.levels.map((level) => solveLevel(level, snapshot.playerSpeed))
}
