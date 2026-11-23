export type Mark = "correct" | "present" | "absent"

export type GradedGuess = {
  guess: string
  marks: Mark[]
}

/** Standard repeated-letter marking: greens first, then yellows from what is left. */
export function feedback(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array.from({ length: guess.length }, () => "absent")
  const remaining: Record<string, number> = {}
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) marks[i] = "correct"
    else remaining[answer[i]] = (remaining[answer[i]] ?? 0) + 1
  }
  for (let i = 0; i < guess.length; i++) {
    if (marks[i] === "correct") continue
    const letter = guess[i]
    if ((remaining[letter] ?? 0) > 0) {
      marks[i] = "present"
      remaining[letter] -= 1
    }
  }
  return marks
}

/** Hard mode: greens stay put, and every revealed letter is used at least that many times. */
export function hardModeAllows(guess: string, prior: readonly GradedGuess[]): boolean {
  const fixed: (string | null)[] = Array.from({ length: guess.length }, () => null)
  const needed: Record<string, number> = {}
  for (const row of prior) {
    const seen: Record<string, number> = {}
    row.marks.forEach((mark, index) => {
      if (mark === "correct") fixed[index] = row.guess[index]
      if (mark === "correct" || mark === "present") {
        seen[row.guess[index]] = (seen[row.guess[index]] ?? 0) + 1
      }
    })
    for (const [letter, count] of Object.entries(seen)) {
      needed[letter] = Math.max(needed[letter] ?? 0, count)
    }
  }
  for (let i = 0; i < guess.length; i++) {
    if (fixed[i] && guess[i] !== fixed[i]) return false
  }
  const have: Record<string, number> = {}
  for (const letter of guess) have[letter] = (have[letter] ?? 0) + 1
  return Object.entries(needed).every(([letter, count]) => (have[letter] ?? 0) >= count)
}

export function guessPoints(guessesUsed: number, limit: number): number {
  const left = limit - guessesUsed
  return 10 * (left + 1)
}

export function scoreGain(guessesUsed: number, limit: number, streakAfterWin: number): number {
  return guessPoints(guessesUsed, limit) + 5 * streakAfterWin
}
