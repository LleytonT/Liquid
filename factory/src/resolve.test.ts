import assert from "node:assert/strict"
import { test } from "node:test"
import { createBranch } from "./branch"
import { ancestorChain, resolveLineage } from "./resolve"
import { createMemoryStore } from "./store"
import { readValues, testAdapter } from "./test-fixture"

const owner = { id: "anon_test_1234" }

function node(id: string, parentId: string, patch: Record<string, number>, createdAt: string) {
  return createBranch({
    id,
    parentId,
    gameId: "platformer",
    ask: id,
    kind: "tweak",
    patch,
    plan: id,
    owner,
    createdAt,
    status: "playable",
    traceId: id.replace("br_", "tr_"),
  })
}

test("a branch resolves from the seed, root first, and a parent fix flows down", async () => {
  let hot = 0
  let writes = 0
  const adapter = testAdapter({
    hot: () => {
      hot += 1
    },
    write: () => {
      writes += 1
    },
  })
  const parent = node("br_aaaaaaaaaaaa", "seed", { speed: 100 }, "2026-01-01T00:00:00.000Z")
  const child = node("br_bbbbbbbbbbbb", parent.id, { scale: 0.55 }, "2026-01-01T00:00:01.000Z")
  const store = createMemoryStore()
  await store.putBranch(parent)
  await store.putBranch(child)
  const chain = await ancestorChain(store, child)
  assert.deepEqual(
    chain.map((item) => item.id),
    [parent.id],
  )

  const view = resolveLineage(adapter, child, chain)
  assert.equal(view.id, child.id)
  assert.equal(readValues(view).speed, 100)
  assert.equal(readValues(view).scale, 0.55)
  assert.equal(hot, 0)
  assert.equal(writes, 2)

  const fixed = { ...parent, patch: { speed: 140 } }
  const again = resolveLineage(adapter, child, [fixed])
  assert.equal(readValues(again).speed, 140)
  assert.equal(readValues(again).scale, 0.55)
  assert.equal(hot, 0)

  const override = { ...child, patch: { speed: 110 } }
  const leaf = resolveLineage(adapter, override, [parent])
  assert.equal(readValues(leaf).speed, 110)
})
