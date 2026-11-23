/**
 * Tile flip-in. Shell primitive: callers pass tiles, the shell owns the motion.
 * Defaults are the locked feel values (20ms stagger, 260ms ease-out-back,
 * 600ms purple outline). A game decides which tiles flip, not how.
 */

export const TILE_FLIP = {
  staggerMs: 20,
  durationMs: 260,
  outlineMs: 600,
} as const

export type FlipTile = {
  id: string
  x: number
  y: number
}

export type PlannedFlip = FlipTile & {
  delayMs: number
  durationMs: number
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

/** Order tiles in a sweep from `origin` and assign a 20ms stagger. */
export function planTileFlip(
  tiles: readonly FlipTile[],
  origin: { x: number; y: number },
  options?: { staggerMs?: number; durationMs?: number },
): PlannedFlip[] {
  const staggerMs = options?.staggerMs ?? TILE_FLIP.staggerMs
  const durationMs = options?.durationMs ?? TILE_FLIP.durationMs
  const ranked = tiles.map((tile) => ({
    tile,
    dist: Math.hypot(tile.x - origin.x, tile.y - origin.y),
    angle: Math.atan2(tile.y - origin.y, tile.x - origin.x),
  }))
  ranked.sort((a, b) => a.dist - b.dist || a.angle - b.angle)
  return ranked.map((entry, index) => ({
    id: entry.tile.id,
    x: entry.tile.x,
    y: entry.tile.y,
    delayMs: index * staggerMs,
    durationMs,
  }))
}

export type FlipSample = {
  /** Vertical scale, 0 before the tile starts, then ease-out-back. */
  scaleY: number
  /** Outline strength from 1 to 0 across the outline window. */
  outline: number
  started: boolean
}

export function sampleTileFlip(
  elapsedMs: number,
  delayMs: number,
  durationMs: number,
  outlineMs: number = TILE_FLIP.outlineMs,
): FlipSample {
  const local = elapsedMs - delayMs
  if (local < 0) return { scaleY: 0, outline: 0, started: false }
  const t = Math.min(1, local / durationMs)
  const outline = local <= outlineMs ? 1 - local / outlineMs : 0
  return { scaleY: easeOutBack(t), outline, started: true }
}
