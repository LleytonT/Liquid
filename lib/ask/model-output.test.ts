import assert from "node:assert/strict"
import { test } from "node:test"
import outputs from "./model-outputs.json"
import { parseModelOutput, strictModelSchema } from "./plan"
import { acceptModelPlan } from "./tweak"

const recorded = outputs as Record<string, { kind: string; patch: Record<string, unknown> | null }>

test("recorded tweak payloads fail the prod number schema", () => {
  for (const [phrase, output] of Object.entries(recorded)) {
    const parsed = strictModelSchema.safeParse(output)
    assert.equal(parsed.success, false, phrase)
  }
})

test("recorded tweak payloads validate and keep the magnitude", () => {
  const slower = parseModelOutput(recorded["make the blue shapes slower"])
  const slowPlan = acceptModelPlan("platformer", "make the blue shapes slower", {
    kind: slower.kind,
    patch: slower.patch,
  })
  assert.equal(slowPlan.source, "gateway")
  assert.equal(slowPlan.patch?.enemySpeedScale, 0.55)
  assert.equal(slowPlan.line, "blue shapes move 0.55x as fast")

  const twice = parseModelOutput(recorded["make the blue dots twice as fast"])
  const twicePlan = acceptModelPlan("platformer", "make the blue dots twice as fast", {
    kind: twice.kind,
    patch: twice.patch,
  })
  assert.equal(twicePlan.source, "gateway")
  assert.equal(twicePlan.patch?.enemySpeedScale, 2)
  assert.equal(twicePlan.line, "blue shapes move 2x faster")

  const eight = parseModelOutput(recorded["give me 8 guesses"])
  const eightPlan = acceptModelPlan("words", "give me 8 guesses", { kind: eight.kind, patch: eight.patch })
  assert.equal(eightPlan.source, "gateway")
  assert.equal(eightPlan.patch?.guesses, 8)
  assert.equal(eightPlan.line, "8 guesses")

  const more = parseModelOutput(recorded["give me more guesses"])
  const morePlan = acceptModelPlan(
    "words",
    "give me more guesses",
    { kind: more.kind, patch: more.patch },
    { guesses: 6 },
  )
  assert.equal(morePlan.source, "gateway")
  assert.equal(morePlan.patch, undefined)
  assert.match(morePlan.line, /already 6/)
})
