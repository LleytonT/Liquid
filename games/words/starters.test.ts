import assert from "node:assert/strict"
import { test } from "node:test"
import { describeWordsDiff } from "./copy"
import { solveWords } from "./solve"
import { wordsBranches } from "./starters"
import { prepareWords } from "./validate"

test("starter branches are asks on the words root and stay winnable", () => {
  const [root, hard, eight, timed] = wordsBranches
  assert.equal(root.parentId, null)
  assert.equal(hard.parentId, root.id)
  assert.equal(eight.parentId, root.id)
  assert.equal(timed.parentId, root.id)

  assert.equal(describeWordsDiff(root, null), "six guesses, no time limit")
  assert.equal(describeWordsDiff(hard, root), "hard mode is on")
  assert.equal(describeWordsDiff(eight, root), "eight guesses")
  assert.equal(describeWordsDiff(timed, root), "a 60 second timer")

  for (const branch of wordsBranches) {
    const snapshot = prepareWords(branch)
    const [result] = solveWords(branch)
    assert.equal(result.ok, true, branch.id)
    assert.match(result.notes.join(" "), /unwinnable 0/)
    if (branch.id === "words-timed") assert.equal(snapshot.timerSeconds, 60)
    if (branch.id === "words-hard") assert.equal(snapshot.hardMode, true)
    if (branch.id === "words-eight") assert.equal(snapshot.guesses, 8)
  }
})
