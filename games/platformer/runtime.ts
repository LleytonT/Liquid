import { LOCKED, PLAYER_HALF, ENEMY_RADIUS } from "@/games/platformer/locked"

export type GridChar = "#" | "." | "S" | "C" | "E"

export type LevelDef = {
  id: string
  name: string
  grid: string[]
  coins: { col: number; row: number }[]
  enemies: {
    id: string
    speed: number
    phase: number
    mode: "pingpong" | "loop"
    points: { x: number; y: number }[]
  }[]
}

export type Vec = { x: number; y: number }

export type Polyline = {
  pts: Vec[]
  seg: number[]
  total: number
}

export type RuntimeEnemy = {
  id: string
  speed: number
  phase: number
  mode: "pingpong" | "loop"
  poly: Polyline
  period: number
}

export type RuntimeLevel = {
  id: string
  name: string
  grid: string[]
  wall: boolean[][]
  checkpoint: boolean[][]
  end: boolean[][]
  safe: boolean[][]
  spawn: Vec
  coins: Vec[]
  enemies: RuntimeEnemy[]
  period: number
  coinRadius: number
  anchors: Map<string, Vec>
}

export type Sim = {
  frame: number
  x: number
  y: number
  coins: boolean[]
  committed: boolean[]
  alive: boolean
  respawnFrames: number
  checkpoint: Vec
  cleared: boolean
}

export type Dir = { x: number; y: number }

export function cellOf(x: number, y: number): { col: number; row: number } | null {
  const col = Math.floor(x / LOCKED.tilePx)
  const row = Math.floor(y / LOCKED.tilePx)
  if (col < 0 || row < 0 || col >= LOCKED.cols || row >= LOCKED.rows) return null
  return { col, row }
}

export function cellCenter(col: number, row: number): Vec {
  return {
    x: (col + 0.5) * LOCKED.tilePx,
    y: (row + 0.5) * LOCKED.tilePx,
  }
}

function buildPolyline(points: Vec[]): Polyline {
  const seg: number[] = []
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const length = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y)
    seg.push(length)
    total += length
  }
  return { pts: points, seg, total }
}

function pointAlong(poly: Polyline, distance: number): Vec {
  let remaining = distance
  for (let i = 0; i < poly.seg.length; i++) {
    if (remaining <= poly.seg[i] || i === poly.seg.length - 1) {
      const span = poly.seg[i] || 1
      const t = Math.min(1, Math.max(0, remaining / span))
      return {
        x: poly.pts[i].x + (poly.pts[i + 1].x - poly.pts[i].x) * t,
        y: poly.pts[i].y + (poly.pts[i + 1].y - poly.pts[i].y) * t,
      }
    }
    remaining -= poly.seg[i]
  }
  return poly.pts[poly.pts.length - 1]
}

export function enemyPeriod(total: number, mode: "pingpong" | "loop", speed: number): number {
  const cycle = mode === "pingpong" ? total * 2 : total
  const frames = (cycle * 60) / speed
  if (Math.abs(frames - Math.round(frames)) > 1e-4) {
    throw new Error(`enemy period is not a whole number of frames (${frames})`)
  }
  return Math.round(frames)
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const next = x % y
    x = y
    y = next
  }
  return x || 1
}

function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b
}

function componentAnchor(cells: { col: number; row: number }[]): Vec {
  let best = cells[0]
  const ac = cells.reduce((sum, cell) => sum + cell.col, 0) / cells.length
  const ar = cells.reduce((sum, cell) => sum + cell.row, 0) / cells.length
  let bestD = Infinity
  for (const cell of cells) {
    const d = (cell.col - ac) ** 2 + (cell.row - ar) ** 2
    const closer = d < bestD - 1e-9
    const tie =
      Math.abs(d - bestD) <= 1e-9 &&
      (cell.row < best.row || (cell.row === best.row && cell.col < best.col))
    if (closer || tie) {
      best = cell
      bestD = d
    }
  }
  return cellCenter(best.col, best.row)
}

function floodAnchors(
  grid: string[],
  chars: Set<string>,
): Map<string, Vec> {
  const seen = Array.from({ length: LOCKED.rows }, () => Array(LOCKED.cols).fill(false))
  const anchors = new Map<string, Vec>()
  for (let row = 0; row < LOCKED.rows; row++) {
    for (let col = 0; col < LOCKED.cols; col++) {
      if (seen[row][col] || !chars.has(grid[row][col])) continue
      const cells: { col: number; row: number }[] = []
      const stack = [{ col, row }]
      seen[row][col] = true
      while (stack.length) {
        const cell = stack.pop()!
        cells.push(cell)
        for (const [dc, dr] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const c = cell.col + dc
          const r = cell.row + dr
          if (c < 0 || r < 0 || c >= LOCKED.cols || r >= LOCKED.rows) continue
          if (seen[r][c] || !chars.has(grid[r][c])) continue
          seen[r][c] = true
          stack.push({ col: c, row: r })
        }
      }
      const anchor = componentAnchor(cells)
      for (const cell of cells) anchors.set(`${cell.col},${cell.row}`, anchor)
    }
  }
  return anchors
}

