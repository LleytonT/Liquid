"use client"

import { AskBar } from "@/components/ask-bar"
import { Button } from "@/components/ui/button"
import type { AskPlan } from "@/lib/ask/tweak"

export function PauseOverlay({
  chips,
  placeholder,
  maxLength,
  note,
  busy,
  result,
  onSubmit,
  onEmptyEnter,
  onHowTo,
  onResume,
}: {
  chips: readonly string[]
  placeholder: string
  maxLength: number
  note?: string
  busy: boolean
  result: string | null
  onSubmit: (ask: string) => void
  onEmptyEnter: () => boolean
  onHowTo: () => void
  onResume: () => void
}) {
  return (
    <div
      data-pause-overlay
      data-shell-control
      className="absolute inset-0 z-40 flex items-center justify-center bg-background/95 p-6"
    >
      <div className="grid w-full max-w-md gap-4">
        <div>
          <p className="text-[28px] leading-none font-extrabold tracking-tight">paused</p>
          <p className="mt-2 text-[14px] leading-5 font-medium text-foreground/75">
            the game is stopped. ask for a twist, or resume.
          </p>
        </div>
        <AskBar
          chips={chips}
          maxLength={maxLength}
          placeholder={placeholder}
          pulse={false}
          focus
          busy={busy}
          onSubmit={onSubmit}
          onEmptyEnter={onEmptyEnter}
          onDismiss={onResume}
          blurb={note}
        />
        {busy ? <p className="text-[14px] font-medium">reading your ask...</p> : null}
        {result ? (
          <p data-ask-result className="text-[14px] leading-5 font-medium" role="status">
            {result}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onHowTo}>
            how to play
          </Button>
          <Button type="button" onClick={onResume}>
            resume
          </Button>
        </div>
      </div>
    </div>
  )
}

export function askResultCopy(plan: AskPlan, when: string): string {
  if (plan.kind !== "tweak" || !plan.patch) return plan.line
  const via = plan.source === "gateway" ? "the model planned this." : "matched from your words. the model was not used."
  return `${plan.line}. kept in this browser. starts when you ${when}. ${via}`
}
