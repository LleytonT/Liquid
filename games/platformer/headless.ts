import type { GameHeadless } from "@/lib/shell/game-module"
import seed from "@/games/platformer/seed.json"
import type { BranchRecord } from "@/lib/shell/game-module"
import { platformerCopy } from "@/games/platformer/copy"
import { preparePlatformer } from "@/games/platformer/validate"
import { solvePlatformer } from "@/games/platformer/solve"

const branch = seed as BranchRecord

export const platformer: GameHeadless = {
  id: "platformer",
  title: "seed",
  summary: "five rooms. deaths are the score.",
  rootBranchId: branch.id,
  themeClass: "theme-platformer",
  copy: platformerCopy,
  theme: {
    background: "#F7F7FF",
    foreground: "#1a1a2e",
    vignette: "radial-gradient(ellipse at center, transparent 42%, rgba(26, 26, 46, 0.28) 100%)",
  },
  ask: {
    visible: true,
    focus: false,
    pulse: false,
    placeholder: platformerCopy.askPlaceholder,
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
    hint: platformerCopy.firstRunHint,
  },
  solver: {
    run: () => solvePlatformer(branch),
  },
}
