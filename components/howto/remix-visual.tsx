"use client"

import type { HowToVisualProps } from "@/lib/shell/game-module"

export function RemixVisual({ reducedMotion }: HowToVisualProps) {
  return (
    <svg viewBox="0 0 312 120" className="h-full w-full text-foreground" aria-hidden="true">
      <path d="M48 8 v104" stroke="currentColor" strokeWidth="4" fill="none" />
      <path
        d="M48 46 h46 l22 22 h78"
        stroke="#7A5CFF"
        strokeWidth="3"
        fill="none"
        className={reducedMotion ? undefined : "remix-grow"}
      />
      <circle cx="48" cy="24" r="6" fill="currentColor" />
      <circle cx="48" cy="46" r="6" fill="#7A5CFF" />
      <circle cx="194" cy="68" r="6" fill="#7A5CFF" />
    </svg>
  )
}
