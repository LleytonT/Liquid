"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function AskBar({
  chips,
  onSubmit,
}: {
  chips: readonly string[]
  onSubmit: (ask: string) => void
}) {
  const [value, setValue] = useState("")

  return (
    <form
      data-shell-control
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        const ask = value.trim()
        if (!ask) return
        onSubmit(ask)
      }}
    >
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="ask">
          what should change?
        </label>
        <Input
          id="ask"
          value={value}
          placeholder="what should change?"
          autoComplete="off"
          className="h-10 bg-white/80 text-base md:text-sm"
          onChange={(event) => setValue(event.target.value)}
        />
        <Button type="submit" className="h-10 px-4">
          ask
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <Button
            key={chip}
            type="button"
            variant="outline"
            size="sm"
            className="bg-white/70"
            onClick={() => setValue(chip)}
          >
            {chip}
          </Button>
        ))}
      </div>
    </form>
  )
}
