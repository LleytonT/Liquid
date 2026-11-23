import type { BranchRecord, SolveLevelResult } from "@/lib/shell/game-module"
import { feedback, hardModeAllows } from "@/games/words/rules"
import { answersOf, bandForRound, prepareWords } from "@/games/words/validate"

function checkFeedback(): string | null {
  const apple = feedback("apple", "apple")
  if (apple.some((mark) => mark !== "correct")) return "an exact guess is not all correct"
  const mixed = feedback("ababa", "aback")
  const expected = ["correct", "correct", "correct", "absent", "absent"]
  if (mixed.join() !== expected.join()) return `repeated letters marked ${mixed.join(",")}`
  return null
}

export function solveWords(branch: BranchRecord): SolveLevelResult[] {
  const snapshot = prepareWords(branch)
  const valid = new Set(snapshot.lists.valid)
  const answers = answersOf(snapshot)
  const missing: string[] = []
  const wrongLength: string[] = []
  for (const word of answers) {
    if (!valid.has(word)) missing.push(word)
    if (word.length !== snapshot.length) wrongLength.push(word)
  }
  const rule = checkFeedback()
  const notes = [
    `${answers.length} answers`,
    `valid ${snapshot.lists.valid.length}`,
    `length ${snapshot.length}`,
    `guesses ${snapshot.guesses}`,
    `hard mode ${snapshot.hardMode ? "on" : "off"}`,
    `timer ${snapshot.timerSeconds === 0 ? "off" : snapshot.timerSeconds + "s"}`,
    `round 1 band ${bandForRound(0)}`,
  ]
  const problems: string[] = []
  if (missing.length) problems.push(`${missing.length} answers missing from the valid list`)
  if (wrongLength.length) problems.push(`${wrongLength.length} answers have the wrong length`)
  if (snapshot.lists.bands.common.length === 0) problems.push("round 1 has no common words")
  if (snapshot.guesses < 1) problems.push("no guesses left, every round is unwinnable")
  if (rule) problems.push(rule)
  let unwinnable = 0
  for (const word of answers) {
    const marks = feedback(word, word)
    const canOpen = !snapshot.hardMode || hardModeAllows(word, [])
    if (!canOpen || marks.some((mark) => mark !== "correct") || snapshot.guesses < 1) unwinnable += 1
  }
  if (unwinnable) problems.push(`${unwinnable} unwinnable rounds`)
  notes.push(`unwinnable ${unwinnable}`)
  return [
    {
      levelId: "rounds",
      ok: problems.length === 0,
      pathLength: answers.length,
      notes: problems.length ? [...notes, ...problems] : notes,
    },
  ]
}
