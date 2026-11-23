"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AskBar } from "@/components/ask-bar"
import { PlanCard } from "@/components/plan-card"
import { buttonVariants } from "@/components/ui/button"
import { renderers } from "@/games/renderers"
import { gameById } from "@/games/catalog"
import type { AskHandlers, HudState } from "@/lib/shell/game-module"
import { Atmosphere } from "@/lib/shell/atmosphere"

export function PlayShell({ gameId, branchId }: { gameId: string; branchId: string }) {
  const game = gameById(gameId)
  const branch = game?.seed.branches.find((item) => item.id === branchId)
  const Renderer = renderers[gameId]
  const [hud, setHud] = useState<HudState | null>(null)
  const [plan, setPlan] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(true)
  const ready = useRef(false)
  const askHandlers = useRef<AskHandlers>({
    onEmptyEnter: () => {},
    onDismiss: () => {},
  })

  useEffect(() => {
    const timer = window.setTimeout(() => setShowHint(false), 5000)
    return () => window.clearTimeout(timer)
  }, [gameId])

  const onReady = useCallback(() => {
    if (ready.current) return
    ready.current = true
    document.documentElement.dataset.liquidReadyMs = String(Math.round(performance.now()))
  }, [])

  const registerAsk = useCallback((handlers: AskHandlers) => {
    askHandlers.current = handlers
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

  const view = hud ?? {
    metrics: [],
    status: null,
    hint: game.input.hint,
    ask: game.ask,
  }

  return (
    <Atmosphere theme={game.theme}>
      <header data-shell-control className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
        <Link href="/" className="label text-lg tracking-tight">
          liquid
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-live="polite">
          {view.metrics.map((metric) => (
            <p key={metric.id} className="label text-sm">
              {metric.label} <span className="tabular">{metric.value}</span>
            </p>
          ))}
        </div>
        <span className="branch-chip label text-sm">{branch.title}</span>
        {view.status ? <p className="label text-sm">{view.status}</p> : null}
        <Link
          href="/shelf"
          className={`${buttonVariants({ variant: "outline", size: "sm" })} ml-auto bg-white/75`}
        >
          shelf
        </Link>
      </header>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <Renderer branch={branch} onHud={setHud} onReady={onReady} registerAsk={registerAsk} />
        {showHint && view.hint ? (
          <p className="label pointer-events-none absolute inset-x-0 bottom-1 text-center text-sm">
            {view.hint}
          </p>
        ) : null}
      </div>
      {view.ask.visible ? (
        <footer className="relative z-30 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
          {plan ? (
            <div className="absolute bottom-full left-4 mb-3 w-[min(28rem,calc(100%-2rem))] sm:left-5">
              <PlanCard ask={plan} onClose={() => setPlan(null)} />
            </div>
          ) : null}
          <AskBar
            chips={view.ask.chips}
            maxLength={view.ask.maxLength}
            placeholder={view.ask.placeholder}
            pulse={view.ask.pulse}
            focus={view.ask.focus}
            onSubmit={setPlan}
            onEmptyEnter={() => askHandlers.current.onEmptyEnter()}
            onDismiss={() => askHandlers.current.onDismiss()}
          />
        </footer>
      ) : null}
    </Atmosphere>
  )
}
