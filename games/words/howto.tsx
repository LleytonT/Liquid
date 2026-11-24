"use client"

import { useEffect, useState } from "react"
import type { HowToVisualProps } from "@/lib/shell/game-module"

const WORD = "crane"

export function GuessStep({ reducedMotion }: HowToVisualProps) {
  const [count, setCount] = useState(reducedMotion ? WORD.length : 0)

  useEffect(() => {
    if (reducedMotion) return
    const timer = window.setInterval(() => {
      setCount((current) => (current >= WORD.length ? 0 : current + 1))
    }, 280)
    return () => window.clearInterval(timer)
  }, [reducedMotion])

  return (
    <div className="grid h-full place-items-center" aria-hidden="true">
      <div className="lw-row">
        {WORD.split("").map((letter, index) => (
          <div
            key={`${letter}-${index}`}
            className={`lw-tile ${index < count ? "flip" : ""}`}
            style={{ width: 44, height: 44, fontSize: 22 }}
          >
            {index < count ? letter : ""}
          </div>
        ))}
      </div>
    </div>
  )
}

const SAMPLE = [
  { letter: "s", mark: "correct", label: "right spot" },
  { letter: "t", mark: "", label: "" },
  { letter: "o", mark: "present", label: "wrong spot" },
  { letter: "n", mark: "", label: "" },
  { letter: "e", mark: "absent", label: "not in word" },
]

export function StatesStep({ reducedMotion }: HowToVisualProps) {
  const [count, setCount] = useState(SAMPLE.length)
  const [flipping, setFlipping] = useState(false)

  useEffect(() => {
    if (reducedMotion) return
    let timer = 0
    const play = () => {
      setFlipping(true)
      setCount(0)
      let shown = 0
      const step = () => {
        shown += 1
        setCount(shown)
        timer = window.setTimeout(shown < SAMPLE.length ? step : play, shown < SAMPLE.length ? 280 : 1800)
      }
      timer = window.setTimeout(step, 280)
    }
    timer = window.setTimeout(play, 1800)
    return () => window.clearTimeout(timer)
  }, [reducedMotion])

  return (
    <div className="grid h-full place-items-center" data-howto-states>
      <div className="lw-row">
        {SAMPLE.map((cell, index) => {
          const shown = index < count
          return (
            <div key={cell.letter} className="flex w-11 flex-col items-center gap-1">
              <div
                data-mark={shown ? cell.mark || "empty" : "empty"}
                className={`lw-tile ${shown ? cell.mark : ""} ${flipping && shown && cell.mark ? "flip" : ""}`}
                style={{ width: 44, height: 44, fontSize: 22 }}
              >
                {shown ? cell.letter : ""}
              </div>
              <span className="h-4 text-center text-[10px] leading-3 font-bold text-foreground/80">
                {shown ? cell.label : ""}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
