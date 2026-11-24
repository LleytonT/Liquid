"use client"

import Link from "next/link"
import { BranchBrowser } from "@/components/branch-browser"
import { Atmosphere } from "@/lib/shell/atmosphere"

export function ShelfScreen() {
  return (
    <Atmosphere className="theme-shell">
      <header className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="text-[14px] font-bold tracking-tight">
          liquid
        </Link>
        <p className="label text-[12px] font-bold">shelf</p>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 pb-12">
        <h1 className="text-[28px] font-extrabold tracking-tight">games on the shelf</h1>
        <BranchBrowser />
      </main>
    </Atmosphere>
  )
}
