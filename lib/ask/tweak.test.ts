import assert from "node:assert/strict"
import { test } from "node:test"
import { PLATFORMER_TWEAK_CHIPS } from "@/games/platformer/copy"
import { WORDS_TWEAK_CHIPS } from "@/games/words/copy"
import { planAsk } from "./plan"
import { acceptModelPlan, fallbackPlan, sanitizePatch } from "./tweak"

test("blue shapes slower is a real enemy tweak", () => {
  const plan = fallbackPlan("platformer", "make the blue shapes slower")
  assert.equal(plan.kind, "tweak")
  assert.equal(plan.source, "fallback")
  assert.equal(plan.line, "blue shapes move 0.55x as fast")
  assert.ok(plan.patch && plan.patch.enemySpeedScale < 1)
})

test("eight guesses is a words tweak", () => {
  const plan = fallbackPlan("words", "give me 8 guesses")
  assert.equal(plan.kind, "tweak")
  assert.equal(plan.patch?.guesses, 8)
  assert.equal(plan.line, "8 guesses")
})

test("the chips on the pause overlay are tweaks", () => {
  for (const chip of PLATFORMER_TWEAK_CHIPS) {
    const plan = fallbackPlan("platformer", chip)
    assert.equal(plan.kind, "tweak", chip)
    assert.ok(plan.patch)
  }
  for (const chip of WORDS_TWEAK_CHIPS) {
    const plan = fallbackPlan("words", chip)
    assert.equal(plan.kind, "tweak", chip)
    assert.ok(plan.patch)
  }
  for (const chip of ["add a safe zone", "widen this gap", "add a level after this"]) {
    const plan = fallbackPlan("platformer", chip)
    assert.equal(plan.kind, "content", chip)
    assert.match(plan.line, /live yet/)
  }
})

test("unknown keys are dropped and a content ask is not a success", () => {
  assert.equal(sanitizePatch("platformer", { gravity: 2, enemySpeedScale: 0.5 })?.gravity, undefined)
  assert.equal(sanitizePatch("platformer", { gravity: 2, enemySpeedScale: 0.5 })?.enemySpeedScale, 0.5)
  assert.equal(sanitizePatch("platformer", { jumpHeight: 40 }), null)
  const content = fallbackPlan("platformer", "add a level with a higher jump")
  assert.equal(content.kind, "content")
  assert.match(content.line, /jumping higher/)
  assert.equal(content.patch, undefined)
  assert.match(fallbackPlan("platformer", "add multiplayer").line, /multiplayer/)
  assert.match(fallbackPlan("words", "make it rain").line, /weather and art/)
  assert.match(fallbackPlan("platformer", "an easier level").line, /easier levels/)
})

test("a model tweak is clamped and relabeled from the patch", async () => {
  const accepted = acceptModelPlan("platformer", "tiny dots", {
    kind: "tweak",
    patch: { enemySpeedScale: 0.1, madeUp: 4 },
  })
  assert.equal(accepted.kind, "tweak")
  assert.equal(accepted.patch?.enemySpeedScale, 0.45)
  assert.equal(accepted.patch?.madeUp, undefined)
  assert.equal(accepted.line, "blue shapes move 0.45x as fast. 0.1x is past the limit")
  assert.equal(accepted.source, "gateway")

  const twice = acceptModelPlan("platformer", "twice as fast", {
    kind: "tweak",
    patch: { enemySpeedScale: 2 },
  })
  assert.equal(twice.source, "gateway")
  assert.equal(twice.patch?.enemySpeedScale, 2)
  assert.equal(twice.line, "blue shapes move 2x faster")

  const same = acceptModelPlan("words", "give me more guesses", { kind: "tweak", patch: { guesses: 6 } }, { guesses: 6 })
  assert.equal(same.kind, "content")
  assert.equal(same.patch, undefined)
  assert.equal(same.source, "gateway")
  assert.match(same.line, /already 6/)

  const planned = await planAsk("words", "give me 8 guesses", undefined, async () => {
    throw new Error("gateway down")
  })
  assert.equal(planned.source, "fallback")
  assert.equal(planned.patch?.guesses, 8)
})
