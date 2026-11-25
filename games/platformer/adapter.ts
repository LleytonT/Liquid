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
import { initialSim, step } from "./physics"
import seed from "./seed.json"
import { solvePlatformer } from "./solve"
import { preparePlatformer } from "./validate"
import { refusalLine } from "../ask-refusal"

const ROOT = seed as BranchRecord

const TWEAKS: readonly TweakKnob[] = [
  { key: "playerSpeed", min: 100, max: 140, note: "120 is normal. lower is slower." },
  { key: "playerVisualPx", min: 24, max: 32 },
  { key: "enemyVisualRadiusPx", min: 6, max: 16 },
  { key: "coinRadiusPx", min: 8, max: 16 },
  {
    key: "enemySpeedScale",
    min: 0.45,
    max: 2.5,
    note: "1 is unchanged, 2 is twice as fast, 0.5 is half as fast.",
  },
]

const knobByKey = new Map(TWEAKS.map((knob) => [knob.key, knob]))

function asRecord(data: GameData): BranchRecord {
  const record = data.body as BranchRecord
  if (!record || record.gameId !== "platformer") throw new Error("platformer view is missing")
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
    if (!spec) throw new Error(`${key} is not a platformer tweak`)
    const current = record.snapshot.tunables[key]
    if (current?.locked) throw new Error(`${key} is locked`)
    record.snapshot.tunables[key] = { value: clamp(spec, value), min: spec.min, max: spec.max, locked: false }
  }
  return { ...data, body: record }
}

function times(value: number): string {
  return String(Math.round(value * 100) / 100)
}

function limitNote(requested: number, value: number): string {
  if (requested === value) return ""
  return `. ${times(requested)} is past the limit`
}

function enemyPhrase(value: number, requested: number): string {
  const pace = value === 1 ? "at the same speed" : value > 1 ? `${times(value)}x faster` : `${times(value)}x as fast`
  const line = `blue shapes move ${pace}`
  if (requested === value) return line
  return `${line}. ${times(requested)}x is past the limit`
}

function askedScale(text: string): number | null {
  const slower = /\b(slow|slower)\b/.test(text) && !/\b(fast|faster)\b/.test(text)
  if (/\bhalf\b/.test(text)) return 0.5
  if (/\b(twice|double|two times|2x)\b/.test(text)) return slower ? 0.5 : 2
  if (/\b(triple|three times|3x)\b/.test(text)) return slower ? 1 / 3 : 3
  const match = text.match(/(\d+(?:\.\d+)?)\s*x\b/)
  if (!match) return null
  const amount = Number(match[1])
  return slower ? 1 / amount : amount
}

function dirOf(input: string): { x: number; y: number } {
  if (input === "left") return { x: -1, y: 0 }
  if (input === "right") return { x: 1, y: 0 }
  if (input === "up") return { x: 0, y: -1 }
  if (input === "down") return { x: 0, y: 1 }
  return { x: 0, y: 0 }
}

export function platformerRecord(data: GameData): BranchRecord {
  return asRecord(data)
}

