import type { GameHeadless } from "@/lib/shell/game-module"
import { wordsCopy } from "@/games/words/copy"
import { solveWords } from "@/games/words/solve"
import { wordsBranches } from "@/games/words/starters"
import { prepareWords } from "@/games/words/validate"

const branch = wordsBranches[0]
const CHIPS = ["turn on hard mode", "fewer guesses", "rarer words"] as const

export const words: GameHeadless = {
  id: "words",
  title: "liquid words",
  summary: "five letters. six guesses. the streak is the score.",
  rootBranchId: branch.id,
  themeClass: "theme-words",
  copy: wordsCopy,
  theme: {
    background: "#f6f1e7",
    foreground: "#1f1b16",
    vignette: "radial-gradient(ellipse at center, transparent 50%, rgba(31, 27, 22, 0.16) 100%)",
  },
  ask: {
    visible: false,
    focus: false,
    pulse: false,
    placeholder: wordsCopy.askPlaceholder,
    maxLength: 140,
    chips: CHIPS,
  },
  seed: {
    branches: wordsBranches,
  },
  bible: {
    prepare: (record) => {
      prepareWords(record)
    },
  },
  input: {
    hint: wordsCopy.firstRunHint,
  },
  solver: {
    run: () =>
      wordsBranches.flatMap((record) =>
        solveWords(record).map((result) => ({
          ...result,
          levelId: record.parentId ? `${record.id}/${result.levelId}` : result.levelId,
        })),
      ),
  },
}
