"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { CircleHelp, GitBranch, Pause, Play, Volume2, VolumeX } from "lucide-react"
import { BranchBrowser } from "@/components/branch-browser"
import { HowToOverlay } from "@/components/howto/how-to-overlay"
import { PauseOverlay, askResultCopy } from "@/components/pause-overlay"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { AskPlan, AskSource } from "@/lib/ask/tweak"
import { renderers } from "@/games/renderers"
import { gameById } from "@/games/catalog"
import { getMuted, setMuted, subscribeMute } from "@/lib/shell/audio"
import { BRANCH_CREATED_EVENT, BRANCH_TIP_KEY } from "@/lib/shell/branch-created"
import type { AskHandlers, BranchRecord, HudState } from "@/lib/shell/game-module"
import { Atmosphere } from "@/lib/shell/atmosphere"

function branchLabel(branch: BranchRecord): string {
  if (!branch.parentId) return "original"
  return `${branch.title}'s twist`
}

function seenKey(gameId: string): string {
  return `howto_seen_${gameId}`
}

type KeptAsk = {
  patch: Record<string, number>
  line: string
  source: AskSource
  pending: boolean
}

function storageKey(gameId: string): string {
  return `liquid-ask:${gameId}`
}

const keptCache = new Map<string, { raw: string | null; value: KeptAsk | null }>()

function readKept(gameId: string): KeptAsk | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(storageKey(gameId))
  const hit = keptCache.get(gameId)
  if (hit && hit.raw === raw) return hit.value
  let value: KeptAsk | null = null
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as KeptAsk
      if (parsed && parsed.patch && typeof parsed.line === "string") value = parsed
    } catch {
      value = null
    }
  }
  keptCache.set(gameId, { raw, value })
  return value
}

function writeKept(gameId: string, value: KeptAsk): void {
  const raw = JSON.stringify(value)
  window.localStorage.setItem(storageKey(gameId), raw)
  keptCache.set(gameId, { raw, value })
  window.dispatchEvent(new Event("liquid-ask"))
}

function useKeptAsk(gameId: string): KeptAsk | null {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("liquid-ask", onChange)
      window.addEventListener("storage", onChange)
      return () => {
        window.removeEventListener("liquid-ask", onChange)
        window.removeEventListener("storage", onChange)
      }
    },
    () => readKept(gameId),
    () => null,
  )
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
  const [paused, setPaused] = useState(false)
  const [pauseGame, setPauseGame] = useState(gameId)
  const [asking, setAsking] = useState(false)
  const [askNote, setAskNote] = useState<string | null>(null)
  const kept = useKeptAsk(gameId)
  if (pauseGame !== gameId) {
    setPauseGame(gameId)
    setPaused(false)
    setAskNote(null)
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
      if (event.key === "p" || event.key === "P") {
        if (typing) return
        event.preventDefault()
        event.stopPropagation()
        setPaused((value) => !value)
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [howtoOpen])

  const applyLife = useCallback(() => {
    const current = readKept(gameId)
    if (!current?.pending) return
    writeKept(gameId, { ...current, pending: false })
  }, [gameId])

  const submitAsk = useCallback(
    async (text: string) => {
      setAsking(true)
      setAskNote(null)
      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ gameId, ask: text }),
        })
        const plan = (await response.json()) as AskPlan
        if (!response.ok || !plan?.kind) {
          setAskNote("that ask did not go through. try again.")
          return
        }
        if (plan.kind === "tweak" && plan.patch) {
          writeKept(gameId, {
            patch: plan.patch,
            line: plan.line,
            source: plan.source,
            pending: true,
          })
          setAskNote(askResultCopy(plan, gameId === "words" ? "start the next round" : "respawn"))
          return
        }
        setAskNote(plan.line)
      } catch {
        setAskNote("that ask did not go through. try again.")
      } finally {
        setAsking(false)
      }
    },
    [gameId],
  )

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
    <Atmosphere theme={game.theme} className={game.themeClass}>
      <header data-shell-control className="flex h-14 items-center gap-3 overflow-hidden px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" className="truncate text-[14px] font-bold tracking-tight">
            {game.title}
          </Link>
          <Badge variant="secondary" className="label shrink-0">
            {branchLabel(branch)}
          </Badge>
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
      {kept ? (
        <p data-tweak className="px-4 pb-1 text-[14px] font-medium">
          {kept.pending
            ? `${kept.line}. kept in this browser. starts when you ${gameId === "words" ? "start the next round" : "respawn"}.`
            : `${kept.line}. kept in this browser.`}
        </p>
      ) : null}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <Renderer
          branch={branch}
          onHud={setHud}
          onReady={onReady}
          registerAsk={registerAsk}
          paused={howtoOpen || paused}
          tweaks={kept && !kept.pending ? kept.patch : undefined}
          onLife={applyLife}
        />
      </div>
      {paused ? (
        <PauseOverlay
          chips={view.ask.chips}
          placeholder={view.ask.placeholder}
          maxLength={view.ask.maxLength}
          note={game.copy.remixBlurb}
          busy={asking}
          result={askNote}
          onSubmit={(text) => void submitAsk(text)}
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
          <BranchBrowser gameId={game.id} />
        </SheetContent>
      </Sheet>
    </Atmosphere>
  )
}
