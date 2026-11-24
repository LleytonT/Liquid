"use client"

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react"
import type { GameRendererProps } from "@/lib/shell/game-module"
import {
  playChord,
  playScaleNote,
  playThump,
  resetScale,
  SOUND_LEAD_MS,
  unlockAudio,
} from "@/lib/shell/audio"
import { isShellControl } from "@/lib/shell/input"
import { planTileFlip, type FlipTile, type PlannedFlip } from "@/lib/shell/tile-flip"
import { Button } from "@/components/ui/button"
import { drawFrame, type GhostPath } from "@/games/platformer/draw"
import { FEEL } from "@/games/platformer/feel"
import { DT, LOCKED } from "@/games/platformer/locked"
import { initialSim, step } from "@/games/platformer/physics"
import { collectedCount, positionsAt, type RuntimeLevel, type Sim, type Vec } from "@/games/platformer/runtime"
import { PLATFORMER_GOAL, PLATFORMER_TWEAK_CHIPS, platformerCopy } from "@/games/platformer/copy"
import { preparePlatformer } from "@/games/platformer/validate"

const MOVES = new Set(["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s"])
const WORLD_W = LOCKED.cols * LOCKED.tilePx
const WORLD_H = LOCKED.rows * LOCKED.tilePx

function flipTiles(level: RuntimeLevel): FlipTile[] {
  const tiles: FlipTile[] = []
  for (let row = 0; row < LOCKED.rows; row++) {
    for (let col = 0; col < LOCKED.cols; col++) {
      if (level.grid[row][col] === ".") continue
      tiles.push({
        id: `${col},${row}`,
        x: (col + 0.5) * LOCKED.tilePx,
        y: (row + 0.5) * LOCKED.tilePx,
      })
    }
  }
  level.coins.forEach((coin, index) => {
    tiles.push({ id: `coin-${index}`, x: coin.x, y: coin.y })
  })
  return tiles
}

function centroid(tiles: FlipTile[]): { x: number; y: number } {
  if (tiles.length === 0) return { x: WORLD_W / 2, y: WORLD_H / 2 }
  const sum = tiles.reduce((acc, tile) => ({ x: acc.x + tile.x, y: acc.y + tile.y }), { x: 0, y: 0 })
  return { x: sum.x / tiles.length, y: sum.y / tiles.length }
}

