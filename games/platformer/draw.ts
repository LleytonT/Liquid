import { SOUND_LEAD_MS } from "@/lib/shell/audio"
import { sampleTileFlip, type PlannedFlip } from "@/lib/shell/tile-flip"
import { FEEL } from "@/games/platformer/feel"
import { LOCKED } from "@/games/platformer/locked"
import { PALETTE } from "@/games/platformer/palette"
import { positionsAt, type RuntimeLevel, type Sim, type Vec } from "@/games/platformer/runtime"

export type GhostPath = {
  points: Vec[]
  born: number
}

export type DrawInput = {
  level: RuntimeLevel
  sim: Sim
  flips: Map<string, PlannedFlip>
  flipStart: number
  now: number
  trails: Vec[][]
  ghosts: GhostPath[]
  flashUntil: number
  holdPlayerUntil: number
  playerVisualPx: number
  enemyVisualRadius: number
  enemySpeedScale?: number
  /** Show the spawn marker until this timestamp. 0 hides it. */
  youUntil?: number
  youPulse?: boolean
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  ctx.fillRect(x, y, size, size)
}

export function drawFrame(ctx: CanvasRenderingContext2D, input: DrawInput): void {
  const { level, sim, now } = input
  const elapsed = now - input.flipStart
  ctx.clearRect(0, 0, LOCKED.cols * LOCKED.tilePx, LOCKED.rows * LOCKED.tilePx)

  for (let row = 0; row < LOCKED.rows; row++) {
    for (let col = 0; col < LOCKED.cols; col++) {
      if (level.wall[row][col]) continue
      ctx.fillStyle = (col + row) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB
      ctx.fillRect(col * LOCKED.tilePx, row * LOCKED.tilePx, LOCKED.tilePx, LOCKED.tilePx)
    }
  }

  for (let row = 0; row < LOCKED.rows; row++) {
    for (let col = 0; col < LOCKED.cols; col++) {
      const ch = level.grid[row][col]
      if (ch === "#" || ch === "S" || ch === "C" || ch === "E") {
        const id = `${col},${row}`
        const planned = input.flips.get(id)
        const sample = planned
          ? sampleTileFlip(elapsed, planned.delayMs, planned.durationMs)
          : { scaleY: 1, outline: 0, started: true }
        if (!sample.started) continue
        const color = ch === "#" ? PALETTE.wall : PALETTE.safe
        paintTile(
          ctx,
          (col + 0.5) * LOCKED.tilePx,
          (row + 0.5) * LOCKED.tilePx,
          LOCKED.tilePx,
          sample.scaleY,
          color,
          sample.outline,
          ch === "E",
        )
      }
    }
  }

  const pulse = 0.55 + 0.45 * Math.sin((now / FEEL.coinPulseMs) * Math.PI * 2)
  level.coins.forEach((coin, index) => {
    if (sim.coins[index]) return
    const planned = input.flips.get(`coin-${index}`)
    const sample = planned
      ? sampleTileFlip(elapsed, planned.delayMs, planned.durationMs)
      : { scaleY: 1, outline: 0, started: true }
    if (!sample.started) return
    ctx.save()
    ctx.translate(coin.x, coin.y)
    ctx.scale(1, Math.max(0, sample.scaleY))
    const glow = level.coinRadius + 8 + pulse * 10
    const gradient = ctx.createRadialGradient(2, 2, level.coinRadius * 0.2, 2, 2, glow)
    gradient.addColorStop(0, "rgba(255, 225, 77, 0.9)")
    gradient.addColorStop(1, "rgba(255, 225, 77, 0)")
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(2, 2, glow, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = PALETTE.shadow
    ctx.beginPath()
    ctx.arc(2, 2, level.coinRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = PALETTE.coin
    ctx.beginPath()
    ctx.arc(0, 0, level.coinRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = PALETTE.ink
    ctx.stroke()
    if (sample.outline > 0) {
      ctx.strokeStyle = hexAlpha(PALETTE.agent, sample.outline)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, level.coinRadius + 3, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  })

  for (const ghost of input.ghosts) {
    if (ghost.points.length < 2) continue
    const alpha = 0.55 * (1 - (now - ghost.born) / FEEL.ghostFadeMs)
    if (alpha <= 0) continue
    ctx.beginPath()
    ctx.moveTo(ghost.points[0].x, ghost.points[0].y)
    for (const point of ghost.points) ctx.lineTo(point.x, point.y)
    ctx.strokeStyle = `rgba(255, 46, 46, ${alpha})`
    ctx.lineWidth = 3
    ctx.stroke()
  }

  const enemies = positionsAt(level, sim.frame, input.enemySpeedScale ?? 1)
  enemies.forEach((enemy, index) => {
    const trail = input.trails[index] ?? []
    ctx.lineCap = "round"
    for (let trailIndex = 1; trailIndex < trail.length; trailIndex++) {
      const fade = trailIndex / (trail.length - 1 || 1)
      ctx.strokeStyle = hexAlpha(PALETTE.enemy, 0.15 + fade * 0.55)
      ctx.lineWidth = input.enemyVisualRadius * (0.35 + fade * 0.9)
      ctx.beginPath()
      ctx.moveTo(trail[trailIndex - 1].x, trail[trailIndex - 1].y)
      ctx.lineTo(trail[trailIndex].x, trail[trailIndex].y)
      ctx.stroke()
    }
    ctx.fillStyle = PALETTE.shadow
    ctx.beginPath()
    ctx.arc(enemy.x + 2, enemy.y + 2, input.enemyVisualRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = PALETTE.enemy
    ctx.beginPath()
    ctx.arc(enemy.x, enemy.y, input.enemyVisualRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = PALETTE.ink
    ctx.stroke()
  })

  const showPlayer = sim.alive || now < input.holdPlayerUntil
  if (showPlayer && !sim.cleared) {
    paintTile(ctx, sim.x, sim.y, input.playerVisualPx, 1, PALETTE.player, 0)
    if (input.youUntil && now < input.youUntil) paintYou(ctx, sim.x, sim.y, input.playerVisualPx, now, input.youPulse !== false)
  } else if (showPlayer && sim.cleared) {
    paintTile(ctx, sim.x, sim.y, input.playerVisualPx, 1, PALETTE.player, 0.8)
  }

  if (now < input.flashUntil) {
    const alpha = Math.max(0, (input.flashUntil - now) / 180) * 0.35
    ctx.fillStyle = `rgba(226, 59, 59, ${alpha})`
    ctx.fillRect(0, 0, LOCKED.cols * LOCKED.tilePx, LOCKED.rows * LOCKED.tilePx)
  }
}

function paintTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  scaleY: number,
  color: string,
  outline: number,
  goal = false,
): void {
  const scale = Math.max(0, scaleY)
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(1, scale)
  ctx.fillStyle = PALETTE.shadow
  roundRect(ctx, -size / 2 + 2, -size / 2 + 2, size)
  ctx.fillStyle = color
  roundRect(ctx, -size / 2, -size / 2, size)
  ctx.strokeStyle = PALETTE.ink
  ctx.lineWidth = 3
  ctx.strokeRect(-size / 2 + 1.5, -size / 2 + 1.5, size - 3, size - 3)
  if (goal) {
    ctx.strokeRect(-size / 2 + 8, -size / 2 + 8, size - 16, size - 16)
  }
  if (outline > 0) {
    ctx.strokeStyle = hexAlpha(PALETTE.agent, outline)
    ctx.lineWidth = 3
    ctx.strokeRect(-size / 2 - 1.5, -size / 2 - 1.5, size + 3, size + 3)
  }
  ctx.restore()
}

/** Dark ink plus a white halo, so the marker reads on both floor colors and on walls. */
function paintYou(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  now: number,
  pulse: boolean,
): void {
  const alpha = pulse ? 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now / 140)) : 1
  const pad = 5
  ctx.save()
  ctx.translate(x, y)
  ctx.lineWidth = 5
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`
  ctx.strokeRect(-size / 2 - pad, -size / 2 - pad, size + pad * 2, size + pad * 2)
  ctx.lineWidth = 2.5
  ctx.strokeStyle = `rgba(26, 26, 46, ${alpha})`
  ctx.strokeRect(-size / 2 - pad, -size / 2 - pad, size + pad * 2, size + pad * 2)
  ctx.font = "700 13px sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "bottom"
  ctx.lineWidth = 4
  ctx.strokeStyle = "rgba(255, 255, 255, 0.96)"
  ctx.strokeText("you", 0, -size / 2 - 8)
  ctx.fillStyle = "#1A1A2E"
  ctx.fillText("you", 0, -size / 2 - 8)
  ctx.restore()
}

function hexAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "")
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const VISUAL_LEAD_MS = SOUND_LEAD_MS

/** The same sprites the level canvas paints, for how-to-play and other chrome. */
export function drawPlayerSprite(ctx: CanvasRenderingContext2D, x: number, y: number, size = 28): void {
  paintTile(ctx, x, y, size, 1, PALETTE.player, 0)
}

export function drawEnemySprite(ctx: CanvasRenderingContext2D, x: number, y: number, radius = 8): void {
  ctx.save()
  ctx.fillStyle = PALETTE.shadow
  ctx.beginPath()
  ctx.arc(x + 2, y + 2, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = PALETTE.enemy
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = PALETTE.ink
  ctx.stroke()
  ctx.restore()
}

export function drawCoinSprite(ctx: CanvasRenderingContext2D, x: number, y: number, radius = 12): void {
  ctx.save()
  ctx.fillStyle = PALETTE.shadow
  ctx.beginPath()
  ctx.arc(x + 2, y + 2, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = PALETTE.coin
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = PALETTE.ink
  ctx.stroke()
  ctx.restore()
}

export function drawSafeSprite(ctx: CanvasRenderingContext2D, x: number, y: number, size = 32): void {
  paintTile(ctx, x, y, size, 1, PALETTE.safe, 0, true)
}
