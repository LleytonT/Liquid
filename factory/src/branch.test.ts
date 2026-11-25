import assert from "node:assert/strict"
import { test } from "node:test"
import { decideBranch, openAsk } from "./ask"
import { BRANCH_FIELDS } from "./branch"
import { ROOT_OWNER, anonOwnerSource } from "./owner"
import { createMemoryStore } from "./store"
import { testAdapter } from "./test-fixture"
import type { ModelComplete } from "./router"

const offline: ModelComplete = async () => {
  throw new Error("offline")
}

const owner = { id: "anon_test_1234" }

async function ask(text: string, ids: { branchId: string; traceId: string }) {
  return openAsk({
    adapter: testAdapter(),
    store: createMemoryStore(),
    owner,
    parentId: "seed",
    ask: text,
    now: new Date("2026-01-02T00:00:00.000Z"),
    ids,
    complete: offline,
  })
}

test("root owner is lleyton and a player branch keeps the id it was given", async () => {
  assert.equal(ROOT_OWNER.id, "lleyton")
  assert.equal(anonOwnerSource.identify({ anonId: "anon_abc12345" }).id, "anon_abc12345")
  assert.equal(anonOwnerSource.identify({ anonId: "x" }).id, "anon")
  const opened = await ask("make the blue shapes slower", { branchId: "br_aaaaaaaaaaaa", traceId: "tr_aaaaaaaaaaaa" })
  assert.equal(opened.branch?.authorId, owner.id)
  assert.notEqual(opened.branch?.authorId, ROOT_OWNER.id)
})

test("a tweak, a content ask, and a mechanic each create a personal branch", async () => {
  const tweak = await ask("make the blue shapes slower", { branchId: "br_aaaaaaaaaaaa", traceId: "tr_aaaaaaaaaaaa" })
  assert.equal(tweak.route.route, "tweak")
  assert.equal(tweak.branch?.status, "draft")
  assert.equal(tweak.branch?.visibility, "personal")
  assert.deepEqual(tweak.branch?.patch, { enemySpeedScale: 0.55 })
  assert.equal(tweak.branch?.traceId, tweak.trace.id)
  assert.deepEqual(tweak.trace.checks, [])
  assert.equal(tweak.trace.evidence, null)
  assert.equal(tweak.trace.decision, "pending")
  assert.deepEqual(Object.keys(tweak.branch ?? {}).sort(), [...BRANCH_FIELDS].sort())
  assert.equal("snapshot" in (tweak.branch ?? {}), false)

  const accepted = await decideBranch(
    await storeWith(tweak),
    tweak.branch!.id,
    "accept",
  )
  assert.equal(accepted.branch.status, "playable")
  assert.equal(accepted.branch.visibility, "personal")
  assert.equal(accepted.trace.decision, "accept")
  assert.equal(accepted.trace.verdict, "playable")
  assert.equal(accepted.trace.evidence, null)

  const content = await ask("add a level after this", { branchId: "br_bbbbbbbbbbbb", traceId: "tr_bbbbbbbbbbbb" })
  assert.equal(content.branch?.kind, "content")
  assert.equal(content.branch?.patch, null)
  assert.match(content.branch?.plan ?? "", /isn't built yet|aren't live yet/)
  const contentAccepted = await decideBranch(await storeWith(content), content.branch!.id, "accept")
  assert.equal(contentAccepted.branch.status, "draft")
  assert.equal(contentAccepted.trace.verdict, "not built")

  const mechanic = await ask("add a dash mechanic", { branchId: "br_cccccccccccc", traceId: "tr_cccccccccccc" })
  assert.equal(mechanic.branch?.kind, "branch")
  assert.equal(mechanic.branch?.status, "draft")
  assert.equal(mechanic.branch?.patch, null)
  const rejected = await decideBranch(await storeWith(mechanic), mechanic.branch!.id, "reject")
  assert.equal(rejected.branch.status, "rejected")
  assert.equal(rejected.trace.decision, "reject")
})

test("a vague ask stores a trace and does not create a branch", async () => {
  const opened = await ask("make it better", { branchId: "br_dddddddddddd", traceId: "tr_dddddddddddd" })
  assert.equal(opened.route.route, "clarify")
  assert.equal(opened.branch, null)
  assert.equal(opened.trace.branchId, null)
  assert.equal(opened.trace.evidence, null)
  assert.deepEqual(opened.trace.checks, [])
})

async function storeWith(opened: Awaited<ReturnType<typeof ask>>) {
  const store = createMemoryStore()
  await store.save(opened.branch, opened.trace)
  return store
}
