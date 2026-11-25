import type {
  GameAdapter,
  GameData,
  HeadlessReport,
  HeadlessRequest,
  HotApplyResult,
  InvariantListing,
  TweakKnob,
} from "@liquid/factory/types"
import type { BranchRecord } from "../../lib/shell/game-module"
import { feedback } from "./rules"
import { solveWords } from "./solve"
import { wordsBranches } from "./starters"
import { prepareWords } from "./validate"
import { refusalLine } from "../ask-refusal"

const TWEAKS: readonly TweakKnob[] = [
  { key: "guesses", min: 3, max: 10 },
  {
    key: "timerSeconds",
    min: 0,
    max: 300,
    note: "0 clears the timer. a positive timer is at least 30 seconds.",
    clamp: (value) => {
      if (value <= 0) return 0
      if (value < 30) return 30
      return Math.min(300, value)
    },
  },
  {
    key: "hardMode",
    min: 0,
    max: 1,
    clamp: (value) => (value >= 0.5 ? 1 : 0),
  },
  { key: "staggerMs", min: 200, max: 400 },
  { key: "roundEndMs", min: 1000, max: 3000 },
]

const knobByKey = new Map(TWEAKS.map((knob) => [knob.key, knob]))

function times(value: number): string {
  return String(Math.round(value * 100) / 100)
}

function limitNote(requested: number, value: number): string {
  if (requested === value) return ""
  return `. ${times(requested)} is past the limit`
}

function asRecord(data: GameData): BranchRecord {
  const record = data.body as BranchRecord
  if (!record || record.gameId !== "words") throw new Error("words view is missing")
  return record
}

function clamp(spec: TweakKnob, value: number): number {
  const next = spec.clamp ? spec.clamp(value) : Math.min(spec.max, Math.max(spec.min, value))
  if (next === null || next < spec.min || next > spec.max) throw new Error(`${spec.key} is outside ${spec.min}-${spec.max}`)
  return next
}

function applyPatch(data: GameData, patch: Readonly<Record<string, number>>): GameData {
  const record = structuredClone(asRecord(data))
  for (const [key, value] of Object.entries(patch)) {
    const spec = knobByKey.get(key)
    if (!spec) throw new Error(`${key} is not a words tweak`)
    const current = record.snapshot.tunables[key]
    if (current?.locked) throw new Error(`${key} is locked`)
    record.snapshot.tunables[key] = {
      value: clamp(spec, value),
      min: current?.min ?? spec.min,
      max: current?.max ?? spec.max,
      locked: false,
    }
  }
  return { ...data, body: record }
}

export function wordsRecord(data: GameData): BranchRecord {
  return asRecord(data)
}

