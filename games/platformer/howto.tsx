"use client"

import { useEffect, useRef } from "react"
import type { HowToVisualProps } from "@/lib/shell/game-module"
import { drawCoinSprite, drawEnemySprite, drawPlayerSprite, drawSafeSprite } from "@/games/platformer/draw"

const ARROWS = ["↑", "←", "↓", "→"]
const WASD = ["w", "a", "s", "d"]

function useCanvas(draw: (ctx: CanvasRenderingContext2D, width: number, now: number) => void, reducedMotion: boolean) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef(draw)

  useEffect(() => {
    drawRef.current = draw
  }, [draw])

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    let raf = 0

    const paint = (now: number) => {
      const width = canvas.clientWidth || 312
      const height = canvas.clientHeight || 72
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const bufferW = Math.max(1, Math.round(width * dpr))
      const bufferH = Math.max(1, Math.round(height * dpr))
      if (canvas.width !== bufferW || canvas.height !== bufferH) {
        canvas.width = bufferW
        canvas.height = bufferH
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      drawRef.current(ctx, width, reducedMotion ? 0 : now)
      if (!reducedMotion) raf = window.requestAnimationFrame(paint)
    }

    raf = window.requestAnimationFrame(paint)
    return () => window.cancelAnimationFrame(raf)
  }, [reducedMotion])

  return ref
}

function Keycaps({ reducedMotion }: HowToVisualProps) {
  const indexRef = useRef(0)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const row = rowRef.current
    if (!row || reducedMotion) return
    const caps = Array.from(row.querySelectorAll<HTMLElement>("[data-keycap]"))
    const tick = () => {
      caps.forEach((cap, index) => {
        cap.dataset.pressed = index === indexRef.current ? "true" : "false"
      })
      indexRef.current = (indexRef.current + 1) % caps.length
    }
    tick()
    const timer = window.setInterval(tick, 280)
    return () => window.clearInterval(timer)
  }, [reducedMotion])

  return (
    <div ref={rowRef} className="flex items-center justify-center gap-4" aria-hidden="true">
      <div className="flex gap-1">
        {ARROWS.map((label) => (
          <span key={label} data-keycap className="keycap">
            {label}
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        {WASD.map((label) => (
          <span key={label} data-keycap className="keycap">
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function MoveStep({ reducedMotion }: HowToVisualProps) {
  const ref = useCanvas((ctx, width, now) => {
    const travel = reducedMotion ? 0.5 : (Math.sin(now / 280) + 1) / 2
    const x = 36 + travel * Math.max(40, width - 72)
    drawPlayerSprite(ctx, x, 36, 28)
  }, reducedMotion)

  return (
    <div className="flex h-full flex-col justify-between">
      <canvas ref={ref} className="h-[72px] w-full" aria-hidden="true" />
      <Keycaps reducedMotion={reducedMotion} />
    </div>
  )
}

export function DodgeStep({ reducedMotion }: HowToVisualProps) {
  const ref = useCanvas((ctx, width, now) => {
    const travel = reducedMotion ? 0.2 : (now % 1400) / 1400
    drawPlayerSprite(ctx, width / 2, 36, 28)
    drawEnemySprite(ctx, 24 + travel * Math.max(40, width - 48), 36, 8)
  }, reducedMotion)
  return <canvas ref={ref} className="h-full w-full" aria-hidden="true" />
}

export function GoalStep({ reducedMotion }: HowToVisualProps) {
  const ref = useCanvas((ctx, width, now) => {
    const coinX = width * 0.46
    const goalX = width * 0.78
    const cycle = reducedMotion ? 0.7 : (now % 2400) / 2400
    const x = cycle < 0.45 ? 36 + (coinX - 36) * (cycle / 0.45) : coinX + (goalX - coinX) * ((cycle - 0.45) / 0.55)
    drawSafeSprite(ctx, goalX, 36, 32)
    if (cycle < 0.45) drawCoinSprite(ctx, coinX, 36, 10)
    drawPlayerSprite(ctx, x, 36, 26)
  }, reducedMotion)
  return <canvas ref={ref} className="h-full w-full" aria-hidden="true" />
}
