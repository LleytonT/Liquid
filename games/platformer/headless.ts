import type { GameHeadless } from "@/lib/shell/game-module"
import seed from "@/games/platformer/seed.json"
import type { BranchRecord } from "@/lib/shell/game-module"
import { preparePlatformer } from "@/games/platformer/validate"
import { solvePlatformer } from "@/games/platformer/solve"

const branch = seed as BranchRecord

export const platformer: GameHeadless = {
  id: "platformer",
  title: "seed",
  summary: "five rooms. deaths are the score.",
  rootBranchId: branch.id,
  contextChips: ["slow the fast dots", "add a safe zone", "widen this gap"],
  seed: {
    branches: [branch],
  },
  bible: {
    prepare: (record) => {
      preparePlatformer(record)
    },
  },
  input: {
    hint: "arrows to move",
  },
  solver: {
    run: () => solvePlatformer(branch),
  },
}
