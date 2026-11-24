"use client"

import Link from "next/link"
import { catalog } from "@/games/catalog"
import type { BranchRecord, GameHeadless } from "@/lib/shell/game-module"
import { buttonVariants } from "@/components/ui/button"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"

function parentOf(game: GameHeadless, branch: BranchRecord): BranchRecord | null {
  if (!branch.parentId) return null
  return game.seed.branches.find((item) => item.id === branch.parentId) ?? null
}

export function BranchBrowser({ gameId }: { gameId?: string }) {
  const initial = catalog.some((game) => game.id === gameId) ? gameId : catalog[0]?.id

  return (
    <Tabs defaultValue={initial}>
      <TabsList>
        {catalog.map((game) => (
          <TabsTab key={game.id} value={game.id}>
            {game.title}
          </TabsTab>
        ))}
      </TabsList>
      {catalog.map((game) => (
        <TabsPanel key={game.id} value={game.id}>
          <ul className="grid gap-3">
            {game.seed.branches.map((branch) => {
              const diff = game.copy.describeBranchDiff(branch, parentOf(game, branch))
              return (
                <li
                  key={branch.id}
                  className={`${game.themeClass} rounded-xl border border-border bg-card p-4 text-card-foreground`}
                >
                  <h3 className="text-[20px] font-extrabold tracking-tight">{branch.title}</h3>
                  <p className="mt-1 text-[14px] leading-5 font-medium text-foreground/75">{game.summary}</p>
                  {diff ? <p className="mt-2 text-[14px] font-medium">{diff}</p> : null}
                  <Link href={`/b/${branch.id}`} className={buttonVariants({ className: "mt-4" })}>
                    play
                  </Link>
                </li>
              )
            })}
          </ul>
        </TabsPanel>
      ))}
    </Tabs>
  )
}
