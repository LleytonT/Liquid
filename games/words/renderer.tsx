"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { toast } from "sonner"
import type { GameRendererProps } from "@/lib/shell/game-module"
import { Button } from "@/components/ui/button"
import { playBlip, playScaleNote, SOUND_LEAD_MS, unlockAudio } from "@/lib/shell/audio"
import { isShellControl } from "@/lib/shell/input"
import { feedback, guessPoints, hardModeAllows, type GradedGuess, type Mark } from "@/games/words/rules"
import lists from "@/games/words/lists.json"
import { wordsCopy } from "@/games/words/copy"
import { pickAnswer, prepareWords, type WordsSnapshot } from "@/games/words/validate"

const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"]
const CHIPS = ["turn on hard mode", "fewer guesses", "rarer words"] as const
const COMMON = lists.bands.common

function playMark(mark: Mark) {
  if (mark === "correct") playScaleNote()
  else if (mark === "present") playBlip({ frequency: 196, type: "triangle", duration: 0.09, gain: 0.08, slideTo: 98 })
  else playBlip({ frequency: 110, type: "sine", duration: 0.12, gain: 0.05, slideTo: 70 })
}

function playWood() {
  playBlip({ frequency: 740, type: "triangle", duration: 0.045, gain: 0.06 })
}

function remember(word: string) {
  window.sessionStorage.setItem("lw-secret", word)
}

function firstSecret(snapshot: WordsSnapshot): string {
  const stored = window.sessionStorage.getItem("lw-secret")
  if (stored && COMMON.includes(stored)) return stored
  const word = pickAnswer(snapshot, 0, new Set(), Math.random())
  remember(word)
  return word
}

