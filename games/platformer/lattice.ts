import { ENEMY_RADIUS, LOCKED, PLAYER_HALF } from "@/games/platformer/locked"
import {
  cellOf,
  enemyPosition,
  hitsCircle,
  isBlocked,
  type RuntimeLevel,
} from "@/games/platformer/runtime"

/**
 * Time-expanded lattice BFS. Cardinal moves at 120px/s are exactly 2px per tick,
 * so reachable centers are the even-pixel lattice. Port of the design solver:
 * dilate one step in N/S/E/W, stay, drop blocked cells, drop the hazard mask,
 * then split by which coins that cell collects.
 *
 * `marginPx` inflates the hazard radius. `twinTicks` unions the hazard over
 * every time offset in [-k, k], so a path is safe if play starts up to k ticks
 * early or late. The 4px / 3-tick floor is a 7-tick window (117ms).
 */
export const FAIR_CLEARANCE_PX = 4
export const FAIR_TWIN_TICKS = 3

const STEP_PX = 2
const LW = (LOCKED.cols * LOCKED.tilePx) / STEP_PX + 1
const LH = (LOCKED.rows * LOCKED.tilePx) / STEP_PX + 1
const CELLS = LW * LH
const WORDS = Math.ceil(CELLS / 32)

export type LatticeOptions = {
  marginPx?: number
  twinTicks?: number
  maxFrames?: number
  /** Keep the path so the caller can replay it through step(). */
  trace?: boolean
}

export type LatticeProof = {
  ok: boolean
  inputs: string[]
  frames: number
  reason: string
}

const pool: Uint8Array[] = []

function take(): Uint8Array {
  const buf = pool.pop()
  if (buf) {
    buf.fill(0)
    return buf
  }
  return new Uint8Array(CELLS)
}

function give(buf: Uint8Array): void {
  pool.push(buf)
}

function any(buf: Uint8Array): boolean {
  for (let i = 0; i < CELLS; i++) if (buf[i]) return true
  return false
}

function packInto(src: Uint8Array, dst: Uint32Array): void {
  dst.fill(0)
  for (let i = 0; i < CELLS; i++) {
    if (src[i]) dst[i >>> 5] |= 1 << (i & 31)
  }
}

function hasBit(bits: Uint32Array, index: number): boolean {
  return (bits[index >>> 5] & (1 << (index & 31))) !== 0
}

function stamp(mask: Uint8Array, ex: number, ey: number, radius: number): void {
  const reach = PLAYER_HALF + radius
  const i0 = Math.max(0, Math.ceil((ex - reach) / STEP_PX))
  const i1 = Math.min(LW - 1, Math.floor((ex + reach) / STEP_PX))
  const j0 = Math.max(0, Math.ceil((ey - reach) / STEP_PX))
  const j1 = Math.min(LH - 1, Math.floor((ey + reach) / STEP_PX))
  const r2 = radius * radius
  for (let j = j0; j <= j1; j++) {
    const py = j * STEP_PX
    const nearestY = Math.max(py - PLAYER_HALF, Math.min(ey, py + PLAYER_HALF))
    const dy = ey - nearestY
    const dy2 = dy * dy
    const row = j * LW
    for (let i = i0; i <= i1; i++) {
      const px = i * STEP_PX
      const nearestX = Math.max(px - PLAYER_HALF, Math.min(ex, px + PLAYER_HALF))
      const dx = ex - nearestX
      if (dx * dx + dy2 <= r2) mask[row + i] = 1
    }
  }
}

function dilate(src: Uint8Array, free: Uint8Array, dst: Uint8Array): void {
  dst.set(src)
  for (let j = 0; j < LH; j++) {
    const row = j * LW
    for (let i = 1; i < LW; i++) {
      if (src[row + i - 1] && free[row + i]) dst[row + i] = 1
    }
    for (let i = 0; i < LW - 1; i++) {
      if (src[row + i + 1] && free[row + i]) dst[row + i] = 1
    }
  }
  for (let j = 1; j < LH; j++) {
    const row = j * LW
    const prev = row - LW
    for (let i = 0; i < LW; i++) {
      if (src[prev + i] && free[row + i]) dst[row + i] = 1
    }
  }
  for (let j = 0; j < LH - 1; j++) {
    const row = j * LW
    const next = row + LW
    for (let i = 0; i < LW; i++) {
      if (src[next + i] && free[row + i]) dst[row + i] = 1
    }
  }
}

function applyDanger(dst: Uint8Array, danger: Uint8Array): void {
  for (let i = 0; i < CELLS; i++) if (danger[i]) dst[i] = 0
}

