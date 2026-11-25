import { assertBranchShape } from "@/lib/shell/branch"
import type { BranchRecord } from "@/lib/shell/game-module"
import { LOCKED } from "@/games/platformer/locked"
import { ROLE_COLORS } from "@/games/platformer/palette"
import {
  buildLevel,
  circleHitsTile,
  enemyPosition,
  type LevelDef,
  type RuntimeLevel,
} from "@/games/platformer/runtime"

export type PlatformerSnapshot = {
  id: string
  playerSpeed: number
  playerVisualPx: number
  enemyVisualRadiusPx: number
  coinRadiusPx: number
  enemySpeedScale: number
  levels: RuntimeLevel[]
}

const LOCKED_KEYS = [
  "playerHitboxPx",
  "enemyHitboxPx",
  "respawnMs",
  "tilePx",
  "cols",
  "rows",
  "enemySpeedMin",
  "enemySpeedMax",
] as const

const GRID_CHARS = new Set(["#", ".", "S", "C", "E"])

function fail(message: string): never {
  throw new Error(message)
}

function readLevel(value: unknown, index: number): LevelDef {
  if (!value || typeof value !== "object") fail(`level ${index} is missing`)
  const level = value as LevelDef
  if (typeof level.id !== "string" || typeof level.name !== "string") {
    fail(`level ${index} needs an id and a name`)
  }
  if (!Array.isArray(level.grid) || level.grid.length !== LOCKED.rows) {
    fail(`${level.id}: grid must be ${LOCKED.rows} rows`)
  }
  for (const row of level.grid) {
    if (row.length !== LOCKED.cols) fail(`${level.id}: each row must be ${LOCKED.cols} cells`)
    for (const ch of row) {
      if (!GRID_CHARS.has(ch)) fail(`${level.id}: "${ch}" is not a level cell`)
    }
  }
  if (!level.grid.some((row) => row.includes("S"))) fail(`${level.id}: no spawn`)
  if (!level.grid.some((row) => row.includes("E"))) fail(`${level.id}: no end zone`)
  if (!Array.isArray(level.coins)) fail(`${level.id}: coins must be a list`)
  for (const coin of level.coins) {
    const ch = level.grid[coin.row]?.[coin.col]
    if (ch !== ".") fail(`${level.id}: coin sits on "${ch ?? "nothing"}"`)
  }
  if (!Array.isArray(level.enemies)) fail(`${level.id}: enemies must be a list`)
  for (const enemy of level.enemies) {
    if (enemy.speed < LOCKED.enemySpeedMin || enemy.speed > LOCKED.enemySpeedMax) {
      fail(`${level.id}: ${enemy.id} speed ${enemy.speed} is outside ${LOCKED.enemySpeedMin}-${LOCKED.enemySpeedMax}`)
    }
    if (enemy.mode !== "pingpong" && enemy.mode !== "loop") {
      fail(`${level.id}: ${enemy.id} has an unknown path mode`)
    }
    if (!Array.isArray(enemy.points) || enemy.points.length < 2) {
      fail(`${level.id}: ${enemy.id} needs a path`)
    }
  }
  return level
}

export function enemyCrossesSpawn(level: RuntimeLevel, grid: string[]): string | null {
  for (const enemy of level.enemies) {
    const samples = Math.max(2, Math.ceil(enemy.poly.total))
    for (let i = 0; i <= samples; i++) {
      const frame = (i / samples) * enemy.period
      const pos = enemyPosition(enemy, frame)
      for (let row = 0; row < LOCKED.rows; row++) {
        for (let col = 0; col < LOCKED.cols; col++) {
          if (grid[row][col] !== "S") continue
          if (circleHitsTile(pos.x, pos.y, LOCKED.enemyHitboxPx / 2, col, row)) {
            return `${enemy.id} crosses the spawn`
          }
        }
      }
    }
  }
  return null
}

export function preparePlatformer(branch: BranchRecord): PlatformerSnapshot {
  assertBranchShape(branch)
  if (branch.gameId !== "platformer") {
    fail(`${branch.id} is not a platformer branch`)
  }
  const tunables = branch.snapshot.tunables
  for (const key of LOCKED_KEYS) {
    const knob = tunables[key]
    const expected = LOCKED[key]
    if (!knob || !knob.locked || knob.value !== expected || knob.min !== expected || knob.max !== expected) {
      fail(`${key} is locked at ${expected}`)
    }
  }
  const speed = tunables.playerSpeed
  if (!speed || speed.locked || speed.min !== LOCKED.playerSpeedMin || speed.max !== LOCKED.playerSpeedMax) {
    fail(`playerSpeed must stay inside ${LOCKED.playerSpeedMin}-${LOCKED.playerSpeedMax}`)
  }
  if (speed.value < speed.min || speed.value > speed.max) fail("playerSpeed is out of range")
  for (const key of ["playerVisualPx", "enemyVisualRadiusPx", "coinRadiusPx"] as const) {
    if (!tunables[key]) fail(`${key} is missing`)
  }

  const colors = branch.snapshot.bible.lockedCore.colors
  if (!colors || typeof colors !== "object") fail("bible colors are missing")
  for (const [role, hex] of Object.entries(ROLE_COLORS)) {
    if ((colors as Record<string, unknown>)[role] !== hex) {
      fail(`bible color for ${role} is locked at ${hex}`)
    }
  }
  const rules = branch.snapshot.bible.lockedCore.rules
  if (!Array.isArray(rules)) fail("bible rules are missing")
  for (const rule of [
    "every level is finishable",
    "no enemy path crosses a spawn tile",
    "no text inside a level",
  ]) {
    if (!rules.includes(rule)) fail(`bible is missing "${rule}"`)
  }

  const content = branch.snapshot.content
  if (!content || typeof content !== "object" || !("levels" in content)) {
    fail("snapshot content has no levels")
  }
  const rawLevels = (content as { levels: unknown }).levels
  if (!Array.isArray(rawLevels) || rawLevels.length === 0) fail("snapshot has no levels")
  const defs = rawLevels.map((level, index) => readLevel(level, index))
  const levels = defs.map((def) => buildLevel(def, tunables.coinRadiusPx.value))
  for (let i = 0; i < levels.length; i++) {
    const crossing = enemyCrossesSpawn(levels[i], defs[i].grid)
    if (crossing) fail(`${levels[i].id}: ${crossing}`)
  }

  const enemySpeed = tunables.enemySpeedScale
  if (enemySpeed && (enemySpeed.value < enemySpeed.min || enemySpeed.value > enemySpeed.max)) {
    fail("enemySpeedScale is out of range")
  }

  return {
    id: branch.snapshot.id,
    playerSpeed: speed.value,
    playerVisualPx: tunables.playerVisualPx.value,
    enemyVisualRadiusPx: tunables.enemyVisualRadiusPx.value,
    coinRadiusPx: tunables.coinRadiusPx.value,
    enemySpeedScale: enemySpeed?.value ?? 1,
    levels,
  }
}
