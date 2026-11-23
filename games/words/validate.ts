import { assertBranchShape } from "@/lib/shell/branch"
import type { BranchRecord, Knob } from "@/lib/shell/game-module"
import lists from "@/games/words/lists.json"

export type WordLists = {
  bands: {
    common: string[]
    familiar: string[]
    wider: string[]
  }
  valid: string[]
}

export type WordsSnapshot = {
  id: string
  guesses: number
  length: number
  hardMode: boolean
  timerSeconds: number
  tileFlipMs: number
  staggerMs: number
  shakePx: number
  shakeMs: number
  roundEndMs: number
  askChips: number
  lists: WordLists
}

const LOCKED: Record<string, number> = {
  length: 5,
  tileFlipMs: 250,
  shakePx: 6,
  shakeMs: 300,
  askChips: 3,
}

function fail(message: string): never {
  throw new Error(message)
}

function knob(tunables: Record<string, Knob>, name: string): number {
  const item = tunables[name]
  if (!item) fail(`words tunable ${name} is missing`)
  if (name in LOCKED) {
    const expected = LOCKED[name]
    if (!item.locked || item.value !== expected || item.min !== expected || item.max !== expected) {
      fail(`${name} is locked at ${expected}`)
    }
  }
  if (item.value < item.min || item.value > item.max) fail(`${name} is outside its range`)
  return item.value
}

export function prepareWords(branch: BranchRecord): WordsSnapshot {
  assertBranchShape(branch)
  if (branch.gameId !== "words") fail(`${branch.id} is not a words branch`)
  const bible = branch.snapshot.bible.lockedCore
  const rules = bible.rules
  if (!Array.isArray(rules)) fail("words bible rules are missing")
  for (const rule of [
    "one secret word per round",
    "answers come from the answer list",
    "three states stay distinct by fill, ring, and sunken shape",
  ]) {
    if (!rules.includes(rule)) fail(`words bible is missing "${rule}"`)
  }
  const states = bible.states as Record<string, Record<string, string>> | undefined
  if (states?.correct?.fill !== "#2B59C3") fail("correct fill is locked at #2B59C3")
  if (states?.present?.ring !== "#F2A541") fail("present ring is locked at #F2A541")
  if (states?.absent?.letter !== "#B9B1A3") fail("absent letter is locked at #B9B1A3")

  const tunables = branch.snapshot.tunables
  const guesses = knob(tunables, "guesses")
  if (tunables.guesses.min !== 3 || tunables.guesses.max !== 10) fail("guesses stay between 3 and 10")
  const timerSeconds = knob(tunables, "timerSeconds")
  if (timerSeconds !== 0 && timerSeconds < 30) fail("a timer is at least 30s")
  const hard = knob(tunables, "hardMode")
  if (hard !== 0 && hard !== 1) fail("hard mode is on or off")

  const wordLists = lists as WordLists
  if (wordLists.bands.common.length === 0) fail("the common band is empty")

  return {
    id: branch.snapshot.id,
    guesses,
    length: knob(tunables, "length"),
    hardMode: hard === 1,
    timerSeconds,
    tileFlipMs: knob(tunables, "tileFlipMs"),
    staggerMs: knob(tunables, "staggerMs"),
    shakePx: knob(tunables, "shakePx"),
    shakeMs: knob(tunables, "shakeMs"),
    roundEndMs: knob(tunables, "roundEndMs"),
    askChips: knob(tunables, "askChips"),
    lists: wordLists,
  }
}

export function answersOf(snapshot: WordsSnapshot): string[] {
  return [
    ...snapshot.lists.bands.common,
    ...snapshot.lists.bands.familiar,
    ...snapshot.lists.bands.wider,
  ]
}

/** Round 0 is always the common band. Later rounds walk the three bands. */
export function bandForRound(round: number): "common" | "familiar" | "wider" {
  if (round <= 0) return "common"
  return (["familiar", "wider", "common"] as const)[(round - 1) % 3]
}

export function pickAnswer(snapshot: WordsSnapshot, round: number, used: ReadonlySet<string>, roll: number): string {
  const band = snapshot.lists.bands[bandForRound(round)]
  const open = band.filter((word) => !used.has(word))
  const pool = open.length > 0 ? open : band
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(roll * pool.length)))
  return pool[index]
}
