import type { ReactNode } from "react"
import type { GameTheme } from "@/lib/shell/game-module"

export function Atmosphere({ children, theme }: { children: ReactNode; theme?: GameTheme }) {
  return (
    <div
      className="atmosphere relative min-h-dvh"
      style={theme ? { background: theme.background, color: theme.foreground } : undefined}
    >
      <div className="grain" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" style={theme ? { background: theme.vignette } : undefined} />
      <div className="relative z-10 flex min-h-dvh flex-col">{children}</div>
    </div>
  )
}
