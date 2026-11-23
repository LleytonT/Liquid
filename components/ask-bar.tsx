"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function AskBar({
  chips,
  maxLength,
  placeholder,
  pulse,
  focus,
  onSubmit,
  onEmptyEnter,
  onDismiss,
}: {
  chips: readonly string[]
  maxLength: number
  placeholder: string
  pulse: boolean
  focus: boolean
  onSubmit: (ask: string) => void
  onEmptyEnter: () => void
  onDismiss: () => void
}) {
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (focus) inputRef.current?.focus()
  }, [focus])

  return (
    <form
      data-shell-control
      className={`flex flex-col gap-2 ${pulse ? "ask-pulse" : ""}`}
      onSubmit={(event) => {
        event.preventDefault()
        const ask = value.trim()
        if (!ask) {
          onEmptyEnter()
          return
        }
        if (ask.length > maxLength) return
        onSubmit(ask)
      }}
    >
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="ask">
          {placeholder}
        </label>
        <Input
          ref={inputRef}
          id="ask"
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          autoComplete="off"
          className="h-10 bg-white/80 text-base md:text-sm"
          onChange={(event) => setValue(event.target.value.slice(0, maxLength))}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              inputRef.current?.blur()
              onDismiss()
            }
          }}
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
            onClick={() => setValue(chip.slice(0, maxLength))}
          >
            {chip}
          </Button>
        ))}
      </div>
    </form>
  )
}
