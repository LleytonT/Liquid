"use client"

import type { PendingPlan } from "@/components/pending-plan"
import { Button } from "@/components/ui/button"

export function PlanCard({
  plan,
  busy,
  onAccept,
  onReject,
  onClose,
}: {
  plan: PendingPlan
  busy: boolean
  onAccept: () => void
  onReject: () => void
  onClose: () => void
}) {
  const clarify = plan.route === "clarify"
  return (
    <div
      data-plan-card
      data-route={plan.route}
      data-shell-control
      className="min-w-0 overflow-hidden rounded-2xl border border-[rgba(26,26,46,0.12)] bg-white/90 p-4 shadow-[2px_2px_0_rgba(26,26,46,0.18)]"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="label text-sm">{clarify ? "one question" : "plan"}</p>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          close
        </Button>
      </div>
      {clarify ? (
        <p data-plan-question className="mt-2 text-sm leading-6">
          {plan.question ?? plan.summary}
        </p>
      ) : (
        <p data-plan-summary className="mt-2 text-sm leading-6 break-words [overflow-wrap:anywhere]">
          {plan.summary}
        </p>
      )}
      <p data-plan-confidence className="label mt-2 text-sm text-[#3c3a55]">
        confidence {plan.confidence.toFixed(2)}
      </p>
      {plan.warning ? (
        <p data-store-warning className="mt-2 text-sm leading-5">
          {plan.warning}
        </p>
      ) : null}
      <p className="mt-2 text-sm leading-5 text-[#3c3a55]">
        {clarify ? "nothing was created. answer in the box below." : "nothing is applied until you accept."}
      </p>
      {clarify ? null : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" data-accept-plan disabled={busy || !plan.branchId} onClick={onAccept}>
            accept
          </Button>
          <Button type="button" variant="outline" data-reject-plan disabled={busy || !plan.branchId} onClick={onReject}>
            not this
          </Button>
        </div>
      )}
    </div>
  )
}
