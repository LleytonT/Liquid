import type { ReactNode } from "react"

export function Atmosphere({ children }: { children: ReactNode }) {
  return (
    <div className="atmosphere relative min-h-dvh">
      <div className="grain" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <div className="relative z-10 flex min-h-dvh flex-col">{children}</div>
    </div>
  )
}
