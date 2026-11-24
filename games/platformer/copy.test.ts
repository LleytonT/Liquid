import assert from "node:assert/strict"
import { test } from "node:test"
import seed from "./seed.json"
import { describePlatformerDiff } from "./copy"
import type { BranchRecord } from "@/lib/shell/game-module"

test("the root speed line is plain words", () => {
  assert.equal(describePlatformerDiff(seed as BranchRecord, null), "you move at normal speed")
})