export const platformerAdapter: GameAdapter = {
  contractVersion: 1,
  id: "platformer",
  tweaks: TWEAKS,
  exampleTweak: "make the blue shapes slower",
  baseline: {
    playerSpeed: 120,
    playerVisualPx: 28,
    enemyVisualRadiusPx: 8,
    coinRadiusPx: 12,
    enemySpeedScale: 1,
  },
  fallbackHints: [
    {
      pattern: "(?:blue|dots?|enemies|enemy|shapes?).*(?:\\bslow)|(?:\\bslow).*(?:blue|dots?|enemies|enemy|shapes?)",
      patch: { enemySpeedScale: 0.55 },
    },
    {
      pattern: "(?:blue|dots?|enemies|enemy|shapes?).*(?:\\bfast)|(?:\\bfast).*(?:blue|dots?|enemies|enemy|shapes?)",
      patch: { enemySpeedScale: 1.4 },
    },
    {
      pattern: "(?:square|player|\\bme\\b|\\bi\\b|myself).*(?:\\bslow)|(?:\\bslow).*(?:square|player|\\bme\\b|\\bi\\b|myself)",
      patch: { playerSpeed: 100 },
    },
    {
      pattern: "(?:square|player|\\bme\\b|\\bi\\b|myself).*(?:\\bfast)|(?:\\bfast).*(?:square|player|\\bme\\b|\\bi\\b|myself)",
      patch: { playerSpeed: 140 },
    },
  ],
  load(branchId) {
    if (branchId !== ROOT.id) return null
    const record = structuredClone(ROOT)
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
    if (key === "enemySpeedScale") {
      if (value === 1) return "blue shapes already move at normal speed"
      return value > 1 ? `blue shapes already move ${times(value)}x faster` : `blue shapes already move ${times(value)}x as fast`
    }
    if (key === "playerSpeed") {
      return value === 120 ? "you already move at normal speed" : value < 120 ? "you already move slower" : "you already move faster"
    }
    return `${key} is already ${times(value)}`
  },
  refusal: refusalLine,
  interpret(ask) {
    const text = ask.toLowerCase()
    if (/\b(level|levels|branch|branches|jump|gap|safe zone|word list|new word|multiplayer|weather|rain|snow|art)\b/.test(text)) {
      return null
    }
    const aboutBlue = /(blue|dot|dots|enemy|enemies|shape|shapes)/.test(text)
    const aboutYou = /(player|square|\bme\b|\bi\b|myself)/.test(text)
    const aboutPace = /(fast|slow|speed|quick)/.test(text)
    const scale = askedScale(text)
    if (scale !== null && (aboutBlue || (aboutPace && !aboutYou))) return { enemySpeedScale: scale }
    if (aboutBlue && /(slow|slower)/.test(text)) return { enemySpeedScale: 0.55 }
    if (aboutBlue && /(fast|faster)/.test(text)) return { enemySpeedScale: 1.4 }
    if (aboutYou && /(slow|slower)/.test(text)) return { playerSpeed: 100 }
    if (aboutYou && /(fast|faster)/.test(text)) return { playerSpeed: 140 }
    return null
  },
  describePatch(patch, requested = patch) {
    const parts: string[] = []
    if (patch.enemySpeedScale !== undefined) {
      parts.push(enemyPhrase(patch.enemySpeedScale, requested.enemySpeedScale ?? patch.enemySpeedScale))
    }
    if (patch.playerSpeed !== undefined) {
      const value = patch.playerSpeed
      const asked = requested.playerSpeed ?? value
      const pace = value < 120 ? "you move slower" : value > 120 ? "you move faster" : "you move at normal speed"
      parts.push(`${pace}${limitNote(asked, value)}`)
    }
    if (patch.coinRadiusPx !== undefined) {
      const value = patch.coinRadiusPx
      parts.push(`${value >= 12 ? "bigger coins" : "smaller coins"}${limitNote(requested.coinRadiusPx ?? value, value)}`)
    }
    if (patch.enemyVisualRadiusPx !== undefined) {
      const value = patch.enemyVisualRadiusPx
      parts.push(`${value >= 8 ? "bigger dots" : "smaller dots"}${limitNote(requested.enemyVisualRadiusPx ?? value, value)}`)
    }
    if (patch.playerVisualPx !== undefined) {
      const value = patch.playerVisualPx
      parts.push(`${value >= 28 ? "a bigger square" : "a smaller square"}${limitNote(requested.playerVisualPx ?? value, value)}`)
    }
    return parts.join(", ")
  },
  runHeadless(data, request: HeadlessRequest): HeadlessReport {
    const snapshot = preparePlatformer(asRecord(data))
    const level = snapshot.levels[0]
    if (!level) return { ticks: 0, done: false, summary: "no level" }
    let sim = initialSim(level)
    const steps = request.mode === "script" ? request.steps : []
    const ticks = request.mode === "ticks" ? request.ticks : steps.length
    for (let i = 0; i < ticks; i++) {
      const input = steps[i]?.input ?? ""
      const result = step(sim, dirOf(input), level, snapshot.playerSpeed, snapshot.enemySpeedScale)
      sim = result.sim
      if (result.events.cleared) return { ticks: i + 1, done: true, summary: "cleared" }
    }
    return { ticks, done: sim.cleared, summary: `x ${Math.round(sim.x)} y ${Math.round(sim.y)}` }
  },
  listInvariants(): readonly InvariantListing[] {
    return [
      { id: "finishable", summary: "every level is finishable" },
      { id: "spawn", summary: "no enemy path crosses a spawn tile" },
      { id: "no-text", summary: "no text inside a level" },
    ]
  },
  solve(data) {
    const results = solvePlatformer(asRecord(data))
    return { ok: results.every((result) => result.ok), notes: results.flatMap((result) => result.notes) }
  },
  screenshot() {
    return { supported: false, reason: "screenshot is a stub on contract v1" }
  },
  content: {
    plan() {
      return { summary: "this isn't built yet. new levels and branches aren't live yet. try a tweak like make the blue shapes slower." }
    },
  },
}
