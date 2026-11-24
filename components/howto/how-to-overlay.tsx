"use client"

import { useState, useSyncExternalStore, type KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDismiss, DialogTitle } from "@/components/ui/dialog"
import { howToVisuals } from "@/games/howto"
import type { HowToStep } from "@/lib/shell/game-module"

function useReducedMotion() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)")
      media.addEventListener("change", onStoreChange)
      return () => media.removeEventListener("change", onStoreChange)
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  )
}

export function HowToOverlay({
  open,
  gameId,
  steps,
  note,
  onClose,
}: {
  open: boolean
  gameId: string
  steps: readonly HowToStep[]
  note: string | null
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const reducedMotion = useReducedMotion()

  const step = steps[index]
  const last = index >= steps.length - 1
  const Visual = step ? howToVisuals[gameId]?.[step.id] : undefined

  const advance = () => {
    if (last) onClose()
    else setIndex((current) => current + 1)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " " && event.key !== "ArrowRight") return
    if ((event.key === "Enter" || event.key === " ") && event.target instanceof HTMLButtonElement) return
    event.preventDefault()
    advance()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent data-howto={gameId} data-howto-step={step?.id ?? ""} onKeyDown={onKeyDown}>
        <div className="flex items-start justify-between gap-3">
          <DialogTitle className="label text-[12px] font-bold">how to play</DialogTitle>
          <DialogDismiss />
        </div>
        <div className="mt-3 h-[120px] overflow-hidden">{Visual ? <Visual reducedMotion={reducedMotion} /> : null}</div>
        {step?.copy ? (
          <p className="mt-4 text-[16px] leading-6 font-medium" aria-live="polite">
            {step.copy}
          </p>
        ) : null}
        {note && index === 0 ? <p className="mt-2 text-[14px] leading-5 font-medium">{note}</p> : null}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden="true">
            {steps.map((item, dot) => (
              <span
                key={item.id}
                className={`size-1.5 rounded-full ${dot === index ? "bg-foreground" : "bg-foreground/25"}`}
              />
            ))}
          </div>
          <Button type="button" className="h-11 px-4" onClick={advance}>
            {last ? "play" : "next"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
