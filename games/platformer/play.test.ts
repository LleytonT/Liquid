import assert from "node:assert/strict"
import { test } from "node:test"
import seed from "./seed.json"
import gateDef from "./fixtures/gate-lip.json"
import { LOCKED, RESPAWN_FRAMES } from "./locked"
import { initialSim, step } from "./physics"
import { collectedCount, cellOf, hitsEnemy, positionsAt, buildLevel, type LevelDef, type RuntimeLevel, type Sim } from "./runtime"
import { preparePlatformer } from "./validate"
import { platformerCopy } from "./copy"
import { howToVisuals } from "@/games/howto"
import { drawFrame } from "./draw"
import { fallbackPlan } from "@/lib/ask/tweak"
import type { BranchRecord } from "@/lib/shell/game-module"

const snap = preparePlatformer(seed as BranchRecord)
const corridor = snap.levels[0]
const gate = buildLevel(gateDef as LevelDef, snap.coinRadiusPx)

function hold(sim: Sim, dir: { x: number; y: number }, frames: number, level = corridor): { sim: Sim; collected: number[] } {
  const collected: number[] = []
  let current = sim
  for (let i = 0; i < frames; i++) {
    const result = step(current, dir, level, snap.playerSpeed)
    current = result.sim
    collected.push(...result.events.collected)
    if (result.events.died) break
  }
  return { sim: current, collected }
}

function collectCoin(level: RuntimeLevel): { sim: Sim; index: number } {
  for (let index = 0; index < level.coins.length; index++) {
    const coin = level.coins[index]
    for (let frame = 0; frame < level.period; frame++) {
      const sim = { ...initialSim(level), x: coin.x, y: coin.y, frame, coins: level.coins.map(() => false) }
      const safe = positionsAt(level, frame + 1).every((enemy) => !hitsEnemy(sim.x, sim.y, enemy.x, enemy.y))
      if (!safe) continue
      const before = collectedCount(sim.coins)
      const result = step(sim, { x: 0, y: 0 }, level, snap.playerSpeed)
      if (result.events.died || !result.events.collected.includes(index)) continue
      assert.equal(collectedCount(result.sim.coins), before + 1)
      return { sim: result.sim, index }
    }
  }
  throw new Error(`no safe coin step on ${level.id}`)
}

test("a coin is counted in the same step it is collected", () => {
  for (const level of snap.levels) {
    const picked = collectCoin(level)
    assert.equal(collectedCount(picked.sim.coins), 1)
    const spawn = cellOf(level.spawn.x, level.spawn.y)
    const coin = cellOf(level.coins[picked.index].x, level.coins[picked.index].y)
    assert.ok(spawn && coin)
    assert.notDeepEqual(spawn, coin)
  }
})

test("death returns uncommitted coins on the respawn step the hud reads", () => {
  for (const level of snap.levels) {
    const picked = collectCoin(level)
    let sim = picked.sim
    assert.equal(collectedCount(sim.coins), 1)
    assert.equal(collectedCount(sim.committed), 0)
    const enemy = positionsAt(level, sim.frame + 1)[0]
    assert.ok(enemy)
    sim = { ...sim, x: enemy.x, y: enemy.y }
    const death = step(sim, { x: 0, y: 0 }, level, snap.playerSpeed)
    sim = death.sim
    assert.equal(death.events.died, true)
    assert.equal(collectedCount(sim.coins), 1)

    let respawned = false
    for (let i = 0; i < RESPAWN_FRAMES + 2 && !respawned; i++) {
      const before = sim.alive
      const result = step(sim, { x: 0, y: 0 }, level, snap.playerSpeed)
      sim = result.sim
      if (!before && sim.alive) {
        respawned = true
        assert.equal(collectedCount(sim.coins), 0)
        assert.equal(sim.cleared, false)
      }
    }
    assert.equal(respawned, true)
  }
})

test("the exit ignores a phantom coin count", () => {
  for (const level of snap.levels) {
    let endX = 0
    let endY = 0
    for (let row = 0; row < LOCKED.rows; row++) {
      for (let col = 0; col < LOCKED.cols; col++) {
        if (!level.end[row][col]) continue
        endX = (col + 0.5) * LOCKED.tilePx
        endY = (row + 0.5) * LOCKED.tilePx
      }
    }
    let safeFrame = -1
    for (let frame = 0; frame < level.period; frame++) {
      const safe = positionsAt(level, frame + 1).every((enemy) => !hitsEnemy(endX, endY, enemy.x, enemy.y))
      if (safe) {
        safeFrame = frame
        break
      }
    }
    assert.ok(safeFrame >= 0, `${level.id} end is never safe`)
    const none = level.coins.map(() => false)
    const short = step(
      { ...initialSim(level), x: endX, y: endY, frame: safeFrame, coins: none, committed: none.slice() },
      { x: 0, y: 0 },
      level,
      snap.playerSpeed,
    )
    assert.equal(short.events.cleared, false)
    assert.equal(short.sim.cleared, false)

    const all = level.coins.map(() => true)
    const full = step(
      { ...initialSim(level), x: endX, y: endY, frame: safeFrame, coins: all, committed: all.slice() },
      { x: 0, y: 0 },
      level,
      snap.playerSpeed,
    )
    assert.equal(full.events.cleared, true)
    assert.equal(collectedCount(full.sim.coins), level.coins.length)
    const hud = platformerCopy.formatStats([
      { id: "level", label: "level", value: "1" },
      { id: "levels", label: "levels", value: String(snap.levels.length) },
      { id: "coins", label: "coins", value: `${collectedCount(full.sim.coins)}/${level.coins.length}` },
      { id: "deaths", label: "deaths", value: "0" },
    ])
    assert.match(hud, new RegExp(`coins ${level.coins.length}/${level.coins.length}`))
  }
})

