"use client"

import { useEffect, useRef } from "react"
import { drawFrame } from "@/games/platformer/draw"
import { LOCKED } from "@/games/platformer/locked"
import { buildLevel, createSim, type LevelDef } from "@/games/platformer/runtime"

export type PreviewMode = "static" | "paused" | "muted" | "full"

const WORLD_W = LOCKED.cols * LOCKED.tilePx
const WORLD_H = LOCKED.rows * LOCKED.tilePx

const PREVIEW_LEVEL: LevelDef = {
  id: "preview",
  name: "preview",
  grid: [
    "####################",
    "#..................#",
    "#..................#",
    "#........CC........#",
    "#........CC........#",
    "#..................#",
    "#SS................#",
    "#SS................#",
    "#..................#",
    "#..................#",
    "#..................#",
    "#..................#",
    "####################",
  ],
  coins: [{ col: 10, row: 3 }],
  enemies: [
    {
      id: "drift",
      speed: 90,
      phase: 0,
      mode: "pingpong",
      points: [
        { x: 4, y: 6.5 },
        { x: 16, y: 6.5 },
      ],
    },
    {
      id: "cross",
      speed: 70,
      phase: 40,
      mode: "pingpong",
      points: [
        { x: 8, y: 3.5 },
        { x: 8, y: 9.5 },
      ],
    },
  ],
}

function PlatformerLoop({ mode }: { mode: PreviewMode }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modeRef = useRef(mode)
  const frame = useRef(48)

  useEffect(() => {
    modeRef.current = mode
    const canvas = canvasRef.current
    const stage = stageRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !stage || !ctx) return

    const level = buildLevel(PREVIEW_LEVEL, 12)
    const sim = createSim(level)
    let raf = 0

    const draw = () => {
      const rect = stage.getBoundingClientRect()
      if (rect.width < 2 || rect.height < 2) return
      const scale = Math.max(rect.width / WORLD_W, rect.height / WORLD_H)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const bufferW = Math.max(1, Math.round(rect.width * dpr))
      const bufferH = Math.max(1, Math.round(rect.height * dpr))
      if (canvas.width !== bufferW || canvas.height !== bufferH) {
        canvas.width = bufferW
        canvas.height = bufferH
        canvas.style.width = `${rect.width}px`
        canvas.style.height = `${rect.height}px`
      }
      const offsetX = (rect.width - WORLD_W * scale) / 2
      const offsetY = (rect.height - WORLD_H * scale) / 2
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, offsetX * dpr, offsetY * dpr)
      sim.frame = Math.floor(frame.current)
      drawFrame(ctx, {
        level,
        sim,
        flips: new Map(),
        flipStart: 0,
        now: frame.current * 16,
        hiddenCoins: level.coins.map(() => false),
        trails: level.enemies.map(() => []),
        ghosts: [],
        flashUntil: 0,
        holdPlayerUntil: 0,
        playerVisualPx: 28,
        enemyVisualRadius: 8,
      })
    }

    const tick = () => {
      const current = modeRef.current
      if (current === "full") frame.current += 1
      else if (current === "muted") frame.current += 0.35
      draw()
      if (current === "static" || current === "paused") return
      raf = window.requestAnimationFrame(tick)
    }

    tick()
    return () => window.cancelAnimationFrame(raf)
  }, [mode])

  return (
    <div ref={stageRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="absolute inset-0" aria-hidden="true" />
    </div>
  )
}

const WORD = "crane"

function WordsLoop({ mode }: { mode: PreviewMode }) {
  const countRef = useRef(mode === "static" ? WORD.length : 0)
  const rowRef = useRef<HTMLDivElement>(null)
  const modeRef = useRef(mode)

  useEffect(() => {
    modeRef.current = mode
    const row = rowRef.current
    if (!row) return
    const tiles = Array.from(row.children) as HTMLElement[]
    let count = modeRef.current === "static" ? WORD.length : countRef.current
    let timer = 0

    const paint = (next: number) => {
      countRef.current = next
      tiles.forEach((tile, index) => {
        const show = index < next
        tile.textContent = show ? WORD[index] : ""
        tile.classList.toggle("flip", show && modeRef.current !== "static")
      })
    }

    const step = () => {
      const current = modeRef.current
      if (current === "static") {
        paint(WORD.length)
        return
      }
      if (current === "paused") return
      count = count >= WORD.length ? 0 : count + 1
      paint(count)
      timer = window.setTimeout(step, current === "full" ? 280 : 720)
    }

    paint(count)
    if (mode !== "static" && mode !== "paused") timer = window.setTimeout(step, mode === "full" ? 280 : 720)
    return () => window.clearTimeout(timer)
  }, [mode])

  return (
    <div className="grid h-full place-items-center">
      <div ref={rowRef} className="lw-row" aria-hidden="true">
        {WORD.split("").map((letter, index) => (
          <div key={letter + index} className="lw-tile" style={{ width: 46, height: 46, fontSize: 22 }}>
            {mode === "static" ? letter : ""}
          </div>
        ))}
      </div>
    </div>
  )
}

export function GamePreview({ gameId, mode }: { gameId: string; mode: PreviewMode }) {
  if (gameId === "platformer") return <PlatformerLoop mode={mode} />
  if (gameId === "words") return <WordsLoop mode={mode} />
  return null
}
