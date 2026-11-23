import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Inter_Tight } from "next/font/google"
import "./globals.css"

const interTight = Inter_Tight({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter-tight",
})

export const metadata: Metadata = {
  title: "liquid",
  description: "A shelf of small games. Play starts immediately.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${interTight.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
