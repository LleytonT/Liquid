"use client"

import Link from "next/link"
import { catalog } from "@/games/catalog"
import type { BranchRecord, GameHeadless } from "@/lib/shell/game-module"

function parentOf(game: GameHeadless, branch: BranchRecord): BranchRecord | null {
  if (!branch.parentId) return null
  return game.seed.branches.find((item) => item.id === branch.parentId) ?? null
}

function childrenOf(game: GameHeadless, parentId: string): BranchRecord[] {
  return game.seed.branches.filter((item) => item.parentId === parentId)
}

function TreeNode({ game, branch }: { game: GameHeadless; branch: BranchRecord }) {
  const children = childrenOf(game, branch.id)
  const diff = game.copy.describeBranchDiff(branch, parentOf(game, branch))
  return (
    <li>
      <Link
        href={`/b/${branch.id}`}
        data-tree-node={branch.id}
        className="block rounded-lg px-2 py-1.5 hover:bg-muted"
      >
        <span className="text-[14px] font-bold tracking-tight">{branch.title}</span>
        {diff ? <span className="mt-0.5 block text-[12px] leading-4 font-medium text-foreground/70">{diff}</span> : null}
      </Link>
      {children.length > 0 ? (
        <ul className="mt-1 ml-3 border-l border-foreground/25 pl-3">
          {children.map((child) => (
            <TreeNode key={child.id} game={game} branch={child} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function BranchBrowser({ gameId }: { gameId?: string }) {
  const games = catalog.some((game) => game.id === gameId)
    ? [catalog.find((game) => game.id === gameId)!, ...catalog.filter((game) => game.id !== gameId)]
    : [...catalog]

  return (
    <div data-remix-tree className="grid gap-6">
      {games.map((game) => {
        const roots = game.seed.branches.filter((branch) => !branch.parentId)
        return (
          <section key={game.id} className={game.themeClass}>
            <h3 className="label text-[12px] font-bold text-foreground/70">{game.title}</h3>
            <ul className="mt-2 grid gap-1">
              {roots.map((branch) => (
                <TreeNode key={branch.id} game={game} branch={branch} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
