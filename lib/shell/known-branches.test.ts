import assert from "node:assert/strict"
import { test } from "node:test"
import { catalog } from "@/games/catalog"
import { KNOWN_BRANCH_IDS } from "./known-branches"

test("the proxy list matches every branch on the shelf", () => {
  const ids = catalog.flatMap((game) => game.seed.branches.map((branch) => branch.id)).sort()
  assert.deepEqual([...KNOWN_BRANCH_IDS].sort(), ids)
})
