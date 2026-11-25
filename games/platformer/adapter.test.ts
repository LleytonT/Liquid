import assert from "node:assert/strict"
import { test } from "node:test"
import { platformerAdapter } from "./adapter"

test("platformer adapter applies a patch live and on the next respawn", () => {
  assert.equal(platformerAdapter.contractVersion, 1)
  const seed = platformerAdapter.load("seed")
  assert.ok(seed)
  const live = platformerAdapter.hotApply(seed, { enemySpeedScale: 0.55 })
  assert.equal(live.when, "live")
  assert.equal(platformerAdapter.read(live.data).tunables.enemySpeedScale, 0.55)
  assert.equal(platformerAdapter.read(seed).tunables.enemySpeedScale, undefined)
  const reloaded = platformerAdapter.load("seed")
  assert.ok(reloaded)
  assert.equal(platformerAdapter.read(reloaded).tunables.enemySpeedScale, undefined)
  const respawn = platformerAdapter.write(seed, { enemySpeedScale: 0.55 })
  assert.equal(platformerAdapter.read(respawn).tunables.enemySpeedScale, 0.55)
  assert.ok(platformerAdapter.listInvariants().some((item) => item.summary.includes("finishable")))
  assert.equal(platformerAdapter.screenshot?.(seed).supported, false)
  assert.equal(typeof platformerAdapter.solve, "function")
  const report = platformerAdapter.runHeadless(seed, { mode: "ticks", ticks: 3 })
  assert.equal(report.ticks, 3)
  assert.equal(typeof report.summary, "string")
})
