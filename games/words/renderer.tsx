"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react"
import { toast } from "sonner"
import type { GameRendererProps } from "@/lib/shell/game-module"
import { Button } from "@/components/ui/button"
import { playBlip, playScaleNote, SOUND_LEAD_MS, unlockAudio } from "@/lib/shell/audio"
import { isShellControl } from "@/lib/shell/input"
import { feedback, formatWinLine, guessPoints, hardModeAllows, type GradedGuess, type Mark } from "@/games/words/rules"
import lists from "@/games/words/lists.json"
import { WORDS_TWEAK_CHIPS, wordsCopy } from "@/games/words/copy"
import {
  NOT_ENOUGH_LETTERS,
  NOT_IN_WORD_LIST,
  emptyTyping,
  endReveal,
  pressKey,
  visibleDraft,
  type TypingContext,
  type TypingEvent,
  type TypingState,
} from "@/games/words/typing"
import { pickAnswer, prepareWords, type WordsSnapshot } from "@/games/words/validate"

const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"]
const CHIPS = WORDS_TWEAK_CHIPS
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

export function WordsRenderer({
  branch,
  onHud,
  onReady,
  registerAsk,
  paused = false,
  tweaks,
  onLife,
}: GameRendererProps) {
  const snapshot = useMemo(() => prepareWords(branch), [branch])
  const guesses = tweaks?.guesses ?? snapshot.guesses
  const timerSeconds = tweaks?.timerSeconds ?? snapshot.timerSeconds
  const hardMode = tweaks?.hardMode !== undefined ? tweaks.hardMode >= 1 : snapshot.hardMode
  const onLifeRef = useRef(onLife)
  const roundRef = useRef(0)
  const usedRef = useRef<string[]>([])
  const valid = useRef(new Set(snapshot.lists.valid))
  const answer0 = useSyncExternalStore(
    () => () => {},
    () => firstSecret(snapshot),
    () => COMMON[0],
  )
  const [round, setRound] = useState(0)
  const [used, setUsed] = useState<string[]>([])
  const [answer, setAnswer] = useState(answer0)
  const [rows, setRows] = useState<GradedGuess[]>([])
  if (round === 0 && rows.length === 0 && answer !== answer0) setAnswer(answer0)
  const [typing, setTyping] = useState<TypingState>(emptyTyping)
  const typingRef = useRef(typing)
  const rowsRef = useRef(rows)
  const answerRef = useRef(answer)
  const contextRef = useRef<TypingContext>({ length: snapshot.length, accepts: () => null })
  const beginRef = useRef<(nextRound: number, already: string[], word: string) => void>(() => {})
  const phase = typing.phase
  const draft = visibleDraft(typing, snapshot.length)
  const note = typing.note
  const [shown, setShown] = useState(0)
  const [shake, setShake] = useState(false)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [won, setWon] = useState(false)
  const [stats, setStats] = useState("")
  const [askOpen, setAskOpen] = useState(false)
  const [pop, setPop] = useState("")
  const [poster, setPoster] = useState(false)
  const [hintOn, setHintOn] = useState(true)
  const [timeLeft, setTimeLeft] = useState(snapshot.timerSeconds)
  const timeRef = useRef(snapshot.timerSeconds)
  const expiredRef = useRef(false)
  const wonRef = useRef(false)
  const advanceWinRef = useRef(() => {})
  const ready = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(paused)

  const commitTyping = (next: TypingState) => {
    typingRef.current = next
    setTyping(next)
  }

  const begin = (nextRound: number, already: string[], word: string) => {
    onLifeRef.current?.()
    setRound(nextRound)
    setUsed(already)
    setAnswer(word)
    remember(word)
    commitTyping(emptyTyping())
    timeRef.current = timerSeconds
    expiredRef.current = false
    setTimeLeft(timerSeconds)
    setRows([])
    setShown(0)
    setWon(false)
    setStats("")
    setAskOpen(false)
    setPoster(false)
    setShake(false)
  }

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    rowsRef.current = rows
    answerRef.current = answer
    contextRef.current = {
      length: snapshot.length,
      accepts: (word) => {
        if (!valid.current.has(word)) return NOT_IN_WORD_LIST
        if (hardMode && !hardModeAllows(word, rowsRef.current)) return "use the revealed hints"
        return null
      },
    }
    beginRef.current = begin
    onLifeRef.current = onLife
    roundRef.current = round
    usedRef.current = used
    wonRef.current = won
    advanceWinRef.current = () => {
      if (!wonRef.current) return
      wonRef.current = false
      const next = round + 1
      const word = pickAnswer(snapshot, next, new Set([...used, answer]), Math.random())
      begin(next, [...used, answer], word)
    }
  })

  useEffect(() => {
    if (ready.current) return
    ready.current = true
    onReady()
  }, [onReady])

  useEffect(() => {
    registerAsk({
      onEmptyEnter: () => false,
      onDismiss: () => {
        if (phase !== "ended") setAskOpen(false)
      },
    })
  }, [registerAsk, phase])

  useEffect(() => {
    const pulsing = phase === "ended"
    onHud({
      metrics: [
        { id: "round", label: "round", value: String(round + 1) },
        { id: "streak", label: "streak", value: String(streak) },
        { id: "score", label: "score", value: String(score) },
        ...(timerSeconds > 0 ? [{ id: "time", label: "time", value: `${timeLeft}s` }] : []),
      ],
      status: hardMode ? "hard mode" : null,
      hint: hintOn ? wordsCopy.firstRunHint : null,
      ask: {
        visible: phase === "ended" || askOpen,
        focus: phase === "ended" || askOpen,
        pulse: pulsing,
        placeholder: wordsCopy.askPlaceholder,
        maxLength: 140,
        chips: pulsing ? [wordsCopy.pulseChip, ...CHIPS.filter((chip) => chip !== wordsCopy.pulseChip)] : CHIPS,
      },
    })
  }, [onHud, score, streak, phase, askOpen, hardMode, timerSeconds, timeLeft, hintOn, round])

  useEffect(() => {
    if (paused || timerSeconds <= 0 || phase === "ended") return
    const timer = window.setInterval(() => {
      const next = Math.max(0, timeRef.current - 1)
      timeRef.current = next
      setTimeLeft(next)
      if (next !== 0) return
      if (phase === "reveal") {
        expiredRef.current = true
        return
      }
      expiredRef.current = false
      commitTyping({ ...emptyTyping(), phase: "ended" })
      setStreak(0)
      setWon(false)
      setStats(`x/${guesses} · +0 · streak 0`)
      setPoster(true)
      toast.custom(() => <div className="answer-pill">{answerRef.current}</div>, {
        duration: 1200,
        unstyled: true,
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [paused, phase, round, timerSeconds, guesses])

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
        const lost = !success && (rows.length >= guesses || expiredRef.current)
        if (!success && !lost) {
          const drained = endReveal(typingRef.current, contextRef.current)
          commitTyping(drained.state)
          if (drained.submitted && drained.submitted.length === snapshot.length) {
            const guess = drained.submitted
            setRows((current) => [...current, { guess, marks: feedback(guess, answer) }])
            setShown(0)
          } else if (drained.state.note === NOT_ENOUGH_LETTERS || drained.state.note === NOT_IN_WORD_LIST) {
            toast(drained.state.note, { duration: 1200 })
            setShake(true)
            window.setTimeout(() => setShake(false), snapshot.shakeMs)
          }
          return
        }
        if (success) {
          setStreak((current) => {
            const nextStreak = current + 1
            const points = guessPoints(rows.length, guesses)
            setScore((total) => total + points + 5 * nextStreak)
            setStats(formatWinLine(rows.length, guesses, nextStreak))
            return nextStreak
          })
          setWon(true)
        } else {
          setStreak(0)
          setWon(false)
          setStats(`x/${guesses} · +0 · streak 0`)
        }
        setPoster(true)
        toast.custom(
          () => <div className="answer-pill">{answer}</div>,
          { duration: 1200, unstyled: true },
        )
        commitTyping({ ...typingRef.current, buffer: [], draft: "", note: "" })
        timers.push(window.setTimeout(() => commitTyping({ ...emptyTyping(), phase: "ended" }), snapshot.roundEndMs))
      }, finished),
    )
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [phase, rows, snapshot, answer, guesses])

  const scoreGuess = useCallback((guess: string) => {
    if (guess.length !== snapshot.length) return
    setHintOn(false)
    setRows((current) => [...current, { guess, marks: feedback(guess, answerRef.current) }])
    setShown(0)
  }, [snapshot.length])

  const applyKey = useCallback((event: TypingEvent) => {
    if (pausedRef.current || typingRef.current.phase === "ended") return
    const before = typingRef.current
    if (event.type === "letter") {
      unlockAudio()
      playWood()
      setPop(event.letter)
      window.setTimeout(() => setPop(""), 60)
      setHintOn(false)
    }
    const result = pressKey(before, event, contextRef.current)
    commitTyping(result.state)
    if (result.submitted) scoreGuess(result.submitted)
    else if (before.phase === "play" && event.type === "enter" && result.state.note === NOT_ENOUGH_LETTERS) {
      toast(NOT_ENOUGH_LETTERS, { duration: 1200 })
      setShake(true)
      window.setTimeout(() => setShake(false), snapshot.shakeMs)
    } else if (before.phase === "play" && event.type === "enter" && result.state.note === NOT_IN_WORD_LIST) {
      toast(NOT_IN_WORD_LIST, { duration: 1200 })
      setShake(true)
      window.setTimeout(() => setShake(false), snapshot.shakeMs)
    } else if (before.phase === "play" && event.type === "enter" && result.state.note === "use the revealed hints") {
      setShake(true)
      window.setTimeout(() => setShake(false), snapshot.shakeMs)
    }
  }, [scoreGuess, snapshot.shakeMs])

  useEffect(() => {
    if (!paused) rootRef.current?.focus()
  }, [paused])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (pausedRef.current) return
      if (event.key === "/" && !isShellControl(document.activeElement)) {
        event.preventDefault()
        unlockAudio()
        setAskOpen(true)
        return
      }
      if (wonRef.current && event.key === "Enter" && !isShellControl(event.target) && !isShellControl(document.activeElement)) {
        event.preventDefault()
        advanceWinRef.current()
        return
      }
      if (
        event.key === "Enter" &&
        typingRef.current.phase === "ended" &&
        !isShellControl(event.target) &&
        !isShellControl(document.activeElement)
      ) {
        event.preventDefault()
        const next = roundRef.current + 1
        const word = pickAnswer(snapshot, next, new Set([...usedRef.current, answerRef.current]), Math.random())
        beginRef.current(next, [...usedRef.current, answerRef.current], word)
        return
      }
      if (isShellControl(event.target) || isShellControl(document.activeElement)) return
      if (event.key === "Enter") {
        event.preventDefault()
        applyKey({ type: "enter" })
      } else if (event.key === "Backspace") {
        event.preventDefault()
        applyKey({ type: "backspace" })
      } else if (/^[a-zA-Z]$/.test(event.key)) {
        event.preventDefault()
        applyKey({ type: "letter", letter: event.key.toLowerCase() })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [applyKey, snapshot])

  const best = new Map<string, Mark>()
  for (const row of rows) {
    row.guess.split("").forEach((letter, index) => {
      const mark = row.marks[index]
      const previous = best.get(letter)
      if (!previous || mark === "correct" || (mark === "present" && previous !== "correct")) best.set(letter, mark)
    })
  }

  const showingDraft = phase === "play" || (phase === "reveal" && (typing.buffer.length > 0 || draft.length > 0))
  const emptyRows = Math.max(0, guesses - rows.length - (showingDraft ? 1 : 0))
  const winRow = won && poster

  return (
    <div
      ref={rootRef}
      className="lw"
      data-guess-input
      data-guesses={guesses}
      tabIndex={0}
      style={guesses > 6 ? ({ "--lw-tile": "46px" } as CSSProperties) : undefined}
    >
      <p className="lw-note label" role="status">
        {note}
      </p>
      <div
        className="lw-board"
        aria-label="board"
        onPointerDown={() => {
          if (wonRef.current) advanceWinRef.current()
        }}
      >
        {rows.filter((row) => row.guess.length === snapshot.length).map((row, rowIndex) => {
          const live = row === rows[rows.length - 1] && phase === "reveal"
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
        <div className="grid justify-items-center gap-2">
          <p className="tabular text-[14px] font-bold">{stats}</p>
          {won ? (
            <button
              type="button"
              data-win-next
              className="text-[14px] font-bold"
              onClick={() => advanceWinRef.current()}
            >
              press enter or tap for next
            </button>
          ) : null}
        </div>
      ) : (
        <div className="lw-keys">
          {KEY_ROWS.map((row, rowIndex) => (
            <div className="lw-keyrow" key={row}>
              {rowIndex === 2 ? (
                <Button type="button" variant="game" className="lw-key wide" onClick={() => applyKey({ type: "enter" })}>
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
                  onClick={() => applyKey({ type: "letter", letter })}
                >
                  {letter}
                </Button>
              ))}
              {rowIndex === 2 ? (
                <Button
                  type="button"
                  variant="game"
                  className="lw-key wide"
                  onClick={() => applyKey({ type: "backspace" })}
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