test("movement is 120px per simulated second on open ground", () => {
  assert.equal(snap.playerSpeed, 120)
  let sim = initialSim(corridor)
  let frames = 0
  for (let i = 0; i < 60; i++) {
    const next = step(sim, { x: 1, y: 0 }, corridor, snap.playerSpeed)
    if (next.events.died || next.sim.x === sim.x) break
    assert.equal(next.sim.x - sim.x, 2)
    assert.equal(next.sim.y, sim.y)
    sim = next.sim
    frames++
  }
  assert.ok(frames >= 30, `open east run was ${frames} frames`)
  assert.equal(sim.x - corridor.spawn.x, frames * 2)
  assert.equal(sim.y, corridor.spawn.y)
})

test("a slower enemy scale moves the blue shapes less on every level", () => {
  const plan = fallbackPlan("platformer", "make the blue shapes slower")
  assert.equal(plan.patch?.enemySpeedScale, 0.55)
  for (const level of snap.levels) {
    const scale = plan.patch?.enemySpeedScale ?? 1
    const origin = positionsAt(level, 0, 1)
    const full = positionsAt(level, 1, 1)
    const slow = positionsAt(level, 1, scale)
    assert.equal(full.length, level.enemies.length)
    let slowed = 0
    for (let i = 0; i < full.length; i++) {
      const fullTravel = Math.hypot(full[i].x - origin[i].x, full[i].y - origin[i].y)
      const slowTravel = Math.hypot(slow[i].x - origin[i].x, slow[i].y - origin[i].y)
      if (Math.abs(slowTravel - fullTravel * scale) < 0.05) slowed++
    }
    assert.equal(slowed, level.enemies.length, `${level.id} scaled ${slowed}/${level.enemies.length} dots`)
  }
})

test("the you marker is drawn on a new level and only while it is armed", () => {
  const texts: string[] = []
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "fillText" || prop === "strokeText") {
        return (text: string) => {
          texts.push(text)
        }
      }
      if (typeof prop === "symbol") return undefined
      return () => proxy
    },
    set() {
      return true
    },
  }
  const proxy = new Proxy({}, handler)
  const input = {
    level: corridor,
    sim: initialSim(corridor),
    flips: new Map(),
    flipStart: 0,
    now: 0,
    trails: corridor.enemies.map(() => []),
    ghosts: [],
    flashUntil: 0,
    holdPlayerUntil: 0,
    playerVisualPx: snap.playerVisualPx,
    enemyVisualRadius: snap.enemyVisualRadiusPx,
    youUntil: 3000,
    youPulse: false,
  }
  drawFrame(proxy as CanvasRenderingContext2D, input)
  assert.ok(texts.includes("you"))
  texts.length = 0
  drawFrame(proxy as CanvasRenderingContext2D, { ...input, youUntil: 0 })
  assert.equal(texts.includes("you"), false)
})

test("how to play still covers move, coins, and the ask", () => {
  const steps = platformerCopy.howTo(seed as BranchRecord)
  assert.deepEqual(
    steps.map((step) => step.id),
    ["move", "dodge", "deaths", "goal", "remix"],
  )
  assert.match(steps.map((step) => step.copy).join(" "), /coin/)
  for (const step of steps) {
    assert.equal(typeof howToVisuals.platformer[step.id], "function", step.id)
  }
})

test("a 2px lip does not trap a leftward move", () => {
  let sim = { ...initialSim(gate), x: 268, y: 214, frame: 0 }
  for (let i = 0; i < 20; i++) {
    const result = step(sim, { x: -1, y: 0 }, gate, snap.playerSpeed)
    assert.equal(result.events.died, false)
    sim = result.sim
  }
  assert.ok(sim.x < 230, `still snagged at ${sim.x},${sim.y}`)
  assert.ok(sim.y <= 212 && sim.y >= 204)

  let walled = initialSim(gate)
  for (let i = 0; i < 40; i++) {
    const next = step(walled, { x: -1, y: 0 }, gate, snap.playerSpeed)
    walled = next.sim
  }
  assert.ok(walled.x > LOCKED.tilePx, `walked through the border at ${walled.x}`)
})

test("walking into the new corridor border does not leave the room", () => {
  const walled = hold(initialSim(corridor), { x: -1, y: 0 }, 40).sim
  assert.ok(walled.x > LOCKED.tilePx, `walked through the border at ${walled.x}`)
})
