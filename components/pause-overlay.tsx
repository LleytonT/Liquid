"use client"

import { AskBar } from "@/components/ask-bar"
import { PlanCard } from "@/components/plan-card"
import type { PendingPlan } from "@/components/pending-plan"
import { Button } from "@/components/ui/button"

export function PauseOverlay({
  chips,
  placeholder,
  maxLength,
  note,
  busy,
  error,
  plan,
  onSubmit,
  onAccept,
  onReject,
  onClosePlan,
  onEmptyEnter,
  onHowTo,
  onResume,
}: {
  chips: readonly string[]
  placeholder: string
  maxLength: number
  note?: string
  busy: boolean
  error: string | null
  plan: PendingPlan | null
  onSubmit: (ask: string) => void
  onAccept: () => void
  onReject: () => void
  onClosePlan: () => void
  onEmptyEnter: () => boolean
  onHowTo: () => void
  onResume: () => void
}) {
  const showAsk = !plan || plan.route === "clarify"
  return (
    <div
      data-pause-overlay
      data-shell-control
      className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-background/95 p-6"
    >
      <div className="grid w-full max-w-md gap-4">
        <div>
          <p className="text-[28px] leading-none font-extrabold tracking-tight">paused</p>
          <p className="mt-2 text-[14px] leading-5 font-medium text-foreground/75">
            the game is stopped. ask for a twist, or resume.
          </p>
        </div>
        {plan ? (
          <PlanCard plan={plan} busy={busy} onAccept={onAccept} onReject={onReject} onClose={onClosePlan} />
        ) : null}
        {showAsk ? (
          <AskBar
            chips={chips}
            maxLength={maxLength}
            placeholder={placeholder}
            pulse={false}
            focus={!plan}
            busy={busy}
            onSubmit={onSubmit}
            onEmptyEnter={onEmptyEnter}
            onDismiss={onResume}
            blurb={note}
          />
        ) : null}
        {busy ? <p className="text-[14px] font-medium">reading your ask...</p> : null}
        {error ? (
          <p data-ask-result className="text-[14px] leading-5 font-medium" role="status">
            {error}
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
