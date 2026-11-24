"use client"

import { useCallback, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { CircleHelp } from "lucide-react"
import { AskBar } from "@/components/ask-bar"
import { HowToOverlay } from "@/components/howto/how-to-overlay"
import { PlanCard } from "@/components/plan-card"
import { Button } from "@/components/ui/button"
import { renderers } from "@/games/renderers"
import { gameById } from "@/games/catalog"
import type { AskHandlers, BranchRecord, HudState } from "@/lib/shell/game-module"
import { Atmosphere } from "@/lib/shell/atmosphere"

function branchLabel(branch: BranchRecord): string {
  if (!branch.parentId) return "original"
  return `${branch.title}'s twist`
}

function seenKey(gameId: string): string {
  return `howto_seen_${gameId}`
}

function useHowToSeen(gameId: string): boolean {
  const key = seenKey(gameId)
  return useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("liquid-howto", onStoreChange)
      return () => window.removeEventListener("liquid-howto", onStoreChange)
    },
    () => window.localStorage.getItem(key) === "1",
    () => true,
  )
}

export function PlayShell({ gameId, branchId }: { gameId: string; branchId: string }) {
  const game = gameById(gameId)
  const branch = game?.seed.branches.find((item) => item.id === branchId)
  const Renderer = renderers[gameId]
  const [hud, setHud] = useState<HudState | null>(null)
  const [hudGame, setHudGame] = useState(gameId)
  const [plan, setPlan] = useState<string | null>(null)
  const [forcedGame, setForcedGame] = useState<string | null>(null)
  const [howtoSession, setHowtoSession] = useState(0)
  const seen = useHowToSeen(gameId)
  const howtoOpen = forcedGame === gameId || !seen
  const ready = useRef(false)
  if (hudGame !== gameId) {
    setHudGame(gameId)
    setHud(null)
  }
  const askHandlers = useRef<AskHandlers>({
    onEmptyEnter: () => {},
    onDismiss: () => {},
  })

  const onReady = useCallback(() => {
    if (ready.current) return
    ready.current = true
    document.documentElement.dataset.liquidReadyMs = String(Math.round(performance.now()))
  }, [])

  const registerAsk = useCallback((handlers: AskHandlers) => {
    askHandlers.current = handlers
  }, [])

  const closeHowto = useCallback(() => {
    window.localStorage.setItem(seenKey(gameId), "1")
    window.dispatchEvent(new Event("liquid-howto"))
    setForcedGame(null)
  }, [gameId])

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

  const parent = branch.parentId
    ? (game.seed.branches.find((item) => item.id === branch.parentId) ?? null)
    : null
  const diff = game.copy.describeBranchDiff(branch, parent)
  const steps = game.copy.howTo(branch)
  const view = hud ?? {
    metrics: [],
    status: null,
    hint: game.input.hint,
    ask: game.ask,
  }
  const stats = game.copy.formatStats(view.metrics)

  return (
    <Atmosphere theme={game.theme}>
      <header data-shell-control className="flex h-14 items-center gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" className="truncate text-[14px] font-bold tracking-tight">
            {game.title}
          </Link>
          <span className="branch-chip label shrink-0 text-[12px] font-bold">{branchLabel(branch)}</span>
        </div>
        <p className="tabular min-w-0 flex-1 truncate text-center text-[14px] font-bold" aria-live="polite">
          {stats}
        </p>
        {view.status ? <p className="label hidden text-[12px] font-bold sm:block">{view.status}</p> : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="how to play"
          onClick={() => {
            setHowtoSession((current) => current + 1)
            setForcedGame(gameId)
          }}
        >
          <CircleHelp />
        </Button>
        <Link href="/shelf" className="label hidden text-[12px] font-bold underline sm:inline">
          shelf
        </Link>
      </header>
      {diff ? (
        <p data-branch-diff className="label px-4 pb-1 text-[14px] font-medium text-foreground/80">
          {diff}
        </p>
      ) : null}
      {view.hint ? (
        <p className="pointer-events-none px-4 pb-1 text-[14px] font-medium text-foreground/70">{view.hint}</p>
      ) : null}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <Renderer
          branch={branch}
          onHud={setHud}
          onReady={onReady}
          registerAsk={registerAsk}
          paused={howtoOpen}
        />
      </div>
      {view.ask.visible ? (
        <footer className="relative z-30 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4">
          {plan ? (
            <div className="absolute bottom-full left-4 mb-3 w-[min(28rem,calc(100%-2rem))]">
              <PlanCard ask={plan} onClose={() => setPlan(null)} />
            </div>
          ) : null}
          <AskBar
            chips={view.ask.chips}
            maxLength={view.ask.maxLength}
            placeholder={view.ask.placeholder}
            pulse={view.ask.pulse}
            focus={view.ask.focus && !howtoOpen}
            onSubmit={setPlan}
            onEmptyEnter={() => askHandlers.current.onEmptyEnter()}
            onDismiss={() => askHandlers.current.onDismiss()}
            note={game.copy.remixBlurb}
          />
        </footer>
      ) : null}
      <HowToOverlay
        key={`${gameId}-${howtoSession}`}
        open={howtoOpen}
        gameId={game.id}
        steps={steps}
        note={game.copy.overlayNote(branch)}
        onClose={closeHowto}
      />
    </Atmosphere>
  )
}
