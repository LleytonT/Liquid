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
  busy = false,
  onSubmit,
  onEmptyEnter,
  onDismiss,
  blurb,
}: {
  chips: readonly string[]
  maxLength: number
  placeholder: string
  pulse: boolean
  focus: boolean
  busy?: boolean
  onSubmit: (ask: string) => void
  onEmptyEnter: () => boolean
  onDismiss: () => void
  blurb?: string
}) {
  const [value, setValue] = useState("")
  const [status, setStatus] = useState("")
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
        if (busy) return
        const ask = value.trim()
        if (!ask) {
          if (!onEmptyEnter()) setStatus("describe a twist first")
          return
        }
        setStatus("")
        onSubmit(ask)
        setValue("")
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
          placeholder={placeholder}
          autoComplete="off"
          disabled={busy}
          className="h-10 bg-white/80 text-base md:text-sm"
          onChange={(event) => {
            const next = event.target.value
            if (next.length > maxLength) {
              setValue(next.slice(0, maxLength))
              setStatus(`cut to ${maxLength} characters.`)
              return
            }
            setStatus("")
            setValue(next)
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              inputRef.current?.blur()
              onDismiss()
            }
          }}
        />
        <Button type="submit" className="h-10 px-4" disabled={busy}>
          ask
        </Button>
      </div>
      <p className="text-[12px] leading-4 font-medium text-foreground/70">{value.length}/{maxLength}</p>
      {status ? (
        <p className="text-[12px] leading-4 font-medium text-foreground" role="status">
          {status}
        </p>
      ) : null}
      {blurb ? <p className="text-[12px] leading-4 font-medium text-foreground/70">{blurb}</p> : null}
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <Button
            key={chip}
            type="button"
            variant="outline"
            size="sm"
            className="bg-white/70"
            onClick={() => {
              setStatus("")
              setValue(chip.slice(0, maxLength))
            }}
          >
            {chip}
          </Button>
        ))}
      </div>
    </form>
  )
}
