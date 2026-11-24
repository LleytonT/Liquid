"use client"

import { useEffect, useState, useSyncExternalStore, type MouseEvent } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { PreviewMode } from "@/games/previews"

const GamePreview = dynamic(() => import("@/games/previews").then((mod) => mod.GamePreview), {
  ssr: false,
})

export type LandingCard = {
  id: string
  title: string
  summary: string
  href: string
  themeClass: string
}

function useReducedMotion() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)")
      media.addEventListener("change", onStoreChange)
      return () => media.removeEventListener("change", onStoreChange)
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  )
}

function RemixTree() {
  return (
    <svg viewBox="0 0 128 96" className="h-20 w-32" aria-hidden="true">
      <path d="M24 6 v84" stroke="currentColor" strokeWidth="3" fill="none" />
      <path d="M24 34 h26 l14 14 h40" stroke="#7A5CFF" strokeWidth="2.5" fill="none" />
      <path
        d="M24 58 h18 l12 12 h28"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="3 3"
        fill="none"
        opacity="0.7"
      />
      <circle cx="24" cy="18" r="4.5" fill="currentColor" />
      <circle cx="24" cy="34" r="4.5" fill="#7A5CFF" />
      <circle cx="104" cy="48" r="4.5" fill="#7A5CFF" />
      <circle cx="82" cy="70" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function PlayCard({ card }: { card: LandingCard }) {
  const router = useRouter()
  const reduced = useReducedMotion()
  const [hover, setHover] = useState(false)
  const [visible, setVisible] = useState(false)
  const [node, setNode] = useState<HTMLAnchorElement | null>(null)

  useEffect(() => {
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.2 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])

  const mode: PreviewMode = reduced ? "static" : !visible ? "paused" : hover ? "full" : "muted"

  const depart = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    const root = document.documentElement
    root.classList.remove("theme-shell")
    for (const name of root.dataset.liquidThemes?.split(" ") ?? []) root.classList.remove(name)
    root.classList.add(card.themeClass)
    const skip = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    window.setTimeout(() => router.push(card.href), skip ? 0 : 200)
  }

  return (
    <Link
      ref={setNode}
      href={card.href}
      data-play-card={card.id}
      className={`play-card ${card.themeClass} flex flex-col rounded-xl border border-border bg-card p-4 text-card-foreground`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onClick={depart}
    >
      <div className="relative h-[120px] overflow-hidden rounded-lg bg-muted">
        <GamePreview gameId={card.id} mode={mode} />
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] leading-6 font-extrabold tracking-tight">{card.title}</h2>
          <p className="mt-1 text-[14px] leading-5 font-medium text-foreground/75">{card.summary}</p>
        </div>
        <span className="label shrink-0 text-[12px] font-bold">play</span>
      </div>
    </Link>
  )
}

const STEPS = [
  { id: "play", body: "open a branch. anyone can play." },
  { id: "prompt", body: "ask in plain words." },
  { id: "remix", body: "each version shows on the remix tree." },
]

export function Landing({ cards }: { cards: readonly LandingCard[] }) {
  const themeKey = cards.map((card) => card.themeClass).join(" ")

  useEffect(() => {
    const root = document.documentElement
    const themes = themeKey.split(" ").filter(Boolean)
    root.dataset.liquidThemes = themeKey
    for (const name of themes) root.classList.remove(name)
    root.classList.add("theme-shell")
    return () => root.classList.remove("theme-shell")
  }, [themeKey])

  return (
    <main className="theme-shell mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-6 py-8 sm:py-12">
      <header className="max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <p className="label text-[12px] font-bold text-muted-foreground">liquid games</p>
          <Link href="/shelf" data-shelf className="label text-[12px] font-bold underline">
            shelf
          </Link>
        </div>
        <h1 className="mt-3 text-[40px] leading-none font-extrabold tracking-tight">liquid</h1>
        <p className="mt-4 text-[16px] leading-6 font-medium">
          small games you play, then change by asking. every change becomes a new version anyone can play.
        </p>
      </header>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-6">
        {cards.map((card) => (
          <PlayCard key={card.id} card={card} />
        ))}
      </div>
      <section aria-label="how remixing works" className="mt-8 grid items-end gap-6 sm:mt-10 lg:grid-cols-[1fr_auto]">
        <div>
          <h2 className="label text-[12px] font-bold">how remixing works</h2>
          <ol className="mt-3 grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.id}>
                <p className="label text-[12px] font-bold">
                  {index + 1} {step.id}
                </p>
                <p className="mt-1 text-[14px] leading-5 font-medium text-foreground/75">{step.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[14px] leading-5 font-medium text-foreground/75">
            a merge waits for the owner and a play-test.
          </p>
        </div>
        <figure>
          <RemixTree />
          <figcaption className="label mt-1 text-[12px] font-bold text-muted-foreground">remix tree</figcaption>
        </figure>
      </section>
    </main>
  )
}
