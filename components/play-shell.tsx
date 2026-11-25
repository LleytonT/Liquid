"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CircleHelp, GitBranch, Pause, Play, Volume2, VolumeX } from "lucide-react"
import { BranchBrowser, type TreeNodeData } from "@/components/branch-browser"
import { HowToOverlay } from "@/components/howto/how-to-overlay"
import { PauseOverlay } from "@/components/pause-overlay"
import type { PendingPlan } from "@/components/pending-plan"
import { TraceStrip, type TraceView } from "@/components/trace-strip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { renderers } from "@/games/renderers"
import { gameById } from "@/games/catalog"
import { anonId } from "@/lib/shell/anon-id"
import { getMuted, setMuted, subscribeMute } from "@/lib/shell/audio"
import { BRANCH_CREATED_EVENT, BRANCH_TIP_KEY } from "@/lib/shell/branch-created"
import type { AskHandlers, BranchRecord, HudState } from "@/lib/shell/game-module"
import { Atmosphere } from "@/lib/shell/atmosphere"

function branchLabel(branch: BranchRecord): string {
  if (!branch.parentId) return "original"
  return branch.title
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

export function PlayShell({
  gameId,
  branch,
  parent,
  ownerId,
  trace,
  tree,
}: {
  gameId: string
  branch: BranchRecord
  parent: BranchRecord | null
  ownerId: string
  trace: TraceView | null
  tree?: TreeNodeData[]
}) {
  const router = useRouter()
  const game = gameById(gameId)
  const Renderer = renderers[gameId]
  const [hud, setHud] = useState<HudState | null>(null)
  const [hudGame, setHudGame] = useState(gameId)
  const [paused, setPaused] = useState(false)
  const [pauseGame, setPauseGame] = useState(gameId)
  const [asking, setAsking] = useState(false)
  const [askNote, setAskNote] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingPlan | null>(null)
  if (pauseGame !== gameId) {
    setPauseGame(gameId)
    setPaused(false)
    setAskNote(null)
    setPending(null)
  }
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
    onEmptyEnter: () => false,
    onDismiss: () => {},
  })
  const [hintDismissed, setHintDismissed] = useState(false)
  const hintStarted = useRef(false)
  const stopHint = useRef<() => void>(() => {})

  const onReady = useCallback(() => {
    if (ready.current) return
    ready.current = true
    document.documentElement.dataset.liquidReadyMs = String(Math.round(performance.now()))
  }, [])

  const registerAsk = useCallback((handlers: AskHandlers) => {
    askHandlers.current = handlers
  }, [])

  const closeHowto = () => {
    window.localStorage.setItem(seenKey(gameId), "1")
    window.dispatchEvent(new Event("liquid-howto"))
    setForcedGame(null)
  }

  const [treeOpen, setTreeOpen] = useState(false)
  const [tipOpen, setTipOpen] = useState(false)
  const muted = useSyncExternalStore(subscribeMute, getMuted, () => false)

  useEffect(() => {
    const theme = game?.themeClass
    if (!theme) return
    const root = document.documentElement
    root.classList.remove("theme-shell", "theme-platformer", "theme-words")
    root.classList.add(theme)
    return () => root.classList.remove(theme)
  }, [game?.themeClass])

  useEffect(() => {
    if (howtoOpen || hintStarted.current) return
    hintStarted.current = true
    const timer = window.setTimeout(() => setHintDismissed(true), 5000)
    const stop = (event: Event) => {
      const target = event.target
      if (target instanceof Element && target.closest("[data-shell-control]")) return
      setHintDismissed(true)
    }
    window.addEventListener("keydown", stop)
    window.addEventListener("pointerdown", stop)
    stopHint.current = () => {
      window.clearTimeout(timer)
      window.removeEventListener("keydown", stop)
      window.removeEventListener("pointerdown", stop)
    }
  }, [howtoOpen])

  useEffect(() => () => stopHint.current(), [])

  useEffect(() => {
    const onCreated = () => {
      if (window.localStorage.getItem(BRANCH_TIP_KEY) === "1") return
      setTipOpen(true)
    }
    window.addEventListener(BRANCH_CREATED_EVENT, onCreated)
    return () => window.removeEventListener(BRANCH_CREATED_EVENT, onCreated)
  }, [])

  useEffect(() => {
    if (!tipOpen) return
    const dismiss = () => {
      window.localStorage.setItem(BRANCH_TIP_KEY, "1")
      setTipOpen(false)
    }
    window.addEventListener("pointerdown", dismiss)
    return () => window.removeEventListener("pointerdown", dismiss)
  }, [tipOpen])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (howtoOpen) return
      const typing =
        event.target instanceof HTMLElement &&
        (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA")
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        setPaused((value) => !value)
        return
      }
      if (gameId !== "words" && (event.key === "p" || event.key === "P")) {
        if (typing) return
        event.preventDefault()
        event.stopPropagation()
        setPaused((value) => !value)
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [gameId, howtoOpen])

  const askingRef = useRef(false)

  const submitAsk = useCallback(
    async (text: string) => {
      if (askingRef.current) return
      askingRef.current = true
      setAsking(true)
      setAskNote(null)
      const current: Record<string, number> = {}
      for (const [key, knob] of Object.entries(branch?.snapshot.tunables ?? {})) {
        if (typeof knob.value === "number") current[key] = knob.value
      }
      if (gameId === "platformer") current.enemySpeedScale ??= 1
      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ gameId, parentId: branch.id, ask: text, anonId: anonId(), current }),
        })
        const body = (await response.json()) as {
          route?: PendingPlan["route"]
          confidence?: number
          plan?: { summary?: string; question?: string }
          branch?: { id?: string } | null
          persistence?: { warning?: string | null }
          error?: string
        }
        if (!response.ok || !body.route || !body.plan?.summary || typeof body.confidence !== "number") {
          setAskNote(body.error ?? "that ask did not go through. try again.")
          return
        }
        setPending({
          route: body.route,
          confidence: body.confidence,
          summary: body.plan.summary,
          question: body.plan.question,
          branchId: body.branch?.id ?? null,
          warning: body.persistence?.warning ?? null,
        })
      } catch {
        setAskNote("that ask did not go through. try again.")
      } finally {
        askingRef.current = false
        setAsking(false)
      }
    },
    [branch, gameId],
  )

  const decide = useCallback(
    async (decision: "accept" | "reject") => {
      if (!pending?.branchId) return
      setAsking(true)
      setAskNote(null)
      try {
        const response = await fetch("/api/ask/decide", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ branchId: pending.branchId, decision }),
        })
        const body = (await response.json()) as { error?: string }
        if (!response.ok) {
          setAskNote(body.error ?? "that plan did not go through. try again.")
          return
        }
        const next = pending.branchId
        setPending(null)
        if (decision === "accept") router.push(`/b/${next}`)
        else setAskNote("left as it was. nothing was applied.")
      } catch {
        setAskNote("that plan did not go through. try again.")
      } finally {
        setAsking(false)
      }
    },
    [pending, router],
  )

  if (!game || !Renderer) {
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
    <Atmosphere theme={game.theme} className={game.themeClass}>
      <header data-shell-control className="flex h-14 items-center gap-3 overflow-hidden px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" className="truncate text-[14px] font-bold tracking-tight">
            {game.title}
          </Link>
          <Badge variant="secondary" className="label shrink-0">
            {branchLabel(branch)}
          </Badge>
          <span data-owner={ownerId} className="label shrink-0 text-[12px] font-bold text-foreground/60">
            {ownerId}
          </span>
          <Link href="/shelf" data-shelf className="label shrink-0 text-[12px] font-bold">
            shelf
          </Link>
        </div>
        <p className="tabular min-w-0 flex-1 truncate text-center text-[14px] font-bold" aria-live="polite">
          {stats}
        </p>
        {view.status ? <p className="label hidden text-[12px] font-bold sm:block">{view.status}</p> : null}
        <TooltipProvider delay={400}>
          <div className="flex shrink-0 items-center">
            <Button type="button" variant="ghost" className="h-8 px-2 text-[14px] font-bold" data-ask-open onClick={() => setPaused(true)}>
              ask
            </Button>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={paused ? "resume" : "pause"}
                    aria-pressed={paused}
                    onClick={() => setPaused((value) => !value)}
                  >
                    {paused ? <Play /> : <Pause />}
                  </Button>
                }
              />
              <TooltipContent>{paused ? "resume" : "pause"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
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
                }
              />
              <TooltipContent>how to play</TooltipContent>
            </Tooltip>
            <Tooltip
              open={tipOpen ? true : undefined}
              onOpenChange={(next) => {
                if (!next && tipOpen) {
                  window.localStorage.setItem(BRANCH_TIP_KEY, "1")
                  setTipOpen(false)
                }
              }}
            >
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="remix tree"
                    onClick={() => setTreeOpen(true)}
                  >
                    <GitBranch />
                  </Button>
                }
              />
              <TooltipContent>
                remix tree
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={muted ? "unmute" : "mute"}
                    aria-pressed={muted}
                    onClick={() => setMuted(!muted)}
                  >
                    {muted ? <VolumeX /> : <Volume2 />}
                  </Button>
                }
              />
              <TooltipContent>{muted ? "unmute" : "mute"}</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </header>
      {trace ? <TraceStrip trace={trace} /> : null}
      {diff ? (
        <p data-branch-diff className="label px-4 pb-1 text-[14px] font-medium text-foreground/80">
          {diff}
        </p>
      ) : null}
      {view.goal ? (
        <p data-goal className="px-4 pb-1 text-[14px] leading-5 font-medium text-foreground">
          {view.goal}
        </p>
      ) : null}
      {!hintDismissed && !howtoOpen && !paused && view.hint ? (
        <p data-hint className="pointer-events-none px-4 pb-1 text-[14px] font-medium text-foreground/70">
          {view.hint}
        </p>
      ) : null}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <Renderer
          branch={branch}
          onHud={setHud}
          onReady={onReady}
          registerAsk={registerAsk}
          paused={howtoOpen || paused}
        />
      </div>
      {paused ? (
        <PauseOverlay
          chips={view.ask.chips}
          placeholder={view.ask.placeholder}
          maxLength={view.ask.maxLength}
          note={game.copy.remixBlurb}
          busy={asking}
          error={askNote}
          plan={pending}
          onSubmit={(text) => void submitAsk(text)}
          onAccept={() => void decide("accept")}
          onReject={() => void decide("reject")}
          onClosePlan={() => setPending(null)}
          onEmptyEnter={() => askHandlers.current.onEmptyEnter()}
          onHowTo={() => {
            setHowtoSession((current) => current + 1)
            setForcedGame(gameId)
          }}
          onResume={() => setPaused(false)}
        />
      ) : null}
      <HowToOverlay
        key={`${gameId}-${howtoSession}`}
        open={howtoOpen}
        gameId={game.id}
        steps={steps}
        note={game.copy.overlayNote(branch)}
        onClose={closeHowto}
      />
      <Sheet open={treeOpen} onOpenChange={setTreeOpen}>
        <SheetContent>
          <SheetTitle className="label pr-8 text-[12px] font-bold">remix tree</SheetTitle>
          <BranchBrowser gameId={game.id} initial={tree} />
        </SheetContent>
      </Sheet>
    </Atmosphere>
  )
}
