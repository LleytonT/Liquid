import assert from "node:assert/strict"
import { test } from "node:test"
import {
  NOT_ENOUGH_LETTERS,
  NOT_IN_WORD_LIST,
  emptyTyping,
  endReveal,
  pressKey,
  revealDurationMs,
  visibleDraft,
  type TypingContext,
  type TypingEvent,
  type TypingState,
} from "./typing"

const WORDS = new Set(["crane", "money", "handy"])

const ctx: TypingContext = {
  length: 5,
  accepts: (word) => (WORDS.has(word) ? null : NOT_IN_WORD_LIST),
}

function eventsFor(words: readonly string[], gapMs: number): { t: number; event: TypingEvent }[] {
  const out: { t: number; event: TypingEvent }[] = []
  let t = 0
  for (const word of words) {
    for (const letter of word) {
      out.push({ t, event: { type: "letter", letter } })
      t += gapMs
    }
    out.push({ t, event: { type: "enter" } })
    t += gapMs
  }
  return out
}

function play(gapMs: number): { rows: string[]; notes: string[] } {
  const revealMs = revealDurationMs(5, 280, 250)
  let state: TypingState = emptyTyping()
  let revealUntil = 0
  const rows: string[] = []
  const notes: string[] = []

  const finishIfDue = (now: number) => {
    let guard = 0
    while (state.phase === "reveal" && now >= revealUntil && guard < 8) {
      guard += 1
      const drained = endReveal(state, ctx)
      state = drained.state
      if (drained.submitted) {
        rows.push(drained.submitted)
        revealUntil += revealMs
      }
    }
  }

  for (const key of eventsFor(["crane", "money", "handy"], gapMs)) {
    finishIfDue(key.t)
    const result = pressKey(state, key.event, ctx)
    state = result.state
    if (state.note) notes.push(state.note)
    if (result.submitted) {
      rows.push(result.submitted)
      revealUntil = key.t + revealMs
    }
  }
  finishIfDue(revealUntil + revealMs * 4)
  return { rows, notes }
}

test("crane, money, handy survive a 0ms burst and a 40ms burst", () => {
  for (const gap of [0, 40]) {
    const { rows } = play(gap)
    assert.deepEqual(rows, ["crane", "money", "handy"], `gap ${gap}ms`)
    assert.ok(rows.every((row) => row.length === 5))
  }
})

test("a short buffered guess is not scored", () => {
  let state = pressKey(emptyTyping(), { type: "letter", letter: "c" }, ctx).state
  for (const letter of "rane") state = pressKey(state, { type: "letter", letter }, ctx).state
  const submitted = pressKey(state, { type: "enter" }, ctx)
  assert.equal(submitted.submitted, "crane")
  state = submitted.state
  for (const key of ["l", "i", "n", "enter"]) {
    const event: TypingEvent = key === "enter" ? { type: "enter" } : { type: "letter", letter: key }
    state = pressKey(state, event, ctx).state
  }
  assert.equal(visibleDraft(state, 5), "lin")
  const drained = endReveal(state, ctx)
  assert.equal(drained.submitted, null)
  assert.equal(drained.state.note, NOT_ENOUGH_LETTERS)
  assert.equal(drained.state.draft, "lin")
})

test("an unknown word is refused with the word-list copy", () => {
  let state = emptyTyping()
  for (const letter of "zzzzz") state = pressKey(state, { type: "letter", letter }, ctx).state
  const result = pressKey(state, { type: "enter" }, ctx)
  assert.equal(result.submitted, null)
  assert.equal(result.state.note, NOT_IN_WORD_LIST)
  assert.equal(result.state.phase, "play")
})
