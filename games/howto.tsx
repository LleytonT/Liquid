"use client"

import type { ComponentType } from "react"
import type { HowToVisualProps } from "@/lib/shell/game-module"
import { RemixVisual } from "@/components/howto/remix-visual"
import { DodgeStep, GoalStep, MoveStep } from "@/games/platformer/howto"
import { GuessStep, StatesStep } from "@/games/words/howto"

/** Step visuals keyed by game id, then step id. The shell does not know the pictures. */
export const howToVisuals: Record<string, Record<string, ComponentType<HowToVisualProps>>> = {
  platformer: {
    move: MoveStep,
    dodge: DodgeStep,
    goal: GoalStep,
    remix: RemixVisual,
  },
  words: {
    guess: GuessStep,
    states: StatesStep,
    remix: RemixVisual,
  },
}
