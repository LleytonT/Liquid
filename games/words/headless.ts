import type { BranchRecord, GameHeadless } from "@/lib/shell/game-module"
import seed from "@/games/words/seed.json"
import { solveWords } from "@/games/words/solve"
import { prepareWords } from "@/games/words/validate"

const branch = seed as BranchRecord
const CHIPS = ["turn on hard mode", "fewer guesses", "rarer words"] as const

export const words: GameHeadless = {
  id: "words",
  title: "liquid words",
  summary: "five letters. six guesses. the streak is the score.",
  rootBranchId: branch.id,
  themeClass: "theme-words",
  theme: {
    background: "#f6f1e7",
    foreground: "#1f1b16",
    vignette: "radial-gradient(ellipse at center, transparent 50%, rgba(31, 27, 22, 0.16) 100%)",
  },
  ask: {
    visible: false,
    focus: false,
    pulse: false,
    placeholder: "what should change?",
    maxLength: 140,
    chips: CHIPS,
  },
  seed: {
    branches: [branch],
  },
  bible: {
    prepare: (record) => {
      prepareWords(record)
    },
  },
  input: {
    hint: null,
  },
  solver: {
    run: () => solveWords(branch),
  },
}
