import assert from "node:assert/strict"
import { test } from "node:test"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import seed from "./seed.json"
import { replaySolves } from "./replay-check"
import { validateNewSeed } from "./validate-new"
import { NODE_LIMIT } from "./solve"
import type { LevelDef } from "./runtime"

const dir = dirname(fileURLToPath(import.meta.url))

test("the seed levels are the five new rooms", () => {
  assert.deepEqual(validateNewSeed(), ["corridor", "lanes", "orbit", "spinner", "gauntlet"])
})

test("the lattice node cap stays at one million", () => {
  assert.equal(NODE_LIMIT, 1_000_000)
})

test("the gauntlet coin inside the ring sits one tile toward the centre", () => {
  const levels = (seed as { snapshot: { content: { levels: { id: string; coins: { col: number; row: number }[] }[] } } })
    .snapshot.content.levels
  const gauntlet = levels.find((level) => level.id === "gauntlet")
  assert.ok(gauntlet)
  assert.ok(gauntlet.coins.some((coin) => coin.col === 11 && coin.row === 6))
  assert.equal(
    gauntlet.coins.some((coin) => coin.col === 10 && coin.row === 6),
    false,
  )
})

test("recorded solves clear through step() with a late start", () => {
  const defs = (seed as { snapshot: { content: { levels: LevelDef[] } } }).snapshot.content.levels
  const rows = replaySolves(defs, join(dir, "solves"), [0, 1, 2])
  for (const row of rows) {
    assert.equal(row.ok, true, `${row.id} delay ${row.delay} deaths=${row.deaths} coins=${row.coins}/${row.total} frame=${row.frame}`)
    console.log(
      `${row.id} delay ${row.delay}: cleared=${row.cleared} deaths=${row.deaths} coins=${row.coins}/${row.total} frame=${row.frame} ok`,
    )
  }
})
