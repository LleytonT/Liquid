"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { catalog } from "@/games/catalog"
import { Atmosphere } from "@/lib/shell/atmosphere"

export function ShelfScreen() {
  const router = useRouter()

  return (
    <Atmosphere>
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" className="label text-lg tracking-tight">
          liquid
        </Link>
        <p className="label text-sm">shelf</p>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 pb-12">
        <h1 className="text-3xl tracking-tight">games on the shelf</h1>
        <ul className="grid gap-3 sm:grid-cols-2">
          {catalog.map((game) => (
            <li
              key={game.id}
              className="flex flex-col rounded-2xl border border-[rgba(26,26,46,0.12)] bg-white/75 p-4 shadow-[2px_2px_0_rgba(26,26,46,0.18)]"
            >
              <h2 className="text-xl tracking-tight">{game.title}</h2>
              <p className="mt-1 text-sm leading-6 text-[#3c3a55]">{game.summary}</p>
              <p className="label mt-3 text-xs">branch {game.rootBranchId}</p>
              <Button
                type="button"
                className="mt-4 w-fit"
                onClick={() => router.push(`/b/${game.rootBranchId}`)}
              >
                play
              </Button>
            </li>
          ))}
        </ul>
      </main>
    </Atmosphere>
  )
}
