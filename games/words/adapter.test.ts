import assert from "node:assert/strict"
import { test } from "node:test"
import { wordsAdapter } from "./adapter"
import lists from "./lists.json"

test("words adapter applies a patch live and can play a scripted guess", () => {
  assert.equal(wordsAdapter.contractVersion, 1)
  const seed = wordsAdapter.load("words")
  assert.ok(seed)
  const live = wordsAdapter.hotApply(seed, { guesses: 8 })
  assert.equal(live.when, "live")
  assert.equal(wordsAdapter.read(live.data).tunables.guesses, 8)
  assert.equal(wordsAdapter.read(seed).tunables.guesses, 6)
  const respawn = wordsAdapter.write(seed, { guesses: 8 })
  assert.equal(wordsAdapter.read(respawn).tunables.guesses, 8)
  assert.ok(wordsAdapter.listInvariants().some((item) => item.summary.includes("answer list")))
  assert.equal(wordsAdapter.screenshot?.(seed).supported, false)
  assert.equal(typeof wordsAdapter.solve, "function")
  const answer = lists.bands.common[0]
  assert.ok(answer)
  const solved = wordsAdapter.runHeadless(seed, { mode: "script", steps: [{ input: answer }] })
  assert.equal(solved.done, true)
  assert.match(solved.summary, new RegExp(answer))
})