export function buildLevel(def: LevelDef, coinRadius: number): RuntimeLevel {
  const wall: boolean[][] = []
  const checkpoint: boolean[][] = []
  const end: boolean[][] = []
  const safe: boolean[][] = []
  for (let row = 0; row < LOCKED.rows; row++) {
    wall[row] = []
    checkpoint[row] = []
    end[row] = []
    safe[row] = []
    for (let col = 0; col < LOCKED.cols; col++) {
      const ch = def.grid[row][col]
      wall[row][col] = ch === "#"
      checkpoint[row][col] = ch === "S" || ch === "C"
      end[row][col] = ch === "E"
      safe[row][col] = ch === "S" || ch === "C" || ch === "E"
    }
  }
  const anchors = floodAnchors(def.grid, new Set(["S", "C"]))
  const spawnCells: { col: number; row: number }[] = []
  for (let row = 0; row < LOCKED.rows; row++) {
    for (let col = 0; col < LOCKED.cols; col++) {
      if (def.grid[row][col] === "S") spawnCells.push({ col, row })
    }
  }
  const spawn = componentAnchor(spawnCells)
  const enemies: RuntimeEnemy[] = def.enemies.map((enemy) => {
    const pts = enemy.points.map((point) => ({
      x: point.x * LOCKED.tilePx,
      y: point.y * LOCKED.tilePx,
    }))
    const poly = buildPolyline(pts)
    return {
      id: enemy.id,
      speed: enemy.speed,
      phase: enemy.phase,
      mode: enemy.mode,
      poly,
      period: enemyPeriod(poly.total, enemy.mode, enemy.speed),
    }
  })
  const period = enemies.reduce((acc, enemy) => lcm(acc, enemy.period), 1)
  return {
    id: def.id,
    name: def.name,
    grid: def.grid,
    wall,
    checkpoint,
    end,
    safe,
    spawn,
    coins: def.coins.map((coin) => cellCenter(coin.col, coin.row)),
    enemies,
    period,
    coinRadius,
    anchors,
  }
}

export function enemyPosition(enemy: RuntimeEnemy, frame: number): Vec {
  const cycle = enemy.mode === "pingpong" ? enemy.poly.total * 2 : enemy.poly.total
  let distance = (enemy.speed * frame) / 60 + enemy.phase
  distance = ((distance % cycle) + cycle) % cycle
  if (enemy.mode === "pingpong" && distance > enemy.poly.total) {
    distance = cycle - distance
  }
  return pointAlong(enemy.poly, distance)
}

export function positionsAt(level: RuntimeLevel, frame: number): Vec[] {
  return level.enemies.map((enemy) => enemyPosition(enemy, frame))
}

export function isBlocked(level: RuntimeLevel, x: number, y: number): boolean {
  const left = x - PLAYER_HALF
  const top = y - PLAYER_HALF
  const right = x + PLAYER_HALF - 1e-6
  const bottom = y + PLAYER_HALF - 1e-6
  const c0 = Math.floor(left / LOCKED.tilePx)
  const c1 = Math.floor(right / LOCKED.tilePx)
  const r0 = Math.floor(top / LOCKED.tilePx)
  const r1 = Math.floor(bottom / LOCKED.tilePx)
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      if (row < 0 || col < 0 || row >= LOCKED.rows || col >= LOCKED.cols) return true
      if (level.wall[row][col]) return true
    }
  }
  return false
}

export function hitsEnemy(px: number, py: number, ex: number, ey: number): boolean {
  const nearestX = Math.max(px - PLAYER_HALF, Math.min(ex, px + PLAYER_HALF))
  const nearestY = Math.max(py - PLAYER_HALF, Math.min(ey, py + PLAYER_HALF))
  const dx = ex - nearestX
  const dy = ey - nearestY
  return dx * dx + dy * dy <= ENEMY_RADIUS * ENEMY_RADIUS
}

export function hitsCircle(
  px: number,
  py: number,
  cx: number,
  cy: number,
  radius: number,
): boolean {
  const nearestX = Math.max(px - PLAYER_HALF, Math.min(cx, px + PLAYER_HALF))
  const nearestY = Math.max(py - PLAYER_HALF, Math.min(cy, py + PLAYER_HALF))
  const dx = cx - nearestX
  const dy = cy - nearestY
  return dx * dx + dy * dy <= radius * radius
}

export function isSafe(level: RuntimeLevel, x: number, y: number): boolean {
  const cell = cellOf(x, y)
  if (!cell) return false
  return level.safe[cell.row][cell.col]
}

export function distanceToSegment(px: number, py: number, a: Vec, b: Vec): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2))
  return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t))
}

export function distanceToPolyline(x: number, y: number, poly: Polyline): number {
  let best = Infinity
  for (let i = 0; i < poly.seg.length; i++) {
    best = Math.min(best, distanceToSegment(x, y, poly.pts[i], poly.pts[i + 1]))
  }
  return best
}

/** True when no enemy center can ever reach the player's hitbox here. */
export function isFar(level: RuntimeLevel, x: number, y: number): boolean {
  const limit = PLAYER_HALF + ENEMY_RADIUS + 4
  for (const enemy of level.enemies) {
    if (distanceToPolyline(x, y, enemy.poly) <= limit) return false
  }
  return true
}

export function circleHitsTile(
  cx: number,
  cy: number,
  radius: number,
  col: number,
  row: number,
): boolean {
  const left = col * LOCKED.tilePx
  const top = row * LOCKED.tilePx
  const nearestX = Math.max(left, Math.min(cx, left + LOCKED.tilePx))
  const nearestY = Math.max(top, Math.min(cy, top + LOCKED.tilePx))
  return (cx - nearestX) ** 2 + (cy - nearestY) ** 2 <= radius * radius
}

export function createSim(level: RuntimeLevel): Sim {
  return {
    frame: 0,
    x: level.spawn.x,
    y: level.spawn.y,
    coins: level.coins.map(() => false),
    committed: level.coins.map(() => false),
    alive: true,
    respawnFrames: 0,
    checkpoint: { x: level.spawn.x, y: level.spawn.y },
    cleared: false,
  }
}

/** Coins currently held. The HUD and the exit both read this array. */
export function collectedCount(coins: readonly boolean[]): number {
  let count = 0
  for (const coin of coins) if (coin) count += 1
  return count
}
