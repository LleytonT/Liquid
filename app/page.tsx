import type { Metadata } from "next"
import { Landing } from "@/components/landing/landing"
import { catalog } from "@/games/catalog"

export const metadata: Metadata = {
  title: "liquid",
  description: "Play a game, ask for a twist, and it becomes a branch on a public remix tree.",
}

export default function Page() {
  const cards = catalog.map((game) => ({
    id: game.id,
    title: game.title,
    summary: game.summary,
    href: `/b/${game.rootBranchId}`,
    themeClass: game.themeClass,
  }))
  return <Landing cards={cards} />
}
