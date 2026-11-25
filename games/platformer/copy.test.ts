import assert from "node:assert/strict"
import { test } from "node:test"
import seed from "./seed.json"
import { platformerCopy, describePlatformerDiff } from "./copy"
import { platformer } from "./headless"
import { wordsCopy } from "@/games/words/copy"
import { words } from "@/games/words/headless"
import type { BranchRecord } from "@/lib/shell/game-module"

test("the root speed line is plain words", () => {
  assert.equal(describePlatformerDiff(seed as BranchRecord, null), "you move at normal speed")
})

test("the ask placeholder is per game", () => {
  assert.equal(platformerCopy.askPlaceholder, "ask for a twist, e.g. make the blue shapes slower")
  assert.equal(wordsCopy.askPlaceholder, "ask for a twist, e.g. give me 8 guesses")
  assert.equal(platformer.ask.placeholder, platformerCopy.askPlaceholder)
  assert.equal(words.ask.placeholder, wordsCopy.askPlaceholder)
})
