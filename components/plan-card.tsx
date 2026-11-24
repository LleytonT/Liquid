"use client"

import { Button } from "@/components/ui/button"

export function PlanCard({
  ask,
  onClose,
  kept = false,
}: {
  ask: string
  onClose: () => void
  kept?: boolean
}) {
  return (
    <div
      data-shell-control
      className="min-w-0 overflow-hidden rounded-2xl border border-[rgba(26,26,46,0.12)] bg-white/90 p-4 shadow-[2px_2px_0_rgba(26,26,46,0.18)]"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="label text-sm">plan</p>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          close
        </Button>
      </div>
      <p className="mt-2 max-w-full text-sm leading-6 break-words [overflow-wrap:anywhere]">{ask}</p>
      <ul className="label mt-3 space-y-1 text-sm text-[#3c3a55]">
        {kept ? <li>kept on this branch</li> : null}
        <li>nothing runs yet</li>
      </ul>
    </div>
  )
}
