import assert from "node:assert/strict"
import { test } from "node:test"
import { formatWinLine, scoreGain } from "./rules"

test("the win line shows the same bonuses the hud adds", () => {
  assert.equal(formatWinLine(5, 6, 1), "5/6 · +20 +5 streak")
  assert.equal(scoreGain(5, 6, 1), 25)
})
