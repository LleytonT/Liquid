import assert from "node:assert/strict"
import { test } from "node:test"
import { testAdapter } from "./test-fixture"
import { CLARIFY_BELOW, CLARIFY_QUESTION, routeAsk, sanitizePatch, type ModelComplete } from "./router"

const offline: ModelComplete = async () => {
  throw new Error("offline")
}

const FIXED_ASKS = [
  { ask: "make the blue shapes slower", route: "tweak" },
  { ask: "make the blue dots faster", route: "tweak" },
  { ask: "make the square slower", route: "tweak" },
  { ask: "give me 8 guesses", route: "tweak" },
  { ask: "fewer guesses", route: "tweak" },
  { ask: "no timer", route: "tweak" },
  { ask: "add a safe zone", route: "content" },
  { ask: "widen this gap", route: "content" },
  { ask: "add a level after this", route: "content" },
  { ask: "add a level with a higher jump", route: "content" },
  { ask: "add a double jump mechanic", route: "branch" },
  { ask: "add a dash mechanic", route: "branch" },
  { ask: "make it better", route: "clarify" },
  { ask: "change something", route: "clarify" },
  { ask: "hello", route: "clarify" },
] as const

test("router classification on a fixed ask set", async () => {
  const adapter = testAdapter()
  for (const item of FIXED_ASKS) {
    const result = await routeAsk(adapter, item.ask, offline)
    assert.equal(result.route, item.route, item.ask)
    if (item.route === "clarify") {
      assert.ok(result.confidence < CLARIFY_BELOW, item.ask)
      assert.equal(result.plan.question, CLARIFY_QUESTION)
      assert.equal(result.plan.question?.match(/\?/g)?.length, 1)
    } else {
      assert.ok(result.confidence >= CLARIFY_BELOW, item.ask)
      assert.equal(result.plan.question, undefined)
    }
    if (item.route === "content" || item.route === "branch") {
      assert.match(result.plan.summary, /isn't built yet|aren't live yet|isn't live|isn't a change|live yet/)
      assert.equal(result.plan.patch, undefined)
    }
  }
})

test("a live model is not overridden by the word matcher", async () => {
  const adapter = testAdapter()
  const content = await routeAsk(adapter, "make the blue shapes slower", async () => ({
    kind: "content",
    reason: "new rooms are not live",
  }))
  assert.equal(content.route, "content")
  assert.equal(content.plan.source, "gateway")
  assert.equal(content.plan.patch, undefined)
  assert.match(content.plan.summary, /not live/)

  const refused = await routeAsk(adapter, "make the blue shapes slower", async () => ({
    kind: "tweak",
    patch: { gravity: 9 },
  }))
  assert.equal(refused.route, "clarify")
  assert.equal(refused.plan.source, "gateway")
  assert.equal(refused.plan.patch, undefined)
  assert.match(refused.plan.summary, /none of those numbers are on this game/)
})

test("a model tweak is clamped and a dead gateway falls back", async () => {
  const adapter = testAdapter()
  const accepted = await routeAsk(adapter, "change the scale", async () => ({
    kind: "tweak",
    patch: { scale: 0.1, madeUp: 4 },
  }))
  assert.equal(accepted.route, "tweak")
  assert.equal(accepted.plan.source, "gateway")
  assert.equal(accepted.plan.patch?.scale, 0.45)
  assert.equal(accepted.plan.patch?.madeUp, undefined)
  assert.ok(accepted.confidence >= CLARIFY_BELOW)

  const planned = await routeAsk(adapter, "give me 8 guesses", offline)
  assert.equal(planned.plan.source, "fallback")
  assert.equal(planned.plan.patch?.guesses, 8)
  assert.equal(sanitizePatch(adapter, { gravity: 2, speed: 90 })?.speed, 100)
  assert.equal(sanitizePatch(adapter, { gravity: 2 }) , null)
})