function absorb(
  into: (Uint8Array | null)[],
  mask: number,
  cells: Uint8Array,
  coinCells: number[][],
): void {
  const cur = new Map<number, Uint8Array>([[mask, cells]])
  let changed = true
  while (changed) {
    changed = false
    for (const m of [...cur.keys()]) {
      const arr = cur.get(m)
      if (!arr) continue
      for (let c = 0; c < coinCells.length; c++) {
        if (m & (1 << c)) continue
        let hit: Uint8Array | null = null
        for (const index of coinCells[c]) {
          if (!arr[index]) continue
          if (!hit) hit = take()
          hit[index] = 1
          arr[index] = 0
        }
        if (!hit) continue
        const nextMask = m | (1 << c)
        const prev = cur.get(nextMask)
        if (!prev) cur.set(nextMask, hit)
        else {
          for (let i = 0; i < CELLS; i++) if (hit[i]) prev[i] = 1
          give(hit)
        }
        changed = true
      }
    }
  }
  for (const [m, arr] of cur) {
    if (!any(arr)) {
      give(arr)
      continue
    }
    const prev = into[m]
    if (!prev) into[m] = arr
    else {
      for (let i = 0; i < CELLS; i++) if (arr[i]) prev[i] = 1
      give(arr)
    }
  }
}

function buildFree(level: RuntimeLevel): Uint8Array {
  const mask = new Uint8Array(CELLS)
  for (let j = 0; j < LH; j++) {
    for (let i = 0; i < LW; i++) {
      if (!isBlocked(level, i * STEP_PX, j * STEP_PX)) mask[j * LW + i] = 1
    }
  }
  return mask
}

function buildEnd(level: RuntimeLevel): number[] {
  const cells: number[] = []
  for (let j = 0; j < LH; j++) {
    for (let i = 0; i < LW; i++) {
      const cell = cellOf(i * STEP_PX, j * STEP_PX)
      if (cell && level.end[cell.row][cell.col]) cells.push(j * LW + i)
    }
  }
  return cells
}

function buildCoins(level: RuntimeLevel): { cells: number[][]; bits: Uint16Array } {
  const cells = level.coins.map((coin) => {
    const hit: number[] = []
    for (let j = 0; j < LH; j++) {
      for (let i = 0; i < LW; i++) {
        if (hitsCircle(i * STEP_PX, j * STEP_PX, coin.x, coin.y, level.coinRadius)) hit.push(j * LW + i)
      }
    }
    return hit
  })
  const bits = new Uint16Array(CELLS)
  cells.forEach((list, index) => {
    for (const cell of list) bits[cell] |= 1 << index
  })
  return { cells, bits }
}

function buildDanger(level: RuntimeLevel, radius: number, twin: number): Uint8Array[] {
  const cache: Uint8Array[] = []
  for (let phase = 0; phase < level.period; phase++) {
    const mask = new Uint8Array(CELLS)
    for (let off = -twin; off <= twin; off++) {
      for (const enemy of level.enemies) {
        const pos = enemyPosition(enemy, phase + off)
        stamp(mask, pos.x, pos.y, radius)
      }
    }
    cache.push(mask)
  }
  return cache
}

function snapshot(occ: (Uint8Array | null)[]): Map<number, Uint32Array> {
  const packed = new Map<number, Uint32Array>()
  for (let mask = 0; mask < occ.length; mask++) {
    const arr = occ[mask]
    if (!arr) continue
    const bits = new Uint32Array(WORDS)
    packInto(arr, bits)
    packed.set(mask, bits)
  }
  return packed
}

const DIRS: [string, number, number][] = [
  ["-", 0, 0],
  ["E", 1, 0],
  ["W", -1, 0],
  ["S", 0, 1],
  ["N", 0, -1],
]

function backtrack(
  history: Map<number, Uint32Array>[],
  frame: number,
  full: number,
  goal: number,
  free: Uint8Array,
  coinBits: Uint16Array,
): string[] {
  const rev: string[] = []
  let ci = goal % LW
  let cj = Math.floor(goal / LW)
  let cm = full
  for (let t = frame; t >= 1; t--) {
    let found: { code: string; i: number; j: number; mask: number } | null = null
    for (const [code, dx, dy] of DIRS) {
      const pi = ci - dx
      const pj = cj - dy
      if (code !== "-" && (pi < 0 || pj < 0 || pi >= LW || pj >= LH)) continue
      const cands: [number, number][] = [[pi, pj]]
      if (code !== "-") cands.push([ci, cj])
      for (const [qi, qj] of cands) {
        if (qi === ci && qj === cj && code !== "-" && free[cj * LW + ci] === 1 && (pi !== ci || pj !== cj)) {
          const ti = ci + dx
          const tj = cj + dy
          if (ti >= 0 && tj >= 0 && ti < LW && tj < LH && free[tj * LW + ti] === 1) continue
        }
        const destCoins = coinBits[cj * LW + ci]
        for (let pm = 0; pm <= full; pm++) {
          if ((pm & cm) !== pm) continue
          if ((pm | destCoins) !== cm) continue
          const prev = history[t - 1].get(pm)
          if (!prev || !hasBit(prev, qj * LW + qi)) continue
          found = { code, i: qi, j: qj, mask: pm }
          break
        }
        if (found) break
      }
      if (found) break
    }
    if (!found) throw new Error(`backtrack failed at tick ${t}`)
    rev.push(found.code)
    ci = found.i
    cj = found.j
    cm = found.mask
  }
  rev.reverse()
  return rev
}

