"use client"

import { Toaster as Sonner } from "sonner"
import "sonner/dist/styles.css"

function Toaster() {
  return (
    <Sonner
      position="top-center"
      duration={1200}
      toastOptions={{
        style: {
          background: "var(--card)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          fontFamily: "inherit",
        },
      }}
    />
  )
}

export { Toaster }