export function PlatformerRenderer({
  branch,
  onHud,
  onReady,
  registerAsk,
  paused = false,
  tweaks,
  onLife,
}: GameRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const onHudRef = useRef(onHud)
  const onReadyRef = useRef(onReady)
  const resetRef = useRef<() => void>(() => {})
  const touchRef = useRef({ x: 0, y: 0 })
  const [clearCard, setClearCard] = useState<{
    level: number
    levels: number
    deaths: number
    action: "next" | "replay"
  } | null>(null)
  const pausedRef = useRef(paused)
  const tweaksRef = useRef(tweaks)
  const onLifeRef = useRef(onLife)
  const skipClearRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    pausedRef.current = paused
    tweaksRef.current = tweaks
    onLifeRef.current = onLife
  }, [paused, tweaks, onLife])

  useEffect(() => {
    onHudRef.current = onHud
    onReadyRef.current = onReady
    const snapshot = preparePlatformer(branch)
    const canvas = canvasRef.current
    const stage = stageRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !stage || !ctx) return

    let levelIndex = 0
    let deaths = 0
    let sim: Sim = initialSim(snapshot.levels[0])
    let flips = new Map<string, PlannedFlip>()
    let flipStart = performance.now()
    let trails: Vec[][] = []
    let ghosts: GhostPath[] = []
    let attempt: Vec[] = []
    let flashUntil = 0
    let flashTone: "hurt" | "clear" = "hurt"
    let holdUntil = 0
    let pending: { due: number; run: () => void }[] = []
    let clearedAll = false
    let levelsCleared = 0
    let chips: string[] = [...PLATFORMER_TWEAK_CHIPS]
    let acc = 0
    let last = performance.now()
    let clearTimer = 0
    let ready = false
    let hudKey = ""
    let hintOn = true
    let hintAccum = 0
    let hintMark = performance.now()
    let youUntil = 0
    let youArmed = false
    const keys = new Set<string>()

    const level = () => snapshot.levels[levelIndex]

    const publish = () => {
      const pulsing = deaths >= 3 || levelsCleared > 0
      const hud = {
        metrics: [
          { id: "level", label: "level", value: String(levelIndex + 1) },
          { id: "levels", label: "levels", value: String(snapshot.levels.length) },
          { id: "coins", label: "coins", value: `${collectedCount(sim.coins)}/${level().coins.length}` },
          { id: "deaths", label: "deaths", value: String(deaths) },
        ],
        goal: PLATFORMER_GOAL,
        status: clearedAll ? "five rooms cleared" : null,
        hint: hintOn ? platformerCopy.firstRunHint : null,
        ask: {
          visible: true,
          focus: false,
          pulse: pulsing,
          placeholder: platformerCopy.askPlaceholder,
          maxLength: 140,
          chips: pulsing
            ? [platformerCopy.pulseChip, ...chips.filter((chip) => chip !== platformerCopy.pulseChip)]
            : chips,
        },
      }
      const key = JSON.stringify(hud)
      if (key === hudKey) return
      hudKey = key
      onHudRef.current(hud)
    }

    const boot = (index: number, keepDeaths: boolean) => {
      levelIndex = index
      if (!keepDeaths) {
        deaths = 0
        levelsCleared = 0
        chips = [...PLATFORMER_TWEAK_CHIPS]
      }
      sim = initialSim(snapshot.levels[index])
      const tiles = flipTiles(snapshot.levels[index])
      flips = new Map(planTileFlip(tiles, centroid(tiles)).map((tile) => [tile.id, tile]))
      flipStart = performance.now()
      trails = snapshot.levels[index].enemies.map(() => [])
      youArmed = false
      youUntil = 0
      attempt = []
      flashUntil = 0
      holdUntil = 0
      pending = []
      clearedAll = false
      acc = 0
      resetScale()
      window.clearTimeout(clearTimer)
      skipClearRef.current = null
      setClearCard(null)
      publish()
    }

    resetRef.current = () => boot(0, false)

    const onKeyDown = (event: KeyboardEvent) => {
      if (pausedRef.current) return
      if (skipClearRef.current && !isShellControl(event.target)) {
        event.preventDefault()
        skipClearRef.current()
        return
      }
      const key = event.key.toLowerCase()
      if (!MOVES.has(key)) return
      if (isShellControl(event.target) || isShellControl(document.activeElement)) return
      event.preventDefault()
      unlockAudio()
      if (hintOn) {
        hintOn = false
        publish()
      }
      keys.add(key)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      keys.delete(event.key.toLowerCase())
    }
    const onBlur = () => keys.clear()

    const fit = () => {
      const rect = stage.getBoundingClientRect()
      const scale = Math.min(rect.width / WORLD_W, rect.height / WORLD_H)
      const cssW = Math.max(1, Math.floor(WORLD_W * scale))
      const cssH = Math.max(1, Math.floor(WORLD_H * scale))
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const bufferW = Math.round(cssW * dpr)
      const bufferH = Math.round(cssH * dpr)
      if (canvas.width !== bufferW || canvas.height !== bufferH) {
        canvas.width = bufferW
        canvas.height = bufferH
        canvas.style.width = `${cssW}px`
        canvas.style.height = `${cssH}px`
      }
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0)
    }

    let raf = 0
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!pausedRef.current) {
        if (!youArmed) {
          youArmed = true
          youUntil = now + FEEL.youMarkMs
        }
        hintAccum += now - hintMark
        if (hintOn && hintAccum >= platformerCopy.hintFadeMs) {
          hintOn = false
          publish()
        }
        if (touchRef.current.x !== 0 || touchRef.current.y !== 0) {
          if (hintOn) {
            hintOn = false
            publish()
          }
        }
      }
      hintMark = now
      if (!sim.cleared && !pausedRef.current) {
        acc += dt
        let steps = 0
        let hudDirty = false
        const typing = isShellControl(document.activeElement)
        while (acc >= DT && steps < 5 && !sim.cleared) {
          acc -= DT
          steps += 1
          let x = touchRef.current.x
          let y = touchRef.current.y
          if (!typing) {
            if (keys.has("arrowleft") || keys.has("a")) x -= 1
            if (keys.has("arrowright") || keys.has("d")) x += 1
            if (keys.has("arrowup") || keys.has("w")) y -= 1
            if (keys.has("arrowdown") || keys.has("s")) y += 1
          }
          const beforeAlive = sim.alive
          const live = tweaksRef.current
          const result = step(
            sim,
            { x, y },
            level(),
            live?.playerSpeed ?? snapshot.playerSpeed,
            live?.enemySpeedScale ?? 1,
          )
          sim = result.sim
          attempt.push({ x: sim.x, y: sim.y })
          if (result.events.died) {
            deaths += 1
            hudDirty = true
            const turn = deaths >= 6 ? 0 : deaths >= 3 ? 1 : 2
            chips = [...PLATFORMER_TWEAK_CHIPS.slice(turn), ...PLATFORMER_TWEAK_CHIPS.slice(0, turn)]
            const path = attempt.slice()
            playThump()
            const due = performance.now() + SOUND_LEAD_MS
            holdUntil = due
            pending.push({
              due,
              run: () => {
                ghosts = [...ghosts, { points: path, born: performance.now() }].slice(-FEEL.ghostPaths)
                flashTone = "hurt"
                flashUntil = performance.now() + 180
              },
            })
            attempt = []
          }
          if (result.events.collected.length > 0) {
            hudDirty = true
            if (hintOn) hintOn = false
            playScaleNote()
          }
          if (!beforeAlive && sim.alive) {
            hudDirty = true
            attempt = []
            youUntil = now + FEEL.youMarkMs
            onLifeRef.current?.()
          }
          if (result.events.cleared) {
            playChord()
            const due = performance.now() + SOUND_LEAD_MS
            const lastLevel = levelIndex >= snapshot.levels.length - 1
            const nextIndex = levelIndex + 1
            levelsCleared += 1
            chips = [...PLATFORMER_TWEAK_CHIPS]
            const clearedLevel = levelIndex + 1
            const clearedDeaths = deaths
            pending.push({
              due,
              run: () => {
                flashTone = "clear"
                flashUntil = performance.now() + 280
                if (lastLevel) {
                  clearedAll = true
                  publish()
                }
              },
            })
            setClearCard({
              level: clearedLevel,
              levels: snapshot.levels.length,
              deaths: clearedDeaths,
              action: lastLevel ? "replay" : "next",
            })
            if (lastLevel) {
              skipClearRef.current = () => boot(0, false)
            } else {
              clearTimer = window.setTimeout(() => boot(nextIndex, true), 1600)
              skipClearRef.current = () => boot(nextIndex, true)
            }
          }
          const places = positionsAt(level(), sim.frame, tweaksRef.current?.enemySpeedScale ?? 1)
          places.forEach((place, index) => {
            trails[index] = [...(trails[index] ?? []), place].slice(-FEEL.dotTrailFrames)
          })
        }
        if (hudDirty) publish()
      }

      const dueNow = pending.filter((item) => now >= item.due)
      pending = pending.filter((item) => now < item.due)
      for (const item of dueNow) item.run()
      ghosts = ghosts.filter((ghost) => now - ghost.born < FEEL.ghostFadeMs)

      fit()
      drawFrame(ctx, {
        level: level(),
        sim,
        flips,
        flipStart,
        now,
        trails,
        ghosts,
        flashUntil,
        flashTone,
        holdPlayerUntil: holdUntil,
        playerVisualPx: snapshot.playerVisualPx,
        enemyVisualRadius: snapshot.enemyVisualRadiusPx,
        enemySpeedScale: tweaksRef.current?.enemySpeedScale ?? 1,
        youUntil,
        youPulse: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      })
      stage.dataset.you = now < youUntil ? "1" : "0"
      stage.dataset.enemyScale = String(tweaksRef.current?.enemySpeedScale ?? 1)
      if (!ready) {
        ready = true
        onReadyRef.current()
      }
      raf = window.requestAnimationFrame(loop)
    }

    boot(0, false)
    registerAsk({ onEmptyEnter: () => false, onDismiss: () => {} })
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", onBlur)
    raf = window.requestAnimationFrame(loop)
    return () => {
      window.clearTimeout(clearTimer)
      window.cancelAnimationFrame(raf)
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", onBlur)
    }
  }, [branch, onHud, onReady, registerAsk])

  return (
    <div
      ref={stageRef}
      className="play-stage absolute inset-x-0 top-0 bottom-8 grid place-items-center outline-none"
      tabIndex={-1}
      role="application"
      aria-label={`${branch.title}, arrow keys move`}
      onPointerDown={() => {
        unlockAudio()
        stageRef.current?.focus()
      }}
    >
      <canvas ref={canvasRef} className="board" aria-hidden="true" />
      {clearCard ? (
        <div
          data-shell-control
          className="absolute bottom-16 left-1/2 z-30 w-[min(18rem,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-border bg-card p-4 text-card-foreground"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <p className="text-[20px] leading-6 font-extrabold tracking-tight">
            level {clearCard.level} clear · {clearCard.deaths} deaths
          </p>
          <div className="mt-3 flex gap-1.5" aria-hidden="true">
            {Array.from({ length: clearCard.levels }, (_, index) => (
              <span
                key={index}
                className={`size-2 rounded-full ${index < clearCard.level ? "bg-foreground" : "bg-foreground/25"}`}
              />
            ))}
          </div>
          <Button type="button" variant="game" className="mt-4" onClick={() => skipClearRef.current?.()}>
            {clearCard.action === "replay" ? "replay" : "next"}
          </Button>
        </div>
      ) : null}
      <div className="dpad">
        <Dpad label="up" area="u" x={0} y={-1} touchRef={touchRef} />
        <Dpad label="left" area="l" x={-1} y={0} touchRef={touchRef} />
        <Dpad label="down" area="d" x={0} y={1} touchRef={touchRef} />
        <Dpad label="right" area="r" x={1} y={0} touchRef={touchRef} />
      </div>
    </div>
  )
}

function Dpad({
  label,
  area,
  x,
  y,
  touchRef,
}: {
  label: string
  area: string
  x: number
  y: number
  touchRef: RefObject<{ x: number; y: number }>
}) {
  const release = () => {
    touchRef.current.x = 0
    touchRef.current.y = 0
  }
  const press = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    unlockAudio()
    touchRef.current.x = x
    touchRef.current.y = y
  }
  return (
    <button
      type="button"
      aria-label={label}
      className="dpad-key"
      style={{ gridArea: area }}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
    />
  )
}