function reached(occ: (Uint8Array | null)[], full: number, endCells: number[]): number {
  const arr = occ[full]
  if (!arr) return -1
  for (const index of endCells) if (arr[index]) return index
  return -1
}

function grew(visited: (Uint32Array | null)[][], occ: (Uint8Array | null)[], phase: number, scratch: Uint32Array): boolean {
  let extra = false
  for (let mask = 0; mask < occ.length; mask++) {
    const arr = occ[mask]
    if (!arr) continue
    packInto(arr, scratch)
    const seen = visited[mask][phase]
    if (!seen) {
      visited[mask][phase] = scratch.slice()
      extra = true
      continue
    }
    let more = false
    for (let w = 0; w < WORDS; w++) {
      if (scratch[w] & ~seen[w]) {
        more = true
        break
      }
    }
    if (!more) continue
    for (let w = 0; w < WORDS; w++) seen[w] |= scratch[w]
    extra = true
  }
  return extra
}

export function proveLattice(level: RuntimeLevel, speed: number, options: LatticeOptions = {}): LatticeProof {
  if (speed !== 120) throw new Error("lattice solver assumes 2px per tick")
  const marginPx = options.marginPx ?? 0
  const twinTicks = options.twinTicks ?? 0
  const maxFrames = options.maxFrames ?? 45 * 60
  const trace = options.trace ?? false
  const coins = level.coins.length
  if (coins > 8) throw new Error(`${level.id} has too many coins for the lattice solver`)
  const full = (1 << coins) - 1
  const free = buildFree(level)
  const endCells = buildEnd(level)
  const coin = buildCoins(level)
  const radius = ENEMY_RADIUS + marginPx
  const danger = buildDanger(level, radius, twinTicks)
  const si = Math.round(level.spawn.x / STEP_PX)
  const sj = Math.round(level.spawn.y / STEP_PX)
  if (Math.abs(si * STEP_PX - level.spawn.x) > 1e-4 || Math.abs(sj * STEP_PX - level.spawn.y) > 1e-4) {
    throw new Error(`${level.id} spawn is off the 2px lattice`)
  }
  const startIndex = sj * LW + si
  if (!free[startIndex]) {
    return { ok: false, inputs: [], frames: 0, reason: "spawn is blocked" }
  }

  const maskCount = 1 << coins
  let occ: (Uint8Array | null)[] = Array(maskCount).fill(null)
  const start = take()
  start[startIndex] = 1
  occ[0] = start
  const history: Map<number, Uint32Array>[] = []
  if (trace) history.push(snapshot(occ))
  const visited: (Uint32Array | null)[][] = Array.from({ length: maskCount }, () =>
    Array<Uint32Array | null>(level.period).fill(null),
  )
  const scratch = new Uint32Array(WORDS)

  for (let frame = 1; frame <= maxFrames; frame++) {
    const phase = ((frame % level.period) + level.period) % level.period
    const next: (Uint8Array | null)[] = Array(maskCount).fill(null)
    for (let mask = 0; mask < maskCount; mask++) {
      const src = occ[mask]
      if (!src) continue
      const dst = take()
      dilate(src, free, dst)
      applyDanger(dst, danger[phase])
      if (!any(dst)) {
        give(dst)
        continue
      }
      absorb(next, mask, dst, coin.cells)
    }
    for (const buf of occ) if (buf) give(buf)
    occ = next
    if (trace) history.push(snapshot(occ))
    const goal = reached(occ, full, endCells)
    if (goal >= 0) {
      const inputs = trace ? backtrack(history, frame, full, goal, free, coin.bits) : []
      for (const buf of occ) if (buf) give(buf)
      return { ok: true, inputs, frames: frame, reason: "" }
    }
    if (!occ.some((buf) => buf && any(buf))) {
      for (const buf of occ) if (buf) give(buf)
      return { ok: false, inputs: [], frames: frame, reason: `every state dies by tick ${frame}` }
    }
    if (!grew(visited, occ, phase, scratch)) {
      for (const buf of occ) if (buf) give(buf)
      return {
        ok: false,
        inputs: [],
        frames: frame,
        reason: `reachable set reached a fixed point at tick ${frame} without a clear`,
      }
    }
  }
  for (const buf of occ) if (buf) give(buf)
  return { ok: false, inputs: [], frames: maxFrames, reason: `no clear within ${maxFrames} ticks` }
}
