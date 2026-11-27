import assert from "node:assert/strict"
import { test } from "node:test"
import { debugMode } from "./debug"

test("the speed readout is behind the debug flag", () => {
  assert.equal(debugMode("?debug=1"), true)
  assert.equal(debugMode("debug=1"), true)
  assert.equal(debugMode(""), false)
  assert.equal(debugMode("?debug=0"), false)
})
