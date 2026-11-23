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
  theme: {
    background: "linear-gradient(180deg, #b4b5fe 0%, #d9d4ff 100%)",
    foreground: "#1a1a2e",
    vignette: "radial-gradient(ellipse at center, transparent 42%, rgba(26, 26, 46, 0.28) 100%)",
  },
  ask: {
    visible: true,
    focus: false,
    pulse: false,
    placeholder: "what should change?",
    maxLength: 140,
    chips: ["slow the fast dots", "add a safe zone", "widen this gap"],
  },
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
