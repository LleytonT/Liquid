"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AskBar } from "@/components/ask-bar"
import { PlanCard } from "@/components/plan-card"
import { buttonVariants } from "@/components/ui/button"
import { renderers } from "@/games/renderers"
import { gameById } from "@/games/catalog"
import type { HudState } from "@/lib/shell/game-module"
import { Atmosphere } from "@/lib/shell/atmosphere"

const EMPTY_HUD: HudState = { metrics: [], status: null }

export function PlayShell({ gameId, branchId }: { gameId: string; branchId: string }) {
  const game = gameById(gameId)
  const branch = game?.seed.branches.find((item) => item.id === branchId)
  const Renderer = renderers[gameId]
  const [hud, setHud] = useState<HudState>(EMPTY_HUD)
  const [plan, setPlan] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(true)
  const ready = useRef(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setShowHint(false), 5000)
    return () => window.clearTimeout(timer)
  }, [])

  const onReady = useCallback(() => {
    if (ready.current) return
    ready.current = true
    document.documentElement.dataset.liquidReadyMs = String(Math.round(performance.now()))
  }, [])

  if (!game || !branch || !Renderer) {
    return (
      <Atmosphere>
        <main className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-3 px-6">
          <p className="label text-lg">liquid</p>
          <h1 className="text-3xl tracking-tight">that branch is not on the shelf</h1>
          <Link href="/" className="label underline">
            back to the root
          </Link>
        </main>
      </Atmosphere>
    )
  }

  return (
    <Atmosphere>
      <header data-shell-control className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
        <Link href="/" className="label text-lg tracking-tight">
          liquid
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-live="polite">
          {hud.metrics.map((metric) => (
            <p key={metric.id} className="label text-sm">
              {metric.label} <span className="tabular">{metric.value}</span>
            </p>
          ))}
        </div>
        <span className="branch-chip label text-sm">{branch.title}</span>
        {hud.status ? <p className="label text-sm">{hud.status}</p> : null}
        <Link
          href="/shelf"
          className={`${buttonVariants({ variant: "outline", size: "sm" })} ml-auto bg-white/75`}
        >
          shelf
        </Link>
      </header>
      <div className="relative min-h-0 flex-1">
        <Renderer branch={branch} onHud={setHud} onReady={onReady} />
        {showHint ? (
          <p className="label pointer-events-none absolute inset-x-0 bottom-1 text-center text-sm">
            {game.input.hint}
          </p>
        ) : null}
      </div>
      <footer className="relative z-30 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
        {plan ? (
          <div className="absolute bottom-full left-4 mb-3 w-[min(28rem,calc(100%-2rem))] sm:left-5">
            <PlanCard ask={plan} onClose={() => setPlan(null)} />
          </div>
        ) : null}
        <AskBar chips={game.contextChips} onSubmit={setPlan} />
      </footer>
    </Atmosphere>
  )
}
