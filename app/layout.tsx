import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Fraunces, Inter_Tight } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const interTight = Inter_Tight({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter-tight",
})

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
})

export const metadata: Metadata = {
  title: "liquid",
  description: "Play a game, ask for a twist, and it becomes a branch on a public remix tree.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${interTight.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
