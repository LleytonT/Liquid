import assert from "node:assert/strict"
import { test } from "node:test"
import seed from "./seed.json"
import { ASK_HINT } from "@/lib/shell/ask-hint"
import { platformerCopy, describePlatformerDiff } from "./copy"
import { platformer } from "./headless"
import { wordsCopy } from "@/games/words/copy"
import { words } from "@/games/words/headless"
import type { BranchRecord } from "@/lib/shell/game-module"

test("how to play says where asking lives", () => {
  const platformerLine = platformerCopy.howTo(seed as BranchRecord).map((step) => step.copy).join(" ")
  const wordsLine = wordsCopy.howTo(words.seed.branches[0]!).map((step) => step.copy).join(" ")
  assert.match(platformerLine, new RegExp(ASK_HINT.replace(/[()]/g, "\\$&")))
  assert.match(wordsLine, new RegExp(ASK_HINT.replace(/[()]/g, "\\$&")))
})

test("the root speed line is plain words", () => {
  assert.equal(describePlatformerDiff(seed as BranchRecord, null), "you move at normal speed")
})

test("the ask placeholder is per game", () => {
  assert.equal(platformerCopy.askPlaceholder, "ask for a twist, e.g. make the blue shapes slower")
  assert.equal(wordsCopy.askPlaceholder, "ask for a twist, e.g. give me 8 guesses")
  assert.equal(platformer.ask.placeholder, platformerCopy.askPlaceholder)
  assert.equal(words.ask.placeholder, wordsCopy.askPlaceholder)
})
