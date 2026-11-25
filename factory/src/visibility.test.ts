import assert from "node:assert/strict"
import { test } from "node:test"
import { createBranch } from "./branch"
import { notLiveVisibilityHook, requestVisibility, type VisibilityHook } from "./visibility"

function sample() {
  return createBranch({
    id: "br_aaaaaaaaaaaa",
    parentId: "seed",
    gameId: "platformer",
    ask: "slower",
    kind: "tweak",
    patch: { speed: 100 },
    plan: "slower",
    owner: { id: "anon_test_1234" },
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "playable",
    traceId: "tr_aaaaaaaaaaaa",
  })
}

test("personal visibility skips the hook and share calls it", async () => {
  let calls = 0
  const hook: VisibilityHook = {
    async review(input) {
      calls += 1
      assert.equal(input.visibility, "shared")
      return { evidence: { checked: true } }
    },
  }
  const personal = await requestVisibility(sample(), "personal", hook)
  assert.equal(calls, 0)
  assert.equal(personal.branch.visibility, "personal")
  assert.equal(personal.evidence, null)

  const shared = await requestVisibility(sample(), "shared", hook)
  assert.equal(calls, 1)
  assert.equal(shared.branch.visibility, "shared")
  assert.deepEqual(shared.evidence, { checked: true })

  await assert.rejects(() => requestVisibility(sample(), "proposed", notLiveVisibilityHook), /not live/)
})
