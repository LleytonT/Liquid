/**
 * Hitboxes and respawn are shell constants for this game.
 * Physics reads these numbers. The snapshot must match them; it cannot override them.
 */
export const LOCKED = {
  playerHitboxPx: 24,
  enemyHitboxPx: 6,
  respawnMs: 500,
  tilePx: 32,
  cols: 20,
  rows: 13,
  enemySpeedMin: 60,
  enemySpeedMax: 260,
  playerSpeedMin: 100,
  playerSpeedMax: 140,
} as const

export const PLAYER_HALF = LOCKED.playerHitboxPx / 2
export const ENEMY_RADIUS = LOCKED.enemyHitboxPx / 2
export const DT = 1 / 60
export const RESPAWN_FRAMES = Math.round((LOCKED.respawnMs / 1000) * 60)