export const wordsAdapter: GameAdapter = {
  contractVersion: 1,
  id: "words",
  tweaks: TWEAKS,
  exampleTweak: "give me 8 guesses",
  baseline: {
    guesses: 6,
    timerSeconds: 0,
    hardMode: 0,
    staggerMs: 280,
    roundEndMs: 1500,
  },
  fallbackHints: [
    { pattern: "\\b(\\d+)\\s+guess", patch: { guesses: 6 }, capture: "guesses" },
    { pattern: "more guesses|extra guesses|eight guesses|8 guesses", patch: { guesses: 8 } },
    { pattern: "fewer guesses|less guesses", patch: { guesses: 5 } },
    { pattern: "no timer|timer off|without a timer", patch: { timerSeconds: 0 } },
    { pattern: "hard mode.*(?:off|disable)|(?:off|disable).*hard mode", patch: { hardMode: 0 } },
    { pattern: "hard mode", patch: { hardMode: 1 } },
    {
      pattern: "(?=.*\\b(?:timer|time)\\b).*?(\\d+)\\s*(?:seconds?|secs?)",
      patch: { timerSeconds: 0 },
      capture: "timerSeconds",
    },
  ],
  load(branchId) {
    const found = wordsBranches.find((item) => item.id === branchId)
    if (!found) return null
    const record = structuredClone(found)
    return { id: record.id, parentId: record.parentId, title: record.title, body: record }
  },
  read(data) {
    const record = asRecord(data)
    const tunables: Record<string, number> = {}
    for (const [key, knob] of Object.entries(record.snapshot.tunables)) tunables[key] = knob.value
    return { tunables, summary: record.title }
  },
  write: applyPatch,
  hotApply(data, patch): HotApplyResult {
    return { when: "live", data: applyPatch(data, patch) }
  },
  withIdentity(data, meta) {
    const record = structuredClone(asRecord(data))
    record.id = meta.id
    record.parentId = meta.parentId
    record.title = meta.title
    record.snapshot = { ...record.snapshot, id: `${meta.id}-v1` }
    return { id: meta.id, parentId: meta.parentId, title: meta.title, body: record }
  },
  already(key, value) {
    if (key === "guesses") return `guesses are already ${times(value)}`
    if (key === "timerSeconds") return value <= 0 ? "there is already no time limit" : `the timer is already ${times(value)} seconds`
    if (key === "hardMode") return value >= 1 ? "hard mode is already on" : "hard mode is already off"
    return `${key} is already ${times(value)}`
  },
  refusal: refusalLine,
  interpret(ask, current): Record<string, number> | null {
    const text = ask.toLowerCase()
    if (/\b(level|levels|branch|branches|jump|gap|safe zone|word list|new word|multiplayer|weather|rain|snow|art)\b/.test(text)) {
      return null
    }
    const numbered = text.match(/\b(\d+)\s+guess/)
    if (numbered) return { guesses: Number(numbered[1]) }
    if (/(more guesses|extra guesses|eight guesses|8 guesses)/.test(text)) {
      const guesses = /eight|8/.test(text) ? 8 : Math.min(10, (current.guesses ?? 6) + 2)
      return { guesses }
    }
    if (/(fewer guesses|less guesses)/.test(text)) return { guesses: Math.max(3, (current.guesses ?? 6) - 1) }
    if (/(no timer|timer off|without a timer)/.test(text)) return { timerSeconds: 0 }
    if (/hard mode/.test(text)) return { hardMode: /off|disable/.test(text) ? 0 : 1 }
    const seconds = text.match(/(\d+)\s*(?:second|sec)/)
    if (seconds && /timer|time/.test(text)) return { timerSeconds: Number(seconds[1]) }
    return null
  },
  describePatch(patch, requested = patch) {
    const parts: string[] = []
    if (patch.guesses !== undefined) {
      const value = patch.guesses
      parts.push(`${times(value)} guesses${limitNote(requested.guesses ?? value, value)}`)
    }
    if (patch.timerSeconds !== undefined) {
      const value = patch.timerSeconds
      const asked = requested.timerSeconds ?? value
      const phrase = value <= 0 ? "no time limit" : `a ${times(value)} second timer`
      parts.push(`${phrase}${asked === value ? "" : `. ${times(asked)} seconds is past the limit`}`)
    }
    if (patch.hardMode !== undefined) parts.push(patch.hardMode >= 1 ? "hard mode is on" : "hard mode is off")
    if (patch.staggerMs !== undefined) parts.push(`tiles reveal ${patch.staggerMs > 280 ? "more slowly" : "more quickly"}`)
    if (patch.roundEndMs !== undefined) parts.push("a different pause between rounds")
    return parts.join(", ")
  },
  runHeadless(data, request: HeadlessRequest): HeadlessReport {
    const snapshot = prepareWords(asRecord(data))
    if (request.mode === "ticks") {
      return { ticks: request.ticks, done: false, summary: "words has no clock. pass a script of guesses." }
    }
    const answer = snapshot.lists.bands.common[0]
    if (!answer) return { ticks: 0, done: false, summary: "no answer" }
    let ticks = 0
    for (const step of request.steps) {
      ticks += 1
      const marks = feedback(step.input.trim().toLowerCase(), answer)
      if (marks.every((mark) => mark === "correct")) return { ticks, done: true, summary: `solved ${answer}` }
    }
    return { ticks, done: false, summary: "not solved" }
  },
  listInvariants(): readonly InvariantListing[] {
    return [
      { id: "one-secret", summary: "one secret word per round" },
      { id: "answer-list", summary: "answers come from the answer list" },
      { id: "three-states", summary: "three states stay distinct by fill, ring, and sunken shape" },
    ]
  },
  solve(data) {
    const results = solveWords(asRecord(data))
    return { ok: results.every((result) => result.ok), notes: results.flatMap((result) => result.notes) }
  },
  screenshot() {
    return { supported: false, reason: "screenshot is a stub on contract v1" }
  },
  content: {
    plan() {
      return { summary: "this isn't built yet. new levels and branches aren't live yet. try a tweak like give me 8 guesses." }
    },
  },
}
