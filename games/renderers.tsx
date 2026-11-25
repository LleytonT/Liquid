"use client"

import type { ComponentType } from "react"
import type { GameRendererProps } from "@/lib/shell/game-module"
import { PlatformerRenderer } from "@liquid/platformer/renderer"
import { WordsRenderer } from "@liquid/words/renderer"

/** Renderers keyed by game id. Every catalog entry needs one. */
export const renderers: Record<string, ComponentType<GameRendererProps>> = {
  platformer: PlatformerRenderer,
  words: WordsRenderer,
}