export function WordsRenderer({ branch, onHud, onReady, registerAsk, paused = false }: GameRendererProps) {
  const snapshot = useMemo(() => prepareWords(branch), [branch])
  const valid = useRef(new Set(snapshot.lists.valid))
  const answer0 = useSyncExternalStore(
    () => () => {},
    () => firstSecret(snapshot),
    () => COMMON[0],
  )
  const [round, setRound] = useState(0)
  const [used, setUsed] = useState<string[]>([])
  const [answer, setAnswer] = useState(answer0)
  const [draft, setDraft] = useState("")
  const [rows, setRows] = useState<GradedGuess[]>([])
  if (round === 0 && rows.length === 0 && answer !== answer0) setAnswer(answer0)
  const [phase, setPhase] = useState<"play" | "reveal" | "ended">("play")
  const [shown, setShown] = useState(0)
  const [shake, setShake] = useState(false)
  const [note, setNote] = useState("")
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [won, setWon] = useState(false)
  const [stats, setStats] = useState("")
  const [askOpen, setAskOpen] = useState(false)
  const [pop, setPop] = useState("")
  const [poster, setPoster] = useState(false)
  const [hintOn, setHintOn] = useState(true)
  const ready = useRef(false)
  const pausedRef = useRef(paused)
  const actions = useRef<{ submit: () => void; type: (letter: string) => void }>({
    submit: () => {},
    type: () => {},
  })

  const begin = (nextRound: number, already: string[], word: string) => {
    setRound(nextRound)
    setUsed(already)
    setAnswer(word)
    remember(word)
    setDraft("")
    setRows([])
    setPhase("play")
    setShown(0)
    setWon(false)
    setStats("")
    setNote("")
    setAskOpen(false)
    setPoster(false)
    setShake(false)
  }

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    if (ready.current) return
    ready.current = true
    onReady()
  }, [onReady])

  useEffect(() => {
    registerAsk({
      onEmptyEnter: () => {
        if (phase !== "ended") return
        const next = round + 1
        const word = pickAnswer(snapshot, next, new Set([...used, answer]), Math.random())
        begin(next, [...used, answer], word)
      },
      onDismiss: () => {
        if (phase !== "ended") setAskOpen(false)
      },
    })
  }, [registerAsk, phase, round, used, answer, snapshot])

  useEffect(() => {
    const pulsing = phase === "ended"
    onHud({
      metrics: [
        { id: "round", label: "round", value: String(round + 1) },
        { id: "streak", label: "streak", value: String(streak) },
        { id: "score", label: "score", value: String(score) },
      ],
      status: snapshot.hardMode ? "hard mode" : null,
      hint: hintOn ? wordsCopy.firstRunHint : null,
      ask: {
        visible: phase === "ended" || askOpen,
        focus: phase === "ended" || askOpen,
        pulse: pulsing,
        placeholder: wordsCopy.askPlaceholder,
        maxLength: 140,
        chips: pulsing ? [wordsCopy.pulseChip, ...CHIPS] : CHIPS,
      },
    })
  }, [onHud, score, streak, phase, askOpen, snapshot.hardMode, hintOn, round])

  useEffect(() => {
    if (phase !== "reveal") return
    const last = rows[rows.length - 1]
    if (!last) return
    const timers: number[] = []
    last.marks.forEach((mark, index) => {
      timers.push(window.setTimeout(() => playMark(mark), Math.max(0, index * snapshot.staggerMs - SOUND_LEAD_MS)))
      timers.push(window.setTimeout(() => setShown(index + 1), index * snapshot.staggerMs))
    })
    const finished = (last.marks.length - 1) * snapshot.staggerMs + snapshot.tileFlipMs
    timers.push(
      window.setTimeout(() => {
        const success = last.marks.every((mark) => mark === "correct")
        const lost = !success && rows.length >= snapshot.guesses
        if (!success && !lost) {
          setPhase("play")
          setShown(0)
          return
        }
        if (success) {
          setStreak((current) => {
            const nextStreak = current + 1
            const points = guessPoints(rows.length, snapshot.guesses)
            setScore((total) => total + points + 5 * nextStreak)
            setStats(`${rows.length}/${snapshot.guesses} · +${points} · streak ${nextStreak}`)
            return nextStreak
          })
          setWon(true)
        } else {
          setStreak(0)
          setWon(false)
          setStats(`x/${snapshot.guesses} · +0 · streak 0`)
        }
        setPoster(true)
        toast.custom(
          () => <div className="answer-pill">{answer}</div>,
          { duration: 1200, unstyled: true },
        )
        timers.push(window.setTimeout(() => setPhase("ended"), snapshot.roundEndMs))
      }, finished),
    )
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [phase, rows, snapshot, answer])

  const typeLetter = useCallback((letter: string) => {
    if (pausedRef.current || phase !== "play" || draft.length >= snapshot.length) return
    unlockAudio()
    playWood()
    setPop(letter)
    window.setTimeout(() => setPop(""), 60)
    setDraft((current) => (current.length >= snapshot.length ? current : current + letter))
    setNote("")
  }, [phase, draft.length, snapshot.length])

  const submit = useCallback(() => {
    if (pausedRef.current) return
    if (phase !== "play" || draft.length !== snapshot.length) return
    setHintOn(false)
    if (!valid.current.has(draft)) {
      toast("not in word list", { duration: 1200 })
      setShake(true)
      window.setTimeout(() => setShake(false), snapshot.shakeMs)
      return
    }
    if (snapshot.hardMode && !hardModeAllows(draft, rows)) {
      setNote("use the revealed hints")
      setShake(true)
      window.setTimeout(() => setShake(false), snapshot.shakeMs)
      return
    }
    setRows((current) => [...current, { guess: draft, marks: feedback(draft, answer) }])
    setDraft("")
    setShown(0)
    setPhase("reveal")
  }, [phase, draft, answer, rows, snapshot])

  useEffect(() => {
    actions.current = { submit, type: typeLetter }
  }, [submit, typeLetter])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (pausedRef.current) return
      if (event.key === "/" && !isShellControl(document.activeElement)) {
        event.preventDefault()
        unlockAudio()
        setAskOpen(true)
        return
      }
      if (isShellControl(event.target) || isShellControl(document.activeElement)) return
      if (event.key === "Enter") {
        event.preventDefault()
        actions.current.submit()
      } else if (event.key === "Backspace") {
        event.preventDefault()
        setDraft((current) => current.slice(0, -1))
      } else if (/^[a-zA-Z]$/.test(event.key)) {
        event.preventDefault()
        actions.current.type(event.key.toLowerCase())
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const best = new Map<string, Mark>()
  for (const row of rows) {
    row.guess.split("").forEach((letter, index) => {
      const mark = row.marks[index]
      const previous = best.get(letter)
      if (!previous || mark === "correct" || (mark === "present" && previous !== "correct")) best.set(letter, mark)
    })
  }

  const showingDraft = phase === "play"
  const emptyRows = Math.max(0, snapshot.guesses - rows.length - (showingDraft ? 1 : 0))
  const winRow = won && poster

  return (
    <div className="lw">
      <p className="lw-note label" role="status">
        {note}
      </p>
      <div className="lw-board" aria-label="board">
        {rows.map((row, rowIndex) => {
          const live = rowIndex === rows.length - 1 && phase === "reveal"
          const celebrate = winRow && row.marks.every((item) => item === "correct")
          return (
            <div className="lw-row" key={`${row.guess}-${rowIndex}`}>
              {row.guess.split("").map((letter, index) => {
                const visible = !live || index < shown
                const mark = visible ? row.marks[index] : ""
                return (
                  <div
                    key={index}
                    data-mark={mark || "pending"}
                    className={`lw-tile ${mark} ${visible && live ? "flip" : ""} ${celebrate ? "win" : ""}`}
                    style={{ animationDelay: `${index * (celebrate ? 70 : snapshot.staggerMs)}ms` }}
                  >
                    {letter}
                  </div>
                )
              })}
            </div>
          )
        })}
        {showingDraft ? (
          <div className={`lw-row ${shake ? "shake" : ""}`}>
            {Array.from({ length: snapshot.length }, (_, index) => (
              <div key={index} className="lw-tile" data-mark="empty">
                {draft[index] ?? ""}
              </div>
            ))}
          </div>
        ) : null}
        {Array.from({ length: emptyRows }, (_, index) => (
          <div className="lw-row" key={`empty-${index}`}>
            {Array.from({ length: snapshot.length }, (_, cell) => (
              <div key={cell} className="lw-tile" data-mark="empty" />
            ))}
          </div>
        ))}
      </div>
      {poster ? (
        <p className="tabular text-[14px] font-bold">{stats}</p>
      ) : (
        <div className="lw-keys">
          {KEY_ROWS.map((row, rowIndex) => (
            <div className="lw-keyrow" key={row}>
              {rowIndex === 2 ? (
                <Button type="button" variant="game" className="lw-key wide" onClick={submit}>
                  enter
                </Button>
              ) : null}
              {row.split("").map((letter) => (
                <Button
                  key={letter}
                  type="button"
                  variant="game"
                  data-mark={best.get(letter) ?? "empty"}
                  className={`lw-key ${best.get(letter) ?? ""} ${pop === letter ? "pop" : ""}`}
                  onClick={() => typeLetter(letter)}
                >
                  {letter}
                </Button>
              ))}
              {rowIndex === 2 ? (
                <Button
                  type="button"
                  variant="game"
                  className="lw-key wide"
                  onClick={() => setDraft((current) => current.slice(0, -1))}
                >
                  delete
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
