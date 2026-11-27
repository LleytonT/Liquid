import assert from "node:assert/strict"
import { test } from "node:test"
import { textFieldHasFocus } from "./pause-key"

test("p is a letter in the guess field or any text field", () => {
  assert.equal(textFieldHasFocus({ tagName: "INPUT" }), true)
  assert.equal(textFieldHasFocus({ tagName: "TEXTAREA" }), true)
  assert.equal(textFieldHasFocus({ tagName: "DIV", isContentEditable: true, closest: () => null }), true)
  assert.equal(
    textFieldHasFocus({ tagName: "DIV", closest: (selector: string) => (selector === "[data-guess-input]" ? {} : null) }),
    true,
  )
  assert.equal(textFieldHasFocus({ tagName: "BUTTON", closest: () => null }), false)
  assert.equal(textFieldHasFocus(null), false)
})
