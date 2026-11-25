import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { createBranch, type Branch } from "./branch"
import { createFileStore, createMemoryStore, selectStore, type BranchStore } from "./store"
import type { Trace } from "./trace"

function branch(id: string, gameId = "platformer"): Branch {
  return createBranch({
    id,
    parentId: "seed",
    gameId,
    ask: "slower",
    kind: "tweak",
    patch: { speed: 100 },
    plan: "slower",
    owner: { id: "anon_test_1234" },
    createdAt: `2026-01-01T00:00:0${id.endsWith("a") ? "1" : "2"}.000Z`,
    status: "draft",
    traceId: id.replace("br_", "tr_"),
  })
}

function trace(id: string): Trace {
  return {
    id,
    branchId: id.replace("tr_", "br_"),
    gameId: "platformer",
    ask: "slower",
    route: "tweak",
    confidence: 0.93,
    plan: { summary: "slower", source: "fallback" },
    diff: { speed: 100 },
    checks: [],
    evidence: null,
    verdict: null,
    decision: "pending",
    createdAt: "2026-01-01T00:00:01.000Z",
  }
}

async function contract(store: BranchStore) {
  assert.equal(await store.getBranch("br_000000000000"), null)
  const first = branch("br_aaaaaaaaaaaa")
  await store.putBranch(first)
  assert.deepEqual((await store.getBranch(first.id))?.patch, { speed: 100 })
  await store.putBranch({ ...first, plan: "next", snapshot: { levels: [1] } } as Branch)
  const stripped = await store.getBranch(first.id)
  assert.equal(stripped?.plan, "next")
  assert.equal(stripped ? "snapshot" in stripped : false, false)
  await store.putBranch(branch("br_bbbbbbbbbbbb", "words"))
  const platformer = await store.listBranches("platformer")
  assert.ok(platformer.every((item) => item.gameId === "platformer"))
  assert.equal(platformer.length, 1)

  const row = trace("tr_aaaaaaaaaaaa")
  await store.putTrace({ ...row, evidence: { note: "later", n: 1 } })
  assert.deepEqual((await store.getTrace(row.id))?.evidence, { note: "later", n: 1 })
  assert.deepEqual((await store.getTrace(row.id))?.checks, [])
  await store.save(first, { ...row, verdict: "playable", evidence: { note: "later", n: 1 } })
  assert.equal((await store.getTrace(row.id))?.verdict, "playable")
  assert.equal((await store.getBranch(first.id))?.plan, "slower")
}

test("store contract against the file adapter", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "liquid-branches-"))
  try {
    await contract(createFileStore(path.join(dir, "branches.json")))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("store contract against the memory adapter", async () => {
  await contract(createMemoryStore())
})

test("missing upstash env in production falls back and logs", () => {
  const errors: string[] = []
  const original = console.error
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(" "))
  }
  try {
    const selected = selectStore({ VERCEL: "1", VERCEL_ENV: "production", NODE_ENV: "production" })
    assert.equal(selected.kind, "file")
    assert.equal(selected.durable, false)
    assert.match(selected.warning ?? "", /UPSTASH_REDIS_REST_URL/)
    assert.match(selected.warning ?? "", /UPSTASH_REDIS_REST_TOKEN/)
    assert.match(errors.join("\n"), /UPSTASH_REDIS_REST_URL/)
  } finally {
    console.error = original
  }
})
