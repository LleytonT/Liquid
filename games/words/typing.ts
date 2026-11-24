export type TypingPhase = "play" | "reveal" | "ended"

export type TypingState = {
  phase: TypingPhase
  draft: string
  /** Keys that arrived during a reveal, in order. A letter, "backspace", or "enter". */
  buffer: string[]
  note: string
}

export type TypingEvent = { type: "letter"; letter: string } | { type: "backspace" } | { type: "enter" }

export type TypingContext = {
  length: number
  /** Null when the word may be scored. Otherwise the player-facing reason. */
  accepts: (word: string) => string | null
}

export type TypingResult = {
  state: TypingState
  /** A full word that just became a scored row. Never shorter than length. */
  submitted: string | null
}

export const NOT_ENOUGH_LETTERS = "not enough letters"
export const NOT_IN_WORD_LIST = "not in word list"

export function emptyTyping(): TypingState {
  return { phase: "play", draft: "", buffer: [], note: "" }
}

function tokenOf(event: TypingEvent): string {
  if (event.type === "letter") return event.letter
  return event.type
}

function applyPlay(state: TypingState, event: TypingEvent, ctx: TypingContext): TypingResult {
  if (event.type === "letter") {
    if (state.draft.length >= ctx.length) return { state, submitted: null }
    return { state: { ...state, draft: state.draft + event.letter, note: "" }, submitted: null }
  }
  if (event.type === "backspace") {
    if (state.draft.length === 0) return { state, submitted: null }
    return { state: { ...state, draft: state.draft.slice(0, -1), note: "" }, submitted: null }
  }
  if (state.draft.length !== ctx.length) {
    return { state: { ...state, note: NOT_ENOUGH_LETTERS }, submitted: null }
  }
  const reason = ctx.accepts(state.draft)
  if (reason) return { state: { ...state, note: reason }, submitted: null }
  return {
    state: { phase: "reveal", draft: "", buffer: [], note: "" },
    submitted: state.draft,
  }
}

/** Letters and enter during a reveal are kept and applied, in order, when it ends. */
export function pressKey(state: TypingState, event: TypingEvent, ctx: TypingContext): TypingResult {
  if (state.phase === "ended") return { state, submitted: null }
  if (state.phase === "reveal") {
    return { state: { ...state, buffer: [...state.buffer, tokenOf(event)] }, submitted: null }
  }
  return applyPlay(state, event, ctx)
}

/**
 * The reveal finished. Replay buffered keys until the next scored word, and
 * leave anything after that enter waiting for the new reveal.
 */
export function endReveal(state: TypingState, ctx: TypingContext): TypingResult {
  if (state.phase !== "reveal") return { state, submitted: null }
  let next: TypingState = { ...state, phase: "play", buffer: [] }
  for (let index = 0; index < state.buffer.length; index++) {
    const key = state.buffer[index]
    const event: TypingEvent =
      key === "enter" ? { type: "enter" } : key === "backspace" ? { type: "backspace" } : { type: "letter", letter: key }
    const result = applyPlay(next, event, ctx)
    if (result.submitted) {
      if (result.submitted.length !== ctx.length) return { state: next, submitted: null }
      return {
        state: { ...result.state, buffer: state.buffer.slice(index + 1) },
        submitted: result.submitted,
      }
    }
    next = result.state
  }
  return { state: next, submitted: null }
}

/** What the next row shows, including letters typed during the current reveal. */
export function visibleDraft(state: TypingState, length: number): string {
  let draft = state.draft
  if (state.phase !== "reveal") return draft
  for (const key of state.buffer) {
    if (key === "enter") break
    if (key === "backspace") draft = draft.slice(0, -1)
    else if (draft.length < length) draft += key
  }
  return draft
}

export function revealDurationMs(length: number, staggerMs: number, tileFlipMs: number): number {
  return Math.max(0, length - 1) * staggerMs + tileFlipMs
}
