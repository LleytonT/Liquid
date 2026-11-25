import assert from "node:assert/strict"
import { test } from "node:test"
import seed from "./seed.json"
import { LOCKED, RESPAWN_FRAMES } from "./locked"
import { initialSim, step } from "./physics"
import { collectedCount, cellOf, positionsAt, type Sim } from "./runtime"
import { preparePlatformer } from "./validate"
import type { BranchRecord } from "@/lib/shell/game-module"

const snap = preparePlatformer(seed as BranchRecord)
const anteroom = snap.levels[0]
const gate = snap.levels[1]

function hold(sim: Sim, dir: { x: number; y: number }, frames: number, level = anteroom): { sim: Sim; collected: number[] } {
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

test("level 1 coin is counted in the same step it is collected", () => {
  let sim = initialSim(anteroom)
  let picked = false
  for (let i = 0; i < 80 && !picked; i++) {
    const before = collectedCount(sim.coins)
    const result = step(sim, { x: 1, y: 0 }, anteroom, snap.playerSpeed)
    sim = result.sim
    if (result.events.collected.length > 0) {
      picked = true
      assert.deepEqual(result.events.collected, [0])
      assert.equal(collectedCount(sim.coins), before + 1)
      assert.equal(collectedCount(sim.coins), 1)
    }
  }
  assert.equal(picked, true)
  assert.equal(anteroom.coins.length, 1)
  const spawn = cellOf(anteroom.spawn.x, anteroom.spawn.y)
  const coin = cellOf(anteroom.coins[0].x, anteroom.coins[0].y)
  assert.ok(spawn && coin)
  assert.notDeepEqual(spawn, coin)
})

test("death returns uncommitted coins on the respawn step the hud reads", () => {
  let sim = initialSim(anteroom)
  const picked = hold(sim, { x: 1, y: 0 }, 70)
  sim = picked.sim
  assert.equal(collectedCount(sim.coins), 1)
  assert.equal(collectedCount(sim.committed), 0)

  const enemy = positionsAt(anteroom, sim.frame + 1)[0]
  sim = { ...sim, x: enemy.x, y: enemy.y }
  const death = step(sim, { x: 0, y: 0 }, anteroom, snap.playerSpeed)
  sim = death.sim
  assert.equal(death.events.died, true)
  assert.equal(collectedCount(sim.coins), 1)

  let respawned = false
  for (let i = 0; i < RESPAWN_FRAMES + 2 && !respawned; i++) {
    const before = sim.alive
    const result = step(sim, { x: 0, y: 0 }, anteroom, snap.playerSpeed)
    sim = result.sim
    if (!before && sim.alive) {
      respawned = true
      assert.equal(collectedCount(sim.coins), 0)
      assert.equal(sim.cleared, false)
    }
  }
  assert.equal(respawned, true)
})

test("the exit ignores a phantom coin count", () => {
  let endX = 0
  let endY = 0
  for (let row = 0; row < LOCKED.rows; row++) {
    for (let col = 0; col < LOCKED.cols; col++) {
      if (!anteroom.end[row][col]) continue
      endX = (col + 0.5) * LOCKED.tilePx
      endY = (row + 0.5) * LOCKED.tilePx
    }
  }
  const short = step(
    { ...initialSim(anteroom), x: endX, y: endY, coins: [false], committed: [false] },
    { x: 0, y: 0 },
    anteroom,
    snap.playerSpeed,
  )
  assert.equal(short.events.cleared, false)
  assert.equal(short.sim.cleared, false)

  const full = step(
    { ...initialSim(anteroom), x: endX, y: endY, coins: [true], committed: [true] },
    { x: 0, y: 0 },
    anteroom,
    snap.playerSpeed,
  )
  assert.equal(full.events.cleared, true)
  assert.equal(collectedCount(full.sim.coins), anteroom.coins.length)
})

test("movement is 120px per simulated second on open ground", () => {
  const sim = hold(initialSim(anteroom), { x: 1, y: 0 }, 60).sim
  assert.equal(snap.playerSpeed, 120)
  assert.equal(sim.x - anteroom.spawn.x, 120)
  assert.equal(sim.y, anteroom.spawn.y)
})

test("a slower enemy scale moves the blue shapes less", () => {
  const full = positionsAt(anteroom, 40, 1)[0]
  const slow = positionsAt(anteroom, 40, 0.55)[0]
  assert.ok(full && slow)
  const start = anteroom.enemies[0]
  assert.ok(start)
  const fullTravel = Math.hypot(full.x - start.poly.pts[0].x, full.y - start.poly.pts[0].y)
  const slowTravel = Math.hypot(slow.x - start.poly.pts[0].x, slow.y - start.poly.pts[0].y)
  assert.ok(slowTravel < fullTravel * 0.7, `${slowTravel} vs ${fullTravel}`)
})

test("a 2px lip in the level 2 corridor does not trap a leftward move", () => {
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
