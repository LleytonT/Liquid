"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { catalog } from "@/games/catalog"
import type { TreeNodeData } from "@/components/tree-node"
import type { BranchRecord, GameHeadless } from "@/lib/shell/game-module"

export type { TreeNodeData } from "@/components/tree-node"

function parentOf(game: GameHeadless, branch: BranchRecord): BranchRecord | null {
  if (!branch.parentId) return null
  return game.seed.branches.find((item) => item.id === branch.parentId) ?? null
}

function childrenOf(game: GameHeadless, parentId: string): BranchRecord[] {
  return game.seed.branches.filter((item) => item.parentId === parentId)
}

function liveNodes(nodes: readonly TreeNodeData[]): TreeNodeData[] {
  return nodes.filter((node) => node.status !== "rejected")
}

function factoryChildren(nodes: readonly TreeNodeData[], parentId: string): TreeNodeData[] {
  return liveNodes(nodes).filter((node) => node.parentId === parentId)
}

function statusLine(node: TreeNodeData): string {
  if (node.status === "playable") return node.visibility
  if (node.kind === "tweak") return "not applied yet"
  return "not built yet"
}

function FactoryTree({
  nodes,
  parentId,
  seen,
}: {
  nodes: readonly TreeNodeData[]
  parentId: string
  seen: Set<string>
}) {
  const kids = factoryChildren(nodes, parentId).filter((node) => !seen.has(node.id))
  if (kids.length === 0) return null
  return (
    <ul className="mt-1 ml-3 border-l border-foreground/25 pl-3">
      {kids.map((node) => {
        seen.add(node.id)
        return (
          <li key={node.id}>
            <Link
              href={`/b/${node.id}`}
              data-tree-node={node.id}
              data-visibility={node.visibility}
              className="block rounded-lg px-2 py-1.5 hover:bg-muted"
            >
              <span className="text-[14px] font-bold tracking-tight">{node.plan}</span>
              <span className="mt-0.5 block text-[12px] leading-4 font-medium text-foreground/70">
                {statusLine(node)}
              </span>
            </Link>
            <FactoryTree nodes={nodes} parentId={node.id} seen={seen} />
          </li>
        )
      })}
    </ul>
  )
}

function TreeNode({
  game,
  branch,
  nodes,
  seen,
}: {
  game: GameHeadless
  branch: BranchRecord
  nodes: readonly TreeNodeData[]
  seen: Set<string>
}) {
  const children = childrenOf(game, branch.id)
  const diff = game.copy.describeBranchDiff(branch, parentOf(game, branch))
  return (
    <li>
      <Link href={`/b/${branch.id}`} data-tree-node={branch.id} className="block rounded-lg px-2 py-1.5 hover:bg-muted">
        <span className="text-[14px] font-bold tracking-tight">{branch.title}</span>
        {diff ? <span className="mt-0.5 block text-[12px] leading-4 font-medium text-foreground/70">{diff}</span> : null}
      </Link>
      {children.length > 0 ? (
        <ul className="mt-1 ml-3 border-l border-foreground/25 pl-3">
          {children.map((child) => (
            <TreeNode key={child.id} game={game} branch={child} nodes={nodes} seen={seen} />
          ))}
        </ul>
      ) : null}
      <FactoryTree nodes={nodes} parentId={branch.id} seen={seen} />
    </li>
  )
}

export function BranchBrowser({ gameId, initial = [] }: { gameId?: string; initial?: TreeNodeData[] }) {
  const [nodes, setNodes] = useState(initial)
  useEffect(() => {
    let cancel = false
    void fetch("/api/branches")
      .then((response) => response.json())
      .then((body: { branches?: TreeNodeData[] }) => {
        if (!cancel && Array.isArray(body.branches)) setNodes(body.branches)
      })
      .catch(() => undefined)
    return () => {
      cancel = true
    }
  }, [])

  const games = catalog.some((game) => game.id === gameId)
    ? [catalog.find((game) => game.id === gameId)!, ...catalog.filter((game) => game.id !== gameId)]
    : [...catalog]

  return (
    <div data-remix-tree className="grid gap-6">
      {games.map((game) => {
        const roots = game.seed.branches.filter((branch) => !branch.parentId)
        const seen = new Set<string>()
        const gameNodes = liveNodes(nodes).filter((node) => node.gameId === game.id)
        return (
          <section key={game.id} className={game.themeClass}>
            <h3 className="label text-[12px] font-bold text-foreground/70">{game.title}</h3>
            <ul className="mt-2 grid gap-1">
              {roots.map((branch) => (
                <TreeNode key={branch.id} game={game} branch={branch} nodes={gameNodes} seen={seen} />
              ))}
            </ul>
            {[...new Set(gameNodes.filter((node) => !seen.has(node.id)).map((node) => node.parentId))].map((parentId) => (
              <FactoryTree key={parentId} nodes={gameNodes} parentId={parentId} seen={seen} />
            ))}
          </section>
        )
      })}
    </div>
  )
}
